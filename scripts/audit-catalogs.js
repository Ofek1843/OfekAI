"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  WORKOUT_EXERCISE_CATALOG,
  WORKOUT_EXERCISE_ALIAS_MAP,
  canonicalizeExerciseId,
  getDisabledExercise,
  getCatalogExercise,
  getEnabledPublicExerciseIds
} = require("../lib/workout-exercise-catalog");
const { MINIMUM_LEVEL, isExerciseLevelSuitable } = require("../lib/exercise-suitability");
const { normalizeEquipment } = require("../lib/workout-validator");
const { CANONICAL_EQUIPMENT_TOKENS } = require("../lib/workout-equipment-policy");
const { buildLocalWorkoutProgram, buildLocalExerciseReplacement } = require("../lib/local-demo-generators");
const { CATALOG, FOODS, buildMealOption, buildMealSlots, filterMeals, selectMeals } = require("../lib/meal-catalog");
const { calculateNutritionTargets } = require("../lib/nutrition-targets");
const { attachActualTotals, evaluatePlanTotals, verifyDisplayedArithmetic } = require("../lib/nutrition-totals");
const { balancePlanWithMealSearch, findImplausibleServings } = require("../lib/nutrition-portion-balancer");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "outputs", "catalog-logic-audit.json");
const VALID_MUSCLES = new Set(["back", "biceps", "calves", "chest", "core", "delts", "glutes", "hamstrings", "quads", "rear_delts", "traps", "triceps"]);
const errors = [];
const warnings = [];
const info = [];
const issue = (severity, code, details) => ({ severity, code, ...details });

