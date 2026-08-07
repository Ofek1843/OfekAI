"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { repairWorkoutProgram } = require("../lib/workout-repair");
const { buildVolumeLedger, buildQualityDiagnostic } = require("../lib/workout-volume-ledger");
const { primaryMuscleForExerciseId } = require("../lib/workout-focus");
const { getCatalogExercise } = require("../lib/workout-exercise-catalog");

const ROOT = path.join(__dirname, "..");

function exercise(exerciseId, sets, overrides = {}) {
  const catalog = getCatalogExercise(exerciseId);
  assert.ok(catalog, `fixture exercise ${exerciseId} must be in the approved catalog`);
  return {
    exerciseId,
    name: catalog.title,
    demoName: catalog.title,
    muscleGroup: Object.keys(catalog.setCredits || {})[0] || "General",
    equipment: catalog.equipment,
    sets,
    reps: "8-12",
    restSeconds: 90,
    rir: "1-3",
    notes: "",
    ...overrides
  };
}

function selectedOnlyProfile(selectedMuscles, daysPerWeek = 2) {
  return {
    experience: "beginner",
    priority: "hypertrophy",
    daysPerWeek,
    sessionDuration: 120,
    equipment: ["barbell", "cable", "bodyweight"],
    muscleFocusMode: "selected_only",
    selectedMuscles,
    applyVolumeTargets: true
  };
}

function totalSets(program, exerciseId) {
  return program.sessions.flatMap((session) => session.exercises)
    .filter((item) => item.exerciseId === exerciseId)
    .reduce((sum, item) => sum + Number(item.sets || 0), 0);
}

test("triceps excess is repaired isolation-first while chest compounds are preserved", () => {
  const program = {
    sessions: [1, 2].map((day) => ({
      day,
      name: `Day ${day}`,
      exercises: [exercise("barbell-bench-press", 5), exercise("cable-tricep-pushdown", 6)]
    }))
  };
  const profile = selectedOnlyProfile(["chest", "triceps"]);
  const before = buildVolumeLedger(program, profile);
  const benchSetsBefore = totalSets(program, "barbell-bench-press");
  const { repairs } = repairWorkoutProgram(program, profile);
  const after = buildVolumeLedger(program, profile);

  assert.equal(totalSets(program, "barbell-bench-press"), benchSetsBefore);
  assert.ok(totalSets(program, "cable-tricep-pushdown") < 12);
  assert.ok(repairs[0].includes("direct isolation"), "the first allocation repair must target isolation");
  assert.ok(after.muscles.triceps.effectiveTotal <= after.muscles.triceps.preferredMaximum);
  assert.ok(after.muscles.chest.effectiveTotal >= after.muscles.chest.preferredMinimum);
  assert.ok(after.muscles.triceps.effectiveTotal < before.muscles.triceps.effectiveTotal);
});

test("biceps excess is repaired by curls before rows", () => {
  const program = {
    sessions: [1, 2].map((day) => ({
      day,
      name: `Day ${day}`,
      exercises: [exercise("barbell-row", 5), exercise("cable-bicep-curl", 6)]
    }))
  };
  const profile = selectedOnlyProfile(["back", "biceps"]);
  const rowSetsBefore = totalSets(program, "barbell-row");
  const { repairs } = repairWorkoutProgram(program, profile);
  const ledger = buildVolumeLedger(program, profile);

  assert.equal(totalSets(program, "barbell-row"), rowSetsBefore);
  assert.ok(totalSets(program, "cable-bicep-curl") < 12);
  assert.ok(repairs.filter((message) => message.includes("biceps") && message.includes("direct isolation")).length > 0);
  assert.ok(ledger.muscles.biceps.effectiveTotal <= ledger.muscles.biceps.preferredMaximum);
});

