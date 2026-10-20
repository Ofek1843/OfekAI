"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("signed-out visitors get a dashboard preview without private Firestore reads", () => {
  const controller = read("public/js/dashboard-editorial.js");
  const view = read("public/js/dashboard-editorial-view.mjs");
  assert.match(controller, /guardProtectedPage\(\{onSignedOut:showGuestDashboard/);
  assert.match(controller, /guest:true/);
  assert.match(controller, /trackEvent\('guest_started',\{source:'dashboard'\}\)/);
  assert.match(view, /guest-dashboard-banner/);
  assert.match(view, /'\/workout-builder\.html'/);
  assert.match(view, /'\/nutrition-builder\.html'/);
  assert.match(view, /guest-account-link/);
});

test("dashboard guest view renders plan creation and account actions", async () => {
  const { parseHTML } = require("linkedom");
  const { mountDashboard } = await import("../public/js/dashboard-editorial-view.mjs");
  const { document } = parseHTML('<html><body><div id="root"></div></body></html>');
  const root = document.querySelector("#root");
  const query = root.querySelector.bind(root);
  root.querySelector = (selector) => selector === ".ring canvas" ? null : query(selector);
  global.document = document;
  try {
    mountDashboard(root, { workouts: [], meals: [], logs: [] }, { language: "en", guest: true });
    assert.match(root.querySelector(".guest-dashboard-banner").textContent, /Explore before you sign up/);
    assert.equal(root.querySelector('.plan-panel a[href="/workout-builder.html"]')?.getAttribute("href"), "/workout-builder.html");
    assert.equal(root.querySelector('.meal-panel a[href="/nutrition-builder.html"]')?.getAttribute("href"), "/nutrition-builder.html");
    assert.equal(root.querySelector(".guest-account-link")?.getAttribute("href"), "/auth.html?mode=signup");
    assert.equal(root.querySelectorAll('.diary [data-action="day-back"]').length, 0);
  } finally {
    delete global.document;
  }
});

test("builder drafts resume once after sign-in and remain available if generation fails", () => {
  for (const name of ["workout", "nutrition"]) {
    const source = read(`public/js/${name}-builder.js`);
    assert.match(source, new RegExp(`readGuestDraft\\("${name}"\\)`));
    assert.match(source, /history\.replaceState\(null, "", cleanUrl\)/);
    assert.match(source, /setTimeout\(\(\) => form\.dispatchEvent\(new Event\("submit"/);
    assert.doesNotMatch(source, /while \([^\n]*wizardNextButton|while \([^\n]*next\.click/);
    assert.match(source, new RegExp(`if \\(resumedGuestDraft\\) \\{ clearGuestDraft\\("${name}"\\)`));
  }
});

test("date button opens an inline calendar with a whole month of saved calories", () => {
  const html = read("public/daily-nutrition.html");
  const client = read("public/js/daily-nutrition.js");
  const store = read("public/js/daily-nutrition-store.mjs");
  assert.match(html, /id="datePickerButton"[^>]*aria-controls="calendarPanel"/);
  assert.match(html, /id="calendarStatus"/);
  assert.match(client, /loadNutritionMonth\(db, state\.user\.uid, monthKey\)/);
  assert.match(client, /caloriesForDate\(dateKey, logs\)/);
  assert.match(store, /orderBy\(documentId\(\)\), startAt\(`\$\{monthKey\}-01`\), endAt\(`\$\{monthKey\}-31`\)/);
});
