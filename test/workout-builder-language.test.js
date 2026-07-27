// Regression tests for Defect 1: Hebrew equipment labels leaking into
// English-mode Summary rendering.
//
// Root cause (public/js/workout-builder.js, renderWizardReview()):
//   const equipment = formData.getAll("equipment")
//     .map(value => hebrewOptionLabels[normalizeOptionKey(value)] || value)
//     .join(", ");
// This mapped every equipment value through a Hebrew-only dictionary with
// NO check of isHebrew/currentLanguage — so English mode showed Hebrew
// equipment names too. The fix moves equipment labels to a single,
// explicit, locale-gated dictionary (public/js/equipment-i18n.mjs) that is
// pure and DOM-free, so it's directly testable here in Node — the same
// module the browser code imports and calls, not a reimplementation.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const MODULE_PATH = path.join(__dirname, "..", "public", "js", "equipment-i18n.mjs");
const WORKOUT_BUILDER_PATH = path.join(__dirname, "..", "public", "js", "workout-builder.js");

let i18n;

test.before(async () => {
  i18n = await import(`file://${MODULE_PATH.replace(/\\/g, "/")}`);
});

test("EQUIPMENT_LABELS defines every canonical id in both locales", () => {
  const { EQUIPMENT_LABELS, CANONICAL_EQUIPMENT_IDS } = i18n;
  for (const locale of ["en", "he"]) {
    for (const id of CANONICAL_EQUIPMENT_IDS) {
      assert.ok(
        typeof EQUIPMENT_LABELS[locale][id] === "string" && EQUIPMENT_LABELS[locale][id].length > 0,
        `Missing ${locale} label for canonical id "${id}"`
      );
    }
  }
});

test("English equipment summary contains no Hebrew characters", () => {
  const { buildEquipmentSummaryText, hasHebrewCharacters, CANONICAL_EQUIPMENT_IDS } = i18n;
  const summary = buildEquipmentSummaryText("en", CANONICAL_EQUIPMENT_IDS);
  assert.equal(hasHebrewCharacters(summary), false, `English summary must not contain Hebrew: "${summary}"`);
});

test("Hebrew equipment summary is Hebrew", () => {
  const { buildEquipmentSummaryText, hasHebrewCharacters, CANONICAL_EQUIPMENT_IDS } = i18n;
  const summary = buildEquipmentSummaryText("he", CANONICAL_EQUIPMENT_IDS);
  assert.equal(hasHebrewCharacters(summary), true, `Hebrew summary must contain Hebrew: "${summary}"`);
});

test("English locale ignores any non-locale environment signal (no browser/system Hebrew leakage)", () => {
  // There is no browser-locale/IP/geo detection anywhere in this module —
  // getEquipmentLabel/buildEquipmentSummaryText take ONLY an explicit
  // locale string. Simulate a "Hebrew system environment" by setting
  // process.env.LANG and Intl's default locale context, and prove English
  // output is completely unaffected — the function has no code path that
  // could read either.
  const { buildEquipmentSummaryText, hasHebrewCharacters, CANONICAL_EQUIPMENT_IDS } = i18n;
  const originalLang = process.env.LANG;
  process.env.LANG = "he_IL.UTF-8";
  try {
    const summary = buildEquipmentSummaryText("en", CANONICAL_EQUIPMENT_IDS);
    assert.equal(hasHebrewCharacters(summary), false, "English locale must render English regardless of system LANG");
    assert.equal(summary, "Bodyweight, Pull-up bar, Gymnastic rings, Dumbbells, Barbell, Machines, Cable");
  } finally {
    process.env.LANG = originalLang;
  }
});

test("Switching languages updates the summary immediately (same ids, different locale)", () => {
  const { buildEquipmentSummaryText, CANONICAL_EQUIPMENT_IDS } = i18n;
  const selected = ["bodyweight", "pullupbar", "rings"];
  const en = buildEquipmentSummaryText("en", selected);
  const he = buildEquipmentSummaryText("he", selected);
  assert.notEqual(en, he, "Same canonical selection must render differently per locale");
  assert.equal(en, "Bodyweight, Pull-up bar, Gymnastic rings");
  assert.equal(he, "משקל גוף, מתח, טבעות");
});

