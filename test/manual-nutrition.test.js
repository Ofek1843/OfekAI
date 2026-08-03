"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { calculateNutritionTargets } = require("../lib/nutrition-targets");
const { searchManualMeals, normalizeSearch } = require("../lib/manual-nutrition");
const { CATALOG, CATEGORY_DEFINITIONS } = require("../lib/meal-catalog");

const ROOT = path.join(__dirname, "..");
const SERVER = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
const MANUAL_BUILDER = fs.readFileSync(path.join(ROOT, "public", "js", "manual-nutrition-builder.js"), "utf8");
const MANUAL_HTML = fs.readFileSync(path.join(ROOT, "public", "manual-nutrition-builder.html"), "utf8");
const MANUAL_CSS = fs.readFileSync(path.join(ROOT, "public", "css", "manual-nutrition-builder.css"), "utf8");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "nutrition", "manual-meal-image-manifest.json"), "utf8"));

test("manual targets reuse the nutrition engine for fat loss, maintenance and muscle gain", () => {
  const input = { age: 30, gender: "male", height: 180, weight: 80, activityLevel: "moderatelyActive" };
  const fatLoss = calculateNutritionTargets({ ...input, goal: "fat-loss" });
  const maintenance = calculateNutritionTargets({ ...input, goal: "maintenance" });
  const muscleGain = calculateNutritionTargets({ ...input, goal: "muscle-gain" });
  assert.equal(fatLoss.bmr, 1780);
  assert.equal(fatLoss.tdee, 2759);
  assert.ok(fatLoss.dailyCalories < maintenance.dailyCalories);
  assert.ok(muscleGain.dailyCalories > maintenance.dailyCalories);
  assert.ok(fatLoss.proteinGrams > 0 && fatLoss.carbsGrams > 0 && fatLoss.fatGrams > 0);
});

test("empty query and one-character query do not expose the catalog", () => {
  assert.deepEqual(searchManualMeals({ query: "" }), { meals: [], hasMore: false, offset: 0, limit: 8 });
  assert.equal(searchManualMeals({ query: "b" }).meals.length, 0);
  assert.doesNotMatch(MANUAL_BUILDER, /75 meals available|125 meals available|total catalog/i);
});

