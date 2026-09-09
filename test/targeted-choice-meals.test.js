const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const meals = require("../lib/everyday-meals");
const { FOODS, getMealById, filterMeals } = require("../lib/meal-catalog");
const { searchManualMeals } = require("../lib/manual-nutrition");

test("nutrition route returns cleanly after an authentication rejection", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  const route = source.slice(source.indexOf('app.post("/api/nutrition-builder",'), source.indexOf('app.use((error, req, res, next)'));
  let handler;
  vm.runInNewContext(route, { app: { post: (url, fn) => { handler = fn; } }, requireFirebaseUser: async () => null });
  await assert.doesNotReject(() => handler({}, {}));
});

test("everyday meals derive nutrition from existing ingredients and have local images", () => {
  for (const meal of meals) {
    const actual = getMealById(meal.id);
    const calories = meal.items.reduce((sum, [id, grams]) => sum + FOODS[id].kcal * grams / 100, 0);
    assert.equal(actual.baseCalories, Math.round(calories));
    assert.ok(actual.foodStyles.includes("supermarket"));
    assert.ok(fs.existsSync(path.join(__dirname, "../public", actual.image)));
    assert.match(actual.he, /[א-ת]/);
  }
});

test("everyday options remain discoverable and obey allergies and preparation limits", () => {
  const found = searchManualMeals({ query: "פיתה", language: "he", categories: ["supermarket"], limit: 100 });
  assert.ok(found.meals.some(meal => meal.id === "everyday-tuna-pita"));
  const pool = filterMeals({ foodStylePreference: "supermarket", diet: "vegan", excludeAllergens: ["dairy", "gluten", "fish"], prepTimePreference: "five" });
  assert.ok(pool.every(meal => !meal.allergens.some(a => ["dairy", "gluten", "fish"].includes(a)) && meal.prepMinutes <= 5));
  assert.ok(!pool.some(meal => meal.id === "everyday-beef-red-pasta"));
});

test("gender choices render without a reveal observer and fall back after image failure", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/js/product-motion-v47.js"), "utf8");
  const fn = source.slice(source.indexOf("  function addGenderChoices()"), source.indexOf("  function start()"));
  const events = {};
  const img = { dataset: {}, addEventListener: (name, callback) => { events[name] = callback; } };
  const grid = { setAttribute() {}, querySelectorAll: selector => selector === "img" ? [img] : [] };
  let inserted;
  const select = { value: "female", classList: { add() {} }, closest: () => null, after: node => { inserted = node; }, addEventListener() {} };
  vm.runInNewContext(`${fn}; addGenderChoices();`, { document: { documentElement: { lang: "he" }, querySelector: selector => selector === "#gender" ? select : null, createElement: () => grid } });
  assert.equal(inserted, grid);
  assert.doesNotMatch(grid.className, /reveal/);
  assert.match(grid.innerHTML, /value="female" checked/);
  assert.match(grid.innerHTML, /<img/);
  assert.match(grid.innerHTML, /נקבה/);
  events.error();
  assert.equal(img.src, "/images/common/athlete-profile.svg");
  events.error();
  assert.equal(img.hidden, true);
});
