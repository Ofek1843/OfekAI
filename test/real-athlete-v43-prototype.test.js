"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const VERSION = "20260815-real-athlete-v43-complete-5";
const PLATE_ASSET_VERSION = "20260815-real-athlete-v43-plate-bulk-fix-2";
const CSS_VERSION = "20260815-real-athlete-v43-complete-5";
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

test("original sources remain preserved while final Deadlift and Bench sources are traceable", () => {
  assert.equal(MANIFEST.version, VERSION);
  assert.deepEqual(MANIFEST.canvas, { width: 960, height: 720 });
  const sourceExpected = { deadlift: 4, bench: 4, nutrition: 5, training: 5, track: 4, connect: 4, coach: 4, plate: 4, session: 4 };
  const normalizedExpected = { deadlift: 5, bench: 4, nutrition: 5, training: 5, track: 4, connect: 4, coach: 4, plate: 4, session: 4 };
  for (const [scene, count] of Object.entries(sourceExpected)) {
    const sourceDir = path.join(ROOT, "public", "assets", "athlete-motion", "v43", scene, ["training", "track", "connect", "coach", "plate", "session"].includes(scene) ? "final-source" : "source");
    const normalizedDir = path.join(ROOT, "public", "assets", "athlete-motion", "v43", scene, "normalized");
    const sources = fs.readdirSync(sourceDir).filter((file) => /^frame-\d+\.(?:jpg|png)$/i.test(file));
    const normalized = fs.readdirSync(normalizedDir).filter((file) => file.endsWith(".webp"));
    assert.equal(sources.length, count, `${scene} source count`);
    assert.equal(normalized.length, normalizedExpected[scene], `${scene} normalized count`);
    for (const file of sources) {
      const bytes = fs.readFileSync(path.join(sourceDir, file));
      if (/\.jpg$/i.test(file)) assert.deepEqual([...bytes.subarray(0, 2)], [0xff, 0xd8], `${scene}/${file} is JPEG`);
      else assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], `${scene}/${file} is PNG`);
    }
    for (const file of normalized) {
      const bytes = fs.readFileSync(path.join(normalizedDir, file));
      assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${scene}/${file} RIFF signature`);
      assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${scene}/${file} WebP signature`);
    }
  }

  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const finalDeadlift = path.join(ROOT, "public", "assets", "athlete-motion", "v43", "deadlift", "final-source");
  const finalBench = path.join(ROOT, "public", "assets", "athlete-motion", "v43", "bench", "final-source", "frame-03.png");
  assert.deepEqual(fs.readFileSync(path.join(finalDeadlift, "deadlift-motion-sheet.png")).subarray(0, 4), pngSignature);
  for (let index = 1; index <= 5; index += 1) {
    const file = `frame-${String(index).padStart(2, "0")}.png`;
    assert.deepEqual(fs.readFileSync(path.join(finalDeadlift, file)).subarray(0, 4), pngSignature);
  }
  assert.deepEqual(fs.readFileSync(finalBench).subarray(0, 4), pngSignature);
});

