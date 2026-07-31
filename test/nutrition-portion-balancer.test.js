// Release regression tests for deterministic portion-level macro balancing.
//
// buildMealOption scales a whole meal uniformly toward its calorie target, and
// uniform scaling cannot change a meal's macro RATIO. A live plan therefore
// landed within 0.37% on calories while sitting +48 g protein, -62 g carbs and
// +12 g fat: every number correct, the split wrong. These tests cover the
// per-ingredient adjustment that fixes it, and -- just as importantly -- the
// serving constraints that stop it "solving" a gap with 3 g of chicken or
// 100 g of olive oil.

const test = require("node:test");
const assert = require("node:assert/strict");

const { FOODS, buildMealOption, filterMeals } = require("../lib/meal-catalog");
const {
  balancePlanWithOptionSearch,
  balancePortions,
  findImplausibleServings,
  toleranceFor,
  totalsOf
} = require("../lib/nutrition-portion-balancer");
const { absurdBoundsFor, boundsFor, categoryFor } = require("../lib/nutrition-portion-constraints");
const { PLAN_TOLERANCES } = require("../lib/nutrition-totals");

const SLOTS = ["breakfast", "lunch", "snack", "dinner"];

function planFor(mealIdsPerSlot, targets) {
  const slotCalories = Math.round(targets.calories / mealIdsPerSlot.length);
  return {
    meals: mealIdsPerSlot.map((ids, index) => ({
      mealNumber: index + 1,
      targetCalories: slotCalories,
      options: ids.map((id, optionIndex) =>
        buildMealOption(id, { targetCalories: slotCalories, optionNumber: optionIndex + 1 })
      )
    }))
  };
}

function buildProfilePlan(targets, seed = 0, diet = "omnivore") {
  const pool = filterMeals({ diet });
  const idsPerSlot = SLOTS.map((slot, slotIndex) => {
    const candidates = pool.filter(meal => meal.slots.includes(slot));
    const ids = [0, 1, 2].map(k => candidates[(seed * (slotIndex + 2) + k * 7) % candidates.length].id);
    return [...new Set(ids)];
  });
  return planFor(idsPerSlot, targets);
}

function deviations(totals, targets) {
  return {
    calories: totals.calories - targets.calories,
    proteinGrams: totals.proteinGrams - targets.proteinGrams,
    carbsGrams: totals.carbsGrams - targets.carbsGrams,
    fatGrams: totals.fatGrams - targets.fatGrams
  };
}

// --------------------------------------------------- the reported blocker

test("a plan that is calorie-accurate but macro-wrong is brought inside tolerance", () => {
  const targets = { calories: 3000, proteinGrams: 156, carbsGrams: 407, fatGrams: 83 };
  const plan = planFor(
    [
      ["oats-banana-peanut-butter"],
      ["grilled-chicken-rice-broccoli"],
      ["greek-yogurt-honey-almonds"],
      ["salmon-couscous-zucchini"]
    ],
    targets
  );

  const rowsOf = p =>
    p.meals.flatMap(m => m.options[0].foods.map(f => ({ key: f.catalogKey, grams: f.grams })));
  const before = totalsOf(rowsOf(plan));
  // Precondition: this selection really is macro-wrong before balancing.
  assert.ok(
    Math.abs(before.carbsGrams - targets.carbsGrams) > PLAN_TOLERANCES.carbsGrams,
    "fixture should start outside carb tolerance"
  );

  const result = balancePortions(plan, targets);
  const dev = deviations(result.finalTotals, targets);

  assert.ok(Math.abs(dev.calories) <= targets.calories * PLAN_TOLERANCES.caloriesPercent / 100, `calories off by ${dev.calories}`);
  assert.ok(Math.abs(dev.proteinGrams) <= PLAN_TOLERANCES.proteinGrams, `protein off by ${dev.proteinGrams}`);
  assert.ok(Math.abs(dev.carbsGrams) <= PLAN_TOLERANCES.carbsGrams, `carbs off by ${dev.carbsGrams}`);
  assert.ok(Math.abs(dev.fatGrams) <= PLAN_TOLERANCES.fatGrams, `fat off by ${dev.fatGrams}`);
  assert.equal(result.withinTolerance, true);
});

