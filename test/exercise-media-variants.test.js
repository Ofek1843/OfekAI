const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function runtime() {
  const memory = new Map();
  const scope = vm.createContext({ localStorage: {getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)} });
  for (const file of ['exercise-image.js','exercise-media.js','exercise-demo-preference.js']) {
    vm.runInContext(read('public/js/'+file).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,''), scope);
  }
  return scope;
}
const exercise = {exerciseId:'barbell-squat', name:'Barbell Squat', sets:3, restSeconds:90};
const variants = {'barbell-squat':'/images/exercises/female/barbell-squat.webp'};
test('available female variant uses one whole infographic without changing exercise metadata', () => {
  const s=runtime(), before=JSON.stringify(exercise);
  assert.equal(s.resolveExerciseMedia(exercise,'female',variants).url,variants['barbell-squat']);
  assert.equal(JSON.stringify(exercise),before);
});
test('unavailable female, male and unspecified preferences preserve default guides', () => {
  const s=runtime(), standard=s.exerciseImageUrl(exercise);
  for(const model of ['male','default',undefined]) assert.equal(s.resolveExerciseMedia(exercise,model,variants).url,standard);
  assert.equal(s.resolveExerciseMedia(exercise,'female',{}).url,standard);
  assert.equal(s.resolveExerciseMedia(exercise,'female',{'barbell-squat':'https://other.test/image.webp'}).url,standard);
});
test('canonical aliases share a female variant and unknown exercises use the branded fallback', () => {
  const s=runtime();
  assert.equal(s.resolveExerciseMedia({exerciseId:'back-squat'},'female',variants).url,variants['barbell-squat']);
  assert.equal(s.resolveExerciseMedia({exerciseId:'not-an-exercise'},'female',variants).url,s.fallbackExerciseImageUrl());
});
test('female image load failures progress to default and branded fallback, then terminate', () => {
  const s=runtime(), image={dataset:{}};
  s.setExerciseMedia(image,exercise,'female',variants);
  image.onerror(); assert.equal(image.src,s.exerciseImageUrl(exercise));
  assert.equal(image.dataset.src,image.src, 'returning to a hidden day reuses the working fallback');
  image.onerror(); assert.equal(image.src,s.fallbackExerciseImageUrl());
  image.onerror(); assert.equal(image.onerror,null);
});
test('replacement resets the fallback chain and hidden days do not load images', () => {
  const s=runtime(), image={dataset:{}};
  s.setExerciseMedia(image,exercise,'female',variants,{load:false});
  assert.equal(image.src,undefined); assert.equal(image.dataset.src,variants['barbell-squat']);
  s.setExerciseMedia(image,{exerciseId:'plank'},'female',variants);
  assert.match(image.src,/plank/); image.onerror(); assert.equal(image.src,s.fallbackExerciseImageUrl());
});
test('saved recipient overrides account defaults and account switching does not change a saved plan', async () => {
  const s=runtime(), plan={demonstrationModel:'female',sessions:[{exercises:[{...exercise}]}]}, before=JSON.stringify(plan);
  assert.equal(s.demonstrationModel(plan.demonstrationModel),'female');
  await s.chooseDemonstrationModel('male'); assert.equal(s.demonstrationModel('female'),'female');
  await s.chooseDemonstrationModel('default'); assert.equal(s.demonstrationModel('female'),'female');
  await s.chooseDemonstrationModel('female'); assert.equal(s.demonstrationModel('male'),'male');
  assert.equal(s.demonstrationModel('default'),'default');
  assert.equal(JSON.stringify(plan),before);
});
test('blocked persistence and view listeners cannot block the preference change', async () => {
  const s=runtime(); s.localStorage.setItem=()=>{throw Error('blocked')};
  s.onDemonstrationChange(()=>{throw Error('closed view')});
  assert.equal(await s.chooseDemonstrationModel('female'),true);
  assert.equal(s.demonstrationModel(),'female');
});
test('manifest covers every canonical exercise and published female references must exist', () => {
  const manifest=JSON.parse(read('docs/female-exercise-media-manifest.json'));
  const {getEnabledPublicExerciseIds}=require('../lib/workout-exercise-catalog');
  assert.deepEqual(manifest.exercises.map(x=>x.exerciseId).sort(),getEnabledPublicExerciseIds());
  const s=runtime();
  for (const entry of manifest.exercises) {
    const media=s.resolveExerciseMedia({exerciseId:entry.exerciseId},'female');
    assert.ok(fs.existsSync(path.join(root,'public',media.url.split('?')[0])));
  }
});
test('all required views integrate the shared selector/resolver without replacing layout CSS', () => {
  for (const file of ['workout-builder.js','exercise-demos.js','exercise-library.js','saved-workout-view.mjs','workout-tracker.js']) {
    assert.match(read('public/js/'+file),/setExerciseMedia/);
  }
  assert.match(read('server.js'),/data-exercise-id="\$\{escapeHtml\(exercise.exerciseId\)\}"/);
  assert.match(read('server.js'),/<script type="module" src="\/js\/exercise-library.js"><\/script>/);
  assert.match(read('public/js/workout-builder.js'), /data\.program\.demonstrationModel = demonstrationModel\(program\.demonstrationModel\)/);
  assert.match(read('public/css/workout-result-paper.css'),/@container workout-exercises \(min-width: 640px\)/);
});

function syncedRuntime() {
  const memory = new Map(), writes = [], reads = [];
  let authChanged;
  const store = {
    doc: (_db,...parts) => parts.join('/'),
    getDoc: ref => new Promise(resolve => reads.push({ref, resolve})),
    setDoc: async (ref, data, options) => writes.push({ref,data,options})
  };
  const scope = vm.createContext({
    localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},
    config:{auth:{},db:{}}, mockAuthApi:{onAuthStateChanged:(_auth, fn)=>{authChanged=fn;}}, mockStore:store
  });
  const source=read('public/js/exercise-demo-preference.js').replace(/^export /gm,'')
    .replace("import('./firebase-config.js')",'Promise.resolve(config)')
    .replace("import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js')",'Promise.resolve(mockAuthApi)')
    .replace("import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js')",'Promise.resolve(mockStore)');
  vm.runInContext(source,scope);
  return {scope,writes,reads,store,authChanged:user=>authChanged(user)};
}
test('account sync writes only a presentation enum to the existing private settings document', async () => {
  const s=syncedRuntime(); await s.scope.startDemonstrationPreference();
  const pending=s.authChanged({uid:'test-user'});
  s.reads[0].resolve({data:()=>({demonstrationModel:'female'})}); await pending;
  assert.equal(s.scope.demonstrationModel(),'female'); assert.equal(s.writes.length,0);
  await s.scope.chooseDemonstrationModel('male');
  assert.deepEqual(JSON.parse(JSON.stringify(s.writes)),[{ref:'users/test-user/settings/main',data:{demonstrationModel:'male'},options:{merge:true}}]);
  await s.authChanged(null); assert.equal(s.scope.demonstrationModel(),'default');
});
test('slow cloud reads cannot overwrite a newer choice and a startup choice survives authentication', async () => {
  const s=syncedRuntime(); await s.scope.startDemonstrationPreference();
  await s.scope.chooseDemonstrationModel('female'); await s.authChanged({uid:'test-user'});
  assert.equal(s.scope.demonstrationModel(),'female'); assert.equal(s.reads.length,0);
  const pending=s.authChanged({uid:'another-user'});
  await s.scope.chooseDemonstrationModel('male');
  s.reads[0].resolve({data:()=>({demonstrationModel:'female'})}); await pending;
  assert.equal(s.scope.demonstrationModel(),'male');
});
