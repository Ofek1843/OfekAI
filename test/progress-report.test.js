"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const reportPromise = import(pathToFileURL(path.join(ROOT, "public", "js", "progress-report.mjs")));

const FIXTURE = Object.freeze({
  generatedAt: "2026-09-08T10:00:00.000Z",
  schemaVersion: 1,
  account: { createdAt: "2026-06-01T00:00:00.000Z", activeNutritionPlanId: "plan-1", uid: "SHOULD-NOT-APPEAR" },
  socialProfile: { uid: "SHOULD-NOT-APPEAR" },
  collections: {
    weightEntries: [
      { id: "w1", weight: 82.4, date: "2026-06-05", createdAt: "2026-06-05" },
      { id: "w2", weight: 81.0, date: "2026-07-05" },
      { id: "w3", weight: 79.1, date: "2026-08-30" }
    ],
    bodyMeasurements: [
      { id: "m1", date: "2026-06-05", waist: 88, chest: 104, arm: 37, thigh: 62 },
      { id: "m2", date: "2026-08-30", waist: 84, chest: 105, arm: 37.5, thigh: 62.5 }
    ],
    workoutPlans: [{ id: "wp1", name: "PPL", active: true }],
    nutritionPlans: [{ id: "np1", name: "Cut", active: false }],
    workoutLogs: [
      { id: "SECRET-DOC-1", completedAt: "2026-08-01T18:00:00Z", exercises: [
        { name: "Bench Press", sets: [{ completed: true, weightKg: 70, reps: 8 }, { completed: true, weightKg: 72.5, reps: 6 }] },
        { name: "Leg Extension", sets: [{ completed: true, weightKg: 45, reps: 12 }] }
      ] },
      { id: "SECRET-DOC-2", completedAt: "2026-09-05T18:00:00Z", exercises: [
        { name: "Bench Press", sets: [{ completed: true, weightKg: 80, reps: 5 }] },
        { name: "Leg Extension", sets: [{ completed: true, weightKg: 55, reps: 10 }] }
      ] }
    ],
    dailyNutritionLogs: [
      { id: "2026-09-01", entries: [{}], totals: { calories: 2100, proteinGrams: 180, carbsGrams: 190, fatGrams: 60 }, maintenanceSnapshot: 2500, targetSnapshot: { proteinGrams: 170 } },
      { id: "2026-09-02", entries: [{}], totals: { calories: 2300, proteinGrams: 150, carbsGrams: 210, fatGrams: 70 }, maintenanceSnapshot: 2500, targetSnapshot: { proteinGrams: 170 } },
      { id: "2026-09-03", entries: [], totals: {} }
    ],
    progressPhotos: [{ id: "p1", imageUrl: "https://storage.example/secret-photo.jpg" }]
  }
});

test("the raw JSON export path is untouched", () => {
  const service = read("lib/account-service.js");
  assert.match(service, /async exportAccount\(uid\)/);
  assert.match(service, /schemaVersion: 1/);
  const settings = read("public/js/settings.js");
  assert.match(settings, /link\.download = filename;/);
  assert.match(settings, /accountApi\("\/export"\)/);
  // raw download still offered, as a clearly-labelled JSON option
  assert.match(read("public/app.html"), /id="exportAccountBtn"[^>]*>Download raw data \(JSON\)</);
  assert.doesNotMatch(settings, /createAccountRouter|router\.get\("\/report"/);
});

test("a human report is produced as self-contained HTML with no scripts or trackers", async () => {
  const { buildProgressReport } = await reportPromise;
  const { filename, html } = buildProgressReport(FIXTURE, { locale: "en" });
  assert.match(filename, /^fuelphysique-progress-report-2026-09-08\.html$/);
  assert.match(html, /^<!doctype html>/i);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /https?:\/\/(?!fuelphysique)/i, "no external resources");
  assert.match(html, /@media print/);
});

test("body weight shows first, latest and delta from real entries", async () => {
  const { buildProgressReport } = await reportPromise;
  const html = buildProgressReport(FIXTURE, { locale: "en" }).html;
  assert.match(html, /82\.4/);
  assert.match(html, /79\.1/);
  assert.match(html, /−3\.3/); // 79.1 - 82.4
});

test("strength progress compares first vs latest working set per exercise", async () => {
  const { buildProgressReport } = await reportPromise;
  const html = buildProgressReport(FIXTURE, { locale: "en" }).html;
  assert.match(html, /Bench Press/);
  assert.match(html, /Leg Extension/);
  assert.match(html, /\+7\.5/);  // bench 80 - 72.5
  assert.match(html, /\+10/);    // leg extension 55 - 45
});

test("nutrition averages exclude unlogged days and show the denominator", async () => {
  const { buildProgressReport } = await reportPromise;
  const html = buildProgressReport(FIXTURE, { locale: "en" }).html;
  assert.match(html, /Average over 2 logged days/);
  assert.match(html, /2,200 kcal/); // (2100 + 2300) / 2, not / 3
});

test("no internal identifiers, document ids, photo URLs or schema fields leak into the human report", async () => {
  const { buildProgressReport } = await reportPromise;
  for (const locale of ["en", "he"]) {
    const html = buildProgressReport(FIXTURE, { locale }).html;
    for (const secret of ["SHOULD-NOT-APPEAR", "SECRET-DOC-1", "SECRET-DOC-2", "secret-photo.jpg", "schemaVersion", "activeNutritionPlanId", "socialProfile"]) {
      assert.doesNotMatch(html, new RegExp(secret), `${secret} leaked (${locale})`);
    }
  }
});

test("empty data is reported gracefully, never as zero progress", async () => {
  const { buildProgressReport } = await reportPromise;
  const html = buildProgressReport({ generatedAt: "2026-09-08", collections: {} }, { locale: "en" }).html;
  assert.match(html, /Not enough weight measurements/);
  assert.match(html, /No completed working sets/);
  assert.match(html, /No workouts logged/);
  assert.match(html, /No daily nutrition/);
  assert.doesNotMatch(html, /−[0-9]+\.[0-9] kg since/);
  assert.doesNotMatch(html, /Completed [1-9]\d* recorded/);
});

test("locale controls direction and language", async () => {
  const { buildProgressReport } = await reportPromise;
  const en = buildProgressReport(FIXTURE, { locale: "en" }).html;
  const he = buildProgressReport(FIXTURE, { locale: "he" }).html;
  assert.match(en, /<html lang="en" dir="ltr">/);
  assert.match(he, /<html lang="he" dir="rtl">/);
  assert.match(he, /דוח התקדמות אישי/);
  assert.match(he, /ממוצע על פני 2 ימים מתועדים/);
});
