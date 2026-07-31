// Deterministic nutrition totals: targets vs. what is actually on the plate.
//
// Reported release bug: a generated plan showed a 2350 kcal / 150P / 291C /
// 65F summary while its four visible meals added up to 2352 / 178 / 255 / 72.
// Nothing was miscalculated -- the two numbers are different quantities.
// plan.dailyCalories & co. are the TARGETS derived from the user's profile,
// while each meal option's optionCalories & co. are the ACTUAL macros of the
// catalog ingredients at their snapped serving sizes. Rendering the target
// under a heading that reads as a plan total made them look like a broken sum.
//
// This module computes the actual totals from the selected meal options so
// the header can show a number that is, by construction, the exact arithmetic
// sum of the visible meal cards -- and separately reports how far that lands
// from the target.

// Release tolerances for how far an assembled plan may sit from its target.
const PLAN_TOLERANCES = {
  caloriesPercent: 1.5,
  proteinGrams: 5,
  carbsGrams: 5,
  fatGrams: 3
};

const MACRO_FIELDS = [
  ["calories", "optionCalories"],
  ["proteinGrams", "optionProteinGrams"],
  ["carbsGrams", "optionCarbsGrams"],
  ["fatGrams", "optionFatGrams"]
];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Picks the option object a meal is currently displaying. `selection` maps
 * mealNumber -> option index; anything missing defaults to the first option,
 * which is what the UI shows before the user scrolls.
 */
function selectedOptionFor(meal, selection) {
  const options = Array.isArray(meal?.options) ? meal.options : [];
  if (!options.length) return null;
  const index = selection instanceof Map ? selection.get(meal.mealNumber) : selection?.[meal.mealNumber];
  const safeIndex = Number.isInteger(index) && index >= 0 && index < options.length ? index : 0;
  return options[safeIndex];
}

/**
 * Sums the currently displayed option of every meal. These values are already
 * per-meal integers (lib/meal-catalog.js rounds each ingredient and sums the
 * rounded values), so summing them is exact integer arithmetic -- the header
 * can never disagree with the cards by a rounding step.
 */
function sumSelectedOptions(meals, selection) {
  const totals = { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 };
  for (const meal of Array.isArray(meals) ? meals : []) {
    const option = selectedOptionFor(meal, selection);
    if (!option) continue;
    for (const [totalKey, optionKey] of MACRO_FIELDS) {
      totals[totalKey] += toNumber(option[optionKey]);
    }
  }
  return totals;
}

/** The target macros the plan was built to hit. */
function planTargets(plan) {
  return {
    calories: toNumber(plan?.dailyCalories),
    proteinGrams: toNumber(plan?.proteinGrams),
    carbsGrams: toNumber(plan?.carbsGrams),
    fatGrams: toNumber(plan?.fatGrams)
  };
}

/**
 * Compares actual totals against the targets and reports whether the plan is
 * inside release tolerance. Never mutates the plan and never "fixes" a
 * mismatch by editing the displayed summary.
 */
function evaluatePlanTotals(plan, selection) {
  const targets = planTargets(plan);
  const actual = sumSelectedOptions(plan?.meals, selection);

  const calorieDeviation = actual.calories - targets.calories;
  const caloriePercent = targets.calories
    ? Math.abs(calorieDeviation) / targets.calories * 100
    : 0;

  const deviations = {
    calories: calorieDeviation,
    caloriePercent: Math.round(caloriePercent * 100) / 100,
    proteinGrams: actual.proteinGrams - targets.proteinGrams,
    carbsGrams: actual.carbsGrams - targets.carbsGrams,
    fatGrams: actual.fatGrams - targets.fatGrams
  };

  const failures = [];
  if (caloriePercent > PLAN_TOLERANCES.caloriesPercent) {
    failures.push(
      `calories off target by ${deviations.calories} kcal (${deviations.caloriePercent}%, limit ${PLAN_TOLERANCES.caloriesPercent}%)`
    );
  }
  if (Math.abs(deviations.proteinGrams) > PLAN_TOLERANCES.proteinGrams) {
    failures.push(`protein off target by ${deviations.proteinGrams}g (limit ${PLAN_TOLERANCES.proteinGrams}g)`);
  }
  if (Math.abs(deviations.carbsGrams) > PLAN_TOLERANCES.carbsGrams) {
    failures.push(`carbs off target by ${deviations.carbsGrams}g (limit ${PLAN_TOLERANCES.carbsGrams}g)`);
  }
  if (Math.abs(deviations.fatGrams) > PLAN_TOLERANCES.fatGrams) {
    failures.push(`fat off target by ${deviations.fatGrams}g (limit ${PLAN_TOLERANCES.fatGrams}g)`);
  }

  return { targets, actual, deviations, failures, withinTolerance: failures.length === 0 };
}

/**
 * Verifies the displayed arithmetic itself: every meal option's headline
 * numbers must equal the sum of its own ingredient rows, and the plan total
 * must equal the sum of the selected options. This is the check that must
 * never fail -- a user can add the visible numbers up by hand.
 */
