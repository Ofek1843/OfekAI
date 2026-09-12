"use strict";

// Deterministic plan mutation for the Weekly Muscle Volume controls.  This is
// intentionally separate from the UI: both local/demo and production receive
// the same equipment, level, set-credit and four-working-set safeguards.
const { calculateWeeklyVolume } = require("./workout-volume");
const { EXERCISE_SETCREDITS } = require("./workout-setcredits-map");
const { canonicalizeExerciseId, getCatalogExercise, getEnabledPublicExerciseIds } = require("./workout-exercise-catalog");
const { normalizeEquipment } = require("./workout-validator");
const { isExerciseLevelSuitable } = require("./exercise-suitability");
const { allVolumePolicies } = require("./workout-volume-targets");
const { estimateSessionDuration } = require("./workout-duration");

const MAX_WORKING_SETS_PER_EXERCISE = 4;
const MIN_MEANINGFUL_SETS = 2;

function cloneProgram(program) {
  return JSON.parse(JSON.stringify(program));
}

function canonicalMuscle(value) {
  return String(value || "").trim().toLowerCase();
}

function directCredit(exerciseId, muscle) {
  return Number(EXERCISE_SETCREDITS[canonicalizeExerciseId(exerciseId)]?.[muscle]) || 0;
}

function durationFor(session) {
  return Number(estimateSessionDuration(session)?.estimatedMinutes) || 0;
}

function fitsSessionBudget(session, profile) {
  const limit = Number(profile?.sessionDuration);
  return !Number.isFinite(limit) || limit <= 0 || durationFor(session) <= limit * 1.1;
}

function exerciseFromCatalog(id, muscle, language, limitations) {
  const entry = getCatalogExercise(id);
  if (!entry) return null;
  const isSkill = /planche|front-lever|handstand|l-sit|one-arm-pull-up|muscle-up/.test(id);
  return {
    exerciseId: id,
    name: entry.title,
    demoName: entry.title,
    muscleGroup: muscle,
    equipment: entry.equipment,
    // A new exercise starts with two meaningful working sets; subsequent
    // presses may add one set only until the universal cap of four.
    sets: MIN_MEANINGFUL_SETS,
    reps: isSkill ? "8-15 sec" : "8-12",
    restSeconds: isSkill ? 150 : 90,
    rir: isSkill ? "1-2" : "1-3",
    notes: limitations && limitations !== "None"
      ? `Respect this limitation: ${String(limitations).slice(0, 160)}`
      : language === "he"
        ? "הוסיפו חזרות בטווח לפני הגדלת העומס."
        : "Add repetitions within the range before increasing load."
  };
}

function isHardMaximumSafe(program, profile) {
  const { perMuscle } = calculateWeeklyVolume(program, EXERCISE_SETCREDITS);
  const policies = allVolumePolicies(profile);
  return Object.entries(policies).every(([muscle, policy]) =>
    (Number(perMuscle[muscle]?.total) || 0) <= Number(policy.hardMaximum)
  );
}

function mutationResult(program, profile, change) {
  const volume = calculateWeeklyVolume(program, EXERCISE_SETCREDITS);
  return { changed: true, program, volume, change };
}

function noChange(reason) {
  return { changed: false, reason };
}

function compatibleCandidates({ muscle, equipment, experience, usedIds }) {
  const allowed = new Set((equipment || []).map(normalizeEquipment).filter(Boolean));
  return getEnabledPublicExerciseIds()
    .filter((rawId) => {
      const id = canonicalizeExerciseId(rawId);
      const entry = getCatalogExercise(id);
      return entry && !usedIds.has(id) && isExerciseLevelSuitable(id, experience) &&
        allowed.has(normalizeEquipment(entry.equipment)) && directCredit(id, muscle) >= 1;
    })
    .map((id) => ({ id: canonicalizeExerciseId(id), entry: getCatalogExercise(id) }))
    // Prefer an isolation movement for supplementary volume. If none exists,
    // the stable id ordering gives deterministic reruns without inventing a
    // movement outside the selected equipment/level.
    .sort((left, right) => {
      const leftSpecificity = Object.keys(left.entry.setCredits || {}).length;
      const rightSpecificity = Object.keys(right.entry.setCredits || {}).length;
      return leftSpecificity - rightSpecificity || left.id.localeCompare(right.id);
    });
}

