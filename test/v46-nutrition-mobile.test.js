"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = (name) => fs.readFileSync(require("node:path").join(__dirname, "..", name), "utf8");

function wizard(he = false) {
  const elements = new Map();
  const el = () => ({ value: "", dataset: {}, checked: false, disabled: false,
    classList: { toggle() {}, add() {}, remove() {} }, style: {},
    addEventListener(type, fn) { this[type] = fn; }, scrollIntoView() {} });
  const steps = ["goal", "about", "body", "activity", "diet", "restrictions"].map(key => ({
    ...el(), dataset: { wizardStep: key, stepTitleEn: key, stepTitleHe: "פרטים" }
  }));
  const get = (key) => { if (!elements.has(key)) elements.set(key, el()); return elements.get(key); };
  const html = read("public/nutrition-builder.html");
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, {
    localStorage: { getItem: () => he ? "he" : "en" },
    document: { querySelector: get, querySelectorAll: s => s === ".wizard-step" ? steps : [] }
  });
  for (const [key, value] of Object.entries({ goal: "buildMuscle", age: "25", gender: "male", height: "175", weight: "75", activityLevel: "moderate" })) get("#" + key).value = value;
  return { get, next: () => get("#wizardNextButton").click() };
}

test("final nutrition submit preserves step six and answers", () => {
  const { get, next } = wizard();
  for (let n = 0; n < 5; n++) next();
  get("#nutrition-builder-form").dataset.generatorReady = "true";
  let blocked = false;
  get("#nutrition-builder-form").submit({ preventDefault() { blocked = true; }, stopImmediatePropagation() {} });
  assert.equal(blocked, false);
  assert.equal(get("#wizardStepLabel").textContent, "Step 6 of 6");
  assert.equal(get("#goal").value, "buildMuscle");
});

test("delayed generation module cannot cause native form navigation or lost answers", () => {
  const { get, next } = wizard();
  for (let n = 0; n < 5; n++) next();
  let blocked = false;
  get("#nutrition-builder-form").submit({ preventDefault() { blocked = true; }, stopImmediatePropagation() {} });
  assert.equal(blocked, true);
  assert.match(get("#wizardError").textContent, /answers are kept/);
  assert.equal(get("#wizardStepLabel").textContent, "Step 6 of 6");
});

test("Hebrew wizard keeps localized steps and validation", () => {
  const { get, next } = wizard(true);
  get("#goal").value = "";
  next();
  assert.equal(get("#wizardError").textContent, "בחרו מטרה כדי להמשיך.");
  assert.equal(get("#wizardStepLabel").textContent, "שלב 1 מתוך 6");
  assert.equal(get("#wizardNextButton").textContent, "המשך");
});

test("missing plan responses are errors; duplicate submissions are ignored", () => {
  const js = read("public/js/nutrition-builder.js");
  assert.match(js, /if \(button.disabled\) return/);
  assert.match(js, /throw new Error\(isHebrew \? "לא התקבלה תוכנית/);
  assert.match(js, /form.dataset.generatorReady = "true"/);
  assert.equal((read("public/nutrition-builder.html").match(/id="wizardError"/g) || []).length, 1);
});

test("optional daily data failure still loads the mandatory saved day", async () => {
  const js = read("public/js/daily-nutrition.js");
  const init = js.slice(js.indexOf("async function init(user)"), js.lastIndexOf("applyLanguage();"));
  const state = {};
  let loaded = false, warning = "";
  await vm.runInNewContext(init + "\ninit({uid:'test'})", {
    state, db: {}, language: "en", bindEvents() {}, console,
    loadTargets: async () => { throw Error("unavailable"); },
    loadCustomFoods: async () => [], loadSavedCombinations: async () => [],
    loadDate: async () => { loaded = true; },
    setPageStatus: msg => { warning = msg; }, copy: {}
  });
  assert.ok(loaded);
  assert.match(warning, /Catalog food logging is available/);
});

test("queued daily save captures its day and immutable entries", async () => {
  const js = read("public/js/daily-nutrition.js");
  const fn = js.slice(js.indexOf("function queueSave()"), js.indexOf("function renderTargets"));
  const state = { user: {uid:"test"}, dateKey:"2026-09-07", log: {entries:[{calories:100}]}, saveChain:Promise.resolve() };
  let saved;
  const ctx = { state, structuredClone, updateWeekLog() {}, $: () => ({}), copy: {}, console,
    db: {}, saveDailyLog: async (...args) => { saved = args; } };
  vm.runInNewContext(fn + "\nqueueSave()", ctx);
  state.dateKey = "2026-09-08"; state.log.entries[0].calories = 200;
  await state.saveChain;
  assert.equal(saved[2], "2026-09-07");
  assert.equal(saved[3].entries[0].calories, 100);
});

test("Hebrew/English food input feeds matching real catalog totals", async () => {
  const { parseFoodText, totalsForEntries } = await import("../public/js/daily-nutrition-domain.mjs");
  const he = parseFoodText("50 גרם שיבולת שועל");
  const en = parseFoodText("50g oats");
  assert.ok(he.entries.length);
  assert.deepEqual(totalsForEntries(he.entries), totalsForEntries(en.entries));
  assert.ok(totalsForEntries(he.entries).calories > 0);
  const bar = parseFoodText("חטיף חלבון");
  assert.ok(bar.errors.length, "No invented protein-bar nutrition");
  assert.match(read("public/js/daily-nutrition.js"), /Which protein bar\?/);
  assert.match(read("public/js/daily-nutrition.js"), /closest\("details"\).open = true/);
});

test("mobile navigation and athlete composition use reserved layout", () => {
  assert.match(read("public/css/v45-deep-ocean.css"), /\.fp-global-links\s*\{\s*display: none;/);
  assert.match(read("public/css/illustrated-v4.css"), /grid-template-rows: auto 220px/);
  assert.match(read("public/css/illustrated-v4.css"), /position: relative !important;\s*inset: auto !important/);
});

test("Hebrew dashboard prompt keeps Athlete Core action readable", () => {
  const dashboard = read("public/js/dashboard.js");
  assert.match(dashboard, /השלימו את פרופיל Athlete Core/);
  assert.match(dashboard, /השלמת הפרופיל/);
  assert.doesNotMatch(dashboard, /action\) action\.textContent = "מילוי Athlete Core"/);
});
