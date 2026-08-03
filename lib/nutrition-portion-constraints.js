// Realistic serving bounds for every catalog food.
//
// The portion balancer may only move an ingredient inside these bounds, which
// is what stops it from "solving" a macro gap with 3 g of chicken, 900 g of
// rice or 100 g of olive oil. Bounds are per ingredient row in a single meal,
// in grams, and are deliberately generous at the edges of what a person would
// actually plate rather than what is arithmetically convenient.
//
// Categories also carry a `lever` weight: how appropriate that food is as a
// macro-balancing mechanism. Staples (rice, chicken, oats) are proper levers;
// spices are never touched, and vegetables/fruit move only reluctantly so the
// balancer does not turn a meal into a bowl of cucumber to chase a carb gap.

const CATEGORIES = {
  // Never adjusted: a spice is a garnish, not a macro source.
  spice: { min: 1, max: 10, lever: 0 },
  // Fresh acids and herbs can be authored in larger handfuls than dry spice,
  // but remain garnish and must never become macro-balancing levers.
  garnish: { min: 1, max: 30, lever: 0 },

  // Pure fat. Tiny absolute range because the calorie density is enormous
  // (884 kcal/100 g) -- a 10 g slip here is 88 kcal.
  oil: { min: 3, max: 20, lever: 0.8 },

  nut_butter: { min: 10, max: 45, lever: 0.9 },
  nuts_seeds: { min: 10, max: 60, lever: 0.9 },
  avocado: { min: 30, max: 200, lever: 0.8 },

  // Meat, fish, tofu, tempeh, seitan, eggs.
  protein_dense: { min: 60, max: 300, lever: 1 },
  protein_powder: { min: 15, max: 60, lever: 1 },
  dairy_protein: { min: 80, max: 400, lever: 1 },
  hard_cheese: { min: 15, max: 80, lever: 0.7 },

  // Cooked grains, starches and potatoes.
  grain_starch: { min: 30, max: 350, lever: 1 },
  legume: { min: 40, max: 250, lever: 1 },

  // Bread-like foods snap to whole pieces, so their bounds are piece-aware.
  // Floor is one piece: a snack can legitimately be three 9 g rice cakes.
  bread_piece: { min: 18, max: 180, lever: 0.9 },

  milk_liquid: { min: 100, max: 400, lever: 0.8 },

  // Ranges have to cover both uses these foods have in the catalog: a 12 g
  // drizzle of honey on yogurt AND the 70 g of dates that are the base of
  // "Date & Tahini Oat Bites"; a spoon of tomato sauce AND the ~200 g that
  // makes "Turkey Pasta in Tomato Sauce" the dish it is. Bounds tuned to the
  // garnish use alone rejected the recipe's own authored amounts.
  sweetener: { min: 5, max: 120, lever: 0.6 },
  sauce: { min: 15, max: 300, lever: 0.5 },

  // Present for volume, fibre and micronutrients. Low lever so they are a last
  // resort, but still allowed to move a little.
  // 25 g covers the few lettuce leaves a sandwich actually carries.
  vegetable: { min: 25, max: 300, lever: 0.35 },
  fruit: { min: 50, max: 300, lever: 0.4 }
};

// Explicit role per food. Deliberately hand-assigned rather than derived from
// the dominant macro: cinnamon is carb-dominant but is a spice, lettuce is
// carb-dominant but is a salad leaf, and salmon is fat-dominant but is the
// protein of its meal.
const FOOD_CATEGORY = {
  // --- spices / condiments (never moved) ---
  cinnamon: "spice",
  mustard: "spice",
  ketchup: "sauce",

  // --- fats ---
  "olive-oil": "oil",
  tahini: "nut_butter",
  "peanut-butter": "nut_butter",
  "almond-butter": "nut_butter",
  almonds: "nuts_seeds",
  walnuts: "nuts_seeds",
  cashews: "nuts_seeds",
  avocado: "avocado",

  // --- protein ---
  "chicken-breast": "protein_dense",
  "chicken-thigh": "protein_dense",
  "turkey-breast": "protein_dense",
  "lean-beef": "protein_dense",
  steak: "protein_dense",
  salmon: "protein_dense",
  tuna: "protein_dense",
  tilapia: "protein_dense",
  cod: "protein_dense",
  shrimp: "protein_dense",
  tofu: "protein_dense",
  tempeh: "protein_dense",
  seitan: "protein_dense",
  eggs: "protein_dense",
  "egg-whites": "protein_dense",
  "protein-powder": "protein_powder",
  "cottage-cheese": "dairy_protein",
  "greek-yogurt": "dairy_protein",
  skyr: "dairy_protein",
  cheese: "hard_cheese",
  mozzarella: "hard_cheese",
  parmesan: "hard_cheese",

  // --- carbohydrate staples ---
  "white-rice": "grain_starch",
  "brown-rice": "grain_starch",
  "jasmine-rice": "grain_starch",
  "basmati-rice": "grain_starch",
  oats: "grain_starch",
  quinoa: "grain_starch",
  couscous: "grain_starch",
  bulgur: "grain_starch",
  pasta: "grain_starch",
  "whole-wheat-pasta": "grain_starch",
  potato: "grain_starch",
  "sweet-potato": "grain_starch",
  cornflakes: "grain_starch",
  granola: "grain_starch",

  bread: "bread_piece",
  "whole-wheat-bread": "bread_piece",
  pita: "bread_piece",
  tortilla: "bread_piece",
  "rice-cakes": "bread_piece",

  lentils: "legume",
  chickpeas: "legume",
  "black-beans": "legume",
  "kidney-beans": "legume",
  edamame: "legume",
  peas: "legume",
  corn: "legume",

  // --- liquids ---
  milk: "milk_liquid",
  "soy-milk": "milk_liquid",
  "almond-milk": "milk_liquid",
  "oat-milk": "milk_liquid",

  // --- sweet / sauce ---
  honey: "sweetener",
  dates: "sweetener",
  "dark-chocolate": "sweetener",
  hummus: "sauce",
  "tomato-sauce": "sauce",
  salsa: "sauce",

  // --- fruit ---
  banana: "fruit",
  apple: "fruit",
  orange: "fruit",
  pear: "fruit",
  grapes: "fruit",
  strawberries: "fruit",
  blueberries: "fruit",
  raspberries: "fruit",
  kiwi: "fruit",
  pineapple: "fruit",
  mango: "fruit",
  melon: "fruit",
  peach: "fruit",

  // --- vegetables ---
  broccoli: "vegetable",
  cauliflower: "vegetable",
  carrots: "vegetable",
  cucumber: "vegetable",
  tomato: "vegetable",
  lettuce: "vegetable",
  spinach: "vegetable",
  kale: "vegetable",
  zucchini: "vegetable",
  "bell-pepper": "vegetable",
  onion: "vegetable",
  mushrooms: "vegetable",
  cabbage: "vegetable",
  "green-beans": "vegetable",
  asparagus: "vegetable",

  // Expanded Manual Nutrition catalog ingredients.
  mackerel: "protein_dense",
  "rye-bread": "bread_piece",
  lemon: "garnish",
  "buckwheat-flour": "grain_starch",
  kefir: "milk_liquid",
  "whole-grain-flour": "grain_starch",
  "corn-tortilla": "bread_piece",
  "chia-seeds": "nuts_seeds",
  farro: "grain_starch",
  basil: "garnish",
  herbs: "garnish",
  polenta: "grain_starch",
  "white-beans": "legume",
  lamb: "protein_dense",
  celery: "vegetable",
  olives: "nuts_seeds",
  haddock: "protein_dense",
  sardines: "protein_dense",
  beetroot: "vegetable",
  trout: "protein_dense",
  mussels: "protein_dense",
  "soba-noodles": "grain_starch",
  miso: "sauce",
  halloumi: "hard_cheese",
  quark: "dairy_protein",
  cocoa: "spice",
  "broad-beans": "legume",
  "lupin-beans": "legume",
  watermelon: "fruit",
  mint: "garnish",
  dill: "garnish",
  labneh: "dairy_protein",
  ricotta: "dairy_protein",
  cream: "dairy_protein",
  feta: "hard_cheese"
};

