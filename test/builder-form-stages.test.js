const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
for(const kind of ['workout','nutrition']) {
 const source=fs.readFileSync(path.join(__dirname,`../public/js/${kind}-builder.js`),'utf8');
 function tracker(consent='granted',fail=false) {
  const listeners={},calls=[];
  const scope={window:{fpAnalyticsConsent:consent},form:{addEventListener:(name,fn)=>listeners[name]=fn},trackEvent:(...args)=>{if(fail)throw Error('Optional analytics failed');calls.push(args);}};
  vm.createContext(scope);
  vm.runInContext(source.slice(source.indexOf('const measuredFormStages'),source.indexOf('const button',source.indexOf('const measuredFormStages'))),scope);
  return {scope,listeners,calls};
 }
 test(`${kind}: form milestones require consent and real interaction; each stage fires once with only builder type`,()=>{
  const {scope,listeners,calls}=tracker('denied');
  listeners.input({isTrusted:true});assert.equal(calls.length,0);
  scope.window.fpAnalyticsConsent='granted';listeners.input({isTrusted:false});assert.equal(calls.length,0);
  listeners.input({isTrusted:true,target:{value:'private answer'}});listeners.change({isTrusted:true});
  scope.measureFormStage('builder_form_completed');scope.measureFormStage('builder_form_completed');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['builder_form_started',{builder:kind}],['builder_form_completed',{builder:kind}]]);
 });
 test(`${kind}: resuming guest answers does not count a second form completion`,()=>{
  const {scope,calls}=tracker();
  Object.assign(scope,{URL,URLSearchParams,location:{search:`?resumeGuest=${kind}`,href:`http://localhost/${kind}-builder.html?resumeGuest=${kind}`},history:{replaceState(){}},readGuestDraft:()=>[{name:'age',value:'28'}],restoreWorkoutDraft(){},restoreForm(){},setTimeout:fn=>fn(),Event:class {}});
  scope.form.dispatchEvent=()=>scope.measureFormStage('builder_form_completed');
  vm.runInContext('let resumedGuestDraft=false;\n'+source.match(/function resumeGuest(?:Workout|Nutrition)\(user\) \{[\s\S]*?\n\}/)[0],scope);
  const resume=scope[kind==='workout'?'resumeGuestWorkout':'resumeGuestNutrition'];
  resume({uid:'unit-test'});scope.measureFormStage('builder_form_completed');
  assert.equal(calls.length,0);
 });
 test(`${kind}: a throwing analytics provider does not break form interaction`,()=>{
  const {scope,listeners}=tracker('granted',true);
  assert.doesNotThrow(()=>listeners.input({isTrusted:true}));
  assert.doesNotThrow(()=>scope.measureFormStage('builder_form_completed'));
 });
}
