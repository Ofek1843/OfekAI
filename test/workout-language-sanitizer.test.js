// Live testing (gpt-4.1-mini, English-mode request) surfaced Hebrew text
// leaking into program.programName and exercise.notes — sanitizeLanguageLeakage
// covered session.name/exercise.equipment/exercise.muscleGroup/exercise.name
// but not those two fields, so a program requested in English could still
// show the user a fully Hebrew title and Hebrew coaching notes.

const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeLanguageLeakage, HEBREW_CHAR_RANGE } = require("../lib/workout-language-sanitizer");

function baseProgram(overrides = {}) {
  return {
    programName: "Skill Improvement Program",
    sessions: [
      {
        name: "Day 1",
        exercises: [
          {
            name: "Push-up",
            demoName: "Push-up",
            equipment: "Bodyweight",
            muscleGroup: "Chest",
            notes: "Keep your body straight."
          }
        ]
      }
    ],
    ...overrides
  };
}

test("sanitizeLanguageLeakage replaces a Hebrew programName with a generic English title", () => {
  const program = baseProgram({ programName: "שיפור מיומנויות - מתחילים" });
  sanitizeLanguageLeakage(program);
  assert.equal(HEBREW_CHAR_RANGE.test(program.programName), false);
  assert.equal(program.programName, "Workout Program");
});

test("sanitizeLanguageLeakage clears Hebrew exercise notes instead of leaving them untranslated", () => {
  const program = baseProgram();
  program.sessions[0].exercises[0].notes =
    "שמור על גוף ישר מהברכיים עד הראש. התקדמות: הוסף חזרות.";
  sanitizeLanguageLeakage(program);
  assert.equal(program.sessions[0].exercises[0].notes, "");
});

test("sanitizeLanguageLeakage leaves already-English programName and notes untouched", () => {
  const program = baseProgram();
  sanitizeLanguageLeakage(program);
  assert.equal(program.programName, "Skill Improvement Program");
  assert.equal(program.sessions[0].exercises[0].notes, "Keep your body straight.");
});

test("sanitizeLanguageLeakage still replaces Hebrew session names and equipment/muscle labels", () => {
  const program = baseProgram();
  program.sessions[0].name = "יום 1";
  program.sessions[0].exercises[0].equipment = "משקל גוף";
  program.sessions[0].exercises[0].muscleGroup = "חזה";
  sanitizeLanguageLeakage(program);
  assert.equal(program.sessions[0].name, "Day 1");
  assert.equal(program.sessions[0].exercises[0].equipment, "Bodyweight");
  assert.equal(program.sessions[0].exercises[0].muscleGroup, "Chest");
});

test("sanitizeLanguageLeakage replaces a Hebrew program.goal with the correct English label for the requested goal", () => {
  const program = baseProgram({ goal: "שיפור מיומנויות" });
  sanitizeLanguageLeakage(program, "improveSkills");
  assert.equal(program.goal, "Improve Calisthenics Skills");
});

test("sanitizeLanguageLeakage falls back to a generic goal label when the requested goal slug is unknown", () => {
  const program = baseProgram({ goal: "שיפור מיומנויות" });
  sanitizeLanguageLeakage(program, "");
  assert.equal(program.goal, "Workout Goal");
});

test("sanitizeLanguageLeakage translates a Hebrew unit word inside a duration-based reps string, keeping the numeric range", () => {
  const program = baseProgram();
  program.sessions[0].exercises[0].reps = "30-45 שניות";
  sanitizeLanguageLeakage(program);
  assert.equal(program.sessions[0].exercises[0].reps, "30-45 seconds");
});
