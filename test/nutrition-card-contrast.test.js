// Regression tests for the nutrition result card on the Deep Ocean shell.
//
// The shell deliberately makes generic cards dark. The meal card used to keep
// an older light-card foreground palette, so the redesign cascade produced
// dark labels on a dark card. These tests protect the component-local dark
// contract and the high-specificity table rules that are needed because the
// global shell loads after this page stylesheet.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const CSS = fs.readFileSync(
  path.join(__dirname, "..", "public", "css", "nutrition-builder.css"),
  "utf8"
);

function directRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(CSS);
  return match?.[1] || "";
}

function luminance(hex) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  const linear = (channel) => channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test("meal cards define a readable Deep Ocean foreground palette", () => {
  const card = directRule(".meal-card");
  assert.match(card, /--card-text:\s*#f4f8ff/i);
  assert.match(card, /--card-text-secondary:\s*#c9d8ea/i);
  assert.match(card, /--card-text-muted:\s*#9fb6cf/i);
  assert.match(card, /--card-surface:\s*#112c48/i);
  assert.match(card, /background:\s*#0d243c/i);

  for (const foreground of ["#f4f8ff", "#c9d8ea", "#9fb6cf"]) {
    assert.ok(
      contrast(foreground, "#0d243c") >= 4.5,
      `${foreground} must be readable on the meal card background`
    );
  }
});

test("ingredients, amounts and macro values remain readable after the global shell cascade", () => {
  const tableCells = directRule("body.fp-redesign.fp-route-nutrition-builder .nutrition-food-table td");
  const foodText = directRule("body.fp-redesign.fp-route-nutrition-builder .food-cell span");
  const amount = directRule("body.fp-redesign.fp-route-nutrition-builder .food-amount");
  const header = directRule("body.fp-redesign.fp-route-nutrition-builder .nutrition-food-table th");

  assert.match(tableCells, /color:\s*var\(--card-text\)\s*!important/);
  assert.match(foodText, /color:\s*var\(--card-text\)\s*!important/);
  assert.match(amount, /color:\s*#dcebff\s*!important/i);
  assert.match(header, /color:\s*#eaf6ff\s*!important/i);
  assert.match(header, /background:\s*#1e547f\s*!important/i);
});

test("meal cards avoid composited scroll effects and retain an offscreen render boundary", () => {
  const card = directRule(".meal-card");
  assert.match(card, /contain:\s*layout paint style/);
  assert.match(card, /content-visibility:\s*auto/);
  assert.doesNotMatch(card, /backdrop-filter/);
  assert.doesNotMatch(directRule(".meal-card:hover"), /transform:/);
});
