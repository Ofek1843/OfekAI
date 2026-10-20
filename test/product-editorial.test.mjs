import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = [
  'public/workout-builder.html', 'public/my-workout-plans.html',
  'public/nutrition-builder.html', 'public/my-nutrition-plans.html',
  'public/daily-nutrition.html', 'public/workout-tracker.html',
  'public/workout-history.html', 'public/manual-workout-builder.html',
  'public/manual-nutrition-builder.html', 'public/workout-plan-generator.html',
  'public/log-workout.html', 'public/progress.html', 'public/social.html'
];

test('product routes share the editorial product surface', () => {
  for (const relative of pages) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.match(source, /\/css\/product-editorial\.css\?v=[\w-]+/, relative);
  }
});

test('product editorial layer removes legacy deep ocean treatment', () => {
  const css = fs.readFileSync(path.join(root, 'public/css/product-editorial.css'), 'utf8');
  assert.match(css, /\.ocean-depth-layer\s*,\s*\.ocean-depth-glow\s*,\s*\.v45-noise/);
  assert.match(css, /display:\s*none\s*!important/);
  assert.match(css, /--product-paper/);
  assert.match(css, /\.wizard-button/);
  assert.match(css, /\.manual-page/);
  assert.match(css, /\.plans-page \.plan-card/);
});

test('service worker precaches the shared product editorial layer', () => {
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  assert.match(sw, /fuelphysique-guest-entry-20261020-2/);
  assert.match(sw, /\/css\/product-editorial\.css\?v=20261010-product-editorial-4/);
  assert.match(sw, /\/css\/product-paper-routes\.css\?v=20261017-nutrition-nav-1/);
  assert.match(sw, /\/css\/simple-ux\.css\?v=20261010-workout-paper-2/);
});

test('workout wizard does not reload the legacy ocean skin after editorial CSS', () => {
  const html = fs.readFileSync(path.join(root, 'public/workout-builder.html'), 'utf8');
  const shell = fs.readFileSync(path.join(root, 'public/js/redesign-shell.js'), 'utf8');
  const redesign = fs.readFileSync(path.join(root, 'public/css/redesign-v1.css'), 'utf8');
  const compact = fs.readFileSync(path.join(root, 'public/css/simple-ux.css'), 'utf8');
  assert.match(html, /\/css\/simple-ux\.css\?v=20261010-workout-paper-2/);
  assert.match(html, /\/js\/redesign-shell\.js\?v=20261010-workout-paper-1/);
  assert.match(shell, /!paperRoutes\.has\(route\) && !document\.querySelector\('link\[href\*="v45-deep-ocean\.css"\]'\)/);
  assert.match(shell, /if \(!paperRoutes\.has\(route\)\) document\.body\.classList\.add\("fp-v45-deep-ocean"\)/);
  assert.doesNotMatch(redesign.match(/body\.fp-redesign:is\([^\n]+\)/)?.[0] || '', /fp-route-workout-builder/);
  assert.match(compact, /body\.fp-route-workout-builder \.simple-builder \.visual-choice-card/);
  assert.match(compact, /\.fp-redesign\.fp-route-workout-builder \.builder-wizard \.wizard-button--next/);
});

test('nutrition, progress and social use the paper route layer without the ocean sheet', () => {
  const shell = fs.readFileSync(path.join(root, 'public/js/redesign-shell.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'public/css/product-paper-routes.css'), 'utf8');
  const oceanRoutes = [
    'nutrition-builder.html', 'my-nutrition-plans.html', 'progress.html',
    'social.html', 'my-workout-plans.html', 'workout-plan-generator.html'
  ];
  for (const route of oceanRoutes) assert.ok(shell.includes(`"${route}"`), route);
  for (const route of ['my-nutrition-plans.html', 'social.html']) {
    const html = fs.readFileSync(path.join(root, 'public', route), 'utf8');
    assert.doesNotMatch(html, /<link[^>]+v45-deep-ocean\.css/, route);
  }
  for (const selector of ['.fp-route-nutrition-builder', '.fp-route-progress', '.fp-route-social', '.fp-route-app']) {
    assert.ok(css.includes(selector), selector);
  }
  assert.match(css, /--fp-nav-surface: #f7f5f1/);
  assert.match(css, /\.settings-window \{/);
  assert.match(css, /body\.fp-route-app #settingsOverlay \{ position: fixed !important; inset: 0 !important; z-index: 9999 !important/);
});

test('FAQ, contact and legal pages use the dashboard paper palette', () => {
  const shell = fs.readFileSync(path.join(root, 'public/js/redesign-shell.js'), 'utf8');
  const paper = fs.readFileSync(path.join(root, 'public/css/product-paper-routes.css'), 'utf8');
  const legal = fs.readFileSync(path.join(root, 'public/css/legal.css'), 'utf8');
  for (const route of ['faq.html', 'contact.html', 'terms.html', 'privacy.html', 'refund-policy.html']) {
    assert.ok(shell.includes(`"${route}"`), route);
  }
  assert.match(paper, /body\.fp-paper-route\s*\{[\s\S]*?background:\s*#f7f5f1\s*!important/);
  assert.match(legal, /body\s*\{[\s\S]*?--text:\s*var\(--fp-text-primary\)/);
  assert.doesNotMatch(legal, /\.legal-section strong\s*\{\s*color:\s*#f1f5f9/);
});

test('nutrition goal photography keeps readable light captions over its dark shade', () => {
  const css = fs.readFileSync(path.join(root, 'public/css/product-paper-routes.css'), 'utf8');
  assert.match(css, /\.fp-route-nutrition-builder \.visual-choice-card \.visual-choice-shade \{ background: linear-gradient/);
  assert.match(css, /\.fp-route-nutrition-builder \.visual-choice-card \.visual-choice-content strong \{ color: #fff !important/);
  assert.match(css, /\.fp-route-nutrition-builder \.visual-choice-card \.visual-choice-content small \{ color: #eef1f3 !important/);
});

test('daily nutrition uses dark readable text on editorial white surfaces', () => {
  const css = fs.readFileSync(path.join(root, 'public/css/product-editorial.css'), 'utf8');
  assert.match(css, /body\.daily-nutrition-route \.macro-heading h2[\s\S]*?color: var\(--product-ink\) !important/);
  assert.match(css, /body\.daily-nutrition-route \.goal-stat-value[\s\S]*?color: var\(--product-ink\) !important/);
  assert.match(css, /body\.daily-nutrition-route \.day-history-card h2[\s\S]*?color: var\(--product-(?:muted|ink)\) !important/);
  assert.match(css, /body\.daily-nutrition-route \.nearby-day b[\s\S]*?color: var\(--product-ink\) !important/);
});
