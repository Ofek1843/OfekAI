const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('exercise columns respond to their available group width, not the viewport', () => {
  const css = read('public/css/workout-result-paper.css');
  assert.match(css, /#program-result \.muscle-exercise-group-grid\s*\{[^}]*container-type:\s*inline-size/);
  assert.match(css, /#program-result \.exercise-card\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /@container workout-exercises \(min-width: 640px\)[\s\S]*grid-template-columns:\s*minmax\(0, 0\.9fr\) minmax\(0, 1fr\)/);
  assert.match(css, /#program-result \.exercise-card-image\s*\{[^}]*position:\s*absolute;[^}]*object-fit:\s*contain/);
  assert.match(css, /#program-result \.exercise-card-media\s*\{[^}]*aspect-ratio:\s*16 \/ 11/);
  assert.match(css, /#program-result \.exercise-card-body\s*\{[^}]*overflow-wrap:\s*anywhere/);
});

test('workout result loads a route-scoped paper theme after legacy styles', () => {
  const html = read('public/workout-builder.html');
  const paper = read('public/css/workout-result-paper.css');
  assert.match(html, /\/css\/workout-result-paper\.css\?v=20261024-card-width-1/);
  assert.ok(html.indexOf('/css/workout-result-paper.css') > html.indexOf('/css/product-editorial.css'));
  assert.match(paper, /#program-result \.program-card[\s\S]*?background: var\(--program-paper\) !important/);
  assert.match(paper, /#program-result \.exercise-card-body \{ background: #fff !important; \}/);
  assert.match(paper, /#program-result \.exercise-card-media \{ background: #020617 !important; \}/);
});

test('feedback dialog keeps title and send action legible on dark panel', () => {
  const script = read('public/js/site-feedback.js');
  assert.match(script, /\.site-feedback-panel h2 \{[\s\S]*?color: #ffffff !important/);
  assert.match(script, /\.site-feedback-panel \.site-feedback-send \{[\s\S]*?background: #0866bd !important;[\s\S]*?color: #ffffff !important/);
});
