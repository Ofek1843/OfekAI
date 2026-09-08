const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { filterMeals, selectMeals, getMealById, buildMealOption } = require("../lib/meal-catalog");
const { searchManualMeals } = require("../lib/manual-nutrition");
const root = path.join(__dirname, "..");

test("canonical Hebrew logging and clarification choices resolve food thumbnails", async () => {
  const { parseFoodText, resolveFoodChoice } = await import("../public/js/daily-nutrition-domain.mjs");
  const { foodThumbnail } = await import("../public/js/daily-food-visuals.mjs");
  const oats = parseFoodText("50 גרם שיבולת שועל").entries[0];
  assert.equal(oats.foodId, "oats");
  assert.equal(foodThumbnail(oats), "/images/foods/oats.webp");
  const rice = parseFoodText("אורז");
  const riceId = rice.entries[0]?.foodId || rice.ambiguities[0]?.foodId;
  assert.equal(foodThumbnail({ foodId: riceId }), "/images/foods/white-rice.webp");
  assert.equal(foodThumbnail(resolveFoodChoice("protein-bar")), "/images/common/protein-bar.svg");
  assert.equal(foodThumbnail(resolveFoodChoice("oats-quaker-original")), "/images/foods/oats.webp");
});

test("unknown, composite and unsafe labels use a local fallback; custom familiar labels work", async () => {
  const { foodThumbnail, foodThumbnailMarkup, FOOD_THUMBNAIL_FALLBACK } = await import("../public/js/daily-food-visuals.mjs");
  for (const name of ["unknown food", "rice + chicken + sauce", '<script>alert(1)</script>']) {
    assert.equal(foodThumbnail({ name: { en: name } }), FOOD_THUMBNAIL_FALLBACK);
    assert.doesNotMatch(foodThumbnailMarkup({ name: { en: name } }), /<script>/);
  }
  assert.equal(foodThumbnail({ foodId: "custom-1", name: { he: "חטיף חלבון" } }), "/images/common/protein-bar.svg");
  assert.equal(foodThumbnail({ name: { he: "חמאת בוטנים" } }), "/images/foods/peanut-butter.webp");
});

test("every thumbnail exists locally and markup reserves space without duplicate accessible text", async () => {
  const { FOOD_THUMBNAILS, FOOD_THUMBNAIL_FALLBACK, foodThumbnailMarkup } = await import("../public/js/daily-food-visuals.mjs");
  for (const file of [...Object.values(FOOD_THUMBNAILS).map(p => `/images/${p}`), FOOD_THUMBNAIL_FALLBACK]) {
    assert.ok(fs.existsSync(path.join(root, "public", file)), file);
  }
  assert.match(foodThumbnailMarkup({ foodId: "oats" }), /alt="" width="56" height="56" loading="lazy"/);
});

test("supermarket generation selects only familiar meals while retaining the richer catalog", () => {
  for (const slot of ["breakfast", "lunch", "dinner", "snack"]) {
    const pool = filterMeals({ slot, foodStylePreference: "supermarket" });
    assert.ok(pool.length >= 3, slot);
    const selected = selectMeals({ pool, slot, targetCalories: 500, foodStylePreference: "supermarket" });
    assert.equal(selected.length, 3);
    assert.ok(selected.every(id => getMealById(id).foodStyles.includes("supermarket")));
    for (const id of selected) {
      const en = buildMealOption(id, { targetCalories: 500 });
      const he = buildMealOption(id, { targetCalories: 500, isHebrew: true });
      assert.equal(en.optionCalories, he.optionCalories);
    }
    assert.ok(filterMeals({ slot }).length > pool.length);
  }
  assert.ok(filterMeals({ foodStylePreference: "supermarket" }).some(m => m.id === "cottage-cheese-toast-tomato"));
  assert.ok(!filterMeals({ foodStylePreference: "supermarket" }).some(m => m.id === "tempeh-quinoa-kale-bowl"));
});

test("supermarket style preserves diet, allergens, prep time and disliked foods", () => {
  const pool = filterMeals({ foodStylePreference: "supermarket", diet: "vegetarian", excludeAllergens: ["fish"], prepTimePreference: "five", avoidTerms: ["cottage"] });
  assert.ok(pool.length);
  assert.ok(pool.every(m => ["vegetarian", "vegan"].includes(m.diet) && !m.allergens.includes("fish") && m.prepMinutes <= 5 && !m.id.includes("cottage")));
});

test("server keeps supermarket selection during reroll and balancing recovery", () => {
  const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
  const recovery = server.slice(server.indexOf("candidatesForSlot: (meal) =>"));
  assert.match(recovery, /filterMeals\(\{[^}]*foodStylePreference: practicalFoodStyle/);
  const reroll = server.slice(server.indexOf('app.post("/api/nutrition-builder/reroll-meal"'), server.indexOf('app.post("/api/nutrition-builder",'));
  assert.match(reroll, /filterMeals\(\{[^}]*foodStylePreference/);
  assert.match(reroll, /\["mediterranean", "mix", "supermarket"\]/);
});

test("manual Hebrew supermarket discovery uses the same category and survives pagination", () => {
  const first = searchManualMeals({ categories: ["supermarket"], language: "he" });
  const next = searchManualMeals({ categories: ["supermarket"], language: "he", offset: 8 });
  assert.equal(first.meals.length, 8);
  assert.ok(first.hasMore);
  assert.ok([...first.meals, ...next.meals].every(m => m.categories.includes("supermarket") && /[א-ת]/.test(m.title)));
  assert.ok(!next.meals.some(m => first.meals.some(n => m.id === n.id)));
});

test("thumbnail row preserves RTL flow and wrapping while supermarket option is bilingual", () => {
  const css = fs.readFileSync(path.join(root, "public/css/daily-nutrition.css"), "utf8");
  assert.match(css, /\.food-identity \{[^}]*display: flex/);
  assert.match(css, /\.food-identity \.food-name \{[^}]*min-width: 0; overflow-wrap: anywhere/);
  assert.doesNotMatch(css.match(/\.food-identity[^}]*\}/g).join(""), /direction: ltr|float: left/);
  const html = fs.readFileSync(path.join(root, "public/nutrition-builder.html"), "utf8");
  assert.match(html, /value="supermarket" data-en="[^"]+" data-he="[^"]+"/);
});
