// Deterministic portion-level macro balancing.
//
// buildMealOption scales a whole meal uniformly toward its calorie target.
// Uniform scaling cannot change a meal's macro RATIO, so a plan could land
// within 0.4% on calories while sitting +48 g protein, -62 g carbs and +12 g
// fat -- every number correct, the split wrong. Hitting macro targets requires
// moving individual ingredients against each other: more rice, less chicken.
//
// This module does that with a greedy coordinate descent over ingredient
// grams. Every candidate move is a real serving change evaluated with the
// catalog's own arithmetic, so the resulting rows, meal totals and daily
// totals stay internally exact -- nothing is adjusted for display only.
//
// Constraints come from lib/nutrition-portion-constraints.js, which is what
// prevents "solutions" like 3 g of chicken or 100 g of olive oil.

const { FOODS, macrosFor, snapAmount, formatAmount } = require("./meal-catalog");
const { absurdBoundsFor, boundsFor, categoryFor } = require("./nutrition-portion-constraints");
const { PLAN_TOLERANCES } = require("./nutrition-totals");

// Priority order from the release spec: calories first, then protein, then
// fat, then carbohydrates. Each error term is divided by its own tolerance so
// the numbers are comparable, then weighted so a tie breaks toward the
// higher-priority macro.
const PRIORITY_WEIGHTS = { calories: 4, proteinGrams: 3, fatGrams: 2, carbsGrams: 1 };

const MAX_PASSES = 400;

// How far an ingredient may drift from the amount the recipe called for.
// Category bounds alone keep a value physically sane but not RECIPE-sane: they
// happily cut the chicken in "Grilled Chicken, Rice & Broccoli" to its 60 g
// floor while pushing rice to 350 g, which is arithmetically valid and not the
// dish any more. Holding every row near its authored proportion keeps the meal
// recognisable while still leaving room to shift the macro split.
const RECIPE_SCALE_MIN = 0.55;
const RECIPE_SCALE_MAX = 1.75;

// Weight on keeping each meal near its own calorie slot. Without this the
// optimizer only sees the daily total and is free to build a 1080 kcal
// breakfast next to a 494 kcal dinner.
const MEAL_BALANCE_WEIGHT = 2.5;

// A meal may sit this far from its slot target before it starts costing.
const MEAL_CALORIE_TOLERANCE_PERCENT = 12;

function toleranceFor(targets) {
  return {
    calories: Math.max(1, (targets.calories * PLAN_TOLERANCES.caloriesPercent) / 100),
    proteinGrams: PLAN_TOLERANCES.proteinGrams,
    carbsGrams: PLAN_TOLERANCES.carbsGrams,
    fatGrams: PLAN_TOLERANCES.fatGrams
  };
}

/**
 * Normalized, priority-weighted distance from target. Deviation inside a
 * tolerance still contributes, but at heavily reduced weight, so the optimizer
 * keeps tightening a passing macro only when it costs nothing elsewhere.
 */
function planError(totals, targets, tol) {
  let error = 0;
  for (const key of ["calories", "proteinGrams", "fatGrams", "carbsGrams"]) {
    const delta = Math.abs(totals[key] - targets[key]);
    const scaled = delta / tol[key];
    // Out-of-tolerance error is amplified so clearing a failing macro always
    // beats polishing a passing one. Inside tolerance the term is damped but
    // not switched off: at a near-zero weight the optimizer stopped the moment
    // it crossed the line and left every macro sitting exactly ON its limit,
    // which passes today and fails on any later change.
    const overTolerance = scaled > 1;
    error += PRIORITY_WEIGHTS[key] * (overTolerance ? 4 * scaled : scaled * 0.4);
  }
  return error;
}

/**
 * Penalty for meals drifting away from their own calorie slot. The daily total
 * can be perfect while the day is shaped absurdly, so meal balance is part of
 * the objective rather than a post-hoc check.
 */
function mealBalanceError(rows) {
  const perMeal = new Map();
  for (const row of rows) {
    const macros = macrosFor(row.key, row.grams);
    const current = perMeal.get(row.meal) || 0;
    perMeal.set(row.meal, current + Math.round(macros.calories));
  }
  let error = 0;
  for (const [meal, calories] of perMeal) {
    const target = Number(meal.targetCalories) || 0;
    if (!target) continue;
    const allowed = (target * MEAL_CALORIE_TOLERANCE_PERCENT) / 100;
    const drift = Math.abs(calories - target);
    if (drift > allowed) error += (drift - allowed) / Math.max(1, allowed);
  }
  return error * MEAL_BALANCE_WEIGHT;
}

