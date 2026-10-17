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
  throw Object.assign(new Error("Select one supported nutrition goal."), { status: 400, code: "INVALID_NUTRITION_GOAL" });
}

function calculateNutritionTargets({ age, gender, height, weight, activityLevel, goal } = {}) {
  const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
  const numeric = value => (typeof value === "number" || typeof value === "string") && String(value).trim() !== "" && Number.isFinite(Number(value));
  if (![age, height, weight].every(numeric)) fail("Age, height and weight must be provided in years, cm and kg.");
  const parsedAge = Number(age);
  const parsedHeight = Number(height);
  const parsedWeight = Number(weight);
  if (![parsedAge, parsedHeight, parsedWeight].every(Number.isFinite)) throw new Error("Age, height and weight are required.");
  if (!Number.isInteger(parsedAge) || parsedAge < 15 || parsedAge > 100 || parsedHeight < 100 || parsedHeight > 250 || parsedWeight < 30 || parsedWeight > 300) fail("Measurements are outside the supported age/metric range.");
  const normalizedGender = String(gender || "").trim().toLowerCase();
  if (!["male", "female"].includes(normalizedGender)) fail("Select the physiological coefficient for this equation, or seek an individually measured estimate. No coefficient is assumed.");
  if (!Object.hasOwn(ACTIVITY_MULTIPLIERS, activityLevel)) fail("Select a supported activity level; no activity estimate is assumed.");
  const selectedGoal = normalizedGoal(goal);
  const isMale = normalizedGender === "male";
  const isYouth = parsedAge >= 15 && parsedAge < 18;
  const isOlderAdult = parsedAge >= 65;
  const heightMeters = parsedHeight / 100;
  // WHO adult underweight classification is a REVIEW trigger, not a diagnosis.
  if (!isYouth && selectedGoal === "loseFat" && parsedWeight / heightMeters ** 2 < 18.5) fail("Automated weight-loss targets are not available for an adult underweight screening result. Please review your measurements and consult a qualified professional.", 422);
  const bmr = 10 * parsedWeight + 6.25 * parsedHeight - 5 * parsedAge + (isMale ? 5 : -161);
  const level = activityLevel;
  const youthActivityCoefficients = isMale
    ? { sedentary: 1, lightlyActive: 1.13, moderatelyActive: 1.26, veryActive: 1.42, extremelyActive: 1.42 }
    : { sedentary: 1, lightlyActive: 1.16, moderatelyActive: 1.31, veryActive: 1.56, extremelyActive: 1.56 };
  const youthPa = youthActivityCoefficients[level] || 1;
  const youthEstimatedEnergy = isMale
    ? 88.5 - 61.9 * parsedAge + youthPa * (26.7 * parsedWeight + 903 * heightMeters) + 25
    : 135.3 - 30.8 * parsedAge + youthPa * (10 * parsedWeight + 934 * heightMeters) + 25;
  const maintenanceCalories = isYouth ? youthEstimatedEnergy : bmr * ACTIVITY_MULTIPLIERS[level];
  const adjustments = {
    // Conservative product starting estimates, not clinical safety thresholds.
    // Scale with estimated expenditure; retain upper adjustment caps and review over time.
    loseFat: isYouth ? 0 : -Math.min(isOlderAdult ? 250 : 400, maintenanceCalories * 0.15),
    buildMuscle: isYouth ? 100 : Math.min(isOlderAdult ? 150 : 250, maintenanceCalories * 0.1),
    maintainWeight: 0,
    improvePerformance: isYouth ? 100 : isOlderAdult ? 100 : 150
  };
  const targetCalories = Math.round((maintenanceCalories + adjustments[selectedGoal]) / 50) * 50;
  const targetProtein = Math.round(parsedWeight * (isYouth ? 1.5 : isOlderAdult ? 1.6 : 2));
  const targetFat = Math.round((targetCalories * 0.25) / 9);
  const targetCarbs = Math.round((targetCalories - targetProtein * 4 - targetFat * 9) / 4);
  if (![bmr, maintenanceCalories, targetCalories, targetProtein, targetFat, targetCarbs].every(Number.isFinite) || bmr <= 0 || targetCalories <= 0 || targetCarbs < 0 || targetProtein <= 0 || targetFat <= 0) fail("These measurements do not produce a feasible automated energy/macro estimate. Please seek an individual assessment.", 422);
  if (!isYouth && targetProtein * 4 > targetCalories * 0.35) fail("The automatic protein estimate exceeds this tool's general-population macro planning range. Individual review is needed; this is not a diagnosis of unsafe protein intake.", 422);
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(maintenanceCalories),
    maintenanceCalories: Math.round(maintenanceCalories),
    dailyCalories: targetCalories,
    proteinGrams: targetProtein,
    carbsGrams: targetCarbs,
    fatGrams: targetFat,
    goal: selectedGoal,
    energyAdjustment: Math.round(targetCalories - maintenanceCalories),
    estimateNotice: "Starting estimates, not measured requirements or medical advice. Review intake, performance and weight trends with a qualified professional; macro accuracy does not prove nutritional adequacy.",
    isYouth,
    isOlderAdult
  };
}

module.exports = { ACTIVITY_MULTIPLIERS, calculateNutritionTargets, normalizedGoal };
