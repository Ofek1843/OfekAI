// Regression tests for the reported production bug: a Calisthenics-goal
// workout ("Improve calisthenics skills", Beginner, Calisthenics, equipment
// = Barbell + Machines only) was rejected with equipment errors, including
// Hebrew equipment/exercise values leaking into an English program. Root
// causes fixed alongside these tests:
//
// 1. lib/workout-validator.js's normalizeEquipment only recognized English
//    equipment strings — a model-generated Hebrew value (e.g. "מכונה" for
//    a user who selected Machines) failed canonical matching purely
//    because of language, not because the equipment was actually wrong.
// 2. lib/workout-repair.js's equipment-mismatch repair only covered 7
//    hand-picked cable exercises — any other mismatch (most of them,
//    including anything a Calisthenics-goal generation invents) had no
//    repair path and reached the validator unrepaired.
// 3. Nothing made bodyweight implicitly available for Calisthenics style,
//    so a user who selected Barbell + Machines but not Bodyweight got
//    every bodyweight/pull-up-bar exercise the model correctly generated
//    for that goal rejected as "unselected equipment". This is now handled
//    by lib/workout-equipment-policy.js's deriveAllowedEquipment(), which
//    server.js calls once and passes the SAME resulting canonical set into
//    generation, repair and validation. validateWorkoutProgram itself has
//    no bodyweight special case — see the "strict enforcement" tests below,
//    which cover the flip side: a Gym program must NEVER get an implicit
//    bodyweight pass.
// 4. server.js never sanitized Hebrew leakage into an English response —
//    only the prompt asked nicely for English-only output.

const test = require("node:test");
const assert = require("node:assert/strict");
const { repairWorkoutProgram } = require("../lib/workout-repair");
const { validateWorkoutProgram, normalizeEquipment } = require("../lib/workout-validator");
const { deriveAllowedEquipment } = require("../lib/workout-equipment-policy");
const { hasHebrewCharacters } = require("../public/js/equipment-i18n.mjs");

function exercise(overrides = {}) {
  return {
    exerciseId: "push-up",
    name: "Push-up",
    demoName: "Push-up",
    muscleGroup: "Chest",
    equipment: "Bodyweight",
    sets: 3,
    reps: "10-15",
    restSeconds: 90,
    rir: "1-2",
    notes: "",
    ...overrides
  };
}

test("normalizeEquipment: Hebrew equipment forms canonicalize identically to their English forms", () => {
  assert.equal(normalizeEquipment("Machine"), normalizeEquipment("מכונה"));
  assert.equal(normalizeEquipment("Machines"), normalizeEquipment("מכונות"));
  assert.equal(normalizeEquipment("Barbell"), normalizeEquipment("מוט"));
  assert.equal(normalizeEquipment("Bodyweight"), normalizeEquipment("משקל גוף"));
  assert.equal(normalizeEquipment("Pull-up Bar"), normalizeEquipment("מתח"));
  assert.equal(normalizeEquipment("Dumbbell"), normalizeEquipment("משקולות יד"));
  assert.equal(normalizeEquipment("Cable"), normalizeEquipment("כבלים"));
  assert.equal(normalizeEquipment("Gymnastic Rings"), normalizeEquipment("טבעות"));
});

test("Hebrew-labeled equipment that WAS selected is not treated as unselected", () => {
  // Reproduces the exact false-positive: model wrote "מכונה" (Hebrew for
  // Machine) for a user whose English-mode equipment selection was
  // ["barbell", "machine"] — this is valid equipment, not missing.
  const program = {
    sessions: [
      { name: "Day 1", exercises: [exercise({ equipment: "מכונה", muscleGroup: "Chest" })] }
    ]
  };
  const validation = validateWorkoutProgram(program, {
    daysPerWeek: 1,
    sessionDuration: 60,
    equipment: ["barbell", "machine"],
    availableDayIndexes: [1]
  });
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
});

