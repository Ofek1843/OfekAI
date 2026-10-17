import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDashboardSections,dashboardErrorCode} from '../public/js/dashboard-load.mjs';
import {parseHTML} from 'linkedom';
import {mountDashboard} from '../public/js/dashboard-editorial-view.mjs';
test('optional failure is named, does not discard healthy sections, and exposes only a code',async()=>{
  const result=await loadDashboardSections({settings:()=>{throw Object.assign(new Error('private body/token'),{code:'permission-denied'});},meals:()=>['menu'],diary:()=>({totals:{calories:377}})});
  assert.deepEqual(result.settings,{status:'rejected',code:'permission-denied'});
  assert.deepEqual(result.meals.value,['menu']);assert.equal(result.diary.value.totals.calories,377);
  assert.ok(!JSON.stringify(result).includes('private'));
});
test('a transient Firebase read is retried once and a recovered section is not marked failed',async()=>{
  let attempts=0;const result=await loadDashboardSections({logs:()=>{if(!attempts++)throw {code:'firestore/unavailable'};return ['log'];}});
  assert.equal(attempts,2);assert.equal(result.logs.status,'fulfilled');
});
test('permanent permission/index errors are not hammered or silently replaced with empty data',async()=>{
  for(const code of ['permission-denied','failed-precondition']){
    let calls=0;const result=await loadDashboardSections({logs:()=>{calls++;throw {code};}});
    assert.equal(calls,1);assert.deepEqual(result.logs,{status:'rejected',code});
  }
});
test('a stalled optional read is bounded without blocking healthy results indefinitely',async()=>{
  const result=await loadDashboardSections({logs:()=>new Promise(()=>{}),meals:()=>['saved']},{timeoutMs:8});
  assert.equal(result.logs.code,'DASHBOARD_TIMEOUT');assert.deepEqual(result.meals.value,['saved']);
});
test('a user-initiated fresh load can recover from an earlier failed section',async()=>{
  let available=false;const readers={logs:()=>{if(!available)throw {code:'permission-denied'};return ['recovered'];}};
  assert.equal((await loadDashboardSections(readers)).logs.status,'rejected');available=true;
  assert.equal((await loadDashboardSections(readers)).logs.status,'fulfilled');
  assert.equal(dashboardErrorCode({code:'firestore/unavailable'}),'unavailable');
});
test('the real dashboard identifies the failed section and Retry clears the banner after recovery',async()=>{
  const {document,window}=parseHTML('<html><body><div id="root"></div></body></html>');
  const previous=global.document;global.document=document;
  try{
    const root=document.querySelector('#root');let recover,attempts=0;
    const view=mountDashboard(root,{name:'Test',loadFailures:[{section:'settings',code:'unavailable'}]},
      {today:new Date('2026-10-16T09:00:00'),onRetry:async()=>{attempts++;await new Promise(resolve=>recover=resolve);view.update({name:'Test',loadFailures:[]});}});
    assert.match(root.querySelector('.status').textContent,/Could not load: Settings/);
    assert.ok(root.querySelector('.diary'),'healthy sections remain available');
    const retry=root.querySelector('[data-action="retry-dashboard"]');retry.dispatchEvent(new window.Event('click',{bubbles:true}));
    assert.equal(attempts,1);assert.equal(retry.disabled,true);recover();await new Promise(setImmediate);
    assert.equal(root.querySelector('.status').textContent,'');assert.equal(root.querySelector('[data-action="retry-dashboard"]'),null);
  }finally{global.document=previous;}
});
