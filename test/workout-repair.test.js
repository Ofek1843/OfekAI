// Regression tests for the production 422 root cause: the AI prompt's JSON
// schema (server.js, POST /api/workout-builder) never requests exerciseId,
// but validateWorkoutProgram's schema rule requires it on every exercise —
// so every real generation failed with "exercise ... is missing
// exerciseId." for every single exercise. Reproduced live against the real
// OpenAI API and the actual production prompt (gpt-4.1, the model now
// configured after the 403 fix): 15/15 exercises missing exerciseId, 0
// other errors. lib/workout-repair.js fixes the DATA (assigns a
// deterministic exerciseId) rather than loosening validateWorkoutProgram's
// rule — the fixture below is that exact captured production response.

const test = require("node:test");
const assert = require("node:assert/strict");
const { repairWorkoutProgram, resolveExerciseId } = require("../lib/workout-repair");
const { validateWorkoutProgram } = require("../lib/workout-validator");
const { calculateWeeklyVolume } = require("../lib/workout-volume");
const { EXERCISE_SETCREDITS } = require("../lib/workout-setcredits-map");

// Captured verbatim (exerciseId omitted, matching the real bug) from a live
// POST https://api.openai.com/v1/chat/completions call using the exact
// system/user prompt server.js builds for POST /api/workout-builder,
// model gpt-4.1, goal "Build muscle", 3 days/week, 60min sessions,
// equipment [bodyweight, dumbbell, barbell, machine, cable].
function productionCaptureFixture() {
  const exercise = (name, muscleGroup, equipment, sets, reps, restSeconds) => ({
    name, demoName: name, muscleGroup, equipment, sets, reps, restSeconds, rir: "1-2", notes: "Progression note."
  });

  return {
    programName: "Intermediate 3-Day Hypertrophy Program",
    daysPerWeek: 3,
    durationWeeks: 8,
    goal: "Build muscle",
    weeklyScheduleDays: [1, 3, 5],
    sessions: [
      {
        day: 1,
        name: "Upper Body A",
        exercises: [
          exercise("Barbell Bench Press", "Chest", "Barbell", 4, "8-10", 120),
          exercise("Dumbbell Shoulder Press", "Shoulders", "Dumbbell", 3, "8-12", 90),
          exercise("Incline Dumbbell Fly", "Chest", "Dumbbell", 3, "10-15", 90),
          exercise("Cable Lateral Raise", "Shoulders", "Cable", 2, "12-15", 60),
          exercise("Triceps Rope Pushdown", "Triceps", "Cable", 2, "10-15", 60)
        ]
      },
      {
        day: 2,
        name: "Pull Day",
        exercises: [
          exercise("Barbell Bent Over Row", "Back", "Barbell", 4, "8-10", 120),
          exercise("Lat Pulldown", "Back", "Machine", 3, "10-12", 90),
          exercise("Seated Cable Row", "Back", "Cable", 3, "10-12", 90),
          exercise("Face Pull", "Shoulders", "Cable", 2, "12-15", 60),
          exercise("Dumbbell Hammer Curl", "Biceps", "Dumbbell", 2, "10-15", 60)
        ]
      },
      {
        day: 3,
        name: "Lower Body",
        exercises: [
          exercise("Barbell Back Squat", "Quads", "Barbell", 4, "8-10", 120),
          exercise("Romanian Deadlift", "Hamstrings", "Barbell", 3, "8-12", 120),
          exercise("Leg Press", "Quads", "Machine", 3, "10-12", 90),
          exercise("Seated Leg Curl", "Hamstrings", "Machine", 2, "12-15", 60),
          exercise("Standing Calf Raise", "Calves", "Machine", 3, "12-15", 60)
        ]
      }
    ]
  };
}

