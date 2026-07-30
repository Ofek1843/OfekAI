// Release regression tests for the reported nutrition totals mismatch.
//
// A real generated plan displayed a 2350 kcal / 150P / 291C / 65F summary
// while its four visible meals added up to 2352 / 178 / 255 / 72. The header
// was rendering plan.dailyCalories & co., which are the TARGETS derived from
// the user's profile, not a total of the plan -- so the two numbers were
// different quantities shown as if they were the same one.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  PLAN_TOLERANCES,
  applyBestFittingOptions,
  attachActualTotals,
  evaluatePlanTotals,
  sumSelectedOptions,
  verifyDisplayedArithmetic
} = require("../lib/nutrition-totals");
const { buildMealOption, CATALOG } = require("../lib/meal-catalog");

// Rebuilds the exact reported plan: the four meal totals the user saw, under
// a summary carrying the target numbers.
function reportedPlanFixture() {
  const meal = (mealNumber, name, calories, protein, carbs, fat) => ({
    mealNumber,
    slot: name.toLowerCase(),
    name,
    targetCalories: calories,
    targetProteinGrams: protein,
    targetCarbsGrams: carbs,
    targetFatGrams: fat,
    options: [
      {
        optionNumber: 1,
        mealId: `${name.toLowerCase()}-fixture`,
        mealName: name,
        foods: [
          {
            name: "Fixture food",
            calories,
            proteinGrams: protein,
            carbsGrams: carbs,
            fatGrams: fat
          }
        ],
        optionCalories: calories,
        optionProteinGrams: protein,
        optionCarbsGrams: carbs,
        optionFatGrams: fat
      }
    ]
  });

  return {
    // The summary the user saw: targets, not totals.
    dailyCalories: 2350,
    proteinGrams: 150,
    carbsGrams: 291,
    fatGrams: 65,
    meals: [
      meal(1, "Breakfast", 630, 46, 81, 16),
      meal(2, "Lunch", 724, 66, 74, 17),
      meal(3, "Snack", 301, 27, 26, 11),
      meal(4, "Dinner", 697, 39, 74, 28)
    ]
  };
}

// ------------------------------------------------- the reported regression

test("regression fixture: the reported plan's visible meals sum to the reported totals", () => {
  const plan = reportedPlanFixture();
  const actual = sumSelectedOptions(plan.meals, null);
  assert.deepEqual(actual, {
    calories: 2352,
    proteinGrams: 178,
    carbsGrams: 255,
    fatGrams: 72
  });
});

test("regression fixture: the reported summary was targets, and the gap is now reported not hidden", () => {
  const plan = reportedPlanFixture();
  const result = evaluatePlanTotals(plan, null);

  // Targets are preserved exactly as generated -- we never rewrite the
  // summary to fake agreement.
  assert.deepEqual(result.targets, {
    calories: 2350,
    proteinGrams: 150,
    carbsGrams: 291,
    fatGrams: 65
  });

  // The actual plate differs, and each difference is surfaced.
  assert.equal(result.actual.calories, 2352);
  assert.equal(result.deviations.calories, 2);
  assert.equal(result.deviations.proteinGrams, 28);
  assert.equal(result.deviations.carbsGrams, -36);
  assert.equal(result.deviations.fatGrams, 7);

  // Calories were fine; the macros were far outside release tolerance, which
  // is exactly what made the summary look broken.
  assert.equal(result.withinTolerance, false);
  assert.ok(result.failures.some(f => f.includes("protein")));
  assert.ok(result.failures.some(f => f.includes("carbs")));
  assert.ok(result.failures.some(f => f.includes("fat")));
});

test("attachActualTotals publishes a total that equals the sum of the visible meals", () => {
  const plan = attachActualTotals(reportedPlanFixture());
  assert.deepEqual(plan.actualTotals, {
    calories: 2352,
    proteinGrams: 178,
    carbsGrams: 255,
    fatGrams: 72
  });
  const check = verifyDisplayedArithmetic(plan, null);
  assert.equal(check.exact, true, check.mismatches.join("; "));
});

// -------------------------------------------------- arithmetic must be exact

test("every catalog meal option's headline equals the sum of its own ingredient rows", () => {
  const mismatches = [];
  for (const meal of CATALOG) {
    for (const targetCalories of [400, 650, 900]) {
      const option = buildMealOption(meal.id, { targetCalories });
      const rows = option.foods;
      const sum = key => rows.reduce((total, food) => total + food[key], 0);
      if (sum("calories") !== option.optionCalories) {
        mismatches.push(`${meal.id}@${targetCalories}: calories`);
      }
      if (sum("proteinGrams") !== option.optionProteinGrams) {
        mismatches.push(`${meal.id}@${targetCalories}: protein`);
      }
      if (sum("carbsGrams") !== option.optionCarbsGrams) {
        mismatches.push(`${meal.id}@${targetCalories}: carbs`);
      }
      if (sum("fatGrams") !== option.optionFatGrams) {
        mismatches.push(`${meal.id}@${targetCalories}: fat`);
      }
    }
  }
  assert.deepEqual(mismatches, []);
});

