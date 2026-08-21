"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const domainPromise = import(pathToFileURL(path.join(__dirname, "..", "public", "js", "daily-nutrition-domain.mjs")));

test("parses and scales a single gram-based food", async () => {
  const { parseFoodText } = await domainPromise;
  const result = parseFoodText("50g oats");
  assert.equal(result.status, "ready");
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].foodId, "oats");
  assert.equal(result.entries[0].amount, 50);
  assert.equal(result.entries[0].calories, 194.5);
});

test("parses multiple foods in one English sentence", async () => {
  const { parseFoodText } = await domainPromise;
  const result = parseFoodText("250g cottage cheese 3% and 4 rice cakes");
  assert.equal(result.status, "ready");
  assert.deepEqual(result.entries.map((entry) => entry.foodId), ["cottage-3", "rice-cake"]);
  assert.equal(result.entries[1].amount, 4);
});

test("parses multiple foods in Hebrew", async () => {
  const { parseFoodText } = await domainPromise;
  const result = parseFoodText("250 גרם קוטג׳ 5% ו-4 פריכיות");
  assert.equal(result.status, "ready");
  assert.deepEqual(result.entries.map((entry) => entry.foodId), ["cottage-5", "rice-cake"]);
});

test("ambiguous cottage input requests a compact choice instead of inventing fat percentage", async () => {
  const { parseFoodText } = await domainPromise;
  const result = parseFoodText("250g cottage cheese");
  assert.equal(result.status, "needs-clarification");
  assert.equal(result.entries.length, 0);
  assert.deepEqual(result.ambiguities[0].choices.map((choice) => choice.foodId).sort(), ["cottage-3", "cottage-5"]);
});

test("resolves a clarification using the original amount", async () => {
  const { resolveFoodChoice } = await domainPromise;
  const entry = resolveFoodChoice("cottage-3", { amount: 250, unit: "g" });
  assert.equal(entry.calories, 210);
  assert.equal(entry.proteinGrams, 28.8);
});

test("portion scaling is centralized for counted and weighted foods", async () => {
  const { FOOD_CATALOG, scaleFood } = await domainPromise;
  const riceCake = FOOD_CATALOG.find((food) => food.id === "rice-cake");
  const chicken = FOOD_CATALOG.find((food) => food.id === "ready-chicken");
  assert.equal(scaleFood(riceCake, 4).calories, 140);
  assert.equal(scaleFood(chicken, 150, "g").proteinGrams, 46.5);
  assert.throws(() => scaleFood(riceCake, 100, "g"), /INCOMPATIBLE_UNIT/);
});

test("daily totals and remaining targets update across every macro", async () => {
  const { parseFoodText, remainingAgainstTargets, totalsForEntries } = await domainPromise;
  const entries = parseFoodText("50g oats, 1 protein drink, banana").entries;
  const totals = totalsForEntries(entries);
  const remaining = remainingAgainstTargets(totals, { dailyCalories: 500, proteinGrams: 50, carbsGrams: 80, fatGrams: 20 });
  assert.equal(totals.calories, 459.5);
  assert.equal(remaining.calories, 40.5);
  assert.equal(remaining.proteinGrams, 15.2);
});

test("remaining values become negative after the target is exceeded", async () => {
  const { remainingAgainstTargets } = await domainPromise;
  const remaining = remainingAgainstTargets({ calories: 2600, proteinGrams: 190 }, { dailyCalories: 2300, proteinGrams: 175 });
  assert.equal(remaining.calories, -300);
  assert.equal(remaining.proteinGrams, -15);
});

test("macro percentages use 4/4/9 energy and label-calorie differences remain possible", async () => {
  const { macroEnergyPercentages } = await domainPromise;
  const result = macroEnergyPercentages({ calories: 500, proteinGrams: 30, carbsGrams: 50, fatGrams: 10 });
  assert.equal(result.macroCalories, 410);
  assert.equal(Math.round(result.protein + result.carbs + result.fat), 100);
});

