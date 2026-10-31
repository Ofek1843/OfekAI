import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { nutritionTimestampMillis, preferNutritionDraft } from '../public/js/daily-nutrition-recovery.mjs';

const source=fs.readFileSync(new URL('../public/js/daily-nutrition.js',import.meta.url),'utf8');
const body=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

test('serialized cloud timestamps and SDK timestamps have identical freshness semantics',()=>{
  assert.equal(nutritionTimestampMillis({seconds:3,nanoseconds:500000000}),3500);
  assert.equal(nutritionTimestampMillis({toMillis:()=>3500}),3500);
  const remote={entries:[],updatedAt:{seconds:3}};
  assert.equal(preferNutritionDraft(remote,{savedAt:2000,log:{entries:[]}}),remote);
  assert.equal(nutritionTimestampMillis('invalid'),0);
});

test('server fallback requests only the signed-in user day with a bearer token',async()=>{
  let request;
  const ctx={state:{user:{getIdToken:async()=> 'token-for-user'}},
    withTimeout:p=>p,fetch:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({log:{entries:[{id:'server-food'}]}})};},
    normalizeLog:(date,log)=>({dateKey:date,...log})};
  vm.createContext(ctx);vm.runInContext(body('async function loadDailyLogFromServer(','function sameSavedLog'),ctx);
  const log=await ctx.loadDailyLogFromServer('2026-10-16');
  assert.equal(request.url,'/api/daily-nutrition/day/2026-10-16');
  assert.equal(request.options.headers.Authorization,'Bearer token-for-user');
  assert.equal(request.options.cache,'no-store');
  assert.equal(log.entries[0].id,'server-food');
});

test('server diary write uses the signed-in token and serialized day snapshot',async()=>{
  let request;
  const ctx={state:{user:{getIdToken:async()=> 'token-for-user'}},fetch:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({saved:true})};}};
  vm.createContext(ctx);vm.runInContext(body('async function saveDailyLogToServer(','function stableLogValue'),ctx);
  await ctx.saveDailyLogToServer('2026-10-16',{entries:[],completed:false});
  assert.equal(request.url,'/api/daily-nutrition/day/2026-10-16');
  assert.equal(request.options.method,'PUT');
  assert.equal(request.options.headers.Authorization,'Bearer token-for-user');
  assert.equal(JSON.parse(request.options.body).log.completed,false);
});

test('equivalent diary snapshots compare equal regardless of property order',()=>{
  const ctx={};vm.createContext(ctx);vm.runInContext(body('function stableLogValue(','const state ='),ctx);
  assert.equal(ctx.sameSavedLog(
    {entries:[{id:'one',name:{en:'Oats',he:'שיבולת שועל'}}],targetSnapshot:{source:'plan',dailyCalories:2000},maintenanceSnapshot:null,completed:false},
    {entries:[{name:{he:'שיבולת שועל',en:'Oats'},id:'one'}],targetSnapshot:{dailyCalories:2000,source:'plan'},maintenanceSnapshot:null,completed:false}
  ),true);
});

test('successful server diary save clears the local draft without a second browser write',async()=>{
  const drafts=new Map(),node={},state={user:{uid:'u'},dateKey:'2026-10-16',log:{entries:[],completed:false},saveChain:Promise.resolve()};
  let serverWrites=0,browserWrites=0;
  const ctx={state,structuredClone,Date,Math,db:{},console:{error(){}},$:()=>node,copy:{savingStatus:'saving',saveStatus:'saved',savedOnDevice:'local'},
    updateWeekLog(){},writeDailyDraft(uid,date,log,token){drafts.set(date,{log,token});},readDailyDraft:(uid,date)=>drafts.get(date),
    clearDailyDraft(uid,date,token){if(drafts.get(date)?.token===token)drafts.delete(date);},
    saveDailyLogToServer:async()=>{serverWrites++;},saveDailyLog:async()=>{browserWrites++;},withDeadline:p=>p,setTimeout};
  vm.createContext(ctx);vm.runInContext(body('function queueSave()','function renderTargets'),ctx);
  assert.equal(await ctx.queueSave(),true);
  assert.equal(serverWrites,1);assert.equal(browserWrites,0);assert.equal(drafts.size,0);
  assert.equal(node.textContent,'saved');
});

