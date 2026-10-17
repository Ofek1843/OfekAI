import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { mountPlanSidebar, planNavigation } from '../public/js/plan-sidebar.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

test('saved-workout navigation matches Dashboard destinations and translations', async () => {
  for (const language of ['en', 'he', 'ar']) {
    const dashboard = await require('./helpers/current-product.cjs').dashboard(language);
    const expected = [...dashboard.document.querySelectorAll('.sidebar a')].map(a => [a.getAttribute('href'), a.textContent]);
    const { document, window } = parseHTML('<html><body><main class="plans-page"></main></body></html>');
    const previous = { document: globalThis.document, window: globalThis.window };
    globalThis.document = document;
    globalThis.window = window;
    window.matchMedia = () => ({ matches: false, addEventListener() {} });
    try {
      mountPlanSidebar(language);
      mountPlanSidebar(language);
      const links = [...document.querySelectorAll('.plan-navigation-link')];
      assert.deepEqual(links.map(a => [a.getAttribute('href'), a.textContent]), expected);
      assert.equal(document.querySelectorAll('.plan-navigation').length, 1);
      assert.equal(document.querySelector('[aria-current="page"]').getAttribute('href'), '/my-workout-plans.html');
      assert.equal(document.querySelector('#planSidebar').hidden, false);
      assert.equal(document.querySelector('.plan-navigation').dir, language === 'en' ? 'ltr' : 'rtl');
      assert.notEqual(document.querySelector('.plan-navigation-toggle').getAttribute('aria-label'), 'undefined');
    } finally { globalThis.document = previous.document; globalThis.window = previous.window; }
  }
});

test('mobile drawer starts closed, toggles, and closes with Escape or a desktop resize', () => {
  const { document, window } = parseHTML('<html><body></body></html>');
  const previous = { document: globalThis.document, window: globalThis.window };
  globalThis.document = document; globalThis.window = window;
  let resized;
  const media = { matches: true, addEventListener(_, fn) { resized = fn; } };
  window.matchMedia = () => media;
  try {
    mountPlanSidebar();
    const toggle = document.querySelector('.plan-navigation-toggle');
    const sidebar = document.querySelector('#planSidebar');
    assert.equal(sidebar.hidden, true);
    toggle.click();
    assert.equal(sidebar.hidden, false);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    const escape = new window.Event('keydown'); escape.key = 'Escape';
    document.dispatchEvent(escape);
    assert.equal(sidebar.hidden, true);
    toggle.click(); media.matches = false; resized();
    assert.equal(sidebar.hidden, false);
    assert.equal(document.querySelector('.plan-navigation-backdrop').hidden, true);
    assert.equal(document.body.classList.contains('plan-navigation-open'), false);
  } finally { globalThis.document = previous.document; globalThis.window = previous.window; }
});

test('sidebar assets exist and are cached; the new layout is scoped to saved workouts', () => {
  const read = path => fs.readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8');
  for (const [, , icon] of planNavigation) assert.ok(fs.existsSync(new URL(`../public/icons/tabler/${icon}.svg`, import.meta.url)));
  assert.match(read('sw.js'), /\/js\/plan-sidebar\.mjs/);
  assert.match(read('sw.js'), /\/css\/plan-sidebar\.css/);
  assert.match(read('my-workout-plans.html'), /plan-sidebar\.css/);
  assert.match(read('js/redesign-shell.js'), /route === "my-workout-plans.html"[\s\S]*?mountPlanSidebar/);
  assert.match(read('css/plan-sidebar.css'), /body\.has-plan-sidebar \.plans-page/);
});
