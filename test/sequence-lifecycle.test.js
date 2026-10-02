const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function fixture(){
  let clock=0,id=0;const timers=new Map(),listeners=new Map();let intersection;
  const element=()=>({dataset:{},classList:{add(){},remove(){}},setAttribute(){},append(child){this.child=child;},addEventListener(){},removeEventListener(){}});
  const document={hidden:false,createElement:element,addEventListener:(type,handler)=>listeners.set(type,handler),removeEventListener:type=>listeners.delete(type)};
  const host={...element(),innerHTML:'fallback',closest(){return this;},replaceChildren(root){this.root=root;}};
  const window={location:{hostname:'localhost',search:''},matchMedia:()=>({matches:false}),setTimeout:(callback,delay)=>{timers.set(++id,{callback,due:clock+delay});return id;},clearTimeout:key=>timers.delete(key),IntersectionObserver:true};
  const context={window,document,URLSearchParams,performance:{now:()=>clock},Image:class {set src(value){queueMicrotask(()=>this.onload?.());}},IntersectionObserver:class{constructor(callback){intersection=callback;}observe(){}disconnect(){}}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/js/image-sequence-v43.js'),'utf8'),context);
  const player=window.FuelPhysiqueImageSequenceV43.mount(host,'curl');
  const visible=value=>intersection([{isIntersecting:value}]);
  const next=()=>{const [key,timer]=[...timers].sort((a,b)=>a[1].due-b[1].due)[0]||[];assert.ok(timer,'expected a scheduled frame');timers.delete(key);clock=timer.due;timer.callback();};
  return {host,player,visible,next,timers,document,listeners};
}
test('curl resumes through its final-frame loop delay after scrolling offscreen',async()=>{
  const f=fixture();f.visible(true);await new Promise(setImmediate);
  for(let i=0;i<4;i++)f.next();
  assert.equal(f.host.root.dataset.v43Frame,'4');f.visible(false);assert.equal(f.timers.size,0);
  f.visible(true);f.next();assert.equal(f.host.root.dataset.v43Frame,'1');f.player.teardown();
});
test('background tabs stop frame timers and foreground resumes without a restart',async()=>{
  const f=fixture();f.visible(true);await new Promise(setImmediate);f.next();
  assert.equal(f.host.root.dataset.v43Frame,'2');f.document.hidden=true;f.listeners.get('visibilitychange')();assert.equal(f.timers.size,0);
  f.document.hidden=false;f.listeners.get('visibilitychange')();f.next();assert.equal(f.host.root.dataset.v43Frame,'3');
  f.player.teardown();assert.equal(f.timers.size,0);assert.equal(f.listeners.has('visibilitychange'),false);
});