test('a timed-out write stays serialized; a late old save cannot overtake a newer save',async()=>{
  const drafts=new Map(),writes=[],node={},state={user:{uid:'u'},dateKey:'2026-10-16',log:{entries:[{calories:100}]},saveChain:Promise.resolve()};
  const ctx={state,structuredClone,Date,Math,db:{},console:{error(){}},$:()=>node,copy:{savingStatus:'saving',saveStatus:'saved',savedOnDevice:'local',saveError:'failed'},
    updateWeekLog(){},writeDailyDraft(uid,date,log,token){drafts.set(date,{log,token});},readDailyDraft:(uid,date)=>drafts.get(date),
    clearDailyDraft(uid,date,token){if(drafts.get(date)?.token===token)drafts.delete(date);},
    saveDailyLog(db,uid,date,log){const gate=deferred();writes.push({date,log,gate});return gate.promise;},
    withDeadline:p=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(Error('TIMEOUT')),8))]),setTimeout};
  vm.createContext(ctx);vm.runInContext(body('function queueSave()','function renderTargets'),ctx);
  assert.equal(await ctx.queueSave(),false);
  state.log.entries[0].calories=200;
  const newer=ctx.queueSave();await tick();
  assert.equal(writes.length,1,'timeout must not release the underlying write');
  assert.equal(writes[0].log.entries[0].calories,100,'save captured an immutable snapshot');
  writes[0].gate.resolve();await tick();
  assert.equal(writes.length,2);
  assert.equal(drafts.get(state.dateKey).log.entries[0].calories,200,'old completion cannot clear the newer draft');
  writes[1].gate.resolve();assert.equal(await newer,true);await state.saveChain;
  assert.equal(writes[1].log.entries[0].calories,200);
  assert.equal(drafts.size,0);
});

test('rapid day navigation discards a stale read and never exposes an old log under the new day',async()=>{
  const loads=new Map(),renders=[],state={user:{uid:'u'},dateKey:'2026-10-14',log:{entries:[{calories:99}]},saveChain:Promise.resolve(),targets:{complete:false}};
  const ctx={state,db:{},console:{warn(){}},$:()=>({}),copy:{loading:'loading'},navigator:{onLine:false},
    withDeadline:p=>p,withTimeout:p=>p,LOG_LOAD_TIMEOUT_MS:10,readDailyDraft:()=>null,
    loadDailyLog(db,uid,date){const gate=deferred();loads.set(date,gate);return gate.promise;},loadNutritionWeek:async()=>[],
    normalizeLog:(date,log={})=>({dateKey:date,entries:[],...log}),setComposerMessage(){},setPageStatus(){},loadCalendarMonth(){},
    render(){renders.push({date:state.dateKey,log:state.log.dateKey});}};
  vm.createContext(ctx);vm.runInContext(body('async function loadDate(','function addEntries'),ctx);
  const first=ctx.loadDate('2026-10-15');assert.equal(state.log,null);await tick();
  const latest=ctx.loadDate('2026-10-16');await tick();
  loads.get('2026-10-16').resolve({dateKey:'2026-10-16',entries:[{calories:200}]});await latest;
  loads.get('2026-10-15').resolve({dateKey:'2026-10-15',entries:[{calories:100}]});await first;
  assert.deepEqual(renders,[{date:'2026-10-16',log:'2026-10-16'}]);
  assert.equal(state.log.entries[0].calories,200);
});

test('a failed browser read uses the authenticated server copy instead of claiming the day is unsaved',async()=>{
  const status={};let pageStatus;
  const state={user:{uid:'u'},saveChain:Promise.resolve(),targets:{complete:false}};
  const ctx={state,db:{},console:{warn(){}},$:selector=>selector==='#autosaveState'?status:{hidden:false},copy:{loading:'loading',saveStatus:'saved',logLoadFailed:'failed'},navigator:{onLine:false},
    withDeadline:p=>p,withTimeout:p=>p,LOG_LOAD_TIMEOUT_MS:10,readDailyDraft:()=>null,
    loadDailyLog:async()=>{throw Error('browser stream stalled');},
    loadDailyLogFromServer:async date=>({dateKey:date,entries:[{id:'cloud'}],completed:false}),
    loadNutritionWeek:async()=>[],normalizeLog:(date,log={})=>({dateKey:date,entries:[],...log}),
    setComposerMessage(){},setPageStatus(message,error){pageStatus={message,error};},render(){},loadCalendarMonth(){}};
  vm.createContext(ctx);vm.runInContext(body('async function loadDate(','function addEntries'),ctx);
  await ctx.loadDate('2026-10-16');
  assert.equal(state.log.entries[0].id,'cloud');
  assert.equal(state.log.readFailed,undefined);
  assert.equal(pageStatus.message,'');
  assert.equal(status.textContent,'saved');
});

