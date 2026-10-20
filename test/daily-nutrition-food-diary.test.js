"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { randomUUID } = require("node:crypto");
const { parseHTML } = require("linkedom");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/daily-nutrition.html"), "utf8");
const client = fs.readFileSync(path.join(root, "public/js/daily-nutrition.js"), "utf8");

async function diaryHarness(language = "en") {
  const [domain, formatting, translations, visuals] = await Promise.all([
    import("../public/js/daily-nutrition-domain.mjs"),
    import("../public/js/daily-nutrition-format.mjs"),
    import("../public/js/daily-nutrition-i18n.mjs"),
    import("../public/js/daily-food-visuals.mjs")
  ]);
  const { document, window } = parseHTML(html);
  let focused = document.body;
  Object.defineProperty(document, "activeElement", { get: () => focused });
  window.HTMLElement.prototype.focus = function () { focused = this; };
  const values = new Map([["ofek-ai-language", language]]);
  const saved = [];
  const context = vm.createContext({
    ...domain, ...formatting, ...translations, ...visuals,
    document, window, console, db: {}, auth: {},
    crypto: { randomUUID }, structuredClone, setTimeout, clearTimeout,
    CSS: { escape: (value) => value },
    localStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key)
    },
    guardProtectedPage() {},
    saved
  });
  // Exercise the real renderer and delegated controller, without Firebase or
  // network writes. Existing persistence tests cover the save queue itself.
  const source = client.replace(/^import[\s\S]*?;\r?\n/gm, "");
  vm.runInContext(source + "\nqueueSave = () => { saved.push(structuredClone(state.log)); return Promise.resolve(true); };\n"
    + "globalThis.diary = { state, render, renderEntries, bindEvents };", context);
  const diary = context.diary;
  const dateKey = domain.localDateKey();
  diary.state.log = {
    dateKey, completed: false,
    targetSnapshot: domain.targetSnapshot({ calculatedTargets: { dailyCalories: 2950, proteinGrams: 150 } }),
    entries: [
      { ...domain.resolveFoodChoice("oats", { amount: 50, unit: "g" }), id: "oats-entry" },
      { ...domain.resolveFoodChoice("banana", { amount: 118, unit: "g" }), id: "banana-entry" }
    ]
  };
  diary.bindEvents();
  diary.render();
  function click(selector) {
    const button = document.querySelector(selector);
    assert.ok(button, selector);
    button.focus();
    button.dispatchEvent(new window.Event("click", { bubbles: true }));
  }
  return { diary, document, domain, saved, click };
}

test("diary rows expose image, name, portion and calories in native disclosures", async () => {
  const { document } = await diaryHarness();
  const rows = document.querySelectorAll("#foodEntries > details");
  assert.equal(rows.length, 2);
  assert.equal(document.querySelector("#foodEntries table"), null);
  const row = rows[0];
  const summary = row.querySelector("summary");
  assert.ok(summary.querySelector("img.food-thumbnail"));
  assert.ok(summary.querySelector(".food-entry-name").textContent);
  assert.match(summary.querySelector(".food-entry-portion").textContent, /50/);
  assert.match(summary.querySelector(".food-entry-calories").textContent, /kcal/);
  assert.ok(summary.querySelector(".food-entry-chevron"));
  assert.equal(row.hasAttribute("open"), false);
  for (const action of ["edit", "duplicate", "delete"]) {
    assert.ok(row.querySelector('.food-entry-details [data-entry-action="' + action + '"]'));
    assert.equal(summary.querySelector('[data-entry-action="' + action + '"]'), null);
  }
});

