"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateWorkoutProgram } = require("../lib/workout-validator");
const { repairWorkoutProgram } = require("../lib/workout-repair");
const { buildLocalExerciseReplacement } = require("../lib/local-demo-generators");
const {
  isExerciseCompatibleWithSplit,
  primaryMuscleForExercise,
  splitCompatibilityIssues
} = require("../lib/workout-split-policy");

function exercise(exerciseId, overrides = {}) {
  const muscle = primaryMuscleForExercise(exerciseId);
  return {
    exerciseId,
    name: exerciseId.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "),
    demoName: exerciseId,
    muscleGroup: muscle,
    equipment: exerciseId.includes("hack") || exerciseId.includes("machine") ? "Machine" : "Barbell",
    sets: 3,
    reps: "8-12",
    restSeconds: 90,
    rir: "1-3",
    notes: "",
    ...overrides
  };
}

function validate(sessionName, ids) {
  return validateWorkoutProgram({
    sessions: [{ name: sessionName, exercises: ids.map((id) => exercise(id)) }]
  }, {
    daysPerWeek: 1,
    sessionDuration: 180,
    equipment: ["Machine", "Barbell", "Dumbbell", "Bodyweight"],
    experience: "intermediate",
    goalProfile: "hypertrophy"
  });
}

test("catalog primary-muscle metadata classifies common lower-body exercises structurally", () => {
  for (const id of [
    "hack-squat", "barbell-squat", "leg-press", "leg-extension", "leg-curl",
    "romanian-deadlift", "bulgarian-split-squat", "standing-calf-raise-machine"
  ]) {
    assert.equal(isExerciseCompatibleWithSplit(id, "upper"), false, `${id} cannot be placed on Upper`);
    assert.equal(isExerciseCompatibleWithSplit(id, "push"), false, `${id} cannot be placed on Push`);
    assert.equal(isExerciseCompatibleWithSplit(id, "pull"), false, `${id} cannot be placed on Pull`);
    assert.equal(isExerciseCompatibleWithSplit(id, "lower"), true, `${id} is valid on Lower`);
  }
});

test("validator rejects Hack Squat in an explicitly Upper session and the inverse mismatch", () => {
  const upper = validate("Upper Day 1", ["hack-squat", "barbell-bench-press"]);
  assert.equal(upper.ok, false);
  assert.match(upper.errors.join(" "), /hack squat.*primary muscle quads.*incompatible/i);

  const lower = validate("Lower Day 1", ["barbell-bench-press", "barbell-squat"]);
  assert.equal(lower.ok, false);
  assert.match(lower.errors.join(" "), /barbell bench press.*primary muscle chest.*incompatible/i);
});

test("generated plans require explicit split metadata and reject labels that contradict the session name", () => {
  const context = {
    daysPerWeek: 1,
    sessionDuration: 180,
    equipment: ["Machine", "Barbell"],
    experience: "intermediate",
    goalProfile: "hypertrophy",
    requireSplitType: true
  };
  const missing = validateWorkoutProgram({
    sessions: [{ name: "Day 1", exercises: [exercise("barbell-bench-press")] }]
  }, context);
  assert.ok(missing.errors.some((error) => /must declare a valid splitType/.test(error)));

  const contradictory = validateWorkoutProgram({
    sessions: [{ name: "Upper Day 1", splitType: "full", exercises: [exercise("hack-squat")] }]
  }, context);
  assert.ok(contradictory.errors.some((error) => /declares full but its name identifies upper/.test(error)));
  assert.ok(contradictory.errors.some((error) => /hack squat.*primary muscle quads.*incompatible/i.test(error)));
});

test("Push, Pull and Legs obey primary-muscle categories while Full Body and core are allowed", () => {
  assert.equal(validate("Push", ["barbell-row"]).ok, false);
  assert.equal(validate("Pull", ["barbell-bench-press"]).ok, false);
  assert.equal(validate("Legs", ["machine-chest-press"]).ok, false);
  assert.equal(validate("Push", ["barbell-bench-press", "plank"]).ok, true);
  assert.equal(validate("Pull", ["barbell-row", "plank"]).ok, true);
  assert.equal(validate("Full Body", ["barbell-bench-press", "barbell-squat"]).ok, true);
});

test("deterministic program repair replaces split violations from the compatible catalog", () => {
  const program = {
    sessions: [{
      name: "Upper Day 1",
      exercises: [exercise("barbell-bench-press"), exercise("hack-squat")]
    }]
  };
  const result = repairWorkoutProgram(program, {
    equipment: ["Machine", "Barbell"],
    experience: "intermediate",
    muscleFocusMode: "balanced",
    applyVolumeTargets: false
  });

  const repaired = program.sessions[0].exercises;
  assert.equal(repaired.length, 2);
  assert.ok(repaired.every((item) => isExerciseCompatibleWithSplit(item, "upper")));
  assert.ok(!repaired.some((item) => item.exerciseId === "hack-squat"));
  assert.ok(result.repairs.some((item) => /split compatibility/.test(item)));
  assert.deepEqual(splitCompatibilityIssues(program), []);
});

test("if no valid split replacement exists, repair preserves the violation for fail-closed validation", () => {
  const program = {
    sessions: [{ name: "Upper Day 1", exercises: [exercise("hack-squat")] }]
  };
  repairWorkoutProgram(program, {
    equipment: ["Machine"],
    experience: "intermediate",
    muscleFocusMode: "selected_only",
    selectedMuscles: ["quads"],
    applyVolumeTargets: false
  });

  assert.equal(program.sessions[0].exercises.length, 1);
  assert.equal(program.sessions[0].exercises[0].exerciseId, "hack-squat");
  assert.equal(validateWorkoutProgram(program, {
    daysPerWeek: 1,
    sessionDuration: 180,
    equipment: ["Machine"],
    experience: "intermediate",
    goalProfile: "hypertrophy"
  }).ok, false);
});

test("no replacement is silently allowed to break Push/Pull compatibility", () => {
  const original = exercise("barbell-bench-press");
  const replacement = buildLocalExerciseReplacement({
    currentExercise: original,
    experience: "intermediate",
    equipment: ["Barbell"],
    sessionSplit: "push"
  });
  assert.ok(replacement);
  assert.equal(isExerciseCompatibleWithSplit(replacement, "push"), true);
});

test("catalog category is based on its primary set-credit muscle, not exercise-name exceptions", () => {
  assert.equal(primaryMuscleForExercise("hack-squat"), "quads");
  assert.equal(isExerciseCompatibleWithSplit("romanian-deadlift", "lower"), true);
  assert.equal(isExerciseCompatibleWithSplit("dumbbell-shoulder-press", "pull"), false);
});
