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
  assert.equal(result.entries[0].calories, 187.5);
  assert.equal(result.entries[0].reference.state, "dry");
  assert.equal(result.entries[0].estimated, false);
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
  assert.deepEqual(
    result.ambiguities[0].choices.filter((choice) => !choice.isEstimateFallback).map((choice) => choice.foodId).sort(),
    ["cottage-3", "cottage-5"]
  );
  // Every clarification still offers an explicit "I don't know" path.
  assert.ok(result.ambiguities[0].choices.some((choice) => choice.isEstimateFallback));
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
  const entries = parseFoodText("50g oats, 1 protein drink, 118g banana").entries;
  const totals = totalsForEntries(entries);
  const remaining = remainingAgainstTargets(totals, { dailyCalories: 500, proteinGrams: 50, carbsGrams: 80, fatGrams: 20 });
  assert.equal(totals.calories, 452.5);
  assert.equal(remaining.calories, 47.5);
  assert.equal(remaining.proteinGrams, 17.1);
});

test("generic foods use canonical representative records with documented state", async () => {
  const { parseFoodText } = await domainPromise;
  const cases = [
    ["50g oats", "oats", "dry"],
    ["180g sweet potato", "sweet-potato", "cooked"],
    ["118g banana", "banana", "raw"],
    ["60g pita", "pita", "ready-to-eat"],
    ["2 rice cakes", "rice-cake", "ready-to-eat"]
  ];
  for (const [input, foodId, state] of cases) {
    const entry = parseFoodText(input).entries[0];
    assert.equal(entry.foodId, foodId, input);
    assert.equal(entry.reference?.state, state, input);
  }
  const ranges = [
    ["100g oats", "calories", 350, 410],
    ["100g oats", "proteinGrams", 11, 15],
    ["100g sweet potato", "calories", 75, 110],
    ["100g banana", "calories", 75, 105],
    ["100g pita", "calories", 240, 310],
    ["1 rice cake", "calories", 20, 55]
  ];
  for (const [input, field, minimum, maximum] of ranges) {
    const value = parseFoodText(input).entries[0][field];
    assert.ok(value >= minimum && value <= maximum, `${input} ${field}: ${value}`);
  }
});

test("explicit grams override natural portion estimation", async () => {
  const { parseFoodText } = await domainPromise;
  const entry = parseFoodText("95 גרם בטטה").entries[0];
  assert.equal(entry.amount, 95);
  assert.equal(entry.estimated, false);
  assert.equal(entry.approximate, false);
  const suffixResult = parseFoodText("קוטג׳ 250 גרם");
  assert.equal(suffixResult.status, "needs-clarification");
  assert.equal(suffixResult.ambiguities[0].amount, 250);
  assert.equal(suffixResult.ambiguities[0].unit, "g");
  const specificSuffix = parseFoodText("קוטג׳ 5% 250 גרם").entries[0];
  assert.equal(specificSuffix.foodId, "cottage-5");
  assert.equal(specificSuffix.amount, 250);
});

test("natural English and Hebrew portions resolve to transparent editable estimates", async () => {
  const { parseFoodText } = await domainPromise;
  const cases = [
    ["בטטה בינונית", 180, 1, "medium"],
    ["2 בטטות בינוניות", 360, 2, "medium"],
    ["medium banana", 118, 1, "medium"],
    ["קערת אורז", 220, 1, null],
    ["2 pizza slices", 240, 2, null]
  ];
  for (const [input, grams, count, size] of cases) {
    const entry = parseFoodText(input).entries[0];
    assert.equal(entry.amount, grams, input);
    assert.equal(entry.estimatedGrams, grams, input);
    assert.equal(entry.portionCount, count, input);
    assert.equal(entry.portionSize, size, input);
    assert.equal(entry.approximate, true, input);
  }
  const halfPita = parseFoodText("חצי פיתה").entries[0];
  assert.equal(halfPita.amount, 30);
  assert.equal(halfPita.portionCount, 0.5);
});

test("whole pizza requests a compact size choice instead of inventing one", async () => {
  const { parseFoodText, resolveFoodChoice } = await domainPromise;
  const result = parseFoodText("מגש פיצה");
  assert.equal(result.status, "needs-clarification");
  assert.equal(result.ambiguities[0].kind, "portion");
  assert.deepEqual(
    result.ambiguities[0].choices.filter((choice) => !choice.isEstimateFallback).map((choice) => choice.choiceId),
    ["personal", "medium", "large"]
  );
  assert.ok(result.ambiguities[0].choices.some((choice) => choice.isEstimateFallback));
  const medium = result.ambiguities[0].choices[1];
  const resolved = resolveFoodChoice(medium.foodId, { amount: medium.amount, unit: medium.unit, estimate: medium.estimate, rawText: "מגש פיצה" });
  assert.equal(resolved.amount, 800);
  assert.equal(resolved.compositeEstimate, true);
});

test("composite meals ask one compact size question and stay low-confidence estimates", async () => {
  const { parseFoodText, resolveFoodChoice } = await domainPromise;
  const result = parseFoodText("לאפה שווארמה");
  assert.equal(result.status, "needs-clarification");
  assert.equal(result.ambiguities[0].kind, "size");
  const unknown = result.ambiguities[0].choices.find((choice) => choice.isEstimateFallback);
  assert.ok(unknown, "composite size clarification offers an I-don't-know path");
  const entry = resolveFoodChoice(unknown.foodId, { amount: unknown.amount, unit: unknown.unit, estimate: unknown.estimate, rawText: "לאפה שווארמה" });
  assert.equal(entry.amount, 500);
  assert.equal(entry.estimateConfidence, "low");
  assert.equal(entry.compositeEstimate, true);
});

test("custom and known-brand records take priority over generic aliases", async () => {
  const { parseFoodText, validateCustomFood } = await domainPromise;
  assert.equal(parseFoodText("quaker oats").entries[0].foodId, "oats-quaker-original");
  const custom = validateCustomFood({ id: "my-oats", name: "Oats", baseAmount: 100, baseUnit: "g", calories: 420, proteinGrams: 20, carbsGrams: 60, fatGrams: 10 });
  const result = parseFoodText("50g oats", { customFoods: [custom] });
  assert.equal(result.entries[0].foodId, "my-oats");
  assert.equal(result.entries[0].calories, 210);
});

test("multiple-food parsing returns recognized entries alongside explicit errors", async () => {
  const { parseFoodText } = await domainPromise;
  const result = parseFoodText("50g oats and mystery food");
  assert.equal(result.status, "partial");
  assert.deepEqual(result.entries.map((entry) => entry.foodId), ["oats"]);
  assert.deepEqual(result.errors.map((error) => error.segment), ["mystery food"]);
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

test("weekly balance excludes days that have no maintenance snapshot", async () => {
  const { weeklySummary } = await domainPromise;
  const summary = weeklySummary([
    { entries: [{ calories: 2000 }], totals: { calories: 2000, proteinGrams: 140 }, maintenanceSnapshot: 2500 },
    { entries: [{ calories: 4000 }], totals: { calories: 4000, proteinGrams: 180 }, maintenanceSnapshot: null }
  ]);
  assert.equal(summary.loggedDays, 2);
  assert.equal(summary.averageCalories, 3000);
  assert.equal(summary.averageMaintenance, 2500);
  assert.equal(summary.averageBalance, -500);
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
