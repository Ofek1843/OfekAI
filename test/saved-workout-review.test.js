const test = require('node:test');
const assert = require('node:assert/strict');
const { reviewSavedWorkout } = require('../lib/saved-workout-review');
const exercise = (name, sets) => ({ name, sets, reps: '8-12' });
test('manual names resolve to catalog credits; all weekly sessions count', () => {
  const result = reviewSavedWorkout({ experience:'intermediate', goal:'buildMuscle', sessions:[
    {exercises:[exercise('Bench Press',6),exercise('Back Squat',3)]},
    {exercises:[exercise('Bench Press',6),exercise('Dumbbell Curl',4)]}
  ] });
  assert.equal(result.weeklyVolume.unknownExercises,0);
  assert.equal(result.weeklyVolume.totalHardSets,19);
  assert.equal(result.weeklyVolume.perMuscle.chest.total,12);
  assert.equal(result.weeklyVolume.perMuscle.triceps.fractional,6);
  assert.equal(result.program.sessions[0].exercises[0].exerciseId,'barbell-bench-press');
});
test('edited sets recompute, unknown movements are clearly partial', () => {
  const p = {sessions:[{exercises:[exercise('Bench Press',3)]}]};
  assert.equal(reviewSavedWorkout(p).weeklyVolume.perMuscle.chest.total,3);
  p.sessions[0].exercises[0].sets=5;
  assert.equal(reviewSavedWorkout(p).weeklyVolume.perMuscle.chest.total,5);
  p.sessions[0].exercises.push(exercise('My custom movement',4));
  const partial = reviewSavedWorkout(p).weeklyVolume;
  assert.equal(partial.unknownExercises,1);
  assert.equal(partial.perMuscle.chest.status,'incomplete');
  assert.equal(partial.assumedExperience,true);
});
test('reject malformed or oversized workout inputs', () => {
  for (const program of [{}, {sessions:Array(8).fill({exercises:[]})}, {sessions:[{exercises:[exercise('Bench Press',-2)]}]}]) {
    assert.throws(()=>reviewSavedWorkout(program));
  }
});
