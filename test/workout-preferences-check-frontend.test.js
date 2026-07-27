// Tests the browser-side wizard preflight mirror (public/js/workout-
// preferences-check.mjs) directly — pure, DOM-free, importable in Node.
// This is a UX-only convenience check; the server's
// lib/workout-preferences-validator.js (tested in
// test/workout-phase2-compatibility.test.js) is the authoritative source
// of truth and is what actually blocks incompatible requests.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const MODULE_PATH = path.join(__dirname, "..", "public", "js", "workout-preferences-check.mjs");
let mod;

test.before(async () => {
  mod = await import(`file://${MODULE_PATH.replace(/\\/g, "/")}`);
});

test("blocks calisthenics skills with no hanging apparatus (English)", () => {
  const result = mod.checkWorkoutPreferences({ goal: "improveSkills", trainingStyle: "calisthenics", equipment: ["dumbbell"], daysPerWeek: 4, language: "en" });
  assert.equal(result.valid, false);
  assert.ok(!/[֐-׿]/.test(result.errors[0]));
});

test("blocks calisthenics skills with no hanging apparatus (Hebrew)", () => {
  const result = mod.checkWorkoutPreferences({ goal: "improveSkills", trainingStyle: "calisthenics", equipment: ["dumbbell"], daysPerWeek: 4, language: "he" });
  assert.equal(result.valid, false);
  assert.ok(/[֐-׿]/.test(result.errors[0]));
});

test("rings or pull-up bar alone is sufficient", () => {
  assert.equal(mod.checkWorkoutPreferences({ goal: "improveSkills", trainingStyle: "calisthenics", equipment: ["rings"], daysPerWeek: 4, language: "en" }).valid, true);
  assert.equal(mod.checkWorkoutPreferences({ goal: "improveSkills", trainingStyle: "calisthenics", equipment: ["pullupbar"], daysPerWeek: 4, language: "en" }).valid, true);
});

test("floorSkillsOnly bypasses the block", () => {
  const result = mod.checkWorkoutPreferences({ goal: "improveSkills", trainingStyle: "calisthenics", equipment: ["dumbbell"], daysPerWeek: 4, floorSkillsOnly: true, language: "en" });
  assert.equal(result.valid, true);
});

test("7 days produces a warning, not a block", () => {
  const result = mod.checkWorkoutPreferences({ goal: "increaseStrength", trainingStyle: "gym", equipment: ["barbell"], daysPerWeek: 7, language: "en" });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.length > 0);
});

test("a compatible gym request produces neither errors nor warnings", () => {
  const result = mod.checkWorkoutPreferences({ goal: "buildMuscle", trainingStyle: "gym", equipment: ["dumbbell", "machine"], daysPerWeek: 3, language: "en" });
  assert.equal(result.valid, true);
  assert.equal(result.warnings.length, 0);
});
