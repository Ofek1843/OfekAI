"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { getMealById } = require("../lib/meal-catalog");
const { buildLocalWorkoutProgram } = require("../lib/local-demo-generators");
const { getCatalogExercise } = require("../lib/workout-exercise-catalog");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const IsraeliMealIds = [
  "israeli-breakfast-plate",
  "chicken-shawarma-rice-box",
  "tuna-pita-salad-box",
  "labneh-egg-pita",
  "cottage-rice-cakes-vegetables",
  "ready-chicken-hummus-salad"
];

test("Israeli supermarket meals have localized copy, practical metadata and local images", () => {
  for (const id of IsraeliMealIds) {
    const meal = getMealById(id);
    assert.ok(meal, id);
    assert.notEqual(meal.en, meal.he, `${id} needs Hebrew copy`);
    assert.ok(meal.foodStyles.includes("supermarket"), `${id} must be supermarket discoverable`);
    assert.ok(fs.existsSync(path.join(PUBLIC, meal.image.replace(/^\//, ""))), `${id} image is missing`);
  }
});

test("professional calisthenics local plans prioritize elite skills", () => {
  const program = buildLocalWorkoutProgram({
    goal: "buildMuscle",
    experience: "professional",
    daysPerWeek: 3,
    sessionDuration: 90,
    equipment: ["Bodyweight", "Pull-up Bar"],
    trainingStyle: "calisthenics"
  });
  const ids = new Set(program.sessions.flatMap(session => session.exercises.map(exercise => exercise.exerciseId)));
  assert.ok(ids.has("planche"), "professional calisthenics should expose planche work");
  assert.ok(ids.has("front-lever"), "professional calisthenics should expose front-lever work");
  assert.ok(ids.has("one-arm-pull-up"), "professional calisthenics should retain one-arm pull-up work");
});

test("elite skill catalog entries resolve to dedicated public media", () => {
  for (const id of ["planche", "front-lever"]) {
    const entry = getCatalogExercise(id);
    assert.ok(entry?.publicGeneration, id);
    assert.ok(fs.existsSync(path.join(PUBLIC, "images", "exercises", entry.image)), entry.image);
  }
});
