const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");
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
  // Native inputs own keyboard interaction; labels must not become duplicate
  // radio controls or synthesize a second click on top of the browser action.
  const { document, window } = parseHTML('<html><body><div class="visual-choice-grid"><label class="visual-choice-card" role="radio" tabindex="0"><input type="radio" name="goal" value="build">Build muscle</label><label class="visual-choice-card"><input type="radio" name="goal" value="maintain">Maintain muscle</label></div></body></html>');
  const inputs = [...document.querySelectorAll("input")];
  inputs[0].checked = true;
  inputs[1].checked = false;
  vm.runInNewContext(js, {
    document, window: { matchMedia: () => ({ matches: true }) },
    requestAnimationFrame: callback => callback(), Event: window.Event
  });
  const cards = [...document.querySelectorAll(".visual-choice-card")];
  assert.equal(cards[0].hasAttribute("role"), false);
  assert.equal(cards[0].hasAttribute("tabindex"), false);
  assert.equal(cards[0].getAttribute("data-checked"), "true");
  assert.equal(cards[1].getAttribute("data-checked"), "false");
  inputs[0].checked = false;
  inputs[1].checked = true;
  inputs[1].dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(cards[0].getAttribute("data-checked"), "false");
  assert.equal(cards[1].getAttribute("data-checked"), "true");
  assert.deepEqual(inputs.map(input => [input.type, input.name, input.value]), [["radio", "goal", "build"], ["radio", "goal", "maintain"]]);
  assert.match(js, /select\.value = input\.value/);
});
test("nutrition rows animate only after real DOM entries and use existing thumbnails", () => {
  assert.match(js, /#foodEntries/);
  assert.match(js, /food-thumbnail/);
  assert.match(css, /\.fp-v47-dynamic-row/);
});
test("high-value V4.7 primitives animate real values and remain reduced-motion safe", () => {
  assert.match(js, /fpV47AnimateNumber/);
  assert.match(js, /fpV47AnimateMacroRing/);
  assert.match(js, /requestAnimationFrame/);
  assert.match(css, /fp-v47-chart-reveal/);
  assert.match(css, /fp-v47-number-update/);
  const landing = read("public/js/landing.js");
  assert.doesNotMatch(landing, /\/api\/public-stats|loadPublicStats|animateNumber/);
  assert.match(landing, /wireProductLoopDemo/);
  assert.match(landing, /prefers-reduced-motion/);
});
test("success feedback is wired to real product actions without replacing their behavior", () => {
  for (const file of [
    "public/js/daily-nutrition.js",
    "public/js/nutrition-builder.js",
    "public/js/workout-builder.js",
    "public/js/workout-tracker.js",
    "public/js/settings.js"
  ]) assert.match(read(file), /fpV47Success/);
  assert.match(css, /fp-v47-success/);
});
test("progress chart uses a one-time reveal class and does not invent data", () => {
  const progress = read("public/js/progress.js");
  assert.match(progress, /fp-v47-chart-reveal/);
  assert.doesNotMatch(progress, /setInterval/);
});
test("motion assets load through the shared shell and stale cache identity is replaced", () => {
  assert.match(shell, /product-motion-v47\.css/);
  assert.match(shell, /product-motion-v47\.js/);
  require("./helpers/current-product.cjs").assertCurrentCache(sw);
});
test("gender visual cards preserve the existing male/female calculation values", () => {
  assert.match(js, /\[\"male\"/);
  assert.match(js, /\[\"female\"/);
  assert.match(js, /select\.dispatchEvent/);
});
test("remaining nutrition selects get visual choices without reintroducing removed detail questions", () => {
  assert.match(js, /#activityLevel/);
  assert.match(js, /#dietaryPreference/);
  assert.doesNotMatch(js, /#prepTimePreference/);
  assert.doesNotMatch(js, /#foodStylePreference/);
  assert.match(js, /dataset\.fpV47Choices/);
  assert.match(js, /select\.value = card\.dataset\.value/);
});
