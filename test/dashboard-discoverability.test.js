const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "public", "dashboard.html"), "utf8");
const JS = fs.readFileSync(path.join(ROOT, "public", "js", "dashboard.js"), "utf8");
const CSS = fs.readFileSync(path.join(ROOT, "public", "css", "dashboard.css"), "utf8");

function primaryActions() {
  const match = HTML.match(/<nav class="dashboard-primary-actions"[\s\S]*?<\/nav>/);
  assert.ok(match, "dashboard must expose a primary quick-action nav");
  return match[0];
}

test("dashboard primary actions include the direct social chat destination", () => {
  const actions = primaryActions();
  const links = [...actions.matchAll(/<a\b[^>]*>/g)].map(match => match[0]);

  assert.equal(links.length, 5);
  assert.match(actions, /id="chatLink"[^>]*href="\/app\.html"/);
  assert.match(actions, /id="heroWorkoutBuilderLink"[^>]*href="\/workout-builder\.html"/);
  assert.match(actions, /id="heroNutritionBuilderLink"[^>]*href="\/nutrition-builder\.html"/);
  assert.match(actions, /id="heroProgressLink"[^>]*href="\/progress\.html"/);
  assert.match(actions, /id="heroSocialLink"[^>]*href="\/social\.html"[^>]*aria-label="Chat with friends"/);
  assert.doesNotMatch(actions, /target\s*=|badge|unread|notification|count/i);
});

test("dashboard social action is localized and remains a same-tab keyboard link", () => {
  assert.match(JS, /socialQuickAction = he \? "צ׳אט עם חברים" : "Chat with friends"/);
  assert.match(JS, /socialLink\.setAttribute\("aria-label", socialQuickAction\)/);
  assert.match(CSS, /\.dashboard-action:focus-visible\s*\{[\s\S]*?outline:/);
  assert.match(CSS, /\.dashboard-action:active\s*\{[\s\S]*?filter:\s*brightness\(\.96\)/);
});

test("dashboard quick actions use the requested responsive grid", () => {
  assert.match(CSS, /\.dashboard-primary-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(CSS, /@media\s*\(min-width:\s*521px\)\s*and\s*\(max-width:\s*1080px\)[\s\S]*?\.dashboard-primary-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(CSS, /@media\s*\(max-width:\s*520px\)[\s\S]*?\.dashboard-primary-actions\s*\{[\s\S]*?grid-template-columns:\s*1fr 1fr/);
  assert.match(CSS, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.dashboard-primary-actions\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(CSS, /\.dashboard-action\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?height:\s*100%/);
});
