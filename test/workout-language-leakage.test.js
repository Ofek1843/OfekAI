// Release regression tests for Workout Builder language leakage.
//
// Reported bug: an English-mode generation rendered Hebrew in the program
// title, the goal, exercise notes and rep ranges, the header printed
// "FUELPHYSIQUE FUELPHYSIQUE PERSONALIZED PLAN", and the English description
// repeated its own closing clause.
//
// Causes:
//   - sanitizeLanguageLeakage covered session.name/equipment/muscleGroup/name
//     but not programName, goal, notes, or Hebrew unit words inside reps.
//   - The result header prefixed the brand onto a label that already
//     contained it, in both locales.
//   - The description appended a hardcoded English clause after an
//     already-complete sentence -- which also injected English into Hebrew.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  GOAL_LABELS,
  HEBREW_CHAR_RANGE,
  findLanguageLeaks,
  sanitizeLanguageLeakage
} = require("../lib/workout-language-sanitizer");

const BUILDER_JS = fs.readFileSync(
  path.join(__dirname, "..", "public", "js", "workout-builder.js"),
  "utf8"
);

function englishProgram(overrides = {}) {
  return {
    programName: "Skill Improvement Program",
    goal: "Improve Calisthenics Skills",
    sessions: [
      {
        name: "Day 1",
        exercises: [
          {
            exerciseId: "push-up",
            name: "Push-up",
            demoName: "Push-up",
            equipment: "Bodyweight",
            muscleGroup: "Chest",
            reps: "8-12",
            notes: "Keep your body straight."
          }
        ]
      }
    ],
    ...overrides
  };
}

// ------------------------------------------------- fields that were missing

test("a Hebrew programName is replaced in an English program", () => {
  const program = englishProgram({ programName: "שיפור מיומנויות - מתחילים" });
  sanitizeLanguageLeakage(program, "improveSkills");
  assert.equal(HEBREW_CHAR_RANGE.test(program.programName), false);
  assert.equal(program.programName, "Workout Program");
});

test("a Hebrew goal is rebuilt from the submitted goal slug, not guessed", () => {
  for (const [slug, label] of Object.entries(GOAL_LABELS)) {
    const program = englishProgram({ goal: "שיפור מיומנויות" });
    sanitizeLanguageLeakage(program, slug);
    assert.equal(program.goal, label, `goal slug ${slug} must map to its English label`);
  }
});

test("an unknown goal slug falls back to a neutral English label rather than leaking Hebrew", () => {
  const program = englishProgram({ goal: "שיפור מיומנויות" });
  sanitizeLanguageLeakage(program, "");
  assert.equal(program.goal, "Workout Goal");
  assert.equal(HEBREW_CHAR_RANGE.test(program.goal), false);
});

test("Hebrew coaching notes are cleared instead of being shown untranslated", () => {
  const program = englishProgram();
  program.sessions[0].exercises[0].notes = "שמור על גוף ישר מהברכיים עד הראש.";
  sanitizeLanguageLeakage(program, "buildMuscle");
  assert.equal(program.sessions[0].exercises[0].notes, "");
});

test("Hebrew unit words inside reps are translated, keeping the numeric range", () => {
  const cases = [
    ["30-45 שניות", "30-45 seconds"],
    ["20-30 שניות לכל צד", "20-30 seconds per side"],
    ["12 חזרות", "12 reps"]
  ];
  for (const [input, expected] of cases) {
    const program = englishProgram();
    program.sessions[0].exercises[0].reps = input;
    sanitizeLanguageLeakage(program, "buildMuscle");
    assert.equal(program.sessions[0].exercises[0].reps, expected);
  }
});

test("Hebrew equipment and muscle labels still canonicalize to English", () => {
  const program = englishProgram();
  program.sessions[0].name = "יום 1";
  program.sessions[0].exercises[0].equipment = "משקל גוף";
  program.sessions[0].exercises[0].muscleGroup = "כל הגוף";
  sanitizeLanguageLeakage(program, "buildMuscle");
  assert.equal(program.sessions[0].name, "Day 1");
  assert.equal(program.sessions[0].exercises[0].equipment, "Bodyweight");
  assert.equal(program.sessions[0].exercises[0].muscleGroup, "Full Body");
});

