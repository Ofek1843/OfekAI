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
    assert.match(source, /\/css\/product-editorial\.css\?v=20261010-product-editorial-(?:3|4)/, relative);
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
  assert.match(sw, /fuelphysique-workout-paper-20261010-8/);
  assert.match(sw, /\/css\/product-editorial\.css\?v=20261010-product-editorial-4/);
  assert.match(sw, /\/css\/simple-ux\.css\?v=20261010-workout-paper-2/);
});

test('workout wizard does not reload the legacy ocean skin after editorial CSS', () => {
  const html = fs.readFileSync(path.join(root, 'public/workout-builder.html'), 'utf8');
  const shell = fs.readFileSync(path.join(root, 'public/js/redesign-shell.js'), 'utf8');
  const redesign = fs.readFileSync(path.join(root, 'public/css/redesign-v1.css'), 'utf8');
  const compact = fs.readFileSync(path.join(root, 'public/css/simple-ux.css'), 'utf8');
  assert.match(html, /\/css\/simple-ux\.css\?v=20261010-workout-paper-2/);
  assert.match(html, /\/js\/redesign-shell\.js\?v=20261010-workout-paper-1/);
  assert.match(shell, /route !== "workout-builder\.html" && !document\.querySelector\('link\[href\*="v45-deep-ocean\.css"\]'\)/);
  assert.match(shell, /if \(route !== "workout-builder\.html"\) document\.body\.classList\.add\("fp-v45-deep-ocean"\)/);
  assert.doesNotMatch(redesign.match(/body\.fp-redesign:is\([^\n]+\)/)?.[0] || '', /fp-route-workout-builder/);
  assert.match(compact, /body\.fp-route-workout-builder \.simple-builder \.visual-choice-card/);
  assert.match(compact, /\.fp-redesign\.fp-route-workout-builder \.builder-wizard \.wizard-button--next/);
});
