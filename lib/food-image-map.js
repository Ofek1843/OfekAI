// Single source of truth for food image routing.
//
// Both the nutrition builder (POST /api/nutrition-builder) and its
// reroll-food endpoint resolve images through this module, and
// lib/meal-catalog.js's `img` field is validated against FOOD_IMAGE_MAP by
// scripts/audit-food-image-coverage.js. Previously this map lived inline in
// server.js, which meant the audit had to regex-parse server.js and nothing
// enforced that every catalog food actually had a mapping -- cinnamon and
// asparagus both silently fell back to the placeholder as a result.
//
// Keys are lowercase. Values are absolute URL paths under /images/foods/.

const FOOD_IMAGE_MAP = {
  "chicken breast": "/images/foods/chicken-breast.jpg",
  "chicken thigh": "/images/foods/chicken-thigh.jpg",
  "turkey breast": "/images/foods/turkey-breast.jpg",
  "lean ground beef": "/images/foods/lean-ground-beef.jpg",
  "steak": "/images/foods/steak.jpg",
  "salmon": "/images/foods/salmon.jpg",
  "tuna": "/images/foods/tuna.jpg",
  "tilapia": "/images/foods/tilapia.jpg",
  "cod": "/images/foods/cod.jpg",
  "shrimp": "/images/foods/shrimp.jpg",
  "eggs": "/images/foods/eggs.jpg",
  "egg whites": "/images/foods/egg-whites.jpg",
  "cottage cheese": "/images/foods/cottage-cheese.jpg",
  "greek yogurt": "/images/foods/greek-yogurt.jpg",
  "skyr": "/images/foods/skyr.jpg",
  "tofu": "/images/foods/tofu.jpg",
  "tempeh": "/images/foods/tempeh.jpg",
  "seitan": "/images/foods/seitan.jpg",
  "protein powder": "/images/foods/protein-powder.jpg",

  "white rice": "/images/foods/white-rice.jpg",
  "brown rice": "/images/foods/brown-rice.jpg",
  "jasmine rice": "/images/foods/jasmine-rice.jpg",
  "basmati rice": "/images/foods/basmati-rice.jpg",
  "oats": "/images/foods/oats.jpg",
  "quinoa": "/images/foods/quinoa.jpg",
  "couscous": "/images/foods/couscous.jpg",
  "bulgur": "/images/foods/bulgur.jpg",
  "whole wheat pasta": "/images/foods/whole-wheat-pasta.jpg",
  "pasta": "/images/foods/pasta.jpg",
  "sweet potato": "/images/foods/sweet-potato.jpg",
  "potato": "/images/foods/potato.jpg",
  "whole wheat bread": "/images/foods/whole-wheat-bread.jpg",
  "bread": "/images/foods/bread.jpg",
  "pita": "/images/foods/pita.jpg",
  "tortilla": "/images/foods/tortilla.jpg",
  "rice cakes": "/images/foods/rice-cakes.jpg",
  "cornflakes": "/images/foods/cornflakes.jpg",
  "granola": "/images/foods/granola.jpg",

  "banana": "/images/foods/banana.jpg",
  "apple": "/images/foods/apple.jpg",
  "orange": "/images/foods/orange.jpg",
  "pear": "/images/foods/pear.jpg",
  "grapes": "/images/foods/grapes.jpg",
  "strawberries": "/images/foods/strawberries.jpg",
  "blueberries": "/images/foods/blueberries.jpg",
  "raspberries": "/images/foods/raspberries.jpg",
  "kiwi": "/images/foods/kiwi.jpg",
  "pineapple": "/images/foods/pineapple.jpg",
  "mango": "/images/foods/mango.jpg",
  "watermelon": "/images/foods/watermelon.jpg",
  "melon": "/images/foods/melon.jpg",
  "peach": "/images/foods/peach.jpg",
  "plum": "/images/foods/plum.jpg",
  "dates": "/images/foods/dates.jpg",
  "raisins": "/images/foods/raisins.jpg",

  "broccoli": "/images/foods/broccoli.jpg",
  "cauliflower": "/images/foods/cauliflower.jpg",
  "carrots": "/images/foods/carrots.jpg",
  "cucumber": "/images/foods/cucumber.jpg",
  "tomato": "/images/foods/tomato.jpg",
  "lettuce": "/images/foods/lettuce.jpg",
  "spinach": "/images/foods/spinach.jpg",
  "kale": "/images/foods/kale.jpg",
  "zucchini": "/images/foods/zucchini.jpg",
  "bell pepper": "/images/foods/bell-pepper.jpg",
  "onion": "/images/foods/onion.jpg",
  "mushrooms": "/images/foods/mushrooms.jpg",
  "avocado": "/images/foods/avocado.jpg",
  "cabbage": "/images/foods/cabbage.jpg",
  "green beans": "/images/foods/green-beans.jpg",
  "peas": "/images/foods/peas.jpg",
  "corn": "/images/foods/corn.jpg",

  "almonds": "/images/foods/almonds.jpg",
  "walnuts": "/images/foods/walnuts.jpg",
  "cashews": "/images/foods/cashews.jpg",
  "pistachios": "/images/foods/pistachios.jpg",
  "peanuts": "/images/foods/peanuts.jpg",
  "peanut butter": "/images/foods/peanut-butter.jpg",
  "almond butter": "/images/foods/almond-butter.jpg",
  "tahini": "/images/foods/tahini.jpg",
  "olive oil": "/images/foods/olive-oil.jpg",

  "milk": "/images/foods/milk.jpg",
  "lactose free milk": "/images/foods/lactose-free-milk.jpg",
  "soy milk": "/images/foods/soy-milk.jpg",
  "almond milk": "/images/foods/almond-milk.jpg",
  "oat milk": "/images/foods/oat-milk.jpg",
  "cheese": "/images/foods/cheese.jpg",
  "mozzarella": "/images/foods/mozzarella.jpg",
  "parmesan": "/images/foods/parmesan.jpg",

  "honey": "/images/foods/honey.jpg",
  "jam": "/images/foods/jam.jpg",
  "dark chocolate": "/images/foods/dark-chocolate.jpg",
  "hummus": "/images/foods/hummus.jpg",
  "ketchup": "/images/foods/ketchup.jpg",
  "mustard": "/images/foods/mustard.jpg",
  "tomato sauce": "/images/foods/tomato-sauce.jpg",
"salsa": "/images/foods/salsa.jpg",
"hazelnuts": "/images/foods/hazelnuts.jpg",
"chickpeas": "/images/foods/chickpeas.jpg",
"lentils": "/images/foods/lentils.jpg",
"red lentils": "/images/foods/red-lentils.jpg",
"black beans": "/images/foods/black-beans.jpg",
"kidney beans": "/images/foods/kidney-beans.jpg",
"white beans": "/images/foods/white-beans.jpg",
"edamame": "/images/foods/edamame.jpg",
"kohlrabi": "/images/foods/kohlrabi.jpg",
"beetroot": "/images/foods/beetroot.jpg",
"celery": "/images/foods/celery.jpg",
"pumpkin": "/images/foods/pumpkin.jpg",
"butternut squash": "/images/foods/butternut-squash.jpg",
"mixed greens": "/images/foods/mixed-greens.jpg",
"dried fruit": "/images/foods/dried-fruit.jpg",
"cranberries": "/images/foods/cranberries.jpg",
"sunflower seeds": "/images/foods/sunflower-seeds.jpg",
"pumpkin seeds": "/images/foods/pumpkin-seeds.jpg",
"chia seeds": "/images/foods/chia-seeds.jpg",
"flax seeds": "/images/foods/flax-seeds.jpg",
"coconut": "/images/foods/coconut.jpg",
"coconut milk": "/images/foods/coconut-milk.jpg",
"yogurt": "/images/foods/yogurt.jpg",
"cream cheese": "/images/foods/cream-cheese.jpg",
"feta": "/images/foods/feta.jpg",
"ricotta": "/images/foods/ricotta.jpg",
"wrap": "/images/foods/wrap.jpg",
"whole wheat wrap": "/images/foods/whole-wheat-wrap.jpg",
"marinara sauce": "/images/foods/marinara-sauce.jpg",
"smoothie": "/images/foods/smoothie.jpg",
"hazelnut butter": "/images/foods/hazelnut-butter.jpg",
"pecans": "/images/foods/pecans.jpg",
"macadamia nuts": "/images/foods/macadamia-nuts.jpg",
"brazil nuts": "/images/foods/brazil-nuts.jpg",
"cashew butter": "/images/foods/cashew-butter.jpg",
"whole egg": "/images/foods/eggs.jpg",
"egg": "/images/foods/eggs.jpg",
"chicken": "/images/foods/chicken-breast.jpg",
"turkey": "/images/foods/turkey-breast.jpg",
"beef": "/images/foods/lean-ground-beef.jpg",
"fish": "/images/foods/salmon.jpg",
"berries": "/images/foods/blueberries.jpg",
"mixed berries": "/images/foods/blueberries.jpg",
"leafy greens": "/images/foods/mixed-greens.jpg",
  // lib/meal-catalog.js declares `img: "cinnamon"` and the photo has been on
  // disk the whole time, but there was no mapping entry -- so every meal
  // containing cinnamon (oatmeal, skyr bowl, quinoa breakfast, date bites,
  // banana oat balls) rendered the placeholder instead.
  cinnamon: "/images/foods/cinnamon.jpg"
};

