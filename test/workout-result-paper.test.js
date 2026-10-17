const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('workout result loads a route-scoped paper theme after legacy styles', () => {
  const html = read('public/workout-builder.html');
  const paper = read('public/css/workout-result-paper.css');
  assert.match(html, /\/css\/workout-result-paper\.css\?v=20261017-1/);
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
