"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

test("V4.5 Deep Ocean loads on landing, dashboard, and protected routes", () => {
  const landing = read("public", "index.html");
  const dashboard = read("public", "dashboard.html");
  const shell = read("public", "js", "redesign-shell.js");

  assert.match(landing, /\/css\/v45-deep-ocean\.css\?v=20260914-i18n-dashboard-1/);
  assert.match(dashboard, /\/css\/v45-deep-ocean\.css\?v=20260914-i18n-dashboard-1/);
  assert.match(dashboard, /\/js\/redesign-shell\.js\?v=20260914-i18n-dashboard-1/);
  assert.match(shell, /querySelector\('link\[href\*="v45-deep-ocean\.css"\]'\)/);
  assert.match(shell, /classList\.add\("fp-redesign", "fp-v45-deep-ocean"/);
});

test("Deep Ocean restores the atmospheric canvas without replacing scene architecture", () => {
  const css = read("public", "css", "v45-deep-ocean.css");
  const landing = read("public", "index.html");

  assert.match(css, /--v45-ocean-abyss:\s*#030b17/);
  assert.match(css, /body\.fp-v45-deep-ocean \.ocean-depth-layer/);
  assert.match(css, /body\.fp-v45-deep-ocean \.ocean-depth-glow/);
  assert.match(css, /\.fp-v45-deep-ocean\.fp-route-index \.journey-card--training/);
  assert.match(css, /\.fp-v45-deep-ocean\.fp-route-dashboard \.capability-card--nutrition/);
  assert.match(css, /html\[data-theme="light"\] body\.fp-v45-deep-ocean/);
  assert.match(landing, /class="v45-accent-phrase"/);
  assert.doesNotMatch(css, /animation:[^;]*\binfinite\b/i);
});

test("Deep Ocean preserves the real-athlete and reduced-motion contracts", () => {
  const css = read("public", "css", "v45-deep-ocean.css");
  const engine = read("public", "js", "image-sequence-v43.js");
  const dashboard = read("public", "dashboard.html");

  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation:\s*none !important/);
  assert.match(engine, /IntersectionObserver/);
  assert.match(engine, /prefers-reduced-motion/);
  assert.match(engine, /get\("athleteMotion"\) !== "v42"/);
  assert.match(dashboard, /image-sequence-v43\.js/);
});

test("Deep Ocean remains responsive and keeps protected surfaces readable", () => {
  const css = read("public", "css", "v45-deep-ocean.css");

  assert.match(css, /@media \(max-width: 920px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /html\[data-theme="light"\] body\.fp-v45-deep-ocean\.fp-route-dashboard/);
  assert.match(css, /body\.fp-v45-deep-ocean \.fp-global-brand\s*\{[\s\S]*?display:\s*flex/);
  assert.match(css, /body\.fp-v45-deep-ocean \.fp-global-menu-button\s*\{[\s\S]*?flex:\s*0 0 44px/);
  assert.match(css, /body\.fp-v45-deep-ocean \.fp-global-links\s*\{\s*display:\s*none/);
  assert.match(css, /body\.fp-v45-deep-ocean \.fp-global-link\s*\{[^}]*flex:\s*1 1 0/);
  assert.match(css, /\.builder-card/);
  assert.match(css, /\.nutrition-plan-card/);
  assert.match(css, /\.settings-card/);
});

test("Daylight dashboard keeps text dark and uses category-colored actions", () => {
  const css = read("public", "css", "v45-deep-ocean.css");

  assert.match(css, /Daylight dashboard: every reading surface uses dark ink/);
  assert.match(css, /\.dashboard-compact-header \.hero-copy h1,[\s\S]*?color:\s*#10243a !important/);
  assert.match(css, /\.capability-action--primary\s*\{[\s\S]*?background:\s*var\(--capability-accent\) !important/);
  assert.match(css, /\.capability-action:not\(\.capability-action--primary\)\s*\{[\s\S]*?color:\s*#183a55 !important/);
});

test("The product shell does not overwrite the theme toggle label", () => {
  const shell = read("public", "js", "redesign-shell.js");

  assert.match(shell, /Theme controls own their label and state in theme-toggle\.js/);
  assert.doesNotMatch(shell, /#voiceInputBtn\[aria-label\], \[data-theme-toggle\]\[aria-label\]/);
});

test("Dashboard and global shell support every settings language", () => {
  const dashboard = read("public", "js", "dashboard.js");
  const shell = read("public", "js", "redesign-shell.js");
  const i18n = read("public", "js", "i18n.js");

  for (const code of ["en", "he", "es", "fr", "de", "ar", "zh"]) {
    assert.match(dashboard, new RegExp(`${code}: \\{[\\s\\S]*?(dashboard|today|capabilityStudioTitle)`));
    assert.match(shell, new RegExp(`${code}: \\{[\\s\\S]*?navigation`));
  }

  assert.match(dashboard, /const rtl = language === "he" \|\| language === "ar"/);
  assert.match(shell, /const isRtlLanguage = \(value\) => value === "he" \|\| value === "ar"/);
  assert.match(i18n, /Object\.assign\(translations\.fr/);
  assert.match(i18n, /landingSystemTitle: "Un système pour tout le processus"/);
  assert.doesNotMatch(shell, /const safeLanguage = language === "he" \? "he" : "en"/);
});
