// Release regression tests for locale-independence and plan validity.
//
// The live matrix showed a Hebrew profile failing tolerance (+28 g protein)
// while the same shape of profile passed in English. Investigation found the
// calculation is fully locale-independent -- filterMeals takes no locale, slot
// ids and weights are identical, and buildMealOption returns identical grams
// and macros in both languages. What differs is that catalogForPrompt() shows
// the model Hebrew meal names, so the model picks a DIFFERENT combination, and
// that particular combination was infeasible.
//
// So the fix is the cross-meal recovery search plus refusing to return an
// out-of-tolerance plan -- not a locale fix. These tests pin down both: that
// locale can only ever change display text, and that an invalid plan is never
// reported as a success.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  FOODS,
  buildMealOption,
  buildMealSlots,
  filterMeals,
  selectMeals
} = require("../lib/meal-catalog");
const {
  MAX_REPLACEMENT_CANDIDATES_PER_SLOT,
  MAX_SEARCH_EVALUATIONS,
  balancePlanWithMealSearch,
  findImplausibleServings
} = require("../lib/nutrition-portion-balancer");
const { PLAN_TOLERANCES } = require("../lib/nutrition-totals");

const HEBREW = /[֐-׿]/;

function planFor(profile, targets) {
  const isHebrew = profile.locale === "he";
  const slots = buildMealSlots(profile.mealsPerDay, isHebrew);
  const totalWeight = slots.reduce((t, s) => t + s.weight, 0);
  const used = new Set();
  return {
    meals: slots.map(slot => {
      const slotCalories = Math.round((targets.calories * slot.weight) / totalWeight);
      const pool = filterMeals({ diet: profile.diet, excludeAllergens: profile.excludeAllergens || [], slot: slot.slot });
      const ids = selectMeals({ pool, slot: slot.slot, targetCalories: slotCalories, count: 3, exclude: [...used] });
      ids.forEach(id => used.add(id));
      return {
        mealNumber: slot.mealNumber,
        slot: slot.slot,
        targetCalories: slotCalories,
        options: ids.map((id, i) => buildMealOption(id, { targetCalories: slotCalories, isHebrew, optionNumber: i + 1 })).filter(Boolean)
      };
    })
  };
}

// ------------------------------------------------------ locale independence

test("meal eligibility does not depend on locale", () => {
  for (const diet of ["omnivore", "vegetarian", "vegan"]) {
    for (const slot of ["breakfast", "lunch", "snack", "dinner"]) {
      const a = filterMeals({ diet, slot }).map(m => m.id);
      const b = filterMeals({ diet, slot }).map(m => m.id);
      assert.deepEqual(a, b, `${diet}/${slot} eligibility must be stable and locale-free`);
    }
  }
  // filterMeals accepts a single options object with no language field.
  assert.doesNotMatch(String(filterMeals), /isHebrew|language|locale/);
});

test("meal slots share ids and weights across locales, differing only in display name", () => {
  for (const count of [3, 4, 5]) {
    const en = buildMealSlots(count, false);
    const he = buildMealSlots(count, true);
    assert.deepEqual(en.map(s => s.slot), he.map(s => s.slot), "slot ids must match");
    assert.deepEqual(en.map(s => s.weight), he.map(s => s.weight), "slot weights must match");
    assert.deepEqual(en.map(s => s.mealNumber), he.map(s => s.mealNumber));
    // Only the human-readable label may differ.
    assert.ok(he.some(s => HEBREW.test(s.name)), "Hebrew slots should have Hebrew display names");
    assert.ok(en.every(s => !HEBREW.test(s.name)), "English slots must not contain Hebrew");
  }
});

