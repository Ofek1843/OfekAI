"use strict";

const { canonicalizeExerciseId, getCatalogExercise, getEnabledPublicExerciseIds, isPublicExerciseEnabled } = require("./workout-exercise-catalog");
const { isExerciseLevelSuitable } = require("./exercise-suitability");
const { classifyDeclaredSessionSplit, classifyExplicitSessionSplit } = require("./workout-program-identity");

const UPPER_MUSCLES = new Set(["chest", "back", "delts", "rear_delts", "traps", "biceps", "triceps"]);
const LOWER_MUSCLES = new Set(["quads", "hamstrings", "glutes", "calves"]);
const PUSH_MUSCLES = new Set(["chest", "delts", "triceps"]);
const PULL_MUSCLES = new Set(["back", "biceps", "rear_delts", "traps"]);

function primaryMuscleForExercise(exerciseOrId) {
  const id = typeof exerciseOrId === "string"
    ? canonicalizeExerciseId(exerciseOrId)
    : canonicalizeExerciseId(exerciseOrId?.exerciseId || exerciseOrId?.demoName || exerciseOrId?.name || "");
  const credits = getCatalogExercise(id)?.setCredits || {};
  return Object.entries(credits)
    .sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || "";
}

function splitCategoryForMuscle(muscle) {
  if (UPPER_MUSCLES.has(muscle)) return "upper";
  if (LOWER_MUSCLES.has(muscle)) return "lower";
  if (muscle === "core") return "core";
  return "unknown";
}

function splitCategoryForExercise(exerciseOrId) {
  return splitCategoryForMuscle(primaryMuscleForExercise(exerciseOrId));
}

function isExerciseCompatibleWithSplit(exerciseOrId, split) {
  const category = splitCategoryForExercise(exerciseOrId);
  if (!split || split === "full" || split === "personalized") return true;
  if (category === "core") return true;
  if (split === "upper") return category === "upper";
  if (split === "lower" || split === "legs") return category === "lower";
  const muscle = primaryMuscleForExercise(exerciseOrId);
  if (split === "push") return PUSH_MUSCLES.has(muscle);
  if (split === "pull") return PULL_MUSCLES.has(muscle);
  return false;
}

function explicitSplitForSession(session) {
  return classifyExplicitSessionSplit(session);
}

function splitCompatibilityIssues(program) {
  const issues = [];
  for (const [sessionIndex, session] of (program?.sessions || []).entries()) {
    const declared = classifyDeclaredSessionSplit(session);
    const named = classifyExplicitSessionSplit({ name: session?.name });
    const split = declared && named && declared !== named ? named : explicitSplitForSession(session);
    if (!split || split === "full") continue;
    for (const exercise of session.exercises || []) {
      if (!isExerciseCompatibleWithSplit(exercise, split)) {
        const name = exercise?.name || exercise?.exerciseId || "Unknown exercise";
        const muscle = primaryMuscleForExercise(exercise) || "unclassified";
        issues.push(`Session ${sessionIndex + 1} (${split}): ${name} has primary muscle ${muscle}, which is incompatible with this split.`);
      }
    }
  }
  return issues;
}

function splitDeclarationIssues(program, { required = false } = {}) {
  const issues = [];
  for (const [sessionIndex, session] of (program?.sessions || []).entries()) {
    const declared = classifyDeclaredSessionSplit(session);
    const named = classifyExplicitSessionSplit({ name: session?.name });
    if (required && !declared) {
      issues.push(`Session ${sessionIndex + 1} must declare a valid splitType.`);
    }
    if (declared && named && declared !== named) {
      issues.push(`Session ${sessionIndex + 1} declares ${declared} but its name identifies ${named}.`);
    }
  }
  return issues;
}

function normalizedEquipment(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "").replace(/s$/, "");
}

