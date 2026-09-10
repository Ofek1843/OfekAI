"use strict";
const { isExerciseLevelSuitable } = require("./exercise-suitability");

const {
  canonicalizeExerciseId,
  getCatalogExercise,
  getEnabledPublicExerciseIds
} = require("./workout-exercise-catalog");
const { normalizeEquipment } = require("./workout-validator");
const { derivePriorityFromGoal } = require("./workout-priority");
const {
  classifyMuscleRequirement,
  volumePolicyForMuscle,
  REQUIRED_MUSCLES
} = require("./workout-volume-targets");

const MUSCLE_ORDER = [
  "chest", "back", "quads", "hamstrings", "glutes",
  "delts", "biceps", "triceps", "calves", "core"
];

function secondaryCreditTotal(setCredits = {}, primaryMuscle) {
  return Object.entries(setCredits)
    .filter(([muscle]) => muscle !== primaryMuscle)
    .reduce((total, [, credit]) => total + (Number(credit) > 0 ? Number(credit) : 0), 0);
}

function candidateRank(id, entry, muscle) {
  const secondary = secondaryCreditTotal(entry.setCredits, muscle);
  const directOnly = secondary === 0 ? 0 : 1;
  const undesirableGluteIsolation = muscle === "glutes" && id === "abductors" ? 1 : 0;
  const compoundPreference = muscle === "glutes" && id.includes("hip-thrust") ? 0 : 1;
  return [undesirableGluteIsolation, directOnly, compoundPreference, secondary, id];
}

function compareRank(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] === right[index]) continue;
    if (typeof left[index] === "string" || typeof right[index] === "string") {
      return String(left[index]).localeCompare(String(right[index]));
    }
    return left[index] - right[index];
  }
  return 0;
}

const PROFESSIONAL_CALISTHENICS_IDS = new Set([
  "planche", "straddle-planche", "front-lever", "front-lever-raise",
  "one-arm-pull-up", "muscle-up", "handstand-push-up", "typewriter-pull-ups",
  "archer-push-up", "pistol-squat", "l-sit", "handstand"
]);
const PROFESSIONAL_CALISTHENICS_RANK = [
  "planche", "straddle-planche", "front-lever", "front-lever-raise",
  "one-arm-pull-up", "muscle-up", "handstand-push-up", "typewriter-pull-ups",
  "archer-push-up", "pistol-squat", "l-sit", "handstand"
];
const EARLY_STAGE_PULL_IDS = new Set(["australian-row", "assisted-pull-up", "assisted-chin-up"]);

function collectCandidates(equipment, { professionalCalisthenics = false, experience = "intermediate" } = {}) {
  const allowed = new Set((Array.isArray(equipment) ? equipment : [equipment])
    .map(normalizeEquipment)
    .filter(Boolean));
  const candidatesByMuscle = new Map();
  const seen = new Set();

  for (const rawId of getEnabledPublicExerciseIds()) {
    const id = canonicalizeExerciseId(rawId);
    if (seen.has(id)) continue;
    seen.add(id);
    const entry = getCatalogExercise(id);
    if (!entry || !allowed.has(normalizeEquipment(entry.equipment))) continue;
    if (!isExerciseLevelSuitable(id, experience)) continue;
    for (const [muscle, credit] of Object.entries(entry.setCredits || {})) {
      if (credit !== 1) continue;
      if (!candidatesByMuscle.has(muscle)) candidatesByMuscle.set(muscle, []);
      candidatesByMuscle.get(muscle).push({ id, entry });
    }
  }

  for (const [muscle, candidates] of candidatesByMuscle) {
    candidates.sort((left, right) => {
      if (professionalCalisthenics) {
        const leftSkill = PROFESSIONAL_CALISTHENICS_IDS.has(left.id) ? 0 : 1;
        const rightSkill = PROFESSIONAL_CALISTHENICS_IDS.has(right.id) ? 0 : 1;
        if (leftSkill !== rightSkill) return leftSkill - rightSkill;
        if (leftSkill === 0) {
          const skillRank = PROFESSIONAL_CALISTHENICS_RANK.indexOf(left.id) - PROFESSIONAL_CALISTHENICS_RANK.indexOf(right.id);
          if (skillRank !== 0) return skillRank;
        }
      }
      if (["advanced", "professional"].includes(String(experience).toLowerCase())) {
        const leftEarlyStage = EARLY_STAGE_PULL_IDS.has(left.id) ? 1 : 0;
        const rightEarlyStage = EARLY_STAGE_PULL_IDS.has(right.id) ? 1 : 0;
        if (leftEarlyStage !== rightEarlyStage) return leftEarlyStage - rightEarlyStage;
      }
      return compareRank(candidateRank(left.id, left.entry, muscle), candidateRank(right.id, right.entry, muscle));
    });
  }
  return { allowed, candidatesByMuscle };
}