const VALIDATION_CONTEXT = {
  daysPerWeek: 3,
  sessionDuration: 60,
  equipment: ["bodyweight", "dumbbell", "barbell", "machine", "cable"],
  availableDayIndexes: [1, 3, 5],
  goalProfile: "hypertrophy"
};

test("reproduces the production failure: every exercise missing exerciseId, nothing else wrong", () => {
  const program = productionCaptureFixture();
  const result = validateWorkoutProgram(program, VALIDATION_CONTEXT);

  assert.equal(result.ok, false);
  const totalExercises = program.sessions.reduce((sum, s) => sum + s.exercises.length, 0);
  const missingIdErrors = result.errors.filter((e) => e.includes("missing exerciseId"));
  assert.equal(missingIdErrors.length, totalExercises, "Every exercise must fail on missing exerciseId");
  assert.equal(result.errors.length, missingIdErrors.length, "No other validation rule should be failing on this fixture");
});

test("repairWorkoutProgram fixes the production failure without touching any other rule", () => {
  const program = productionCaptureFixture();
  const before = validateWorkoutProgram(program, VALIDATION_CONTEXT);
  assert.equal(before.ok, false);

  const { repairs } = repairWorkoutProgram(program, { sessionDuration: 60 });
  const after = validateWorkoutProgram(program, VALIDATION_CONTEXT);

  assert.equal(after.ok, true, `Expected valid after repair. Remaining errors: ${JSON.stringify(after.errors)}`);
  assert.equal(after.errors.length, 0);
  assert.deepEqual(after.warnings, before.warnings, "Repair must not change which non-exerciseId warnings/rules apply");
  assert.ok(repairs.length >= 15, "Repair must assign missing exerciseIds and may also replace disabled public exercises");

  for (const session of program.sessions) {
    for (const exercise of session.exercises) {
      assert.equal(typeof exercise.exerciseId, "string");
      assert.ok(exercise.exerciseId.length > 0);
    }
  }
});

test("repair raises weekly-volume mapping coverage via alias resolution (does not invent credits)", () => {
  const program = productionCaptureFixture();
  repairWorkoutProgram(program, { sessionDuration: 60 });
  const volume = calculateWeeklyVolume(program, EXERCISE_SETCREDITS);

  // "Barbell Back Squat" -> alias -> barbell-squat; "Seated Leg Curl" keeps the dedicated seated-leg-curl image/credits.
  const squatExercise = program.sessions[2].exercises.find((e) => e.name === "Barbell Back Squat");
  const legCurlExercise = program.sessions[2].exercises.find((e) => e.name === "Seated Leg Curl");
  assert.equal(squatExercise.exerciseId, "barbell-squat");
  assert.equal(legCurlExercise.exerciseId, "seated-leg-curl");

  assert.ok(volume.mappedExercises >= 11, `Expected alias resolution to map most exercises, got ${volume.mappedExercises}`);
  assert.ok(volume.mappingCoveragePercent > 0);
  // Unmapped exercises must never receive invented credits.
  assert.equal(Object.keys(volume.perMuscle).includes("unknown"), false);
});

test("resolveExerciseId: existing valid id is preserved as-is", () => {
  const result = resolveExerciseId({ exerciseId: "custom-id", name: "Something" });
  assert.deepEqual(result, { id: "custom-id", source: "existing-slug" });
});

test("resolveExerciseId: known alias resolves to the canonical setcredits key", () => {
  const result = resolveExerciseId({ name: "Barbell Back Squat" });
  assert.deepEqual(result, { id: "barbell-squat", source: "name-alias" });
});

test("resolveExerciseId canonicalizes generated variant ids before validation/rendering", () => {
  const cases = [
    [{ exerciseId: "bulgarian-split-squat", name: "Bulgarian Split Squat" }, "bulgarian-split-squat"],
    [{ exerciseId: "seated-leg-curl", name: "Seated Leg Curl" }, "seated-leg-curl"],
    [{ exerciseId: "triceps-dip", name: "Triceps Dip" }, "tricep-dip"],
    [{ exerciseId: "dumbbell-hammer-curl", name: "Dumbbell Hammer Curl" }, "hammer-curl"]
  ];

  for (const [exercise, expectedId] of cases) {
    const result = resolveExerciseId(exercise);
    assert.equal(result.id, expectedId);
    assert.match(result.source, /alias|canonical/);
  }
});

