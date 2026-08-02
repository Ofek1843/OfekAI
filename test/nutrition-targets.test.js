"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateNutritionTargets } = require("../lib/nutrition-targets");

test("manual targets use the existing BMR, TDEE and macro formulas", () => {
  const input = { age: 30, gender: "male", height: 180, weight: 80, activityLevel: "moderatelyActive" };
  const fatLoss = calculateNutritionTargets({ ...input, goal: "fat-loss" });
  const maintenance = calculateNutritionTargets({ ...input, goal: "maintenance" });
  const muscleGain = calculateNutritionTargets({ ...input, goal: "muscle-gain" });
  assert.deepEqual({ bmr: fatLoss.bmr, tdee: fatLoss.tdee, dailyCalories: fatLoss.dailyCalories, proteinGrams: fatLoss.proteinGrams }, { bmr: 1780, tdee: 2759, dailyCalories: 2350, proteinGrams: 160 });
  assert.ok(fatLoss.dailyCalories < maintenance.dailyCalories);
  assert.ok(muscleGain.dailyCalories > maintenance.dailyCalories);
  assert.ok(fatLoss.carbsGrams > 0 && fatLoss.fatGrams > 0);
});