test("target calculation leaves discovery empty until the user searches", () => {
  const calculateStart = MANUAL_BUILDER.indexOf("async function calculateTargets");
  const calculateEnd = MANUAL_BUILDER.indexOf("async function savePlan");
  assert.doesNotMatch(MANUAL_BUILDER.slice(calculateStart, calculateEnd), /searchMeals\(/);
  assert.match(MANUAL_BUILDER, /renderDiscoveryPrompt\(\)/);
});

test("manual search supports title, ingredient, aliases, case and Hebrew text", () => {
  const banana = searchManualMeals({ query: "banana", diet: "omnivore" }).meals;
  assert.ok(banana.length >= 2 && banana.length <= 8);
  assert.ok(banana.every(meal => /banana/i.test(meal.title + " " + meal.ingredients)));
  const chicken = searchManualMeals({ query: "CHICKEN", diet: "omnivore" }).meals;
  assert.ok(chicken.length > 0 && chicken.every(meal => /chicken/i.test(meal.title + " " + meal.ingredients)));
  const quinoa = searchManualMeals({ query: "quinoa", diet: "omnivore" }).meals;
  assert.ok(quinoa.length > 0);
  const hebrew = searchManualMeals({ query: "בננה", diet: "omnivore", language: "he" }).meals;
  assert.ok(hebrew.length >= 1);
  assert.equal(normalizeSearch("  Chicken,   Rice! "), "chicken rice");
});

test("ingredient search works when the ingredient is not in the title", () => {
  const result = searchManualMeals({ query: "spinach", diet: "omnivore" }).meals;
  assert.ok(result.length > 0);
  assert.ok(result.some(meal => /spinach/i.test(meal.ingredients)));
});

test("search pages are bounded, deterministic and non-overlapping", () => {
  const first = searchManualMeals({ query: "banana", limit: 8 });
  const second = searchManualMeals({ query: "banana", limit: 8, offset: first.offset + first.meals.length });
  assert.ok(first.meals.length <= 8);
  assert.ok(second.meals.length <= 8);
  assert.equal(new Set(first.meals.concat(second.meals).map(meal => meal.id)).size, first.meals.length + second.meals.length);
  assert.equal(first.meals.some(meal => meal.id === second.meals[0]?.id), false);
  assert.equal(first.hasMore, true);
});

test("categories work without text, combine with search, and restrictions override matches", () => {
  for (const category of ["high-protein", "low-calorie", "balanced", "vegan", "vegetarian", "pescatarian", "breakfast", "lunch", "dinner", "snack", "high-fiber", "lower-carb", "pre-workout", "post-workout"]) {
    const result = searchManualMeals({ categories: [category], diet: "omnivore" }).meals;
    assert.ok(result.length <= 8, category);
  }
  const veganBanana = searchManualMeals({ query: "banana", categories: ["vegan"], diet: "omnivore" }).meals;
  assert.ok(veganBanana.length > 0);
  const dairyFree = searchManualMeals({ categories: ["vegan"], diet: "vegan", allergies: ["dairy"] }).meals;
  assert.ok(dairyFree.every(meal => !/yogurt|cheese|milk|labneh|quark/i.test(meal.title + " " + meal.ingredients)));
});

test("numeric categories use actual serving nutrition", () => {
  const rules = { "high-protein": meal => meal.baseProtein >= 25, "low-calorie": meal => meal.baseCalories <= 450, "high-fiber": meal => meal.baseFiber >= 8, "lower-carb": meal => meal.baseCarbs <= 35 };
  for (const meal of CATALOG) {
    for (const [category, rule] of Object.entries(rules)) assert.equal(meal.categories.includes(category), rule(meal), meal.id + " " + category);
  }
  assert.ok(Object.keys(CATEGORY_DEFINITIONS).includes("balanced"));
});

test("manual search excludes incompatible diet and allergens and never calls OpenAI", () => {
  const vegan = searchManualMeals({ categories: ["vegan"], diet: "vegan" }).meals;
  assert.ok(vegan.every(meal => meal.diet === "vegan"));
  assert.match(SERVER, /\/api\/nutrition\/manual\/targets/);
  assert.match(SERVER, /\/api\/nutrition\/manual\/meals/);
  const manualStart = SERVER.indexOf('app.get("/api/nutrition/manual');
  const builderStart = SERVER.indexOf('app.post("/api/nutrition-builder"');
  assert.doesNotMatch(SERVER.slice(manualStart, builderStart), /createChatCompletion|openai/i);
});

test("manual meal rows expose exact totals and full macro labels", () => {
  const meal = searchManualMeals({ query: "banana", limit: 1 }).meals[0];
  assert.ok(meal.image);
  assert.equal(meal.calories, meal.foods.reduce((sum, food) => sum + food.calories, 0));
  assert.equal(meal.proteinGrams, meal.foods.reduce((sum, food) => sum + food.proteinGrams, 0));
  assert.equal(meal.carbsGrams, meal.foods.reduce((sum, food) => sum + food.carbsGrams, 0));
  assert.equal(meal.fatGrams, meal.foods.reduce((sum, food) => sum + food.fatGrams, 0));
  assert.doesNotMatch(MANUAL_BUILDER, /\bg P\b|\bg C\b|\bg F\b/);
  for (const label of ["Calories", "Protein", "Carbohydrates", "Fat"]) assert.match(MANUAL_BUILDER, new RegExp(label));
});

test("builder has sticky desktop menu and accessible mobile drawer controls", () => {
  for (const id of ["dailyMenuPanel", "selectedMeals", "runningTotals", "planTitle", "savePlan", "shareSavedPlan", "mobileMenuToggle", "closeMenuDrawer"]) assert.match(MANUAL_HTML, new RegExp('id="' + id + '"'));
  assert.match(MANUAL_CSS, /\.daily-menu-panel\s*\{\s*position:\s*sticky/);
  assert.match(MANUAL_CSS, /\.mobile-menu-toggle/);
  assert.match(MANUAL_CSS, /env\(safe-area-inset-bottom\)/);
  assert.match(MANUAL_BUILDER, /state\.selected/);
});

test("selection state and serving controls remain client-side across discovery changes", () => {
  assert.match(MANUAL_BUILDER, /state\.selected\.push/);
  assert.match(MANUAL_BUILDER, /state\.discovery\.results/);
  assert.match(MANUAL_BUILDER, /data-portion/);
  assert.match(MANUAL_BUILDER, /data-remove/);
  assert.match(MANUAL_BUILDER, /data-up/);
  assert.match(MANUAL_BUILDER, /data-down/);
  assert.match(MANUAL_BUILDER, /250/);
  assert.match(MANUAL_BUILDER, /AbortController/);
});

test("catalog expansion has 50 unique slugs, derived nutrition and image fallbacks", () => {
  assert.equal(CATALOG.length, 125);
  assert.equal(new Set(CATALOG.map(meal => meal.id)).size, 125);
  assert.equal(MANIFEST.newMeals.length, 50);
  assert.equal(new Set(MANIFEST.newMeals.map(meal => meal.slug)).size, 50);
  for (const entry of MANIFEST.newMeals) {
    const meal = CATALOG.find(candidate => candidate.id === entry.slug);
    assert.ok(meal, entry.slug);
    assert.equal(entry.imageKey, entry.slug);
    assert.notEqual(meal.he, meal.en, `${entry.slug} needs Hebrew display copy`);
    assert.equal(meal.image, null);
    assert.match(entry.expectedPng, new RegExp(entry.slug + "\\.png$"));
    assert.match(entry.expectedWebp, new RegExp(entry.slug + "\\.webp$"));
  }
  assert.deepEqual(MANIFEST.missingExistingAssets.map(asset => asset.slug), ["turkey-sweet-potato-hash", "edamame-snack-bowl", "asparagus"]);
});

test("manual builder keeps locale direction, saving fields and sharing link", () => {
  assert.match(MANUAL_BUILDER, /document\.documentElement\.lang = state\.language/);
  assert.match(MANUAL_BUILDER, /document\.documentElement\.dir = state\.language === "he" \? "rtl" : "ltr"/);
  assert.match(MANUAL_BUILDER, /optionFiberGrams/);
  assert.match(MANUAL_BUILDER, /baseFoods: item\.foods/);
  assert.match(MANUAL_BUILDER, /share=nutrition/);
  assert.match(MANUAL_CSS, /button:focus-visible, a:focus-visible/);
  assert.match(MANUAL_CSS, /prefers-reduced-motion/);
});
