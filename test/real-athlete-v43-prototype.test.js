"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const VERSION = "20260814-real-athlete-v43-prototype";
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const ENGINE = read("public", "js", "image-sequence-v43.js");
const INTEGRATION = read("public", "js", "illustrated-v4.js");
const CSS = read("public", "css", "scenes", "image-sequence-v43.css");
const MERGED_CSS = read("public", "css", "illustrated-v4.css");
const SW = read("public", "sw.js");
const MANIFEST = JSON.parse(read("public", "assets", "athlete-motion", "v43", "manifest.json"));

function loadEngine(hostname, search) {
  const window = { location: { hostname, search } };
  vm.runInNewContext(ENGINE, { window, URLSearchParams, Image: class {} });
  return window.FuelPhysiqueImageSequenceV43;
}

test("all 13 source JPEGs and 13 transparent normalized WebPs are preserved by scene", () => {
  assert.equal(MANIFEST.version, VERSION);
  assert.deepEqual(MANIFEST.canvas, { width: 960, height: 720 });
  const expected = { deadlift: 4, bench: 4, nutrition: 5 };
  for (const [scene, count] of Object.entries(expected)) {
    const sourceDir = path.join(ROOT, "public", "assets", "athlete-motion", "v43", scene, "source");
    const normalizedDir = path.join(ROOT, "public", "assets", "athlete-motion", "v43", scene, "normalized");
    const sources = fs.readdirSync(sourceDir).filter((file) => file.endsWith(".jpg"));
    const normalized = fs.readdirSync(normalizedDir).filter((file) => file.endsWith(".webp"));
    assert.equal(sources.length, count, `${scene} source count`);
    assert.equal(normalized.length, count, `${scene} normalized count`);
    for (const file of sources) {
      const bytes = fs.readFileSync(path.join(sourceDir, file));
      assert.deepEqual([...bytes.subarray(0, 2)], [0xff, 0xd8], `${scene}/${file} is JPEG`);
    }
    for (const file of normalized) {
      const bytes = fs.readFileSync(path.join(normalizedDir, file));
      assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${scene}/${file} RIFF signature`);
      assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${scene}/${file} WebP signature`);
    }
  }
});

test("the V4.3 switch is local-only and requires the exact query value", () => {
  assert.equal(loadEngine("127.0.0.1", "?athleteMotion=v43").isEnabled(), true);
  assert.equal(loadEngine("localhost", "?athleteMotion=v43").isEnabled(), true);
  assert.equal(loadEngine("fuelphysique.com", "?athleteMotion=v43").isEnabled(), false);
  assert.equal(loadEngine("127.0.0.1", "").isEnabled(), false);
  assert.equal(loadEngine("127.0.0.1", "?athleteMotion=v42").isEnabled(), false);
});

test("semantic frame order and reviewed timings are encoded without inventing poses", () => {
  const scenes = loadEngine("localhost", "?athleteMotion=v43").scenes;
  assert.deepEqual(Array.from(scenes.deadlift.frames, (item) => item.duration), [350, 220, 450, 320, 360]);
  assert.deepEqual(Array.from(scenes.nutrition.frames, (item) => item.duration), [300, 220, 250, 450, 300, 320]);
  assert.deepEqual(Array.from(scenes.benchPr.omittedSourceFrames), [3]);
  assert.deepEqual(Array.from(scenes.benchPr.frames, (item) => path.basename(new URL(item.url, "http://local").pathname)), [
    "frame-01.webp", "frame-02.webp", "frame-04.webp", "frame-01.webp"
  ]);
});

test("motion uses one decoded image with discrete switching, visibility pause and clean teardown", () => {
  assert.match(ENGINE, /image\.decode\(\)/);
  assert.match(ENGINE, /new IntersectionObserver/);
  assert.match(ENGINE, /if \(!visible \|\| destroyed\) return/);
  assert.match(ENGINE, /observer\?\.disconnect\(\)/);
  assert.match(ENGINE, /removeEventListener/);
  assert.match(CSS, /transition: none/);
  assert.doesNotMatch(CSS, /crossfade|opacity:\s*0/);
});

test("reduced motion holds a reviewed static pose and automatic playback is one-shot", () => {
  assert.match(ENGINE, /if \(destroyed \|\| reduced \|\| \(!replay && played\)\) return/);
  assert.match(ENGINE, /v43ReducedMotion = "true"/);
  assert.match(ENGINE, /reducedFrame: frame\("deadlift", 3, 0\)/);
  assert.match(ENGINE, /reducedFrame: frame\("bench", 1, 0\)/);
  assert.match(ENGINE, /reducedFrame: frame\("nutrition", 4, 0\)/);
});

test("preload failures restore the original V4.2 markup instead of blanking a scene", () => {
  assert.match(ENGINE, /const fallbackMarkup = host\.innerHTML/);
  assert.match(ENGINE, /host\.innerHTML = fallbackMarkup/);
  assert.match(ENGINE, /v43-fallback-restored/);
  assert.match(INTEGRATION, /v43\?\.isEnabled\(\) && v43\.mount\(host, name\)/);
  assert.match(INTEGRATION, /hosts = hosts\.filter\(\(host\) => host\.dataset\.v43Motion !== "prototype"\)/);
});

test("the single production stylesheet contains the reviewed V4.3 source CSS", () => {
  for (const line of CSS.split(/\r?\n/).filter(Boolean)) {
    assert.ok(MERGED_CSS.includes(line), `missing merged CSS: ${line}`);
  }
  assert.match(MERGED_CSS, /object-fit: contain/);
  assert.match(MERGED_CSS, /max-width: 720px/);
});

test("landing and dashboard load the engine before integration with one cache generation", () => {
  for (const file of ["index.html", "dashboard.html"]) {
    const html = read("public", file);
    const engine = `/js/image-sequence-v43.js?v=${VERSION}`;
    const integration = `/js/illustrated-v4.js?v=${VERSION}`;
    assert.ok(html.includes(engine));
    assert.ok(html.indexOf(engine) < html.indexOf(integration));
    assert.match(html, new RegExp(`illustrated-v4\\.css\\?v=${VERSION}`));
  }
});

test("the new cache identity avoids stale V4.2 mixing without eager-loading motion frames", () => {
  assert.match(SW, /fuelphysique-v17-real-athlete-v43-prototype/);
  assert.match(SW, new RegExp(`image-sequence-v43\\.js\\?v=${VERSION}`));
  assert.doesNotMatch(SW, /athlete-motion\/v43\/.+frame-/);
  assert.match(SW, /AUTH_PROXY_PREFIX = '\/__\/auth\/'/);
  assert.match(SW, /NETWORK_ONLY_PREFIXES = \['\/api\/'\]/);
  assert.match(SW, /event\.request\.destination === 'audio'/);
});
