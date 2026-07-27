// Regression tests for Phase 2: equipment capability model, wizard
// compatibility preflight, and prescription-type-aware validation.
//
// Each "CASE" fixture is a hand-built reconstruction of the AI response
// shape described in the production report for that case (we cannot call
// the real OpenAI API from an automated, offline test suite — see
// test/workout-repair.test.js for the pattern of using a captured real
// response as a fixture; these fixtures follow the same approach, built
// from the exact exercise names/fields described in the case reports).

const test = require("node:test");
const assert = require("node:assert/strict");
const { repairWorkoutProgram, collapseRepeatedPhrase, resolveGenericAlternativeName, classifyPrescriptionType } = require("../lib/workout-repair");
const { validateWorkoutProgram } = require("../lib/workout-validator");
const { validateWorkoutPreferences } = require("../lib/workout-preferences-validator");
const { hasCapability, getAvailableCapabilities } = require("../lib/workout-capabilities");
const { hasUnresolvedAlternative } = require("../lib/workout-movement-catalog");

const HEBREW_RANGE = /[֐-׿]/;

function exercise(overrides) {
  return {
    name: "Placeholder",
    demoName: "Placeholder",
    muscleGroup: "Chest",
    equipment: "Bodyweight",
    sets: 3,
    reps: "8-12",
    restSeconds: 90,
    rir: "1-3",
    notes: "",
    ...overrides
  };
}

// --- CASE 1: positive baseline, 2-day full body, must stay valid ----------

test("CASE 1: beginner fat-loss/hypertrophy 2-day full body with machines/rings/dumbbells is valid", () => {
  const program = {
    programName: "2-Day Full Body Foundations",
    daysPerWeek: 2,
    durationWeeks: 8,
    goal: "Lose fat while building muscle",
    weeklyScheduleDays: [1, 4],
    sessions: [
      {
        name: "Full Body A",
        exercises: [
          exercise({ name: "Machine Chest Press", equipment: "Machine", muscleGroup: "Chest" }),
          exercise({ name: "Machine Row", equipment: "Machine", muscleGroup: "Back" }),
          exercise({ name: "Dumbbell Goblet Squat", equipment: "Dumbbell", muscleGroup: "Quads" }),
          exercise({ name: "Leg Curl Machine", equipment: "Machine", muscleGroup: "Hamstrings" }),
          exercise({ name: "Dumbbell Shoulder Press", equipment: "Dumbbell", muscleGroup: "Shoulders" }),
          exercise({ name: "Ring Row", equipment: "Rings", muscleGroup: "Back" }),
          exercise({ name: "Plank", equipment: "Bodyweight", muscleGroup: "Core", reps: "30-45 sec" })
        ]
      },
      {
        name: "Full Body B",
        exercises: [
          exercise({ name: "Machine Chest Press", equipment: "Machine", muscleGroup: "Chest" }),
          exercise({ name: "Machine Row", equipment: "Machine", muscleGroup: "Back" }),
          exercise({ name: "Dumbbell Goblet Squat", equipment: "Dumbbell", muscleGroup: "Quads" }),
          exercise({ name: "Leg Curl Machine", equipment: "Machine", muscleGroup: "Hamstrings" }),
          exercise({ name: "Dumbbell Shoulder Press", equipment: "Dumbbell", muscleGroup: "Shoulders" }),
          exercise({ name: "Ring Row", equipment: "Rings", muscleGroup: "Back" }),
          exercise({ name: "Plank", equipment: "Bodyweight", muscleGroup: "Core", reps: "30-45 sec" })
        ]
      }
    ]
  };

  const context = {
    equipment: ["bodyweight", "rings", "dumbbell", "machine"],
    daysPerWeek: 2,
    sessionDuration: 45
  };

  const preferenceCheck = validateWorkoutPreferences({
    goal: "loseFat",
    trainingStyle: "gym",
    equipment: context.equipment,
    daysPerWeek: context.daysPerWeek,
    language: "en"
  });
  assert.equal(preferenceCheck.valid, true, "A simple, reasonable full-body plan must not be blocked at the wizard step");

  repairWorkoutProgram(program, { sessionDuration: 45, equipment: context.equipment });
  const validation = validateWorkoutProgram(program, {
    daysPerWeek: 2,
    sessionDuration: 45,
    equipment: context.equipment,
    availableDayIndexes: [1, 4],
    goalProfile: "hypertrophy"
  });

  assert.equal(validation.ok, true, `Must not be rejected for being simple. Errors: ${JSON.stringify(validation.errors)}`);
});