test("compound contribution can close chest deficit while direct triceps excess is removed", () => {
  const program = {
    sessions: [1, 2].map((day) => ({
      day,
      name: `Day ${day}`,
      exercises: [exercise("barbell-bench-press", 3), exercise("cable-tricep-pushdown", 6)]
    }))
  };
  const profile = selectedOnlyProfile(["chest", "triceps"]);
  const before = buildVolumeLedger(program, profile);
  repairWorkoutProgram(program, profile);
  const after = buildVolumeLedger(program, profile);

  assert.ok(before.muscles.chest.effectiveTotal < before.muscles.chest.preferredMinimum);
  assert.ok(before.muscles.triceps.effectiveTotal > before.muscles.triceps.hardMaximum);
  assert.ok(after.muscles.chest.effectiveTotal >= after.muscles.chest.preferredMinimum);
  assert.ok(after.muscles.chest.effectiveTotal <= after.muscles.chest.preferredMaximum);
  assert.ok(after.muscles.triceps.effectiveTotal >= after.muscles.triceps.preferredMinimum);
  assert.ok(after.muscles.triceps.effectiveTotal <= after.muscles.triceps.preferredMaximum);
});

test("compound contribution can close back deficit while direct biceps excess is removed", () => {
  const program = {
    sessions: [1, 2].map((day) => ({
      day,
      name: `Day ${day}`,
      exercises: [exercise("barbell-row", 3), exercise("cable-bicep-curl", 6)]
    }))
  };
  const profile = selectedOnlyProfile(["back", "biceps"]);
  const before = buildVolumeLedger(program, profile);
  repairWorkoutProgram(program, profile);
  const after = buildVolumeLedger(program, profile);

  assert.ok(before.muscles.back.effectiveTotal < before.muscles.back.preferredMinimum);
  assert.ok(before.muscles.biceps.effectiveTotal > before.muscles.biceps.hardMaximum);
  assert.ok(after.muscles.back.effectiveTotal >= after.muscles.back.preferredMinimum);
  assert.ok(after.muscles.back.effectiveTotal <= after.muscles.back.preferredMaximum);
  assert.ok(after.muscles.biceps.effectiveTotal >= after.muscles.biceps.preferredMinimum);
  assert.ok(after.muscles.biceps.effectiveTotal <= after.muscles.biceps.preferredMaximum);
});

test("selected_only glutes/core removes unselected primary work but permits secondary credits", () => {
  const program = {
    sessions: [
      {
        name: "Mixed A",
        exercises: [
          exercise("barbell-bench-press", 3),
          exercise("barbell-row", 3),
          exercise("barbell-squat", 3),
          exercise("barbell-hip-thrust", 3),
          exercise("plank", 3),
          exercise("cable-crunch", 3)
        ]
      },
      {
        name: "Mixed B",
        exercises: [exercise("romanian-deadlift", 3), exercise("barbell-hip-thrust", 3), exercise("plank", 3)]
      }
    ]
  };
  const profile = {
    ...selectedOnlyProfile(["glutes", "core"]),
    equipment: ["barbell", "bodyweight", "cable"]
  };
  repairWorkoutProgram(program, profile);
  const ledger = buildVolumeLedger(program, profile);
  const primaryMuscles = program.sessions.flatMap((session) => session.exercises)
    .map((item) => primaryMuscleForExerciseId(item.exerciseId));

  assert.ok(primaryMuscles.length > 0);
  assert.ok(primaryMuscles.every((muscle) => ["glutes", "core"].includes(muscle)));
  assert.ok(ledger.muscles.hamstrings.effectiveTotal > 0, "hip thrust may still provide secondary hamstring credit");
  assert.equal(ledger.muscles.hamstrings.requirement, "optional");
  assert.equal(ledger.muscles.glutes.requirement, "required");
  assert.equal(ledger.muscles.core.requirement, "required");
});

test("selected_only arms keeps only biceps/triceps primaries", () => {
  const program = {
    sessions: [{
      name: "Arms",
      exercises: [
        exercise("barbell-bench-press", 4),
        exercise("barbell-row", 4),
        exercise("barbell-bicep-curl", 3),
        exercise("cable-tricep-pushdown", 3)
      ]
    }]
  };
  const profile = selectedOnlyProfile(["biceps", "triceps"], 1);
  repairWorkoutProgram(program, profile);
  assert.ok(program.sessions[0].exercises.every((item) => ["biceps", "triceps"].includes(primaryMuscleForExerciseId(item.exerciseId))));
});

