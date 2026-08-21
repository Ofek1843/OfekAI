"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("public/daily-nutrition.html");
const css = read("public/css/daily-nutrition.css");
const client = read("public/js/daily-nutrition.js");
const copy = read("public/js/daily-nutrition-i18n.mjs");
const formatter = read("public/js/daily-nutrition-format.mjs");
const store = read("public/js/daily-nutrition-store.mjs");
const shell = read("public/js/redesign-shell.js");
const dashboard = read("public/dashboard.html");
const server = read("server.js");

test("daily logging action precedes entries and weekly analytics", () => {
  const composer = html.indexOf('id="foodComposerForm"');
  const entries = html.indexOf('id="foodEntries"');
  const weekly = html.indexOf('id="weeklyChart"');
  assert.ok(composer > 0);
  assert.ok(composer < entries);
  assert.ok(entries < weekly);
});

test("daily nutrition uses semantic, accessible controls and live summaries", () => {
  assert.match(html, /<form id="foodComposerForm"/);
  assert.match(html, /<label class="sr-only" for="foodInput"/);
  assert.match(html, /<table class="food-table">/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /role="img" aria-label="Seven-day calorie intake trend"/);
});

test("client protects the route and keeps target history plan-first", () => {
  assert.match(client, /guardProtectedPage\(\{ onAuthenticated: init \}\)/);
  assert.match(client, /targetSnapshot\(\{ activePlan \}\)/);
  assert.match(client, /maintenanceCalories: Number\(settings\.nutritionTargets\.maintenanceCalories\)/);
  assert.doesNotMatch(client, /weight\s*\*\s*[0-9]/);
  assert.match(server, /maintenanceCalories,\s*\n\s*dailyCalories: targetCalories/);
});

test("every daily mutation reaches autosave and a failed save does not poison the queue", () => {
  assert.match(client, /state\.saveChain\s*=\s*state\.saveChain\s*\n\s*\.catch\(\(\) => undefined\)/);
  assert.match(client, /function addEntries[\s\S]*queueSave\(\)/);
  assert.match(client, /action === "delete"[\s\S]*queueSave\(\)/);
  assert.match(client, /action === "duplicate"[\s\S]*queueSave\(\)/);
  assert.match(client, /action === "save"[\s\S]*queueSave\(\)/);
  assert.match(client, /finishDayButton[\s\S]*queueSave\(\)/);
});

test("daily workflow exposes history, copy, recents, favorites, custom foods and combinations", () => {
  for (const control of [
    "previousDay",
    "nextDay",
    "selectedDate",
    "copyYesterdayButton",
    "recentFoods",
    "customFoodForm",
    "combinationForm",
    "finishDayButton"
  ]) assert.match(html, new RegExp(`id="${control}"`));
  assert.match(client, /filter\(\(food\) => food\.favorite\)/);
  assert.match(client, /copyPreviousDay/);
});

test("English and Hebrew copies cover logging, ambiguity and unlogged weekly days", () => {
  assert.match(copy, /What did you eat\?/);
  assert.match(copy, /מה אכלתם\?/);
  assert.match(copy, /Which one did you mean\?/);
  assert.match(copy, /למה התכוונתם\?/);
  assert.match(copy, /not logged/);
  assert.match(copy, /לא תועד/);
  assert.match(client, /document\.documentElement\.dir = language === "he" \? "rtl" : "ltr"/);
  assert.match(copy, /הוערך כ־\{amount\}/);
  assert.match(copy, /Variable meal estimate/);
  assert.match(copy, /המזונות שזוהו נוספו/);
});

test("Hebrew nutrition values use one localized formatter and bidi isolation", () => {
  assert.match(client, /daily-nutrition-format\.mjs/);
  assert.match(client, /nutritionAmountParts/);
  assert.match(client, /class="nutrition-amount" dir="ltr"/);
  assert.match(css, /\.nutrition-amount\s*\{[^}]*unicode-bidi:\s*isolate/);
  assert.match(css, /#foodInput\s*\{[^}]*unicode-bidi:\s*plaintext/);
  assert.match(formatter, /he:\s*Object\.freeze\(\{/);
  assert.match(formatter, /g:\s*"גרם"/);
  assert.match(formatter, /kcal:\s*"קק״ל"/);
  assert.doesNotMatch(client, /\$\{number\([^\n]+\}\s*g/);
});

test("natural portions, estimates, partial success and editable corrections are wired", () => {
  assert.match(client, /medium sweet potato/);
  assert.match(client, /2 משולשי פיצה/);
  assert.match(client, /copy\.estimatedComposite/);
  assert.match(client, /copy\.partialAdded/);
  assert.match(client, /result\.errors\.length && !result\.entries\.length/);
  assert.match(client, /estimated:\s*false, approximate:\s*false/);
  assert.match(client, /data-food-choice-index/);
  for (const field of ["estimated", "approximate", "estimateConfidence", "estimatedGrams", "portionCount", "portionSize", "portionKind", "compositeEstimate"]) {
    assert.match(store, new RegExp(`\\b${field}:`), field);
  }
  assert.match(client, /applyLanguage\(\);\s*guardProtectedPage/);
});

test("Daily Nutrition localizes structural accessibility labels in Hebrew", () => {
  for (const key of ["nutritionTools", "nutritionLogDate", "dailyOverview", "caloriesConsumed", "foodExamples", "chartReferenceLines"]) {
    assert.match(html, new RegExp(`data-copy-aria="${key}"`));
    assert.equal((copy.match(new RegExp(`\\b${key}:`, "g")) || []).length, 2);
  }
});

test("dashboard and global drawer expose one unambiguous Daily Nutrition route", () => {
  assert.match(dashboard, /id="studioDailyNutritionLink" href="\/daily-nutrition\.html"/);
  assert.match(dashboard, /id="dailyNutritionLink" class="secondary-action" href="\/daily-nutrition\.html"/);
  assert.match(shell, /"daily-nutrition\.html"/);
  assert.match(shell, /href: "\/daily-nutrition\.html"/);
});

test("mobile layout stacks food rows without horizontal table scrolling", () => {
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.food-table thead\s*\{\s*display:\s*none/);
  assert.match(css, /\.food-table tr\s*\{[\s\S]*display:\s*grid/);
  assert.match(css, /\.food-table\s*\{\s*min-width:\s*0\s*!important/);
  assert.match(css, /body\.daily-nutrition-route\s*\{[^}]*overflow-x:\s*hidden/);
  assert.match(css, /\.food-table-wrap\s*\{[^}]*overflow:\s*hidden/);
});
