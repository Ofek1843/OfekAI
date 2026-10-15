import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {calculateSavedWeeklySets} from '../public/js/saved-workout-volume.mjs';
const require=createRequire(import.meta.url);
const {reviewSavedWorkout}=require('../lib/saved-workout-review');
const {canonicalizeExerciseId}=require('../lib/workout-exercise-catalog');
const source=readFileSync(new URL('../public/js/exercise-image.js',import.meta.url),'utf8');
const sandbox={console};
vm.createContext(sandbox);
vm.runInContext(source.replace(/^export /gm,'')+'\nglobalThis.resolve=exerciseImageUrl;',sandbox);
test('Back Extension never resolves to Good Morning, including legacy saved ids',()=>{
  for(const exercise of [
    {name:'Back Extension',sets:3},
    {name:'Back Extension',exerciseId:'good-morning',demoName:'good-morning',sets:3},
    {name:'Hyperextension',exerciseId:'good-morning',sets:3}
  ]){
    const plan={sessions:[{exercises:[exercise]}]};
    assert.equal(calculateSavedWeeklySets(plan).program.sessions[0].exercises[0].exerciseId,'back-extension');
    assert.equal(reviewSavedWorkout(plan).program.sessions[0].exercises[0].exerciseId,'back-extension');
    assert.equal(sandbox.resolve(exercise),'/images/exercises/back-extension.png');
  }
  assert.equal(sandbox.resolve({name:'Good Morning',exerciseId:'good-morning'}),'/images/exercises/good-morning.png');
});
test('incline machine chest press and basic sit-ups resolve and count in manual plans',()=>{
  for(const [name,id,muscle] of [['Incline Chest Press Machine','incline-chest-press-machine','chest'],['Incline Chest Press','incline-chest-press-machine','chest'],['Sit-ups','sit-up','core'],['Sit Up','sit-up','core']]){
    assert.equal(canonicalizeExerciseId(name),id);
    assert.equal(sandbox.resolve({name}),'/images/exercises/'+id+'.png');
    const plan={sessions:[{exercises:[{name,sets:4}]}]};
    assert.equal(calculateSavedWeeklySets(plan).weeklyVolume.perMuscle[muscle].direct,4);
    assert.equal(reviewSavedWorkout(plan).weeklyVolume.perMuscle[muscle].direct,4);
  }
});
