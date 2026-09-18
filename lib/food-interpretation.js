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
      content: `You classify ONE unknown food for a consumer food log. Return ONLY valid JSON, no markdown.\n\nExact schema:\n{\n  "recognized": true,\n  "food": { "name": { "en": "string", "he": "string" }, "aliases": ["string"] },\n  "nutritionPer100g": { "calories": 0, "proteinGrams": 0, "carbsGrams": 0, "fatGrams": 0 },\n  "portion": { "kind": "item|weight|cup|tablespoon|bowl|plate|serving|unknown", "defaultGrams": 0, "choices": [{ "id": "string", "label": { "en": "string", "he": "string" }, "grams": 0 }] },\n  "confidence": "low|medium|high",\n  "reason": "short string"\n}\n\nRules:\n- Understand Hebrew, English, transliteration, and regional foods (for example injera).\n- Treat plausible food names, misspellings, transliterations, local foods, prepared dishes, snacks, sauces, and branded-style food descriptions as edible foods. Infer the closest generic food and return a low-confidence estimate rather than rejecting a plausible food.\n- Return representative generic food composition per 100 g, never a branded nutrition claim.\n- Preserve an explicit weight in the input conceptually, but still provide a sensible average portion for users who did not give one.\n- Give 1-3 realistic portion choices plus an average; do not invent a package size.\n- Return {"recognized":false} only when the text is clearly not food or contains no food-like clue at all.\n- Never give medical, diet, safety, or pricing advice.\n- All answers are estimates, so use cautious confidence.\n- Output labels in both English and Hebrew.\n- Requested interface language: ${requestedLanguage}.`
    },
    { role: "user", content: `Unknown food text: ${cleanedText}` }
  ];
}

function heuristicFoodInterpretation(text, { language = "en" } = {}) {
  const input = cleanText(text, MAX_FOOD_TEXT_LENGTH);
  const normalized = input.toLowerCase();
  const isHebrew = String(language).toLowerCase() === "he";
  const name = { en: input, he: input };
  const make = (nutritionPer100g, defaultGrams, kind = "serving", reason = "local-keyword-estimate") => sanitizeFoodInterpretation({
    recognized: true,
    food: { name, aliases: [input] },
    nutritionPer100g,
    portion: {
      kind,
      defaultGrams,
      choices: [{ id: "average", label: { en: "I don't know — use average", he: "לא יודע — השתמש בממוצע" }, grams: defaultGrams }]
    },
    confidence: "low",
    reason: isHebrew ? `${reason} (אומדן מקומי)` : reason
  }, { fallbackName: input });

  if (/(chocolate|cocoa|שוקולד|קקאו)/iu.test(normalized) && /(granola|bar|snack|גרנול|גרנולה|חטיף)/iu.test(normalized)) {
    return make({ calories: 450, proteinGrams: 7, carbsGrams: 62, fatGrams: 18 }, 40, "item");
  }
  if (/(granola|גרנול|גרנולה)/iu.test(normalized)) {
    return make({ calories: 471, proteinGrams: 10, carbsGrams: 64, fatGrams: 20 }, 40, "serving");
  }
  if (/(chocolate|cocoa|שוקולד|קקאו)/iu.test(normalized)) {
    return make({ calories: 535, proteinGrams: 7.5, carbsGrams: 59, fatGrams: 30 }, 25, "item");
  }
  if (/(snack|bar|חטיף|נשנוש)/iu.test(normalized)) {
    return make({ calories: 430, proteinGrams: 8, carbsGrams: 58, fatGrams: 17 }, 40, "item");
  }
  if (/(silan|date syrup|date honey|סילאן|סירופ תמרים|דבש תמרים)/iu.test(normalized)) {
    return make({ calories: 318, proteinGrams: 1.2, carbsGrams: 77.5, fatGrams: 0.4 }, 20, "tablespoon");
  }
  if (/(cheese\s*-?\s*cake|cheesecake|עוגת\s*גבינה)/iu.test(normalized)) {
    return make({ calories: 321, proteinGrams: 5.5, carbsGrams: 25.5, fatGrams: 22.5 }, 120, "item", "local-cheesecake-estimate");
  }
  if (/(cake|קייק|עוגה|cookie|biscuit|עוגיה|ביסקוויט|brownie|בראוני|muffin|מאפין)/iu.test(normalized)) {
    return make({ calories: 390, proteinGrams: 5, carbsGrams: 52, fatGrams: 18 }, 80, "item", "local-baked-good-estimate");
  }
  if (/(lemon|לימון|lime|ליים|pomegranate|רימון|mango|מנגו|apple|תפוח|banana|בננה|orange|תפוז|avocado|אבוקדו)/iu.test(normalized)) {
    return make({ calories: 80, proteinGrams: 1, carbsGrams: 19, fatGrams: 0.4 }, 150, "item", "local-fruit-estimate");
  }
  if (/(hummus|חומוס|tahini|טחינה|falafel|פלאפל|rice|אורז|pasta|פסטה|potato|תפוח אדמה|chicken|עוף|beef|בשר|fish|דג|egg|ביצה|bread|לחם|yogurt|יוגורט|cheese|גבינה|milk|חלב|pizza|פיצה|sandwich|סנדוויץ)/iu.test(normalized)) {
    return make({ calories: 220, proteinGrams: 8, carbsGrams: 28, fatGrams: 8 }, 100, "serving", "local-common-food-estimate");
  }
  if (/(food|dish|meal|אוכל|מאכל|מנה|תבשיל|סלט|מרק|לחם|בשר|עוף|דג|פרי|ירק)/iu.test(normalized)) {
    return make({ calories: 250, proteinGrams: 10, carbsGrams: 30, fatGrams: 9 }, 100, "serving", "generic-food-estimate");
  }
  return null;
}

module.exports = {
  FOOD_INTERPRETATION_MODEL,
  MAX_FOOD_TEXT_LENGTH,
  cleanText,
  foodInterpretationMessages,
  heuristicFoodInterpretation,
  sanitizeFoodInterpretation
};
