"use strict";

const { MUSCLE_POLICY } = require("./workout-volume-targets");
const { getCatalogExercise } = require("./workout-exercise-catalog");

const MUSCLE_FOCUS_MODES = Object.freeze(["balanced", "prioritize", "selected_only"]);
const CANONICAL_MUSCLES = Object.freeze(Object.keys(MUSCLE_POLICY));
const MUSCLE_ALIASES = Object.freeze({
  shoulders: "delts",
  shoulder: "delts",
  quadriceps: "quads",
  quad: "quads",
  hamstring: "hamstrings",
  glute: "glutes",
  calf: "calves",
  abs: "core",
  abdominals: "core",
  "rear-delt": "rear_delts",
  "rear-delts": "rear_delts",
  "rear-deltoids": "rear_delts"
});

function normalizeMuscleIdentifier(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const aliasKey = normalized.replace(/_/g, "-");
  return MUSCLE_ALIASES[aliasKey] || MUSCLE_ALIASES[normalized] || normalized;
}

function normalizeMuscleFocusContract(input = {}, options = {}) {
  const { strict = true } = options;
  const rawMode = input.muscleFocusMode == null || input.muscleFocusMode === ""
    ? "balanced"
    : String(input.muscleFocusMode).trim().toLowerCase();
  const errors = [];
  const mode = MUSCLE_FOCUS_MODES.includes(rawMode) ? rawMode : "balanced";
  if (!MUSCLE_FOCUS_MODES.includes(rawMode)) errors.push(`Unknown muscleFocusMode: ${rawMode}`);

  const rawSelected = input.selectedMuscles == null ? [] : input.selectedMuscles;
  if (!Array.isArray(rawSelected)) errors.push("selectedMuscles must be an array.");
  const selectedMuscles = [...new Set(
    (Array.isArray(rawSelected) ? rawSelected : [])
      .map(normalizeMuscleIdentifier)
      .filter(Boolean)
  )];
  const unknownMuscles = selectedMuscles.filter((muscle) => !CANONICAL_MUSCLES.includes(muscle));
  if (unknownMuscles.length) errors.push(`Unknown selected muscle identifiers: ${unknownMuscles.join(", ")}`);

  const validSelectedMuscles = selectedMuscles.filter((muscle) => CANONICAL_MUSCLES.includes(muscle));
  if ((mode === "prioritize" || mode === "selected_only") && validSelectedMuscles.length === 0) {
    errors.push(`${mode} requires at least one selected muscle.`);
  }

  return {
    ok: strict ? errors.length === 0 : true,
    errors,
    muscleFocusMode: strict && errors.length ? mode : mode,
    selectedMuscles: validSelectedMuscles
  };
}

function primaryMuscleForExerciseId(exerciseId) {
  const entry = getCatalogExercise(exerciseId);
  if (!entry?.setCredits) return "";
  const direct = Object.entries(entry.setCredits).find(([, credit]) => Number(credit) === 1);
  return direct?.[0] || Object.keys(entry.setCredits)[0] || "";
}

function isPrimaryMuscleAllowed(exerciseId, focus = {}) {
  if (focus.muscleFocusMode !== "selected_only") return true;
  const primaryMuscle = primaryMuscleForExerciseId(exerciseId);
  return Boolean(primaryMuscle && new Set(focus.selectedMuscles || []).has(primaryMuscle));
}

module.exports = {
  MUSCLE_FOCUS_MODES,
  CANONICAL_MUSCLES,
  normalizeMuscleIdentifier,
  normalizeMuscleFocusContract,
  primaryMuscleForExerciseId,
  isPrimaryMuscleAllowed
};
