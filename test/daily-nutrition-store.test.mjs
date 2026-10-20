import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {shiftDateKey,totalsForEntries,weekDateKeys} from '../public/js/daily-nutrition-domain.mjs';
import {withDeadline} from '../public/js/daily-nutrition-recovery.mjs';
const source=fs.readFileSync(new URL('../public/js/daily-nutrition-store.mjs',import.meta.url),'utf8').replace(/^import[\s\S]*?from\s+"[^"]+";\s*/gm,'').replace(/export\s*\{[\s\S]*?\};\s*$/,'');
function store(){
  const saved=new Map(),writes=[];
  const ctx={Date,Math,Number,String,Array,Promise,shiftDateKey,totalsForEntries,weekDateKeys,withDeadline,
    doc:(db,...keys)=>keys.join('/'),getDoc:async ref=>({exists:()=>saved.has(ref),data:()=>structuredClone(saved.get(ref))}),
    setDoc:async(ref,payload,options)=>{const snapshot=structuredClone(payload);saved.set(ref,{...(saved.get(ref)||{}),...snapshot});writes.push({ref,payload:snapshot,options});},serverTimestamp:()=>({seconds:100}),
    collection(){},getDocs(){},deleteDoc(){}};
  vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,saved,writes};
}
const entry={id:'a',name:{en:'Food',he:'מזון'},amount:100,unit:'g',calories:200,proteinGrams:15,carbsGrams:20,fatGrams:5};
test('actual store saves recomputed totals under the selected owner and date and reloads the same day',async()=>{
  const {ctx,writes}=store(),log={entries:[entry],totals:{calories:9999}};
  await ctx.saveDailyLog({},'owner','2026-10-16',log);log.entries[0]={...entry,calories:999};
  assert.equal(writes[0].ref,'users/owner/dailyNutritionLogs/2026-10-16');
  assert.equal(writes[0].payload.totals.calories,200);assert.equal(writes[0].payload.entries[0].calories,200);
  const reloaded=await ctx.loadDailyLog({},'owner','2026-10-16');assert.equal(reloaded.totals.calories,200);
  assert.equal((await ctx.loadDailyLog({},'other','2026-10-16')).entries.length,0);
  assert.equal((await ctx.loadDailyLog({},'owner','2026-10-15')).entries.length,0);
});
test('actual store rejects invalid entries before a write rather than persisting plausible totals',async()=>{
  const {ctx,writes}=store();
  await assert.rejects(ctx.saveDailyLog({},'owner','2026-10-16',{entries:[{...entry,calories:-1}]}),/INVALID_ENTRY/);
  assert.equal(writes.length,0);
  await assert.rejects(ctx.saveDailyLog({},'bad/owner','2026-10-16',{entries:[entry]}),/INVALID_USER/);
});
test('updating an existing day preserves its creation time and supports finishing and reopening it',async()=>{
  const {ctx,writes,saved}=store();
  const ref='users/owner/dailyNutritionLogs/2026-10-16';saved.set(ref,{createdAt:{seconds:1},entries:[entry]});
  await ctx.saveDailyLog({},'owner','2026-10-16',{entries:[entry],completed:true});
  assert.equal(writes[0].payload.completed,true);assert.ok(writes[0].payload.completedAt);
  assert.equal(writes[0].payload.createdAt,undefined);assert.equal(saved.get(ref).createdAt.seconds,1);
  await ctx.saveDailyLog({},'owner','2026-10-16',{entries:[entry],completed:false});
  assert.equal(saved.get(ref).completedAt,null);
});
test('save/reload/copy preserve source snapshots while legacy entries gain no invented source',async()=>{
  const {ctx,writes}=store();
  const reference={source:'USDA FoodData Central',status:'source-matched',recordId:173904,url:'https://fdc.nal.usda.gov/food-details/173904/nutrients',version:'usda-sr-legacy-2018-04-fp-v1',state:'dry',basisAmount:100,basisUnit:'g',ediblePortion:true,notAllowed:'ignored'};
  await ctx.saveDailyLog({},'owner','2026-10-15',{entries:[{...entry,reference},entry]});
  const loaded=await ctx.loadDailyLog({},'owner','2026-10-15');
  assert.equal(loaded.entries[0].reference.recordId,173904);assert.equal(loaded.entries[0].reference.notAllowed,undefined);
  assert.equal(loaded.entries[1].reference,null);assert.equal(loaded.entries[1].calories,200);
  reference.version='changed-after-save';assert.equal(loaded.entries[0].reference.version,'usda-sr-legacy-2018-04-fp-v1');
  const copied=await ctx.copyPreviousDay({},'owner','2026-10-16',()=>`copied-${writes.length}`);
  assert.equal(copied.log.entries[0].reference.recordId,173904);assert.equal(copied.log.entries[1].reference,null);
});

test('monthly calendar reads only the signed-in user month and recomputes calories from entries',async()=>{
  const {ctx}=store();let request;
  ctx.collection=(db,...parts)=>parts.join('/');
  ctx.documentId=()=> '__name__';
  ctx.orderBy=(field)=>({orderBy:field});
  ctx.startAt=(value)=>({startAt:value});
  ctx.endAt=(value)=>({endAt:value});
  ctx.query=(reference,...constraints)=>({reference,constraints});
  ctx.getDocs=async value=>{request=value;return {docs:[{id:'2026-10-20',data:()=>({entries:[entry],totals:{calories:9999}})}]};};
  const logs=await ctx.loadNutritionMonth({},'owner','2026-10');
  assert.equal(request.reference,'users/owner/dailyNutritionLogs');
  assert.equal(request.constraints[0].orderBy,'__name__');
  assert.equal(request.constraints[1].startAt,'2026-10-01');
  assert.equal(request.constraints[2].endAt,'2026-10-31');
  assert.equal(logs[0].dateKey,'2026-10-20');
  assert.equal(logs[0].totals.calories,200);
  await assert.rejects(ctx.loadNutritionMonth({},'bad/owner','2026-10'),/INVALID_USER/);
  await assert.rejects(ctx.loadNutritionMonth({},'owner','2026-13'),/INVALID_MONTH/);
});
