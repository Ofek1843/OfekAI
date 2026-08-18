const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildMealOption,
  filterMeals,
  parseFoodPreferenceTerms,
  selectMeals
} = require("../lib/meal-catalog");

test("ready and quick meal preferences restrict the actual eligible catalog pool", () => {
  const readyBreakfast = filterMeals({ slot: "breakfast", mealFormatPreference: "ready", prepTimePreference: "zero" });
  assert.ok(readyBreakfast.length >= 3);
  assert.ok(readyBreakfast.every((meal) => meal.mealFormat === "ready" && meal.prepMinutes === 0));

  const ready = filterMeals({ slot: "snack", mealFormatPreference: "ready", prepTimePreference: "zero" });
  assert.ok(ready.length >= 3);
  assert.ok(ready.every((meal) => meal.mealFormat === "ready" && meal.prepMinutes === 0));

  const quick = filterMeals({ slot: "snack", mealFormatPreference: "quick", prepTimePreference: "five" });
  assert.ok(quick.length > ready.length);
  assert.ok(quick.every((meal) => ["ready", "quick"].includes(meal.mealFormat) && meal.prepMinutes <= 5));
});

test("Mediterranean preference boosts local practical staples without becoming a global hard filter", () => {
  const pool = filterMeals({ slot: "snack" });
  const selected = selectMeals({
    pool,
    slot: "snack",
    targetCalories: 300,
    count: 3,
    foodStylePreference: "mediterranean"
  });
  assert.ok(selected.includes("hummus-veggie-sticks"));
  assert.ok(pool.some((meal) => !meal.foodStyles.includes("mediterranean")), "the global catalog stays available");
});

test("disliked-food terms exclude matching meals and generated cards expose their practical format", () => {
  const avoidTerms = parseFoodPreferenceTerms("tuna, cottage cheese");
  const pool = filterMeals({ slot: "snack", avoidTerms });
  assert.ok(!pool.some((meal) => meal.id.includes("tuna") || meal.id.includes("cottage")));

  const option = buildMealOption("protein-shake-banana", { targetCalories: 326 });
  assert.equal(option.mealFormat, "quick");
  assert.equal(option.prepMinutes, 2);
});