test("verifyDisplayedArithmetic catches a headline that disagrees with its ingredients", () => {
  const plan = reportedPlanFixture();
  plan.meals[0].options[0].optionCalories = 999;
  const check = verifyDisplayedArithmetic(plan, null);
  assert.equal(check.exact, false);
  assert.ok(check.mismatches[0].includes("optionCalories"));
});

test("verifyDisplayedArithmetic catches a published total that disagrees with the meals", () => {
  const plan = attachActualTotals(reportedPlanFixture());
  plan.actualTotals.proteinGrams = 150; // pretend the target is the total
  const check = verifyDisplayedArithmetic(plan, null);
  assert.equal(check.exact, false);
  assert.ok(check.mismatches.some(m => m.includes("actualTotals.proteinGrams")));
});

// --------------------------------------------------------- option selection

test("the plan opens on the option closest to each meal's target", () => {
  const plan = {
    dailyCalories: 600,
    proteinGrams: 40,
    carbsGrams: 60,
    fatGrams: 20,
    meals: [
      {
        mealNumber: 1,
        targetCalories: 600,
        targetProteinGrams: 40,
        targetCarbsGrams: 60,
        targetFatGrams: 20,
        options: [
          { optionNumber: 1, foods: [], optionCalories: 900, optionProteinGrams: 70, optionCarbsGrams: 90, optionFatGrams: 40 },
          { optionNumber: 2, foods: [], optionCalories: 605, optionProteinGrams: 41, optionCarbsGrams: 61, optionFatGrams: 20 },
          { optionNumber: 3, foods: [], optionCalories: 300, optionProteinGrams: 15, optionCarbsGrams: 30, optionFatGrams: 8 }
        ]
      }
    ]
  };

  applyBestFittingOptions(plan);
  assert.equal(plan.meals[0].options[0].optionCalories, 605, "closest-fitting option must be shown first");
  assert.equal(plan.meals[0].options[0].optionNumber, 1, "display numbering must follow the new order");
  assert.equal(plan.meals[0].options.length, 3, "no option may be dropped");
});

test("reordering options never changes any ingredient or invents a number", () => {
  const plan = {
    dailyCalories: 600,
    proteinGrams: 40,
    carbsGrams: 60,
    fatGrams: 20,
    meals: [
      {
        mealNumber: 1,
        targetCalories: 600,
        targetProteinGrams: 40,
        targetCarbsGrams: 60,
        targetFatGrams: 20,
        options: [
          { optionNumber: 1, foods: [{ name: "A", calories: 900, proteinGrams: 70, carbsGrams: 90, fatGrams: 40 }], optionCalories: 900, optionProteinGrams: 70, optionCarbsGrams: 90, optionFatGrams: 40 },
          { optionNumber: 2, foods: [{ name: "B", calories: 605, proteinGrams: 41, carbsGrams: 61, fatGrams: 20 }], optionCalories: 605, optionProteinGrams: 41, optionCarbsGrams: 61, optionFatGrams: 20 }
        ]
      }
    ]
  };

  applyBestFittingOptions(plan);
  const check = verifyDisplayedArithmetic(attachActualTotals(plan), null);
  assert.equal(check.exact, true, check.mismatches.join("; "));
  const names = plan.meals[0].options.map(o => o.foods[0].name).sort();
  assert.deepEqual(names, ["A", "B"], "both options must survive with their ingredients intact");
});

test("option selection is deterministic for identical input", () => {
  const build = () => reportedPlanFixture();
  const first = attachActualTotals(applyBestFittingOptions(build()));
  const second = attachActualTotals(applyBestFittingOptions(build()));
  assert.deepEqual(first.actualTotals, second.actualTotals);
});

// ------------------------------------------------------------- frontend tie

test("the summary renders the visible plan total, not the raw target", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "js", "nutrition-builder.js"), "utf8");
  assert.match(source, /sumVisibleMealTotals/, "the header must be computed from the visible meal options");
  assert.match(source, /data-total="calories"/, "totals need a stable hook so they can be refreshed");
  assert.match(
    source,
    /refreshVisibleTotals/,
    "switching a meal option must recompute the plan total"
  );
});

test("release tolerances are defined and strict enough to catch the reported plan", () => {
  assert.ok(PLAN_TOLERANCES.caloriesPercent <= 1.5);
  assert.ok(PLAN_TOLERANCES.proteinGrams <= 5);
  assert.ok(PLAN_TOLERANCES.carbsGrams <= 5);
  assert.ok(PLAN_TOLERANCES.fatGrams <= 3);
});
