"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { adjustWorkoutVolume, MAX_WORKING_SETS_PER_EXERCISE } = require("../lib/workout-volume-adjustment");
const { validateWorkoutProgram } = require("../lib/workout-validator");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const profile = {
  equipment: ["barbell", "dumbbell", "cable"],
  experience: "intermediate",
  priority: "hypertrophy",
  daysPerWeek: 1,
  sessionDuration: 75
};

function exercise(overrides = {}) {
  return {
    exerciseId: "barbell-bench-press",
    name: "Barbell Bench Press",
    demoName: "Barbell Bench Press",
    muscleGroup: "Chest",
    equipment: "Barbell",
    sets: 3,
    reps: "8-12",
    restSeconds: 90,
    rir: "1-3",
    notes: "",
    ...overrides
  };
}

function program(exercises = [exercise()]) {
  return { daysPerWeek: 1, sessions: [{ day: 1, name: "Day 1", exercises }] };
}

test("weekly volume add changes the program and never exceeds four working sets", () => {
  const result = adjustWorkoutVolume({ program: program(), muscle: "chest", delta: 1, profile });
  assert.equal(result.changed, true);
  assert.equal(result.change.action, "added-set");
  assert.equal(result.change.day, 1);
  assert.equal(result.program.sessions[0].exercises[0].sets, 4);
  assert.ok(result.program.sessions.flatMap((session) => session.exercises).every((item) => item.sets <= MAX_WORKING_SETS_PER_EXERCISE));
});

test("weekly volume add creates a compatible supplementary exercise once a direct movement is capped", () => {
  const result = adjustWorkoutVolume({
    program: program([exercise({ sets: 4 })]), muscle: "chest", delta: 1, profile
  });
  assert.equal(result.changed, true);
  assert.equal(result.change.action, "added-exercise");
  assert.equal(result.program.sessions[0].exercises.length, 2);
  assert.equal(result.program.sessions[0].exercises[1].sets, 2);
  assert.notEqual(result.program.sessions[0].exercises[1].exerciseId, "barbell-bench-press");
  assert.ok(["Barbell", "Dumbbell", "Cable"].includes(result.program.sessions[0].exercises[1].equipment));
});

test("weekly volume reduction removes accessory work before reducing a compound", () => {
  const result = adjustWorkoutVolume({
    program: program([
      exercise({ sets: 4 }),
      exercise({
        exerciseId: "cable-chest-fly", name: "Cable Chest Fly", demoName: "Cable Chest Fly",
        muscleGroup: "Chest", equipment: "Cable", sets: 2
      })
    ]),
    muscle: "chest", delta: -1, profile
  });
  assert.equal(result.changed, true);
  assert.equal(result.change.action, "removed-exercise");
  assert.equal(result.change.exerciseName, "Cable Chest Fly");
  assert.equal(result.program.sessions[0].exercises.length, 1);
  assert.equal(result.program.sessions[0].exercises[0].exerciseId, "barbell-bench-press");
});

test("validator enforces the universal four-working-set ceiling", () => {
  const result = validateWorkoutProgram(program([exercise({ sets: 5 })]), {
    daysPerWeek: 1,
    equipment: ["barbell"],
    sessionDuration: 75
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((message) => message.includes("between 1 and 4")));
});

test("targeted builder UX uses anatomy visuals, a real mutation endpoint, optional workout context and a simplified meal choice", () => {
  const workoutMarkup = read("public/workout-builder.html");
  const workoutClient = read("public/js/workout-builder.js");
  const nutritionMarkup = read("public/nutrition-builder.html");
  const nutritionClient = read("public/js/nutrition-builder.js");
  const server = read("server.js");
  const theme = read("public/css/v45-deep-ocean.css");

  assert.match(workoutMarkup, /name="gender"/);
  assert.match(workoutClient, /\/api\/workout-builder\/adjust-volume/);
  assert.match(workoutClient, /muscleAnatomySvg/);
  assert.doesNotMatch(workoutClient, /MUSCLE_VOLUME_IMAGES/);
  assert.match(server, /app\.post\("\/api\/workout-builder\/adjust-volume"/);
  assert.match(nutritionMarkup, /name="mealFormatPreference"/);
  assert.doesNotMatch(nutritionMarkup, /name="prepTimePreference"/);
  assert.doesNotMatch(nutritionMarkup, /name="foodStylePreference"/);
  assert.match(nutritionClient, /foodStylePreference: "mix"/);
  assert.match(theme, /html\[data-theme="light"\] body\.fp-v45-deep-ocean/);
  assert.match(theme, /--v45-ocean-deep: #f7fbff/);
});
