const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
function fixture({pending=true,user='new-user',saved=true,hanging=false}={}){
 const {document,Event}=parseHTML('<html lang="he"><head></head><body><main></main></body></html>');
 const memory=new Map(pending?[['fp_personalization_onboarding_uid','new-user']]:[]),writes=[];
 const create=document.createElement.bind(document);document.createElement=name=>{const el=create(name);if(name==='dialog'){el.showModal=()=>{el.open=true};el.close=()=>{el.open=false};}return el;};
 let refresh,selected='female',uid=user;
 const scope=vm.createContext({document,setTimeout:(fn,ms)=>setTimeout(fn,hanging?0:ms),clearTimeout,FormData:class{get(){return selected}},sessionStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},
 accountPreferenceUserId:()=>uid,chooseDemonstrationModel:async v=>{writes.push(v);return hanging?new Promise(()=>{}):saved},onDemonstrationChange:fn=>refresh=fn,startDemonstrationPreference:()=>{}});
 vm.runInContext(fs.readFileSync('public/js/personalization-onboarding.js','utf8').replace(/^import[\s\S]*?;\r?\n/,''),scope);
 return {document,Event,memory,writes,refresh,select:v=>selected=v,setUser:v=>{uid=v;refresh()}};
}
test('only a matching new-account handoff opens the mandatory choice; Escape cannot cancel it',()=>{
 for(const options of [{pending:false},{user:null},{user:'other-user'}])assert.equal(fixture(options).document.querySelector('dialog'),null);
 const f=fixture(),d=f.document.querySelector('dialog');assert.equal(d.open,true);assert.equal(d.querySelector('button').disabled,true);
 const event=new f.Event('cancel',{cancelable:true});d.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(d.open,true);
 assert.equal(d.querySelectorAll('.onboarding-options input').length,2);
 assert.ok(d.querySelector('input[value="default"]'));f.setUser(null);assert.equal(!!f.document.querySelector('dialog'),false);
});
test('explicit female, male and no-preference choices save once and clear only their own handoff',async()=>{
 for(const choice of ['female','male','default']){
  const f=fixture();f.select(choice);const form=f.document.querySelector('form');form.dispatchEvent(new f.Event('change'));
  form.dispatchEvent(new f.Event('submit',{cancelable:true}));await new Promise(setImmediate);
  assert.deepEqual(f.writes,[choice]);assert.equal(f.memory.has('fp_personalization_onboarding_uid'),false);
  f.refresh();assert.equal(!!f.document.querySelector('dialog'),false);
 }
});
test('sync failure reports browser-only application and does not trap the user or falsely clear the retry marker',async()=>{
 const f=fixture({saved:false}),form=f.document.querySelector('form');form.dispatchEvent(new f.Event('change'));
 form.dispatchEvent(new f.Event('submit',{cancelable:true}));await new Promise(setImmediate);
 assert.equal(!!f.document.querySelector('dialog'),false);assert.equal(f.memory.get('fp_personalization_onboarding_uid'),'new-user');
 assert.match(f.document.querySelector('[role="status"]').textContent,/סנכרון/);
});
test('a queued offline Firestore write cannot leave the mandatory dialog locked',async()=>{
 const f=fixture({hanging:true}),form=f.document.querySelector('form');
 form.dispatchEvent(new f.Event('change'));form.dispatchEvent(new f.Event('submit',{cancelable:true}));
 await new Promise(resolve=>setTimeout(resolve,15));
 assert.equal(!!f.document.querySelector('dialog'),false);
 assert.equal(f.memory.get('fp_personalization_onboarding_uid'),'new-user');
 assert.ok(f.document.querySelector('.onboarding-sync-notice'));
});
test('a guest is asked once and their selected preference remains available for signup',async()=>{
 const f=fixture({pending:false,user:null});f.memory.set('fp_guest_onboarding_pending','1');f.refresh();
 const form=f.document.querySelector('form');assert.ok(form);f.select('female');
 form.dispatchEvent(new f.Event('change'));form.dispatchEvent(new f.Event('submit',{cancelable:true}));
 await new Promise(setImmediate);assert.deepEqual(f.writes,['female']);
 assert.equal(f.memory.get('fp_guest_choice_completed'),'1');assert.equal(f.memory.has('fp_guest_onboarding_pending'),false);
 f.refresh();assert.equal(!!f.document.querySelector('dialog'),false);
});