test("the same meal yields identical grams and macros in both locales", () => {
  for (const mealId of ["grilled-chicken-rice-broccoli", "oats-banana-peanut-butter", "tofu-stir-fry-brown-rice"]) {
    const en = buildMealOption(mealId, { targetCalories: 700, isHebrew: false });
    const he = buildMealOption(mealId, { targetCalories: 700, isHebrew: true });
    assert.deepEqual(en.foods.map(f => f.grams), he.foods.map(f => f.grams), `${mealId} grams`);
    assert.deepEqual(en.foods.map(f => f.catalogKey), he.foods.map(f => f.catalogKey), `${mealId} keys`);
    assert.equal(en.optionCalories, he.optionCalories, `${mealId} calories`);
    assert.equal(en.optionProteinGrams, he.optionProteinGrams, `${mealId} protein`);
    assert.equal(en.optionCarbsGrams, he.optionCarbsGrams, `${mealId} carbs`);
    assert.equal(en.optionFatGrams, he.optionFatGrams, `${mealId} fat`);
    assert.equal(en.mealId, he.mealId, "canonical meal id must be identical");
  }
});

test("no Hebrew text is ever used as a canonical id, food key or nutrient tag", () => {
  for (const [key, food] of Object.entries(FOODS)) {
    assert.ok(!HEBREW.test(key), `food key "${key}" must be canonical, not Hebrew`);
    assert.ok(!HEBREW.test(String(food.img || "")), `img key for ${key} must be canonical`);
    for (const tag of food.nut || []) assert.ok(!HEBREW.test(tag), `nutrient tag "${tag}" must be canonical`);
    for (const tag of food.alg || []) assert.ok(!HEBREW.test(tag), `allergen tag "${tag}" must be canonical`);
  }
  // A Hebrew-rendered meal still carries canonical keys.
  const he = buildMealOption("grilled-chicken-rice-broccoli", { targetCalories: 700, isHebrew: true });
  assert.ok(!HEBREW.test(he.mealId));
  for (const food of he.foods) {
    assert.ok(!HEBREW.test(food.catalogKey), "catalogKey must stay canonical in Hebrew");
    assert.ok(!HEBREW.test(food.imageKey), "imageKey must stay canonical in Hebrew");
    assert.ok(HEBREW.test(food.name), "only the display name should be Hebrew");
  }
});

test("the same canonical profile balances identically in English and Hebrew", () => {
  const targets = { calories: 2600, proteinGrams: 150, carbsGrams: 330, fatGrams: 72 };
  const base = { mealsPerDay: 4, diet: "omnivore", excludeAllergens: [] };

  const runFor = locale => {
    const profile = { ...base, locale };
    const plan = planFor(profile, targets);
    const result = balancePlanWithMealSearch(plan, targets, {
      isHebrew: locale === "he",
      candidatesForSlot: meal => filterMeals({ diet: profile.diet, excludeAllergens: [], slot: meal.slot }),
      buildOption: (id, meal) =>
        buildMealOption(id, { targetCalories: meal.targetCalories, isHebrew: locale === "he", optionNumber: 1 })
    });
    return {
      ok: result.ok,
      totals: result.finalTotals,
      mealIds: plan.meals.map(m => m.options[0].mealId),
      grams: plan.meals.map(m => m.options[0].foods.map(f => f.grams))
    };
  };

  const en = runFor("en");
  const he = runFor("he");

  // Identical selection, identical amounts, identical outcome. Locale is
  // display-only, so given the same starting selection the numbers must match.
  assert.deepEqual(he.mealIds, en.mealIds, "same canonical meals must be selected");
  assert.deepEqual(he.grams, en.grams, "same ingredient amounts must be produced");
  assert.deepEqual(he.totals, en.totals, "same daily totals must be produced");
  assert.equal(he.ok, en.ok, "tolerance outcome must not depend on locale");
});

test("tolerance rules are a single shared constant, not per-locale", () => {
  assert.deepEqual(PLAN_TOLERANCES, {
    caloriesPercent: 1.5,
    proteinGrams: 5,
    carbsGrams: 5,
    fatGrams: 3
  });
});

// ------------------------------------------------- never return an invalid plan

