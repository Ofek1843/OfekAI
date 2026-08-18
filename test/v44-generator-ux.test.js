const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PUBLIC = path.join(__dirname, "..", "public");
const read = (file) => fs.readFileSync(path.join(PUBLIC, file), "utf8");

test("V4.4 nutrition practicality controls are first-class, localized form inputs", () => {
  const markup = read("nutrition-builder.html");
  const client = read("js/nutrition-builder.js");
  assert.match(markup, /name="mealFormatPreference"/);
  assert.match(markup, /name="prepTimePreference"/);
  assert.match(markup, /name="foodStylePreference"/);
  assert.match(markup, /data-he="איך נוח לך לאכול ביום־יום\?"/);
  assert.match(client, /mealFormatPreference: formData\.get/);
  assert.match(client, /meal-format-badge/);
  assert.match(client, /\[data-en\]\[data-he\]/);
});

test("V4.4 keeps goal cards equivalent and makes both replacement controls discoverable", () => {
  const workoutMarkup = read("workout-builder.html");
  const workoutClient = read("js/workout-builder.js");
  const nutritionClient = read("js/nutrition-builder.js");
  assert.doesNotMatch(workoutMarkup, /visual-choice-card--goal-performance visual-choice-card--wide/);
  assert.match(workoutClient, />\$\{isHebrew \? "החלפה" : "Replace"\}<\/button>/);
  assert.match(workoutClient, /\/api\/workout-builder\/reroll-exercise/);
  assert.match(workoutClient, /if \(!response\.ok \|\| !data\.exercise\)/);
  assert.match(workoutClient, /window\.currentWorkoutProgram\.sessions\[sessionIndex\]\.exercises\[exerciseIndex\]\s*=\s*data\.exercise/);
  assert.match(nutritionClient, /"Replace meal"/);
  assert.match(nutritionClient, /reroll-meal/);
});
