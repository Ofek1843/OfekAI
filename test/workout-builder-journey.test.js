const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const read = file => fs.readFileSync(require('node:path').join(__dirname, '..', file), 'utf8');

async function harness({ signedIn = false, storageFails = false } = {}) {
  const helpers = await import('../public/js/workout-builder-journey.mjs');
  const { document, window } = parseHTML(read('public/workout-builder.html'));
  // linkedom does not implement browser form value/checked semantics.
  Object.defineProperty(window.HTMLInputElement.prototype, 'checked', { configurable:true, get() { return this.hasAttribute('checked'); }, set(v) { this.toggleAttribute('checked', v); } });
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', { configurable:true, get() { return this.querySelector('option[selected]')?.value || this.querySelector('option')?.value || ''; }, set(v) { this.querySelectorAll('option').forEach(o => o.toggleAttribute('selected',o.value === v)); } });
  window.HTMLElement.prototype.scrollIntoView = function() {};
  window.HTMLElement.prototype.focus = function() { window.lastFocus = this; };
  const form = document.querySelector('form');
  Object.defineProperty(form, 'elements', { get: () => [...form.querySelectorAll('input, select, textarea, button')] });
  const submits = [];
  const add = form.addEventListener.bind(form);
  form.addEventListener = (name, fn, ...rest) => { if (name === 'submit') submits.push(fn); else add(name, fn, ...rest); };
  const storage = new Map();
  const events = [], requests = [], timers = [];
  class FormData {
    constructor(node) { this.values = node.elements.filter(e => e.name && !e.disabled && (!['radio','checkbox'].includes(e.type) || e.checked)).map(e => [e.name,e.value]); }
    get(key) { return this.values.find(([k]) => k === key)?.[1] ?? null; }
    getAll(key) { return this.values.filter(([k]) => k === key).map(([,v]) => v); }
  }
  const context = vm.createContext({ document, window, FormData, Event:window.Event, console:{ log(){},warn(){},error(){} }, URL, URLSearchParams, CSS:{escape:String},
    localStorage:{getItem:() => null}, location:{ pathname:'/workout-builder.html', search:'',href:'http://localhost/workout-builder.html'},
    sessionStorage:{setItem(k,v) { if(storageFails) throw Error('denied'); storage.set(k,v); }},
    history:{replaceState(){}}, setTimeout:fn => timers.push(fn),
    auth:{currentUser:signedIn ? {getIdToken:async () => 'test-token'} : null}, db:{},
    guardProtectedPage:callbacks => { context.guard = callbacks; }, trackPageView(){}, trackEvent:(name,fields)=>events.push([name,fields]),
    generationFailureCategory:()=> 'upstream', getEquipmentLabel:(_,v)=>v, buildEquipmentSummaryText:(_,values)=>values.join(', '),
    derivePriorityFromGoal:()=> 'hypertrophy', t:(_,key)=>key, escapeHtml:s=>String(s).replaceAll('<','&lt;'),
    fetchWithDeadline:async (url,options)=>{ requests.push({url,payload:JSON.parse(options.body)}); return context.response; },
    renderProgram:()=> { context.rendered = true; }, hideResult(){}, setStatus:(text)=>{ document.querySelector('#builder-status').textContent = text; },
    createWeeklyScheduleDays:n=>Array(n).fill('monday'), ...helpers
  });
  vm.runInContext(read('public/js/simple-ux.js'),context);
  vm.runInContext(read('public/js/exercise-demo-preference.js').replace(/^export /gm,''),context);
  // Use the real shared screening and draft functions inside this DOM realm.
  vm.runInContext(read('public/js/health-screening.mjs').replaceAll('export function','function'),context);
  vm.runInContext(read('public/js/guest-trial.mjs').replaceAll('export function','function'),context);
  let source = read('public/js/workout-builder.js').split('async function saveWorkoutPlan')[0];
  source = source.replace(/import\s+[\s\S]*?\s+from\s+["'][^"']+["'];/g,'');
  vm.runInContext(source,context);
  const run = code => vm.runInContext(code,context);
  const change = (selector,value) => {
    const input = document.querySelector(selector);
    if (input.type === 'radio') { form.querySelectorAll(`input[name="${input.name}"]`).forEach(e=>e.checked=false); input.checked=true; }
    else if(input.type==='checkbox') input.checked=value;
    else input.value=String(value);
    input.dispatchEvent(new window.Event('change',{bubbles:true}));
  };
  const submit = () => submits[0]({preventDefault(){}});
  const valid = () => {
    change('input[name="visualGoal"][value="buildMuscle"]',true);
    change('input[name="visualExperience"][value="beginner"]',true);
    change('input[name="visualStyle"][value="hybrid"]',true);
    change('input[name="equipment"][value="dumbbell"]',true);
    change('#age',30); change('[name="screeningStatus"]','none');
  };
  return { context,document,form,events,requests,storage,run,change,submit,valid,timers };
}

