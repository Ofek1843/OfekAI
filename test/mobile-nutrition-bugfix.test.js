"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const shellCss = read("public/css/redesign-v1.css");
const sceneCss = read("public/css/illustrated-v4.css");
const sceneSourceCss = read("public/css/scenes/image-sequence-v43.css");
const dailyClient = read("public/js/daily-nutrition.js");
const dailyHtml = read("public/daily-nutrition.html");
const nutritionCss = read("public/css/nutrition-builder.css");
const nutritionClient = read("public/js/nutrition-builder.js");

test("mobile product drawer is a full-height readable overlay", () => {
  assert.match(shellCss, /\.fp-global-menu\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(shellCss, /\.fp-global-menu-backdrop\s*\{[\s\S]*?z-index:\s*2201/);
  assert.match(shellCss, /\.fp-global-menu\s*\{[\s\S]*?z-index:\s*2202/);
  assert.match(shellCss, /@media \(max-width: 760px\)[\s\S]*?\.fp-global-menu\s*\{[\s\S]*?min-height:\s*100dvh/);
  assert.match(shellCss, /@media \(max-width: 760px\)[\s\S]*?\.fp-global-menu-link\s*\{[\s\S]*?min-height:\s*56px[\s\S]*?font-size:\s*1rem[\s\S]*?line-height:\s*1\.4/);
  assert.match(shellCss, /\.fp-global-menu-group \+ \.fp-global-menu-group\s*\{[\s\S]*?border-block-start/);
  assert.match(shellCss, /html\[dir="rtl"\] \.fp-global-menu\s*\{[\s\S]*?inset-inline-end:\s*0/);
});

test("mobile athlete scenes reserve a lower visual stage and cannot intercept taps", () => {
  for (const css of [sceneCss, sceneSourceCss]) {
    assert.match(css, /\.v43-image-sequence\s*\{[\s\S]*?pointer-events:\s*none/);
    assert.match(css, /\.journey-card > :where\(h3, p\),[\s\S]*?z-index:\s*4/);
    assert.match(css, /\.journey-card--progress[\s\S]*?height:\s*40% !important/);
  }
  assert.match(sceneCss, /\.journey-card--training[\s\S]*?height:\s*40% !important/);
  assert.match(sceneCss, /\.journey-card\s*\{[\s\S]*?overflow:\s*hidden/);
});

test("daily nutrition binds Add before auth settles and reports failures", () => {
  assert.match(dailyHtml, /<form id="foodComposerForm"/);
  assert.match(dailyHtml, /<button id="addFoodButton" type="submit"/);
  assert.match(dailyClient, /function bindFoodComposer\(\)/);
  assert.match(dailyClient, /guardProtectedPage\([\s\S]*?\);\s*bindFoodComposer\(\);/);
  assert.match(dailyClient, /form\.dataset\.bound\s*===\s*"true"/);
  assert.match(dailyClient, /if \(!state\.log\)\s*\{[\s\S]*?setComposerMessage\(copy\.loading, true\)/);
  assert.match(dailyClient, /Daily nutrition food entry failed/);
  assert.match(dailyClient, /function createEntryId\(\)/);
});

test("nutrition meal imagery is bounded, decoded asynchronously, and reroll remains exposed", () => {
  assert.match(nutritionCss, /\.meal-photo\s*\{[\s\S]*?width:\s*min\(100%, 520px\)[\s\S]*?height:\s*clamp\(190px, 28vw, 300px\)/);
  assert.match(nutritionCss, /@media\(max-width:700px\)[\s\S]*?\.meal-photo\s*\{[\s\S]*?width:\s*min\(100%, 460px\)[\s\S]*?height:\s*min\(230px, 58vw\)[\s\S]*?min-height:\s*170px/);
  assert.match(nutritionCss, /\.meal-photo img\s*\{[\s\S]*?object-fit:\s*contain[\s\S]*?image-rendering:\s*auto/);
  assert.match(nutritionCss, /@media \(max-width: 620px\)[\s\S]*?\.meal-title-row\s*\{[\s\S]*?flex-wrap:\s*wrap[\s\S]*?\.nutrition-reroll-meal-button\s*\{[\s\S]*?min-width:\s*92px/);
  assert.doesNotMatch(nutritionCss, /\.nutrition-reroll-meal-button > span:last-child\s*\{[^}]*clip/);
  assert.match(nutritionClient, /decoding="async"/);
  assert.match(nutritionClient, /nutrition-reroll-meal-button/);
  assert.match(nutritionClient, /api\/nutrition-builder\/reroll-meal/);
});