test("tolerances are never weakened to make a plan pass", () => {
  assert.equal(PLAN_TOLERANCES.caloriesPercent, 1.5);
  assert.equal(PLAN_TOLERANCES.proteinGrams, 5);
  assert.equal(PLAN_TOLERANCES.carbsGrams, 5);
  assert.equal(PLAN_TOLERANCES.fatGrams, 3);
});

// ------------------------------------------------------- arithmetic stays exact

test("after balancing, every meal headline still equals its own ingredient rows", () => {
  const targets = { calories: 2400, proteinGrams: 150, carbsGrams: 280, fatGrams: 75 };
  const plan = buildProfilePlan(targets, 3);
  balancePlanWithOptionSearch(plan, targets);

  for (const meal of plan.meals) {
    for (const option of meal.options) {
      const sum = key => option.foods.reduce((total, food) => total + food[key], 0);
      assert.equal(sum("calories"), option.optionCalories, `meal ${meal.mealNumber} calories`);
      assert.equal(sum("proteinGrams"), option.optionProteinGrams, `meal ${meal.mealNumber} protein`);
      assert.equal(sum("carbsGrams"), option.optionCarbsGrams, `meal ${meal.mealNumber} carbs`);
      assert.equal(sum("fatGrams"), option.optionFatGrams, `meal ${meal.mealNumber} fat`);
    }
  }
});

test("adjusted ingredient rows keep macros consistent with their gram amount", () => {
  const targets = { calories: 2200, proteinGrams: 140, carbsGrams: 250, fatGrams: 70 };
  const plan = buildProfilePlan(targets, 5);
  balancePlanWithOptionSearch(plan, targets);

  for (const meal of plan.meals) {
    for (const food of meal.options[0].foods) {
      const definition = FOODS[food.catalogKey];
      const factor = food.grams / 100;
      assert.equal(food.calories, Math.round(definition.kcal * factor), `${food.catalogKey} calories`);
      assert.equal(food.proteinGrams, Math.round(definition.p * factor), `${food.catalogKey} protein`);
    }
  }
});

test("the displayed amount string is regenerated from the adjusted grams", () => {
  const targets = { calories: 2600, proteinGrams: 150, carbsGrams: 300, fatGrams: 80 };
  const plan = planFor([["scrambled-eggs-toast-avocado"], ["grilled-chicken-rice-broccoli"]], targets);
  balancePortions(plan, targets);
  for (const meal of plan.meals) {
    for (const food of meal.options[0].foods) {
      assert.match(String(food.amount), /\d/, `${food.catalogKey} must show a numeric amount`);
      if (!FOODS[food.catalogKey].piece) {
        assert.ok(
          String(food.amount).includes(String(food.grams)),
          `${food.catalogKey} amount "${food.amount}" should reflect ${food.grams}g`
        );
      }
    }
  }
});

// ------------------------------------------------------------- serving sanity

test("no adjusted plan produces an implausible serving", () => {
  const profiles = [
    { calories: 3000, proteinGrams: 156, carbsGrams: 407, fatGrams: 83 },
    { calories: 1900, proteinGrams: 150, carbsGrams: 190, fatGrams: 63 },
    { calories: 2200, proteinGrams: 120, carbsGrams: 275, fatGrams: 73 }
  ];
  for (const targets of profiles) {
    for (let seed = 0; seed < 6; seed++) {
      const plan = buildProfilePlan(targets, seed);
      balancePlanWithOptionSearch(plan, targets);
      assert.deepEqual(
        findImplausibleServings(plan),
        [],
        `seed ${seed} produced an implausible serving`
      );
    }
  }
});

test("the serving validator still rejects the absurd amounts from the release spec", () => {
  const absurd = [
    ["chicken-breast", 3],
    ["white-rice", 900],
    ["olive-oil", 100],
    ["eggs", 25]
  ];
  for (const [key, grams] of absurd) {
    const bounds = absurdBoundsFor(key, FOODS[key]);
    assert.ok(
      grams < bounds.min || grams > bounds.max,
      `${grams}g of ${key} should be rejected as implausible`
    );
  }
});