test("estimated balance uses a documented 100 kcal neutral band", async () => {
  const { classifyEstimatedBalance } = await domainPromise;
  assert.equal(classifyEstimatedBalance(2200, 2500).status, "deficit");
  assert.equal(classifyEstimatedBalance(2450, 2500).status, "maintenance");
  assert.equal(classifyEstimatedBalance(2700, 2500).status, "surplus");
  assert.equal(classifyEstimatedBalance(2000, null).status, "unknown");
});

test("local date keys do not roll over through UTC conversion", async () => {
  const { localDateKey, shiftDateKey } = await domainPromise;
  const localLateNight = new Date(2026, 7, 21, 23, 58, 0);
  assert.equal(localDateKey(localLateNight), "2026-08-21");
  assert.equal(shiftDateKey("2026-08-21", 1), "2026-08-22");
  assert.equal(shiftDateKey("2026-03-01", -1), "2026-02-28");
});

test("weekly averages exclude unlogged days instead of counting them as zero", async () => {
  const { weeklySummary } = await domainPromise;
  const summary = weeklySummary([
    { entries: [{ calories: 2000 }], totals: { calories: 2000, proteinGrams: 150, carbsGrams: 200, fatGrams: 60 }, maintenanceSnapshot: 2500, completed: true },
    { entries: [], totals: { calories: 0 }, maintenanceSnapshot: 2500, completed: false },
    { entries: [{ calories: 2400 }], totals: { calories: 2400, proteinGrams: 170, carbsGrams: 240, fatGrams: 70 }, maintenanceSnapshot: 2500, completed: true }
  ]);
  assert.equal(summary.loggedDays, 2);
  assert.equal(summary.completedDays, 2);
  assert.equal(summary.averageCalories, 2200);
  assert.equal(summary.averageBalance, -300);
  assert.equal(summary.balanceStatus, "deficit");
});

test("recent foods are unique and preserve latest portions", async () => {
  const { recentFoodsFromLogs } = await domainPromise;
  const logs = [
    { entries: [{ foodId: "banana", amount: 1 }, { foodId: "oats", amount: 50 }] },
    { entries: [{ foodId: "banana", amount: 2 }, { foodId: "egg", amount: 3 }] }
  ];
  assert.deepEqual(recentFoodsFromLogs(logs).map((food) => food.foodId), ["oats", "banana", "egg"]);
});

test("custom foods reject negative macros and remain parser-compatible", async () => {
  const { parseFoodText, validateCustomFood } = await domainPromise;
  assert.throws(() => validateCustomFood({ name: "Bad", baseAmount: 100, baseUnit: "g", calories: -1, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }), /INVALID_CUSTOM_FOOD/);
  const custom = validateCustomFood({ id: "custom-my-bowl", name: "My bowl", nameHe: "הקערה שלי", baseAmount: 1, baseUnit: "item", calories: 430, proteinGrams: 32, carbsGrams: 44, fatGrams: 14, favorite: true });
  const result = parseFoodText("1 my bowl", { customFoods: [custom] });
  assert.equal(result.status, "ready");
  assert.equal(result.entries[0].calories, 430);
});

test("target snapshot prefers the active plan and never invents missing maintenance", async () => {
  const { targetSnapshot } = await domainPromise;
  const withPlan = targetSnapshot({ activePlan: { plan: { dailyCalories: 2300, proteinGrams: 175, carbsGrams: 250, fatGrams: 70 } } });
  assert.equal(withPlan.source, "active-plan");
  assert.equal(withPlan.complete, true);
  assert.equal(withPlan.maintenanceCalories, null);
  const fromCore = targetSnapshot({ calculatedTargets: { dailyCalories: 2400, proteinGrams: 160, tdee: 2700 } });
  assert.equal(fromCore.maintenanceCalories, 2700);
  assert.equal(targetSnapshot().complete, false);
});
