"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateNutritionTargets } = require("../lib/nutrition-targets");
const { searchManualMeals } = require("../lib/manual-nutrition");
const SERVER = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "server.js"), "utf8");
const MANUAL_BUILDER = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "public", "js", "manual-nutrition-builder.js"), "utf8");
const MANUAL_CSS = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "public", "css", "manual-nutrition-builder.css"), "utf8");

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

test("manual meal search matches ingredients, tags and Hebrew text", () => {
  const banana = searchManualMeals({ query: "banana", diet: "omnivore" });
  assert.ok(banana.length >= 2);
  assert.ok(banana.every((meal) => /banana/i.test(`${meal.title} ${meal.ingredients}`)));
  const breakfast = searchManualMeals({ query: "breakfast", diet: "omnivore" });
  assert.ok(breakfast.every((meal) => meal.slots.includes("breakfast")));
  const hebrew = searchManualMeals({ query: "בננה", diet: "omnivore", language: "he" });
  assert.ok(hebrew.length >= 1);
});

test("manual search excludes incompatible dietary allergens and never calls OpenAI", () => {
  const dairyFree = searchManualMeals({ query: "", diet: "vegan", allergies: ["dairy"] });
  assert.ok(dairyFree.every((meal) => !/yogurt|cheese|, Milk \(1%\)|, חלב 1%|יוגורט|גבינה/i.test(`${meal.title} ${meal.ingredients}`)));
  assert.match(SERVER, /\/api\/nutrition\/manual\/targets/);
  assert.match(SERVER, /\/api\/nutrition\/manual\/meals/);
  const manualStart = SERVER.indexOf('app.get("/api/nutrition/manual');
  const builderStart = SERVER.indexOf('app.post("/api/nutrition-builder"');
  const manualRoutes = SERVER.slice(manualStart, builderStart);
  assert.doesNotMatch(manualRoutes, /createChatCompletion|openai/i);
});

test("manual meal rows contain the visible macros used by the future cumulative total", () => {
  const [meal] = searchManualMeals({ query: "banana", limit: 1 });
  assert.ok(meal.image);
  assert.ok(Array.isArray(meal.foods) && meal.foods.length);
  assert.equal(meal.calories, meal.foods.reduce((sum, food) => sum + food.calories, 0));
  assert.equal(meal.proteinGrams, meal.foods.reduce((sum, food) => sum + food.proteinGrams, 0));
});

test("manual builder applies Settings locale direction and keeps keyboard focus visible", () => {
  assert.match(MANUAL_BUILDER, /document\.documentElement\.lang = state\.language/);
  assert.match(MANUAL_BUILDER, /document\.documentElement\.dir = state\.language === "he" \? "rtl" : "ltr"/);
  assert.match(MANUAL_CSS, /button:focus-visible, a:focus-visible/);
  assert.match(MANUAL_CSS, /prefers-reduced-motion: reduce/);
});
