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
const ASSET_VERSION = "20260814-premium-v41";

function illustrationScripts(html) {
  return [...html.matchAll(/<script defer src="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((source) => /athlete-figure|\/scenes\/|illustrated-v4/.test(source));
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
    `/js/illustrated-v4.js?v=${ASSET_VERSION}`,
  ];
  assert.deepEqual(illustrationScripts(LANDING), expected);
  assert.deepEqual(illustrationScripts(DASHBOARD), expected);
});

test("V4.1 scene CSS is merged into the single illustrated stylesheet without duplicate links", () => {
  const merged = read("public", "css", "illustrated-v4.css");
  for (const file of ["training.css", "nutrition.css", "progress.css", "coachsocial.css"]) {
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

test("the V4.1 service worker cache is synchronized and retains private/auth bypasses", () => {
  assert.match(SW, /CACHE_NAME = 'fuelphysique-v14-premium-v41'/);
  assert.doesNotMatch(SW, /20260812-athletic-spectrum|fuelphysique-v13-illustrated-v4/);
  for (const asset of [
    "css/illustrated-v4.css",
    "js/athlete-figure.js",
    "js/scenes/training.js",
    "js/scenes/nutrition.js",
    "js/scenes/progress.js",
    "js/scenes/coachsocial.js",
    "js/illustrated-v4.js",
  ]) assert.match(SW, new RegExp(`${asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?v=${ASSET_VERSION}`));
  assert.match(SW, /AUTH_PROXY_PREFIX = '\/__\/auth\/'/);
  assert.match(SW, /https:\/\/apis\.google\.com/);
  assert.match(SW, /https:\/\/accounts\.google\.com/);
  assert.match(SW, /NETWORK_ONLY_PREFIXES = \['\/api\/'\]/);
  assert.match(SW, /event\.request\.destination === 'audio'/);
});