/** Total objective: hit the daily targets without deforming the day. */
function objective(rows, targets, tol) {
  return planError(totalsOf(rows), targets, tol) + mealBalanceError(rows);
}

/** Sums the plan from the currently-selected option of every meal. */
function totalsOf(rows) {
  const totals = { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 };
  for (const row of rows) {
    const macros = macrosFor(row.key, row.grams);
    totals.calories += Math.round(macros.calories);
    totals.proteinGrams += Math.round(macros.proteinGrams);
    totals.carbsGrams += Math.round(macros.carbsGrams);
    totals.fatGrams += Math.round(macros.fatGrams);
  }
  return totals;
}

/**
 * Collects every adjustable ingredient row across the plan's visible options,
 * with its bounds. `optionIndexFor` picks which option of each meal is live.
 */
function collectRows(plan, optionIndexFor) {
  const rows = [];
  for (const meal of plan.meals || []) {
    const options = Array.isArray(meal.options) ? meal.options : [];
    if (!options.length) continue;
    const index = optionIndexFor ? optionIndexFor(meal) : 0;
    const option = options[Math.min(index, options.length - 1)];
    for (const food of option.foods || []) {
      const key = food.catalogKey;
      const definition = key ? FOODS[key] : null;
      if (!key || !definition) continue;
      const categoryBounds = boundsFor(key, definition);
      const baseGrams = Number(food.grams) || 0;
      // Intersect the category range with the recipe-relative range so a row
      // stays both a realistic serving AND recognisably this dish.
      const bounds = {
        ...categoryBounds,
        min: Math.max(categoryBounds.min, Math.floor(baseGrams * RECIPE_SCALE_MIN)),
        max: Math.min(categoryBounds.max, Math.ceil(baseGrams * RECIPE_SCALE_MAX))
      };
      // A base amount already outside its category range (or a very small
      // garnish) must not be widened by the relative rule.
      if (bounds.min > bounds.max) {
        bounds.min = Math.min(categoryBounds.min, baseGrams);
        bounds.max = Math.max(categoryBounds.max, baseGrams);
      }
      rows.push({
        meal,
        option,
        food,
        key,
        definition,
        bounds,
        baseGrams,
        grams: baseGrams
      });
    }
  }
  return rows;
}

/** Writes an adjusted gram amount back onto a row, rebuilding its display. */
function applyGrams(row, grams, isHebrew) {
  // Snap on the way out as well as when generating candidates. Any amount
  // that reaches a plan must be measurable -- a piece food has to land on a
  // whole piece, so nobody is asked to eat 285 g of a 50 g egg.
  const snapped = snapAmount(row.key, grams);
  const macros = macrosFor(row.key, snapped);
  row.grams = snapped;
  row.food.grams = snapped;
  row.food.amount = formatAmount(row.key, snapped, isHebrew);
  row.food.calories = Math.round(macros.calories);
  row.food.proteinGrams = Math.round(macros.proteinGrams);
  row.food.carbsGrams = Math.round(macros.carbsGrams);
  row.food.fatGrams = Math.round(macros.fatGrams);
}

/** Recomputes each visible option's headline from its own ingredient rows. */
function recomputeOptionTotals(rows) {
  const touched = new Set(rows.map(r => r.option));
  for (const option of touched) {
    const foods = option.foods || [];
    const sum = key => foods.reduce((total, food) => total + (Number(food[key]) || 0), 0);
    option.optionCalories = sum("calories");
    option.optionProteinGrams = sum("proteinGrams");
    option.optionCarbsGrams = sum("carbsGrams");
    option.optionFatGrams = sum("fatGrams");
  }
}

/**
 * Candidate gram values for one row: snapped, inside bounds, and reachable in
 * a few steps of its natural granularity. Larger multiples first lets the
 * optimizer close a big gap quickly before fine-tuning.
 */
function candidateGramsFor(row) {
  const { bounds } = row;
  const out = [];
  for (const multiple of [8, 4, 2, 1]) {
    for (const direction of [1, -1]) {
      const raw = row.grams + direction * multiple * bounds.step;
      const snapped = snapAmount(row.key, raw);
      if (snapped < bounds.min || snapped > bounds.max) continue;
      if (snapped === row.grams) continue;
      if (!out.includes(snapped)) out.push(snapped);
    }
  }
  return out;
}