test('three stages keep every canonical option and required screening in the final stage', async () => {
  const h=await harness();
  assert.equal(h.document.querySelectorAll('.wizard-step').length,3);
  for(const name of ['goal','experience','trainingStyle']) assert.equal(h.document.querySelector(`#${name}`).hidden,true);
  assert.equal(h.document.querySelectorAll('[name="visualGoal"]').length,5);
  assert.equal(h.document.querySelectorAll('[name="visualExperience"]').length,4);
  assert.equal(h.document.querySelectorAll('[name="equipment"]').length,10);
  assert.match(h.document.querySelector('[name="screeningStatus"]').closest('.wizard-step').dataset.wizardStep,/suitability/);
  assert.equal(h.document.querySelector('[name="screeningStatus"]').required,true);
  assert.equal(h.document.querySelector('[data-wizard-step="style"]').closest('details'),null);
  assert.equal(h.document.querySelector('.available-days-fieldset').closest('details'),null);
});

test('all goals, all experience levels and all styles validate without schema changes', async()=>{
  const h=await harness();
  for(const goal of ['buildMuscle','loseFat','increaseStrength','improveSkills','maintainPerformance']) {
    h.change(`[name="visualGoal"][value="${goal}"]`,true);
    for(const level of ['beginner','intermediate','advanced','professional']) {
      h.change(`[name="visualExperience"][value="${level}"]`,true);
      assert.equal(h.run('validateWizardStep(0)'), '');
    }
  }
  for(const style of ['gym','calisthenics','hybrid']) {
    h.change(`[name="visualStyle"][value="${style}"]`,true);
    h.change('[name="equipment"][value="bodyweight"]',true);
    assert.equal(h.run('validateWizardStep(1)'), '');
  }
});

test('Continue validates, Back retains answers, stage buttons cannot skip forward',async()=>{
  const h=await harness();
  h.document.querySelector('#wizardNextButton').click();
  assert.equal(h.run('wizardStepIndex'),0);
  assert.equal(h.events.filter(([name])=>name==='builder_validation_error').length,1);
  h.valid(); h.document.querySelector('#wizardNextButton').click();
  assert.equal(h.run('wizardStepIndex'),1);
  assert.equal(h.context.window.lastFocus.textContent,'Your training setup');
  h.document.querySelector('#wizardBackButton').click();
  assert.equal(h.document.querySelector('#goal').value,'buildMuscle');
  assert.equal(h.document.querySelector('[data-journey-stage="2"]').disabled,true);
});

test('age, explicit screening, schedule and conditional muscle selection fail closed before auth',async()=>{
  const h=await harness(); h.valid();
  for(const value of ['',17,101,20.5]) { h.change('#age',value); await h.submit(); assert.equal(h.storage.size,0); }
  h.change('#age',30);
  for(const value of ['', 'review']) { h.change('[name="screeningStatus"]',value); await h.submit(); assert.equal(h.storage.size,0); }
  h.change('[name="screeningStatus"]','none');
  h.change('[name="muscleFocusMode"][value="prioritize"]',true);
  await h.submit(); assert.equal(h.storage.size,0);
  h.run('toggleMuscle("back")');
  assert.equal(h.run('validateWizardStep(2)'), '');
  h.change('#sessionDuration',19); assert.match(h.run('validateWizardStep(1)'),/20/);
  h.change('#sessionDuration',180); assert.equal(h.run('validateWizardStep(1)'), '');
  for(let days=1;days<=7;days++) { h.change('#daysPerWeek',days); assert.equal(h.run('validateWizardStep(1)'), ''); }
  h.change('[name="availableDays"][value="monday"]',false);
  assert.match(h.run('validateWizardStep(1)'),/exactly 7/);
});