test("final source mapping uses exact equal-width Deadlift boundaries and corrected Bench semantics", () => {
  const { width, height } = MANIFEST.scenes.deadlift.motionSheetSourceDimensions;
  assert.ok(width > 0 && height > 0);
  assert.deepEqual(MANIFEST.scenes.deadlift.splitFrames.map(({ left, right, width: frameWidth }) => ({ left, right, width: frameWidth })),
    Array.from({ length: 5 }, (_, index) => {
      const left = Math.floor(index * width / 5);
      const right = Math.floor((index + 1) * width / 5);
      return { left, right, width: right - left };
    })
  );
  assert.deepEqual(MANIFEST.scenes.deadlift.frames.map((frame) => frame.semantic), [
    "setup", "early-pull", "lockout", "controlled-descent", "return-to-setup"
  ]);
  assert.equal(MANIFEST.scenes.bench.frames[2].semantic, "bottom-lower-mid-chest");
  assert.deepEqual(MANIFEST.scenes.training.frames.map((frame) => frame.file), [
    "frame-01.webp", "frame-02.webp", "frame-03.webp", "frame-04.webp", "frame-05.webp"
  ]);
  assert.deepEqual(MANIFEST.scenes.training.motionSheetSourceDimensions, { width: 1774, height: 887 });
  assert.match(MANIFEST.scenes.training.motionSheetSource, /training\/final-source\/training-curl-motion-sheet-transparent\.png$/);
  assert.equal(MANIFEST.scenes.nutrition.sourceBytes, 507999);
  assert.equal(MANIFEST.scenes.nutrition.normalizedBytes, 576812);
  assert.deepEqual(MANIFEST.scenes.track.frames.map((frame) => frame.semantic), ["approach", "planted", "reading", "settled"]);
  assert.deepEqual(MANIFEST.scenes.connect.frames.map((frame) => frame.semantic), ["phone-review", "desktop-review", "phone-share", "desktop-receive"]);
  assert.deepEqual(MANIFEST.scenes.coach.frames.map((frame) => frame.semantic), ["review", "raise", "tap", "ready"]);
  assert.deepEqual(MANIFEST.scenes.plate.frames.map((frame) => frame.semantic), ["cut-male", "cut-female", "bulk-male", "bulk-female"]);
  assert.deepEqual(MANIFEST.scenes.session.frames.map((frame) => frame.semantic), ["hip-thrust-setup", "hip-thrust-top", "shoulder-press-lower", "shoulder-press-top"]);
});

test("V4.3 is default on the production hosts while localhost remains opt-in", () => {
  assert.equal(loadEngine("127.0.0.1", "?athleteMotion=v43").isEnabled(), true);
  assert.equal(loadEngine("localhost", "?athleteMotion=v43").isEnabled(), true);
  assert.equal(loadEngine("fuelphysique.com", "").isEnabled(), true);
  assert.equal(loadEngine("www.fuelphysique.com", "").isEnabled(), true);
  assert.equal(loadEngine("fuelphysique.com", "?athleteMotion=v42").isEnabled(), true);
  assert.equal(loadEngine("127.0.0.1", "").isEnabled(), false);
  assert.equal(loadEngine("127.0.0.1", "?athleteMotion=v42").isEnabled(), false);
  assert.equal(loadEngine("preview.fuelphysique.com", "?athleteMotion=v43").isEnabled(), false);
});

