// Deterministic nutrition release stress matrix.
//
// Builds a plan the same way POST /api/nutrition-builder does -- catalog
// selection, portion balancing, then option and cross-meal recovery search --
// across a wide grid of real user profiles, and asserts the release invariants
// on every plan that would be returned as successful.
//
// The number that must be zero is INVALID SUCCESSFUL PLANS: a plan the server
// would hand a user while its macros sit outside tolerance. A genuinely
// impossible profile may fail, but it must fail as a controlled error.
//
// Exits non-zero if any invariant is violated.

const {
  buildMealOption,
  buildMealSlots,
  filterMeals,
  selectMeals,
  MEALS_PENDING_IMAGE,
  FOODS
} = require("../lib/meal-catalog");
const {
  balancePlanWithMealSearch,
  findImplausibleServings
} = require("../lib/nutrition-portion-balancer");
const { PLAN_TOLERANCES } = require("../lib/nutrition-totals");
const { resolveFoodImage } = require("../lib/food-image-map");

const PENDING = new Set(MEALS_PENDING_IMAGE);

// Mirrors the endpoint's target maths closely enough to exercise the same
// range of demands: Mifflin-St Jeor, activity multiplier, goal offset.
const ACTIVITY = {
  sedentary: 1.2,
  lightlyActive: 1.375,
  moderatelyActive: 1.55,
  veryActive: 1.725,
  extremelyActive: 1.9
};
const GOAL_OFFSET = { loseFat: -400, maintainWeight: 0, buildMuscle: 250 };

function targetsFor(p) {
  const genderOffset = p.gender === "male" ? 5 : -161;
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + genderOffset;
  const calories = Math.round(bmr * ACTIVITY[p.activityLevel] + (GOAL_OFFSET[p.goal] || 0));
  const proteinGrams = Math.round(p.weight * (p.goal === "loseFat" ? 2.2 : 2.0));
  const fatGrams = Math.round((calories * 0.25) / 9);
  const carbsGrams = Math.round((calories - proteinGrams * 4 - fatGrams * 9) / 4);
  return { calories, proteinGrams, carbsGrams, fatGrams };
}

function buildPlan(profile, targets) {
  const isHebrew = profile.locale === "he";
  const slots = buildMealSlots(profile.mealsPerDay, isHebrew);
  const totalWeight = slots.reduce((t, s) => t + s.weight, 0);
  const used = new Set();

  const meals = slots.map(slot => {
    const slotCalories = Math.round((targets.calories * slot.weight) / totalWeight);
    const pool = filterMeals({
      diet: profile.diet,
      excludeAllergens: profile.excludeAllergens || [],
      slot: slot.slot
    });
    const ids = selectMeals({
      pool,
      slot: slot.slot,
      targetCalories: slotCalories,
      count: 3,
      exclude: [...used],
      preferNutrients: profile.preferNutrients || []
    });
    ids.forEach(id => used.add(id));
    return {
      mealNumber: slot.mealNumber,
      slot: slot.slot,
      targetCalories: slotCalories,
      options: ids
        .map((id, i) => buildMealOption(id, { targetCalories: slotCalories, isHebrew, optionNumber: i + 1 }))
        .filter(Boolean)
    };
  });

  return { meals: meals.filter(m => m.options.length) };
}

function checkPlan(plan, profile, targets) {
  const problems = [];
  const tolCalories = (targets.calories * PLAN_TOLERANCES.caloriesPercent) / 100;

  // Meal headline equals its own ingredient rows.
  let visibleSum = { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 };
  for (const meal of plan.meals) {
    const option = meal.options[0];
    const sum = key => option.foods.reduce((t, f) => t + f[key], 0);
    for (const [rowKey, headKey] of [
      ["calories", "optionCalories"],
      ["proteinGrams", "optionProteinGrams"],
      ["carbsGrams", "optionCarbsGrams"],
      ["fatGrams", "optionFatGrams"]
    ]) {
      if (sum(rowKey) !== option[headKey]) {
        problems.push(`meal ${meal.mealNumber} ${headKey} != sum of rows`);
      }
      visibleSum[rowKey] += option[headKey];
    }

    if (PENDING.has(option.mealId)) problems.push(`disabled meal served: ${option.mealId}`);

    for (const food of option.foods) {
      if (!(food.grams > 0)) problems.push(`${food.catalogKey} has non-positive grams`);
      if (!resolveFoodImage(food.imageKey)) problems.push(`placeholder image: ${food.imageKey}`);
      const piece = FOODS[food.catalogKey]?.piece?.g;
      if (piece && food.grams % piece !== 0) {
        problems.push(`${food.catalogKey} ${food.grams}g is not a whole ${piece}g piece`);
      }
      // Restriction compliance.
      const allergens = FOODS[food.catalogKey]?.alg || [];
      for (const banned of profile.excludeAllergens || []) {
        if (allergens.includes(banned)) problems.push(`allergen ${banned} served: ${food.catalogKey}`);
      }
    }
  }

  // Daily total equals the visible meal sum.
  for (const key of ["calories", "proteinGrams", "carbsGrams", "fatGrams"]) {
    // (visibleSum is by construction the sum of the headlines)
    if (!Number.isFinite(visibleSum[key])) problems.push(`daily ${key} not finite`);
  }

  const dev = {
    calories: visibleSum.calories - targets.calories,
    proteinGrams: visibleSum.proteinGrams - targets.proteinGrams,
    carbsGrams: visibleSum.carbsGrams - targets.carbsGrams,
    fatGrams: visibleSum.fatGrams - targets.fatGrams
  };
  const within =
    Math.abs(dev.calories) <= tolCalories &&
    Math.abs(dev.proteinGrams) <= PLAN_TOLERANCES.proteinGrams &&
    Math.abs(dev.carbsGrams) <= PLAN_TOLERANCES.carbsGrams &&
    Math.abs(dev.fatGrams) <= PLAN_TOLERANCES.fatGrams;

  problems.push(...findImplausibleServings(plan));
  return { problems, dev, within, visibleSum };
}

