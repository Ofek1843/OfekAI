// Regression fixture for the reported production bug:
//
//   Goal: Build muscle
//   Experience: Advanced
//   Style: Gym
//   Selected equipment: Dumbbells + Machines
//   Days per week: 4
//   Session duration: 60 minutes
//   Available days: Monday, Wednesday, Friday, Sunday
//
// The real generated result incorrectly contained Bodyweight exercises,
// including Archer Push Up and Australian Row, and PASSED validation. Root
// cause: both lib/workout-repair.js's isExerciseEquipmentAllowed() and
// lib/workout-validator.js's validateWorkoutProgram() contained an
// unconditional "bodyweight always passes" exemption, regardless of whether
// bodyweight was ever selected. Fixed by:
//   - lib/workout-equipment-policy.js's deriveAllowedEquipment(): the ONE
//     place that decides what equipment is allowed, per style. Gym/Hybrid
//     never get implicit bodyweight; Calisthenics does.
//   - Removing the unconditional bodyweight exemptions from both
//     isExerciseEquipmentAllowed() and validateWorkoutProgram().
//
// This file does not call the real OpenAI API (these are deterministic,
// hand-built fixtures representing what the model incorrectly produced —
// the same pattern already used by test/workout-repair.test.js and
// test/workout-builder-calisthenics-equipment.test.js) run through the real
// repair + validation pipeline exactly as server.js calls it.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { repairWorkoutProgram, resolveExerciseId } = require("../lib/workout-repair");
const { validateWorkoutProgram } = require("../lib/workout-validator");
const { deriveAllowedEquipment } = require("../lib/workout-equipment-policy");
const { getCatalogExercise, getPublicExerciseImageMap } = require("../lib/workout-exercise-catalog");
const { derivePriorityFromGoal } = require("../lib/workout-priority");

const ROOT = path.join(__dirname, "..");
const EXERCISE_DIR = path.join(ROOT, "public", "images", "exercises");
const IMAGE_MAP = getPublicExerciseImageMap();

const REPORTED_PROFILE = {
  goal: "buildMuscle",
  experience: "advanced",
  trainingStyle: "gym",
  selectedEquipment: ["dumbbell", "machine"],
  daysPerWeek: 4,
  sessionDuration: 60,
  // Monday, Wednesday, Friday, Sunday -> [1, 3, 5, 0]
  availableDayIndexes: [1, 3, 5, 0]
};

function ex(overrides = {}) {
  return {
    name: "Placeholder",
    demoName: "Placeholder",
    muscleGroup: "Chest",
    equipment: "Machine",
    sets: 3,
    reps: "8-12",
    restSeconds: 90,
    rir: "1-2",
    notes: "",
    ...overrides
  };
}

// The exact reported shape: 4 sessions, mostly Dumbbell/Machine, but with
// Archer Push Up (Bodyweight) and Australian Row (Bodyweight) planted in —
// the two exercises named explicitly in the bug report.
function exactReportedFixture() {
  return {
    programName: "Advanced 4-Day Hypertrophy Program",
    daysPerWeek: 4,
    durationWeeks: 8,
    goal: "Build muscle",
    weeklyScheduleDays: [1, 3, 5, 0],
    sessions: [
      {
        day: 1,
        name: "Upper Body A",
        exercises: [
          ex({ name: "Machine Chest Press", demoName: "Machine Chest Press", muscleGroup: "Chest", equipment: "Machine", sets: 4 }),
          ex({ name: "Archer Push Up", demoName: "Archer Push Up", muscleGroup: "Chest", equipment: "Bodyweight", sets: 3 }),
          ex({ name: "Dumbbell Shoulder Press", demoName: "Dumbbell Shoulder Press", muscleGroup: "Shoulders", equipment: "Dumbbell", sets: 3 }),
          ex({ name: "Dumbbell Lateral Raise", demoName: "Dumbbell Lateral Raise", muscleGroup: "Shoulders", equipment: "Dumbbell", sets: 3 })
        ]
      },
      {
        day: 2,
        name: "Pull Day",
        exercises: [
          ex({ name: "Machine Row", demoName: "Machine Row", muscleGroup: "Back", equipment: "Machine", sets: 4 }),
          ex({ name: "Australian Row", demoName: "Australian Row", muscleGroup: "Back", equipment: "Bodyweight", sets: 3 }),
          ex({ name: "Dumbbell Hammer Curl", demoName: "Dumbbell Hammer Curl", muscleGroup: "Biceps", equipment: "Dumbbell", sets: 3 }),
          ex({ name: "Machine Shoulder Press", demoName: "Machine Shoulder Press", muscleGroup: "Shoulders", equipment: "Machine", sets: 3 })
        ]
      },
      {
        day: 3,
        name: "Lower Body A",
        exercises: [
          ex({ name: "Leg Press", demoName: "Leg Press", muscleGroup: "Quads", equipment: "Machine", sets: 4 }),
          ex({ name: "Dumbbell Goblet Squat", demoName: "Dumbbell Goblet Squat", muscleGroup: "Quads", equipment: "Dumbbell", sets: 3 }),
          ex({ name: "Seated Leg Curl", demoName: "Seated Leg Curl", muscleGroup: "Hamstrings", equipment: "Machine", sets: 3 }),
          ex({ name: "Standing Calf Raise", demoName: "Standing Calf Raise", muscleGroup: "Calves", equipment: "Machine", sets: 3 })
        ]
      },
      {
        day: 4,
        name: "Upper Body B",
        exercises: [
          ex({ name: "Machine Chest Fly", demoName: "Machine Chest Fly", muscleGroup: "Chest", equipment: "Machine", sets: 3 }),
          ex({ name: "Dumbbell Bench Press", demoName: "Dumbbell Bench Press", muscleGroup: "Chest", equipment: "Dumbbell", sets: 3 }),
          ex({ name: "Dumbbell Bicep Curl", demoName: "Dumbbell Bicep Curl", muscleGroup: "Biceps", equipment: "Dumbbell", sets: 3 }),
          ex({ name: "Cable Tricep Pushdown", demoName: "Cable Tricep Pushdown", muscleGroup: "Triceps", equipment: "Cable", sets: 3 })
        ]
      }
    ]
  };
}