test("CASE 1: duplicated branding/description text is collapsed", () => {
  assert.equal(collapseRepeatedPhrase("FuelPhysique FuelPhysique Personalized Plan"), "FuelPhysique Personalized Plan");
  assert.equal(
    collapseRepeatedPhrase("built around your goal, experience and available equipment. around your goal, experience and available equipment."),
    "built around your goal, experience and available equipment."
  );
});

test("CASE 1: workout-builder.js no longer hardcodes a redundant FuelPhysique prefix or duplicated description suffix", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "js", "workout-builder.js"), "utf8");

  assert.ok(!/FuelPhysique \$\{ui\.personalizedPlan\}/.test(source), "Must not prefix ui.personalizedPlan (which already includes the brand name) with a static 'FuelPhysique '");
  assert.ok(!/around your goal, experience and available equipment\.\s*<\/p>/.test(source) || !source.includes('${ui.programDescription}\n            around your goal'), "Must not append a hardcoded English sentence fragment after ui.programDescription");
});

// --- CASE 2: rings selected, no pull-up bar, 7 days, advanced strength ----

test("CASE 2: rings-only hanging movements resolve to concrete ring variants, no false equipment errors", () => {
  const program = {
    programName: "7-Day Advanced Strength",
    daysPerWeek: 7,
    durationWeeks: 8,
    goal: "Increase strength",
    weeklyScheduleDays: [0, 1, 2, 3, 4, 5, 6],
    sessions: Array.from({ length: 7 }, (_, i) => ({
      name: `Day ${i + 1}`,
      exercises: [
        exercise({ name: "Weighted Pull-up", equipment: "Pull-up Bar", muscleGroup: "Back", reps: "5", restSeconds: 180 }),
        exercise({ name: "One-Arm Pull-up Practice", equipment: "Pull-up Bar", muscleGroup: "Back", reps: "3", restSeconds: 180 }),
        exercise({ name: "Front Lever Hold Practice", equipment: "Pull-up Bar", muscleGroup: "Back", reps: "10" }),
        exercise({ name: "Hanging Leg Raise", equipment: "Pull-up Bar", muscleGroup: "Core", reps: "10-15" }),
        exercise({ name: "Scapular Pull-up", equipment: "Pull-up Bar", muscleGroup: "Back", reps: "8-10" })
      ]
    }))
  };

  const equipment = ["bodyweight", "rings", "dumbbell", "barbell"]; // no pullupbar
  repairWorkoutProgram(program, { sessionDuration: 60, equipment });

  const validation = validateWorkoutProgram(program, {
    daysPerWeek: 7,
    sessionDuration: 60,
    equipment,
    availableDayIndexes: [0, 1, 2, 3, 4, 5, 6],
    goalProfile: "strength"
  });

  assert.ok(
    !validation.errors.some((e) => e.includes("Pull-up Bar")),
    `Must not falsely require Pull-up Bar when rings are selected. Errors: ${JSON.stringify(validation.errors)}`
  );
  assert.equal(validation.ok, true, `Errors: ${JSON.stringify(validation.errors)}`);

  const names = program.sessions[0].exercises.map((e) => e.name);
  assert.ok(names.includes("Weighted Ring Pull-up"));
  assert.ok(names.includes("One-Arm Ring Pull-up Practice"));
  assert.ok(names.includes("Front Lever Hold on Rings"));
  assert.ok(names.includes("Hanging Leg Raise on Rings"));
  assert.ok(names.includes("Ring Scapular Pull"));

  for (const ex of program.sessions[0].exercises) {
    assert.equal(ex.equipment, "rings");
    assert.equal(hasUnresolvedAlternative(ex.name), false, `"${ex.name}" must not contain an unresolved alternative`);
  }
});

test("CASE 2: 7 training days produces a warning, not a hard failure", () => {
  const result = validateWorkoutPreferences({
    goal: "increaseStrength",
    trainingStyle: "gym",
    equipment: ["bodyweight", "rings", "dumbbell", "barbell"],
    daysPerWeek: 7,
    language: "en"
  });

  assert.equal(result.valid, true, "7 days must never be a hard block");
  assert.ok(result.warnings.some((w) => w.includes("Seven")), "Should warn about recovery");
});

// --- CASE 3: calisthenics skills with unsuitable equipment (blocked pre-AI) --

