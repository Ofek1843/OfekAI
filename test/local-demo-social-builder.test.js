"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildLocalWorkoutProgram } = require("../lib/local-demo-generators");
const { repairWorkoutProgram } = require("../lib/workout-repair");
const { validateWorkoutProgram } = require("../lib/workout-validator");
const { calculateWeeklyVolume } = require("../lib/workout-volume");
const { getPublicSetCredits } = require("../lib/workout-exercise-catalog");
const { requiredMusclesOutOfRange } = require("../lib/workout-volume-targets");
const { buildMealOption, buildMealSlots, filterMeals, selectMeals } = require("../lib/meal-catalog");
const { balancePlanWithMealSearch, markSelectableOptions } = require("../lib/nutrition-portion-balancer");
const { evaluatePlanTotals, verifyDisplayedArithmetic } = require("../lib/nutrition-totals");
const { builderErrorMessage } = require("../public/js/builder-errors.mjs");

const ROOT = path.join(__dirname, "..");
const SERVER = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
const SOCIAL = fs.readFileSync(path.join(ROOT, "public", "js", "social.js"), "utf8");
const SOCIAL_HTML = fs.readFileSync(path.join(ROOT, "public", "social.html"), "utf8");
const SOCIAL_ROUTER = fs.readFileSync(path.join(ROOT, "lib", "social-router.js"), "utf8");
const FIREBASE_CONFIG = fs.readFileSync(path.join(ROOT, "public", "js", "firebase-config.js"), "utf8");

test("local workout generation is server-controlled, canonical and strict", () => {
  const allowed = ["dumbbell", "cable", "machine"];
  const program = buildLocalWorkoutProgram({ goal: "buildMuscle", daysPerWeek: 3, sessionDuration: 60, equipment: allowed, trainingStyle: "gym" });
  program.weeklyScheduleDays = [1, 3, 5];
  repairWorkoutProgram(program, { sessionDuration: 60, equipment: allowed, experience: "intermediate", priority: "buildMuscle", daysPerWeek: 3, applyVolumeTargets: true });
  const result = validateWorkoutProgram(program, { daysPerWeek: 3, sessionDuration: 60, equipment: allowed, availableDayIndexes: [1, 3, 5], goalProfile: "hypertrophy" });
  assert.equal(result.ok, true);
  assert.equal(result.equipmentOk, true);
  assert.ok(program.sessions.flatMap((session) => session.exercises).every((exercise) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(exercise.exerciseId)));
  assert.ok(program.sessions.flatMap((session) => session.exercises).every((exercise) => allowed.includes(exercise.equipment.toLowerCase())));
});

test("representative advanced four-day local workout passes the hard volume gate", () => {
  const allowed = ["dumbbell", "machine"];
  const program = buildLocalWorkoutProgram({
    goal: "buildMuscle",
    experience: "advanced",
    trainingStyle: "gym",
    equipment: allowed,
    daysPerWeek: 4,
    sessionDuration: 60,
    language: "en"
  });
  program.weeklyScheduleDays = [1, 3, 5, 0];

  const repairs = repairWorkoutProgram(program, {
    sessionDuration: 60,
    equipment: allowed,
    experience: "advanced",
    priority: "buildMuscle",
    daysPerWeek: 4,
    applyVolumeTargets: false
  });
  const validation = validateWorkoutProgram(program, {
    daysPerWeek: 4,
    sessionDuration: 60,
    equipment: allowed,
    availableDayIndexes: [1, 3, 5, 0],
    goalProfile: "hypertrophy"
  });
  const volume = calculateWeeklyVolume(program, getPublicSetCredits());
  const outOfRange = requiredMusclesOutOfRange(volume.perMuscle, {
    experience: "advanced",
    priority: "buildMuscle",
    daysPerWeek: 4,
    equipment: allowed
  });

  assert.deepEqual(repairs.repairs, []);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  assert.equal(validation.equipmentOk, true);
  assert.deepEqual(outOfRange, []);
  assert.equal(volume.mappingCoveragePercent, 100);
  assert.ok(program.sessions.every((session) => session.exercises.length > 0));
  assert.ok(program.sessions.every((session) => {
    const ids = session.exercises.map((exercise) => exercise.exerciseId);
    return ids.length === new Set(ids).size;
  }));
});

