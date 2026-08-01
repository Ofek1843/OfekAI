"use strict";

const { getEnabledPublicExerciseIds, getCatalogExercise } = require("./workout-exercise-catalog");
const { normalizeEquipment } = require("./workout-validator");

const MUSCLE_ORDER = ["chest", "back", "quads", "hamstrings", "glutes", "delts", "biceps", "triceps", "calves", "core"];

function buildLocalWorkoutProgram({ goal = "buildMuscle", daysPerWeek = 3, sessionDuration = 60, equipment = [], trainingStyle = "gym", limitations = "None", language = "en" } = {}) {
  const allowed = new Set((Array.isArray(equipment) ? equipment : [equipment]).map(normalizeEquipment).filter(Boolean));
  const ids = getEnabledPublicExerciseIds().filter((id) => {
    const entry = getCatalogExercise(id);
    return entry && allowed.has(normalizeEquipment(entry.equipment));
  });
  const candidatesByMuscle = new Map();
  for (const id of ids) {
    const entry = getCatalogExercise(id);
    for (const [muscle, credit] of Object.entries(entry?.setCredits || {})) {
      if (credit !== 1) continue;
      if (!candidatesByMuscle.has(muscle)) candidatesByMuscle.set(muscle, []);
      candidatesByMuscle.get(muscle).push(id);
    }
  }
  for (const [muscle, candidates] of candidatesByMuscle) {
    candidates.sort((a, b) => {
      const rank = (id) => muscle === "glutes"
        ? (id.includes("hip-thrust") ? 0 : /^(adductors|abductors)$/.test(id) ? 2 : 1)
        : 0;
      return rank(a) - rank(b) || a.localeCompare(b);
    });
  }
  const exerciseCount = Number(sessionDuration) < 40 ? 4 : Number(sessionDuration) < 55 ? 6 : 8;
  const baseMuscles = MUSCLE_ORDER.filter((muscle) => candidatesByMuscle.has(muscle));
  if (!baseMuscles.length) throw Object.assign(new Error("No compatible local exercises are available."), { status: 422 });

  const sessions = Array.from({ length: Number(daysPerWeek) }, (_, index) => {
    const selected = [];
    const rotation = [...baseMuscles.slice(index % Math.max(1, baseMuscles.length)), ...baseMuscles.slice(0, index % Math.max(1, baseMuscles.length))];
    for (const muscle of rotation) {
      const id = candidatesByMuscle.get(muscle)?.find((candidate) => !selected.includes(candidate));
      if (id) selected.push(id);
      if (selected.length >= exerciseCount) break;
    }
    const exercises = selected.map((id) => {
      const entry = getCatalogExercise(id);
      return {
        exerciseId: id,
        name: entry.title,
        demoName: entry.title,
        muscleGroup: Object.keys(entry.setCredits || {})[0] || "general",
        equipment: entry.equipment,
        sets: Number(sessionDuration) < 40 ? 2 : 3,
        reps: "8-12",
        restSeconds: 90,
        rir: "1-3",
        notes: limitations && limitations !== "None" ? `Respect this limitation: ${String(limitations).slice(0, 160)}` : "Add repetitions within the range before increasing load."
      };
    });
    return { day: index + 1, name: `Local Demo Session ${index + 1}`, exercises };
  });

  return {
    programName: language === "he" ? "תוכנית אימון מקומית" : `Local Demo ${String(goal).replaceAll(/([A-Z])/g, " $1").trim()} Program`,
    daysPerWeek: Number(daysPerWeek),
    durationWeeks: 8,
    goal: String(goal),
    trainingStyle: String(trainingStyle),
    sessions
  };
}

module.exports = { buildLocalWorkoutProgram };
