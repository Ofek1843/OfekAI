// Single source of truth for equipment localization. Canonical equipment
// ids (never translated labels) are what forms hold, what gets sent to the
// backend, and what gets stored — display text is resolved from these ids
// through the active locale only, at render time.
//
// .mjs (not .js) so Node's module loader always treats this as ESM
// regardless of package.json "type", letting both the browser
// (public/js/workout-builder.js) and Node test files import the exact same
// module with zero duplication.

export const CANONICAL_EQUIPMENT_IDS = [
  "bodyweight",
  "pullupbar",
  "rings",
  "dumbbell",
  "barbell",
  "machine",
  "cable"
];

export const EQUIPMENT_LABELS = {
  en: {
    bodyweight: "Bodyweight",
    pullupbar: "Pull-up bar",
    rings: "Gymnastic rings",
    dumbbell: "Dumbbells",
    barbell: "Barbell",
    machine: "Machines",
    cable: "Cable"
  },
  he: {
    bodyweight: "משקל גוף",
    pullupbar: "מתח",
    rings: "טבעות",
    dumbbell: "משקולות יד",
    barbell: "מוט",
    machine: "מכונות",
    cable: "כבלים"
  }
};

// Resolves a canonical equipment id to display text in the given locale.
// Falls back to "en", then to the raw id itself (never guesses a
// translation for an id outside the dictionary).
export function getEquipmentLabel(locale, canonicalId) {
  const dict = EQUIPMENT_LABELS[locale] || EQUIPMENT_LABELS.en;
  return dict[canonicalId] || canonicalId;
}

// Builds the comma-joined equipment summary text for a locale from
// canonical ids only — this is the exact logic the Summary step renders,
// extracted so it's usable/testable outside the DOM.
export function buildEquipmentSummaryText(locale, canonicalValues = []) {
  return canonicalValues.map((id) => getEquipmentLabel(locale, id)).join(", ");
}

const HEBREW_UNICODE_RANGE = /[֐-׿]/;

// Language-integrity check: does this text contain any Hebrew Unicode
// character? Used to assert English-locale output never leaks Hebrew.
export function hasHebrewCharacters(text = "") {
  return HEBREW_UNICODE_RANGE.test(String(text));
}
