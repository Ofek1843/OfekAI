"use strict";

const ACTIVITY_MULTIPLIERS = Object.freeze({
  sedentary: 1.2,
  lightlyActive: 1.375,
  moderatelyActive: 1.55,
  veryActive: 1.725,
  extremelyActive: 1.9
});

function normalizedGoal(goal) {
  const value = String(goal || "").trim().toLowerCase().replace(/[_ ]+/g, "-");
  if (["fat-loss", "losefat", "lose-fat"].includes(value)) return "loseFat";
  if (["muscle-gain", "buildmuscle", "build-muscle"].includes(value)) return "buildMuscle";
  if (["maintenance", "maintain", "maintain-weight", "maintainweight"].includes(value)) return "maintainWeight";
  if (["performance", "improve-performance", "improveperformance"].includes(value)) return "improvePerformance";
  return "maintainWeight";
}

function calculateNutritionTargets({ age, gender, height, weight, activityLevel, goal } = {}) {
  const parsedAge = Number(age);
  const parsedHeight = Number(height);
  const parsedWeight = Number(weight);
  if (![parsedAge, parsedHeight, parsedWeight].every(Number.isFinite)) throw new Error("Age, height and weight are required.");
  const normalizedGender = String(gender || "female").toLowerCase();
  const isMale = normalizedGender === "male";
  const isYouth = parsedAge >= 15 && parsedAge < 18;
  const isOlderAdult = parsedAge >= 65;
  const heightMeters = parsedHeight / 100;
  const bmr = 10 * parsedWeight + 6.25 * parsedHeight - 5 * parsedAge + (isMale ? 5 : -161);
  const level = ACTIVITY_MULTIPLIERS[activityLevel] ? activityLevel : "sedentary";
  const youthActivityCoefficients = isMale
    ? { sedentary: 1, lightlyActive: 1.13, moderatelyActive: 1.26, veryActive: 1.42, extremelyActive: 1.42 }
    : { sedentary: 1, lightlyActive: 1.16, moderatelyActive: 1.31, veryActive: 1.56, extremelyActive: 1.56 };
  const youthPa = youthActivityCoefficients[level] || 1;
  const youthEstimatedEnergy = isMale
    ? 88.5 - 61.9 * parsedAge + youthPa * (26.7 * parsedWeight + 903 * heightMeters) + 25
    : 135.3 - 30.8 * parsedAge + youthPa * (10 * parsedWeight + 934 * heightMeters) + 25;
  const maintenanceCalories = isYouth ? youthEstimatedEnergy : bmr * ACTIVITY_MULTIPLIERS[level];
  const adjustments = {
    loseFat: isYouth ? 0 : isOlderAdult ? -250 : -400,
    buildMuscle: isYouth ? 100 : isOlderAdult ? 150 : 250,
    maintainWeight: 0,
    improvePerformance: isYouth ? 100 : isOlderAdult ? 100 : 150
  };
  const targetCalories = Math.round((maintenanceCalories + (adjustments[normalizedGoal(goal)] || 0)) / 50) * 50;
  const targetProtein = Math.round(parsedWeight * (isYouth ? 1.5 : isOlderAdult ? 1.6 : 2));
  const targetFat = Math.round((targetCalories * 0.25) / 9);
  const targetCarbs = Math.round((targetCalories - targetProtein * 4 - targetFat * 9) / 4);
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(maintenanceCalories),
    maintenanceCalories: Math.round(maintenanceCalories),
    dailyCalories: targetCalories,
    proteinGrams: targetProtein,
    carbsGrams: targetCarbs,
    fatGrams: targetFat,
    goal: normalizedGoal(goal),
    isYouth,
    isOlderAdult
  };
}

module.exports = { ACTIVITY_MULTIPLIERS, calculateNutritionTargets, normalizedGoal };
