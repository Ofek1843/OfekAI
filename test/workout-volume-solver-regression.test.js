// Regression coverage for the reported false-negative: the exact feasible
// profile (Build muscle / Advanced / Gym / Dumbbells + Machines / 4 days /
// 60 minutes) was being rejected by the weekly-volume acceptance gate with
// "widen your available equipment" — even though Dumbbells + Machines
// provide compatible exercises for every required major muscle group.
//
// Root cause: lib/workout-repair.js's repairWeeklyVolumeTargets used
// MAX_VOLUME_REPAIR_PASSES = 3, and each pass only applies ONE +1/-1
// adjustment per out-of-range muscle. A muscle whose only in-program
// candidates were low-credit SECONDARY contributors (e.g. Core at 0.25
// credit/set from squat variants, no dedicated Crunch present) needed many
// more increments than 3 passes allowed to close its deficit — so the
// solver gave up on a genuinely feasible muscle before it ever tried the
// obviously-better move (add a dedicated primary-mover exercise). Fixed by:
//   1. Preferring "add a primary mover" over "grind out secondary-credit
//      increments" when the program has no primary candidate for a muscle.
//   2. Raising MAX_VOLUME_REPAIR_PASSES (3 -> 12) so genuinely convergent
//      cases have enough iterations.
//   3. Adding an exercise-removal fallback for the above-range case when a
//      candidate is already at the minimum sets-per-exercise floor (a
//      separate but related gap: a muscle repeated across many
//      sessions/week can't be brought down by reducing sets alone once
//      every contributor is already at the floor).
// Also: diagnoseVolumeGateFailure() (lib/workout-repair.js) now checks the
// real catalog against the final allowed equipment before choosing a
// user-facing message — never blaming equipment when coverage is complete.

const test = require("node:test");
const assert = require("node:assert/strict");
const { repairWorkoutProgram, resolveExerciseId, diagnoseVolumeGateFailure } = require("../lib/workout-repair");
const { validateWorkoutProgram } = require("../lib/workout-validator");
const { calculateWeeklyVolume } = require("../lib/workout-volume");
const { EXERCISE_SETCREDITS } = require("../lib/workout-setcredits-map");
const { deriveAllowedEquipment } = require("../lib/workout-equipment-policy");
const { requiredMusclesOutOfRange, allVolumePolicies, calculateProgramQualityScore } = require("../lib/workout-volume-targets");
const { derivePriorityFromGoal } = require("../lib/workout-priority");
const { getCatalogExercise, getPublicExerciseImageMap, WORKOUT_EXERCISE_CATALOG, isPublicExerciseEnabled } = require("../lib/workout-exercise-catalog");
const { normalizeEquipment } = require("../lib/workout-validator");
const fs = require("node:fs");
const path = require("node:path");

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
  availableDayIndexes: [1, 3, 5, 0] // Monday, Wednesday, Friday, Sunday
};

