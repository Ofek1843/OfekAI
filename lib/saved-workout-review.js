const { WORKOUT_EXERCISE_CATALOG, canonicalizeExerciseId } = require('./workout-exercise-catalog');
const { EXERCISE_SETCREDITS } = require('./workout-setcredits-map');
const { calculateWeeklyVolume } = require('./workout-volume');
const { allVolumePolicies, detailedVolumeStatus } = require('./workout-volume-targets');
const { derivePriorityFromGoal, PRIORITY_BY_GOAL } = require('./workout-priority');

// Recompute from the saved exercises, including manual edits; never trust a
// generated summary that may predate a change to sets or movements.
function reviewSavedWorkout(program = {}) {
  if (!Array.isArray(program.sessions) || program.sessions.length < 1 || program.sessions.length > 7) {
    throw new Error('A program must contain 1–7 weekly sessions.');
  }
  const normalized = { ...program, sessions: program.sessions.map(session => {
    if (!Array.isArray(session.exercises) || session.exercises.length > 60) throw new Error('Invalid session exercises.');
    return { ...session, exercises: session.exercises.map(exercise => {
      const sets = Number(exercise.sets);
      if (!Number.isInteger(sets) || sets < 1 || sets > 30) throw new Error('Exercise sets must be between 1 and 30.');
      const manualAliases = { 'hip-thrust':'barbell-hip-thrust', 'walking-lunge':'dumbbell-walking-lunge' };
      const candidates = [exercise.exerciseId, exercise.demoName, exercise.name, exercise.exerciseName, exercise.exercise]
        .map(canonicalizeExerciseId).map(id=>manualAliases[id]||id);
      const exerciseId = candidates.find(id => WORKOUT_EXERCISE_CATALOG[id])
        || Object.values(WORKOUT_EXERCISE_CATALOG).find(item => candidates.includes(String(item.image||'').replace(/\.(png|webp)$/,'')))?.exerciseId || '';
      return { ...exercise, exerciseId, demoName: exerciseId || exercise.demoName, sets };
    }) };
  }) };
  const volume = calculateWeeklyVolume(normalized, EXERCISE_SETCREDITS);
  const experience = program.experience || program.experienceLevel || program.level || '';
  const goal = PRIORITY_BY_GOAL[program.goal] ? program.goal : 'buildMuscle';
  const profile = { ...program, goal, experience: String(experience || 'intermediate').toLowerCase(),
    priority: program.priority || derivePriorityFromGoal(goal), daysPerWeek: normalized.sessions.length };
  const policies = allVolumePolicies(profile);
  const perMuscle = Object.fromEntries([...new Set([...Object.keys(policies), ...Object.keys(volume.perMuscle), 'adductors', 'abductors'])].map(muscle => {
    const policy=policies[muscle];
    const counts = volume.perMuscle[muscle] || { direct: 0, fractional: 0, total: 0 };
    return [muscle, { ...counts, preferredMin: policy?.preferredMin, preferredMax: policy?.preferredMax,
      minimumEffective: policy?.minimumEffective, hardMaximum: policy?.hardMaximum,
      status: volume.unknownExercises ? 'incomplete' : detailedVolumeStatus(counts.total, policy) }];
  }));
  return { program: normalized, weeklyVolume: { ...volume, perMuscle, assumedExperience: !experience, assumedGoal: goal !== program.goal } };
}
module.exports = { reviewSavedWorkout };
