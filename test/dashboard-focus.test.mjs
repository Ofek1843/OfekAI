import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {dashboardSession,mountDashboard} from '../public/js/dashboard-editorial-view.mjs';
import {dashboardCopy,dashboardLanguages} from '../public/js/dashboard-editorial-i18n.mjs';
const monday=new Date(2026,9,26,9), tuesday=new Date(2026,9,27,9);
const workout={id:'w1',name:'Saved workout',plan:{weeklyScheduleDays:[1,3,5],sessions:[{id:'a',name:'Upper'},{id:'b',name:'Lower'},{id:'c',name:'Full body'}]}};
const active=()=>({workouts:[structuredClone(workout)],activeWorkoutId:'w1',logs:[]});
function render(model={},options={}) {
 const {document}=parseHTML('<html><body><div id="root"></div></body></html>');
 globalThis.document=document;
 const root=document.querySelector('#root'), query=root.querySelector.bind(root);
 root.querySelector=selector=>selector==='.ring canvas'?null:query(selector);
 const view=mountDashboard(root,model,{today:monday,...options});
 return {root,document,view};
}
test('daily focus differentiates empty, saved, scheduled, rest, completed and failed reads',()=>{
 assert.equal(dashboardSession({},monday).state,'empty');
 assert.equal(dashboardSession({workouts:[workout]},monday).state,'saved');
 assert.equal(dashboardSession(active(),monday).session.name,'Upper');
 const rest=dashboardSession(active(),tuesday);
 assert.equal(rest.state,'rest');assert.equal(rest.session.name,'Lower');assert.equal(rest.date.getDay(),3);
 const done=active();done.logs=[{workoutPlanId:'w1',sessionIndex:0,completedAt:new Date(2026,9,26,10)}];
 assert.equal(dashboardSession(done,monday).state,'completed');
 done.logs[0].workoutPlanId='other';assert.equal(dashboardSession(done,monday).state,'today');
 done.logs[0]={workoutPlanId:'w1',sessionIndex:0,startedAt:monday};assert.equal(dashboardSession(done,monday).state,'today');
 for(const failure of [{workoutsFailed:true},{loadFailures:[{section:'profile'}]}, {...active(),logsFailed:true},{activeWorkoutId:'missing'}]) assert.equal(dashboardSession(failure,monday).state,'error');
});
test('legacy and invalid schedules never invent a rest day or mutate saved programming',()=>{
 for(const schedule of [undefined,[],[1,1,5],[1,8,5],[1,null,5],[1,2]]) {
  const model=active();model.workouts[0].plan.weeklyScheduleDays=schedule;
  model.logs=[{workoutPlanId:'w1',sessionIndex:0,completedAt:new Date(2026,9,25,10)}];
  const original=structuredClone(model), result=dashboardSession(model,tuesday);
  assert.equal(result.state,'next');assert.equal(result.session.name,'Lower');assert.deepEqual(model,original);
 }
 const alias=active();delete alias.workouts[0].plan.weeklyScheduleDays;alias.workouts[0].plan.scheduleDays=[1,3,5];
 assert.equal(dashboardSession(alias,tuesday).state,'rest');
});
test('saved and rest-day cards open existing plans; failures never promote creation',()=>{
 for(const [model,today,state] of [[{workouts:[workout]},monday,'saved'],[active(),tuesday,'rest'],[{workoutsFailed:true},monday,'error']]) {
  const {root}=render(model,{today});
  assert.equal(root.querySelector('.session').dataset.sessionState,state);
  assert.equal(root.querySelector('.session a[href="/workout-builder.html"]'),null);
  assert.equal(root.querySelector('.session a[href^="/workout-tracker.html"]'),null);
  if(state!=='error')assert.equal(root.querySelector('.session [data-plan-id]').dataset.planId,'w1');
  else assert.ok(root.querySelector('.session [data-action="retry-dashboard"]'));
 }
});
test('today workout CTA addresses its stored session and completed days link to history',()=>{
 const model=active(),{root,view}=render(model);
 assert.equal(root.querySelector('.session .primary').getAttribute('href'),'/workout-tracker.html?plan=w1&session=a');
 model.logs=[{workoutPlanId:'w1',sessionIndex:0,completedAt:monday}];view.update(model);
 assert.equal(root.querySelector('.session .primary').getAttribute('href'),'/workout-history.html');
});
test('daily nutrition and plans precede weekly overview in accessible reading order',()=>{
 const {root}=render(active());
 assert.deepEqual([...root.querySelector('.dashboard-main').children].filter(e=>e.className!=='status').map(e=>e.className),['overview','plans','week','activity']);
 assert.ok(root.querySelector('.overview .diary'));assert.equal(root.querySelector('.overview .week'),null);
});
test('nutrition shows measured totals without inventing goal progress',()=>{
 const {root,view}=render({diary:{entries:[{calories:500,proteinGrams:25,carbsGrams:60,fatGrams:10}]}});
 assert.equal(root.querySelector('.ring-label strong').textContent,'500');
 assert.equal(root.querySelectorAll('.macro progress').length,0);
 assert.ok(root.querySelector('.diary-target-note a[href="/nutrition-builder.html"]'));
 view.update({diary:{targetSnapshot:{dailyCalories:2000,proteinGrams:120},entries:[{calories:500,proteinGrams:25}]}});
 assert.equal(root.querySelectorAll('.macro progress').length,1);
 assert.equal(root.querySelector('.macro progress').getAttribute('max'),'120');
 assert.equal(root.querySelector('.diary-target-note'),null);
 view.update({diaryFailed:true});assert.equal(root.querySelector('.ring-label'),null);
});
test('new state labels and guest guidance are localized in every supported language',()=>{
 for(const language of dashboardLanguages) {
  const copy=dashboardCopy(language);
  for(const key of ['todayWorkout','restDay','savedWorkout','workoutUnavailable','nutritionNoTarget','guestBody']) assert.ok(copy[key]);
  const {root,document}=render({}, {language,guest:true});
  assert.equal(root.querySelector('.guest-dashboard-banner strong').textContent,copy.guestTitle);
  assert.equal(document.documentElement.dir,['he','ar'].includes(language)?'rtl':'ltr');
  assert.doesNotMatch(root.textContent,/undefined/);
 }
});
