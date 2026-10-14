const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
const editorSource=fs.readFileSync('public/js/my-workout-plans.js','utf8');
const functions=['escapeHtml','getExerciseRestSeconds','renderExerciseRow','readEditedExercises'].map(name=>{
  const match=editorSource.match(new RegExp('function '+name+'\\([\\s\\S]*?\\n}'));
  assert.ok(match,name+' is available');return match[0];
});
const editor=vm.runInNewContext(functions.join('\n')+'\n({renderExerciseRow,readEditedExercises})',{ui:{exerciseName:'Exercise',sets:'Sets',rest:'Rest',remove:'Remove',defaultExercise:'New exercise'}});
test('editing RIR preserves legacy rep data and supports RIR zero',()=>{
  const exercise={name:'Bench Press',exerciseId:'barbell-bench-press',sets:3,reps:'8-12',restSeconds:90,rir:0};
  const {document}=parseHTML('<section>'+editor.renderExerciseRow(exercise)+'</section>');
  assert.equal(document.querySelector('.editor-exercise-reps'),null);
  assert.equal(document.querySelector('.editor-exercise-rir').value,'0');
  document.querySelector('.editor-exercise-rir').value='2';
  const saved=editor.readEditedExercises(document.querySelector('section'),{exercises:[exercise]})[0];
  assert.equal(saved.rir,'2');assert.equal(saved.reps,'8-12');assert.equal(saved.exerciseId,'barbell-bench-press');
});
test('renaming a manual exercise clears stale movement ids before volume counting',()=>{
  const exercise={name:'Bench Press',exerciseId:'barbell-bench-press',demoName:'Bench Press',sets:3,reps:'12',restSeconds:90,rir:'1-3'};
  const {document}=parseHTML('<section>'+editor.renderExerciseRow(exercise)+'</section>');
  document.querySelector('.editor-exercise-name').value='Back Squat';
  const saved=editor.readEditedExercises(document.querySelector('section'),{exercises:[exercise]})[0];
  assert.equal(saved.exerciseId,'');assert.equal(saved.demoName,'Back Squat');assert.equal(saved.reps,'12');
});
test('manual builder saves the editable RIR instead of a hidden fixed value',()=>{
  const source=fs.readFileSync('public/js/manual-workout-builder.js','utf8');
  const selected=['exerciseRow','readExercise'].map(name=>source.match(new RegExp('^function '+name+'\\(.*$','m'))[0]).join('\n');
  const manual=vm.runInNewContext(selected+'\n({exerciseRow,readExercise})',{ui:{exercise:'Exercise',equipment:'Equipment',sets:'Sets',rest:'Rest'},esc:String,findExercise:()=>null});
  const {document}=parseHTML(manual.exerciseRow({name:'Leg Press',sets:4,rir:'0'}));
  assert.equal(document.querySelector('.reps'),null);
  assert.equal(document.querySelector('.rir').value,'0');
  document.querySelector('.rir').value='1-2';
  assert.equal(manual.readExercise(document.querySelector('.exercise-row')).rir,'1-2');
});
test('shared plans preserve an RIR range and explicit zero',()=>{
  const {sanitizeWorkoutSnapshot}=require('../lib/social-domain');
  const snapshot=sanitizeWorkoutSnapshot({sessions:[{name:'Upper',exercises:[{name:'Bench Press',sets:3,rir:'1-3'},{name:'Dumbbell Curl',sets:2,rir:0}]}]});
  assert.equal(snapshot.sessions[0].exercises[0].rir,'1-3');
  assert.equal(snapshot.sessions[0].exercises[1].rir,0);
});