function splitSets(total) {
  const chunks = [];
  let remaining = Math.max(0, Math.round(Number(total) || 0));
  while (remaining > 0) {
    const chunk = remaining >= 3 ? 3 : remaining;
    if (chunk === 1 && chunks.length) {
      chunks[chunks.length - 1] -= 1;
      chunks.push(2);
    } else {
      chunks.push(chunk);
    }
    remaining -= chunk;
  }
  return chunks;
}

function makeExercise(candidate, sets, limitations, language) {
  const title = candidate.entry.title || candidate.id;
  return {
    exerciseId: candidate.id,
    name: title,
    demoName: title,
    muscleGroup: Object.keys(candidate.entry.setCredits || {})[0] || "general",
    equipment: candidate.entry.equipment,
    sets,
    reps: "8-12",
    restSeconds: 90,
    rir: "1-3",
    notes: limitations && limitations !== "None"
      ? `Respect this limitation: ${String(limitations).slice(0, 160)}`
      : language === "he"
        ? "הוסיפו חזרות בטווח לפני הגדלת העומס."
        : "Add repetitions within the range before increasing load."
  };
}

function primaryMuscleForCandidate(candidate) {
  return Object.entries(candidate?.entry?.setCredits || {})
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .map(([muscle]) => muscle)[0] || "general";
}

function candidateReplacementRank(id, entry, targetMuscle, currentEntry) {
  const rank = candidateRank(id, entry, targetMuscle);
  const currentSecondaryTotal = secondaryCreditTotal(currentEntry?.setCredits, targetMuscle);
  const secondaryDelta = Math.abs(secondaryCreditTotal(entry.setCredits, targetMuscle) - currentSecondaryTotal);
  const sameEquipment = normalizeEquipment(entry.equipment) === normalizeEquipment(currentEntry?.equipment) ? 0 : 1;
  return [sameEquipment, secondaryDelta, ...rank];
}

function buildLocalExerciseReplacement({
  currentExercise,
  experience,
  equipment = [],
  reservedExerciseIds = [],
  limitations = "None",
  language = "en"
} = {}) {
  const currentId = canonicalizeExerciseId(
    currentExercise?.exerciseId ||
    currentExercise?.demoName ||
    currentExercise?.name ||
    ""
  );
  const currentEntry = getCatalogExercise(currentId);
  const targetMuscle = currentEntry
    ? primaryMuscleForCandidate({ entry: currentEntry })
    : String(currentExercise?.muscleGroup || "").toLowerCase().trim();
  if (!targetMuscle || targetMuscle === "general") return null;

  const allowed = new Set((Array.isArray(equipment) ? equipment : [equipment])
    .map(normalizeEquipment)
    .filter(Boolean));
  const reserved = new Set([
    currentId,
    ...(Array.isArray(reservedExerciseIds) ? reservedExerciseIds : [])
      .map((exerciseId) => canonicalizeExerciseId(exerciseId))
      .filter(Boolean)
  ]);
  const candidates = [];
  const seen = new Set();

  for (const rawId of getEnabledPublicExerciseIds()) {
    const id = canonicalizeExerciseId(rawId);
    if (!id || seen.has(id) || reserved.has(id)) continue;
    seen.add(id);
    const entry = getCatalogExercise(id);
    if (!entry) continue;
    if (!isExerciseLevelSuitable(id, experience)) continue;
    if (allowed.size > 0 && !allowed.has(normalizeEquipment(entry.equipment))) continue;
    if (Number(entry.setCredits?.[targetMuscle] || 0) < 1) continue;
    candidates.push({ id, entry });
  }

  candidates.sort((left, right) =>
    compareRank(
      candidateReplacementRank(left.id, left.entry, targetMuscle, currentEntry),
      candidateReplacementRank(right.id, right.entry, targetMuscle, currentEntry)
    )
  );

  const replacement = candidates[0];
  if (!replacement) return null;
  const fallback = makeExercise(replacement, 3, limitations, language);

  return {
    ...fallback,
    muscleGroup: targetMuscle,
    sets: Math.max(1, Math.round(Number(currentExercise?.sets) || fallback.sets)),
    reps: currentExercise?.reps || fallback.reps,
    restSeconds: Number(currentExercise?.restSeconds) || fallback.restSeconds,
    rir: currentExercise?.rir || fallback.rir,
    notes: currentExercise?.notes || fallback.notes
  };
}

/**
 * Builds the local fallback from the same catalog and volume policy used by
 * the normal route. It targets the hard minimums, rather than the preferred
 * zone, because a valid minimum-range plan is safer than an oscillating
 * solver that overshoots an indirect muscle while chasing every preference.
 */
