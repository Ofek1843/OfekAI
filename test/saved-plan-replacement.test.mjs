import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { replaceSavedPlan, commitSavedPlan, planFingerprint } from '../public/js/saved-plan-replacement.mjs';
const require = createRequire(import.meta.url);
const { createHarness, workoutProfile, nutritionProfile, lib } = require('../audit/scientific-safety-20261015/harness.cjs');
const user = { uid: 'isolated-test-owner', getIdToken: async () => 'synthetic-test-token' };
const context = { ...workoutProfile, screeningStatus: 'none' };
const exercise = { exerciseId: 'barbell-bench-press', name: 'Bench Press', sets: 3, reps: '8–12', rir: '1–3' };
const alternative = { ...exercise, exerciseId: 'dumbbell-bench-press', name: 'Dumbbell Bench Press' };
const workout = () => ({ id: 'workout-1', name: 'My unchanged title', plan: { recipientGender: 'female', demonstrationModel: 'female', weeklyScheduleDays: ['monday','thursday'],
  sessions: [{ name: 'Upper', exercises: [exercise] }, { name: 'Lower', exercises: [{ exerciseId: 'barbell-squat', name: 'Squat', sets: 4 }] }] } });
const target = { sessionIndex: 0, exerciseIndex: 0 };

test('saved workout replacement persists only the chosen exercise and keeps recipient, days and other exercises', async () => {
  const saved = workout(), before = structuredClone(saved); let write;
  const normalized = structuredClone(saved.plan); normalized.sessions[1].exercises[0].demoName = 'normalized-for-review';
  const result = await replaceSavedPlan({ kind: 'workout', saved, user, target, context, program: normalized,
    request: async ({payload}) => { assert.equal(payload.program.recipientGender, 'female'); assert.deepEqual(payload.equipment, context.equipment); return {exercise: alternative}; },
    persist: async value => { assert.deepEqual(saved, before); write = value; } });
  assert.deepEqual(write.previousPlan, before.plan);
  assert.deepEqual(saved.plan.sessions[0].exercises[0], alternative);
  assert.deepEqual(saved.plan.sessions[1], before.plan.sessions[1]);
  assert.equal(saved.name, before.name);
  assert.equal(result.plan.recipientGender, 'female');
  assert.deepEqual(result.plan.weeklyScheduleDays, before.plan.weeklyScheduleDays);
  assert.equal(result.plan.screeningStatus, undefined);
  assert.equal(result.plan.age, undefined);
});

for (const failure of ['request','persist','unchanged']) test(`${failure} failure leaves the saved snapshot unchanged`, async () => {
  const saved = workout(), before = structuredClone(saved); let writes = 0;
  await assert.rejects(replaceSavedPlan({ kind: 'workout', saved, user, target, context,
    request: async () => { if (failure === 'request') throw new Error('Unavailable'); return {exercise: failure === 'unchanged' ? exercise : alternative}; },
    persist: async () => { writes++; throw new Error('PLAN_CHANGED'); } }));
  assert.deepEqual(saved, before); assert.equal(writes, failure === 'persist' ? 1 : 0);
});

test('authentication, explicit suitability, adult age and equipment are required before a request', async () => {
  let calls = 0;
  for (const change of [{user:null},{saved:{plan:{}}},{context:{...context,screeningStatus:''}},{context:{...context,screeningStatus:'review'}},
    {context:{...context,age:17}},{context:{...context,age:22.5}},{context:{...context,equipment:[]}}]) {
    await assert.rejects(replaceSavedPlan({ kind:'workout',saved:workout(),user,target,context,request:async()=>{calls++;},...change }));
  }
  assert.equal(calls,0);
});

test('closing the viewer during generation prevents a late save', async () => {
  const saved = workout(), before = structuredClone(saved), controller = new AbortController(); let writes = 0;
  await assert.rejects(replaceSavedPlan({kind:'workout',saved,user,target,context,signal:controller.signal,
    request:async()=>{controller.abort();return {exercise:alternative};},persist:async()=>{writes++;}}),{name:'AbortError'});
  assert.equal(writes,0); assert.deepEqual(saved,before);
});