function findCompatibleSplitReplacement({
  exercise,
  split,
  experience,
  equipment = [],
  reservedExerciseIds = [],
  selectedMuscles = [],
  sessionExercises = []
} = {}) {
  if (!split || split === "full") return null;
  const allowedEquipment = new Set(equipment.map(normalizedEquipment).filter(Boolean));
  const reserved = new Set(reservedExerciseIds.map(canonicalizeExerciseId).filter(Boolean));
  for (const sibling of sessionExercises) {
    const id = canonicalizeExerciseId(sibling?.exerciseId || sibling?.name || "");
    if (id) reserved.add(id);
  }
  const originalId = canonicalizeExerciseId(exercise?.exerciseId || exercise?.demoName || exercise?.name || "");
  const selected = new Set(selectedMuscles);
  const work = new Map();
  for (const sibling of sessionExercises) {
    const muscle = primaryMuscleForExercise(sibling);
    if (muscle) work.set(muscle, (work.get(muscle) || 0) + (Number(sibling.sets) || 0));
  }

  const candidates = getEnabledPublicExerciseIds()
    .map((exerciseId) => ({ exerciseId, entry: getCatalogExercise(exerciseId) }))
    .filter(({ exerciseId, entry }) => {
      if (!entry || !isPublicExerciseEnabled(exerciseId) || exerciseId === originalId || reserved.has(exerciseId)) return false;
      if (!isExerciseLevelSuitable(exerciseId, experience)) return false;
      if (allowedEquipment.size && !allowedEquipment.has(normalizedEquipment(entry.equipment))) return false;
      if (!isExerciseCompatibleWithSplit(exerciseId, split)) return false;
      const primaryMuscle = primaryMuscleForExercise(exerciseId);
      if (!primaryMuscle) return false;
      if (selected.size && !selected.has(primaryMuscle)) return false;
      return true;
    })
    .sort((a, b) => {
      const aMuscle = primaryMuscleForExercise(a.exerciseId);
      const bMuscle = primaryMuscleForExercise(b.exerciseId);
      const aEquipmentPenalty = normalizedEquipment(a.entry.equipment) === normalizedEquipment(exercise?.equipment) ? 0 : 1;
      const bEquipmentPenalty = normalizedEquipment(b.entry.equipment) === normalizedEquipment(exercise?.equipment) ? 0 : 1;
      return aEquipmentPenalty - bEquipmentPenalty
        || (work.get(aMuscle) || 0) - (work.get(bMuscle) || 0)
        || a.exerciseId.localeCompare(b.exerciseId);
    });

  const replacement = candidates[0];
  if (!replacement) return null;
  const primaryMuscle = primaryMuscleForExercise(replacement.exerciseId);
  return {
    exerciseId: replacement.exerciseId,
    name: replacement.entry.title,
    demoName: replacement.entry.title,
    muscleGroup: primaryMuscle,
    equipment: replacement.entry.equipment
  };
}

function repairSplitIncompatibleExercises(program, context = {}, repairs = []) {
  if (!Array.isArray(program?.sessions)) return repairs;
  for (const [sessionIndex, session] of program.sessions.entries()) {
    const split = explicitSplitForSession(session);
    if (!split || split === "full" || !Array.isArray(session.exercises)) continue;
    const sessionOriginal = [...session.exercises];
    const used = new Set(sessionOriginal
      .map((exercise) => canonicalizeExerciseId(exercise?.exerciseId || exercise?.name || ""))
      .filter(Boolean));

    session.exercises = sessionOriginal.filter((exercise) => {
      if (isExerciseCompatibleWithSplit(exercise, split)) return true;
      const primaryMuscle = primaryMuscleForExercise(exercise) || "unclassified";
      const replacement = findCompatibleSplitReplacement({
        exercise,
        split,
        experience: context.experience,
        equipment: Array.isArray(context.equipment) ? context.equipment : [],
        reservedExerciseIds: [...used].filter((id) => id !== canonicalizeExerciseId(exercise?.exerciseId || exercise?.name || "")),
        selectedMuscles: context.muscleFocusMode === "selected_only" ? (context.selectedMuscles || []) : [],
        sessionExercises: sessionOriginal.filter((sibling) => sibling !== exercise)
      });
      const oldId = canonicalizeExerciseId(exercise?.exerciseId || exercise?.name || "");
      if (replacement) {
        Object.assign(exercise, replacement);
        used.delete(oldId);
        used.add(replacement.exerciseId);
        repairs.push(`Session ${sessionIndex + 1} (${split}): replaced ${oldId || exercise.name} (primary ${primaryMuscle}) with ${replacement.exerciseId} to preserve split compatibility.`);
        return true;
      }

      used.delete(oldId);
      // Keep the invalid item in the in-memory candidate so the final
      // validator rejects the whole plan. Silently dropping it can leave an
      // incomplete session that otherwise passes validation, hiding the fact
      // that no valid split-compatible replacement was available.
      used.add(oldId);
      repairs.push(`Session ${sessionIndex + 1} (${split}): no eligible split-compatible catalog replacement for ${oldId || exercise.name} (primary ${primaryMuscle}); left unchanged so validation fails closed.`);
      return true;
    });
  }
  return repairs;
}

module.exports = {
  explicitSplitForSession,
  findCompatibleSplitReplacement,
  isExerciseCompatibleWithSplit,
  primaryMuscleForExercise,
  repairSplitIncompatibleExercises,
  splitCategoryForExercise,
  splitDeclarationIssues,
  splitCompatibilityIssues
};