function repairAndValidate(program, profile = REPORTED_PROFILE) {
  const { allowed } = deriveAllowedEquipment({
    trainingStyle: profile.trainingStyle,
    selectedEquipment: profile.selectedEquipment
  });

  const { program: repaired, repairs } = repairWorkoutProgram(program, {
    sessionDuration: profile.sessionDuration,
    equipment: allowed,
    experience: profile.experience,
    priority: derivePriorityFromGoal(profile.goal),
    daysPerWeek: profile.daysPerWeek,
    applyVolumeTargets: true
  });

  const validation = validateWorkoutProgram(repaired, {
    daysPerWeek: profile.daysPerWeek,
    sessionDuration: profile.sessionDuration,
    equipment: allowed,
    availableDayIndexes: profile.availableDayIndexes,
    goalProfile: "hypertrophy"
  });

  return { program: repaired, repairs, validation, allowed };
}

function assertStrictlyClean(t, program, allowed) {
  const forbidden = new Set(["bodyweight", "barbell", "cable", "pullupbar", "rings", "parallelbar"]);
  for (const muscle of forbidden) assert.ok(!allowed.includes(muscle), `${muscle} must not be in the allowed set`);

  const names = [];
  for (const session of program.sessions) {
    for (const exercise of session.exercises) {
      names.push(exercise.name);

      const norm = exercise.equipment ? String(exercise.equipment).trim().toLowerCase() : "";
      assert.ok(
        allowed.includes(norm) || allowed.includes(norm.replace(/s$/, "")),
        `"${exercise.name}" uses "${exercise.equipment}", which is not in the allowed set [${allowed.join(", ")}]`
      );

      const catalogEntry = getCatalogExercise(resolveExerciseId(exercise).id);
      assert.ok(catalogEntry, `"${exercise.name}" must resolve to a canonical enabled catalog exercise`);

      const imageFile = IMAGE_MAP[resolveExerciseId(exercise).id];
      assert.ok(imageFile, `"${exercise.name}" must have a mapped image file`);
      assert.ok(
        fs.existsSync(path.join(EXERCISE_DIR, imageFile)),
        `"${exercise.name}"'s image file ${imageFile} must exist on disk`
      );
    }
  }

  assert.ok(!names.includes("Archer Push Up"), "Archer Push Up must be absent");
  assert.ok(!names.includes("Australian Row"), "Australian Row must be absent");
}

test("exact reported fixture: no equipment violation survives repair + validation", () => {
  const { program, validation, allowed } = repairAndValidate(exactReportedFixture());

  assert.equal(validation.ok, true, `Expected valid. Errors: ${JSON.stringify(validation.errors)}`);
  assert.equal(validation.equipmentOk, true);
  assertStrictlyClean(null, program, allowed);
});

