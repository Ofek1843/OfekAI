// Estimate the actual duration of a workout session.
//
// Formula (per session):
//   warmup
//   + sum over exercises of:
//       (sets * secPerSet)                         // working time
//       + (max(sets - 1, 0) * restSeconds)         // rest happens BETWEEN sets,
//                                                   // not after the final set of
//                                                   // an exercise (the lifter moves
//                                                   // to the next exercise instead)
//   + (max(exerciseCount - 1, 0) * transitionSeconds) // transition happens BETWEEN
//                                                       // exercises, not once per
//                                                       // session
//
// Exercise time is estimated at 45 seconds per set (conservative, covers setup +
// execution). Transition time defaults to 90 seconds — walking to the next
// station, adjusting a machine/rack, etc.

function estimateSessionDuration(session, options = {}) {
  const { warmupMinutes = 5, transitionSeconds = 90, secPerSet = 45 } = options;

  let totalWorkSeconds = 0;
  let totalRestSeconds = 0;

  const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
  const exerciseCount = exercises.length;

  for (const exercise of exercises) {
    const sets = Number(exercise.sets) || 0;
    const restSeconds = Number(exercise.restSeconds) || 90;

    totalWorkSeconds += sets * secPerSet;
    totalRestSeconds += Math.max(sets - 1, 0) * restSeconds;
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