test("prioritize processes the selected deficit first and keeps nonselected required muscles inside hard ranges", () => {
  const program = {
    sessions: [1, 2, 3].map((day) => ({
      day,
      name: `Day ${day}`,
      exercises: [
        exercise("barbell-bench-press", 3), exercise("barbell-row", 3), exercise("barbell-squat", 1),
        exercise("barbell-shoulder-press", 2),
        exercise("barbell-bicep-curl", 2), exercise("cable-tricep-pushdown", 2),
        exercise("standing-calf-raise", 2)
      ]
    }))
  };
  const profile = {
    experience: "beginner",
    priority: "hypertrophy",
    daysPerWeek: 3,
    sessionDuration: 150,
    equipment: ["barbell", "cable", "machine"],
    muscleFocusMode: "prioritize",
    selectedMuscles: ["glutes"],
    applyVolumeTargets: true
  };
  const { repairs } = repairWorkoutProgram(program, profile);
  const ledger = buildVolumeLedger(program, profile);
  const firstVolumeIncrease = repairs.find((message) => message.includes("increased") || message.includes("added"));

  assert.ok(firstVolumeIncrease?.includes("glutes"), `selected glutes should be allocated first: ${firstVolumeIncrease}`);
  for (const entry of Object.values(ledger.muscles).filter((item) => item.requirement === "required")) {
    assert.ok(entry.effectiveTotal >= entry.hardMinimum, `${entry.muscle} must remain above hard minimum`);
    assert.ok(entry.effectiveTotal <= entry.hardMaximum, `${entry.muscle} must remain below hard maximum`);
  }
});

test("duration repair removes redundant isolation before essential compounds", () => {
  const program = {
    sessions: [{
      name: "Long upper",
      exercises: [
        exercise("barbell-bench-press", 6, { restSeconds: 180 }),
        exercise("incline-dumbbell-bench-press", 6, { restSeconds: 180 }),
        exercise("diamond-push-up", 6, { restSeconds: 180 }),
        exercise("cable-tricep-pushdown", 6, { restSeconds: 180 }),
        exercise("overhead-tricep-extension", 6, { restSeconds: 180 })
      ]
    }]
  };
  const context = {
    ...selectedOnlyProfile(["chest", "triceps"], 1),
    equipment: ["barbell", "dumbbell", "bodyweight", "cable"],
    sessionDuration: 20,
    applyVolumeTargets: false
  };
  repairWorkoutProgram(program, context);
  const ids = program.sessions[0].exercises.map((item) => item.exerciseId);

  assert.ok(ids.includes("barbell-bench-press"));
  assert.ok(ids.includes("incline-dumbbell-bench-press"));
  assert.ok(!ids.includes("cable-tricep-pushdown") || !ids.includes("overhead-tricep-extension"));
});

test("reconstructed beginner allocation improves quality and terminates with finite ledger values", () => {
  const template = [
    ["barbell-bench-press", 4], ["barbell-row", 4], ["barbell-squat", 4], ["romanian-deadlift", 3],
    ["barbell-shoulder-press", 3], ["standing-calf-raise-machine", 3], ["plank", 2], ["cable-tricep-pushdown", 6]
  ];
  const program = {
    sessions: [1, 2, 3].map((day) => ({
      day,
      name: `Day ${day}`,
      exercises: template.map(([id, sets]) => exercise(id, sets))
    }))
  };
  const profile = {
    experience: "beginner", priority: "hypertrophy", daysPerWeek: 3, sessionDuration: 120,
    equipment: ["barbell", "machine", "cable", "bodyweight"], muscleFocusMode: "balanced", selectedMuscles: [], applyVolumeTargets: true
  };
  const before = buildQualityDiagnostic(program, profile);
  const { repairs } = repairWorkoutProgram(program, profile);
  const after = buildQualityDiagnostic(program, profile);

  console.log("Workout Engine V2 reconstructed beginner before/after:", JSON.stringify({ before: before.score, after: after.score, repairs: repairs.length }));
  assert.ok(after.score > before.score, `quality should improve (${before.score} -> ${after.score})`);
  assert.ok(repairs.length < 200, "repair must terminate within bounded progress limits");
  for (const entry of Object.values(after.perMuscle)) {
    for (const key of ["directSets", "fractionalIndirectSets", "effectiveTotal", "remainingDeficit", "amountAbovePreferred"]) {
      assert.ok(Number.isFinite(entry[key]), `${entry.muscle}.${key} must be finite`);
    }
  }
});

