const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateWeeklyVolume } = require("../lib/workout-volume");
const { estimateSessionDuration } = require("../lib/workout-duration");
const { validateWorkoutProgram, normalizeEquipment } = require("../lib/workout-validator");
const { EXERCISE_SETCREDITS } = require("../lib/workout-setcredits-map");

// Helper: create a minimal valid program. weeklyScheduleDays defaults to the
// first `daysPerWeek` weekdays so it always matches daysPerWeek in length —
// individual tests override it when they want to test schedule mismatches.
function createProgram(options = {}) {
  const { daysPerWeek = 3, exercisesPerSession = 2 } = options;
  const sessions = [];

  for (let d = 0; d < daysPerWeek; d++) {
    const exercises = [];
    for (let e = 0; e < exercisesPerSession; e++) {
      exercises.push({
        name: `Exercise ${d}-${e}`,
        exerciseId: `exercise-${d}-${e}`,
        muscleGroup: "Chest",
        equipment: "barbell",
        sets: 3,
        reps: "8-12",
        restSeconds: 120,
        rir: "2",
        notes: ""
      });
    }
    sessions.push({
      day: d + 1,
      name: `Day ${d + 1}`,
      exercises
    });
  }

  return {
    programName: "Test Program",
    daysPerWeek,
    durationWeeks: 8,
    goal: "Build muscle",
    sessions,
    weeklyScheduleDays: Array.from({ length: daysPerWeek }, (_, i) => i)
  };
}

// --- Volume / coverage tests ---

test("Weekly volume calculator: calculates direct sets correctly", () => {
  const program = createProgram({ daysPerWeek: 1 }); // 1 day = 2 exercises
  program.sessions[0].exercises[0].exerciseId = "barbell-bench-press";
  program.sessions[0].exercises[0].sets = 4;

  const { perMuscle, warnings, mappedExercises, unknownExercises, mappingCoveragePercent } =
    calculateWeeklyVolume(program, EXERCISE_SETCREDITS);

  assert.equal(perMuscle["chest"].direct, 4, "Barbell bench press 4 sets = 4 direct chest sets");
  assert.equal(
    perMuscle["triceps"].fractional,
    2,
    "Barbell bench press 4 sets × 0.5 triceps credit = 2 fractional"
  );
  assert.equal(warnings.length >= 1, true, "Should warn about at least one unknown exercise");
  assert.equal(mappedExercises, 1, "One exercise (bench press) is mapped");
  assert.equal(unknownExercises, 1, "One exercise (unmapped) is unknown");
  assert.equal(mappingCoveragePercent, 50, "1 of 2 exercises mapped = 50% coverage");
});

test("Weekly volume calculator: coverage stats and low-coverage warning", () => {
  const program = createProgram({ daysPerWeek: 1, exercisesPerSession: 4 });
  // Map only the first exercise; leave the other three unmapped.
  program.sessions[0].exercises[0].exerciseId = "barbell-squat";

  const { mappedExercises, unknownExercises, mappingCoveragePercent, warnings } =
    calculateWeeklyVolume(program, EXERCISE_SETCREDITS);

  assert.equal(mappedExercises, 1);
  assert.equal(unknownExercises, 3);
  assert.equal(mappingCoveragePercent, 25);
  assert.ok(
    warnings.some((w) => w.includes("mapping coverage is only 25%")),
    "Should flag low mapping coverage instead of silently returning incomplete totals"
  );
});

test("Weekly volume calculator: deterministic alias normalization does not invent mappings", () => {
  const program = createProgram({ daysPerWeek: 1, exercisesPerSession: 1 });
  // Formatting variant of a known id — should still resolve via slugification.
  program.sessions[0].exercises[0].exerciseId = "Barbell Bench Press";
  program.sessions[0].exercises[0].sets = 2;

  const { perMuscle, mappedExercises, warnings } = calculateWeeklyVolume(program, EXERCISE_SETCREDITS);

  assert.equal(mappedExercises, 1, "Formatting variant of a known id resolves via slug lookup");
  assert.equal(perMuscle["chest"].direct, 2);
  assert.equal(warnings.length, 0, "No warning when the alias resolves to a real mapping");
});

