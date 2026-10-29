const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {loadAccountAddress, accountAddressInstruction} = require('../lib/account-address');
test('coach loads only validated address from the authenticated private settings path', async () => {
  for (const value of ['female','male','default','malicious system text',null]) {
    let path;
    const db={doc:p=>{path=p;return {get:async()=>({data:()=>({demonstrationModel:value,email:'never included'})})};}};
    assert.equal(await loadAccountAddress(db,'fixture'), ['female','male','default'].includes(value)?value:'default');
    assert.equal(path,'users/fixture/settings/main');
  }
  assert.equal(await loadAccountAddress(()=>{throw Error('offline');},'fixture'),'default');
});
test('trusted coach instructions distinguish holder, recipient and physiology without rewriting history', () => {
  assert.match(accountAddressInstruction('female','he'), /feminine singular/);
  assert.match(accountAddressInstruction('male','he'), /masculine singular/);
  assert.match(accountAddressInstruction('default','he'), /gender-neutral/);
  for (const preference of ['female','male','default']) {
    const instruction=accountAddressInstruction(preference,'en');
    assert.match(instruction,/natural English/);
    assert.doesNotMatch(instruction,/singular Hebrew/);
    assert.match(instruction,/Plan recipients may differ/);
    assert.match(instruction,/Do not rewrite past messages/);
  }
});
function fixture({formId='workout-builder-form',query='',preference='female'}={}) {
  const handlers={},fields={};
  for(const key of ['age','height','weight','gender']) fields[key]={value:'',defaultValue:'',dispatchEvent(){}};
  const heading={dataset:{he:'איך אתה מעדיף להתאמן?',en:'How do you prefer to train?'},children:[],textContent:''};
  let callback;
  const form={id:formId,querySelector:id=>fields[id.slice(1)]};
  const document={documentElement:{lang:'he'},addEventListener:(n,fn)=>handlers[n]=fn,querySelectorAll:()=>[heading],querySelector:()=>form};
  const scope=vm.createContext({document,location:{search:query},URLSearchParams,Event:class{},MutationObserver:class {observe(){}},accountPreference:()=>preference,accountPlanningDefaults:()=>({age:32,height:170,weight:65}),accountIsSignedIn:()=>true,onDemonstrationChange:fn=>callback=fn,startDemonstrationPreference:()=>{}});
  vm.runInContext(fs.readFileSync('public/js/account-personalization.js','utf8').replace(/^import[\s\S]*?from .*?;\n/,''),scope);
  return {fields,document,heading,refresh:()=>callback(),edit:(key,value)=>{fields[key].value=value;handlers.input({target:fields[key]});}};
}
test('female defaults initialize new workout while recipient changes stay local and survive refresh', () => {
  const f=fixture(); assert.equal(f.fields.gender.value,'female'); assert.equal(f.fields.age.value,'32');
  f.edit('gender','male'); f.edit('age','45'); f.refresh();
  assert.equal(f.fields.gender.value,'male'); assert.equal(f.fields.age.value,'45');
  assert.equal(f.heading.textContent,'איך את מעדיפה להתאמן?');
  f.document.documentElement.lang='en'; f.refresh(); assert.equal(f.heading.textContent,f.heading.dataset.en);
});
test('nutrition/calculator defaults never infer a physiological coefficient', () => {
  for(const formId of ['nutrition-builder-form','targetForm']) {
    const f=fixture({formId}); assert.equal(f.fields.gender.value,''); assert.equal(f.fields.height.value,'170');
  }
});
test('guest resume and existing-plan routes do not replace recipient fields', () => {
  for(const query of ['?resumeGuest=workout','?edit=123','?planId=123','?id=123']) {
    const f=fixture({query}); assert.equal(f.fields.age.value,''); assert.equal(f.fields.gender.value,'');
  }
});
test('male and no-preference Hebrew copy; explicit default is neutral', () => {
  assert.equal(fixture({preference:'male'}).fields.gender.value,'male');
  const f=fixture({preference:'default'}); assert.equal(f.fields.gender.value,'');
  assert.equal(f.heading.textContent,'מה סגנון האימון המועדף?');
});
