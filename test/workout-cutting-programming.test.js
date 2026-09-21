"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { repairWorkoutProgram } = require("../lib/workout-repair");
const { targetRangeForMuscle } = require("../lib/workout-volume-targets");
const { calculateWeeklyVolume } = require("../lib/workout-volume");
const { getPublicSetCredits } = require("../lib/workout-exercise-catalog");

function exercise(exerciseId, name, muscleGroup, equipment, reps, restSeconds) {
  return { exerciseId, name, demoName: name, muscleGroup, equipment, sets: 4, reps, restSeconds, rir: "1-3", notes: "" };
}

test("fat-loss repair applies recoverable rests and slightly higher working rep ranges", () => {
  const program = {
    goal: "loseFat",
    sessions: [{
      day: 1,
      name: "Upper",
      exercises: [
        exercise("barbell-bench-press", "Barbell Bench Press", "Chest", "Barbell", "4-6", 180),
        exercise("dumbbell-bicep-curl", "Dumbbell Bicep Curl", "Biceps", "Dumbbell", "6-10", 150)
      ]
    }]
  };

  repairWorkoutProgram(program, {
    goal: "loseFat",
    experience: "intermediate",
    equipment: ["barbell", "dumbbell"],
    sessionDuration: 90,
    applyVolumeTargets: false
  });

  const [bench, curl] = program.sessions[0].exercises;
  assert.equal(bench.reps, "8-12");
  assert.equal(bench.restSeconds, 90);
  assert.equal(curl.reps, "10-15");
  assert.equal(curl.restSeconds, 75);
  assert.ok(program.sessions[0].exercises.every((item) => item.sets <= 4));
});

test("fat-loss volume ceiling is lower than the general-fitness ceiling without claiming zero productive work", () => {
  const generalFitness = targetRangeForMuscle("chest", {
    experience: "intermediate", priority: "generalFitness", daysPerWeek: 4
  });
  const fatLoss = targetRangeForMuscle("chest", {
    goal: "loseFat", experience: "intermediate", priority: "generalFitness", daysPerWeek: 4
  });

  assert.equal(generalFitness.max, 17);
  assert.equal(fatLoss.max, 13);
  assert.ok(fatLoss.min >= 2);
  assert.ok(fatLoss.max < generalFitness.max);
});

test("fat-loss volume repair reduces a mass-phase chest allocation instead of accepting 16 direct sets", () => {
  const program = {
    goal: "loseFat",
    sessions: [1, 2, 3, 4].map((day) => ({
      day,
      name: `Upper ${day}`,
      exercises: [exercise("barbell-bench-press", "Barbell Bench Press", "Chest", "Barbell", "8-12", 90)]
    }))
  };
  const profile = {
    goal: "loseFat",
    priority: "generalFitness",
    experience: "intermediate",
    daysPerWeek: 4,
    sessionDuration: 60,
    equipment: ["barbell"],
    muscleFocusMode: "selected_only",
    selectedMuscles: ["chest"],
    applyVolumeTargets: true
  };

  repairWorkoutProgram(program, profile);
  const chest = calculateWeeklyVolume(program, getPublicSetCredits()).perMuscle.chest.total;
  const range = targetRangeForMuscle("chest", profile);
  assert.ok(chest <= range.max, `expected cutting chest volume <= ${range.max}, received ${chest}`);
  assert.ok(chest < 16, "a cutting plan must not retain the original mass-phase chest allocation");
});
