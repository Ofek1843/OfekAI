// Deterministic, non-AI repair pass applied to a generated program BEFORE
// validateWorkoutProgram() runs. This does not weaken or bypass any
// validation rule — it makes the DATA satisfy the existing rules
// (required exerciseId, session-duration cap) wherever that's possible
// without guessing content the AI didn't provide. If a program is still
// invalid after repair, validateWorkoutProgram() still rejects it exactly
// as before.
//
// Repair order (each step only acts where the previous ones left a gap):
//   1. normalize known exercise name aliases -> canonical exerciseId
//      (lib/workout-exercise-aliases.js, matches lib/workout-setcredits-map.js)
//   2. deterministically assign an exerciseId via slug when no alias matches
//      (never leaves exerciseId missing, never invents muscle credits)
//   3. repair minor formatting/schema defects (numeric-string sets/rest,
//      untrimmed strings) that would otherwise trip schema validation
//   4. if a session still exceeds the duration cap, drop its lowest-
//      priority accessory exercises (from the end of the list, where the
//      prompt places isolation/accessory work) down to a floor of 3
//      exercises, recalculating duration after each removal

const { slugifyExerciseId } = require("./workout-volume");
const { estimateSessionDuration } = require("./workout-duration");
const { EXERCISE_NAME_ALIASES } = require("./workout-exercise-aliases");

const MIN_EXERCISES_PER_SESSION = 3;

function resolveExerciseId(exercise) {
  const existing = typeof exercise.exerciseId === "string" ? exercise.exerciseId.trim() : "";
  if (existing) return { id: existing, source: "existing" };

  const nameSlug = slugifyExerciseId(exercise.name || exercise.demoName || "");
  if (EXERCISE_NAME_ALIASES[nameSlug]) {
    return { id: EXERCISE_NAME_ALIASES[nameSlug], source: "alias" };
  }
  if (nameSlug) {
    return { id: nameSlug, source: "slug" };
  }
  return { id: "", source: "none" };
}

function assignExerciseIds(program, repairs) {
  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    const seenIds = new Set();
    for (const exercise of session.exercises) {
      const hadId = typeof exercise.exerciseId === "string" && exercise.exerciseId.trim().length > 0;
      let { id, source } = resolveExerciseId(exercise);

      // Guarantee uniqueness within the session (Rule 9) even if two
      // different exercises would otherwise slugify/alias to the same id.
      let uniqueId = id || `exercise-${i}-${session.exercises.indexOf(exercise)}`;
      let suffix = 2;
      while (seenIds.has(uniqueId)) {
        uniqueId = `${id}-${suffix}`;
        suffix += 1;
      }
      seenIds.add(uniqueId);

      if (!hadId) {
        exercise.exerciseId = uniqueId;
        repairs.push(`Session ${i + 1}: assigned exerciseId "${uniqueId}" to "${exercise.name || "unnamed exercise"}" (${source}).`);
      }
    }
  }
}

function repairSchemaDefects(program, repairs) {
  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    if (typeof session.name !== "string" || !session.name.trim()) {
      session.name = `Day ${i + 1}`;
      repairs.push(`Session ${i + 1}: assigned a default session name.`);
    }

    for (const exercise of session.exercises) {
      if (typeof exercise.name === "string") {
        const trimmed = exercise.name.trim();
        if (trimmed !== exercise.name) exercise.name = trimmed;
      }

      if (typeof exercise.sets === "string" && /^\d+$/.test(exercise.sets.trim())) {
        exercise.sets = Number(exercise.sets.trim());
        repairs.push(`Session ${i + 1}: coerced "${exercise.name}" sets from string to number.`);
      }

      if (typeof exercise.restSeconds === "string" && /^\d+$/.test(exercise.restSeconds.trim())) {
        exercise.restSeconds = Number(exercise.restSeconds.trim());
        repairs.push(`Session ${i + 1}: coerced "${exercise.name}" restSeconds from string to number.`);
      }

      if (typeof exercise.reps === "number") {
        exercise.reps = String(exercise.reps);
        repairs.push(`Session ${i + 1}: coerced "${exercise.name}" reps to a string.`);
      }
    }
  }
}

function trimAccessoryExercisesForDuration(program, context, repairs) {
  const { sessionDuration = 60 } = context;
  const tolerance = Math.max(5, sessionDuration * 0.1);
  const budget = sessionDuration + tolerance;

  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    let estimate = estimateSessionDuration(session);
    while (
      estimate.estimatedMinutes > budget &&
      session.exercises.length > MIN_EXERCISES_PER_SESSION
    ) {
      const removed = session.exercises.pop();
      repairs.push(
        `Session ${i + 1}: removed accessory exercise "${removed.name || removed.exerciseId}" — session was ${estimate.estimatedMinutes}min, over the ${Math.round(budget)}min limit.`
      );
      estimate = estimateSessionDuration(session);
    }
  }
}

function repairWorkoutProgram(program, context = {}) {
  const repairs = [];

  if (!program || !Array.isArray(program.sessions)) {
    return { program, repairs };
  }

  assignExerciseIds(program, repairs);
  repairSchemaDefects(program, repairs);
  trimAccessoryExercisesForDuration(program, context, repairs);

  return { program, repairs };
}

module.exports = { repairWorkoutProgram, resolveExerciseId };
