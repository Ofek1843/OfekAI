"use strict";

const { buildMealOption, filterMeals, getMealById, detectAllergens, CATEGORY_DEFINITIONS } = require("./meal-catalog");

function normalizeSearch(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[\u200e\u200f]/g, "")
    // Preserve the legacy Hebrew quote marks used by the existing catalog
    // strings while still normalizing ordinary punctuation.
    .replace(/[^\p{L}\p{N}\s\u05f3\u05f4\u2018\u2019]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function restrictionTokens(values) {
  return values
    .flatMap((value) => normalizeSearch(value).split(/\s*,\s*|\s*;\s*|\s*\|\s*|\n+/))
    .map((value) => value.replace(/^(no|avoid|exclude)\s+/i, "").trim())
    .filter((value) => value.length >= 3);
}

const CATEGORY_ALIASES = {
  "high protein": "high-protein",
  protein: "high-protein",
  "low calorie": "low-calorie",
  "low calories": "low-calorie",
  balanced: "balanced",
  vegan: "vegan",
  vegetarian: "vegetarian",
  pescatarian: "pescatarian",
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
  "high fiber": "high-fiber",
  fiber: "high-fiber",
  "lower carb": "lower-carb",
  "pre workout": "pre-workout",
  "post workout": "post-workout"
};

const CATEGORY_KEYS = new Set([
  ...Object.keys(CATEGORY_DEFINITIONS),
  "vegan",
  "vegetarian",
  "pescatarian",
  "breakfast",
  "lunch",
  "dinner",
  "snack"
]);

function normalizeCategories(values) {
  return [...new Set(values
    .flatMap((value) => String(value || "").split(/[,;|\n]+/))
    .map((value) => normalizeSearch(value))
    .map((value) => CATEGORY_ALIASES[value] || value)
    .filter((value) => CATEGORY_KEYS.has(value)))];
}

function mealSearchText(meal) {
  return normalizeSearch([
    meal.en,
    meal.he,
    meal.id,
    meal.diet,
    ...(meal.slots || []),
    ...(meal.nutrients || []),
    ...(meal.categories || []),
    ...(meal.aliases || []),
    ...(meal.items || []).flatMap(([key]) => [key, meal.foods?.[key]?.en, meal.foods?.[key]?.he])
  ].filter(Boolean).join(" "));
}

function publicMeal(meal, isHebrew = false) {
  const option = buildMealOption(meal.id, {
    targetCalories: meal.baseCalories,
    isHebrew,
    optionNumber: 1
  });
  const ingredients = option.foods.map((food) => food.name).join(", ");
  const categoryLabels = (meal.categories || [])
    .filter((key) => CATEGORY_DEFINITIONS[key])
    .map((key) => isHebrew ? CATEGORY_DEFINITIONS[key].labelHe : CATEGORY_DEFINITIONS[key].labelEn);
  return {
    id: meal.id,
    title: isHebrew ? meal.he : meal.en,
    ingredients,
    servingSize: "1 meal",
    calories: option.optionCalories,
    proteinGrams: option.optionProteinGrams,
    carbsGrams: option.optionCarbsGrams,
    fatGrams: option.optionFatGrams,
    fiberGrams: option.optionFiberGrams,
    imageKey: meal.imageKey,
    image: meal.image || "/images/food-placeholder.png",
    slots: meal.slots || [],
    diet: meal.diet,
    tags: [...new Set([...(meal.categories || []), ...(meal.nutrients || [])])],
    categories: meal.categories || [],
    categoryLabels,
    foods: option.foods,
    preparation: option.preparation
  };
}

function categoryMatches(meal, categories) {
  return categories.every((category) => {
    if (category === "vegetarian") return ["vegan", "vegetarian"].includes(meal.diet);
    if (category === "pescatarian") return ["vegan", "vegetarian", "pescatarian"].includes(meal.diet);
    return (meal.categories || []).includes(category);
  });
}

function searchManualMeals({
  query = "",
  diet = "omnivore",
  allergies = [],
  exclusions = [],
  slot = null,
  categories = [],
  language = "en",
  limit = 8,
  offset = 0
} = {}) {
  const isHebrew = language === "he";
  const normalizedQuery = normalizeSearch(query);
  const selectedCategories = normalizeCategories(Array.isArray(categories) ? categories : [categories]);
  const hasDiscoveryInput = normalizedQuery.length >= 2 || selectedCategories.length > 0 || Boolean(slot);
  if (!hasDiscoveryInput) return { meals: [], hasMore: false, offset: 0, limit: Math.min(8, Math.max(1, Number(limit) || 8)) };
  if (normalizedQuery && normalizedQuery.length < 2) return { meals: [], hasMore: false, offset: 0, limit: 8 };

  const excludeAllergens = detectAllergens(...allergies, ...exclusions);
  const blockedTerms = restrictionTokens([...allergies, ...exclusions]);
  const terms = normalizedQuery ? normalizedQuery.split(/\s+/) : [];
  const eligible = filterMeals({ diet, excludeAllergens, slot }).filter((meal) => {
    if (!categoryMatches(meal, selectedCategories)) return false;
    const text = mealSearchText(meal);
    if (blockedTerms.some((term) => text.includes(term))) return false;
    return terms.every((term) => text.includes(term));
  });
  const boundedLimit = Math.min(8, Math.max(1, Number(limit) || 8));
  const boundedOffset = Math.max(0, Number(offset) || 0);
  const meals = eligible
    .slice(boundedOffset, boundedOffset + boundedLimit)
    .map((meal) => publicMeal(meal, isHebrew));
  return {
    meals,
    hasMore: boundedOffset + meals.length < eligible.length,
    offset: boundedOffset,
    limit: boundedLimit
  };
}

function mealById(mealId, { language = "en" } = {}) {
  const meal = getMealById(mealId);
  return meal ? publicMeal(meal, language === "he") : null;
}

module.exports = {
  CATEGORY_ALIASES,
  CATEGORY_KEYS,
  mealById,
  normalizeCategories,
  normalizeSearch,
  searchManualMeals
};