/**
 * Greedy coordinate descent: repeatedly apply the single ingredient change
 * that most reduces the weighted distance to target, until nothing helps or
 * the plan is comfortably inside tolerance.
 *
 * Deterministic by construction -- rows are visited in a fixed order and ties
 * resolve to the earlier row and the smaller change, so identical input always
 * produces an identical plan.
 */
function balancePortions(plan, targets, { isHebrew = false, optionIndexFor = null } = {}) {
  const rows = collectRows(plan, optionIndexFor);
  const adjustable = rows.filter(row => row.bounds.lever > 0);
  const tol = toleranceFor(targets);

  const startTotals = totalsOf(rows);
  let currentError = objective(rows, targets, tol);
  let passes = 0;

  while (passes < MAX_PASSES) {
    passes += 1;
    let best = null;

    for (const row of adjustable) {
      const originalGrams = row.grams;
      for (const grams of candidateGramsFor(row)) {
        row.grams = grams;
        const error = objective(rows, targets, tol);
        // A lever weight below 1 makes an inappropriate food (vegetables,
        // sauces) look less attractive than a staple for the same benefit.
        const improvement = (currentError - error) * row.bounds.lever;
        if (improvement > 1e-9 && (!best || improvement > best.improvement)) {
          best = { row, grams, error, improvement };
        }
      }
      row.grams = originalGrams;
    }

    if (!best) break;
    best.row.grams = best.grams;
    currentError = best.error;
  }

  // Commit: rebuild every row's macros and display amount from its final
  // grams, then rebuild each option headline from those rows.
  for (const row of rows) applyGrams(row, row.grams, isHebrew);
  recomputeOptionTotals(rows);

  const finalTotals = totalsOf(rows);
  return {
    passes,
    adjustedRows: rows.length,
    startTotals,
    finalTotals,
    withinTolerance:
      Math.abs(finalTotals.calories - targets.calories) <= tol.calories &&
      Math.abs(finalTotals.proteinGrams - targets.proteinGrams) <= tol.proteinGrams &&
      Math.abs(finalTotals.carbsGrams - targets.carbsGrams) <= tol.carbsGrams &&
      Math.abs(finalTotals.fatGrams - targets.fatGrams) <= tol.fatGrams
  };
}

/** Every ingredient row sits inside its category's serving bounds. */
function findImplausibleServings(plan) {
  const problems = [];
  for (const meal of plan.meals || []) {
    for (const option of meal.options || []) {
      for (const food of option.foods || []) {
        const key = food.catalogKey;
        const definition = key ? FOODS[key] : null;
        if (!definition) continue;
        const bounds = absurdBoundsFor(key, definition);
        const grams = Number(food.grams) || 0;
        if (grams <= 0) {
          problems.push(`${key} in meal ${meal.mealNumber} has a non-positive amount (${grams}g)`);
        } else if (grams < bounds.min || grams > bounds.max) {
          problems.push(
            `${key} in meal ${meal.mealNumber} is ${grams}g, outside the ${bounds.category} range ${bounds.min}-${bounds.max}g`
          );
        }
        if (definition.piece?.g && grams % definition.piece.g !== 0) {
          problems.push(`${key} in meal ${meal.mealNumber} is ${grams}g, not a whole ${definition.piece.g}g piece`);
        }
      }
    }
  }
  return problems;
}

/**
 * Snapshots the gram amounts of every option in the plan so a rejected
 * candidate selection can be restored exactly.
 */
function snapshotGrams(plan) {
  // Keyed by the option OBJECT, not its index: the option search reorders
  // meal.options, so an index-keyed snapshot restored grams onto the wrong
  // option and produced amounts like 285 g of a 50 g egg.
  const snapshot = new Map();
  for (const meal of plan.meals || []) {
    for (const option of meal.options || []) {
      snapshot.set(option, (option.foods || []).map(food => Number(food.grams) || 0));
    }
  }
  return snapshot;
}

