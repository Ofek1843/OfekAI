"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildVolumeLedger, buildQualityDiagnostic, buildProgrammingConstraintSummary } = require("../lib/workout-volume-ledger");
const { normalizeMuscleFocusContract, CANONICAL_MUSCLES } = require("../lib/workout-focus");

function exercise(exerciseId, name, sets) {
  return { exerciseId, name, equipment: "Barbell", muscleGroup: "General", sets, reps: "8-12", restSeconds: 90, rir: "1-3" };
}

const profile = {
  experience: "beginner",
  priority: "hypertrophy",
  daysPerWeek: 4,
  sessionDuration: 60,
  equipment: ["barbell", "dumbbell", "machine", "cable"],
  muscleFocusMode: "balanced",
  selectedMuscles: []
};

test("effective-volume ledger reconciles direct, fractional, effective and source totals", () => {
  const program = {
    sessions: [{
      name: "Upper",
      exercises: [
        exercise("barbell-bench-press", "Barbell Bench Press", 4),
        exercise("barbell-shoulder-press", "Barbell Shoulder Press", 2),
        exercise("cable-tricep-pushdown", "Cable Tricep Pushdown", 3)
      ]
    }]
  };
  const ledger = buildVolumeLedger(program, profile);

  assert.equal(ledger.muscles.chest.directSets, 4);
  assert.equal(ledger.muscles.chest.fractionalIndirectSets, 0.5);
  assert.equal(ledger.muscles.chest.effectiveTotal, 4.5);
  assert.equal(ledger.muscles.triceps.directSets, 3);
  assert.equal(ledger.muscles.triceps.fractionalIndirectSets, 3);
  assert.equal(ledger.muscles.triceps.effectiveTotal, 6);
  assert.equal(ledger.muscles.triceps.sourceExercises.length, 3);
  assert.ok(Object.values(ledger.muscles).every((entry) => Number.isFinite(entry.effectiveTotal)));
});

test("balanced hypertrophy target point is the deterministic preferred-range midpoint", () => {
  const summary = buildProgrammingConstraintSummary(profile);
  assert.deepEqual(summary.muscles.chest.preferred, [10, 13]);
  assert.equal(summary.muscles.chest.targetPoint, 11.5);
  assert.deepEqual(summary.muscles.triceps.preferred, [6, 8]);
  assert.equal(summary.muscles.triceps.targetPoint, 7);
});

test("quality diagnostics preserve API score semantics while exposing a private decomposition", () => {
  const program = { sessions: [{ name: "Day", exercises: [exercise("barbell-bench-press", "Bench", 3)] }] };
  const diagnostic = buildQualityDiagnostic(program, profile);
  assert.equal(typeof diagnostic.score, "number");
  assert.equal(diagnostic.perMuscle.chest.directSets, 3);
  assert.equal(diagnostic.perMuscle.triceps.fractionalIndirectSets, 1.5);
  assert.ok("remainingDeficit" in diagnostic.perMuscle.chest);
});

test("muscle-focus contract is backward compatible and rejects invalid selections", () => {
  assert.deepEqual(normalizeMuscleFocusContract({}), {
    ok: true,
    errors: [],
    muscleFocusMode: "balanced",
    selectedMuscles: []
  });
  assert.equal(normalizeMuscleFocusContract({ muscleFocusMode: "prioritize", selectedMuscles: [] }).ok, false);
  assert.equal(normalizeMuscleFocusContract({ muscleFocusMode: "selected_only", selectedMuscles: ["not_a_muscle"] }).ok, false);
  const valid = normalizeMuscleFocusContract({ muscleFocusMode: "selected_only", selectedMuscles: ["Glutes", "core", "glutes"] });
  assert.deepEqual(valid.selectedMuscles, ["glutes", "core"]);
  assert.ok(valid.selectedMuscles.every((muscle) => CANONICAL_MUSCLES.includes(muscle)));
});
