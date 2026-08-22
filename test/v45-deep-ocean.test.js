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

  assert.match(landing, /\/css\/v45-deep-ocean\.css\?v=20260822-v45-rtl-hebrew-animation-fix-1/);
  assert.match(dashboard, /\/css\/v45-deep-ocean\.css\?v=20260822-v45-rtl-hebrew-animation-fix-1/);
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
  assert.match(css, /body\.fp-v45-deep-ocean \.fp-global-brand\s*\{\s*display:\s*none/);
  assert.match(css, /body\.fp-v45-deep-ocean \.fp-global-links\s*\{[^}]*min-width:\s*0/);
  assert.match(css, /body\.fp-v45-deep-ocean \.fp-global-link\s*\{[^}]*flex:\s*1 1 0/);
  assert.match(css, /\.builder-card/);
  assert.match(css, /\.nutrition-plan-card/);
  assert.match(css, /\.settings-card/);
});