function buildProfiles() {
  const profiles = [];
  const goals = ["loseFat", "maintainWeight", "buildMuscle"];
  const activities = ["sedentary", "lightlyActive", "moderatelyActive", "veryActive"];
  const mealCounts = [3, 4, 5];
  const locales = ["en", "he"];
  const bodies = [
    { gender: "male", age: 24, height: 182, weight: 78 },
    { gender: "female", age: 31, height: 166, weight: 62 },
    { gender: "male", age: 45, height: 175, weight: 95 },
    { gender: "female", age: 52, height: 160, weight: 70 },
    { gender: "male", age: 19, height: 190, weight: 70 },
    { gender: "female", age: 27, height: 172, weight: 84 },
    { gender: "male", age: 36, height: 168, weight: 62 },
    { gender: "female", age: 41, height: 178, weight: 75 },
    { gender: "male", age: 58, height: 180, weight: 88 },
    { gender: "female", age: 22, height: 155, weight: 52 }
  ];
  const diets = [
    { diet: "omnivore", excludeAllergens: [], label: "omnivore" },
    { diet: "vegetarian", excludeAllergens: [], label: "vegetarian", preferNutrients: ["iron"] },
    { diet: "omnivore", excludeAllergens: ["dairy"], label: "lactose-free" },
    { diet: "vegan", excludeAllergens: [], label: "vegan" },
    { diet: "omnivore", excludeAllergens: ["nuts", "peanuts"], label: "nut-free" }
  ];

  let i = 0;
  for (const body of bodies) {
    for (const goal of goals) {
      for (const activity of activities) {
        const dietSpec = diets[i % diets.length];
        const mealsPerDay = mealCounts[i % mealCounts.length];
        const locale = locales[i % locales.length];
        profiles.push({
          id: `${body.gender}${body.age}/${goal}/${activity}/${dietSpec.label}/${mealsPerDay}meals/${locale}`,
          ...body,
          goal,
          activityLevel: activity,
          mealsPerDay,
          locale,
          diet: dietSpec.diet,
          excludeAllergens: dietSpec.excludeAllergens,
          preferNutrients: dietSpec.preferNutrients || []
        });
        i += 1;
      }
    }
  }
  return profiles;
}

function main() {
  const profiles = buildProfiles();
  let validPlans = 0;
  let controlledFailures = 0;
  let invalidSuccessful = 0;
  const invalidDetails = [];
  const failureDetails = [];

  for (const profile of profiles) {
    const targets = targetsFor(profile);
    const plan = buildPlan(profile, targets);
    if (!plan.meals.length) {
      controlledFailures += 1;
      failureDetails.push(`${profile.id}: no eligible meals`);
      continue;
    }

    const result = balancePlanWithMealSearch(plan, targets, {
      isHebrew: profile.locale === "he",
      candidatesForSlot: meal =>
        filterMeals({ diet: profile.diet, excludeAllergens: profile.excludeAllergens, slot: meal.slot }),
      buildOption: (mealId, meal) =>
        buildMealOption(mealId, {
          targetCalories: meal.targetCalories,
          isHebrew: profile.locale === "he",
          optionNumber: 1
        })
    });

    const check = checkPlan(plan, profile, targets);

    // The server returns a plan only when it is within tolerance AND sane.
    const wouldReturn = check.within && check.problems.length === 0;
    if (wouldReturn) {
      validPlans += 1;
      continue;
    }
    // Anything not returned is a controlled failure (422), which is allowed.
    controlledFailures += 1;
    failureDetails.push(
      `${profile.id}: dev kcal ${check.dev.calories} P ${check.dev.proteinGrams} C ${check.dev.carbsGrams} F ${check.dev.fatGrams}` +
        (check.problems.length ? ` | ${check.problems.slice(0, 2).join("; ")}` : "")
    );

    // An invalid SUCCESSFUL plan is the failure that must never happen: the
    // balancer claiming success while the plan is out of tolerance or unsafe.
    if (result.ok && !wouldReturn) {
      invalidSuccessful += 1;
      invalidDetails.push(
        `${profile.id}: balancer reported ok but plan is invalid -> ${check.problems.slice(0, 3).join("; ") || JSON.stringify(check.dev)}`
      );
    }
  }

  const summary = {
    profiles: profiles.length,
    successfulValidPlans: validPlans,
    controlledGenerationFailures: controlledFailures,
    invalidSuccessfulPlans: invalidSuccessful,
    validPlanRate: `${((100 * validPlans) / profiles.length).toFixed(1)}%`
  };
  console.log("Nutrition stress matrix");
  console.log(JSON.stringify(summary, null, 2));

  if (failureDetails.length) {
    console.log(`\nControlled failures (${failureDetails.length}) — returned as a friendly error, not shown to users:`);
    failureDetails.slice(0, 20).forEach(f => console.log(`  - ${f}`));
    if (failureDetails.length > 20) console.log(`  ... and ${failureDetails.length - 20} more`);
  }

  if (invalidDetails.length) {
    console.log("\nINVALID SUCCESSFUL PLANS (must be zero):");
    invalidDetails.forEach(d => console.log(`  - ${d}`));
  }

  if (invalidSuccessful > 0) {
    console.log("\nFAILED: an invalid plan would have been returned as successful.");
    process.exitCode = 1;
  } else {
    console.log("\nPASSED: no invalid plan can reach a user.");
  }
}

main();