function sdk(plan, exists = true) {
  const writes = [], paths = [], auth = {currentUser:user};
  return {writes,paths,auth,db:{},doc:(_, ...parts)=>{paths.push(parts);return 'own-document';},serverTimestamp:()=> 'server-time',
    runTransaction:async(_,fn)=>fn({get:async()=>({exists:()=>exists,data:()=>({plan})}),update:(ref,value)=>writes.push({ref,value})})};
}
test('transaction writes the authenticated owner document only and updates no account/active-plan pointer', async () => {
  const saved = workout(), api=sdk(saved.plan);
  await commitSavedPlan({kind:'workout',saved,user,previousPlan:structuredClone(saved.plan),nextPlan:{sessions:[]}},api);
  assert.deepEqual(api.paths,[['users',user.uid,'workoutPlans',saved.id]]);
  assert.deepEqual(Object.keys(api.writes[0].value).sort(),['plan','updatedAt']);
});
test('stale/deleted plans and a changed session cannot be overwritten', async () => {
  const saved = workout();
  for (const api of [sdk({...saved.plan, recipientGender:'male'}),sdk(saved.plan,false),{...sdk(saved.plan),auth:{currentUser:{uid:'another-user'}}}]) {
    await assert.rejects(commitSavedPlan({kind:'workout',saved,user,previousPlan:saved.plan,nextPlan:{}},api));
    assert.equal(api.writes.length,0);
  }
});
test('fingerprints compare Firestore maps independently of key order', () => {
  assert.equal(planFingerprint({a:1,b:{x:2,y:3}}),planFingerprint({b:{y:3,x:2},a:1}));
});

const requestFrom = harness => async ({kind,payload}) => {
  const response=await harness.request(`/api/${kind}-builder/reroll-${kind==='workout'?'exercise':'meal'}`,payload);
  assert.equal(response.status,200,JSON.stringify(response.body)); return response.body;
};
test('saved meals can be replaced repeatedly using the real balancing route, keeping allergy exclusions, exact totals and reopen state', async () => {
  const harness=createHarness(), generated=await harness.request('/api/nutrition-builder',nutritionProfile);
  assert.equal(generated.status,200);
  const {prepareNutritionPlanForSave}=await import('../public/js/nutrition-selection.mjs');
  const saved={id:'meal-1',plan:{...prepareNutritionPlanForSave(generated.body.plan),recipientGender:'female'}};
  let disk=structuredClone(saved.plan), requests=0;
  const originalExclusions=structuredClone(saved.plan.excludeAllergens);
  for(let i=0;i<4;i++){
    const old=saved.plan.meals[0].options[0].mealId;
    await replaceSavedPlan({kind:'nutrition',saved,user,target:{mealNumber:saved.plan.meals[0].mealNumber,optionNumber:1},context:{screeningStatus:'none'},
      request:async args=>{requests++;return requestFrom(harness)(args);},persist:async({nextPlan})=>{disk=structuredClone(nextPlan);}});
    assert.notEqual(saved.plan.meals[0].options[0].mealId,old);
    assert.equal(saved.plan.recipientGender,'female');
    assert.deepEqual(saved.plan.excludeAllergens,originalExclusions);
    assert.ok(lib('nutrition-totals').verifyDisplayedArithmetic(saved.plan).exact);
    assert.ok(lib('nutrition-totals').evaluatePlanTotals(saved.plan).withinTolerance);
    assert.deepEqual(disk,saved.plan);
  }
  assert.equal(requests,4);
  const {savedNutritionMarkup}=await import('../public/js/saved-nutrition-view.mjs');
  assert.match(savedNutritionMarkup({plan:disk}),/saved-meal-macros/);
});

test('legacy selected meal is promoted to option one before balancing; other selections survive',async()=>{
  const saved={id:'legacy',plan:{selectedOptionNumbers:{1:2,2:2},meals:[1,2].map(mealNumber=>({mealNumber,options:[{optionNumber:1,mealId:'old-'+mealNumber},{optionNumber:2,mealId:'chosen-'+mealNumber}]}))}};
  await replaceSavedPlan({kind:'nutrition',saved,user,target:{mealNumber:1,optionNumber:2},context:{screeningStatus:'none'},
    request:async({payload})=>{
      assert.equal(payload.optionNumber,1); assert.equal(payload.plan.meals[1].options[0].mealId,'chosen-2');
      assert.equal(payload.plan.selectedOptionNumbers,undefined);
      payload.plan.meals[0].options[0]={optionNumber:1,mealId:'replacement'};
      return {plan:payload.plan,option:payload.plan.meals[0].options[0]};
    },persist:async()=>{}});
  assert.equal(saved.plan.selectedOptionNumbers,undefined);
  assert.equal(saved.plan.meals[1].options[0].mealId,'chosen-2');
});

test('workout replacement uses the actual route and returns a different catalog exercise',async()=>{
  const program=lib('local-demo-generators').buildLocalWorkoutProgram(workoutProfile);
  const saved={id:'route-workout',plan:program};
  await replaceSavedPlan({kind:'workout',saved,user,target,context,request:requestFrom(createHarness()),persist:async()=>{}});
  assert.notEqual(saved.plan.sessions[0].exercises[0].exerciseId,program.sessions[0].exercises[0].exerciseId);
});