function existsPublic(asset) {
  return fs.existsSync(path.join(ROOT, "public", String(asset || "").replace(/^\//, "")));
}

function auditExercises() {
  const ids = getEnabledPublicExerciseIds();
  const seenNames = new Map();
  const seenImages = new Map();
  const canonicalEquipment = new Set(CANONICAL_EQUIPMENT_TOKENS);
  for (const id of ids) {
    const entry = getCatalogExercise(id);
    if (!entry || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) errors.push(issue("ERROR", "exercise.invalid-id", { id }));
    if (!entry?.title) errors.push(issue("ERROR", "exercise.missing-title", { id }));
    const normalizedName = String(entry?.title || "").trim().toLowerCase();
    if (seenNames.has(normalizedName)) warnings.push(issue("WARNING", "exercise.duplicate-name", { id, otherId: seenNames.get(normalizedName) }));
    else seenNames.set(normalizedName, id);
    const equipment = normalizeEquipment(entry?.equipment);
    if (!canonicalEquipment.has(equipment)) errors.push(issue("ERROR", "exercise.invalid-equipment", { id, equipment: entry?.equipment, normalized: equipment }));
    const credits = Object.entries(entry?.setCredits || {});
    if (!credits.length) errors.push(issue("ERROR", "exercise.missing-set-credits", { id }));
    for (const [muscle, credit] of credits) {
      if (!VALID_MUSCLES.has(muscle) || !Number.isFinite(Number(credit)) || Number(credit) <= 0 || Number(credit) > 1) {
        errors.push(issue("ERROR", "exercise.invalid-set-credit", { id, muscle, credit }));
      }
    }
    const image = entry?.image;
    const png = `/images/exercises/${image}`;
    const webp = png.replace(/\.png$/i, ".webp");
    if (!image || !existsPublic(png) || !existsPublic(webp)) errors.push(issue("ERROR", "exercise.broken-image", { id, png, webp }));
    if (seenImages.has(image)) warnings.push(issue("WARNING", "exercise.shared-image", { id, otherId: seenImages.get(image), image }));
    else seenImages.set(image, id);
  }
  for (const [alias, target] of Object.entries(WORKOUT_EXERCISE_ALIAS_MAP)) {
    const canonical = canonicalizeExerciseId(target);
    if (!WORKOUT_EXERCISE_CATALOG[canonical] && !getDisabledExercise(canonical)) errors.push(issue("ERROR", "exercise.orphan-alias", { alias, target }));
    if (WORKOUT_EXERCISE_CATALOG[alias] && alias !== canonical) warnings.push(issue("WARNING", "exercise.alias-collides-with-canonical", { alias, target: canonical }));
  }
  for (const [id, level] of Object.entries(MINIMUM_LEVEL)) {
    if (!getCatalogExercise(id)) errors.push(issue("ERROR", "exercise.orphan-level", { id, level }));
    if (![0, 1, 2, 3].includes(level)) errors.push(issue("ERROR", "exercise.invalid-minimum-level", { id, level }));
  }
  return { total: ids.length, canonicalRecords: Object.keys(WORKOUT_EXERCISE_CATALOG).length, aliases: Object.keys(WORKOUT_EXERCISE_ALIAS_MAP).length };
}

function auditMeals() {
  const ids = new Set();
  const names = new Map();
  for (const meal of CATALOG) {
    if (ids.has(meal.id)) errors.push(issue("ERROR", "meal.duplicate-id", { id: meal.id }));
    ids.add(meal.id);
    const normalizedName = String(meal.en || "").trim().toLowerCase();
    if (names.has(normalizedName)) warnings.push(issue("WARNING", "meal.duplicate-name", { id: meal.id, otherId: names.get(normalizedName) }));
    else names.set(normalizedName, meal.id);
    if (!meal.en || !meal.he) errors.push(issue("ERROR", "meal.missing-bilingual-name", { id: meal.id }));
    if (!Array.isArray(meal.items) || !meal.items.length) errors.push(issue("ERROR", "meal.missing-items", { id: meal.id }));
    for (const [foodId, grams] of meal.items || []) {
      if (!FOODS[foodId]) errors.push(issue("ERROR", "meal.missing-food", { id: meal.id, foodId }));
      if (!Number.isFinite(Number(grams)) || Number(grams) <= 0) errors.push(issue("ERROR", "meal.invalid-amount", { id: meal.id, foodId, grams }));
    }
    for (const key of ["baseCalories", "baseProtein", "baseCarbs", "baseFat"]) {
      if (!Number.isFinite(Number(meal[key])) || Number(meal[key]) < 0 || (key === "baseCalories" && Number(meal[key]) <= 0)) errors.push(issue("ERROR", "meal.invalid-macro", { id: meal.id, key, value: meal[key] }));
    }
    const png = meal.image;
    const webp = String(png || "").replace(/\.png$/i, ".webp");
    if (!png || !existsPublic(png) || !existsPublic(webp)) errors.push(issue("ERROR", "meal.broken-image", { id: meal.id, png, webp }));
    if (!Array.isArray(meal.slots) || !meal.slots.length || !["ready", "quick", "cook"].includes(meal.mealFormat)) errors.push(issue("ERROR", "meal.invalid-routing-tags", { id: meal.id }));
  }
  return { total: CATALOG.length, foods: Object.keys(FOODS).length };
}

const TRAINING_CASES = ["beginner", "intermediate", "advanced"].flatMap(experience => [
  { experience, kind: "gym", trainingStyle: "gym", equipment: ["dumbbell", "barbell", "machine", "cable", "kettlebell"] },
  { experience, kind: "calisthenics", trainingStyle: "calisthenics", equipment: ["bodyweight", "pullupbar", "rings", "parallelbar"] },
  { experience, kind: "home", trainingStyle: "hybrid", equipment: ["bodyweight", "dumbbell", "kettlebell"] }
]);

function auditTrainingMatrix() {
  return TRAINING_CASES.map(scenario => {
    const program = buildLocalWorkoutProgram({ ...scenario, daysPerWeek: 3, sessionDuration: 75 });
    const exercises = program.sessions.flatMap(session => session.exercises);
    const allowed = new Set(scenario.equipment.map(normalizeEquipment));
    const violations = [];
    if (program.sessions.length !== 3) violations.push("days");
    for (const session of program.sessions) {
      const sessionIds = session.exercises.map(exercise => exercise.exerciseId);
      if (new Set(sessionIds).size !== sessionIds.length) violations.push("duplicate-in-session");
    }
    for (const exercise of exercises) {
      if (!allowed.has(normalizeEquipment(exercise.equipment))) violations.push(`equipment:${exercise.exerciseId}`);
      if (!isExerciseLevelSuitable(exercise.exerciseId, scenario.experience)) violations.push(`level:${exercise.exerciseId}`);
      if (![exercise.sets, exercise.restSeconds].every(value => Number.isFinite(Number(value))) || !exercise.reps || !exercise.rir) violations.push(`schema:${exercise.exerciseId}`);
    }
    const current = exercises[0];
    const replacement = buildLocalExerciseReplacement({ currentExercise: current, experience: scenario.experience, equipment: scenario.equipment, reservedExerciseIds: program.sessions[0].exercises.map(exercise => exercise.exerciseId) });
    if (replacement && (!allowed.has(normalizeEquipment(replacement.equipment)) || !isExerciseLevelSuitable(replacement.exerciseId, scenario.experience))) violations.push("reroll");
    if (violations.length) errors.push(issue("ERROR", "training.matrix", { scenario: `${scenario.experience}/${scenario.kind}`, violations }));
    return { scenario: `${scenario.experience}/${scenario.kind}`, exercises: exercises.length, sample: [...new Set(exercises.map(exercise => exercise.exerciseId))].slice(0, 8), reroll: replacement?.exerciseId || null, violations };
  });
}

function buildNutritionPlan(profile, targets) {
  const mealCount = targets.dailyCalories >= 3200 ? 6 : targets.dailyCalories >= 2800 ? 5 : 4;
  const slots = buildMealSlots(mealCount, false);
  const totalWeight = slots.reduce((sum, slot) => sum + slot.weight, 0);
  const used = new Set();
  const poolOptions = { diet: profile.diet, foodStylePreference: profile.mode };
  const plan = {
    dailyCalories: targets.dailyCalories,
    proteinGrams: targets.proteinGrams,
    carbsGrams: targets.carbsGrams,
    fatGrams: targets.fatGrams,
    meals: slots.map(slot => {
      const ratio = slot.weight / totalWeight;
      const targetCalories = Math.round(targets.dailyCalories * ratio);
      const pool = filterMeals({ ...poolOptions, slot: slot.slot });
      const ids = selectMeals({ pool, slot: slot.slot, targetCalories, targetProteinGrams: targets.proteinGrams * ratio, targetCarbsGrams: targets.carbsGrams * ratio, targetFatGrams: targets.fatGrams * ratio, macroAware: true, count: 3, exclude: [...used], foodStylePreference: profile.mode });
      ids.forEach(id => used.add(id));
      return { mealNumber: slot.mealNumber, slot: slot.slot, targetCalories, targetProteinGrams: Math.round(targets.proteinGrams * ratio), targetCarbsGrams: Math.round(targets.carbsGrams * ratio), targetFatGrams: Math.round(targets.fatGrams * ratio), options: ids.map((id, index) => buildMealOption(id, { targetCalories, optionNumber: index + 1 })) };
    })
  };
  balancePlanWithMealSearch(plan, { calories: targets.dailyCalories, proteinGrams: targets.proteinGrams, carbsGrams: targets.carbsGrams, fatGrams: targets.fatGrams }, {
    candidatesForSlot: meal => filterMeals({ ...poolOptions, slot: meal.slot }),
    buildOption: (id, meal) => buildMealOption(id, { targetCalories: meal.targetCalories, optionNumber: 1 })
  });
  attachActualTotals(plan);
  return plan;
}

const NUTRITION_PROFILES = [
  { label: "female-light", age: 27, gender: "female", height: 164, weight: 58, activityLevel: "lightlyActive", diet: "omnivore" },
  { label: "male-moderate", age: 34, gender: "male", height: 180, weight: 82, activityLevel: "moderatelyActive", diet: "vegetarian" },
  { label: "male-heavy", age: 42, gender: "male", height: 188, weight: 102, activityLevel: "veryActive", diet: "vegan" }
];

function auditNutritionMatrix() {
  const rows = [];
  const serverSource = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
  const safeRejectionGate = /if \(!totalsCheck\.withinTolerance \|\| implausible\.length\)[\s\S]{0,900}res\.status\(422\)/.test(serverSource);
  for (const profile of NUTRITION_PROFILES) for (const goal of ["loseFat", "maintainWeight", "buildMuscle"]) for (const mode of ["mix", "supermarket"]) {
    const targets = calculateNutritionTargets({ ...profile, goal });
    const plan = buildNutritionPlan({ ...profile, mode }, targets);
    const evaluation = evaluatePlanTotals(plan);
    const arithmetic = verifyDisplayedArithmetic(plan);
    const servings = findImplausibleServings(plan);
    const directionOk = goal === "loseFat" ? targets.dailyCalories < targets.tdee : goal === "buildMuscle" ? targets.dailyCalories > targets.tdee : Math.abs(targets.dailyCalories - targets.tdee) <= 25;
    const modeOk = mode !== "supermarket" || plan.meals.every(meal => meal.options.every(option => CATALOG.find(candidate => candidate.id === option.mealId)?.foodStyles.includes("supermarket")));
    const integrityOk = arithmetic.exact && !servings.length && directionOk && modeOk;
    const safelyRejected = integrityOk && !evaluation.withinTolerance && safeRejectionGate;
    const ok = integrityOk && (evaluation.withinTolerance || safelyRejected);
    if (!ok) errors.push(issue("ERROR", "nutrition.matrix", { scenario: `${profile.label}/${goal}/${mode}`, failures: evaluation.failures, arithmetic: arithmetic.mismatches, servings, directionOk, modeOk, safeRejectionGate }));
    else if (safelyRejected) warnings.push(issue("WARNING", "nutrition.safe-rejection", { scenario: `${profile.label}/${goal}/${mode}`, failures: evaluation.failures, detail: "Canonical server gate returns 422 instead of publishing this out-of-tolerance plan." }));
    rows.push({ profile: profile.label, diet: profile.diet, mode, tdee: targets.tdee, goal, target: targets.dailyCalories, generated: evaluation.actual.calories, difference: evaluation.deviations.calories, differencePercent: evaluation.deviations.caloriePercent, proteinTarget: targets.proteinGrams, proteinGenerated: evaluation.actual.proteinGrams, result: evaluation.withinTolerance ? "PASS" : safelyRejected ? "SAFE_REJECTION" : "FAIL" });
  }
  return rows;
}

function main() {
  const report = { exerciseCatalog: auditExercises(), mealCatalog: auditMeals() };
  report.trainingMatrix = auditTrainingMatrix();
  report.nutritionMatrix = auditNutritionMatrix();
  info.push(issue("INFO", "exercise.level-semantics", { detail: "Minimum prerequisite model; foundational exercises remain eligible for advanced users." }));
  info.push(issue("INFO", "exercise.movement-pattern", { detail: "The current canonical catalog does not use a separate movement-pattern field." }));
  report.summary = { errors: errors.length, warnings: warnings.length, info: info.length };
  report.issues = [...errors, ...warnings, ...info];
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Exercise catalog: ${report.exerciseCatalog.total} exercises; Meal catalog: ${report.mealCatalog.total} meals / ${report.mealCatalog.foods} foods`);
  console.log(`Matrices: ${report.trainingMatrix.length} training; ${report.nutritionMatrix.length} nutrition`);
  console.log(`Result: ${errors.length} errors, ${warnings.length} warnings, ${info.length} info`);
  console.log(`Report: ${path.relative(ROOT, OUTPUT)}`);
  if (errors.length) process.exitCode = 1;
}

if (require.main === module) main();
