"use strict";

const { buildMealOption, filterMeals, getMealById, detectAllergens } = require("./meal-catalog");

function normalizeSearch(value) {
  return String(value || "").toLocaleLowerCase().normalize("NFKC").replace(/[\u200e\u200f]/g, "").trim();
}

function restrictionTokens(values) {
  return values.flatMap((value) => normalizeSearch(value).split(/[,;|\n]+/)).map((value) => value.replace(/^(no|avoid|exclude)\s+/i, "").trim()).filter((value) => value.length >= 3);
}

function mealSearchText(meal) {
  return normalizeSearch([
    meal.en, meal.he, meal.id, meal.diet, ...(meal.slots || []), ...(meal.nutrients || []),
    ...(meal.items || []).flatMap(([key]) => [key, meal.foods?.[key]?.en, meal.foods?.[key]?.he])
  ].filter(Boolean).join(" "));
}

function publicMeal(meal, isHebrew = false) {
  const option = buildMealOption(meal.id, { targetCalories: meal.baseCalories, isHebrew, optionNumber: 1 });
  const ingredients = option.foods.map((food) => food.name).join(isHebrew ? ", " : ", ");
  const tags = [...new Set([
    ...(meal.slots || []), meal.diet, ...(meal.nutrients || []), ...(meal.baseProtein >= 25 ? ["high-protein"] : [])
  ])];
  return {
    id: meal.id,
    title: isHebrew ? meal.he : meal.en,
    ingredients,
    servingSize: "1 meal",
    calories: option.optionCalories,
    proteinGrams: option.optionProteinGrams,
    carbsGrams: option.optionCarbsGrams,
    fatGrams: option.optionFatGrams,
    image: meal.image || option.foods[0]?.imageUrl || "/images/food-placeholder.png",
    slots: meal.slots || [],
    diet: meal.diet,
    tags,
    foods: option.foods,
    preparation: option.preparation
  };
}

function searchManualMeals({ query = "", diet = "omnivore", allergies = [], exclusions = [], slot = null, language = "en", limit = 24 } = {}) {
  const isHebrew = language === "he";
  const excludeAllergens = detectAllergens(...allergies, ...exclusions);
  const blockedTerms = restrictionTokens([...allergies, ...exclusions]);
  const normalizedQuery = normalizeSearch(query);
  return filterMeals({ diet, excludeAllergens, slot }).filter((meal) => {
    const text = mealSearchText(meal);
    if (blockedTerms.some((term) => text.includes(term))) return false;
    return !normalizedQuery || normalizedQuery.split(/\s+/).every((term) => text.includes(term));
  }).slice(0, Math.max(1, Math.min(50, Number(limit) || 24))).map((meal) => publicMeal(meal, isHebrew));
}

function mealById(mealId, { language = "en" } = {}) {
  const meal = getMealById(mealId);
  return meal ? publicMeal(meal, language === "he") : null;
}

module.exports = { mealById, normalizeSearch, searchManualMeals };
