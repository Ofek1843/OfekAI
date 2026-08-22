"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

test("the visible skip-link injection is removed without removing main landmarks", () => {
  const shell = read("public", "js", "redesign-shell.js");
  const css = read("public", "css", "redesign-v1.css");
  assert.doesNotMatch(shell, /skipLink|addSkipLink|fp-skip-link|Skip to main content|דילוג לתוכן הראשי/);
  assert.doesNotMatch(css, /fp-skip-link/);
  assert.match(read("public", "index.html"), /<main\b/);
  assert.match(read("public", "dashboard.html"), /<main\b/);
});

test("the product hamburger is isolated above dashboard content and retains the mobile drawer layer", () => {
  const css = read("public", "css", "redesign-v1.css");
  assert.match(css, /\.fp-global-nav\s*\{[\s\S]*?isolation:\s*isolate;[\s\S]*?z-index:\s*2100;/);
  assert.match(css, /\.fp-global-menu\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*2202;/);
  assert.match(css, /\.fp-global-menu-backdrop\s*\{[\s\S]*?z-index:\s*2201;/);
  assert.match(read("public", "js", "redesign-shell.js"), /fp-global-menu-button/);
  assert.match(read("public", "dashboard.html"), /id="mobileMenuButton"/);
});

test("dashboard greeting receives the restrained Deep Ocean treatment without changing localized copy", () => {
  const css = read("public", "css", "redesign-v1.css");
  const dashboard = read("public", "js", "dashboard.js");
  assert.match(css, /body\.fp-route-dashboard \.hero-copy h1[\s\S]*?color:\s*#dce6ff[\s\S]*?text-shadow:/);
  assert.match(dashboard, /dashboardGreeting/);
  assert.match(dashboard, /welcomeTitle/);
});

test("the polish cache generation is synchronized and preserves auth/private bypasses", () => {
  const sw = read("public", "sw.js");
  assert.match(sw, /fuelphysique-v39-v45-rtl-hebrew-animation-fix/);
  assert.match(sw, /image-sequence-v43\.js\?v=20260822-v45-rtl-hebrew-animation-fix-1/);
  assert.match(sw, /AUTH_PROXY_PREFIX = '\/__\/auth\/'/);
  assert.match(sw, /NETWORK_ONLY_PREFIXES = \['\/api\/'\]/);
  assert.match(sw, /AUTH_INFRASTRUCTURE_ORIGINS/);
});

test("the corrected Nutrition plate frame is transparent and remains traceable to the regenerated source", async () => {
  const manifest = JSON.parse(read("public", "assets", "athlete-motion", "v43", "manifest.json"));
  const frame = manifest.scenes.plate.frames[3];
  assert.equal(frame.source, "frame-04-regenerated.png");
  assert.equal(manifest.scenes.plate.regeneratedFrameSource, "plate/final-source/frame-04-regenerated.png");
  const metadata = await sharp(path.join(ROOT, "public", "assets", "athlete-motion", "v43", "plate", "normalized", frame.file)).metadata();
  assert.deepEqual({ width: metadata.width, height: metadata.height }, { width: 600, height: 720 });
  assert.equal(metadata.hasAlpha, true);
});

test("Hebrew shell and Daily Nutrition typography use live RTL direction without Latin tracking", () => {
  const shell = read("public", "js", "redesign-shell.js");
  const shellCss = read("public", "css", "redesign-v1.css");
  const dailyCss = read("public", "css", "daily-nutrition.css");
  assert.match(shell, /document\.documentElement\.dir = language === "he" \? "rtl" : "ltr"/);
  assert.match(shell, /ofekai:settings-saved/);
  assert.match(shellCss, /html\[dir="rtl"\] \.fp-redesign :where\([\s\S]*?letter-spacing: normal/);
  assert.match(shellCss, /html\[dir="rtl"\] \.fp-global-menu[\s\S]*?inset-inline-end: 0/);
  assert.match(dailyCss, /html\[dir="rtl"\] \.daily-hero h1[\s\S]*?letter-spacing|html\[dir="rtl"\] \.daily-nutrition-shell[\s\S]*?letter-spacing: normal/);
});

test("clean Session frames are transparent app assets rather than studio panels", async () => {
  const manifest = JSON.parse(read("public", "assets", "athlete-motion", "v43", "manifest.json"));
  assert.equal(manifest.scenes.session.assetDirectory, "normalized-clean");
  for (const frame of manifest.scenes.session.frames) {
    const imagePath = path.join(ROOT, "public", "assets", "athlete-motion", "v43", "session", "normalized-clean", frame.file);
    const metadata = await sharp(imagePath).metadata();
    assert.equal(metadata.hasAlpha, true, `${frame.file} must retain alpha`);
    assert.equal(frame.normalizedBytes, fs.statSync(imagePath).size, `${frame.file} manifest size`);
  }
});