test("duplicating a food saves a separate entry and refreshes totals without collapsing its actions", async () => {
  const { diary, document, domain, saved, click } = await diaryHarness();
  const original = structuredClone(diary.state.log.entries[0]);
  document.querySelector('[data-entry-row="oats-entry"]').setAttribute("open", "");
  click('[data-entry-row="oats-entry"] [data-entry-action="duplicate"]');
  assert.equal(diary.state.log.entries.length, 3);
  assert.notEqual(diary.state.log.entries[1].id, original.id);
  assert.equal(diary.state.log.entries[1].calories, original.calories);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].entries.length, 3);
  assert.deepEqual(diary.state.log.totals, domain.totalsForEntries(diary.state.log.entries));
  assert.equal(document.querySelector("#entryCount").textContent, "3");
  assert.ok(document.querySelector('[data-entry-row="oats-entry"]').hasAttribute("open"));
  assert.equal(document.activeElement.dataset.entryAction, "duplicate");
});

test("removal affects only the selected food and moves focus to the next row", async () => {
  const { diary, document, domain, saved, click } = await diaryHarness();
  click('[data-entry-row="oats-entry"] [data-entry-action="delete"]');
  assert.deepEqual(Array.from(diary.state.log.entries, (entry) => entry.id), ["banana-entry"]);
  assert.equal(saved.length, 1);
  assert.equal(document.querySelector('[data-entry-row="oats-entry"]'), null);
  assert.equal(document.activeElement, document.querySelector('[data-entry-row="banana-entry"] summary'));
  assert.deepEqual(diary.state.log.totals, domain.totalsForEntries(diary.state.log.entries));
  click('[data-entry-action="delete"]');
  assert.equal(diary.state.log.entries.length, 0);
  assert.equal(document.querySelector("#emptyEntries").hidden, false);
  assert.equal(document.querySelector("#calorieConsumed").textContent, "0");
  assert.equal(document.activeElement.id, "diaryAddFoodButton");
});

test("editing the amount rescales nutrients, saves and returns focus to Edit", async () => {
  const { diary, document, saved, click } = await diaryHarness();
  const original = structuredClone(diary.state.log.entries[0]);
  click('[data-entry-row="oats-entry"] [data-entry-action="edit"]');
  const input = document.querySelector("[data-edit-amount]");
  assert.equal(document.activeElement, input);
  assert.ok(input.closest("label"));
  assert.ok(input.closest("details").hasAttribute("open"));
  input.value = "100";
  click('[data-entry-action="save"]');
  const edited = diary.state.log.entries[0];
  assert.equal(edited.amount, 100);
  assert.equal(edited.calories, original.calories * 2);
  assert.equal(edited.proteinGrams, original.proteinGrams * 2);
  assert.equal(saved.length, 1);
  assert.equal(document.activeElement.dataset.entryAction, "edit");
  assert.equal(diary.state.editingId, null);
});

test("cancel and Add food preserve the expected keyboard destination", async () => {
  const { diary, document, saved, click } = await diaryHarness();
  click('[data-entry-row="oats-entry"] [data-entry-action="edit"]');
  document.querySelector("[data-edit-amount]").value = "200";
  click('[data-entry-action="cancel"]');
  assert.equal(diary.state.log.entries[0].amount, 50);
  assert.equal(saved.length, 0);
  assert.equal(document.activeElement.dataset.entryAction, "edit");
  click("#diaryAddFoodButton");
  assert.equal(document.activeElement.id, "foodInput");
});

test("food names and original input remain escaped, including in an expanded RTL row", async () => {
  const { diary, document } = await diaryHarness("he");
  diary.state.log.entries[0].name.he = '<img src=x onerror="alert(1)">';
  diary.state.log.entries[0].rawText = "<script>alert(1)</script>";
  document.querySelector('[data-entry-row="oats-entry"]').setAttribute("open", "");
  diary.renderEntries();
  const row = document.querySelector('[data-entry-row="oats-entry"]');
  assert.equal(document.documentElement.dir, "rtl");
  assert.equal(row.querySelector(".food-entry-name img"), null);
  assert.match(row.querySelector(".food-entry-name").textContent, /<img/);
  assert.equal(row.querySelector("script"), null);
  assert.equal(row.querySelector(".food-entry-note").textContent, "<script>alert(1)</script>");
  assert.match(row.querySelector(".food-entry-portion").textContent, /גרם/);
  assert.ok(row.hasAttribute("open"));
});
