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

test("weekly panel reports all requested averages and explicit denominators", () => {
  for (const id of [
    "weeklyCalories",
    "weeklyProtein",
    "weeklyCarbs",
    "weeklyFat",
    "weeklyMaintenance",
    "weeklyBalance",
    "weeklyLogged",
    "weeklyCompleted",
    "weeklyDenominator"
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(client, /summary\.loggedDays/);
  assert.match(client, /summary\.completedDays/);
  assert.match(client, /copy\.notLogged/);
});

test("trend includes goal and maintenance references with text evidence", () => {
  assert.match(html, /data-copy="goalReference"/);
  assert.match(html, /data-copy="maintenanceReference"/);
  assert.match(client, /trend-reference--goal/);
  assert.match(client, /trend-reference--maintenance/);
  assert.match(client, /weeklyTextAlternative/);
  assert.match(css, /\.trend-reference--maintenance/);
});

test("finish day marks completion without locking later food edits", () => {
  assert.match(client, /state\.log\.completed = true/);
  assert.match(client, /state\.log\.completedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(client, /finish\.disabled = state\.log\.completed/);
  assert.doesNotMatch(client, /foodInput[^\n]*disabled\s*=\s*state\.log\.completed/);
  assert.doesNotMatch(client, /foodEntries[^\n]*disabled\s*=\s*state\.log\.completed/);
});
