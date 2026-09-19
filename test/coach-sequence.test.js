const { test } = require('node:test');
const assert = require('node:assert/strict');
const modulePromise = import('../public/js/coach-sequence.mjs');
const frames = Array.from({ length: 8 }, (_, i) => `/images/coach/frame-${i}.webp?v=1`);

test('coach curl uses eight poses and controlled lowering in a 3–4 second loop', async () => {
  const { CURL_TIMELINE: timeline, validateFrames } = await modulePromise;
  assert.equal(new Set(timeline.map(step => step.frame)).size, 8);
  const total = timeline.reduce((n, step) => n + step.duration, 0);
  assert.ok(total >= 3000 && total <= 4000);
  assert.ok(timeline.slice(8).reduce((n, step) => n + step.duration, 0) > 6 * 180);
  assert.equal(timeline[0].frame, timeline.at(-1).frame);
  assert.deepEqual(validateFrames(frames), frames);
  assert.throws(() => validateFrames(frames.slice(0, 2)));
  assert.throws(() => validateFrames(Array(8).fill(frames[0])));
  assert.throws(() => validateFrames(frames.map(url => url.split('?')[0])));
});

test('preload all frames, pause offscreen/background, reduced motion and cleanup', async () => {
  const { mountCoachSequence } = await modulePromise;
  let intersect;
  const events = {};
  const mediaEvents = {};
  const timers = new Map();
  let nextId = 0;
  let loaded = 0;
  const doc = { hidden: false, addEventListener: (k, f) => events[k] = f,
    removeEventListener: k => delete events[k] };
  const media = { matches: false, addEventListener: (k, f) => mediaEvents[k] = f,
    removeEventListener: k => delete mediaEvents[k] };
  const img = { src: '/static.webp', getAttribute: () => '/static.webp', ownerDocument: doc };
  const env = {
    matchMedia: () => media,
    setTimeout: f => { timers.set(++nextId, f); return nextId; },
    clearTimeout: id => timers.delete(id),
    IntersectionObserver: class { constructor(f) { intersect = f; } observe() {} disconnect() {} },
    Image: class { set src(value) { loaded++; queueMicrotask(() => this.onload()); } async decode() {} }
  };
  const dispose = mountCoachSequence(img, frames, env);
  assert.equal(loaded, 0);
  intersect([{ isIntersecting: true }]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(loaded, 8);
  assert.equal(timers.size, 1);
  intersect([{ isIntersecting: false }]);
  assert.equal(timers.size, 0);
  intersect([{ isIntersecting: true }]);
  assert.equal(loaded, 8);
  doc.hidden = true;
  events.visibilitychange();
  assert.equal(timers.size, 0);
  doc.hidden = false;
  events.visibilitychange();
  media.matches = true;
  mediaEvents.change();
  assert.equal(img.src, '/static.webp');
  assert.equal(timers.size, 0);
  dispose();
  assert.equal(Object.keys(events).length, 0);
});
