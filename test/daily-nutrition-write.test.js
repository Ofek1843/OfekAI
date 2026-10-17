"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeDailyNutritionWrite } = require("../lib/daily-nutrition-write");

const entry = {
  id: "food-1", foodId: "oats", name: { en: "Oats", he: "שיבולת שועל" },
  amount: 105, unit: "g", calories: 408, proteinGrams: 18,
  carbsGrams: 69, fatGrams: 7, source: "catalog", rawText: "105g oats",
  estimated: false, approximate: false, compositeEstimate: false
};

test("authenticated diary write shape derives totals and ignores forged metadata", () => {
  const result = normalizeDailyNutritionWrite({
    entries: [{ ...entry, privateField: "not persisted" }], completed: false,
    totals: { calories: 999999 }, updatedAt: "forged", createdAt: "forged"
  });
  assert.deepEqual(result.totals, { calories: 408, proteinGrams: 18, carbsGrams: 69, fatGrams: 7 });
  assert.equal(result.entries[0].privateField, undefined);
  assert.equal(result.updatedAt, undefined);
  assert.equal(result.createdAt, undefined);
});

test("diary write rejects malformed, oversized and duplicate entries", () => {
  const bad = [
    { entries: [{ ...entry, calories: -1 }], completed: false },
    { entries: [{ ...entry, amount: Infinity }], completed: false },
    { entries: [entry, entry], completed: false },
    { entries: Array.from({ length: 81 }, (_, index) => ({ ...entry, id: String(index) })), completed: false },
    { entries: [entry], completed: "yes" }
  ];
  for (const value of bad) assert.throws(() => normalizeDailyNutritionWrite(value), /INVALID_DAILY_LOG/);
});

test("long food descriptions are bounded without blocking a valid save", () => {
  const result = normalizeDailyNutritionWrite({ entries: [{ ...entry, rawText: "o".repeat(300) }], completed: false });
  assert.equal(result.entries[0].rawText.length, 180);
});
