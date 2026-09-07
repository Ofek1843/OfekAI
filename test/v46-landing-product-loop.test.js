"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("landing contains a labeled product-in-action loop without fake account writes", () => {
  const html = read("public/index.html");
  const js = read("public/js/landing.js");
  const css = read("public/css/landing.css");
  assert.match(html, /product-loop-section/);
  assert.match(html, /landingLoopSampleLabel/);
  assert.match(js, /Sample preview — no account changes/);
  assert.match(js, /תצוגת דוגמה — ללא שינוי בחשבון/);
  assert.match(js, /wireProductLoopDemo/);
  assert.match(css, /\.product-loop-demo/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("deep-ocean shell clips decorative overflow without changing page content", () => {
  const css = read("public/css/v45-deep-ocean.css");
  assert.match(css, /html:has\(body\.fp-v45-deep-ocean\),\s*body\.fp-v45-deep-ocean\s*\{[^}]*overflow-x:\s*clip/s);
});