test("Calisthenics + Barbell + Machines: production repro produces a fully valid, English-only program", () => {
  // The exact reported production input: goal Improve calisthenics skills,
  // Beginner, Calisthenics, equipment = Barbell + Machines (no Bodyweight,
  // no Pull-up Bar checked). A model following the "calisthenics-only mode:
  // never use machines/cables/barbell/dumbbell" prompt rule will generate
  // bodyweight/pull-up-bar work, which is unselected equipment unless
  // Bodyweight is implicitly added for Calisthenics.
  const equipmentForGeneration = ["barbell", "machine", "bodyweight"]; // server.js's implicit-bodyweight rule

  const program = {
    daysPerWeek: 3,
    sessions: [
      {
        day: 1,
        name: "Day 1",
        exercises: [
          exercise({ name: "Push-up", demoName: "Push-up", muscleGroup: "Chest", equipment: "Bodyweight" }),
          exercise({ name: "Pull-up", demoName: "Pull-up", muscleGroup: "Back", equipment: "Pull-up Bar" }), // no pull-up bar selected
          exercise({ name: "Plank", demoName: "Plank", muscleGroup: "Core", equipment: "Bodyweight" })
        ]
      },
      {
        day: 2,
        name: "Day 2",
        exercises: [
          exercise({ name: "Diamond Push-up", demoName: "Diamond Push-up", muscleGroup: "Triceps", equipment: "Bodyweight" }),
          exercise({ name: "Pistol Squat", demoName: "Pistol Squat", muscleGroup: "Quads", equipment: "Bodyweight" }),
          exercise({ name: "Russian Twist", demoName: "Russian Twist", muscleGroup: "Core", equipment: "Bodyweight" })
        ]
      },
      {
        day: 3,
        name: "Day 3",
        exercises: [
          exercise({ name: "Wide-Grip Push-up", demoName: "Wide-Grip Push-up", muscleGroup: "Chest", equipment: "Bodyweight" }),
          exercise({ name: "Side Plank", demoName: "Side Plank", muscleGroup: "Core", equipment: "Bodyweight" }),
          exercise({ name: "Handstand Push-up", demoName: "Handstand Push-up", muscleGroup: "Shoulders", equipment: "Bodyweight" })
        ]
      }
    ]
  };

  const { program: repaired, repairs } = repairWorkoutProgram(program, {
    sessionDuration: 60,
    equipment: equipmentForGeneration
  });

  const validation = validateWorkoutProgram(repaired, {
    daysPerWeek: 3,
    sessionDuration: 60,
    equipment: equipmentForGeneration,
    availableDayIndexes: [1, 3, 5]
  });

  assert.equal(validation.ok, true, `Expected a passing program after repair. Errors: ${JSON.stringify(validation.errors)}. Repairs applied: ${JSON.stringify(repairs)}`);

  // The un-selected pull-up-bar exercise must have been repaired to
  // something the user's equipment actually permits.
  for (const session of repaired.sessions) {
    for (const ex of session.exercises) {
      const norm = normalizeEquipment(ex.equipment);
      assert.ok(
        norm === "bodyweight" || equipmentForGeneration.includes(norm),
        `Exercise "${ex.name}" uses "${ex.equipment}" which is not in the permitted set`
      );
      assert.ok(ex.exerciseId, `Exercise "${ex.name}" is missing exerciseId after repair`);
    }
  }

  // No Hebrew leakage anywhere in the repaired program's user-facing fields.
  for (const session of repaired.sessions) {
    assert.equal(hasHebrewCharacters(session.name), false, `Session name "${session.name}" contains Hebrew`);
    for (const ex of session.exercises) {
      assert.equal(hasHebrewCharacters(ex.name), false, `Exercise name "${ex.name}" contains Hebrew`);
      assert.equal(hasHebrewCharacters(ex.equipment), false, `Exercise equipment "${ex.equipment}" contains Hebrew`);
      assert.equal(hasHebrewCharacters(ex.muscleGroup), false, `Exercise muscleGroup "${ex.muscleGroup}" contains Hebrew`);
    }
  }
});