test("an already-English program is left completely untouched", () => {
  const program = englishProgram();
  const before = JSON.stringify(program);
  sanitizeLanguageLeakage(program, "improveSkills");
  assert.equal(JSON.stringify(program), before);
});

// --------------------------------------------------------- leak detection

test("findLanguageLeaks reports every Hebrew field in an English program", () => {
  const program = englishProgram({
    programName: "תוכנית",
    goal: "שיפור מיומנויות"
  });
  program.sessions[0].exercises[0].notes = "שמור על גוף ישר";
  const leaks = findLanguageLeaks(program, "en");
  const paths = leaks.map(l => l.path);
  assert.ok(paths.includes("programName"));
  assert.ok(paths.includes("goal"));
  assert.ok(paths.includes("sessions[0].exercises[0].notes"));
});

test("findLanguageLeaks reports nothing once the sanitizer has run", () => {
  const program = englishProgram({ programName: "תוכנית", goal: "שיפור מיומנויות" });
  program.sessions[0].exercises[0].notes = "שמור על גוף ישר";
  program.sessions[0].exercises[0].reps = "30 שניות";
  sanitizeLanguageLeakage(program, "improveSkills");
  assert.deepEqual(findLanguageLeaks(program, "en"), []);
});

test("findLanguageLeaks does not flag FuelPhysique or RIR as leakage in Hebrew mode", () => {
  const hebrewProgram = {
    programName: "תוכנית אישית של FuelPhysique",
    goal: "בניית שריר",
    sessions: [
      {
        name: "יום 1",
        exercises: [
          {
            name: "שכיבות סמיכה",
            equipment: "משקל גוף",
            muscleGroup: "חזה",
            reps: "8-12",
            notes: "שמור על RIR 2"
          }
        ]
      }
    ]
  };
  assert.deepEqual(findLanguageLeaks(hebrewProgram, "he"), []);
});

// ------------------------------------------------- duplicated result copy

test("the result header prints the brand once, not twice", () => {
  assert.doesNotMatch(
    BUILDER_JS,
    /FuelPhysique \$\{ui\.personalizedPlan\}/,
    'the eyebrow must not prefix the brand onto a label that already contains it'
  );
  assert.match(BUILDER_JS, /\$\{ui\.personalizedPlan\}/, "the localized label must still be rendered");
});

test("the program description is not followed by a duplicated English clause", () => {
  assert.doesNotMatch(
    BUILDER_JS,
    /\$\{ui\.programDescription\}\s*\n\s*around your goal, experience and available equipment\./,
    "the hardcoded clause repeated the sentence in English and injected English into Hebrew"
  );
});

test("both locales supply a complete, self-contained description sentence", () => {
  // Each description must already end the sentence on its own, so nothing
  // needs appending in the template.
  const matches = [...BUILDER_JS.matchAll(/programDescription:\s*\n?\s*"([^"]+)"/g)].map(m => m[1]);
  assert.equal(matches.length, 2, "expected an English and a Hebrew description");
  for (const sentence of matches) {
    assert.match(sentence, /[.。]$/, `description should be a complete sentence: "${sentence}"`);
  }
});

test("the Hebrew label set contains no leftover English prose", () => {
  const hebrewBlock = BUILDER_JS.slice(
    BUILDER_JS.indexOf('personalizedPlan: "תוכנית אישית של FuelPhysique"'),
    BUILDER_JS.indexOf('personalizedPlan: "FuelPhysique Personalized Plan"')
  );
  assert.ok(hebrewBlock.length > 0, "could not isolate the Hebrew label block");
  assert.doesNotMatch(
    hebrewBlock,
    /around your goal, experience and available equipment/,
    "English prose must not appear inside the Hebrew label set"
  );
});
