import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { commitSavedPlan } from '../public/js/saved-plan-replacement.mjs';

let env;
test.before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-fuelphysique-replacement',
    firestore: { rules: fs.readFileSync('firestore.rules','utf8') } });
});
test.after(async () => { await env?.cleanup(); });

for (const [kind, folder] of [['workout','workoutPlans'],['nutrition','nutritionPlans']]) {
  test(`real Firestore transaction persists and reopens an owner's ${kind} replacement; cross-user writes fail`, async () => {
    const user={uid:'replacement-owner'}, db=env.authenticatedContext(user.uid).firestore();
    const plan={recipientGender:'female',example:'old-'+kind}, nextPlan={...plan,example:'new-'+kind}, saved={id:'test-'+kind,plan};
    const ref=doc(db,'users',user.uid,folder,saved.id);
    await setDoc(ref,{name:'Preserved title',plan});
    const api={auth:{currentUser:user},db,doc,runTransaction,serverTimestamp};
    await commitSavedPlan({kind,saved,user,previousPlan:plan,nextPlan},api);
    const reopened=(await getDoc(ref)).data();
    assert.deepEqual(reopened.plan,nextPlan); assert.equal(reopened.name,'Preserved title'); assert.ok(reopened.updatedAt);
    await assert.rejects(commitSavedPlan({kind,saved,user,previousPlan:plan,nextPlan:{example:'stale'}},api),/PLAN_CHANGED/);
    const other=env.authenticatedContext('other-owner').firestore();
    await assertFails(setDoc(doc(other,'users',user.uid,folder,saved.id),{plan}));
    assert.deepEqual((await getDoc(ref)).data().plan,nextPlan);
  });
}