function adjustWorkoutVolume({ program, muscle, delta, profile = {}, language = "en", limitations = "None" } = {}) {
  if (!program || !Array.isArray(program.sessions)) return noChange("invalid-program");
  const targetMuscle = canonicalMuscle(muscle);
  if (!targetMuscle || !Number.isInteger(Number(delta)) || !delta) return noChange("invalid-request");

  const next = cloneProgram(program);
  const policies = allVolumePolicies(profile);
  const currentVolume = calculateWeeklyVolume(next, EXERCISE_SETCREDITS);
  const currentTotal = Number(currentVolume.perMuscle[targetMuscle]?.total) || 0;
  const policy = policies[targetMuscle];
  if (!policy) return noChange("unsupported-muscle");

  if (delta > 0) {
    if (currentTotal >= Number(policy.hardMaximum)) return noChange("hard-maximum");
    const existing = [];
    next.sessions.forEach((session, sessionIndex) => session.exercises?.forEach((exercise, exerciseIndex) => {
      if (directCredit(exercise.exerciseId, targetMuscle) >= 1 && Number(exercise.sets) < MAX_WORKING_SETS_PER_EXERCISE) {
        existing.push({ session, sessionIndex, exercise, exerciseIndex });
      }
    }));
    existing.sort((a, b) => Number(a.exercise.sets) - Number(b.exercise.sets) || durationFor(a.session) - durationFor(b.session) || a.sessionIndex - b.sessionIndex);
    for (const candidate of existing) {
      candidate.exercise.sets = Math.min(MAX_WORKING_SETS_PER_EXERCISE, Number(candidate.exercise.sets) + 1);
      if (fitsSessionBudget(candidate.session, profile) && isHardMaximumSafe(next, profile)) {
        return mutationResult(next, profile, {
          action: "added-set", sessionIndex: candidate.sessionIndex, day: candidate.session.day || candidate.sessionIndex + 1,
          exerciseName: candidate.exercise.name, setsDelta: 1, muscle: targetMuscle
        });
      }
      candidate.exercise.sets -= 1;
    }

    const sessions = next.sessions.map((session, sessionIndex) => ({ session, sessionIndex }))
      .sort((a, b) => durationFor(a.session) - durationFor(b.session) || a.session.exercises.length - b.session.exercises.length || a.sessionIndex - b.sessionIndex);
    for (const candidateSession of sessions) {
      const usedIds = new Set(candidateSession.session.exercises.map((exercise) => canonicalizeExerciseId(exercise.exerciseId)));
      const candidate = compatibleCandidates({ muscle: targetMuscle, equipment: profile.equipment || [], experience: profile.experience, usedIds })[0];
      if (!candidate) continue;
      const exercise = exerciseFromCatalog(candidate.id, targetMuscle, language, limitations);
      candidateSession.session.exercises.push(exercise);
      if (fitsSessionBudget(candidateSession.session, profile) && isHardMaximumSafe(next, profile)) {
        return mutationResult(next, profile, {
          action: "added-exercise", sessionIndex: candidateSession.sessionIndex, day: candidateSession.session.day || candidateSession.sessionIndex + 1,
          exerciseName: exercise.name, setsDelta: exercise.sets, muscle: targetMuscle
        });
      }
      candidateSession.session.exercises.pop();
    }
    return noChange("hard-maximum");
  }

  const removable = [];
  next.sessions.forEach((session, sessionIndex) => session.exercises?.forEach((exercise, exerciseIndex) => {
    const direct = directCredit(exercise.exerciseId, targetMuscle);
    if (direct < 1) return;
    const specificity = Object.keys(EXERCISE_SETCREDITS[canonicalizeExerciseId(exercise.exerciseId)] || {}).length;
    removable.push({ session, sessionIndex, exercise, exerciseIndex, specificity });
  }));
  // Preserve compounds first: remove/reduce the most specific accessory work
  // before movements that contribute to several muscle groups.
  removable.sort((a, b) => a.specificity - b.specificity || Number(b.exercise.sets) - Number(a.exercise.sets) || b.sessionIndex - a.sessionIndex);
  for (const candidate of removable) {
    const sets = Number(candidate.exercise.sets) || 0;
    if (sets > MIN_MEANINGFUL_SETS) {
      candidate.exercise.sets = sets - 1;
      return mutationResult(next, profile, {
        action: "removed-set", sessionIndex: candidate.sessionIndex, day: candidate.session.day || candidate.sessionIndex + 1,
        exerciseName: candidate.exercise.name, setsDelta: -1, muscle: targetMuscle
      });
    }
    if (sets >= MIN_MEANINGFUL_SETS && candidate.session.exercises.length > 1) {
      candidate.session.exercises.splice(candidate.exerciseIndex, 1);
      return mutationResult(next, profile, {
        action: "removed-exercise", sessionIndex: candidate.sessionIndex, day: candidate.session.day || candidate.sessionIndex + 1,
        exerciseName: candidate.exercise.name, setsDelta: -sets, muscle: targetMuscle
      });
    }
  }
  return noChange("minimum-program");
}

module.exports = { adjustWorkoutVolume, MAX_WORKING_SETS_PER_EXERCISE, MIN_MEANINGFUL_SETS };