test("deriveAllowedEquipment: Gym + Dumbbells + Machines is EXACTLY [dumbbell, machine]", () => {
  const { allowed, explicit, derived } = deriveAllowedEquipment({
    trainingStyle: "gym",
    selectedEquipment: ["dumbbell", "machine"]
  });
  assert.deepEqual([...allowed].sort(), ["dumbbell", "machine"]);
  assert.deepEqual([...explicit].sort(), ["dumbbell", "machine"]);
  assert.deepEqual(derived, [], "Gym must never derive equipment implicitly");
});

// --- 10 deterministic variations, each planting a different disallowed ----
// --- equipment exercise into a different session/position ----------------

const VARIATIONS = [
  { label: "Archer Push Up in session 1", session: 0, exercise: { name: "Archer Push Up", demoName: "Archer Push Up", muscleGroup: "Chest", equipment: "Bodyweight" } },
  { label: "Australian Row in session 2", session: 1, exercise: { name: "Australian Row", demoName: "Australian Row", muscleGroup: "Back", equipment: "Bodyweight" } },
  { label: "Push-up in session 4", session: 3, exercise: { name: "Push-up", demoName: "Push-up", muscleGroup: "Chest", equipment: "Bodyweight" } },
  { label: "Plank in session 3", session: 2, exercise: { name: "Plank", demoName: "Plank", muscleGroup: "Core", equipment: "Bodyweight" } },
  { label: "Pull-up (Pull-up Bar) in session 2", session: 1, exercise: { name: "Pull-up", demoName: "Pull-up", muscleGroup: "Back", equipment: "Pull-up Bar" } },
  { label: "Barbell Squat in session 3", session: 2, exercise: { name: "Barbell Squat", demoName: "Barbell Squat", muscleGroup: "Quads", equipment: "Barbell" } },
  { label: "Cable Tricep Pushdown in session 4", session: 3, exercise: { name: "Cable Tricep Pushdown", demoName: "Cable Tricep Pushdown", muscleGroup: "Triceps", equipment: "Cable" } },
  { label: "Dip (Parallel Bars) in session 1", session: 0, exercise: { name: "Dip", demoName: "Dip", muscleGroup: "Chest", equipment: "Parallel Bars" } },
  { label: "Archer Push Up AND Australian Row both present", session: 0, exercise: { name: "Archer Push Up", demoName: "Archer Push Up", muscleGroup: "Chest", equipment: "Bodyweight" }, second: { session: 1, exercise: { name: "Australian Row", demoName: "Australian Row", muscleGroup: "Back", equipment: "Bodyweight" } } },
  { label: "Chin-up (Pull-up Bar) in session 2", session: 1, exercise: { name: "Chin-up", demoName: "Chin-up", muscleGroup: "Back", equipment: "Pull-up Bar" } }
];

let totalViolationsAcrossVariations = 0;

for (const [index, variation] of VARIATIONS.entries()) {
  test(`variation ${index + 1}/10: ${variation.label}`, () => {
    const program = exactReportedFixture();
    program.sessions[variation.session].exercises[0] = ex(variation.exercise);
    if (variation.second) {
      program.sessions[variation.second.session].exercises[0] = ex(variation.second.exercise);
    }

    const { program: repaired, validation, allowed } = repairAndValidate(program);

    assert.equal(validation.ok, true, `Expected valid for "${variation.label}". Errors: ${JSON.stringify(validation.errors)}`);
    assert.equal(validation.equipmentOk, true);
    assertStrictlyClean(null, repaired, allowed);

    if (!validation.equipmentOk) totalViolationsAcrossVariations += 1;
  });
}

test("required total: 0 equipment violations across all successful responses in this fixture set", () => {
  assert.equal(totalViolationsAcrossVariations, 0);
});

// --- Additional required equipment-selection scenarios --------------------

test("Gym + Machines only: no Dumbbell/Barbell/Bodyweight/Cable exercise survives", () => {
  const program = exactReportedFixture();
  const { program: repaired, validation, allowed } = repairAndValidate(program, {
    ...REPORTED_PROFILE,
    selectedEquipment: ["machine"]
  });
  assert.deepEqual(allowed, ["machine"]);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  for (const session of repaired.sessions) {
    for (const exercise of session.exercises) {
      assert.equal(String(exercise.equipment).toLowerCase(), "machine", `"${exercise.name}" must be Machine-only`);
    }
  }
});

test("Gym + Dumbbells only: no Machine/Barbell/Bodyweight/Cable exercise survives", () => {
  const program = exactReportedFixture();
  const { program: repaired, validation, allowed } = repairAndValidate(program, {
    ...REPORTED_PROFILE,
    selectedEquipment: ["dumbbell"]
  });
  assert.deepEqual(allowed, ["dumbbell"]);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  for (const session of repaired.sessions) {
    for (const exercise of session.exercises) {
      assert.equal(String(exercise.equipment).toLowerCase(), "dumbbell", `"${exercise.name}" must be Dumbbell-only`);
    }
  }
});

