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
    assert.match(source, /\/css\/product-editorial\.css\?v=20261010-product-editorial-(?:1|2)/, relative);
  }
});

test('product editorial layer removes legacy deep ocean treatment', () => {
  const css = fs.readFileSync(path.join(root, 'public/css/product-editorial.css'), 'utf8');
  assert.match(css, /\.ocean-depth-layer\s*,\s*\.ocean-depth-glow\s*,\s*\.v45-noise/);
  assert.match(css, /display:\s*none\s*!important/);
  assert.match(css, /--product-paper/);
  assert.match(css, /\.wizard-button/);
});

test('service worker precaches the shared product editorial layer', () => {
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  assert.match(sw, /fuelphysique-editorial-landing-20261010-4/);
  assert.match(sw, /\/css\/product-editorial\.css\?v=20261010-product-editorial-1/);
});
