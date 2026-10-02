const test = require('node:test');
const assert = require('node:assert/strict');

test('landing auth returns an existing session without subscribing', async () => {
  const { resolveLandingUser } = await import('../public/js/landing-navigation.mjs');
  const user = { uid: 'test-only' };
  assert.equal(await resolveLandingUser(async () => ({auth:{currentUser:user}})), user);
});
test('failed or stalled SDK loading falls back to login within the deadline', async () => {
  const { resolveLandingUser } = await import('../public/js/landing-navigation.mjs');
  assert.equal(await resolveLandingUser(async () => { throw Error('offline'); }, 20), null);
  assert.equal(await resolveLandingUser(() => new Promise(()=>{}), 20), null);
});
test('a stalled auth listener is unsubscribed on timeout', async () => {
  const { resolveLandingUser } = await import('../public/js/landing-navigation.mjs');
  let closed = 0;
  assert.equal(await resolveLandingUser(async () => ({auth:{},onAuthStateChanged:()=>()=>closed++}),20),null);
  assert.equal(closed,1);
});
test('late loading after timeout does not subscribe or change the result', async () => {
  const { resolveLandingUser } = await import('../public/js/landing-navigation.mjs');
  let subscribed = false;
  const result = await resolveLandingUser(() => new Promise(resolve=>setTimeout(()=>resolve({auth:{},onAuthStateChanged:()=>{subscribed=true;}}),30)),10);
  assert.equal(result,null);
  await new Promise(resolve=>setTimeout(resolve,40));
  assert.equal(subscribed,false);
});
test('synchronous signed-out auth callbacks clean up correctly', async () => {
  const { resolveLandingUser } = await import('../public/js/landing-navigation.mjs');
  let closed = 0;
  assert.equal(await resolveLandingUser(async () => ({auth:{},onAuthStateChanged:(_auth,callback)=>{callback(null);return ()=>closed++;}})),null);
  assert.equal(closed,1);
});