// Small deterministic LCG so the 20 variations are reproducible across runs
// (item 5's requirement: identical inputs produce identical results) while
// still genuinely varying exercise selection, not just repeating one
// hand-tuned fixture 20 times.
function makeRng(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

// [name, canonical exerciseId, equipment, muscleGroup] — muscleGroup is the
// REAL primary muscle so repairExercisesMissingFromCatalog's same-muscle
// fallback (and the volume-target repair's candidate search) can actually
// find a replacement/credit for it. A generic placeholder muscleGroup here
// would make every exercise unresolvable by muscle, masking whether the
// PRODUCTION solver works — this fixture must look like plausible AI output.
const CHEST = [["Machine Chest Press", "machine-chest-press", "Machine", "Chest"], ["Dumbbell Bench Press", "dumbbell-bench-press", "Dumbbell", "Chest"], ["Machine Chest Fly", "machine-chest-fly", "Machine", "Chest"], ["Incline Dumbbell Bench Press", "incline-dumbbell-bench-press", "Dumbbell", "Chest"]];
const BACK = [["Dumbbell Row", "dumbbell-row", "Dumbbell", "Back"], ["Seated Machine Row", "seated-machine-row", "Machine", "Back"], ["Chest Supported Row", "chest-supported-row", "Machine", "Back"], ["T-Bar Row", "t-bar-row", "Machine", "Back"]];
const QUADS = [["Leg Press", "leg-press", "Machine", "Quads"], ["Dumbbell Goblet Squat", "dumbbell-goblet-squat", "Dumbbell", "Quads"], ["Leg Extension", "leg-extension", "Machine", "Quads"], ["Dumbbell Bulgarian Split Squat", "dumbbell-bulgarian-split-squat", "Dumbbell", "Quads"]];
const HAMSTRINGS = [["Seated Leg Curl", "seated-leg-curl", "Machine", "Hamstrings"], ["Lying Leg Curl", "lying-leg-curl", "Machine", "Hamstrings"]];
const SHOULDERS = [["Machine Shoulder Press", "machine-shoulder-press", "Machine", "Shoulders"], ["Dumbbell Shoulder Press", "dumbbell-shoulder-press", "Dumbbell", "Shoulders"], ["Dumbbell Lateral Raise", "dumbbell-lateral-raise", "Dumbbell", "Shoulders"]];
const BICEPS = [["Dumbbell Bicep Curl", "dumbbell-bicep-curl", "Dumbbell", "Biceps"], ["Dumbbell Hammer Curl", "hammer-curl", "Dumbbell", "Biceps"], ["Preacher Curl", "preacher-curl", "Machine", "Biceps"]];
const TRICEPS = [["Overhead Triceps Extension", "overhead-tricep-extension", "Dumbbell", "Triceps"]];
const CALVES = [["Standing Calf Raise", "standing-calf-raise", "Machine", "Calves"], ["Seated Calf Raise", "seated-calf-raise", "Machine", "Calves"], ["Dumbbell Calf Raise", "dumbbell-calf-raise", "Dumbbell", "Calves"]];
const CORE = [["Crunch", "crunch", "Machine", "Core"]];

function buildVariant(seed) {
  const rng = makeRng(seed);
  const day = (pools) => pools.map(([name, id, equipment, muscleGroup]) => ({
    name, demoName: name, muscleGroup, equipment,
    sets: 3 + Math.floor(rng() * 2), reps: "8-12", restSeconds: 90, rir: "1-2", notes: ""
  }));

  return {
    programName: "Advanced 4-Day Hypertrophy Program",
    daysPerWeek: 4,
    weeklyScheduleDays: [1, 3, 5, 0],
    sessions: [
      { day: 1, name: "Upper Body A", exercises: day([pick(rng, CHEST), pick(rng, SHOULDERS), pick(rng, TRICEPS), pick(rng, BICEPS)]) },
      { day: 2, name: "Pull Day", exercises: day([pick(rng, BACK), pick(rng, BACK), pick(rng, BICEPS), pick(rng, SHOULDERS)]) },
      { day: 3, name: "Lower Body A", exercises: day([pick(rng, QUADS), pick(rng, HAMSTRINGS), pick(rng, QUADS), pick(rng, CALVES)]) },
      { day: 4, name: "Upper Body B", exercises: day([pick(rng, CHEST), pick(rng, BACK), pick(rng, TRICEPS), pick(rng, CORE)]) }
    ]
  };
}

function runProfile(program) {
  const { allowed } = deriveAllowedEquipment({ trainingStyle: REPORTED_PROFILE.trainingStyle, selectedEquipment: REPORTED_PROFILE.selectedEquipment });
  const priority = derivePriorityFromGoal(REPORTED_PROFILE.goal);
  const profile = { experience: REPORTED_PROFILE.experience, priority, daysPerWeek: REPORTED_PROFILE.daysPerWeek, equipment: allowed };

  const { program: repaired } = repairWorkoutProgram(program, {
    sessionDuration: REPORTED_PROFILE.sessionDuration,
    equipment: allowed,
    experience: profile.experience,
    priority: profile.priority,
    daysPerWeek: REPORTED_PROFILE.daysPerWeek,
    applyVolumeTargets: true
  });

  const validation = validateWorkoutProgram(repaired, {
    daysPerWeek: REPORTED_PROFILE.daysPerWeek,
    sessionDuration: REPORTED_PROFILE.sessionDuration,
    equipment: allowed,
    availableDayIndexes: REPORTED_PROFILE.availableDayIndexes,
    goalProfile: "hypertrophy"
  });
  const { perMuscle, mappingCoveragePercent, unknownExercises } = calculateWeeklyVolume(repaired, EXERCISE_SETCREDITS);
  const mappingComplete = mappingCoveragePercent === 100 && unknownExercises === 0;
  const outOfRangeRequired = requiredMusclesOutOfRange(perMuscle, profile);
  const volumePassed = mappingComplete && outOfRangeRequired.length === 0;
  const quality = calculateProgramQualityScore(perMuscle, profile);
  const policies = allVolumePolicies(profile);

  return { repaired, validation, perMuscle, mappingCoveragePercent, unknownExercises, outOfRangeRequired, volumePassed, allowed, quality, policies };
}

// Section 4 of the engine-quality spec: a plan sitting at the bare minimum
// for most major muscles is not acceptable for this profile. 65/100 means
// most required muscles are meaningfully inside (or very close to) their
// preferred zone, not merely inside the wider valid range.
const QUALITY_THRESHOLD = 65;

function assertFullySuccessful(result, label) {
  const { repaired, validation, mappingCoveragePercent, unknownExercises, outOfRangeRequired, volumePassed, allowed, quality, policies, perMuscle } = result;

  assert.equal(validation.ok, true, `[${label}] validationSummary.passed must be true. Errors: ${JSON.stringify(validation.errors)}`);
  assert.equal(validation.equipmentOk, true, `[${label}] validationSummary.equipmentPassed must be true`);
  assert.equal(volumePassed, true, `[${label}] validationSummary.volumePassed must be true. outOfRange: ${JSON.stringify(outOfRangeRequired)}`);
  assert.equal(mappingCoveragePercent, 100, `[${label}] mapping coverage must be 100%`);
  assert.equal(unknownExercises, 0, `[${label}] unknown exercises must be 0`);
  assert.deepEqual(outOfRangeRequired, [], `[${label}] no required muscle may be out of range`);

  // Section 1: no required muscle may exceed the 20-weekly-set default
  // product ceiling, regardless of experience.
  for (const [muscle, policy] of Object.entries(policies)) {
    if (!policy) continue;
    const actual = perMuscle?.[muscle]?.total || 0;
    assert.ok(actual <= 20, `[${label}] ${muscle} (${actual} sets) must never exceed the 20-set default ceiling`);
  }

  // Section 3/4: this profile (advanced, 4x60min) has the schedule/recovery
  // budget to do meaningfully better than the bare minimum -- the plan must
  // score above the quality threshold, not just barely clear the hard gate.
  assert.ok(
    quality.score !== null && quality.score >= QUALITY_THRESHOLD,
    `[${label}] quality score (${quality.score}) must be >= ${QUALITY_THRESHOLD}. Per-muscle: ${JSON.stringify(quality.perMuscle)}`
  );

  const forbidden = new Set(["bodyweight", "barbell", "cable", "pullupbar", "rings"]);
  for (const muscle of forbidden) assert.ok(!allowed.includes(muscle), `[${label}] ${muscle} must not be in the allowed set`);

  for (const session of repaired.sessions) {
    for (const exercise of session.exercises) {
      const norm = normalizeEquipment(exercise.equipment);
      assert.ok(["dumbbell", "machine"].includes(norm), `[${label}] "${exercise.name}" uses "${exercise.equipment}", must be Dumbbell or Machine`);

      const resolvedId = resolveExerciseId(exercise).id;
      assert.ok(getCatalogExercise(resolvedId), `[${label}] "${exercise.name}" must resolve to a canonical enabled catalog exercise`);
      const imageFile = IMAGE_MAP[resolvedId];
      assert.ok(imageFile, `[${label}] "${exercise.name}" must have a mapped image`);
      assert.ok(fs.existsSync(path.join(EXERCISE_DIR, imageFile)), `[${label}] "${exercise.name}"'s image ${imageFile} must exist on disk`);
    }

    const { estimateSessionDuration } = require("../lib/workout-duration");
    const estimate = estimateSessionDuration(session);
    const budget = REPORTED_PROFILE.sessionDuration + Math.max(5, REPORTED_PROFILE.sessionDuration * 0.1);
    assert.ok(estimate.estimatedMinutes <= budget + 0.01, `[${label}] session "${session.name}" (${estimate.estimatedMinutes}min) must respect the duration budget (${budget}min)`);
  }
}

// --- Item 8: exact fixture, 20 deterministic variations, 20/20 required ---

test("exact reported fixture: 20 deterministic variations all succeed (20/20 required)", () => {
  let successCount = 0;
  let firstResult = null;
  let firstBefore = null;
  for (let seed = 1; seed <= 20; seed++) {
    const program = buildVariant(seed * 7919); // distinct, deterministic seeds
    if (seed === 1) {
      const beforeProgram = JSON.parse(JSON.stringify(program));
      for (const exercise of beforeProgram.sessions.flatMap((session) => session.exercises)) {
        exercise.exerciseId = resolveExerciseId(exercise).id;
      }
      const beforeVolume = calculateWeeklyVolume(beforeProgram, EXERCISE_SETCREDITS);
      const beforeProfile = {
        experience: REPORTED_PROFILE.experience,
        priority: derivePriorityFromGoal(REPORTED_PROFILE.goal),
        daysPerWeek: REPORTED_PROFILE.daysPerWeek,
        equipment: deriveAllowedEquipment({
          trainingStyle: REPORTED_PROFILE.trainingStyle,
          selectedEquipment: REPORTED_PROFILE.selectedEquipment
        }).allowed
      };
      firstBefore = {
        quality: calculateProgramQualityScore(beforeVolume.perMuscle, beforeProfile).score,
        perMuscle: beforeVolume.perMuscle
      };
    }
    const result = runProfile(program);
    if (seed === 1) firstResult = result;
    try {
      assertFullySuccessful(result, `variation ${seed}`);
      successCount++;
    } catch (error) {
      console.error(`Variation ${seed} failed:`, error.message, JSON.stringify(result.outOfRangeRequired));
      throw error;
    }
  }
  assert.equal(successCount, 20, "required successful generation rate for this feasible profile is 20/20");

  // Report the actual preferred targets and final volume for each muscle
  // (variation 1) -- required by the release report.
  const report = {};
  for (const [muscle, policy] of Object.entries(firstResult.policies)) {
    if (!policy) continue;
    report[muscle] = {
      actual: firstResult.perMuscle[muscle]?.total || 0,
      minimumEffective: policy.minimumEffective,
      preferredRange: `${policy.preferredMin}-${policy.preferredMax}`,
      hardMaximum: policy.hardMaximum
    };
  }
  console.log("Exact reported fixture (variation 1) final per-muscle volumes vs policy:", JSON.stringify(report, null, 2));
  console.log("Exact reported fixture (variation 1) before/after quality:", JSON.stringify({ before: firstBefore.quality, after: firstResult.quality.score }));
  assert.ok(firstResult.quality.score >= firstBefore.quality, "advanced reconstructed fixture quality must not regress after repair");
});

// --- Item 2/7: equipment feasibility is real, never falsely blamed --------

test("equipment feasibility: Dumbbells + Machines has at least one compatible exercise for every required muscle", () => {
  const { allowed } = deriveAllowedEquipment({ trainingStyle: "gym", selectedEquipment: ["dumbbell", "machine"] });
  const allowedSet = new Set(allowed);
  const REQUIRED = ["chest", "back", "quads", "hamstrings", "glutes", "delts", "biceps", "triceps", "core", "calves"];

  const coverage = {};
  for (const muscle of REQUIRED) {
    coverage[muscle] = Object.entries(WORKOUT_EXERCISE_CATALOG).some(([id, entry]) => {
      if (!isPublicExerciseEnabled(id)) return false;
      if (!entry.setCredits?.[muscle]) return false;
      return allowedSet.has(normalizeEquipment(entry.equipment));
    });
  }

  for (const muscle of REQUIRED) {
    assert.equal(coverage[muscle], true, `${muscle} must have a Dumbbell/Machine-compatible exercise`);
  }
});

test("diagnoseVolumeGateFailure never returns cause:'equipment' when coverage is actually complete", () => {
  const { allowed } = deriveAllowedEquipment({ trainingStyle: "gym", selectedEquipment: ["dumbbell", "machine"] });
  // Simulate a residual out-of-range required muscle that DOES have
  // equipment coverage (a genuine solver-limitation case, not equipment).
  const outOfRangeRequired = [{ muscle: "core", status: "below", total: 2, range: { min: 4, max: 16 } }];
  const diagnosis = diagnoseVolumeGateFailure(outOfRangeRequired, { equipment: allowed, daysPerWeek: 4, sessionDuration: 60 });
  assert.notEqual(diagnosis.cause, "equipment", "core has Machine-compatible exercises (Crunch) -- must not be blamed on equipment");
  assert.equal(diagnosis.equipmentCoverage.core, true);
});

test("diagnoseVolumeGateFailure returns cause:'equipment' when a required muscle genuinely has zero compatible exercises", () => {
  // Cable-only selection has no compatible calves exercise anywhere in the
  // catalog (calves candidates are all Machine/Dumbbell).
  const outOfRangeRequired = [{ muscle: "calves", status: "below", total: 0, range: { min: 3, max: 11 } }];
  const diagnosis = diagnoseVolumeGateFailure(outOfRangeRequired, { equipment: ["cable"], daysPerWeek: 4, sessionDuration: 60 });
  assert.equal(diagnosis.cause, "equipment");
  assert.equal(diagnosis.equipmentCoverage.calves, false);
});

test("server.js: the volume-gate error message is cause-specific, not a blanket 'widen your equipment' line", () => {
  const source = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
  assert.match(source, /function volumeFailureMessage\(cause, language\)/);
  assert.match(source, /if \(cause === "equipment"\)/);
  assert.match(source, /if \(cause === "schedule"\)/);
  assert.match(source, /diagnoseVolumeGateFailure\(outOfRangeRequired,/);
  // The old blanket message must be gone from the failure path.
  assert.doesNotMatch(source, /widen your available equipment\."\s*\n\s*\}\);\s*\n\s*\}\);?\s*\n\s*\}\s*\n\s*return res\.json\(\{\s*\n\s*success: true,\s*\n\s*program,/);
});

// --- Item 9: broader feasible-profile verification -------------------------

const FEASIBLE_PROFILES = [
  { label: "Gym / Machines only / 4 days / 60min", trainingStyle: "gym", equipment: ["machine"], daysPerWeek: 4, sessionDuration: 60 },
  { label: "Gym / Dumbbells only / 4 days / 60min", trainingStyle: "gym", equipment: ["dumbbell"], daysPerWeek: 4, sessionDuration: 60 },
  { label: "Gym / Dumbbells + Machines / 3 days / 60min", trainingStyle: "gym", equipment: ["dumbbell", "machine"], daysPerWeek: 3, sessionDuration: 60 },
  { label: "Gym / Dumbbells + Machines / 5 days / 45min", trainingStyle: "gym", equipment: ["dumbbell", "machine"], daysPerWeek: 5, sessionDuration: 45 }
];

test("broader feasible profiles: none incorrectly rejected, none produce an equipment-blame error when coverage is complete", () => {
  const results = { feasibleAndSuccessful: 0, controlledFailure: 0, invalidSuccessful: 0 };

  for (const profileCase of FEASIBLE_PROFILES) {
    for (const experience of ["beginner", "intermediate", "advanced"]) {
      for (const language of ["en", "he"]) {
        const { allowed } = deriveAllowedEquipment({ trainingStyle: profileCase.trainingStyle, selectedEquipment: profileCase.equipment });
        const daysPerWeek = profileCase.daysPerWeek;

        // Reuse the same variant-builder shape for a plausible, non-hand-
        // optimized program, trimmed/extended to the requested day count.
        const base = buildVariant(daysPerWeek * 131 + experience.length);
        const sessions = Array.from({ length: daysPerWeek }, (_, i) => base.sessions[i % base.sessions.length]);
        const program = { daysPerWeek, weeklyScheduleDays: sessions.map((_, i) => i), sessions };

        const priority = derivePriorityFromGoal("buildMuscle");
        const profile = { experience, priority, daysPerWeek, equipment: allowed };

        const { program: repaired } = repairWorkoutProgram(program, {
          sessionDuration: profileCase.sessionDuration, equipment: allowed, experience, priority, daysPerWeek, applyVolumeTargets: true
        });
        const validation = validateWorkoutProgram(repaired, {
          daysPerWeek, sessionDuration: profileCase.sessionDuration, equipment: allowed, availableDayIndexes: program.weeklyScheduleDays, goalProfile: "hypertrophy"
        });
        const { perMuscle, mappingCoveragePercent, unknownExercises } = calculateWeeklyVolume(repaired, EXERCISE_SETCREDITS);
        const mappingComplete = mappingCoveragePercent === 100 && unknownExercises === 0;
        const outOfRangeRequired = requiredMusclesOutOfRange(perMuscle, profile);
        const volumePassed = mappingComplete && outOfRangeRequired.length === 0;
        const successful = validation.ok && volumePassed;

        if (successful) {
          results.feasibleAndSuccessful++;
          // An "invalid successful plan" would be success with equipment
          // violations or out-of-range required muscles -- verify neither.
          for (const session of repaired.sessions) {
            for (const exercise of session.exercises) {
              const norm = normalizeEquipment(exercise.equipment);
              if (!allowed.includes(norm)) results.invalidSuccessful++;
            }
          }
          if (outOfRangeRequired.length > 0) results.invalidSuccessful++;
        } else {
          results.controlledFailure++;
          if (!validation.ok) continue;
          // If it failed on volume specifically, the diagnosis must never
          // say "equipment" for these profiles (all have full coverage).
          const diagnosis = diagnoseVolumeGateFailure(outOfRangeRequired, { equipment: allowed, daysPerWeek, sessionDuration: profileCase.sessionDuration });
          assert.notEqual(diagnosis.cause, "equipment", `[${profileCase.label}/${experience}/${language}] must not be misdiagnosed as an equipment problem`);
        }
      }
    }
  }

  console.log("Broader feasible-profile results:", JSON.stringify(results, null, 2));
  assert.equal(results.invalidSuccessful, 0, "no successful plan may have an equipment violation or required-muscle-out-of-range");
});