test("CASE 3: calisthenics skills + only dumbbells/barbell/machines is blocked before generation (English)", () => {
  const result = validateWorkoutPreferences({
    goal: "improveSkills",
    trainingStyle: "calisthenics",
    equipment: ["dumbbell", "barbell", "machine"],
    daysPerWeek: 4,
    language: "en"
  });

  assert.equal(result.valid, false);
  assert.ok(result.fieldErrors.equipment.length > 0);
  assert.ok(!HEBREW_RANGE.test(result.errors[0]), "English message must not contain Hebrew");
  assert.ok(result.suggestedChanges.some((s) => s.value === "pullupbar"));
  assert.ok(result.suggestedChanges.some((s) => s.value === "rings"));
  assert.ok(result.suggestedChanges.some((s) => s.field === "floorSkillsOnly"));
});

test("CASE 3: calisthenics skills + only dumbbells/barbell/machines is blocked before generation (Hebrew)", () => {
  const result = validateWorkoutPreferences({
    goal: "improveSkills",
    trainingStyle: "calisthenics",
    equipment: ["dumbbell", "barbell", "machine"],
    daysPerWeek: 4,
    language: "he"
  });

  assert.equal(result.valid, false);
  assert.ok(HEBREW_RANGE.test(result.errors[0]), "Hebrew message must contain Hebrew");
});

test("CASE 3: Floor Skills Only opts out of the hanging-apparatus requirement", () => {
  const result = validateWorkoutPreferences({
    goal: "improveSkills",
    trainingStyle: "calisthenics",
    equipment: ["dumbbell", "barbell", "machine"],
    daysPerWeek: 4,
    floorSkillsOnly: true,
    language: "en"
  });

  assert.equal(result.valid, true, "Floor Skills Only must bypass the hanging-apparatus block");
});

test("CASE 3: rings or pull-up bar alone satisfies the calisthenics-skills requirement", () => {
  const withRings = validateWorkoutPreferences({ goal: "improveSkills", trainingStyle: "calisthenics", equipment: ["rings"], daysPerWeek: 4, language: "en" });
  const withBar = validateWorkoutPreferences({ goal: "improveSkills", trainingStyle: "calisthenics", equipment: ["pullupbar"], daysPerWeek: 4, language: "en" });
  assert.equal(withRings.valid, true);
  assert.equal(withBar.valid, true);
});

// --- CASE 4: hybrid maintenance with rings ---------------------------------

test("CASE 4: no unresolved 'A or B' exercise names, conditioning uses its own schema", () => {
  const program = {
    programName: "4-Day Hybrid Maintenance",
    daysPerWeek: 4,
    durationWeeks: 8,
    goal: "Maintain performance",
    weeklyScheduleDays: [0, 2, 4, 6],
    sessions: [
      {
        name: "Day 1",
        exercises: [
          exercise({ name: "Pull-up (Rings or Bar)", equipment: "Pull-up Bar", muscleGroup: "Back", reps: "6-10" }),
          exercise({ name: "Hanging Leg Raise (Rings or Bar)", equipment: "Pull-up Bar", muscleGroup: "Core", reps: "10-15" }),
          exercise({
            name: "Rowing Machine or 10-min Cardio Circuit",
            equipment: "Machine",
            muscleGroup: "Conditioning",
            sets: 1,
            reps: "10 min",
            restSeconds: 0,
            rir: "NA"
          }),
          exercise({ name: "Dumbbell Bench Press", equipment: "Dumbbell", muscleGroup: "Chest" })
        ]
      },
      { name: "Day 2", exercises: [exercise({ name: "Barbell Squat", equipment: "Barbell", muscleGroup: "Quads" }), exercise({ name: "Barbell Row", equipment: "Barbell", muscleGroup: "Back" }), exercise({ name: "Dumbbell Curl", equipment: "Dumbbell", muscleGroup: "Biceps" })] },
      { name: "Day 3", exercises: [exercise({ name: "Machine Chest Press", equipment: "Machine", muscleGroup: "Chest" }), exercise({ name: "Machine Row", equipment: "Machine", muscleGroup: "Back" }), exercise({ name: "Plank", equipment: "Bodyweight", muscleGroup: "Core", reps: "30-45 sec" })] },
      { name: "Day 4", exercises: [exercise({ name: "Ring Dip", equipment: "Rings", muscleGroup: "Chest" }), exercise({ name: "Dumbbell Lunge", equipment: "Dumbbell", muscleGroup: "Quads" }), exercise({ name: "Barbell Deadlift", equipment: "Barbell", muscleGroup: "Hamstrings" })]}
    ]
  };

  const equipment = ["bodyweight", "rings", "dumbbell", "barbell", "machine"];
  repairWorkoutProgram(program, { sessionDuration: 60, equipment });

  for (const session of program.sessions) {
    for (const ex of session.exercises) {
      assert.equal(hasUnresolvedAlternative(ex.name), false, `"${ex.name}" must not contain an unresolved alternative`);
    }
  }

  const pullEx = program.sessions[0].exercises.find((e) => e.name.toLowerCase().includes("pull"));
  assert.equal(pullEx.equipment, "rings");
  assert.equal(pullEx.name, "Ring Pull-up");

  const hangingCoreEx = program.sessions[0].exercises.find((e) => e.name.toLowerCase().includes("leg raise"));
  assert.equal(hangingCoreEx.equipment, "rings");
  assert.equal(hangingCoreEx.name, "Hanging Leg Raise on Rings");

  const conditioningEx = program.sessions[0].exercises.find((e) => e.name.toLowerCase().includes("row") || e.name.toLowerCase().includes("cardio"));
  assert.equal(conditioningEx.prescriptionType, "continuous_conditioning");
  assert.equal(typeof conditioningEx.durationMinutes, "number");
  assert.equal(conditioningEx.rir, undefined, "RIR must be removed, not left as the literal string \"NA\"");
  assert.equal(conditioningEx.restSeconds, 0);

  const validation = validateWorkoutProgram(program, {
    daysPerWeek: 4,
    sessionDuration: 60,
    equipment,
    availableDayIndexes: [0, 2, 4, 6],
    goalProfile: "hypertrophy"
  });
  assert.equal(validation.ok, true, `Errors: ${JSON.stringify(validation.errors)}`);
});

