const test = require("node:test");
const assert = require("node:assert/strict");
const { translateValidationMessage, translateValidationMessages } = require("../lib/workout-validation-i18n");

const HEBREW_RANGE = /[֐-׿]/;

test("English language leaves messages unchanged", () => {
  const message = 'Session 1: exercise "Push-up" is missing exerciseId.';
  assert.equal(translateValidationMessage(message, "en"), message);
});

test("Hebrew language translates the missing-exerciseId message and keeps it Hebrew-only aside from the exercise name", () => {
  const translated = translateValidationMessage('Session 1: exercise "Push-up" is missing exerciseId.', "he");
  assert.ok(HEBREW_RANGE.test(translated), `Expected Hebrew output: "${translated}"`);
  assert.ok(translated.includes("1"));
});

test("Hebrew translates every distinct message template used by validateWorkoutProgram", () => {
  const samples = [
    "Program has no sessions array.",
    "Program contains 2 sessions, but user requested 3.",
    "Program schedules 2 days, but user requested 3 training days.",
    "Day 1 is scheduled more than once in weeklyScheduleDays.",
    "Session scheduled for day 2, which is not in the user's available days.",
    'Barbell Row (Session 1) requires "barbell", which is not selected.',
    "Squat (Session 1) has no recognizable equipment value.",
    "Session 1 has no exercises array.",
    "Session 1: unnamed exercise detected.",
    "Session 1 estimated at 70min, exceeds 60min limit by 10min.",
    'Deadlift (Session 1): 3 reps requires ≥180s rest, has 90s.',
    'Curl (Session 1): RIR "abc" is not a valid number or range.',
    'Session 1: "push-up" appears more than once.',
    "Session 1: name must be a string.",
    "Session 1: must have at least one exercise.",
    "Session 1: exercise must have a non-empty name.",
    'Session 1: exercise "Push-up" is missing exerciseId.',
    "Session 1: sets must be 1-20.",
    "Session 1: rest must be ≥15 seconds.",
    "Session 1: chest receives 12 hard sets; consider distributing.",
    'Curl (Session 1): 3 reps is outside typical hypertrophy range (5-30).'
  ];

  for (const message of samples) {
    const translated = translateValidationMessage(message, "he");
    assert.notEqual(translated, message, `Expected a Hebrew translation for: "${message}"`);
    assert.ok(HEBREW_RANGE.test(translated), `Translation should contain Hebrew characters: "${translated}"`);
  }
});

test("translateValidationMessages translates an array and preserves order", () => {
  const messages = [
    "Session 1: sets must be 1-20.",
    "Session 2: rest must be ≥15 seconds."
  ];
  const translated = translateValidationMessages(messages, "he");
  assert.equal(translated.length, 2);
  assert.ok(HEBREW_RANGE.test(translated[0]));
  assert.ok(HEBREW_RANGE.test(translated[1]));
});

test("An unrecognized message shape is returned unchanged rather than hidden", () => {
  const message = "Some completely unexpected validator message that matches no template.";
  assert.equal(translateValidationMessage(message, "he"), message);
});

test("translateValidationMessages handles an empty/undefined list", () => {
  assert.deepEqual(translateValidationMessages([], "he"), []);
  assert.deepEqual(translateValidationMessages(undefined, "he"), []);
});
