"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("landing coach message is inside the live hero panel and does not mirror in RTL", () => {
  const landing = read("public/index.html");
  const css = read("public/css/v45-deep-ocean.css");
  assert.match(landing, /<aside class="hero-panel"[^>]*>[\s\S]*?<blockquote class="coach-message" lang="en" dir="ltr">/);
  assert.match(landing, /It's a game of/);
  assert.match(landing, /<strong>consistency\.<\/strong>/);
  assert.match(landing, /<small>Not perfection\.<\/small>/);
  assert.match(css, /\.coach-message\s*\{[\s\S]*?pointer-events:\s*none;/);
  assert.doesNotMatch(css, /coach-message[^}]*scaleX\s*\(\s*-1/i);
});

test("the real-athlete sequence also runs on the Render production hostname", () => {
  const engine = read("public/js/image-sequence-v43.js");
  const landing = read("public/index.html");
  const sw = read("public/sw.js");
  assert.match(engine, /"ofekai\.onrender\.com"/);
  assert.match(landing, /image-sequence-v43\.js\?v=20260919-hero-message-render-2/);
  assert.match(sw, /image-sequence-v43\.js\?v=20260919-hero-message-render-2/);
});

test("the landing deadlift sequence loops instead of freezing after its first pass", () => {
  const engine = read("public/js/image-sequence-v43.js");
  assert.match(engine, /deadlift:\s*Object\.freeze\(\{\s*loop:\s*true,/);
  assert.match(engine, /if \(scene\.loop\) \{/);
  assert.match(engine, /scene\.loopDelay \|\| 900/);
});