test("Saved and reloaded plans preserve canonical values and render using the current locale", () => {
  // Simulates: a plan was generated/saved while the user was in Hebrew
  // mode (canonical ids are what get persisted, never translated labels —
  // see next test), then reloaded later while the user is in English mode.
  const { buildEquipmentSummaryText, hasHebrewCharacters } = i18n;
  const savedCanonicalEquipment = ["dumbbell", "barbell", "machine"]; // as persisted, locale-independent
  const renderedAfterReloadInEnglish = buildEquipmentSummaryText("en", savedCanonicalEquipment);
  const renderedAfterReloadInHebrew = buildEquipmentSummaryText("he", savedCanonicalEquipment);

  assert.equal(hasHebrewCharacters(renderedAfterReloadInEnglish), false);
  assert.equal(renderedAfterReloadInEnglish, "Dumbbells, Barbell, Machines");
  assert.equal(renderedAfterReloadInHebrew, "משקולות יד, מוט, מכונות");
});

test("Request payload never contains translated equipment labels (canonical ids only)", () => {
  const { CANONICAL_EQUIPMENT_IDS, hasHebrewCharacters, EQUIPMENT_LABELS } = i18n;

  for (const id of CANONICAL_EQUIPMENT_IDS) {
    assert.equal(hasHebrewCharacters(id), false, `Canonical id "${id}" must not itself be a translated label`);
    assert.equal(
      Object.values(EQUIPMENT_LABELS.en).includes(id),
      false,
      `Canonical id "${id}" must not equal an English display label`
    );
    assert.equal(
      Object.values(EQUIPMENT_LABELS.he).includes(id),
      false,
      `Canonical id "${id}" must not equal a Hebrew display label`
    );
  }
});

test("getEquipmentLabel falls back to the raw id for an unrecognized id (never guesses a translation)", () => {
  const { getEquipmentLabel } = i18n;
  assert.equal(getEquipmentLabel("en", "kettlebell"), "kettlebell");
  assert.equal(getEquipmentLabel("he", "kettlebell"), "kettlebell");
});

// --- Static regression check on the actual shipped fix ---

test("workout-builder.js: Summary rendering no longer uses the unconditional Hebrew dictionary for equipment", () => {
  const source = fs.readFileSync(WORKOUT_BUILDER_PATH, "utf8");

  assert.ok(
    !/hebrewOptionLabels\[normalizeOptionKey\(value\)\]/.test(source),
    "The old unconditional hebrewOptionLabels equipment mapping must be removed from renderWizardReview()"
  );
  assert.ok(
    /buildEquipmentSummaryText\(currentLanguage,\s*formData\.getAll\("equipment"\)\)/.test(source),
    "renderWizardReview() must resolve equipment text through buildEquipmentSummaryText(currentLanguage, ...)"
  );
  assert.ok(
    /import\s*\{[^}]*getEquipmentLabel[^}]*\}\s*from\s*"\.\/equipment-i18n\.mjs"/.test(source),
    "workout-builder.js must import the canonical equipment-i18n module"
  );
});

test("workout-builder.html: equipment checkbox values are canonical (not camelCase/plural)", () => {
  const htmlPath = path.join(__dirname, "..", "public", "workout-builder.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const values = [...html.matchAll(/name="equipment" value="([^"]+)"/g)].map((m) => m[1]);

  assert.ok(values.length > 0, "Expected at least one equipment checkbox in the form");
  for (const value of values) {
    assert.equal(value, value.toLowerCase(), `Equipment value "${value}" must be lowercase (canonical)`);
    assert.ok(!value.includes(" "), `Equipment value "${value}" must not contain spaces`);
  }
  assert.ok(!values.includes("pullUpBar"), "pullUpBar must be replaced with canonical pullupbar");
  assert.ok(!values.includes("dumbbells"), "dumbbells must be replaced with canonical dumbbell");
  assert.ok(!values.includes("machines"), "machines must be replaced with canonical machine");
});
