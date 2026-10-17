const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "public", "dashboard.html"), "utf8");
const JS = fs.readFileSync(path.join(ROOT, "public", "js", "dashboard.js"), "utf8");
const CSS = fs.readFileSync(path.join(ROOT, "public", "css", "dashboard.css"), "utf8");
const SHELL = fs.readFileSync(path.join(ROOT, "public", "js", "redesign-shell.js"), "utf8");
const SHELL_CSS = fs.readFileSync(path.join(ROOT, "public", "css", "redesign-v1.css"), "utf8");

function primaryActions() {
  const match = HTML.match(/<(?:nav|section)\b[^>]*class="[^"]*\bdashboard-primary-actions\b[^"]*"[\s\S]*?<\/(?:nav|section)>/);
  assert.ok(match, "dashboard must expose a primary capability surface");
  return match[0];
}

test("dashboard primary actions include the direct social chat destination", async () => {
  const {document}=await require('./helpers/current-product.cjs').dashboard();
  for(const url of ['/workout-builder.html','/nutrition-builder.html','/progress.html','/social.html','/app.html?settings=open']) {
    const a=document.querySelector('a[href="'+url+'"]');assert.ok(a,url);assert.ok(a.textContent.trim(),url);assert.equal(a.getAttribute('target'),null);
  }
  assert.equal(document.querySelector('.sidebar a[href="/social.html"]').textContent,'Messages');
});

test("dashboard social action is localized and remains a same-tab keyboard link", () => {
  assert.match(JS, /const socialQuickAction = navLabels\.social/);
  assert.match(JS, /fr: \{ dashboard: "Tableau de bord"[\s\S]*?social: "Amis et messages"/);
  assert.match(JS, /socialLink\.setAttribute\("aria-label", socialQuickAction\)/);
  assert.match(CSS, /\.dashboard-action:focus-visible\s*\{[\s\S]*?outline:/);
  assert.match(CSS, /\.dashboard-action:active\s*\{[\s\S]*?filter:\s*brightness\(\.96\)/);
});

test("dashboard quick actions use the requested responsive grid", () => {
  assert.match(CSS, /\.dashboard-primary-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(CSS, /@media\s*\(min-width:\s*520px\)\s*and\s*\(max-width:\s*1080px\)[\s\S]*?\.dashboard-primary-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(CSS, /@media\s*\(max-width:\s*520px\)[\s\S]*?\.dashboard-primary-actions\s*\{[\s\S]*?grid-template-columns:\s*1fr 1fr/);
  assert.match(CSS, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.dashboard-primary-actions\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(CSS, /\.dashboard-action\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?height:\s*100%/);
});

test("daily nutrition remains a visible dashboard action and shared drawers retain wheel routing", async () => {
  const {document}=await require('./helpers/current-product.cjs').dashboard();
  assert.ok(document.querySelector('.diary a[href="/daily-nutrition.html"]'));
  assert.ok(document.querySelector('.sidebar a[href="/daily-nutrition.html"]'));
  assert.match(SHELL,/nav\.addEventListener\("wheel"/);
  assert.match(SHELL_CSS,/overflow-y:\s*auto/);
});