test("the endpoint refuses to return a plan that is outside tolerance", () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const guard = server.slice(server.indexOf("const implausible = findImplausibleServings(plan);"));
  assert.ok(guard.length > 0, "the validity guard must exist");
  assert.match(
    guard.slice(0, 900),
    /if \(!totalsCheck\.withinTolerance \|\| implausible\.length\)/,
    "an out-of-tolerance or implausible plan must not be returned"
  );
  assert.match(guard.slice(0, 1400), /return res\.status\(422\)/, "it must return a controlled error");

  // The friendly message must not leak optimizer internals. Inspect the
  // user-facing strings themselves rather than the surrounding code, whose
  // comments legitimately discuss tolerances.
  const messages = [...guard.slice(0, 2000).matchAll(/[?:]\s*"([^"]{20,})"/g)].map(m => m[1]);
  assert.ok(messages.length >= 2, "expected an English and a Hebrew message");
  for (const message of messages) {
    for (const leak of ["tolerance", "optimiz", "balancer", "coordinate", "deviation", "macro error"]) {
      assert.ok(
        !new RegExp(leak, "i").test(message),
        `user-facing error must not mention "${leak}": ${message}`
      );
    }
  }
});

test("the recovery search is bounded and cannot run unbounded combinatorics", () => {
  assert.ok(MAX_REPLACEMENT_CANDIDATES_PER_SLOT > 0 && MAX_REPLACEMENT_CANDIDATES_PER_SLOT <= 16);
  assert.ok(MAX_SEARCH_EVALUATIONS > 0 && MAX_SEARCH_EVALUATIONS <= 200);
});

test("cross-meal replacement never violates the user's dietary restrictions", () => {
  const targets = { calories: 2400, proteinGrams: 170, carbsGrams: 260, fatGrams: 70 };
  const profile = { locale: "en", mealsPerDay: 4, diet: "vegetarian", excludeAllergens: ["dairy"] };
  const plan = planFor(profile, targets);
  balancePlanWithMealSearch(plan, targets, {
    isHebrew: false,
    candidatesForSlot: meal =>
      filterMeals({ diet: profile.diet, excludeAllergens: profile.excludeAllergens, slot: meal.slot }),
    buildOption: (id, meal) => buildMealOption(id, { targetCalories: meal.targetCalories, optionNumber: 1 })
  });

  const eligible = new Set(filterMeals({ diet: profile.diet, excludeAllergens: profile.excludeAllergens }).map(m => m.id));
  for (const meal of plan.meals) {
    for (const option of meal.options) {
      assert.ok(eligible.has(option.mealId), `${option.mealId} is not eligible for this diet/allergens`);
      for (const food of option.foods) {
        const allergens = FOODS[food.catalogKey]?.alg || [];
        assert.ok(!allergens.includes("dairy"), `${food.catalogKey} contains an excluded allergen`);
      }
    }
  }
});

test("the recovery search is deterministic for an identical request", () => {
  const targets = { calories: 2900, proteinGrams: 175, carbsGrams: 340, fatGrams: 85 };
  const profile = { locale: "en", mealsPerDay: 4, diet: "omnivore", excludeAllergens: [] };
  const run = () => {
    const plan = planFor(profile, targets);
    balancePlanWithMealSearch(plan, targets, {
      isHebrew: false,
      candidatesForSlot: meal => filterMeals({ diet: "omnivore", excludeAllergens: [], slot: meal.slot }),
      buildOption: (id, meal) => buildMealOption(id, { targetCalories: meal.targetCalories, optionNumber: 1 })
    });
    return plan.meals.map(m => `${m.options[0].mealId}:${m.options[0].foods.map(f => f.grams).join(",")}`).join("|");
  };
  assert.equal(run(), run());
});

test("a plan produced by the recovery search still has realistic servings", () => {
  const targets = { calories: 3100, proteinGrams: 185, carbsGrams: 390, fatGrams: 92 };
  const profile = { locale: "he", mealsPerDay: 4, diet: "omnivore", excludeAllergens: [] };
  const plan = planFor(profile, targets);
  balancePlanWithMealSearch(plan, targets, {
    isHebrew: true,
    candidatesForSlot: meal => filterMeals({ diet: "omnivore", excludeAllergens: [], slot: meal.slot }),
    buildOption: (id, meal) => buildMealOption(id, { targetCalories: meal.targetCalories, isHebrew: true, optionNumber: 1 })
  });
  assert.deepEqual(findImplausibleServings(plan), []);
});