function verifyDisplayedArithmetic(plan, selection) {
  const mismatches = [];

  for (const meal of Array.isArray(plan?.meals) ? plan.meals : []) {
    for (const option of Array.isArray(meal.options) ? meal.options : []) {
      const rows = Array.isArray(option.foods) ? option.foods : [];
      const rowSums = rows.reduce(
        (totals, food) => ({
          calories: totals.calories + toNumber(food.calories),
          proteinGrams: totals.proteinGrams + toNumber(food.proteinGrams),
          carbsGrams: totals.carbsGrams + toNumber(food.carbsGrams),
          fatGrams: totals.fatGrams + toNumber(food.fatGrams)
        }),
        { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
      );
      for (const [totalKey, optionKey] of MACRO_FIELDS) {
        if (rowSums[totalKey] !== toNumber(option[optionKey])) {
          mismatches.push(
            `meal ${meal.mealNumber} option ${option.optionNumber}: ${optionKey} is ${option[optionKey]} but its ingredients sum to ${rowSums[totalKey]}`
          );
        }
      }
    }
  }

  const actual = sumSelectedOptions(plan?.meals, selection);
  const reported = plan?.actualTotals;
  if (reported) {
    for (const key of ["calories", "proteinGrams", "carbsGrams", "fatGrams"]) {
      if (toNumber(reported[key]) !== actual[key]) {
        mismatches.push(`plan.actualTotals.${key} is ${reported[key]} but the selected meals sum to ${actual[key]}`);
      }
    }
  }

  return { exact: mismatches.length === 0, mismatches };
}

/**
 * Deterministically chooses, for each meal, the option that brings the whole
 * plan closest to its calorie and macro targets. Options are already scaled
 * to their slot; this only decides which of the three the plan opens on, so
 * it changes no ingredient amount and invents no numbers. Ties resolve to the
 * lower option index so the result is stable for identical input.
 */
function chooseBestFittingOptions(plan) {
  const meals = Array.isArray(plan?.meals) ? plan.meals : [];
  const targets = planTargets(plan);
  const selection = new Map();

  // Greedy per meal against that meal's own share of the target, which is
  // deterministic and avoids an exponential search across option combinations.
  for (const meal of meals) {
    const options = Array.isArray(meal.options) ? meal.options : [];
    if (options.length < 2) {
      selection.set(meal.mealNumber, 0);
      continue;
    }
    const mealTarget = {
      calories: toNumber(meal.targetCalories),
      proteinGrams: toNumber(meal.targetProteinGrams),
      carbsGrams: toNumber(meal.targetCarbsGrams),
      fatGrams: toNumber(meal.targetFatGrams)
    };

    let bestIndex = 0;
    let bestCost = Number.POSITIVE_INFINITY;
    options.forEach((option, index) => {
      // Calories dominate; macros are weighted so a big protein miss still
      // matters. Scaled to comparable units rather than raw gram counts.
      const calorieMiss = Math.abs(toNumber(option.optionCalories) - mealTarget.calories) / Math.max(1, mealTarget.calories);
      const proteinMiss = Math.abs(toNumber(option.optionProteinGrams) - mealTarget.proteinGrams) / Math.max(1, mealTarget.proteinGrams);
      const carbsMiss = Math.abs(toNumber(option.optionCarbsGrams) - mealTarget.carbsGrams) / Math.max(1, mealTarget.carbsGrams);
      const fatMiss = Math.abs(toNumber(option.optionFatGrams) - mealTarget.fatGrams) / Math.max(1, mealTarget.fatGrams);
      const cost = calorieMiss * 3 + proteinMiss * 2 + carbsMiss + fatMiss;
      if (cost < bestCost - 1e-9) {
        bestCost = cost;
        bestIndex = index;
      }
    });
    selection.set(meal.mealNumber, bestIndex);
  }

  return selection;
}

/**
 * Reorders each meal's options so the best-fitting one is first, then stamps
 * the plan with the actual totals of that opening selection. The UI opens on
 * option 1, so this makes the plan the user first sees the closest one to
 * their target while leaving every option available.
 */
function applyBestFittingOptions(plan) {
  const selection = chooseBestFittingOptions(plan);
  for (const meal of Array.isArray(plan?.meals) ? plan.meals : []) {
    const index = selection.get(meal.mealNumber) || 0;
    if (!index || !Array.isArray(meal.options) || index >= meal.options.length) continue;
    const [chosen] = meal.options.splice(index, 1);
    meal.options.unshift(chosen);
    // optionNumber is a display label; keep it matching the new order.
    meal.options.forEach((option, position) => {
      option.optionNumber = position + 1;
    });
  }
  return plan;
}

/** Stamps plan.actualTotals from the currently-first option of each meal. */
function attachActualTotals(plan) {
  plan.actualTotals = sumSelectedOptions(plan?.meals, null);
  return plan;
}

module.exports = {
  PLAN_TOLERANCES,
  applyBestFittingOptions,
  attachActualTotals,
  chooseBestFittingOptions,
  evaluatePlanTotals,
  planTargets,
  selectedOptionFor,
  sumSelectedOptions,
  verifyDisplayedArithmetic
};
