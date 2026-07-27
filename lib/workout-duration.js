// Estimate the actual duration of a workout session.
//
// Formula (per session):
//   warmup
//   + sum over exercises of that exercise's own work+rest time, computed
//     according to its prescriptionType (Phase 2) — see
//     estimateExerciseSeconds(). For a plain sets_reps/timed_hold exercise
//     this is exactly the Phase 1 formula:
//       (sets * secPerSet) + (max(sets - 1, 0) * restSeconds)
//     A continuous_conditioning exercise contributes durationMinutes
//     directly; an intervals exercise contributes
//     rounds * (workSeconds + restSeconds). Without this, a 10-minute
//     conditioning circuit (which has no "sets") would silently contribute
//     ZERO to the session estimate.
//   + (max(exerciseCount - 1, 0) * transitionSeconds) // transition happens BETWEEN
//                                                       // exercises, not once per
//                                                       // session
//
// Exercise time is estimated at 45 seconds per set (conservative, covers setup +
// execution). Transition time defaults to 90 seconds — walking to the next
// station, adjusting a machine/rack, etc.

function estimateExerciseSeconds(exercise, secPerSet) {
  const type = exercise?.prescriptionType;

  if (type === "continuous_conditioning") {
    const minutes = Number(exercise.durationMinutes) || 0;
    return { work: minutes * 60, rest: 0 };
  }

  if (type === "intervals") {
    const rounds = Number(exercise.rounds) || 0;
    const workSeconds = Number(exercise.workSeconds) || 0;
    const restSeconds = Number(exercise.restSeconds) || 0;
    return { work: rounds * workSeconds, rest: Math.max(rounds - 1, 0) * restSeconds };
  }

  if (type === "timed_hold") {
    const sets = Number(exercise.sets) || 0;
    const durationSeconds = Number(exercise.durationSeconds) || 0;
    const restSeconds = Number(exercise.restSeconds) || 90;
    return { work: sets * durationSeconds, rest: Math.max(sets - 1, 0) * restSeconds };
  }

  // sets_reps (default) and skill_practice: identical to the original,
  // unconditional Phase 1 formula.
  const sets = Number(exercise.sets) || 0;
  const restSeconds = Number(exercise.restSeconds) || 90;
  return { work: sets * secPerSet, rest: Math.max(sets - 1, 0) * restSeconds };
}

function estimateSessionDuration(session, options = {}) {
  const { warmupMinutes = 5, transitionSeconds = 90, secPerSet = 45 } = options;

  let totalWorkSeconds = 0;
  let totalRestSeconds = 0;

  const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
  const exerciseCount = exercises.length;

  for (const exercise of exercises) {
    const { work, rest } = estimateExerciseSeconds(exercise, secPerSet);
    totalWorkSeconds += work;
    totalRestSeconds += rest;
  }

  const totalTransitionSeconds = Math.max(exerciseCount - 1, 0) * transitionSeconds;

  const workMinutes = totalWorkSeconds / 60;
  const restMinutes = totalRestSeconds / 60;
  const transitionMinutes = totalTransitionSeconds / 60;
  const totalMinutes = warmupMinutes + workMinutes + restMinutes + transitionMinutes;

  return {
    estimatedMinutes: Math.ceil(totalMinutes),
    breakdown: {
      warmup: warmupMinutes,
      work: Math.round(workMinutes * 10) / 10,
      rest: Math.round(restMinutes * 10) / 10,
      transition: Math.round(transitionMinutes * 10) / 10
    }
  };
}

module.exports = { estimateSessionDuration };