test("semantic frame order and reviewed timings are encoded without inventing poses", () => {
  const scenes = loadEngine("localhost", "?athleteMotion=v43").scenes;
  assert.ok(scenes.plate.frames.every((item) => new URL(item.url, "http://local").searchParams.get("v") === PLATE_ASSET_VERSION));
  assert.ok(scenes.deadlift.frames.every((item) => new URL(item.url, "http://local").searchParams.get("v") === VERSION));
  assert.deepEqual(Array.from(scenes.deadlift.frames, (item) => item.duration), [380, 240, 470, 320, 340, 360]);
  assert.deepEqual(Array.from(scenes.training.frames, (item) => item.duration), [360, 230, 440, 300, 340, 360]);
  assert.deepEqual(Array.from(scenes.nutrition.frames, (item) => item.duration), [300, 220, 250, 450, 300, 320]);
  assert.deepEqual(Array.from(scenes.track.frames, (item) => item.duration), [360, 360, 420, 420, 360]);
  assert.deepEqual(Array.from(scenes.social.frames, (item) => item.duration), [420, 360, 420, 420, 360]);
  assert.deepEqual(Array.from(scenes.coach.frames, (item) => item.duration), [380, 320, 420, 420, 360]);
  assert.deepEqual(Array.from(scenes.plate.frames, (item) => item.duration), [520, 520, 620, 620]);
  assert.match(ENGINE, /reducedFrame: frame\("plate", 4, 0\)/);
  assert.deepEqual(Array.from(scenes.session.frames, (item) => item.duration), [520, 620, 520, 620, 420]);
  assert.deepEqual(Array.from(scenes.benchPr.frames, (item) => path.basename(new URL(item.url, "http://local").pathname)), [
    "frame-01.webp", "frame-02.webp", "frame-03.webp", "frame-04.webp", "frame-01.webp"
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
  assert.match(ENGINE, /reducedFrame: frame\("training", 3, 0\)/);
  assert.match(ENGINE, /reducedFrame: frame\("track", 3, 0\)/);
  assert.match(ENGINE, /reducedFrame: frame\("connect", 4, 0\)/);
  assert.match(ENGINE, /reducedFrame: frame\("coach", 4, 0\)/);
});

test("preload failures restore the original V4.2 markup instead of blanking a scene", () => {
  assert.match(ENGINE, /const fallbackMarkup = host\.innerHTML/);
  assert.match(ENGINE, /host\.innerHTML = fallbackMarkup/);
  assert.match(ENGINE, /v43-fallback-restored/);
  assert.match(INTEGRATION, /const v43Scene = name === "progress" \? "track" : name === "training" \? "session" : name === "nutrition" \? "plate" : name/);
  assert.match(INTEGRATION, /v43\?\.isEnabled\(\) && v43\.mount\(host, v43Scene\)/);
  assert.match(INTEGRATION, /hosts = hosts\.filter\(\(host\) => host\.dataset\.v43Motion !== "prototype"\)/);
});

test("the single production stylesheet contains the reviewed V4.3 source CSS", () => {
  for (const line of CSS.split(/\r?\n/).filter(Boolean)) {
    assert.ok(MERGED_CSS.includes(line), `missing merged CSS: ${line}`);
  }
  assert.match(MERGED_CSS, /object-fit: contain/);
  assert.match(MERGED_CSS, /max-width: 720px/);
});

test("V4.3 athlete stages contain frames and expose the Bench review host", () => {
  const dashboard = read("public", "dashboard.html");
  assert.match(CSS, /\.v43-image-sequence\s*\{[^}]*overflow: hidden/s);
  assert.match(CSS, /landing-hero-illustration\[data-v43-motion="prototype"\][^{]*\{[^}]*contain: paint/s);
  assert.match(CSS, /journey-illustration\[data-v43-motion="prototype"\][\s\S]*?overflow: hidden;[\s\S]*?contain: paint;/);
  assert.doesNotMatch(CSS, /width:\s*(108|112)%/);
  assert.match(dashboard, /id="v43-bench-review"\s+data-capability="progress"/);
  assert.match(CSS, /#v43-bench-review\s*\{[^}]*scroll-margin-top: 92px/s);
  assert.match(CSS, /#v43-bench-review \.capability-illustration\[data-v43-motion="prototype"\][^{]*\{[^}]*width: 44%;[^}]*height: 72%;/s);
  assert.match(CSS, /#v43-bench-review\s*\{[^}]*min-height: 530px/s);
  assert.match(CSS, /#v43-bench-review \.capability-illustration\[data-v43-motion="prototype"\][^{]*\{[^}]*height: 50% !important/s);
  assert.match(CSS, /journey-card--training[\s\S]*v43-motion="prototype"/s);
  assert.match(CSS, /capability-card--training[\s\S]*v43-motion="prototype"/s);
  assert.match(ENGINE, /frame\("track", 1/);
  assert.match(ENGINE, /frame\("connect", 1/);
  assert.match(ENGINE, /frame\("coach", 1/);
  assert.match(ENGINE, /frame\("plate", 1/);
  assert.match(ENGINE, /frame\("session", 1/);
});

test("landing and dashboard load the engine before integration with one cache generation", () => {
  for (const file of ["index.html", "dashboard.html"]) {
    const html = read("public", file);
    const engine = `/js/image-sequence-v43.js?v=${PLATE_ASSET_VERSION}`;
    const integration = `/js/illustrated-v4.js?v=${VERSION}`;
    assert.ok(html.includes(engine));
    assert.ok(html.indexOf(engine) < html.indexOf(integration));
    assert.match(html, new RegExp(`illustrated-v4\\.css\\?v=${CSS_VERSION}`));
  }
});

test("the new cache identity avoids stale V4.2 mixing without eager-loading motion frames", () => {
  assert.match(SW, /fuelphysique-v32-deep-ocean-v45/);
  assert.match(SW, new RegExp(`image-sequence-v43\\.js\\?v=${PLATE_ASSET_VERSION}`));
  assert.doesNotMatch(SW, /athlete-motion\/v43\/.+frame-/);
  assert.match(SW, /AUTH_PROXY_PREFIX = '\/__\/auth\/'/);
  assert.match(SW, /NETWORK_ONLY_PREFIXES = \['\/api\/'\]/);
  assert.match(SW, /event\.request\.destination === 'audio'/);
});
