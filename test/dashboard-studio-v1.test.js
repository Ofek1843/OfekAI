const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { parseHTML } = require('linkedom');
const root = path.join(__dirname, '..', 'public');
const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'dashboard-editorial.css'), 'utf8');
const production = fs.readFileSync(path.join(root, 'js', 'dashboard-editorial.js'), 'utf8');
const viewSource = fs.readFileSync(path.join(root, 'js', 'dashboard-editorial-view.mjs'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const moduleUrl = pathToFileURL(path.join(root, 'js', 'dashboard-editorial-view.mjs')).href;

async function render(model = {}, language = 'en') {
  const { document } = parseHTML('<html><body><div id="dashboardRoot"></div></body></html>');
  global.document = document;
  const { mountDashboard } = await import(moduleUrl);
  const view = mountDashboard(document.querySelector('#dashboardRoot'), model, { language, today: new Date('2025-06-02T09:00:00') });
  return { document, view };
}

test('dashboard uses reference layout, blue wordmark and real account data', () => {
  assert.match(html, /dashboard-editorial\.css/);
  assert.match(html, /dashboard-editorial\.js/);
  assert.match(css, /\.overview\{display:grid/);
  assert.match(css, /\.wordmark span\{color:var\(--blue\)/);
  assert.match(css, /@media\(max-width:650px\)/);
  assert.match(production, /collection\(db,'users',user\.uid,'workoutPlans'\)/);
  assert.match(production, /collection\(db,'users',user\.uid,'nutritionPlans'\)/);
  assert.match(production, /loadVisibleDay\(user\.uid,dateKey\(new Date\(\)\)\)/);
  assert.match(viewSource, /const plansNav=event\.target\.closest\('\.top-links a\[href="#plans"\]'\)/);
  assert.match(viewSource, /section\.scrollIntoView\(\{behavior:'smooth',block:'start'\}\);section\.focus\(\{preventScroll:true\}\)/);
  assert.match(viewSource, /id="plans" tabindex="-1"/);
  assert.match(html, /serviceWorker\.register\('\/sw\.js'\)/);
  for (const image of ['training', 'workout-1', 'meal-1'])
    assert.ok(fs.existsSync(path.join(root, 'assets', 'dashboard', `${image}.webp`)));
});

test('empty accounts have create actions and no sample plans', async () => {
  const { document } = await render({ name: 'New', workouts: [], meals: [], logs: [] });
  const text = document.body.textContent;
  assert.match(text, /No workout plan yet/);
  assert.match(text, /No meal plan yet/);
  assert.equal(document.querySelectorAll('.plan-row').length, 0);
  assert.ok(document.querySelectorAll('a[href="/workout-builder.html"]').length >= 2);
  assert.ok(document.querySelectorAll('a[href="/nutrition-builder.html"]').length >= 1);
  assert.doesNotMatch(text, /Upper Body Strength|Balanced Performance/);
});

test('dashboard renders recovered local nutrition totals and pending sync status', async () => {
  const { document } = await render({ diary: {
    pendingSync: true, entries: [{ calories: 4021, proteinGrams: 173.7, carbsGrams: 220, fatGrams: 80 }]
  } });
  assert.equal(document.querySelector('.ring-label strong').textContent, '4,021');
  assert.match(document.querySelector('.diary').textContent, /cloud sync is pending/);
});

test('failed initial diary load shows an error instead of a misleading zero', async () => {
  const { document } = await render({ diaryFailed: true });
  assert.equal(document.querySelector('.diary .ring-label'), null);
  assert.ok(document.querySelector('.diary [role="status"]'));
});

test('saved workout and meal plans appear in separate columns', async () => {
  const model = { name: 'Ofek', activeWorkoutId: 'w1', activeMealId: 'm1',
    workouts: [{ id: 'w1', name: 'Strength', plan: { sessions: [{ name: 'Upper', exercises: [{ name: 'Press' }] }] } }],
    meals: [{ id: 'm1', name: 'Everyday food', plan: { dailyCalories: 2400 } }], logs: [] };
  const { document } = await render(model);
  assert.match(document.querySelector('.session h2').textContent, /Upper/);
  assert.match(document.querySelector('.plan-panel').textContent, /Strength/);
  assert.match(document.querySelector('.meal-panel').textContent, /Everyday food/);
  assert.equal(document.querySelectorAll('.plan-row').length, 2);
  assert.equal(document.querySelectorAll('.plan-panel .section-heading a.button').length, 2);
});

test('actual workout log schema powers next session and activity', async () => {
  const { nextSession } = await import(moduleUrl);
  const plan = { id: 'w1', plan: { sessions: [{ name: 'Upper' }, { name: 'Lower' }] } };
  const logs = [{ workoutPlanId: 'w1', sessionIndex: 0, completedAt: '2025-06-01',
    sessionName: 'Upper', durationSeconds: 2700, exercises: [{ name: 'Press' }] }];
  assert.equal(nextSession(plan, logs).session.name, 'Lower');
  const { document } = await render({ workouts: [plan], activeWorkoutId: 'w1', meals: [], logs });
  const row = document.querySelector('.activity-row').textContent;
  assert.match(row, /Upper/);
  assert.match(row, /1 exercises/);
  assert.match(row, /45 min/);
});

test('Hebrew localizes the dashboard and untrusted plan names are escaped', async () => {
  const { document } = await render({ workouts: [{ id: 'w1', name: '<script>alert(1)</script>', plan: { sessions: [] } }], meals: [], logs: [] }, 'he');
  assert.equal(document.documentElement.dir, 'rtl');
  assert.match(document.querySelector('.plan-panel').textContent, /תוכניות אימון/);
  assert.equal(document.querySelectorAll('.plan-row script').length, 0);
  assert.match(document.querySelector('.plan-row h3').textContent, /<script>/);
});