test("repairWorkoutProgram replaces exercises that are disabled until dedicated images exist", () => {
  const program = {
    programName: "Image Safety Fixture",
    daysPerWeek: 1,
    weeklyScheduleDays: [1],
    sessions: [
      {
        day: 1,
        name: "Pull",
        exercises: [
          { exerciseId: "seated-machine-row", name: "Seated Machine Row", demoName: "Seated Machine Row", muscleGroup: "Back", equipment: "Machine", sets: 3, reps: "8-12", restSeconds: 90, rir: "1-3" },
          { exerciseId: "machine-rear-delt-fly", name: "Machine Rear Delt Fly", demoName: "Machine Rear Delt Fly", muscleGroup: "Rear Delts", equipment: "Machine", sets: 3, reps: "12-15", restSeconds: 60, rir: "1-3" },
          { exerciseId: "standing-calf-raise", name: "Standing Calf Raise", demoName: "Standing Calf Raise", muscleGroup: "Calves", equipment: "Machine", sets: 3, reps: "12-15", restSeconds: 60, rir: "1-3" }
        ]
      }
    ]
  };

  const context = {
    daysPerWeek: 1,
    sessionDuration: 60,
    equipment: ["Machine", "Cable"],
    availableDayIndexes: [1]
  };

  const { repairs } = repairWorkoutProgram(program, context);
  const ids = program.sessions[0].exercises.map((exercise) => exercise.exerciseId);

  assert.deepEqual(ids, ["seated-cable-row", "face-pull", "standing-calf-raise"]);
  assert.ok(repairs.some((repair) => repair.includes("replaced disabled exercise")));

  const validation = validateWorkoutProgram(program, context);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
});

test("resolveExerciseId: unknown exercise name still gets a deterministic slug (never invents a mapping)", () => {
  const result = resolveExerciseId({ name: "Some Brand New Exercise" });
  assert.equal(result.source, "name-slug");
  assert.equal(result.id, "some-brand-new-exercise");
});

test("repairWorkoutProgram replaces cable exercises when cable equipment is not selected", () => {
  const program = {
    programName: "No Cable Fixture",
    daysPerWeek: 2,
    weeklyScheduleDays: [1, 3],
    sessions: [
      {
        day: 1,
        name: "Upper A",
        exercises: [
          {
            name: "Cable Triceps Pushdown",
            demoName: "Cable Triceps Pushdown",
            muscleGroup: "Triceps",
            equipment: "Cable",
            sets: 3,
            reps: "10-12",
            restSeconds: 60,
            rir: "1-3"
          },
          {
            name: "Cable Face Pull",
            demoName: "Cable Face Pull",
            muscleGroup: "Rear Delts",
            equipment: "Cable",
            sets: 3,
            reps: "12-15",
            restSeconds: 60,
            rir: "1-3"
          }
        ]
      },
      {
        day: 2,
        name: "Upper B",
        exercises: [
          {
            name: "Cable Triceps Pushdown",
            demoName: "Cable Triceps Pushdown",
            muscleGroup: "Triceps",
            equipment: "Cable",
            sets: 3,
            reps: "10-12",
            restSeconds: 60,
            rir: "1-3"
          }
        ]
      }
    ]
  };
  const context = {
    daysPerWeek: 2,
    sessionDuration: 60,
    equipment: ["Dumbbells", "Barbell", "Machines"],
    availableDayIndexes: [1, 3],
    goalProfile: "hypertrophy"
  };

  const { repairs } = repairWorkoutProgram(program, context);
  assert.equal(
    program.sessions.flatMap((session) => session.exercises).some((exercise) => exercise.equipment === "Cable"),
    false
  );
  assert.ok(repairs.some((repair) => repair.includes("replaced \"Cable Triceps Pushdown\"")));
  assert.ok(repairs.some((repair) => repair.includes("replaced \"Cable Face Pull\"")));

  const validation = validateWorkoutProgram(program, context);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));

  const allExerciseIds = program.sessions.flatMap((session) => session.exercises.map((exercise) => exercise.exerciseId));
  assert.deepEqual(allExerciseIds, ["overhead-tricep-extension", "dumbbell-reverse-fly", "overhead-tricep-extension"]);

  const volume = calculateWeeklyVolume(program, EXERCISE_SETCREDITS);
  assert.equal(volume.mappingCoveragePercent, 100);
});