// Free-text spelling/qualifier variants that must resolve to an existing
// canonical key. These add NO new physical files -- they point at an image
// that is already on disk. Longest match wins (see resolveFoodImage), so
// "ground cinnamon" resolves before the bare "cinnamon".
const FOOD_IMAGE_ALIASES = {
  "ground cinnamon": "cinnamon",
  "cinnamon powder": "cinnamon",
  "cinnamon, ground": "cinnamon",
  "whole wheat tortilla": "whole wheat wrap",
  "greek yoghurt": "greek yogurt",
  "yoghurt": "yogurt",
  "natural yogurt": "yogurt",
  "plain yogurt": "yogurt",
  "extra virgin olive oil": "olive oil",
  "rolled oats": "oats",
  "porridge oats": "oats",
  "sweet potatoes": "sweet potato",
  "potatoes": "potato",
  "cherry tomatoes": "tomato",
  "cherry tomato": "tomato",
  "red onion": "onion",
  "spring onion": "onion",
  "bell peppers": "bell pepper",
  "red bell pepper": "bell pepper",
  "green beans steamed": "green beans",
  "baby spinach": "spinach",
  "romaine lettuce": "lettuce",
  "skinless chicken breast": "chicken breast",
  "grilled chicken breast": "chicken breast",
  "ground turkey": "turkey breast",
  "canned tuna": "tuna",
  "tuna in water": "tuna",
  "egg white": "egg whites",
  "low fat cottage cheese": "cottage cheese",
  "whey protein": "protein powder",
  "whey protein powder": "protein powder",
  "peanut butter natural": "peanut butter"
};