function restoreGrams(plan, snapshot, isHebrew) {
  for (const meal of plan.meals || []) {
    for (const option of meal.options || []) {
      const saved = snapshot.get(option);
      if (!saved) continue;
      (option.foods || []).forEach((food, foodIndex) => {
        const raw = saved[foodIndex];
        if (typeof raw !== "number") return;
        const grams = snapAmount(food.catalogKey, raw);
        const macros = macrosFor(food.catalogKey, grams);
        food.grams = grams;
        food.amount = formatAmount(food.catalogKey, grams, isHebrew);
        food.calories = Math.round(macros.calories);
        food.proteinGrams = Math.round(macros.proteinGrams);
        food.carbsGrams = Math.round(macros.carbsGrams);
        food.fatGrams = Math.round(macros.fatGrams);
      });
      const sum = key => (option.foods || []).reduce((t, f) => t + (Number(f[key]) || 0), 0);
      option.optionCalories = sum("calories");
      option.optionProteinGrams = sum("proteinGrams");
      option.optionCarbsGrams = sum("carbsGrams");
      option.optionFatGrams = sum("fatGrams");
    }
  }
}

/**
 * Balances the plan, and when the current option selection cannot reach the
 * targets inside safe serving ranges, tries other options before giving up.
 *
 * Some meal combinations genuinely cannot hit a target: four high-protein
 * plant meals will not absorb another 90 g of carbohydrate without turning
 * into portions nobody would serve. Rather than accept an invalid plan or
 * loosen the tolerances, the search swaps in a different compatible option
 * for one meal at a time and rebalances.
 *
 * The search is a deterministic greedy sweep -- meals in order, options in
 * order, first strictly-better result kept -- so identical input always yields
 * an identical plan.
 */
function balancePlanWithOptionSearch(plan, targets, { isHebrew = false } = {}) {
  const attempts = [];
  const baseline = snapshotGrams(plan);

  const evaluate = () => {
    restoreGrams(plan, baseline, isHebrew);
    const result = balancePortions(plan, targets, { isHebrew });
    const problems = findImplausibleServings(plan);
    return { ...result, problems, ok: result.withinTolerance && problems.length === 0 };
  };

  let best = evaluate();
  attempts.push({ selection: "as-selected", ok: best.ok });
  if (best.ok) return { ...best, attempts, optionSearchUsed: false };

  // Try each meal's alternative options in turn, keeping any swap that helps.
  const meals = plan.meals || [];
  for (let mealIndex = 0; mealIndex < meals.length; mealIndex++) {
    const meal = meals[mealIndex];
    const options = Array.isArray(meal.options) ? meal.options : [];
    if (options.length < 2) continue;

    for (let optionIndex = 1; optionIndex < options.length; optionIndex++) {
      // Promote this option to first: the plan always opens on option 1, and
      // the balancer adjusts whichever option is live.
      const reordered = options.slice();
      const [candidate] = reordered.splice(optionIndex, 1);
      reordered.unshift(candidate);
      const previous = meal.options;
      meal.options = reordered;

      const trial = evaluate();
      attempts.push({ selection: `meal ${meal.mealNumber} option ${optionIndex + 1}`, ok: trial.ok });

      if (trial.ok) {
        meal.options.forEach((option, position) => {
          option.optionNumber = position + 1;
        });
        return { ...trial, attempts, optionSearchUsed: true };
      }
      // Keep the swap only if it strictly reduced the shortfall.
      const trialMiss = shortfall(trial.finalTotals, targets);
      const bestMiss = shortfall(best.finalTotals, targets);
      if (trialMiss < bestMiss - 1e-9) {
        best = trial;
        meal.options.forEach((option, position) => {
          option.optionNumber = position + 1;
        });
      } else {
        meal.options = previous;
      }
    }
  }

  // Nothing reached tolerance; re-apply the closest selection found so the
  // caller still gets the best available plan alongside an honest verdict.
  const finalResult = evaluate();
  return { ...finalResult, attempts, optionSearchUsed: true };
}

// Bounds on the cross-meal search. These keep it deterministic and cheap: at
// most this many replacement meals are considered per slot, and at most this
// many balance runs happen overall, so a hard request cannot spiral into a
// combinatorial search.
const MAX_REPLACEMENT_CANDIDATES_PER_SLOT = 8;
const MAX_SEARCH_EVALUATIONS = 60;

/**
 * Which macro the plan is currently missing, and by how much (signed, in
 * grams/kcal). Used to rank replacement meals by how well they would close
 * the gap rather than trying them arbitrarily.
 */