test("assignExerciseIds keeps exerciseId unique within a session on alias/slug collisions", () => {
  const program = {
    sessions: [
      {
        name: "Day 1",
        exercises: [
          { name: "Push-up" },
          { name: "Push Up" } // slugifies to the same id as the exercise above
        ]
      }
    ]
  };
  const { repairs } = repairWorkoutProgram(program, { sessionDuration: 60 });

  const ids = program.sessions[0].exercises.map((e) => e.exerciseId);
  assert.equal(new Set(ids).size, 2, "Both exercises must end up with distinct exerciseIds");
  assert.equal(repairs.length, 2);
});

test("repairSchemaDefects coerces numeric-string sets/restSeconds and stringifies numeric reps", () => {
  const program = {
    sessions: [
      {
        name: "Day 1",
        exercises: [
          { exerciseId: "test-ex", name: "Test Exercise", sets: "3", restSeconds: "90", reps: 10 }
        ]
      }
    ]
  };
  repairWorkoutProgram(program, { sessionDuration: 60 });

  const exercise = program.sessions[0].exercises[0];
  assert.equal(exercise.sets, 3);
  assert.equal(typeof exercise.sets, "number");
  assert.equal(exercise.restSeconds, 90);
  assert.equal(typeof exercise.restSeconds, "number");
  assert.equal(exercise.reps, "10");
  assert.equal(typeof exercise.reps, "string");
});

test("trimAccessoryExercisesForDuration removes exercises from the end when a session exceeds the cap", () => {
  const program = {
    sessions: [
      {
        name: "Day 1",
        exercises: Array.from({ length: 6 }, (_, i) => ({
          exerciseId: `exercise-${i}`,
          name: `Exercise ${i}`,
          sets: 4,
          restSeconds: 120,
          reps: "8-12"
        }))
      }
    ]
  };
  const { repairs } = repairWorkoutProgram(program, { sessionDuration: 20 }); // tight budget forces trimming

  assert.ok(program.sessions[0].exercises.length < 6, "Session should have been trimmed");
  assert.ok(program.sessions[0].exercises.length >= 3, "Must never trim below the minimum floor");
  assert.ok(repairs.some((r) => r.includes("removed accessory exercise")));

  // The exercises that remain must be the FIRST ones (primary lifts kept,
  // accessories from the end removed first).
  assert.equal(program.sessions[0].exercises[0].exerciseId, "exercise-0");
});

test("trimAccessoryExercisesForDuration never trims below the minimum floor even if still over budget", () => {
  const program = {
    sessions: [
      {
        name: "Day 1",
        exercises: Array.from({ length: 3 }, (_, i) => ({
          exerciseId: `exercise-${i}`,
          name: `Exercise ${i}`,
          sets: 10,
          restSeconds: 180,
          reps: "5"
        }))
      }
    ]
  };
  repairWorkoutProgram(program, { sessionDuration: 15 });

  assert.equal(program.sessions[0].exercises.length, 3, "Floor of 3 exercises must be respected even if still over budget");
});