test("CASE 4: continuous conditioning does not require RIR and may use zero rest", () => {
  const program = {
    daysPerWeek: 1,
    sessions: [{
      name: "Day 1",
      exercises: [
        exercise({ exerciseId: "assault-bike-cardio-circuit", name: "Assault Bike Cardio Circuit", equipment: "Machine", prescriptionType: "continuous_conditioning", durationMinutes: 10, restSeconds: 0, rir: undefined, sets: undefined, reps: undefined }),
        exercise({ exerciseId: "barbell-bench-press", name: "Barbell Bench Press", equipment: "Barbell" }),
        exercise({ exerciseId: "barbell-row", name: "Barbell Row", equipment: "Barbell" })
      ]
    }]
  };
  const validation = validateWorkoutProgram(program, { daysPerWeek: 1, sessionDuration: 60, equipment: ["barbell", "machine"], goalProfile: "hypertrophy" });
  assert.equal(validation.ok, true, `Errors: ${JSON.stringify(validation.errors)}`);
});

// --- CASE 5: calisthenics strength with rings ------------------------------

test("CASE 5: pull-up/chin-up/hanging-knee-raise resolve to ring variants under calisthenics strength", () => {
  const program = {
    programName: "4-Day Calisthenics Strength",
    daysPerWeek: 4,
    durationWeeks: 8,
    goal: "Increase strength",
    weeklyScheduleDays: [0, 2, 4, 6],
    sessions: Array.from({ length: 4 }, (_, i) => ({
      name: `Day ${i + 1}`,
      exercises: [
        exercise({ name: "Pull-up", equipment: "Pull-up Bar", muscleGroup: "Back", reps: "5", restSeconds: 180 }),
        exercise({ name: "Chin-up", equipment: "Pull-up Bar", muscleGroup: "Back", reps: "5", restSeconds: 180 }),
        exercise({ name: "Hanging Knee Raise", equipment: "Pull-up Bar", muscleGroup: "Core", reps: "10-12" })
      ]
    }))
  };

  const equipment = ["bodyweight", "rings", "dumbbell"];
  repairWorkoutProgram(program, { sessionDuration: 60, equipment });

  const validation = validateWorkoutProgram(program, {
    daysPerWeek: 4,
    sessionDuration: 60,
    equipment,
    availableDayIndexes: [0, 2, 4, 6],
    goalProfile: "strength"
  });

  assert.ok(!validation.errors.some((e) => e.includes("Pull-up Bar")), `Errors: ${JSON.stringify(validation.errors)}`);
  assert.equal(validation.ok, true, `Errors: ${JSON.stringify(validation.errors)}`);

  const names = program.sessions[0].exercises.map((e) => e.name);
  assert.ok(names.includes("Ring Pull-up"));
  assert.ok(names.includes("Ring Chin-up"));
  assert.ok(names.includes("Hanging Leg Raise on Rings"));
});