function macroGap(totals, targets) {
  return {
    calories: targets.calories - totals.calories,
    proteinGrams: targets.proteinGrams - totals.proteinGrams,
    carbsGrams: targets.carbsGrams - totals.carbsGrams,
    fatGrams: targets.fatGrams - totals.fatGrams
  };
}

/**
 * Ranks candidate meals for a slot by how much swapping them in would move the
 * plan toward the outstanding gap. Purely arithmetic on the candidate's base
 * macros -- cheap enough to score the whole pool before committing to a few
 * expensive balance runs.
 */
function rankCandidates(candidates, outgoing, gap, targets) {
  const tol = toleranceFor(targets);
  return candidates
    .map(meal => {
      const delta = {
        calories: (meal.baseCalories || 0) - (outgoing.baseCalories || 0),
        proteinGrams: (meal.baseProtein || 0) - (outgoing.baseProtein || 0),
        carbsGrams: (meal.baseCarbs || 0) - (outgoing.baseCarbs || 0),
        fatGrams: (meal.baseFat || 0) - (outgoing.baseFat || 0)
      };
      // Reward movement in the direction of the gap, scaled by tolerance so
      // macros are comparable.
      let score = 0;
      for (const key of ["calories", "proteinGrams", "carbsGrams", "fatGrams"]) {
        const need = gap[key] / tol[key];
        const move = delta[key] / tol[key];
        score += Math.sign(need) === Math.sign(move) ? Math.min(Math.abs(need), Math.abs(move)) : -Math.abs(move) * 0.25;
      }
      return { meal, score };
    })
    // Deterministic: score first, then meal id, so equal scores never reorder.
    .sort((a, b) => b.score - a.score || (a.meal.id < b.meal.id ? -1 : 1))
    .map(entry => entry.meal);
}

/**
 * Full recovery search: portion balancing first, then different options of the
 * same meal, then genuinely different meals from the eligible pool.
 *
 * The pool is supplied by the caller via `candidatesForSlot(slot)` and is
 * already filtered for diet, allergens, excluded foods and pending-image
 * meals, so a replacement can never violate the user's restrictions.
 *
 * Bounded and deterministic: candidates are ranked by predicted macro
 * contribution, only the top few per slot are tried, one meal is replaced at a
 * time, and the whole search stops at MAX_SEARCH_EVALUATIONS balance runs or
 * the moment every tolerance passes.
 */
function balancePlanWithMealSearch(plan, targets, options = {}) {
  const {
    isHebrew = false,
    candidatesForSlot = null,
    buildOption = null,
    maxCandidatesPerSlot = MAX_REPLACEMENT_CANDIDATES_PER_SLOT,
    maxEvaluations = MAX_SEARCH_EVALUATIONS
  } = options;

  let evaluations = 0;
  const trace = [];

  const first = balancePlanWithOptionSearch(plan, targets, { isHebrew });
  evaluations += first.attempts.length;
  trace.push({ stage: "option-search", ok: first.ok });
  if (first.ok || !candidatesForSlot || !buildOption) {
    return { ...first, evaluations, trace, mealSearchUsed: false };
  }

  let best = first;

  // Replace one meal at a time, worst offender first.
  const mealsByContribution = [...(plan.meals || [])].sort((a, b) => {
    const aCal = a.options?.[0]?.optionCalories || 0;
    const bCal = b.options?.[0]?.optionCalories || 0;
    const aMiss = Math.abs(aCal - (a.targetCalories || 0));
    const bMiss = Math.abs(bCal - (b.targetCalories || 0));
    return bMiss - aMiss || a.mealNumber - b.mealNumber;
  });

  for (const meal of mealsByContribution) {
    if (evaluations >= maxEvaluations) break;

    const currentIds = new Set(
      (plan.meals || []).flatMap(m => (m.options || []).map(o => o.mealId))
    );
    const outgoing = meal.options?.[0];
    if (!outgoing) continue;

    const pool = (candidatesForSlot(meal) || []).filter(candidate => !currentIds.has(candidate.id));
    if (!pool.length) continue;

    const gap = macroGap(best.finalTotals, targets);
    const ranked = rankCandidates(pool, outgoing, gap, targets).slice(0, maxCandidatesPerSlot);
    const savedOptions = meal.options;

    for (const candidate of ranked) {
      if (evaluations >= maxEvaluations) break;
      const rebuilt = buildOption(candidate.id, meal);
      if (!rebuilt) continue;

      meal.options = [rebuilt, ...savedOptions.slice(1)];
      const trial = balancePlanWithOptionSearch(plan, targets, { isHebrew });
      evaluations += trial.attempts.length;
      trace.push({ stage: "meal-swap", meal: meal.mealNumber, candidate: candidate.id, ok: trial.ok });

      if (trial.ok) {
        meal.options.forEach((option, position) => {
          option.optionNumber = position + 1;
        });
        return { ...trial, evaluations, trace, mealSearchUsed: true };
      }
      if (shortfall(trial.finalTotals, targets) < shortfall(best.finalTotals, targets) - 1e-9) {
        best = trial;
      } else {
        meal.options = savedOptions;
      }
    }
  }

  // Nothing reached tolerance. Re-run once so the plan on disk matches the
  // best selection found, and report the failure honestly.
  const finalPass = balancePlanWithOptionSearch(plan, targets, { isHebrew });
  return { ...finalPass, evaluations, trace, mealSearchUsed: true };
}