// --- Duration tests ---

test("Session duration estimator: rest is between sets, transitions between exercises", () => {
  const session = {
    name: "Day 1",
    exercises: [
      { name: "Bench Press", sets: 4, reps: "6-10", restSeconds: 150 },
      { name: "Lat Pulldown", sets: 3, reps: "8-12", restSeconds: 120 }
    ]
  };

  const result = estimateSessionDuration(session, {
    warmupMinutes: 5,
    transitionSeconds: 90,
    secPerSet: 45
  });

  // work: 4*45 + 3*45 = 180 + 135 = 315s = 5.25min
  // rest (between sets only): (4-1)*150 + (3-1)*120 = 450 + 240 = 690s = 11.5min
  // transitions (between exercises only): (2-1)*90 = 90s = 1.5min
  // total: 5 + 5.25 + 11.5 + 1.5 = 23.25 -> ceil 24min
  assert.equal(result.estimatedMinutes, 24, "Duration reflects between-set rest and between-exercise transition, not per-set/per-session flat costs");
  assert.equal(result.breakdown.rest, 11.5);
  assert.equal(result.breakdown.transition, 1.5);
});

test("Session duration estimator: single set has zero rest (nothing to rest between)", () => {
  const session = {
    name: "Day 1",
    exercises: [{ name: "Deadlift", sets: 1, reps: "5", restSeconds: 300 }]
  };

  const result = estimateSessionDuration(session, { warmupMinutes: 5, transitionSeconds: 90, secPerSet: 45 });

  // rest = max(1-1,0)*300 = 0; transitions = max(1-1,0)*90 = 0
  assert.equal(result.breakdown.rest, 0, "A single set has no rest interval to charge");
  assert.equal(result.breakdown.transition, 0, "A single exercise has no transition to charge");
});

test("Session duration estimator: boundary case near 45 minutes", () => {
  // 4 exercises, 3 sets each, 90s rest, secPerSet 45, warmup 5, transition 90s
  // work: 4 * 3*45 = 540s = 9min
  // rest: 4 * (3-1)*90 = 4*180=720s = 12min
  // transitions: (4-1)*90=270s=4.5min
  // total: 5+9+12+4.5=30.5 -> ceil 31min (comfortably within a 45min budget)
  const session = {
    name: "Day 1",
    exercises: Array.from({ length: 4 }, (_, i) => ({
      name: `Exercise ${i}`,
      sets: 3,
      reps: "8-12",
      restSeconds: 90
    }))
  };

  const result = estimateSessionDuration(session, { warmupMinutes: 5, transitionSeconds: 90, secPerSet: 45 });

  assert.equal(result.estimatedMinutes, 31);
  assert.ok(result.estimatedMinutes <= 45, "Should fit inside a 45-minute session budget");
});

test("Session duration estimator: boundary case near 60 minutes", () => {
  // 6 exercises, 4 sets each, 120s rest
  // work: 6 * 4*45 = 1080s = 18min
  // rest: 6 * (4-1)*120 = 6*360 = 2160s = 36min
  // transitions: (6-1)*90=450s=7.5min
  // total: 5+18+36+7.5=66.5 -> ceil 67min (exceeds a plain 60min budget, showing the cap is meaningful)
  const session = {
    name: "Day 1",
    exercises: Array.from({ length: 6 }, (_, i) => ({
      name: `Exercise ${i}`,
      sets: 4,
      reps: "8-12",
      restSeconds: 120
    }))
  };

  const result = estimateSessionDuration(session, { warmupMinutes: 5, transitionSeconds: 90, secPerSet: 45 });

  assert.equal(result.estimatedMinutes, 67);
});

// --- Schedule validation tests ---

test("Validator: rejects program when session count ≠ requested days", () => {
  const program = createProgram({ daysPerWeek: 3 });
  program.sessions.pop(); // Remove one session
  program.weeklyScheduleDays = [0, 2]; // keep in sync so this test isolates the session-count rule

  const result = validateWorkoutProgram(program, { daysPerWeek: 3 });

  assert.equal(result.ok, false, "Should fail validation");
  assert.ok(
    result.errors.some((e) => e.includes("2 sessions") && e.includes("3")),
    "Should report session count mismatch"
  );
});

