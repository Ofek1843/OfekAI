"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", "public", file), "utf8");
const css = read("css/site-quality.css");

test("quality layer is loaded on the public landing and all shared-shell routes", () => {
  assert.match(read("index.html"), /site-quality\.css\?v=20261002-brand-quality-1/);
  assert.match(read("js/redesign-shell.js"), /qualityStyles\.href = "\/css\/site-quality\.css\?v=20261002-brand-quality-1"/);
  assert.match(read("sw.js"), /site-quality\.css\?v=20261002-brand-quality-1/);
});
test("quality CSS preserves hidden state, accessible labels and mobile recovery controls", () => {
  assert.match(css, /\[hidden\]:not\(\[hidden="until-found"\]\) \{ display: none !important/);
  assert.match(css, /\.sr-only\s*\{[^}]*clip-path: inset\(50%\)/);
  assert.match(css, /\.language-nav-trigger\s*\{[^}]*display: inline-flex !important/);
  assert.match(css, /\.site-feedback-widget\s*\{[^}]*position: static !important/);
  assert.match(css, /\.nutrition-summary\s*\{[^}]*grid-template-columns: repeat\(auto-fit/);
});
test("costly decorative layers are removed without removing real athlete playback", () => {
  assert.match(css, /\.ocean-depth-layer\s*\{[^}]*display: none !important/);
  assert.match(css, /backdrop-filter: none !important/);
  assert.doesNotMatch(css, /v43-image-sequence[^}]*display:\s*none/);
  assert.match(read("index.html"), /data-v43-scene="curl"/);
});