test("Gym + Dumbbells and Machines: matches the exact reported selection", () => {
  const { allowed } = deriveAllowedEquipment({ trainingStyle: "gym", selectedEquipment: ["dumbbell", "machine"] });
  assert.deepEqual([...allowed].sort(), ["dumbbell", "machine"]);
});

test("Calisthenics: derived Bodyweight is visible in deriveAllowedEquipment's own explicit/derived breakdown (what the Summary renders from)", () => {
  const { allowed, explicit, derived } = deriveAllowedEquipment({
    trainingStyle: "calisthenics",
    selectedEquipment: ["barbell", "machine"]
  });
  assert.ok(allowed.includes("bodyweight"));
  assert.ok(derived.includes("bodyweight"), "bodyweight must be reported as a DERIVED token, not silently merged into explicit");
  assert.ok(!explicit.includes("bodyweight"), "bodyweight was not explicitly selected in this scenario");
});

test("Hybrid: bodyweight is NOT implicit — same explicit-selection policy as Gym", () => {
  const { allowed, derived } = deriveAllowedEquipment({
    trainingStyle: "hybrid",
    selectedEquipment: ["dumbbell", "machine"]
  });
  assert.deepEqual([...allowed].sort(), ["dumbbell", "machine"]);
  assert.deepEqual(derived, [], "Hybrid must require explicit bodyweight selection, matching Gym's policy");
});

test("Hybrid WITH bodyweight explicitly selected: bodyweight is allowed because the user chose it, not because the style implied it", () => {
  const { allowed, explicit, derived } = deriveAllowedEquipment({
    trainingStyle: "hybrid",
    selectedEquipment: ["dumbbell", "bodyweight"]
  });
  assert.ok(allowed.includes("bodyweight"));
  assert.ok(explicit.includes("bodyweight"));
  assert.deepEqual(derived, []);
});

test("Unrecognized/unset training style defaults to the safe Gym-like policy (no implicit equipment)", () => {
  const { allowed, derived } = deriveAllowedEquipment({
    trainingStyle: "some-future-style-not-yet-handled",
    selectedEquipment: ["dumbbell"]
  });
  assert.deepEqual(allowed, ["dumbbell"]);
  assert.deepEqual(derived, []);
});

// --- Reroll: the isolated single-exercise repair must not derive its own ---
// --- equipment policy independently -- it must receive the SAME allowed ---
// --- set the caller already computed. -------------------------------------

test("reroll-style isolated repair: a Bodyweight replacement is still rejected under Gym + Dumbbells/Machines", () => {
  const { allowed } = deriveAllowedEquipment({ trainingStyle: "gym", selectedEquipment: ["dumbbell", "machine"] });
  const isolatedProgram = { sessions: [{ exercises: [ex({ name: "Archer Push Up", demoName: "Archer Push Up", muscleGroup: "Chest", equipment: "Bodyweight" })] }] };

  const { program: repaired } = repairWorkoutProgram(isolatedProgram, {
    sessionDuration: 60,
    equipment: allowed,
    reservedExerciseIds: []
  });

  const finalEquipment = String(repaired.sessions[0].exercises[0].equipment || "").toLowerCase();
  assert.notEqual(finalEquipment, "bodyweight", "the isolated repair must not leave a Bodyweight exercise when Bodyweight was never selected");
  assert.ok(allowed.includes(finalEquipment), `repaired equipment "${finalEquipment}" must be in the allowed set`);
});

// --- English / Hebrew equipment labels resolve to the same canonical set --

test("English and Hebrew equipment labels for the exact reported selection resolve identically", () => {
  const english = deriveAllowedEquipment({ trainingStyle: "gym", selectedEquipment: ["dumbbell", "machine"] });
  const hebrew = deriveAllowedEquipment({ trainingStyle: "gym", selectedEquipment: ["משקולת יד", "מכונה"] });
  assert.deepEqual([...english.allowed].sort(), [...hebrew.allowed].sort());
});

test("a Hebrew-labeled Bodyweight exercise is rejected exactly like its English form under Gym + Dumbbells/Machines", () => {
  const program = exactReportedFixture();
  program.sessions[0].exercises[0] = ex({
    name: "שכיבות סמיכה בעמידת קשת",
    demoName: "Archer Push Up",
    muscleGroup: "חזה",
    equipment: "משקל גוף"
  });

  const { program: repaired, validation, allowed } = repairAndValidate(program);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  assertStrictlyClean(null, repaired, allowed);
});