test("Validator: rejects weeklyScheduleDays.length !== daysPerWeek", () => {
  const program = createProgram({ daysPerWeek: 3 });
  program.weeklyScheduleDays = [0, 2]; // only 2 days scheduled for a 3-day program

  const result = validateWorkoutProgram(program, { daysPerWeek: 3, availableDayIndexes: [0, 1, 2, 3, 4] });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.includes("schedules 2 days") && e.includes("3 training days")),
    "Should report scheduled-day count mismatch"
  );
});

test("Validator: rejects duplicate days within weeklyScheduleDays", () => {
  const program = createProgram({ daysPerWeek: 3 });
  program.weeklyScheduleDays = [0, 0, 2]; // day 0 scheduled twice

  const result = validateWorkoutProgram(program, { daysPerWeek: 3, availableDayIndexes: [0, 1, 2, 3, 4] });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.includes("scheduled more than once")),
    "Should report duplicate scheduled day"
  );
});

test("Validator: rejects program when scheduled days not in available days", () => {
  const program = createProgram({ daysPerWeek: 3 });
  program.weeklyScheduleDays = [0, 2, 4];
  // User says available: [1, 3, 5] (Mon, Wed, Fri) — none of 0/2/4 are available

  const result = validateWorkoutProgram(program, {
    daysPerWeek: 3,
    availableDayIndexes: [1, 3, 5]
  });

  assert.equal(result.ok, false, "Should fail when scheduled days not available");
  assert.ok(
    result.errors.some((e) => e.includes("not in the user's available days")),
    "Should report day mismatch"
  );
});

test("Validator: selecting more available days than workout days is valid", () => {
  const program = createProgram({ daysPerWeek: 2 });
  program.weeklyScheduleDays = [1, 3]; // 2 scheduled days, both available

  const result = validateWorkoutProgram(program, {
    daysPerWeek: 2,
    availableDayIndexes: [0, 1, 2, 3, 4, 5, 6] // user made every day available
  });

  assert.equal(result.ok, true, "More available days than scheduled days must not be flagged");
  assert.equal(
    result.warnings.filter((w) => w.toLowerCase().includes("scheduled") && w.toLowerCase().includes("selected")).length,
    0,
    "Must not compare scheduled count against the total available-day count"
  );
});

// --- Equipment tests ---

test("Validator: rejects equipment not in selected set", () => {
  const program = createProgram({ daysPerWeek: 1 });
  program.sessions[0].exercises[0].equipment = "barbell";
  // User selected only: [bodyweight, pullUpBar]

  const result = validateWorkoutProgram(program, {
    daysPerWeek: 1,
    equipment: ["bodyweight", "pullUpBar"]
  });

  assert.equal(result.ok, false, "Should reject barbell when not selected");
  assert.ok(
    result.errors.some((e) => e.includes("barbell") && e.includes("not selected")),
    "Should report equipment mismatch"
  );
});

test("Validator: canonical exact matching handles all documented aliases", () => {
  assert.equal(normalizeEquipment("bodyweight"), normalizeEquipment("body weight"));
  assert.equal(normalizeEquipment("pullUpBar"), normalizeEquipment("pull-up bar"));
  assert.equal(normalizeEquipment("machine"), normalizeEquipment("machines"));
  assert.equal(normalizeEquipment("dumbbell"), normalizeEquipment("dumbbells"));
  assert.equal(normalizeEquipment("barbell"), normalizeEquipment("barbells"));
});

test("Validator: normalizes equipment values (pullUpBar ≈ pull-up bar)", () => {
  const normalized1 = normalizeEquipment("pullUpBar");
  const normalized2 = normalizeEquipment("pull-up bar");
  const normalized3 = normalizeEquipment("Pull Up Bar");

  assert.equal(normalized1, normalized2, "pullUpBar should normalize same as pull-up bar");
  assert.equal(normalized1, normalized3, "Case insensitive normalization");
});

