"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("site feedback is a real top-layer modal with a solid, safe-area-aware mobile surface", () => {
  const script = read("public/js/site-feedback.js");
  const qualityCss = read("public/css/site-quality.css");
  assert.match(script, /<dialog class="site-feedback-panel"/);
  assert.match(script, /panel\.showModal\(\)/);
  assert.match(script, /panel\.close\(\)/);
  assert.match(script, /\.site-feedback-panel::backdrop/);
  assert.match(script, /background:\s*#0a1626/);
  assert.match(script, /max-height:\s*calc\(100dvh/);
  assert.match(script, /env\(safe-area-inset-top\)/);
  assert.match(script, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(qualityCss, /site-feedback-widget\s*\{[^}]*position:\s*static/i);
  assert.doesNotMatch(qualityCss, /site-feedback-panel\s*\{[^}]*position:\s*fixed/i,
    "the generic stylesheet must not undo the dialog's top-layer positioning contract");
});

test("mobile PWA instruction prompt is compact, safe-area-aware, and isolated from page paint", () => {
  const source = read("public/js/pwa-install.js");
  assert.match(source, /const banner = document\.createElement\("dialog"\)/);
  assert.match(source, /if \(instructional\) banner\.showModal\(\)/);
  assert.match(source, /else banner\.show\(\)/);
  assert.match(source, /instructional::backdrop \{ background: rgba\(2, 8, 18, 0\.62\)/);
  assert.match(source, /max-height:\s*min\(260px, calc\(100svh/);
  assert.match(source, /inset-block-end:\s*calc\(8px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(source, /overflow-y:\s*auto/);
  assert.match(source, /aria-labelledby/);
  assert.match(source, /banner\.addEventListener\("cancel"/);
  assert.match(source, /width: min\(480px, calc\(100vw - 36px/);
});

test("landing page sections and their cards never depend on IntersectionObserver to become visible", () => {
  const css = read("public/css/landing.css");
  const revealRules = css.slice(css.indexOf(".reveal-on-scroll {"), css.indexOf(".is-visible .premium-card"));
  assert.match(revealRules, /\.reveal-on-scroll\s*\{[^}]*opacity:\s*1/);
  assert.match(revealRules, /\.reveal-on-scroll\s*\{[^}]*transform:\s*none/);
  assert.match(revealRules, /\.feature-card-grid \.premium-card,[\s\S]*?opacity:\s*1/);
  assert.match(revealRules, /\.feature-card-grid \.premium-card,[\s\S]*?transform:\s*none/);
  assert.doesNotMatch(revealRules, /opacity:\s*0/);
});

test("mobile landing and lower-page content remain part of the responsive page contract", () => {
  const html = read("public/index.html");
  const css = read("public/css/v45-deep-ocean.css");
  assert.match(html, /id="landingHeroTitle"/);
  assert.match(html, /id="results"/);
  assert.match(html, /landingSystemTitle/);
  assert.match(html, /class="landing-footer"/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.match(css, /fp-route-index \.hero-shell/);
});