// --- Additional required coverage -----------------------------------------

test("bodyweight + dumbbells does not imply pull-up bar", () => {
  assert.equal(hasCapability(["bodyweight", "dumbbell"], "vertical_hang"), false);
});

test("dumbbells do not imply bench support", () => {
  assert.equal(hasCapability(["dumbbell"], "bench_support"), false);
});

test("barbell does not imply rack or bench support", () => {
  assert.equal(hasCapability(["barbell"], "barbell_rack"), false);
  assert.equal(hasCapability(["barbell"], "bench_support"), false);
});

test("rings satisfy the vertical-hang capability", () => {
  assert.equal(hasCapability(["rings"], "vertical_hang"), true);
});

test("rings and pull-up bars are not universally identical capability sets", () => {
  const ringCaps = getAvailableCapabilities(["rings"]);
  const barCaps = getAvailableCapabilities(["pullupbar"]);
  assert.ok(ringCaps.has("dip_support"));
  assert.equal(barCaps.has("dip_support"), false, "A pull-up bar does not provide dip support the way rings do");
});

test("consecutive scheduled days remain valid — no automatic consecutive-day rule exists", () => {
  const program = {
    daysPerWeek: 3,
    weeklyScheduleDays: [0, 1, 2], // three consecutive days
    sessions: [
      { name: "Day 1", exercises: [exercise({ name: "Squat", equipment: "Barbell" }), exercise({ name: "Bench Press", equipment: "Barbell" }), exercise({ name: "Row", equipment: "Barbell" })] },
      { name: "Day 2", exercises: [exercise({ name: "Deadlift", equipment: "Barbell" }), exercise({ name: "Overhead Press", equipment: "Barbell" }), exercise({ name: "Pull-up", equipment: "Bodyweight" })] },
      { name: "Day 3", exercises: [exercise({ name: "Front Squat", equipment: "Barbell" }), exercise({ name: "Incline Press", equipment: "Barbell" }), exercise({ name: "Chin-up", equipment: "Bodyweight" })] }
    ]
  };
  const validation = validateWorkoutProgram(program, { daysPerWeek: 3, sessionDuration: 60, equipment: ["barbell", "bodyweight"], availableDayIndexes: [0, 1, 2, 3, 4, 5, 6], goalProfile: "hypertrophy" });
  assert.equal(
    validation.errors.some((e) => e.toLowerCase().includes("consecutive")),
    false,
    "Consecutive days must never be auto-rejected"
  );
});

test("resolveGenericAlternativeName picks the branch mentioning selected equipment", () => {
  const resolved = resolveGenericAlternativeName("Rowing Machine or 10-min Cardio Circuit", new Set(["machine"]));
  assert.equal(resolved, "Rowing Machine");
});

test("classifyPrescriptionType recognizes conditioning, interval, and hold patterns", () => {
  assert.equal(classifyPrescriptionType({ name: "10-min Cardio Circuit" }), "continuous_conditioning");
  assert.equal(classifyPrescriptionType({ name: "HIIT Sprint Intervals" }), "intervals");
  assert.equal(classifyPrescriptionType({ name: "Front Lever Hold", reps: "" }), "timed_hold");
  assert.equal(classifyPrescriptionType({ name: "Barbell Bench Press" }), "sets_reps");
});

test("no repaired exercise name contains an unresolved ' or '", () => {
  const program = {
    sessions: [{
      name: "Day 1",
      exercises: [
        exercise({ name: "Pull-up (Rings or Bar)", equipment: "Pull-up Bar" }),
        exercise({ name: "Weighted Pull-up", equipment: "Pull-up Bar" }),
        exercise({ name: "Barbell Squat", equipment: "Barbell" })
      ]
    }]
  };
  repairWorkoutProgram(program, { sessionDuration: 60, equipment: ["rings", "barbell", "bodyweight"] });
  for (const ex of program.sessions[0].exercises) {
    assert.equal(hasUnresolvedAlternative(ex.name), false, `"${ex.name}" still has an unresolved alternative`);
  }
});
