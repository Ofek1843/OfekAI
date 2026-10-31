import test from 'node:test';
import assert from 'node:assert/strict';
import { readNutritionDraft, preferNutritionDraft, loadVisibleNutritionLog, withDeadline } from '../public/js/daily-nutrition-recovery.mjs';
import { parseFoodText } from '../public/js/daily-nutrition-domain.mjs';

const key = '2026-10-13';
const draft = { token: 'draft-1', savedAt: 2000, log: { dateKey: key, entries: [{ calories: 4021, proteinGrams: 173.7, carbsGrams: 100, fatGrams: 30 }] } };
const storage = { getItem: name => name === `fp-daily-log-draft-v2:owner:${key}` ? JSON.stringify(draft) : null };

test('package and filled sandwich inputs cannot silently become one rice cake or just schnitzel', () => {
  for (const text of ['חבילת פריכיות', 'אכלתי בחוץ באגט עם שניצל', 'half a baguette with chicken', '2 packs of rice cakes']) {
    const result = parseFoodText(text);
    assert.equal(result.entries.length, 0, text);
    assert.equal(result.errors[0]?.segment, text);
    assert.equal(result.errors[0]?.reason, 'whole-portion');
  }
  assert.equal(parseFoodText('2 rice cakes').entries[0].calories, 70);
});

test('dashboard shows the same 4021 calories as the newer local diary, marked pending', async () => {
  const log = await loadVisibleNutritionLog(async () => ({ entries: [], updatedAt: { seconds: 1 } }), 'owner', key, storage);
  assert.equal(log.totals.calories, 4021);
  assert.equal(log.pendingSync, true);
});

test('drafts are scoped to user and date; fresher cloud data wins', () => {
  assert.equal(readNutritionDraft('other', key, storage), null);
  assert.equal(readNutritionDraft('owner', '2026-10-12', storage), null);
  const remote = { entries: [], updatedAt: { seconds: 3 } };
  assert.equal(preferNutritionDraft(remote, draft), remote);
});

test('failed cloud read recovers local entries but does not invent a zero log without a draft', async () => {
  const failure = async () => { throw new Error('permission-denied'); };
  assert.equal((await loadVisibleNutritionLog(failure, 'owner', key, storage)).totals.calories, 4021);
  await assert.rejects(loadVisibleNutritionLog(failure, 'other', key, storage), /permission-denied/);
});

test('unresponsive operations time out and successful operations retain results', async () => {
  await assert.rejects(withDeadline(new Promise(() => {}), 5), /TIMEOUT/);
  assert.equal(await withDeadline(Promise.resolve(42), 100), 42);
});
import { loadPreviousNutritionLog } from '../public/js/daily-nutrition-recovery.mjs';
test('copy source falls back to authenticated server when browser read fails or stalls',async()=>{
 const source={dateKey:key,entries:[{name:'eggs',calories:200}],updatedAt:3000};
 for (const loadClient of [()=>Promise.reject(new Error('offline')),()=>new Promise(()=>{})]) {
  let serverReads=0;const result=await loadPreviousNutritionLog({uid:'owner',dateKey:key,loadClient,loadServer:async()=>{serverReads++;return source},storage:{getItem:()=>null},clientTimeout:5});
  assert.deepEqual(result,source);assert.equal(serverReads,1);
 }
});
test('copy source uses only the matching newer unsynced draft, and does not mutate it',async()=>{
 const remote={dateKey:key,entries:[{calories:100}],updatedAt:1000};const original=structuredClone(draft);
 const result=await loadPreviousNutritionLog({uid:'owner',dateKey:key,loadClient:async()=>remote,loadServer:async()=>{throw Error('unused')},storage});
 assert.equal(result.entries[0].calories,4021);assert.equal(result.pendingSync,true);assert.deepEqual(draft,original);
 const other=await loadPreviousNutritionLog({uid:'other',dateKey:key,loadClient:async()=>remote,loadServer:async()=>{throw Error('unused')},storage});assert.equal(other.entries[0].calories,100);
});
test('copy source reports failure instead of claiming yesterday is empty when all reads fail',async()=>{
 await assert.rejects(loadPreviousNutritionLog({uid:'owner',dateKey:key,loadClient:async()=>{throw Error('client')},loadServer:async()=>{throw Error('server')},storage:{getItem:()=>null}}),/server/);
 const result=await loadPreviousNutritionLog({uid:'owner',dateKey:key,loadClient:async()=>{throw Error('client')},loadServer:async()=>{throw Error('server')},storage});assert.equal(result.entries[0].calories,4021);
});