/**
 * Marks each alternative option with whether selecting it would keep the whole
 * plan inside tolerance, and rebalances the ones that can be saved.
 *
 * Only the opening option of each meal is balanced against the targets, so the
 * alternatives are still at their unbalanced amounts. A user switching to one
 * would silently move the plan out of tolerance -- the totals would still add
 * up, but they would no longer meet the plan the user asked for. Each
 * alternative is therefore balanced in place (with the other meals held at
 * their chosen options) and flagged.
 *
 * The flag is advisory data for the UI: an option that cannot be made valid is
 * marked so the client can keep the user out of an invalid plan.
 */
function markSelectableOptions(plan, targets, { isHebrew = false } = {}) {
  const meals = plan.meals || [];
  const summary = { checked: 0, valid: 0, invalid: 0 };

  for (const meal of meals) {
    const options = Array.isArray(meal.options) ? meal.options : [];
    // Keep the already-balanced opening plan intact while checking
    // alternatives. balancePortions() adjusts every selected option, so a
    // failed alternative check must not leave the opening option one snapped
    // gram away from the plan that was just validated.
    const openingSnapshot = snapshotGrams(plan);
    const alternativeSnapshots = new Map();
    // The opening option is the balanced one the plan was validated on.
    if (options[0]) {
      options[0].keepsPlanValid = true;
      summary.checked += 1;
      summary.valid += 1;
    }

    for (let index = 1; index < options.length; index++) {
      summary.checked += 1;
      const candidate = options[index];
      // Balance this alternative while every other meal stays on its option 0.
      restoreGrams(plan, openingSnapshot, isHebrew);
      const result = balancePortions(plan, targets, {
        isHebrew,
        optionIndexFor: m => (m === meal ? index : 0)
      });
      const candidateSnapshot = new Map([
        [candidate, (candidate.foods || []).map(food => Number(food.grams) || 0)]
      ]);
      const problems = findImplausibleServings(plan);
      const ok = result.withinTolerance && problems.length === 0;
      candidate.keepsPlanValid = ok;
      alternativeSnapshots.set(candidate, candidateSnapshot);
      if (ok) summary.valid += 1;
      else summary.invalid += 1;
    }

    // Restore every opening option exactly, then put each tested alternative
    // back in its own balanced state. Re-running the optimizer here is not
    // equivalent: it can choose a different snapped gram combination after
    // the alternative checks and change the final visible totals.
    restoreGrams(plan, openingSnapshot, isHebrew);
    for (const candidateSnapshot of alternativeSnapshots.values()) {
      restoreGrams(plan, candidateSnapshot, isHebrew);
    }
  }

  return summary;
}

/** How far outside tolerance a set of totals sits, in tolerance-units. */
function shortfall(totals, targets) {
  const tol = toleranceFor(targets);
  let miss = 0;
  for (const key of ["calories", "proteinGrams", "carbsGrams", "fatGrams"]) {
    const over = Math.abs(totals[key] - targets[key]) / tol[key];
    if (over > 1) miss += over - 1;
  }
  return miss;
}

module.exports = {
  MAX_REPLACEMENT_CANDIDATES_PER_SLOT,
  MAX_SEARCH_EVALUATIONS,
  PRIORITY_WEIGHTS,
  balancePlanWithMealSearch,
  balancePlanWithOptionSearch,
  balancePortions,
  categoryFor,
  findImplausibleServings,
  markSelectableOptions,
  planError,
  shortfall,
  toleranceFor,
  totalsOf
};