test("Validator: exact matching rejects a merely-similar equipment string", () => {
  // Old substring matching would have let "barbell" pass against a
  // description that merely contains the word "barbell" as a substring.
  const program = createProgram({ daysPerWeek: 1, exercisesPerSession: 1 });
  program.sessions[0].exercises[0].equipment = "barbell rack attachment";

  const result = validateWorkoutProgram(program, {
    daysPerWeek: 1,
    equipment: ["barbell"]
  });

  assert.equal(result.ok, false, "An equipment string that is not an exact canonical match must be rejected");
});

test("Validator: empty equipment value does not silently pass when equipment is restricted", () => {
  const program = createProgram({ daysPerWeek: 1, exercisesPerSession: 1 });
  program.sessions[0].exercises[0].equipment = "";

  const result = validateWorkoutProgram(program, {
    daysPerWeek: 1,
    equipment: ["barbell"]
  });

  assert.equal(result.ok, false, "Empty/unknown equipment must not silently pass validation");
  assert.ok(result.errors.some((e) => e.includes("no recognizable equipment value")));
});

test("Validator: rejects session exceeding duration + 10% tolerance", () => {
  const program = createProgram({ daysPerWeek: 1 });
  program.sessions[0].exercises = [
    ...program.sessions[0].exercises,
    {
      name: "Extra Bench",
      exerciseId: "extra-bench",
      sets: 20,
      restSeconds: 300,
      reps: "3",
      equipment: "barbell",
      muscleGroup: "Chest"
    }
  ];

  const result = validateWorkoutProgram(program, {
    daysPerWeek: 1,
    sessionDuration: 45
  });

  assert.equal(result.ok, false, "Should reject oversized session");
  assert.ok(
    result.errors.some((e) => e.includes("exceeds") && e.includes("limit")),
    "Should report duration overrun"
  );
});

test("Validator: warns on unknown exercise (no invented credits)", () => {
  const program = createProgram({ daysPerWeek: 1 });
  program.sessions[0].exercises[0].exerciseId = "completely-unknown-exercise";

  const { perMuscle, warnings } = calculateWeeklyVolume(program, EXERCISE_SETCREDITS);

  assert.ok(warnings.some((w) => w.includes("no known muscle credit")), "Should warn about unknown");
  assert.equal(perMuscle["unknown-muscle"], undefined, "Unknown exercise does not invent muscles");
});

test("Validator: enforces strength rest (1-6 reps ≥180s)", () => {
  const program = createProgram({ daysPerWeek: 1 });
  program.sessions[0].exercises[0].reps = "3";
  program.sessions[0].exercises[0].restSeconds = 90; // Too short

  const result = validateWorkoutProgram(program, {
    daysPerWeek: 1,
    goalProfile: "strength"
  });

  assert.equal(result.ok, false, "Should reject short rest on main strength work");
  assert.ok(
    result.errors.some((e) => e.includes("3 reps") && e.includes("≥180s")),
    "Should report rest violation"
  );
});

test("Validator: rejects duplicate exercises in same session", () => {
  const program = createProgram({ daysPerWeek: 1 });
  program.sessions[0].exercises[1].exerciseId = program.sessions[0].exercises[0].exerciseId; // Duplicate ID

  const result = validateWorkoutProgram(program, { daysPerWeek: 1 });

  assert.equal(result.ok, false, "Should reject duplicate");
  assert.ok(
    result.errors.some((e) => e.includes("appears more than once")),
    "Should report duplication"
  );
});

test("Validator: schema validation requires exerciseId on every exercise", () => {
  const program = createProgram({ daysPerWeek: 1 });
  delete program.sessions[0].exercises[0].exerciseId;

  const result = validateWorkoutProgram(program, { daysPerWeek: 1 });

  assert.equal(result.ok, false, "Should reject exercise missing exerciseId");
  assert.ok(result.errors.some((e) => e.includes("missing exerciseId")));
});

test("Validator: schema validation catches missing/invalid fields", () => {
  const program = createProgram({ daysPerWeek: 1 });
  program.sessions[0].exercises[0].sets = -1; // Invalid

  const result = validateWorkoutProgram(program, { daysPerWeek: 1 });

  assert.equal(result.ok, false, "Should catch invalid sets");
  assert.ok(
    result.errors.some((e) => e.includes("sets must be 1-20")),
    "Should report sets out of range"
  );
});