test('guest handoff preserves muscle choices and exact custom days despite preset restoration',async()=>{
  const h=await harness(); h.valid();
  h.change('[name="equipmentPreset"][value="gym"]',true);
  assert.equal(h.document.querySelector('#trainingStyle').value,'hybrid');
  h.change('#daysPerWeek',2);
  h.change('[name="availableDays"][value="monday"]',false);
  h.change('[name="availableDays"][value="thursday"]',false);
  h.change('[name="availableDays"][value="saturday"]',true);
  h.change('[name="availableDays"][value="sunday"]',true);
  h.change('[name="muscleFocusMode"][value="selected_only"]',true);
  h.run('toggleMuscle("back"); toggleMuscle("biceps")');
  await h.submit();
  const fields=JSON.parse(h.storage.get('fp-guest-trial-v1:workout')).payload;
  assert.match(h.document.querySelector('#builder-status').textContent,/Continue with Google/);
  assert.deepEqual(fields.filter(f=>f.name==='selectedMuscles').map(f=>f.value),['biceps','back']);
  h.context.savedFields=fields;
  h.run('restoreWorkoutDraft(savedFields)');
  assert.equal(h.document.querySelector('#trainingStyle').value,'hybrid');
  assert.equal(h.run('selectedAvailableDays().join(",")'),'saturday,sunday');
  assert.equal(h.run('muscleFocusPayload().selectedMuscles.join(",")'),'biceps,back');
  assert.equal(h.requests.length,0);
  assert.equal(h.document.querySelector('.guest-signup-button'),null);
});

test('blocked storage never redirects a guest with a false saved-answers promise',async()=>{
  const h=await harness({storageFails:true}); h.valid(); await h.submit();
  assert.match(h.document.querySelector('#builder-status').textContent,/could not save/);
  assert.equal(h.document.querySelector('.guest-signup-button'),null);
  assert.equal(h.requests.length,0);
});

test('authenticated generation keeps payload intact, emits one success and clears busy state',async()=>{
  const h=await harness({signedIn:true}); h.valid();
  h.change('#gender','female');
  h.context.response={ok:true,json:async()=>({program:{sessions:[{exercises:[]}],daysPerWeek:1}})};
  await h.submit();
  assert.equal(h.requests.length,1);
  assert.equal(h.requests[0].payload.goal,'buildMuscle');
  assert.equal(h.requests[0].payload.screeningStatus,'none');
  assert.deepEqual(Array.from(h.requests[0].payload.equipment),['dumbbell']);
  assert.equal(h.events.filter(([name])=>name==='workout_generated').length,1);
  assert.equal(h.context.window.currentWorkoutProgram.demonstrationModel,'female');
  assert.equal(h.form.getAttribute('aria-busy'),'false');
  assert.equal(h.document.querySelector('#age').disabled,false);
});

test('failed generation retains answers/draft and retry works; concurrent submit is ignored',async()=>{
  const h=await harness({signedIn:true}); h.valid();
  let release;
  h.context.response={ok:false,status:503,json:()=>new Promise(resolve=> { release=()=>resolve({error:'Unavailable'}); })};
  h.context.builderErrorMessage=()=> 'Unavailable';
  const pending=h.submit(); await new Promise(resolve=>setImmediate(resolve));
  await h.submit(); assert.equal(h.requests.length,1);
  assert.equal(h.form.getAttribute('aria-busy'),'true');
  release(); await pending;
  assert.equal(h.events.filter(([name])=>name==='generation_failed').length,1);
  assert.equal(h.document.querySelector('#goal').value,'buildMuscle');
  h.context.response={ok:true,json:async()=>({program:{sessions:[]}})};
  await h.submit(); assert.equal(h.requests.length,2);
});

test('resume removes the flag and schedules generation once without another Generate click event',async()=>{
  const h=await harness({signedIn:true}); h.valid();
  const fields=h.run('workoutDraftFields(serializeForm(form), muscleFocusPayload())');
  h.storage.set('fp-guest-trial-v1:workout',JSON.stringify({savedAt:Date.now(),payload:fields}));
  h.context.sessionStorage.getItem=k=>h.storage.get(k);
  h.context.location.search='?resumeGuest=workout';
  h.context.location.href+='?resumeGuest=workout';
  h.context.history.replaceState=(_,__,url)=>{h.context.location.search=url.search;};
  h.run('resumeGuestWorkout(auth.currentUser); resumeGuestWorkout(auth.currentUser)');
  assert.equal(h.timers.length,1);
  assert.equal(h.events.filter(([name])=>name==='generate_clicked').length,0);
});