test("local nutrition fallback ranks candidates by macros as well as calories", () => {
  const pool = [
    { id: "calorie-only", slots: ["breakfast"], baseCalories: 500, baseProtein: 8, baseCarbs: 90, baseFat: 20, nutrients: [] },
    { id: "macro-fit", slots: ["breakfast"], baseCalories: 510, baseProtein: 30, baseCarbs: 55, baseFat: 15, nutrients: [] },
    { id: "calorie-far", slots: ["breakfast"], baseCalories: 650, baseProtein: 32, baseCarbs: 58, baseFat: 16, nutrients: [] }
  ];
  const selected = selectMeals({
    pool,
    slot: "breakfast",
    targetCalories: 500,
    targetProteinGrams: 30,
    targetCarbsGrams: 55,
    targetFatGrams: 15,
    macroAware: true,
    count: 1
  });

  assert.deepEqual(selected, ["macro-fit"]);
});

test("nutrition alternative checks preserve the validated opening totals", () => {
  const targets = { calories: 2900, proteinGrams: 150, carbsGrams: 393, fatGrams: 81 };
  const slots = buildMealSlots(4, false);
  const totalWeight = slots.reduce((sum, slot) => sum + slot.weight, 0);
  const plan = {
    dailyCalories: targets.calories,
    proteinGrams: targets.proteinGrams,
    carbsGrams: targets.carbsGrams,
    fatGrams: targets.fatGrams,
    meals: slots.map((slot) => {
      const targetCalories = Math.round((targets.calories * slot.weight) / totalWeight);
      const targetScale = targetCalories / targets.calories;
      const pool = filterMeals({ diet: "omnivore", slot: slot.slot });
      const ids = selectMeals({
        pool,
        slot: slot.slot,
        targetCalories,
        targetProteinGrams: targets.proteinGrams * targetScale,
        targetCarbsGrams: targets.carbsGrams * targetScale,
        targetFatGrams: targets.fatGrams * targetScale,
        macroAware: true,
        count: 3
      });
      return {
        mealNumber: slot.mealNumber,
        slot: slot.slot,
        targetCalories,
        options: ids.map((id, index) => buildMealOption(id, { targetCalories, optionNumber: index + 1 }))
      };
    })
  };

  const initial = balancePlanWithMealSearch(plan, targets, {
    candidatesForSlot: meal => filterMeals({ diet: "omnivore", slot: meal.slot }),
    buildOption: (id, meal) => buildMealOption(id, { targetCalories: meal.targetCalories, optionNumber: 1 })
  });
  assert.equal(initial.ok, true);

  markSelectableOptions(plan, targets);
  const totals = evaluatePlanTotals(plan, null);
  assert.equal(totals.withinTolerance, true, JSON.stringify(totals));
  assert.equal(verifyDisplayedArithmetic(plan, null).exact, true);
});

test("local mode bypasses provider calls only behind the explicit server flag", () => {
  assert.match(SERVER, /process\.env\.FUELPHYSIQUE_LOCAL_DEMO === "1"/);
  assert.match(SERVER, /localDemoMode\s*\?\s*JSON\.stringify\(buildLocalWorkoutProgram/);
  assert.match(SERVER, /localDemoMode \? "" : await createChatCompletion/);
  assert.doesNotMatch(SERVER, /req\.query\.localDemo/);
});

test("builder status mapping does not label auth or rate failures as provider failures", () => {
  assert.match(builderErrorMessage({ status: 401, data: { error: "OpenAI API request failed" } }), /session expired/i);
  assert.match(builderErrorMessage({ status: 403, data: {} }), /verification|permission/i);
  assert.match(builderErrorMessage({ status: 429, data: {} }), /too many requests/i);
  assert.match(builderErrorMessage({ status: 502, data: {} }), /temporarily unavailable/i);
});

test("social page removes the header language switch and adds bounded realtime/typing paths", () => {
  assert.doesNotMatch(SOCIAL_HTML, /id="languageButton"/);
  assert.match(SOCIAL, /where\("toUid"/);
  assert.match(SOCIAL, /limit\(25\)/);
  assert.match(SOCIAL, /typing\/stream/);
  assert.match(SOCIAL, /stopTypingChannel/);
  assert.match(SOCIAL_ROUTER, /typing\.addStream/);
  assert.match(SOCIAL_ROUTER, /typing\.setTyping/);
  assert.doesNotMatch(SOCIAL, /collection\([^)]*typing/);
});

test("loopback Firebase client uses the same demo project as the local emulators", () => {
  assert.match(FIREBASE_CONFIG, /projectId: localEmulatorMode \? "demo-fuelphysique"/);
  assert.match(FIREBASE_CONFIG, /connectFirestoreEmulator\(db, "127\.0\.0\.1", 8080\)/);
  assert.match(FIREBASE_CONFIG, /connectAuthEmulator\(auth, "http:\/\/127\.0\.0\.1:9099"/);
});