// Normalizes free text the same way for every lookup: lowercase, collapse
// whitespace, drop surrounding punctuation. Deliberately does NOT strip
// interior words -- "chicken breast" must never collapse into "chicken".
function normalizeFoodName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9%+\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Canonical keys sorted longest-first so a specific phrase always beats a
// generic root word ("chicken breast" before "chicken", "red lentils" before
// "lentils", "ground cinnamon" before "cinnamon").
const LOOKUP_KEYS_LONGEST_FIRST = [
  ...Object.keys(FOOD_IMAGE_MAP),
  ...Object.keys(FOOD_IMAGE_ALIASES)
]
  .map(key => ({ key, words: key.split(" ") }))
  .sort((a, b) => b.words.length - a.words.length || b.key.length - a.key.length);

// Whole-word containment. Raw substring matching silently mismatched foods
// that merely share letters -- "unicorn meat" matched "corn", "grapes"
// matched "grape" inside unrelated words -- so a key only matches when its
// words appear as a contiguous run of whole words in the input.
function containsWordSequence(inputWords, keyWords) {
  if (keyWords.length > inputWords.length) return false;
  for (let start = 0; start <= inputWords.length - keyWords.length; start++) {
    let matched = true;
    for (let offset = 0; offset < keyWords.length; offset++) {
      if (inputWords[start + offset] !== keyWords[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

function urlForCanonicalKey(key) {
  if (FOOD_IMAGE_MAP[key]) return FOOD_IMAGE_MAP[key];
  const aliasTarget = FOOD_IMAGE_ALIASES[key];
  return aliasTarget ? FOOD_IMAGE_MAP[aliasTarget] || null : null;
}

/**
 * Resolves a food name (catalog `img` key, or free text from the model) to a
 * local image URL, or null when nothing matches. Never returns a placeholder
 * -- callers decide what their fallback is.
 */
function resolveFoodImage(foodName) {
  const normalized = normalizeFoodName(foodName);
  if (!normalized) return null;

  const exact = urlForCanonicalKey(normalized);
  if (exact) return exact;

  // Whole-word phrase containment, most-words-first, so a compound
  // ingredient string ("2 tbsp ground cinnamon") still finds its specific
  // image and never collapses into a shorter generic key.
  const inputWords = normalized.split(" ");
  for (const { key, words } of LOOKUP_KEYS_LONGEST_FIRST) {
    if (normalized === key) continue;
    if (containsWordSequence(inputWords, words)) {
      const url = urlForCanonicalKey(key);
      if (url) return url;
    }
  }
  return null;
}

const FOOD_PLACEHOLDER_IMAGE = "/images/food-placeholder.png";

module.exports = {
  FOOD_IMAGE_MAP,
  FOOD_IMAGE_ALIASES,
  FOOD_PLACEHOLDER_IMAGE,
  normalizeFoodName,
  resolveFoodImage
};
