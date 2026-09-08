"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const domainPromise = import(pathToFileURL(path.join(ROOT, "public", "js", "daily-nutrition-domain.mjs")));

function estimateFallback(ambiguity) {
  return ambiguity.choices.find((choice) => choice.isEstimateFallback);
}

async function resolveChoice(choice, ambiguity) {
  const { resolveFoodChoice } = await domainPromise;
  return resolveFoodChoice(choice.foodId, {
    amount: choice.amount ?? ambiguity.amount,
    unit: choice.unit || ambiguity.unit,
    estimate: choice.estimate || null,
    rawText: ambiguity.segment,
    customFoods: []
  });
}

test("exact grams bypass every clarification", async () => {
  const { parseFoodText } = await domainPromise;
  for (const input of ["50 גרם שיבולת שועל", "50g oats", "95 גרם בטטה"]) {
    const result = parseFoodText(input);
    assert.equal(result.status, "ready", input);
    assert.equal(result.ambiguities.length, 0, input);
    assert.equal(result.entries[0].estimated, false, input);
  }
  const he = parseFoodText("50 גרם שיבולת שועל").entries[0];
  const en = parseFoodText("50g oats").entries[0];
  assert.equal(he.calories, en.calories);
  assert.equal(he.amount, 50);
});

test("a whole vegetable with no size asks one compact size question with an estimate path", async () => {
  const { parseFoodText } = await domainPromise;
  const result = parseFoodText("מלפפון");
  assert.equal(result.status, "needs-clarification");
  assert.equal(result.ambiguities[0].kind, "size");
  assert.deepEqual(
    result.ambiguities[0].choices.filter((c) => !c.isEstimateFallback).map((c) => c.choiceId),
    ["small", "medium", "large"]
  );
  const unknown = estimateFallback(result.ambiguities[0]);
  assert.ok(unknown, "size clarification always offers I-don't-know");
  const entry = await resolveChoice(unknown, result.ambiguities[0]);
  assert.equal(entry.foodId, "cucumber");
  assert.equal(entry.estimated, true);
  assert.ok(entry.amount > 0 && entry.calories > 0);
});

test("an explicit size word resolves a portion food directly", async () => {
  const { parseFoodText } = await domainPromise;
  const entry = parseFoodText("בטטה בינונית").entries[0];
  assert.equal(entry.amount, 180);
  assert.equal(entry.portionSize, "medium");
  assert.equal(entry.approximate, true);
  const two = parseFoodText("2 בטטות בינוניות").entries[0];
  assert.equal(two.amount, 360);
  assert.equal(two.portionCount, 2);
});

test("protein bar asks for a brand and never dead-ends", async () => {
  const { parseFoodText } = await domainPromise;
  const result = parseFoodText("חטיף חלבון");
  assert.equal(result.status, "needs-clarification");
  assert.equal(result.ambiguities[0].kind, "brand");
  assert.equal(result.ambiguities[0].allowBrandInput, true);
  const unknown = estimateFallback(result.ambiguities[0]);
  assert.ok(unknown);
  const entry = await resolveChoice(unknown, result.ambiguities[0]);
  assert.equal(entry.foodId, "protein-bar");
  assert.equal(entry.estimated, true);
  assert.equal(entry.estimateConfidence, "low");
  assert.ok(entry.calories > 0 && entry.proteinGrams > 0);
});

test("estimated entries carry transparent metadata", async () => {
  const { parseFoodText } = await domainPromise;
  const result = parseFoodText("אבוקדו");
  const entry = await resolveChoice(estimateFallback(result.ambiguities[0]), result.ambiguities[0]);
  assert.equal(entry.estimated, true);
  assert.equal(entry.approximate, true);
  assert.ok(["high", "medium", "low"].includes(entry.estimateConfidence));
  assert.ok(typeof entry.estimateReason === "string" && entry.estimateReason.length > 0);
});

test("multi-food input adds resolved foods and clarifies only the ambiguous one", async () => {
  const { parseFoodText } = await domainPromise;
  const result = parseFoodText("50 גרם שיבולת שועל, בננה בינונית וחטיף חלבון");
  assert.equal(result.entries.length, 2);
  assert.deepEqual(result.entries.map((entry) => entry.foodId).sort(), ["banana", "oats"]);
  assert.equal(result.ambiguities.length, 1);
  assert.equal(result.ambiguities[0].kind, "brand");
});

test("the persistence layer keeps the estimate metadata", () => {
  // daily-nutrition-store.mjs pulls in the Firebase SDK over https, so assert
  // against its source: normalizeEntry must carry estimate fields through.
  const store = read("public/js/daily-nutrition-store.mjs");
  const normalizeBody = store.match(/function normalizeEntry\([\s\S]*?\n\}/)[0];
  for (const field of ["estimated:", "approximate:", "estimateConfidence:", "estimateReason:", "estimatedGrams:", "portionSize:", "compositeEstimate:"]) {
    assert.match(normalizeBody, new RegExp(field.replace(":", ":")), field);
  }
});

test("the composer no longer routes protein bars to manual label entry", () => {
  const client = read("public/js/daily-nutrition.js");
  assert.doesNotMatch(client, /Which protein bar\?/);
  assert.doesNotMatch(client, /closest\("details"\)\.open = true/);
  assert.match(client, /clarification-choice--estimate/);
  assert.match(client, /data-brand-form/);
});
