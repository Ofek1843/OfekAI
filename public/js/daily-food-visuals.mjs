import { FOOD_CATALOG, normalizeText } from "./daily-nutrition-domain.mjs?v=20260913-smart-food-1";

// Presentation only: canonical IDs come from the nutrition domain. Never infer
// amounts or nutrition from an image, and never reinterpret a multi-item meal.
export const FOOD_THUMBNAILS = Object.freeze({
  oats: "foods/oats.webp", "oats-quaker-original": "foods/oats.webp",
  "protein-bar": "common/protein-bar.svg", "protein-drink": "foods/protein-powder.webp",
  "cottage-3": "foods/cottage-cheese.webp", "cottage-5": "foods/cottage-cheese.webp",
  "white-cheese-5": "common/white-cheese.svg",
  "high-protein-yogurt": "foods/skyr.webp", yogurt: "foods/yogurt.webp", skyr: "foods/skyr.webp",
  "ready-rice": "foods/white-rice.webp", "ready-chicken": "foods/chicken-breast.webp",
  "tuna-water": "foods/tuna.webp", egg: "foods/eggs.webp", milk: "foods/milk.webp",
  "bread-slice": "foods/bread.webp", pita: "foods/pita.webp", "rice-cake": "foods/rice-cakes.webp",
  "pasta-cooked": "foods/pasta.webp", potato: "foods/potato.webp", "sweet-potato": "foods/sweet-potato.webp",
  banana: "foods/banana.webp", apple: "foods/apple.webp", pomegranate: "foods/pomegranate.webp", cucumber: "foods/cucumber.webp",
  avocado: "foods/avocado.webp", "peanut-butter": "foods/peanut-butter.webp", nuts: "foods/almonds.webp",
  pizza: "common/pizza.svg", "shawarma-laffa": "meals/chicken-shawarma-pita.webp",
  cornflakes: "foods/cornflakes.webp", granola: "foods/granola.webp", "chocolate-snack": "foods/dark-chocolate.webp",
  hummus: "foods/hummus.webp", salmon: "foods/salmon.webp", "turkey-pastrami": "foods/turkey-breast.webp"
});

export const FOOD_THUMBNAIL_FALLBACK = "/images/common/meal.svg";

// Exact labels for custom items not yet in the nutrient catalog. These affect
// visuals only; they intentionally do not add invented nutritional records.
const VISUAL_LABELS = { milk: ["milk", "חלב"], skyr: ["skyr", "סקיר"],
  "peanut-butter": ["peanut butter", "חמאת בוטנים"], nuts: ["nuts", "אגוזים", "שקדים"],
  granola: ["granola", "גרנולה"], "chocolate-snack": ["chocolate snack", "חטיף שוקולד", "שוקולד"] };
const LABEL_KEYS = new Map();
for (const food of FOOD_CATALOG) {
  for (const label of [...food.aliases, food.name.en, food.name.he]) LABEL_KEYS.set(normalizeText(label), food.id);
}
for (const [key, labels] of Object.entries(VISUAL_LABELS)) {
  for (const label of labels) LABEL_KEYS.set(normalizeText(label), key);
}

export function foodThumbnail(entry = {}) {
  const key = Object.hasOwn(FOOD_THUMBNAILS, entry.foodId || "") ? entry.foodId
    : LABEL_KEYS.get(normalizeText(entry.name?.en || "")) || LABEL_KEYS.get(normalizeText(entry.name?.he || ""));
  return Object.hasOwn(FOOD_THUMBNAILS, key || "") ? `/images/${FOOD_THUMBNAILS[key]}` : FOOD_THUMBNAIL_FALLBACK;
}

export function foodThumbnailMarkup(entry) {
  return `<img class="food-thumbnail" src="${foodThumbnail(entry)}" alt="" width="56" height="56" loading="lazy" decoding="async">`;
}
