"use strict";

// This module is deliberately provider-agnostic. The server asks a low-cost
// model for a single unknown food only, then this boundary rejects anything
// that cannot safely become an *estimated* log entry.
const FOOD_INTERPRETATION_MODEL = "gpt-4o-mini";
const MAX_FOOD_TEXT_LENGTH = 120;
const MAX_PORTION_CHOICES = 4;

function cleanText(value, maxLength = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function boundedNumber(value, { min = 0, max = 1000, precision = 1 } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) return null;
  const factor = 10 ** precision;
  return Math.round(numeric * factor) / factor;
}

function normalizedName(value, fallback) {
  if (value && typeof value === "object") {
    return {
      en: cleanText(value.en || value.he || fallback, 80),
      he: cleanText(value.he || value.en || fallback, 80)
    };
  }
  const text = cleanText(value || fallback, 80);
  return { en: text, he: text };
}

function validPortionKind(value) {
  return new Set(["item", "weight", "cup", "tablespoon", "bowl", "plate", "serving", "unknown"]).has(String(value || ""))
    ? String(value)
    : "unknown";
}

function sanitizeChoice(choice, fallbackName) {
  if (!choice || typeof choice !== "object") return null;
  const grams = boundedNumber(choice.grams, { min: 1, max: 1500 });
  const label = normalizedName(choice.label, fallbackName.en);
  if (!grams || !label.en || !label.he) return null;
  return { id: cleanText(choice.id, 40) || `portion-${grams}`, label, grams };
}

function sanitizeFoodInterpretation(value, { fallbackName = "Food" } = {}) {
  if (!value || typeof value !== "object" || value.recognized !== true) return null;
  const name = normalizedName(value.food?.name || value.name, fallbackName);
  const rawNutrition = value.nutritionPer100g || value.nutrition || {};
  const calories = boundedNumber(rawNutrition.calories, { min: 1, max: 900 });
  const protein = boundedNumber(rawNutrition.proteinGrams ?? rawNutrition.protein, { min: 0, max: 100 });
  const carbs = boundedNumber(rawNutrition.carbsGrams ?? rawNutrition.carbs, { min: 0, max: 100 });
  const fat = boundedNumber(rawNutrition.fatGrams ?? rawNutrition.fat, { min: 0, max: 100 });
  const portion = value.portion && typeof value.portion === "object" ? value.portion : {};
  const defaultGrams = boundedNumber(portion.defaultGrams, { min: 1, max: 1500 });
  const confidence = ["low", "medium", "high"].includes(String(value.confidence)) ? String(value.confidence) : "low";
  if (!name.en || !name.he || calories === null || protein === null || carbs === null || fat === null || !defaultGrams) return null;
  // The macro-derived energy may differ slightly because nutrition labels
  // round, but a wildly incoherent answer is not safe enough to log.
  const macroCalories = protein * 4 + carbs * 4 + fat * 9;
  if (macroCalories > calories * 1.65 + 40 || macroCalories < calories * 0.2 - 20) return null;
  const aliases = [...new Set((Array.isArray(value.food?.aliases) ? value.food.aliases : [])
    .map((alias) => cleanText(alias, 80))
    .filter(Boolean))].slice(0, 8);
  const choices = (Array.isArray(portion.choices) ? portion.choices : [])
    .map((choice) => sanitizeChoice(choice, name))
    .filter(Boolean)
    .slice(0, MAX_PORTION_CHOICES);
  const averageChoice = { id: "average", label: { en: "I don't know — use average", he: "לא יודע — השתמש בממוצע" }, grams: defaultGrams };
  if (!choices.some((choice) => choice.id === "average")) choices.push(averageChoice);
  return {
    recognized: true,
    food: { name, aliases },
    nutritionPer100g: { calories, proteinGrams: protein, carbsGrams: carbs, fatGrams: fat },
    portion: { kind: validPortionKind(portion.kind), defaultGrams, choices },
    confidence,
    reason: cleanText(value.reason, 160)
  };
}

function foodInterpretationMessages({ text, language = "en" } = {}) {
  const cleanedText = cleanText(text, MAX_FOOD_TEXT_LENGTH);
  const requestedLanguage = String(language).toLowerCase() === "he" ? "Hebrew" : "English";
  return [
    {
      role: "system",
      content: `You classify ONE unknown food for a consumer food log. Return ONLY valid JSON, no markdown.\n\nExact schema:\n{\n  "recognized": true,\n  "food": { "name": { "en": "string", "he": "string" }, "aliases": ["string"] },\n  "nutritionPer100g": { "calories": 0, "proteinGrams": 0, "carbsGrams": 0, "fatGrams": 0 },\n  "portion": { "kind": "item|weight|cup|tablespoon|bowl|plate|serving|unknown", "defaultGrams": 0, "choices": [{ "id": "string", "label": { "en": "string", "he": "string" }, "grams": 0 }] },\n  "confidence": "low|medium|high",\n  "reason": "short string"\n}\n\nRules:\n- Understand Hebrew, English, transliteration, and regional foods (for example injera).\n- Return representative generic food composition per 100 g, never a branded nutrition claim.\n- Preserve an explicit weight in the input conceptually, but still provide a sensible average portion for users who did not give one.\n- Give 1-3 realistic portion choices plus an average; do not invent a package size.\n- If the phrase is not a food or is too unclear, return {"recognized":false}.\n- Never give medical, diet, safety, or pricing advice.\n- All answers are estimates, so use cautious confidence.\n- Output labels in both English and Hebrew.\n- Requested interface language: ${requestedLanguage}.`
    },
    { role: "user", content: `Unknown food text: ${cleanedText}` }
  ];
}

module.exports = {
  FOOD_INTERPRETATION_MODEL,
  MAX_FOOD_TEXT_LENGTH,
  cleanText,
  foodInterpretationMessages,
  sanitizeFoodInterpretation
};
