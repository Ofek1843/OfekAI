"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const formatPromise = import(pathToFileURL(path.join(__dirname, "..", "public", "js", "daily-nutrition-format.mjs")));

test("nutrition formatter localizes metric and counted units", async () => {
  const { formatNutritionAmount } = await formatPromise;
  assert.equal(formatNutritionAmount(180, "g", "he"), "180 גרם");
  assert.equal(formatNutritionAmount(250, "kcal", "he"), "250 קק״ל");
  assert.equal(formatNutritionAmount(4, "item", "he"), "4 יחידות");
  assert.equal(formatNutritionAmount(2, "item", "en"), "2 items");
  assert.equal(formatNutritionAmount(2, "slice", "en"), "2 slices");
});

test("nutrition formatter exposes isolated number and unit parts", async () => {
  const { nutritionAmountParts } = await formatPromise;
  assert.deepEqual(nutritionAmountParts(1234.5, "g", "he"), { number: "1,234.5", unit: "גרם", locale: "he" });
});
