import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadDashboardDay } from '../public/js/dashboard-diary.mjs';

const require = createRequire(import.meta.url);
const { createHarness, nutritionProfile } = require('../audit/scientific-safety-20261015/harness.cjs');
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const noDraft = { getItem: () => null };

test('a missing food-log document is an empty day, even if browser Firestore stalls', async () => {
  let serverCalls = 0;
  const log = await loadDashboardDay({
    uid: 'owner', dateKey: '2026-10-17', storage: noDraft,
    loadClient: () => Promise.reject(new Error('client unavailable')),
    loadServer: () => { serverCalls++; return { dateKey: '2026-10-17', entries: [] }; }
  });
  assert.equal(serverCalls, 1);
  assert.deepEqual(log.entries, []);
});

test('dashboard uses server entries when the browser channel fails, never an invented zero', async () => {
  const log = await loadDashboardDay({
    uid: 'owner', dateKey: '2026-10-17', storage: noDraft,
    loadClient: () => Promise.reject(new Error('client unavailable')),
    loadServer: () => ({ entries: [{ calories: 787, proteinGrams: 33 }] })
  });
  assert.equal(log.entries[0].calories, 787);
  await assert.rejects(loadDashboardDay({
    uid: 'owner', dateKey: '2026-10-17', storage: noDraft,
    loadClient: () => Promise.reject(new Error('client unavailable')),
    loadServer: () => Promise.reject(new Error('server unavailable'))
  }), /client unavailable/);
});

test('meal replacement cycles through distinct safe catalog meals instead of toggling A/B', async () => {
  for (const profile of [nutritionProfile, {
    ...nutritionProfile, gender: 'male', height: 180, weight: 80,
    goal: 'buildMuscle', mealFormatPreference: 'quick'
  }]) {
    const harness = createHarness();
    const generated = await harness.request('/api/nutrition-builder', profile);
    assert.equal(generated.status, 200);
    let plan = generated.body.plan;
    const seen = new Set([plan.meals[0].options[0].mealId]);
    for (let index = 0; index < 12; index++) {
      const result = await harness.request('/api/nutrition-builder/reroll-meal', {
        plan, mealNumber: 1, optionNumber: 1, language: 'en', screeningStatus: 'none'
      });
      assert.equal(result.status, 200, result.body.error);
      assert.ok(!seen.has(result.body.option.mealId), result.body.option.mealId);
      seen.add(result.body.option.mealId);
      plan = result.body.plan;
      assert.equal(plan.meals[0].rerollHistory.length, index + 1);
      assert.equal(plan.totalsSummary.withinTolerance, true);
    }
  }
});

test('saved dishes are large and uncropped; builder navigation and Share have contrast', () => {
  const modalCss = source('../public/css/saved-nutrition-improvements.css');
  const routeCss = source('../public/css/product-paper-routes.css');
  const simpleUx = source('../public/js/simple-ux.js');
  assert.match(modalCss, /height: clamp\(260px, 42vw, 460px\)/);
  assert.match(modalCss, /object-fit: contain/);
  assert.match(simpleUx, /if \(workoutForm \|\| document\.querySelector\('\.daily-nutrition-route'\)\)/);
  assert.match(routeCss, /\.builder-navigation a:first-child \{[\s\S]*?background: #0866bd !important/);
  assert.match(routeCss, /\.share-program-button \{[\s\S]*?color: #07559f !important/);
});
