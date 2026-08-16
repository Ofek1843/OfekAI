"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const LANDING = read("public", "index.html");
const DASHBOARD = read("public", "dashboard.html");
const ILLUSTRATIONS = read("public", "js", "illustrated-v4.js");
const SW = read("public", "sw.js");
const ASSET_VERSION = "20260815-real-athlete-v43-complete-5";
const ENGINE_VERSION = "20260815-real-athlete-v43-plate-bulk-fix-2";
const CSS_VERSION = "20260815-real-athlete-v43-complete-5";

function illustrationScripts(html) {
  return [...html.matchAll(/<script defer src="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((source) => /athlete-figure|\/scenes\/|image-sequence-v43|illustrated-v4/.test(source));
}

function sceneRegistry() {
  const window = {};
  const context = vm.createContext({ window, console });
  for (const file of [
    ["public", "js", "athlete-figure.js"],
    ["public", "js", "scenes", "training.js"],
    ["public", "js", "scenes", "nutrition.js"],
    ["public", "js", "scenes", "progress.js"],
    ["public", "js", "scenes", "coachsocial.js"],
  ]) vm.runInContext(read(...file), context, { filename: file.join("/") });
  return window;
}

test("Landing and Dashboard load each V4.1 browser module exactly once and in dependency order", () => {
  const expected = [
    `/js/athlete-figure.js?v=${ASSET_VERSION}`,
    `/js/scenes/training.js?v=${ASSET_VERSION}`,
    `/js/scenes/nutrition.js?v=${ASSET_VERSION}`,
    `/js/scenes/progress.js?v=${ASSET_VERSION}`,
    `/js/scenes/coachsocial.js?v=${ASSET_VERSION}`,
    `/js/image-sequence-v43.js?v=${ENGINE_VERSION}`,
    `/js/illustrated-v4.js?v=${ASSET_VERSION}`,
  ];
  assert.deepEqual(illustrationScripts(LANDING), expected);
  assert.deepEqual(illustrationScripts(DASHBOARD), expected);
});

test("V4.1 scene CSS is merged into the single illustrated stylesheet without duplicate links", () => {
  const merged = read("public", "css", "illustrated-v4.css");
  for (const file of ["training.css", "nutrition.css", "progress.css", "coachsocial.css", "image-sequence-v43.css"]) {
    for (const line of read("public", "css", "scenes", file).split(/\r?\n/).filter(Boolean)) {
      assert.ok(merged.includes(line), `${file} line is absent from illustrated-v4.css: ${line}`);
    }
  }
  for (const html of [LANDING, DASHBOARD]) {
    assert.equal((html.match(/illustrated-v4\.css/g) || []).length, 1);
    assert.doesNotMatch(html, /css\/scenes\//);
  }
});

test("every authored V4.1 scene registers and emits its recognition-critical markup", () => {
  const window = sceneRegistry();
  assert.ok(window.FuelPhysiqueAthlete);
  const expected = {
    training: [/tr-scene/, /tr-farm/, /tr-bell/, /<circle/],
    nutrition: [/nu-scene/, /nu-table/, /nu-meal/, /nu-fork/],
    progress: [/pr-scale/, /pr-readout/, /class="fa-foot"/],
    benchPr: [/pr-bench-pad/, /class="pr-bar"/, /class="fa-hand"/, /<circle/],
    coach: [/co-scene/, /co-board/, /co-next/],
    social: [/so-scene/, /so-card--workout/, /so-card--music/, /so-card--message/],
  };
  for (const [name, patterns] of Object.entries(expected)) {
    assert.equal(typeof window.FuelPhysiqueScenes[name], "function", `${name} is not registered`);
    const markup = window.FuelPhysiqueScenes[name]();
    for (const pattern of patterns) assert.match(markup, pattern, `${name} is missing ${pattern}`);
  }
});

test("the shared figure language has an athletic taper and organic muscle contours", () => {
  const { FuelPhysiqueAthlete: athlete } = sceneRegistry();
  assert.ok(athlete.P.shoulderW > athlete.P.chestW);
  assert.ok(athlete.P.chestW > athlete.P.pelvisW);
  assert.ok(athlete.P.pelvisW > athlete.P.waistW);
  assert.match(athlete.seg(0, 0, 20, 20, 8, 5), /Q/);
  assert.match(athlete.torso(100, 60, 100, 112, 1, "front"), /fa-definition--chest/);
  assert.match(athlete.torso(100, 60, 130, 112, 1, "profile"), /fa-torso-shell--profile/);
});

test("key static poses remain recognizable after one-shot motion completes", () => {
  const css = read("public", "css", "illustrated-v4.css");
  assert.match(css, /is-illustration-complete \.tr-farm \{ transform: rotate\(78deg\); \}/);
  assert.match(css, /is-illustration-complete \.nu-farm \{ transform: rotate\(-74\.7deg\); \}/);
  assert.match(css, /is-illustration-complete \.nu-head \{ transform: translate\(3px,1px\) rotate\(4deg\); \}/);
});

test("bench and deadlift paths encode the reviewed biomechanics", () => {
  const { FuelPhysiqueScenes } = sceneRegistry();
  const bench = FuelPhysiqueScenes.benchPr();
  const css = read("public", "css", "illustrated-v4.css");
  assert.match(bench, /pr-head-pad/);
  assert.match(bench, /barbellRound\(155, 68, 82, 22\)|cx="73"/);
  assert.match(bench, /pr-chest/);
  assert.ok(css.includes("48%,58% { transform: translate(-10px,40px); }"));
  assert.ok(css.includes("60%,78% { transform: translate(-3px,-37px); }"));
  assert.match(ILLUSTRATIONS, /A\.torso\(shoulder\.x, shoulder\.y, hip\.x, hip\.y, 1, "profile"\)/);
});

test("the existing page architecture visibly adopts both progress scenes without adding a sixth card", () => {
  assert.match(LANDING, /capability="progress"|journey-card--progress/);
  assert.match(LANDING, /data-v4-illustration="progress"/);
  assert.match(DASHBOARD, /capability-card--progress/);
  assert.match(DASHBOARD, /data-v4-illustration="benchPr"/);
  assert.equal((DASHBOARD.match(/class="capability-card capability-card--/g) || []).length, 5);
});

test("mobile illustration hosts remain inside their cards so people and equipment are not cropped", () => {
  const css = read("public", "css", "illustrated-v4.css");
  assert.match(css, /\.fp-route-dashboard \.capability-illustration \{ inset-inline-end: 0; width: 62% !important;/);
  assert.match(css, /\.fp-route-index \.journey-illustration \{ inset-inline-end: 0; width: 66%;/);
  assert.doesNotMatch(css, /inset-inline-end:\s*-(?:16|18)%/);
});

test("Dashboard content stays a full-width single track instead of inheriting legacy card spans", () => {
  const css = read("public", "css", "illustrated-v4.css");
  assert.match(css, /\.fp-route-dashboard #dashboardContent \{ grid-template-columns: minmax\(0,1fr\) !important; \}/);
  assert.match(css, /\.fp-route-dashboard #dashboardContent > \* \{ grid-column: 1 \/ -1 !important; min-width: 0; width: 100%; \}/);
});

test("runtime diagnostics mark rendered V4.1 sources rather than hiding a fallback", () => {
  assert.match(ILLUSTRATIONS, /host\.dataset\.v4Source\s*=\s*name === "deadlift" \? "v4\.1-hero" : sourceOf\(name\)/);
  assert.match(ILLUSTRATIONS, /"v4\.1-scene"/);
  assert.match(ILLUSTRATIONS, /"v4-fallback"/);
});

test("the V4.3 prototype service worker cache is synchronized and retains private/auth bypasses", () => {
  assert.match(SW, /CACHE_NAME = 'fuelphysique-v30-real-athlete-v43-polish-1'/);
  assert.doesNotMatch(SW, /20260812-athletic-spectrum|fuelphysique-v13-illustrated-v4/);
  for (const asset of [
    "css/illustrated-v4.css",
    "js/athlete-figure.js",
    "js/scenes/training.js",
    "js/scenes/nutrition.js",
    "js/scenes/progress.js",
    "js/scenes/coachsocial.js",
    "js/image-sequence-v43.js",
    "js/illustrated-v4.js",
  ]) assert.match(SW, new RegExp(`${asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?v=${asset.startsWith("css/") ? CSS_VERSION : asset === "js/image-sequence-v43.js" ? ENGINE_VERSION : ASSET_VERSION}`));
  assert.match(SW, /AUTH_PROXY_PREFIX = '\/__\/auth\/'/);
  assert.match(SW, /https:\/\/apis\.google\.com/);
  assert.match(SW, /https:\/\/accounts\.google\.com/);
  assert.match(SW, /NETWORK_ONLY_PREFIXES = \['\/api\/'\]/);
  assert.match(SW, /event\.request\.destination === 'audio'/);
});
