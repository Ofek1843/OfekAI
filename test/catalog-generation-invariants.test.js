"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { getEnabledPublicExerciseIds, getCatalogExercise } = require("../lib/workout-exercise-catalog");
const { isExerciseLevelSuitable } = require("../lib/exercise-suitability");
const { normalizeEquipment } = require("../lib/workout-validator");
const { CANONICAL_EQUIPMENT_TOKENS } = require("../lib/workout-equipment-policy");
const { buildLocalWorkoutProgram, buildLocalExerciseReplacement } = require("../lib/local-demo-generators");
const { calculateNutritionTargets } = require("../lib/nutrition-targets");

test("every public exercise uses selectable canonical equipment", () => {
  const allowed = new Set(CANONICAL_EQUIPMENT_TOKENS);
  for (const id of getEnabledPublicExerciseIds()) {
    assert.ok(allowed.has(normalizeEquipment(getCatalogExercise(id).equipment)), `${id} equipment must be selectable`);
  }
});

test("advanced calisthenics gets an advanced progression while beginner remains prerequisite-safe", () => {
  const equipment = ["bodyweight", "pullupbar", "rings", "parallelbar"];
  const advanced = buildLocalWorkoutProgram({ experience: "advanced", trainingStyle: "calisthenics", equipment, daysPerWeek: 3, sessionDuration: 90 });
  const advancedIds = advanced.sessions.flatMap(session => session.exercises.map(exercise => exercise.exerciseId));
  assert.ok(advancedIds.some(id => ["front-lever", "muscle-up", "handstand-push-up", "dragon-flag", "typewriter-pull-ups"].includes(id)));
  const beginner = buildLocalWorkoutProgram({ experience: "beginner", trainingStyle: "calisthenics", equipment, daysPerWeek: 3, sessionDuration: 60 });
  for (const exercise of beginner.sessions.flatMap(session => session.exercises)) assert.equal(isExerciseLevelSuitable(exercise.exerciseId, "beginner"), true);
});

test("professional static skills use timed holds and sufficient rest", () => {
  const program = buildLocalWorkoutProgram({ experience: "professional", trainingStyle: "calisthenics", equipment: ["bodyweight", "pullupbar", "rings", "parallelbar"], daysPerWeek: 3, sessionDuration: 90 });
  const frontLever = program.sessions.flatMap(session => session.exercises).find(exercise => exercise.exerciseId === "front-lever");
  assert.ok(frontLever);
  assert.match(frontLever.reps, /sec/);
  assert.ok(frontLever.restSeconds >= 150);
});

test("advanced gym remains foundation-led rather than isolation-only", () => {
  const program = buildLocalWorkoutProgram({ experience: "advanced", trainingStyle: "gym", equipment: ["dumbbell", "barbell", "machine", "cable"], daysPerWeek: 3, sessionDuration: 75 });
  const ids = new Set(program.sessions.flatMap(session => session.exercises.map(exercise => exercise.exerciseId)));
  for (const id of ["barbell-bench-press", "barbell-row", "barbell-squat"]) assert.ok(ids.has(id), `${id} should remain available and preferred`);
});

test("workout reroll preserves level, equipment, target muscle and prescription fields", () => {
  const equipment = ["machine"];
  const currentExercise = { exerciseId: "machine-chest-press", muscleGroup: "chest", equipment: "Machine", sets: 4, reps: "6-10", restSeconds: 120, rir: "1-2", notes: "Keep shoulders controlled." };
  const replacement = buildLocalExerciseReplacement({ currentExercise, experience: "beginner", equipment });
  assert.ok(replacement);
  assert.equal(normalizeEquipment(replacement.equipment), "machine");
  assert.equal(isExerciseLevelSuitable(replacement.exerciseId, "beginner"), true);
  assert.equal(getCatalogExercise(replacement.exerciseId).setCredits.chest, 1);
  for (const key of ["sets", "reps", "restSeconds", "rir", "notes"]) assert.equal(replacement[key], currentExercise[key]);
});

test("canonical calorie targets preserve goal direction across deterministic profiles", () => {
  const profiles = [
    { age: 24, gender: "female", height: 160, weight: 52, activityLevel: "sedentary" },
    { age: 33, gender: "male", height: 181, weight: 84, activityLevel: "moderatelyActive" },
    { age: 68, gender: "female", height: 168, weight: 70, activityLevel: "lightlyActive" }
  ];
  for (const profile of profiles) {
    const loss = calculateNutritionTargets({ ...profile, goal: "loseFat" });
    const maintain = calculateNutritionTargets({ ...profile, goal: "maintainWeight" });
    const gain = calculateNutritionTargets({ ...profile, goal: "buildMuscle" });
    assert.ok(loss.dailyCalories < loss.tdee);
    assert.ok(Math.abs(maintain.dailyCalories - maintain.tdee) <= 25);
    assert.ok(gain.dailyCalories > gain.tdee);
  }
});

test("unsafe single-food AI reroll is retired in favor of catalog meal reroll", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const route = source.slice(source.indexOf('app.post("/api/nutrition-builder/reroll-food"'), source.indexOf('// Swaps one whole meal option'));
  assert.match(route, /status\(410\)/);
  assert.match(route, /reroll-meal/);
  assert.doesNotMatch(route, /createChatCompletion|console\.log/);
});