test("four-day Gym hypertrophy reconstructions improve beginner, intermediate and advanced allocation", () => {
  const template = [
    ["barbell-bench-press", 3], ["barbell-row", 3], ["barbell-squat", 3], ["romanian-deadlift", 2],
    ["barbell-shoulder-press", 2], ["standing-calf-raise-machine", 2], ["plank", 2], ["cable-tricep-pushdown", 2]
  ];
  const results = {};

  for (const experience of ["beginner", "intermediate", "advanced"]) {
    const program = {
      sessions: [1, 2, 3, 4].map((day) => ({
        day,
        name: `Day ${day}`,
        exercises: template.map(([id, sets]) => exercise(id, sets))
      }))
    };
    const profile = {
      experience,
      priority: "hypertrophy",
      daysPerWeek: 4,
      sessionDuration: 150,
      equipment: ["barbell", "machine", "bodyweight", "cable"],
      muscleFocusMode: "balanced",
      selectedMuscles: [],
      applyVolumeTargets: true
    };
    const before = buildQualityDiagnostic(program, profile);
    repairWorkoutProgram(program, profile);
    const after = buildQualityDiagnostic(program, profile);
    const ledger = buildVolumeLedger(program, profile);

    assert.ok(after.score > before.score, `${experience} quality must improve`);
    for (const entry of Object.values(ledger.muscles).filter((item) => item.requirement === "required")) {
      assert.ok(entry.effectiveTotal >= entry.hardMinimum, `${experience}/${entry.muscle} below hard minimum`);
      assert.ok(entry.effectiveTotal <= entry.hardMaximum, `${experience}/${entry.muscle} above hard maximum`);
    }
    assert.equal(ledger.muscles.triceps.directSets, 0, `${experience} avoidable direct triceps isolation should be removed`);
    results[experience] = {
      quality: [before.score, after.score],
      chest: ledger.muscles.chest.effectiveTotal,
      triceps: ledger.muscles.triceps.effectiveTotal
    };
  }

  assert.ok(results.beginner.chest >= 10 && results.beginner.chest <= 13);
  assert.ok(results.beginner.triceps >= 6 && results.beginner.triceps <= 8);
  assert.ok(results.advanced.chest >= 14 && results.advanced.chest <= 18);
  assert.ok(results.advanced.triceps >= 8 && results.advanced.triceps <= 11);
  console.log("Workout Engine V2 four-day reconstruction summary:", JSON.stringify(results));
});

test("prompt contracts make ledger arithmetic authoritative and keep the public quality API stable", () => {
  const source = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
  assert.match(source, /Exact deterministic programming constraints for this request/);
  assert.match(source, /direct primary work contributes fully while approved secondary compound contributions contribute fractionally/);
  assert.match(source, /server's authoritative set-credit ledger recalculates all arithmetic/);
  assert.match(source, /Authoritative effective-volume ledger/);
  assert.match(source, /reduce or remove redundant direct isolation before changing compounds/);
  assert.match(source, /qualityScore: privateQualityDiagnostic\.score/);
});

test("Romanian deadlift remains the approved Barbell media-backed exercise", () => {
  const rdl = getCatalogExercise("romanian-deadlift");
  assert.equal(rdl.equipment, "Barbell");
  assert.equal(rdl.image, "romanian-deadlift.png");
  assert.equal(rdl.setCredits.hamstrings, 1);
  assert.equal(getCatalogExercise("dumbbell-romanian-deadlift"), undefined);
});