test("a piece-based food is only ever served in whole pieces", () => {
  const targets = { calories: 2500, proteinGrams: 150, carbsGrams: 280, fatGrams: 78 };
  for (let seed = 0; seed < 6; seed++) {
    const plan = buildProfilePlan(targets, seed);
    balancePlanWithOptionSearch(plan, targets);
    for (const meal of plan.meals) {
      for (const food of meal.options[0].foods) {
        const piece = FOODS[food.catalogKey]?.piece?.g;
        if (!piece) continue;
        assert.equal(food.grams % piece, 0, `${food.catalogKey} is ${food.grams}g, not a whole ${piece}g piece`);
      }
    }
  }
});

test("spices are never used as a macro lever", () => {
  const targets = { calories: 3000, proteinGrams: 156, carbsGrams: 407, fatGrams: 83 };
  const plan = planFor([["oats-banana-peanut-butter"]], targets);
  const before = plan.meals[0].options[0].foods.find(f => f.catalogKey === "cinnamon").grams;
  balancePortions(plan, targets);
  const after = plan.meals[0].options[0].foods.find(f => f.catalogKey === "cinnamon").grams;
  assert.equal(after, before, "cinnamon must not be adjusted to chase a macro target");
  assert.equal(boundsFor("cinnamon", FOODS.cinnamon).lever, 0);
});

test("fat gaps are not closed with an unrealistic amount of oil", () => {
  const bounds = boundsFor("olive-oil", FOODS["olive-oil"]);
  assert.ok(bounds.max <= 20, `olive oil may not exceed ${bounds.max}g in one meal`);
  assert.equal(categoryFor("olive-oil", FOODS["olive-oil"]), "oil");
});

test("every catalog food has a serving category and positive bounds", () => {
  for (const [key, food] of Object.entries(FOODS)) {
    const bounds = boundsFor(key, food);
    assert.ok(bounds.category, `${key} needs a category`);
    assert.ok(bounds.min > 0, `${key} min must be positive`);
    assert.ok(bounds.max >= bounds.min, `${key} max must not be below min`);
  }
});

// ------------------------------------------------------------- determinism

test("balancing the same plan twice produces identical amounts", () => {
  const targets = { calories: 2750, proteinGrams: 165, carbsGrams: 320, fatGrams: 85 };
  const first = buildProfilePlan(targets, 8);
  const second = buildProfilePlan(targets, 8);
  balancePlanWithOptionSearch(first, targets);
  balancePlanWithOptionSearch(second, targets);

  const shape = plan =>
    plan.meals.map(m => m.options[0].foods.map(f => `${f.catalogKey}:${f.grams}`).join("|")).join(" || ");
  assert.equal(shape(first), shape(second));
});

// -------------------------------------------------- option search fallback

test("when the opening selection cannot reach target, other options are tried", () => {
  const targets = { calories: 1700, proteinGrams: 160, carbsGrams: 150, fatGrams: 52 };
  const plan = buildProfilePlan(targets, 2);
  const result = balancePlanWithOptionSearch(plan, targets);
  assert.ok(result.attempts.length >= 1, "the search must record what it tried");
  // Whatever the outcome, the plan must stay internally consistent and sane.
  assert.deepEqual(findImplausibleServings(plan), []);
  for (const meal of plan.meals) {
    const option = meal.options[0];
    const sum = key => option.foods.reduce((t, f) => t + f[key], 0);
    assert.equal(sum("calories"), option.optionCalories);
  }
});

test("a plan that cannot reach target reports it honestly rather than pretending", () => {
  // Deliberately impossible: a single small snack cannot supply 3600 kcal.
  const targets = { calories: 3600, proteinGrams: 200, carbsGrams: 450, fatGrams: 100 };
  const plan = planFor([["apple-almond-butter"]], targets);
  const result = balancePlanWithOptionSearch(plan, targets);
  assert.equal(result.ok, false, "an unreachable target must not be reported as reached");
  assert.equal(result.withinTolerance, false);
  // and it must still not invent absurd servings trying to get there
  assert.deepEqual(findImplausibleServings(plan), []);
});

test("the plan-level tolerance helper matches the published tolerances", () => {
  const tol = toleranceFor({ calories: 2000, proteinGrams: 150, carbsGrams: 200, fatGrams: 60 });
  assert.equal(tol.calories, 2000 * 1.5 / 100);
  assert.equal(tol.proteinGrams, 5);
  assert.equal(tol.carbsGrams, 5);
  assert.equal(tol.fatGrams, 3);
});
