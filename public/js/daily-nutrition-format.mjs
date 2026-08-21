const UNIT_LABELS = Object.freeze({
  en: Object.freeze({
    g: "g",
    kg: "kg",
    ml: "ml",
    kcal: "kcal",
    item: "item",
    serving: "serving",
    slice: "slice",
    tablespoon: "tbsp",
    teaspoon: "tsp",
    cup: "cup",
    bowl: "bowl",
    plate: "plate"
  }),
  he: Object.freeze({
    g: "גרם",
    kg: "ק״ג",
    ml: "מ״ל",
    kcal: "קק״ל",
    item: "יחידה",
    serving: "מנה",
    slice: "פרוסה",
    tablespoon: "כף",
    teaspoon: "כפית",
    cup: "כוס",
    bowl: "קערה",
    plate: "צלחת"
  })
});

function nutritionLocale(locale = "en") {
  return String(locale).toLowerCase().startsWith("he") ? "he" : "en";
}

function formatNutritionNumber(value, locale = "en", precision = 1) {
  const language = nutritionLocale(locale);
  return Number(value || 0).toLocaleString(language === "he" ? "he-IL" : "en-US", {
    maximumFractionDigits: precision,
    minimumFractionDigits: 0
  });
}

function nutritionUnitLabel(unit, locale = "en", amount = 1) {
  const language = nutritionLocale(locale);
  const normalized = String(unit || "item").toLowerCase();
  const base = UNIT_LABELS[language][normalized] || normalized;
  if (language === "he") {
    if (Number(amount) === 1 || normalized === "g" || normalized === "kg" || normalized === "ml" || normalized === "kcal") return base;
    const plurals = { item: "יחידות", serving: "מנות", slice: "פרוסות", tablespoon: "כפות", teaspoon: "כפיות", cup: "כוסות", bowl: "קערות", plate: "צלחות" };
    return plurals[normalized] || base;
  }
  if (Number(amount) === 1) return base;
  if (normalized === "g" || normalized === "kg" || normalized === "ml" || normalized === "kcal") return base;
  const plurals = { item: "items", serving: "servings", slice: "slices", tablespoon: "tbsp", teaspoon: "tsp", cup: "cups", bowl: "bowls", plate: "plates" };
  return plurals[normalized] || base;
}

function nutritionAmountParts(value, unit, locale = "en", precision = 1) {
  return Object.freeze({
    number: formatNutritionNumber(value, locale, precision),
    unit: nutritionUnitLabel(unit, locale, value),
    locale: nutritionLocale(locale)
  });
}

function formatNutritionAmount(value, unit, locale = "en", precision = 1) {
  const parts = nutritionAmountParts(value, unit, locale, precision);
  return `${parts.number} ${parts.unit}`;
}

export {
  UNIT_LABELS,
  formatNutritionAmount,
  formatNutritionNumber,
  nutritionAmountParts,
  nutritionLocale,
  nutritionUnitLabel
};
