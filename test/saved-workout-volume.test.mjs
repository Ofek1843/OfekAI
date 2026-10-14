import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {calculateSavedWeeklySets} from '../public/js/saved-workout-volume.mjs';
import {workoutVolumeCatalog,workoutVolumeAliases} from '../public/js/workout-volume-data.mjs';
const require=createRequire(import.meta.url);
const {reviewSavedWorkout}=require('../lib/saved-workout-review');
const {WORKOUT_EXERCISE_CATALOG,WORKOUT_EXERCISE_ALIAS_MAP}=require('../lib/workout-exercise-catalog');
const {EXERCISE_SETCREDITS}=require('../lib/workout-setcredits-map');
test('browser credits stay identical to the authoritative server catalog',()=>{
  assert.deepEqual(workoutVolumeAliases,WORKOUT_EXERCISE_ALIAS_MAP);
  assert.deepEqual(workoutVolumeCatalog,Object.fromEntries(Object.entries(WORKOUT_EXERCISE_CATALOG).map(([id,e])=>[id,{image:e.image,credits:EXERCISE_SETCREDITS[id]||{}}])));
});
test('local and server weekly counts agree for every catalog movement',()=>{
  for(const id of Object.keys(workoutVolumeCatalog)){
    const plan={sessions:[{exercises:[{exerciseId:id,name:id,sets:3}]}]};
    const local=calculateSavedWeeklySets(plan).weeklyVolume;
    const server=reviewSavedWorkout(plan).weeklyVolume;
    for(const[key,entry]of Object.entries(local.perMuscle))assert.deepEqual([entry.direct,entry.fractional,entry.total],[server.perMuscle[key]?.direct||0,server.perMuscle[key]?.fractional||0,server.perMuscle[key]?.total||0],id+' '+key);
  }
});
test('a manual Upper/Lower plan counts all sessions, zero-work muscles, and edits without a network request',()=>{
  const plan={sessions:[{exercises:[{name:'Pec Deck',sets:3},{name:'Chest Press Machine',sets:3}]},{exercises:[{name:'Back Squat',sets:4}]},{exercises:[{name:'Pec Deck',sets:3},{name:'Chest Press Machine',sets:3}]}]};
  const result=calculateSavedWeeklySets(plan).weeklyVolume;
  assert.equal(result.perMuscle.chest.total,12);assert.equal(result.perMuscle.quads.direct,4);assert.equal(result.perMuscle.triceps.fractional,3);assert.equal(result.perMuscle.calves.total,0);assert.equal(result.totalHardSets,16);
  plan.sessions[0].exercises[0].sets=5;
  assert.equal(calculateSavedWeeklySets(plan).weeklyVolume.perMuscle.chest.total,14);
});
test('unknown custom exercises are reported without invented muscle credits',()=>{
  const result=calculateSavedWeeklySets({sessions:[{exercises:[{name:'Custom unknown exercise',sets:4}]}]}).weeklyVolume;
  assert.equal(result.unknownExercises,1);assert.equal(result.totalHardSets,4);assert.ok(Object.values(result.perMuscle).every(e=>e.total===0));
});
