const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const js = read("public/js/product-motion-v47.js");
const css = read("public/css/product-motion-v47.css");
const shell = read("public/js/redesign-shell.js");
const sw = read("public/sw.js");

test("V4.7 motion system is reusable, viewport-aware and reduced-motion safe", () => {
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /prefers-reduced-motion/);
  assert.match(js, /MutationObserver/);
  assert.match(css, /transform: translate3d\(0, 14px, 0\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(js, /setInterval/);
});
test("choice motion preserves form values and adds accessible selected state", () => {
  assert.match(js, /data-sync-select/);
  assert.match(js, /aria-checked/);
  assert.match(js, /input\?\.click/);
  assert.match(js, /select\.value = input\.value/);
});
test("nutrition rows animate only after real DOM entries and use existing thumbnails", () => {
  assert.match(js, /#foodEntries/);
  assert.match(js, /food-thumbnail/);
  assert.match(css, /\.fp-v47-dynamic-row/);
});
test("motion assets load through the shared shell and stale cache identity is replaced", () => {
  assert.match(shell, /product-motion-v47\.css/);
  assert.match(shell, /product-motion-v47\.js/);
  assert.match(sw, /fuelphysique-v43-v47-motion-experience/);
});
test("gender visual cards preserve the existing male/female calculation values", () => {
  assert.match(js, /\[\"male\"/);
  assert.match(js, /\[\"female\"/);
  assert.match(js, /select\.dispatchEvent/);
});
test("important nutrition selects get visual choices without changing form values", () => {
  assert.match(js, /#activityLevel/);
  assert.match(js, /#dietaryPreference/);
  assert.match(js, /#prepTimePreference/);
  assert.match(js, /#foodStylePreference/);
  assert.match(js, /dataset\.fpV47Choices/);
  assert.match(js, /select\.value = card\.dataset\.value/);
});
