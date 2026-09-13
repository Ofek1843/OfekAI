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

test("daily history keeps a compact recent-day rail and an expandable calendar", () => {
  for (const id of ["nearbyDays", "calendarPanel", "calendarGrid", "calendarMonthLabel", "calendarPreviousMonth", "calendarNextMonth"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(client, /function renderDayHistory\(/);
  assert.match(client, /Array\.from\(\{ length: 5 \}/);
  assert.match(client, /Array\.from\(\{ length: leadingCells \+ lastDay \}/);
  assert.match(css, /\.calendar-weekdays,\s*\.calendar-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(7/);
});

test("day history opens the selected date and only shows known calories", () => {
  assert.match(client, /caloriesForDate\(/);
  assert.match(client, /data-history-date/);
  assert.match(client, /data-calendar-date/);
  assert.match(client, /loadDate\(button\.dataset\.historyDate\)/);
  assert.match(client, /loadDate\(button\.dataset\.calendarDate\)/);
  assert.match(css, /\.nearby-day\.is-selected/);
});

test("finish day marks completion without locking later food edits", () => {
  assert.match(client, /state\.log\.completed = true/);
  assert.match(client, /state\.log\.completedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(client, /finish\.disabled = state\.log\.completed/);
  assert.doesNotMatch(client, /foodInput[^\n]*disabled\s*=\s*state\.log\.completed/);
  assert.doesNotMatch(client, /foodEntries[^\n]*disabled\s*=\s*state\.log\.completed/);
});