test("Pull-up-bar exercise without Pull-up Bar selected gets repaired to permitted equipment", () => {
  const program = {
    sessions: [
      { name: "Day 1", exercises: [
        exercise({ name: "Pull-up", demoName: "Pull-up", muscleGroup: "Back", equipment: "Pull-up Bar" }),
        exercise({ name: "Push-up", demoName: "Push-up", muscleGroup: "Chest", equipment: "Bodyweight" }),
        exercise({ name: "Plank", demoName: "Plank", muscleGroup: "Core", equipment: "Bodyweight" })
      ] }
    ]
  };
  const { program: repaired } = repairWorkoutProgram(program, {
    sessionDuration: 60,
    equipment: ["bodyweight", "machine"]
  });
  const pullUpBarStillPresent = repaired.sessions[0].exercises.some(
    (ex) => normalizeEquipment(ex.equipment) === "pullupbar"
  );
  assert.equal(pullUpBarStillPresent, false, "A Pull-up Bar exercise survived repair without Pull-up Bar being selected");
});

test("A barbell exercise is not treated as satisfying a Pull-up Bar requirement", () => {
  assert.notEqual(normalizeEquipment("Barbell"), normalizeEquipment("Pull-up Bar"));
});

test("Cable exercise returned when Cable is not selected still gets repaired (existing cable substitution map)", () => {
  const program = {
    sessions: [
      { name: "Day 1", exercises: [
        exercise({ name: "Cable Tricep Pushdown", demoName: "Cable Tricep Pushdown", muscleGroup: "Triceps", equipment: "Cable" }),
        exercise({ name: "Push-up", demoName: "Push-up", muscleGroup: "Chest", equipment: "Bodyweight" }),
        exercise({ name: "Plank", demoName: "Plank", muscleGroup: "Core", equipment: "Bodyweight" })
      ] }
    ]
  };
  const { program: repaired } = repairWorkoutProgram(program, {
    sessionDuration: 60,
    equipment: ["bodyweight", "dumbbell"]
  });
  const cableStillPresent = repaired.sessions[0].exercises.some(
    (ex) => normalizeEquipment(ex.equipment) === "cable"
  );
  assert.equal(cableStillPresent, false, "A Cable exercise survived repair without Cable being selected");
});

test("Bodyweight exercise validates for Calisthenics once deriveAllowedEquipment adds it to the canonical set", () => {
  const program = {
    sessions: [{ name: "Day 1", exercises: [exercise({ equipment: "Bodyweight" })] }]
  };
  const { allowed } = deriveAllowedEquipment({
    trainingStyle: "calisthenics",
    selectedEquipment: ["barbell", "machine"] // bodyweight not explicitly checked
  });
  assert.ok(allowed.includes("bodyweight"), "Calisthenics must derive bodyweight into the allowed set");

  const validation = validateWorkoutProgram(program, {
    daysPerWeek: 1,
    sessionDuration: 60,
    equipment: allowed,
    availableDayIndexes: [1]
  });
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
});

test("Bodyweight exercise does NOT validate for Gym style — the validator has no bodyweight special case", () => {
  const program = {
    sessions: [{ name: "Day 1", exercises: [exercise({ equipment: "Bodyweight" })] }]
  };
  const { allowed } = deriveAllowedEquipment({
    trainingStyle: "gym",
    selectedEquipment: ["barbell", "machine"]
  });
  assert.ok(!allowed.includes("bodyweight"), "Gym must never derive bodyweight implicitly");

  const validation = validateWorkoutProgram(program, {
    daysPerWeek: 1,
    sessionDuration: 60,
    equipment: allowed,
    availableDayIndexes: [1]
  });
  assert.equal(validation.ok, false, "A Bodyweight exercise must be rejected when Gym style did not select it");
  assert.equal(validation.equipmentOk, false);
});

test("English generation containing Hebrew equipment strings validates once canonicalized (no false rejection)", () => {
  const program = {
    sessions: [
      { name: "Day 1", exercises: [
        exercise({ name: "Machine Chest Press", demoName: "Machine Chest Press", muscleGroup: "Chest", equipment: "מכונה" })
      ] }
    ]
  };
  const validation = validateWorkoutProgram(program, {
    daysPerWeek: 1,
    sessionDuration: 60,
    equipment: ["machine"],
    availableDayIndexes: [1]
  });
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
});