test('a server-confirmed completed write clears its stale local warning without resaving',async()=>{
  const status={},entry={id:'food-1',calories:100},draft={token:'old',savedAt:200,log:{entries:[entry],completed:false,targetSnapshot:null}};
  let cleared=0,saved=0;
  const state={user:{uid:'u'},saveChain:Promise.resolve(),targets:{complete:false}};
  const ctx={state,db:{},console:{warn(){}},$:selector=>selector==='#autosaveState'?status:{hidden:false},copy:{loading:'loading',saveStatus:'saved',savedOnDevice:'pending'},navigator:{onLine:true},
    withDeadline:p=>p,withTimeout:p=>p,LOG_LOAD_TIMEOUT_MS:10,
    readDailyDraft:()=>cleared?null:draft,clearDailyDraft:()=>{cleared++;},
    loadDailyLog:async date=>({dateKey:date,entries:[entry],completed:false,targetSnapshot:null,updatedAt:100}),
    loadDailyLogFromServer:async date=>({dateKey:date,entries:[entry],completed:false,targetSnapshot:null,updatedAt:300}),
    sameSavedLog:(a,b)=>JSON.stringify(a.entries)===JSON.stringify(b.entries),
    loadNutritionWeek:async()=>[],normalizeLog:(date,log={})=>({dateKey:date,entries:[],completed:false,targetSnapshot:null,...log}),
    timestampMillis:value=>Number(value)||0,setComposerMessage(){},setPageStatus(){},render(){},loadCalendarMonth(){},queueSave(){saved++;}};
  vm.createContext(ctx);vm.runInContext(body('async function loadDate(','function addEntries'),ctx);
  await ctx.loadDate('2026-10-16');
  assert.equal(cleared,1);
  assert.equal(saved,0);
  assert.equal(status.textContent,'saved');
});

test('a food interpretation requested for a previous day cannot add to the newly selected day',async()=>{
  const lookup=deferred(),state={user:{uid:'u'},dateKey:'2026-10-15',dateLoadRequest:1,log:{entries:[]},customFoods:[]};let added=0;
  const ctx={state,language:'en',parseFoodText:()=>({entries:[],ambiguities:[],errors:[{code:'UNKNOWN_FOOD',segment:'food'}]}),
    parseAmountPrefix:()=>({}),cachedWeighedFood:()=>null,
    requestSmartFoodInterpretation:()=>lookup.promise,setComposerMessage(){},addEntries(){added++;}};
  vm.createContext(ctx);vm.runInContext(body('async function submitFoodText(','function bindEvents'),ctx);
  const pending=ctx.submitFoodText('food');state.dateKey='2026-10-16';state.dateLoadRequest++;
  lookup.resolve({});await pending;assert.equal(added,0);
});
test('duplicate submits during food recognition run once and controls recover after failure',async()=>{
  const gate=deferred(),button={},input={value:'unknown food'};let handler,calls=0;
  const form={dataset:{},setAttribute(){},addEventListener(type,fn){handler=fn;}};
  const ctx={state:{log:{}},$:key=>key==='#foodComposerForm'?form:key==='#foodInput'?input:button,
    copy:{saveError:'failed'},console:{error(){}},setComposerMessage(){},submitFoodText(){calls++;return gate.promise;}};
  vm.createContext(ctx);vm.runInContext(body('function bindFoodComposer()','async function init('),ctx);ctx.bindFoodComposer();
  const event={preventDefault(){}},first=handler(event);await handler(event);
  assert.equal(calls,1);assert.equal(button.disabled,true);
  gate.reject(Error('unavailable'));await first;
  assert.equal(button.disabled,false);assert.equal(form.dataset.submitting,'false');assert.equal(input.value,'unknown food');
});
test('copy-yesterday click uses fallback, appends through save path, and ignores a stale date',async()=>{
 const start=source.indexOf('  $("#copyYesterdayButton").addEventListener');
 const end=source.indexOf('  $("#finishDayButton").addEventListener',start);
 assert.ok(start>=0&&end>start);let handler,sourceDay,added=[],message='';
 const button={disabled:false,addEventListener:(name,cb)=>{handler=cb}};
 const user={uid:'u'},state={user,guest:false,dateKey:'2026-10-16',dateLoadRequest:1,log:{entries:[{id:'today'}]}};
 const ctx={state,language:'en',db:{},$:()=>button,shiftDateKey:()=> '2026-10-15',loadDailyLog:async()=>{throw Error('offline')},loadDailyLogFromServer:async(date,account)=>{sourceDay=date;assert.equal(account,user);return {entries:[{id:'yesterday'}]}},loadPreviousNutritionLog:async({loadClient,loadServer})=>{try{return await loadClient()}catch{return loadServer()}},addEntries:entries=>added.push(...entries),setComposerMessage:s=>{message=s},copy:{copied:'Copied {count}',nothingToCopy:'empty',saveError:'error'},format:(s,v)=>s.replace('{count}',v.count)};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);await handler();
 assert.equal(sourceDay,'2026-10-15');assert.equal(added.length,1);assert.equal(added[0].id,'yesterday');assert.equal(message,'Copied 1');assert.equal(button.disabled,false);assert.equal(state.log.entries.length,1);
 const pending=deferred();ctx.loadPreviousNutritionLog=()=>pending.promise;added=[];const click=handler();state.dateKey='2026-10-17';pending.resolve({entries:[{id:'stale'}]});await click;assert.equal(added.length,0);
});