function buildLocalWorkoutProgram({
  goal = "buildMuscle",
  experience = "intermediate",
  daysPerWeek = 3,
  sessionDuration = 60,
  equipment = [],
  trainingStyle = "gym",
  limitations = "None",
  language = "en",
  muscleFocusMode = "balanced",
  selectedMuscles = []
} = {}) {
  const days = Number(daysPerWeek);
  const focusMode = ["balanced", "prioritize", "selected_only"].includes(String(muscleFocusMode).toLowerCase())
    ? String(muscleFocusMode).toLowerCase()
    : "balanced";
  const selectedSet = new Set((Array.isArray(selectedMuscles) ? selectedMuscles : [])
    .map((muscle) => String(muscle || "").trim().toLowerCase())
    .filter(Boolean));
  const profile = {
    experience,
    priority: derivePriorityFromGoal(goal),
    daysPerWeek: days,
    equipment,
    muscleFocusMode: focusMode,
    selectedMuscles: [...selectedSet]
  };
  const professionalCalisthenics = String(trainingStyle).toLowerCase() === "calisthenics" && String(experience).toLowerCase() === "professional";
  const { candidatesByMuscle } = collectCandidates(equipment, { professionalCalisthenics, experience });
  const required = MUSCLE_ORDER.filter((muscle) =>
    REQUIRED_MUSCLES.has(muscle) &&
    candidatesByMuscle.has(muscle) &&
    (profile.priority === "skills" || classifyMuscleRequirement(muscle, profile) === "required")
  );

  if (!required.length || !Number.isInteger(days) || days < 1) {
    throw Object.assign(new Error("No compatible local exercises are available for the selected request."), { status: 422 });
  }

  const placements = [];
  for (const muscle of required) {
    const policy = volumePolicyForMuscle(muscle, profile);
    const candidate = candidatesByMuscle.get(muscle)?.[0];
    const focusBoost = focusMode === "prioritize" && selectedSet.has(muscle) ? 1 : 0;
    for (const sets of splitSets(policy.minimumEffective + focusBoost)) {
      placements.push({ muscle, candidate, sets });
    }
  }

  const sessions = Array.from({ length: days }, (_, index) => ({
    day: index + 1,
    name: language === "he" ? `אימון מקומי ${index + 1}` : `Local Demo Session ${index + 1}`,
    exercises: []
  }));

  placements
    .sort((left, right) => {
      const leftSelected = focusMode === "prioritize" && selectedSet.has(left.muscle) ? 1 : 0;
      const rightSelected = focusMode === "prioritize" && selectedSet.has(right.muscle) ? 1 : 0;
      return rightSelected - leftSelected || right.sets - left.sets || MUSCLE_ORDER.indexOf(left.muscle) - MUSCLE_ORDER.indexOf(right.muscle);
    })
    .forEach((placement, index) => {
      const eligible = sessions
        .filter((session) => !session.exercises.some((exercise) => exercise.exerciseId === placement.candidate.id))
        .sort((left, right) => left.exercises.length - right.exercises.length || left.day - right.day);
      const session = eligible[index % Math.max(1, eligible.length)] || sessions[index % days];
      const exercise = makeExercise(placement.candidate, placement.sets, limitations, language);
      // The local/demo path still needs to honor the requested time budget.
      // Keep the same exercise selection, but use shorter rests for compact
      // sessions and longer rests when the user has room for strength work.
      if (Number(sessionDuration) < 45) exercise.restSeconds = 60;
      else if (Number(sessionDuration) >= 75) exercise.restSeconds = 120;
      session.exercises.push(exercise);
    });

  // A high-frequency request can have more sessions than required muscle
  // placements. Keep every returned session usable while leaving the volume
  // gate to reject genuinely impossible combinations honestly.
  for (const session of sessions) {
    if (session.exercises.length) continue;
    const candidate = candidatesByMuscle.get(required[0])?.[0];
    session.exercises.push(makeExercise(candidate, 2, limitations, language));
  }

  return {
    programName: language === "he" ? "תוכנית אימון מקומית" : `Local Demo ${String(goal).replaceAll(/([A-Z])/g, " $1").trim()} Program`,
    daysPerWeek: days,
    durationWeeks: 8,
    goal: String(goal),
    trainingStyle: String(trainingStyle),
    experience: String(experience),
    sessionDuration: Number(sessionDuration),
    muscleFocusMode: focusMode,
    selectedMuscles: [...selectedSet],
    sessions
  };
}

module.exports = { buildLocalWorkoutProgram, buildLocalExerciseReplacement, splitSets };