// Fallback for any food added later without an explicit category: classify by
// composition, and stay conservative so an unclassified food is never an
// aggressive lever.
function inferCategory(food) {
  const kcal = Number(food?.kcal) || 0;
  if (!kcal) return "vegetable";
  const proteinShare = (Number(food.p) || 0) * 4 / kcal;
  const fatShare = (Number(food.f) || 0) * 9 / kcal;
  if (kcal >= 700) return "oil";
  if (kcal >= 450 && fatShare >= 0.5) return "nuts_seeds";
  if (proteinShare >= 0.4) return "protein_dense";
  if (kcal <= 60) return "vegetable";
  return "grain_starch";
}

function categoryFor(key, food) {
  return FOOD_CATEGORY[key] || inferCategory(food);
}

/** Serving bounds for one ingredient row, in grams. */
function boundsFor(key, food) {
  const category = categoryFor(key, food);
  const spec = CATEGORIES[category] || CATEGORIES.vegetable;
  // A piece-based food can never sit below one whole piece, and its bounds
  // must land on piece multiples so nobody is asked to eat 0.6 of an egg.
  if (food?.piece?.g) {
    const pieceGrams = food.piece.g;
    const min = Math.max(pieceGrams, Math.ceil(spec.min / pieceGrams) * pieceGrams);
    const max = Math.max(min, Math.floor(spec.max / pieceGrams) * pieceGrams);
    return { ...spec, category, min, max, step: pieceGrams };
  }
  // Small items are measured to the gram; everything else moves in 5 g steps,
  // matching how the catalog snaps amounts for display.
  return { ...spec, category, min: spec.min, max: spec.max, step: spec.max <= 20 ? 1 : 5 };
}

/**
 * Wider "is this absurd?" bounds used for VALIDATION rather than optimization.
 *
 * The bounds above are tuned to keep the balancer's adjustments tasteful, but
 * they are tighter than the range the catalog itself already produces: scaling
 * a recipe by its normal 0.6-1.6x legitimately yields one 50 g egg, 25 g of
 * granola or a 9 g spoon of peanut butter. Validating against the tuning
 * bounds therefore rejected the existing system's own correct output.
 *
 * These bounds only catch what the release spec actually calls absurd -- 3 g of
 * chicken, 900 g of rice, 100 g of olive oil -- so a real defect still fails
 * loudly while normal recipe scaling passes.
 */
function absurdBoundsFor(key, food) {
  const tuned = boundsFor(key, food);
  // 0.6x / 1.6x mirrors the catalog's own scale clamp, so the validator
  // accepts every amount the existing generator can legitimately produce.
  const min = Math.max(1, Math.floor(tuned.min * 0.55));
  const max = Math.ceil(tuned.max * 1.6);
  if (food?.piece?.g) {
    const pieceGrams = food.piece.g;
    return {
      ...tuned,
      min: pieceGrams,
      max: Math.max(pieceGrams, Math.floor(max / pieceGrams) * pieceGrams)
    };
  }
  return { ...tuned, min, max };
}

module.exports = {
  CATEGORIES,
  FOOD_CATEGORY,
  absurdBoundsFor,
  boundsFor,
  categoryFor,
  inferCategory
};
