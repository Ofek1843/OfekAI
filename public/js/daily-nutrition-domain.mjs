const round = (value, precision = 1) => {
  const factor = 10 ** precision;
  return Math.round((Number(value) || 0) * factor) / factor;
};

// Generic foods are canonical, representative references rather than arbitrary
// branded records. Values are stored per 100 g of edible food unless a counted
// unit is explicitly part of the food definition. Commodity references follow
// the FoodData Central 100 g edible-portion model; cooked foods are named as
// cooked so a normal "what I ate" entry does not silently use a raw value.
const FOOD_CATALOG = Object.freeze([
  { id: "oats", name: { en: "Oats (generic, dry)", he: "שיבולת שועל (גנרית, יבשה)" }, aliases: ["oats", "oatmeal", "rolled oats", "porridge oats", "שיבולת שועל", "שיבולת שועל יבשה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 375, protein: 13.2, carbs: 67.7, fat: 6.5 }, reference: { source: "curated generic commodity reference", ediblePortion: true, state: "dry", policy: "representative-not-brand" } },
  { id: "oats-quaker-original", name: { en: "Quaker original oats", he: "שיבולת שועל קוואקר מקורית" }, aliases: ["quaker original oats", "quaker oats", "שיבולת שועל קוואקר", "קוואקר מקורי"], baseAmount: 100, baseUnit: "g", specificity: "brand", macros: { calories: 375, protein: 12.5, carbs: 67.5, fat: 7.5 }, reference: { source: "known-product reference", ediblePortion: true, state: "dry", policy: "specific-product" } },
  { id: "cottage-3", name: { en: "Cottage cheese 3%", he: "קוטג׳ 3%" }, aliases: ["cottage cheese 3%", "cottage 3%", "3% cottage", "קוטג 3%", "קוטג׳ 3%", "קוטג", "קוטג׳", "cottage", "cottage cheese"], baseAmount: 100, baseUnit: "g", macros: { calories: 84, protein: 11.5, carbs: 3, fat: 3 } },
  { id: "cottage-5", name: { en: "Cottage cheese 5%", he: "קוטג׳ 5%" }, aliases: ["cottage cheese 5%", "cottage 5%", "5% cottage", "קוטג 5%", "קוטג׳ 5%", "קוטג", "קוטג׳", "cottage", "cottage cheese"], baseAmount: 100, baseUnit: "g", macros: { calories: 100, protein: 11.5, carbs: 3, fat: 5 } },
  { id: "rice-cake", name: { en: "Rice cake", he: "פריכית אורז" }, aliases: ["rice cake", "rice cakes", "פריכית", "פריכיות", "פריכית אורז", "פריכיות אורז"], baseAmount: 1, baseUnit: "item", macros: { calories: 35, protein: 0.7, carbs: 7.3, fat: 0.3 }, reference: { source: "generic plain rice cake", ediblePortion: true, state: "ready-to-eat" } },
  { id: "protein-drink", name: { en: "Protein drink", he: "משקה חלבון" }, aliases: ["protein drink", "protein shake", "protein bottle", "משקה חלבון", "שייק חלבון"], baseAmount: 1, baseUnit: "item", specificity: "generic", macros: { calories: 160, protein: 25, carbs: 8, fat: 3 }, reference: { source: "internal representative generic protein drink (~330 ml)", ediblePortion: true, state: "ready-to-drink", policy: "representative-not-brand" } },
  { id: "protein-bar", name: { en: "Protein bar (average)", he: "חטיף חלבון (ממוצע)" }, aliases: ["protein bar", "protein bars", "protein snack bar", "חטיף חלבון", "חטיפי חלבון", "חטיף חלבונים", "חטיף פרוטאין"], baseAmount: 1, baseUnit: "item", specificity: "generic", macros: { calories: 220, protein: 20, carbs: 22, fat: 8 }, reference: { source: "internal representative generic protein bar (~60 g)", ediblePortion: true, state: "ready-to-eat", policy: "representative-not-brand" } },
  { id: "high-protein-yogurt", name: { en: "High-protein yogurt", he: "יוגורט חלבון" }, aliases: ["high protein yogurt", "protein yogurt", "greek yogurt", "יוגורט חלבון", "יוגורט פרו", "יוגורט יווני"], baseAmount: 1, baseUnit: "item", macros: { calories: 150, protein: 20, carbs: 12, fat: 2 } },
  { id: "banana", name: { en: "Banana", he: "בננה" }, aliases: ["banana", "bananas", "בננה", "בננות"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 }, reference: { source: "generic raw edible portion", ediblePortion: true, state: "raw" } },
  { id: "apple", name: { en: "Apple", he: "תפוח" }, aliases: ["apple", "apples", "תפוח", "תפוחים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2 }, reference: { source: "generic raw edible portion", ediblePortion: true, state: "raw" } },
  { id: "cucumber", name: { en: "Cucumber", he: "מלפפון" }, aliases: ["cucumber", "cucumbers", "מלפפון", "מלפפונים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1 }, reference: { source: "generic raw edible portion", ediblePortion: true, state: "raw" } },
  { id: "avocado", name: { en: "Avocado", he: "אבוקדו" }, aliases: ["avocado", "avocados", "אבוקדו"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 160, protein: 2, carbs: 8.5, fat: 14.7 }, reference: { source: "generic raw edible portion", ediblePortion: true, state: "raw" } },
  { id: "sweet-potato", name: { en: "Cooked sweet potato", he: "בטטה מבושלת" }, aliases: ["sweet potato", "sweet potatoes", "cooked sweet potato", "בטטה", "בטטות", "בטטה מבושלת"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 90, protein: 2, carbs: 20.7, fat: 0.2 }, reference: { source: "generic cooked edible portion", ediblePortion: true, state: "cooked", defaultState: "cooked when logged as eaten" } },
  { id: "tuna-water", name: { en: "Tuna in water", he: "טונה במים" }, aliases: ["tuna in water", "tuna", "טונה במים", "טונה"], baseAmount: 100, baseUnit: "g", macros: { calories: 116, protein: 26, carbs: 0, fat: 1 }, reference: { source: "generic canned tuna in water", ediblePortion: true, state: "drained" } },
  { id: "pita", name: { en: "Pita", he: "פיתה" }, aliases: ["pita", "pitta", "pitas", "פיתה", "פיתות"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 275, protein: 9.1, carbs: 55.7, fat: 1.2 }, reference: { source: "generic white pita", ediblePortion: true, state: "ready-to-eat" } },
  { id: "bread-slice", name: { en: "Bread", he: "לחם" }, aliases: ["bread slice", "slice of bread", "bread", "פרוסת לחם", "פרוסות לחם", "לחם"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 250, protein: 9, carbs: 49, fat: 3.2 }, reference: { source: "generic commercial bread", ediblePortion: true, state: "ready-to-eat" } },
  { id: "white-cheese-5", name: { en: "White cheese 5%", he: "גבינה לבנה 5%" }, aliases: ["white cheese 5%", "white cheese", "גבינה לבנה 5%", "גבינה לבנה"], baseAmount: 100, baseUnit: "g", macros: { calories: 100, protein: 9, carbs: 3, fat: 5 } },
  { id: "egg", name: { en: "Egg", he: "ביצה" }, aliases: ["egg", "eggs", "ביצה", "ביצים"], baseAmount: 1, baseUnit: "item", macros: { calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 }, reference: { source: "generic large egg", ediblePortion: true, state: "edible item" } },
  { id: "hummus", name: { en: "Hummus", he: "חומוס" }, aliases: ["hummus", "humus", "חומוס"], baseAmount: 100, baseUnit: "g", macros: { calories: 166, protein: 7.9, carbs: 14.3, fat: 9.6 } },
  { id: "turkey-pastrami", name: { en: "Turkey pastrami", he: "פסטרמה הודו" }, aliases: ["turkey pastrami", "turkey slices", "pastrami", "פסטרמה הודו", "פסטרמה"], baseAmount: 100, baseUnit: "g", macros: { calories: 120, protein: 21, carbs: 3, fat: 3 } },
  { id: "ready-rice", name: { en: "Cooked rice", he: "אורז מבושל" }, aliases: ["ready rice", "cooked rice", "rice", "אורז מוכן", "אורז מבושל", "אורז"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 }, reference: { source: "generic cooked white rice", ediblePortion: true, state: "cooked", defaultState: "cooked when logged as eaten" } },
  { id: "pasta-cooked", name: { en: "Cooked pasta", he: "פסטה מבושלת" }, aliases: ["cooked pasta", "pasta", "פסטה מבושלת", "פסטה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 157, protein: 5.8, carbs: 30.9, fat: 0.9 }, reference: { source: "generic cooked pasta", ediblePortion: true, state: "cooked", defaultState: "cooked when logged as eaten" } },
  { id: "potato", name: { en: "Cooked potato", he: "תפוח אדמה מבושל" }, aliases: ["potato", "potatoes", "cooked potato", "תפוח אדמה", "תפוחי אדמה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 87, protein: 1.9, carbs: 20.1, fat: 0.1 }, reference: { source: "generic cooked edible portion", ediblePortion: true, state: "cooked" } },
  { id: "yogurt", name: { en: "Plain yogurt", he: "יוגורט טבעי" }, aliases: ["plain yogurt", "yogurt", "יוגורט טבעי", "יוגורט"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3 }, reference: { source: "generic plain whole-milk yogurt", ediblePortion: true, state: "ready-to-eat" } },
  { id: "salmon", name: { en: "Cooked salmon", he: "סלמון מבושל" }, aliases: ["cooked salmon", "salmon", "סלמון מבושל", "סלמון"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 206, protein: 22, carbs: 0, fat: 12.4 }, reference: { source: "generic cooked salmon", ediblePortion: true, state: "cooked" } },
  { id: "cornflakes", name: { en: "Cornflakes", he: "קורנפלקס" }, aliases: ["cornflakes", "corn flakes", "קורנפלקס", "דגני בוקר"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 357, protein: 7.5, carbs: 84, fat: 0.4 }, reference: { source: "generic ready-to-eat corn flakes", ediblePortion: true, state: "dry" } },
  { id: "pizza", name: { en: "Cheese pizza", he: "פיצה עם גבינה" }, aliases: ["pizza", "pizza slice", "pizza slices", "whole pizza", "pizza tray", "פיצה", "משולש פיצה", "משולשי פיצה", "מגש פיצה", "פיצה שלמה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 265, protein: 11, carbs: 33, fat: 10 }, reference: { source: "representative generic cheese pizza", ediblePortion: true, state: "ready-to-eat", policy: "variable-composite" } },
  { id: "shawarma-laffa", name: { en: "Shawarma laffa", he: "לאפה שווארמה" }, aliases: ["shawarma laffa", "shawarma wrap", "laffa shawarma", "לאפה שווארמה", "שווארמה בלאפה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 170, protein: 9, carbs: 17, fat: 7 }, reference: { source: "internal representative composite: laffa, shawarma, salad and normal sauce allowance", ediblePortion: true, state: "ready-to-eat", policy: "variable-composite" } },
  { id: "tuna-sandwich", name: { en: "Tuna sandwich", he: "כריך טונה" }, aliases: ["tuna sandwich", "כריך טונה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 190, protein: 12, carbs: 22, fat: 6 }, reference: { source: "internal representative composite", ediblePortion: true, state: "ready-to-eat", policy: "variable-composite" } },
  { id: "pita-hummus", name: { en: "Pita with hummus", he: "פיתה עם חומוס" }, aliases: ["pita with hummus", "hummus pita", "פיתה עם חומוס"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 240, protein: 7, carbs: 36, fat: 8 }, reference: { source: "internal representative composite", ediblePortion: true, state: "ready-to-eat", policy: "variable-composite" } },
  { id: "ready-chicken", name: { en: "Cooked chicken breast", he: "חזה עוף מוכן" }, aliases: ["ready chicken", "cooked chicken", "chicken breast", "חזה עוף מוכן", "חזה עוף"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 165, protein: 31, carbs: 0, fat: 3.6 }, reference: { source: "generic cooked skinless breast", ediblePortion: true, state: "cooked" } }
]);

const PORTION_REFERENCES = Object.freeze({
  "sweet-potato": Object.freeze({ unit: "g", default: 180, sizes: Object.freeze({ small: 130, medium: 180, large: 250 }), portions: Object.freeze({ serving: 180, plate: 250 }), confidence: "medium", ediblePortion: true }),
  banana: Object.freeze({ unit: "g", default: 118, sizes: Object.freeze({ small: 80, medium: 118, large: 136 }), confidence: "high", ediblePortion: true }),
  apple: Object.freeze({ unit: "g", default: 182, sizes: Object.freeze({ small: 150, medium: 182, large: 223 }), confidence: "high", ediblePortion: true }),
  pita: Object.freeze({ unit: "g", default: 60, sizes: Object.freeze({ small: 50, medium: 60, large: 80 }), portions: Object.freeze({ item: 60 }), confidence: "medium", ediblePortion: true }),
  "bread-slice": Object.freeze({ unit: "g", default: 32, portions: Object.freeze({ slice: 32 }), confidence: "medium", ediblePortion: true }),
  "ready-rice": Object.freeze({ unit: "g", default: 200, portions: Object.freeze({ serving: 180, plate: 200, bowl: 220, cup: 160 }), confidence: "medium", ediblePortion: true }),
  "pasta-cooked": Object.freeze({ unit: "g", default: 220, portions: Object.freeze({ serving: 200, plate: 220, bowl: 240, cup: 140 }), confidence: "medium", ediblePortion: true }),
  potato: Object.freeze({ unit: "g", default: 170, sizes: Object.freeze({ small: 120, medium: 170, large: 280 }), confidence: "medium", ediblePortion: true }),
  cucumber: Object.freeze({ unit: "g", default: 200, sizes: Object.freeze({ small: 120, medium: 200, large: 300 }), confidence: "medium", ediblePortion: true }),
  avocado: Object.freeze({ unit: "g", default: 150, sizes: Object.freeze({ small: 120, medium: 150, large: 200 }), confidence: "medium", ediblePortion: true }),
  cornflakes: Object.freeze({ unit: "g", default: 40, portions: Object.freeze({ bowl: 40, cup: 30 }), confidence: "low", ediblePortion: true }),
  pizza: Object.freeze({ unit: "g", portions: Object.freeze({ slice: 120 }), confidence: "low", ediblePortion: true, composite: true }),
  "shawarma-laffa": Object.freeze({ unit: "g", default: 500, sizes: Object.freeze({ small: 380, medium: 500, large: 650 }), confidence: "low", ediblePortion: true, composite: true }),
  "tuna-sandwich": Object.freeze({ unit: "g", default: 220, sizes: Object.freeze({ small: 170, medium: 220, large: 300 }), confidence: "low", ediblePortion: true, composite: true }),
  "pita-hummus": Object.freeze({ unit: "g", default: 140, sizes: Object.freeze({ small: 110, medium: 140, large: 190 }), confidence: "low", ediblePortion: true, composite: true })
});

const PIZZA_WHOLE_CHOICES = Object.freeze([
  Object.freeze({ id: "personal", amount: 500, label: { en: "Personal pizza (~500 g)", he: "פיצה אישית (כ־500 גרם)" } }),
  Object.freeze({ id: "medium", amount: 800, label: { en: "Medium pizza (~800 g)", he: "פיצה בינונית (כ־800 גרם)" } }),
  Object.freeze({ id: "large", amount: 1100, label: { en: "Large pizza (~1,100 g)", he: "פיצה גדולה (כ־1,100 גרם)" } })
]);

const UNIT_ALIASES = new Map([
  ["g", "g"], ["gr", "g"], ["gram", "g"], ["grams", "g"], ["גרם", "g"], ["גרמים", "g"],
  ["kg", "kg"], ["kilogram", "kg"], ["kilograms", "kg"], ["קג", "kg"], ["קילו", "kg"],
  ["ml", "ml"], ["milliliter", "ml"], ["milliliters", "ml"], ["מל", "ml"],
  ["item", "item"], ["items", "item"], ["unit", "item"], ["units", "item"], ["יחידה", "item"], ["יחידות", "item"],
  ["serving", "serving"], ["servings", "serving"], ["מנה", "serving"], ["מנות", "serving"],
  ["slice", "slice"], ["slices", "slice"], ["פרוסה", "slice"], ["פרוסות", "slice"], ["משולש", "slice"], ["משולשים", "slice"], ["משולשי", "slice"],
  ["cup", "cup"], ["cups", "cup"], ["כוס", "cup"], ["כוסות", "cup"],
  ["bowl", "bowl"], ["bowls", "bowl"], ["קערה", "bowl"], ["קערת", "bowl"],
  ["plate", "plate"], ["plates", "plate"], ["צלחת", "plate"]
]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[׳’`]/g, "'")
    .replace(/["“”()[\]{}:!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUnit(value) {
  const clean = normalizeText(value).replace(/[.'״']/g, "");
  return UNIT_ALIASES.get(clean) || "";
}

const SIZE_WORDS = Object.freeze({
  small: Object.freeze(["small", "קטן", "קטנה", "קטנים", "קטנות"]),
  medium: Object.freeze(["medium", "regular", "בינוני", "בינונית", "בינוניים", "בינוניות", "רגיל", "רגילה"]),
  large: Object.freeze(["large", "גדול", "גדולה", "גדולים", "גדולות"])
});

const COUNT_WORDS = Object.freeze(new Map([
  ["one", 1], ["a", 1], ["an", 1], ["אחד", 1], ["אחת", 1], ["שלם", 1], ["שלמה", 1],
  ["two", 2], ["שניים", 2], ["שתיים", 2], ["half", 0.5], ["חצי", 0.5]
]));

function detectSize(value) {
  const words = new Set(normalizeText(value).split(" "));
  return Object.entries(SIZE_WORDS).find(([, aliases]) => aliases.some((alias) => words.has(alias)))?.[0] || "";
}

function detectPortionKind(value) {
  const text = normalizeText(value);
  const checks = [
    ["whole", /(?:whole pizza|pizza tray|מגש פיצה|פיצה שלמה|מגש)/u],
    ["slice", /(?:slice|slices|פרוסה|פרוסות|משולש|משולשים|משולשי)/u],
    ["bowl", /(?:bowl|bowls|קערה|קערת)/u],
    ["plate", /(?:plate|plates|צלחת)/u],
    ["cup", /(?:cup|cups|כוס|כוסות)/u],
    ["serving", /(?:serving|servings|מנה|מנות)/u],
    ["item", /(?:item|items|unit|units|יחידה|יחידות)/u]
  ];
  return checks.find(([, pattern]) => pattern.test(text))?.[0] || "";
}

function trailingCount(value) {
  const words = normalizeText(value).split(" ");
  return COUNT_WORDS.get(words.at(-1)) || words.map((word) => COUNT_WORDS.get(word)).find((count) => count !== undefined) || null;
}

function splitFoodInput(value) {
  return String(value || "")
    .replace(/[;+]/g, ",")
    .replace(/\s+and\s+/giu, ",")
    .replace(/\s+ו-?\s*(?=\d)/gu, ",")
    .replace(/\s+ו-?\s*(?=[\u0590-\u05ff])/gu, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseAmountPrefix(segment) {
  const normalized = normalizeText(segment);
  const suffix = normalized.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([a-z\u0590-\u05ff.'״׳]+)$/iu);
  if (suffix) {
    const suffixUnit = normalizeUnit(suffix[3]);
    if (suffixUnit) return { amount: Number(suffix[2].replace(",", ".")), unit: suffixUnit, foodText: normalizeText(suffix[1]) };
  }
  const match = normalized.match(/^(\d+(?:[.,]\d+)?)\s*([a-z\u0590-\u05ff.'״׳]*)\s+(.+)$/iu);
  if (!match) return { amount: null, unit: "", foodText: normalized };
  const amount = Number(match[1].replace(",", "."));
  const unit = normalizeUnit(match[2]);
  if (match[2] && !unit) return { amount, unit: "", foodText: normalizeText(`${match[2]} ${match[3]}`) };
  return { amount, unit, foodText: normalizeText(match[3]) };
}

function catalogWithCustom(customFoods = []) {
  const custom = customFoods.map((food) => ({
    ...food,
    id: String(food.id || "").trim(),
    name: typeof food.name === "object" ? food.name : { en: String(food.name || ""), he: String(food.name || "") },
    aliases: [...new Set([...(food.aliases || []), food.name?.en, food.name?.he, typeof food.name === "string" ? food.name : ""].filter(Boolean))],
    baseAmount: Number(food.baseAmount) || 1,
    baseUnit: normalizeUnit(food.baseUnit) || "item",
    specificity: "custom",
    source: "custom"
  }));
  return [...custom, ...FOOD_CATALOG];
}

function foodPriority(food) {
  return { custom: 400, brand: 300, generic: 100 }[food.specificity || (food.source === "custom" ? "custom" : "generic")] || 0;
}

function foodMatches(food, foodText) {
  return (food.aliases || [])
    .map((alias) => normalizeText(alias))
    .filter(Boolean)
    .map((alias) => ({
      alias,
      score: foodText === alias ? 10000 + alias.length : foodText.includes(alias) ? 1000 + alias.length : alias.includes(foodText) ? 100 + foodText.length : 0
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function scaleFood(food, amount = null, requestedUnit = "") {
  const baseAmount = Number(food.baseAmount) || 1;
  const baseUnit = normalizeUnit(food.baseUnit) || "item";
  let unit = normalizeUnit(requestedUnit) || baseUnit;
  let numericAmount = amount === null || amount === undefined ? baseAmount : Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 10000) throw new Error("INVALID_AMOUNT");
  if (unit === "kg") {
    unit = "g";
    numericAmount *= 1000;
  }
  if (unit !== baseUnit) throw new Error("INCOMPATIBLE_UNIT");
  const factor = numericAmount / baseAmount;
  return {
    foodId: food.id,
    name: { ...food.name },
    amount: round(numericAmount, baseUnit === "item" ? 2 : 1),
    unit,
    calories: round(food.macros.calories * factor),
    proteinGrams: round(food.macros.protein * factor),
    carbsGrams: round(food.macros.carbs * factor),
    fatGrams: round(food.macros.fat * factor),
    source: food.source || (String(food.id).startsWith("custom-") ? "custom" : food.specificity === "brand" ? "brand" : "canonical-generic"),
    reference: food.reference ? { ...food.reference } : undefined
  };
}

function estimatedEntry(food, amount, { count = 1, size = "", portionKind = "", confidence = "medium", composite = false, rawText = "", unit = "g", reason = "" } = {}) {
  const entry = scaleFood(food, amount, unit);
  return {
    ...entry,
    estimated: true,
    approximate: true,
    estimateConfidence: confidence,
    estimateReason: reason || null,
    estimatedGrams: unit === "g" ? entry.amount : null,
    portionCount: count,
    portionSize: size || null,
    portionKind: portionKind || null,
    compositeEstimate: composite,
    rawText
  };
}

// Foods whose macros vary enough by brand that a single compact "which
// product?" question is worth asking before defaulting to a representative
// average -- and where "I don't know" always continues with that average.
const BRAND_CLARIFY_FOODS = new Set(["protein-bar"]);

function estimateFromReference(food, reference, chosenGrams, { count = 1, size = "", portionKind = "", reason = "portion-size", rawText = "" }) {
  return estimatedEntry(food, chosenGrams * count, {
    count,
    size,
    portionKind,
    confidence: reference?.confidence || "low",
    composite: reference?.composite === true,
    reason,
    rawText,
    unit: "g"
  });
}

// A clarification always offers an explicit "I don't know -- estimate it"
// path. `fallback` is the choice that path resolves to.
function buildAmbiguity({ segment, kind, foodId, choices, fallback, allowBrandInput = false }) {
  return Object.freeze({
    segment,
    kind,
    foodId,
    allowBrandInput,
    choices: [...choices, { ...fallback, choiceId: "estimate", isEstimateFallback: true }]
  });
}

function brandAmbiguity(food, parsed, segment) {
  const fallbackEstimate = { confidence: "low", portionKind: "item", reason: "generic-product", unit: "item", count: parsed.amount && parsed.unit ? 1 : parsed.amount || 1 };
  return buildAmbiguity({
    segment,
    kind: "brand",
    foodId: food.id,
    allowBrandInput: true,
    choices: [],
    fallback: { foodId: food.id, label: { ...food.name }, amount: fallbackEstimate.count, unit: "item", estimate: fallbackEstimate }
  });
}

function sizeAmbiguity(food, reference, segment, count) {
  const sizes = reference.sizes || {};
  const order = ["small", "medium", "large"].filter((key) => sizes[key]);
  const choices = order.map((key) => ({
    choiceId: key,
    foodId: food.id,
    label: { en: key, he: key },
    amount: sizes[key] * count,
    unit: "g",
    estimate: { confidence: reference.confidence || "medium", portionSize: key, portionKind: "size", reason: "portion-size", count, composite: reference.composite === true }
  }));
  const mediumGrams = sizes.medium || reference.default || sizes.large || sizes.small;
  return buildAmbiguity({
    segment,
    kind: "size",
    foodId: food.id,
    choices,
    fallback: {
      foodId: food.id,
      label: { en: "medium", he: "medium" },
      amount: mediumGrams * count,
      unit: "g",
      estimate: { confidence: "low", portionSize: "medium", portionKind: "size", reason: "portion-default", count, composite: reference.composite === true }
    }
  });
}

function portionKindAmbiguity(food, reference, segment) {
  const perSlice = reference.portions?.slice || 120;
  const choices = [1, 2].map((n) => ({
    choiceId: `slice-${n}`,
    foodId: food.id,
    label: { en: n === 1 ? "1 slice" : `${n} slices`, he: n === 1 ? "משולש אחד" : `${n} משולשים` },
    amount: perSlice * n,
    unit: "g",
    estimate: { confidence: "low", portionKind: "slice", portionCount: n, reason: "composite", count: n, composite: reference.composite === true }
  }));
  return buildAmbiguity({
    segment,
    kind: "portion",
    foodId: food.id,
    choices,
    fallback: {
      foodId: food.id,
      label: { en: "1 slice", he: "משולש אחד" },
      amount: perSlice,
      unit: "g",
      estimate: { confidence: "low", portionKind: "slice", reason: "composite", count: 1, composite: reference.composite === true }
    }
  });
}

function estimateNaturalPortion(food, parsed, segment) {
  const explicitUnit = normalizeUnit(parsed.unit);
  const size = detectSize(parsed.foodText);
  const portionKind = explicitUnit && !["g", "kg", "ml"].includes(explicitUnit) ? explicitUnit : detectPortionKind(parsed.foodText);
  const explicitWeight = ["g", "kg", "ml"].includes(explicitUnit);
  const trailing = trailingCount(parsed.foodText);
  const hasCount = (parsed.amount !== null && !explicitWeight) || trailing !== null;
  const count = parsed.amount && !explicitWeight
    ? parsed.amount
    : trailing || 1;

  // 1. Explicit weight always wins -- no clarification, no estimate flag.
  if (explicitWeight) return { entry: { ...scaleFood(food, parsed.amount, explicitUnit), rawText: segment, estimated: false, approximate: false } };

  // 2. Brand matters and none was given -> ask once, "I don't know" -> average.
  if (BRAND_CLARIFY_FOODS.has(food.id) && food.source !== "custom" && food.specificity !== "brand") {
    return { ambiguity: brandAmbiguity(food, parsed, segment) };
  }

  // 3. Counted items (egg, rice cake, yogurt cup...) resolve by count.
  if (food.baseUnit === "item") return { entry: { ...scaleFood(food, parsed.amount ?? count, "item"), rawText: segment, estimated: false, approximate: false } };

  const reference = PORTION_REFERENCES[food.id];

  // 4. Whole pizza / tray -> size of the tray.
  if (food.id === "pizza" && portionKind === "whole") {
    return {
      ambiguity: buildAmbiguity({
        segment,
        kind: "portion",
        foodId: food.id,
        choices: PIZZA_WHOLE_CHOICES.map((choice) => ({
          choiceId: choice.id,
          foodId: food.id,
          label: { ...choice.label },
          amount: choice.amount,
          unit: "g",
          estimate: { confidence: "low", composite: true, portionKind: "whole", portionSize: choice.id, reason: "composite" }
        })),
        fallback: { foodId: food.id, label: { en: "I don't know — medium tray", he: "לא יודע — מגש בינוני" }, amount: 800, unit: "g", estimate: { confidence: "low", composite: true, portionKind: "whole", portionSize: "medium", reason: "composite" } }
      })
    };
  }

  if (!reference) {
    if (parsed.amount !== null) return { entry: { ...scaleFood(food, parsed.amount, parsed.unit), rawText: segment, estimated: false, approximate: false } };
    return { entry: { ...scaleFood(food), rawText: segment, estimated: false, approximate: false } };
  }

  // 5. Explicit size word -> resolve directly (e.g. "בטטה בינונית").
  if (size && reference.sizes?.[size]) {
    return { entry: estimateFromReference(food, reference, reference.sizes[size], { count, size, reason: "portion-size", rawText: segment }) };
  }
  // 6. Explicit portion word ("bowl", "plate", "slice") -> resolve directly.
  if (portionKind && reference.portions?.[portionKind]) {
    return { entry: estimateFromReference(food, reference, reference.portions[portionKind], { count, portionKind, reason: "portion-size", rawText: segment }) };
  }
  // 7. Size actually matters and nothing told us which -> compact size question.
  //    A bare count ("half a pita", "2 potatoes") is a quantity signal, not a
  //    size, so fall through to the representative default instead of asking.
  if (reference.sizes && !size && !portionKind && !hasCount) {
    return { ambiguity: sizeAmbiguity(food, reference, segment, count) };
  }
  // 8. Composite with no default and no signal -> "how much?" question.
  if (!reference.default && !reference.sizes) {
    return { ambiguity: portionKindAmbiguity(food, reference, segment) };
  }
  // 9. A sensible representative default exists -> use it as an estimate.
  return { entry: estimateFromReference(food, reference, reference.default, { count, reason: "portion-default", rawText: segment }) };
}

function parseFoodText(value, { customFoods = [] } = {}) {
  const segments = splitFoodInput(value);
  if (!segments.length) return { status: "empty", entries: [], errors: [], ambiguities: [] };
  const catalog = catalogWithCustom(customFoods);
  const entries = [];
  const errors = [];
  const ambiguities = [];

  segments.forEach((segment, segmentIndex) => {
    const parsed = parseAmountPrefix(segment);
    const matches = catalog
      .map((food) => ({ food, match: foodMatches(food, parsed.foodText) }))
      .filter((candidate) => candidate.match)
      .sort((a, b) => b.match.score - a.match.score || foodPriority(b.food) - foodPriority(a.food));
    if (!matches.length) {
      errors.push({ segment, segmentIndex, code: "UNKNOWN_FOOD" });
      return;
    }
    const bestScore = matches[0].match.score;
    const bestPriority = foodPriority(matches[0].food);
    const best = matches.filter((candidate) => candidate.match.score === bestScore && foodPriority(candidate.food) === bestPriority);
    if (best.length > 1) {
      const options = best.map(({ food }) => ({ choiceId: food.id, foodId: food.id, label: { ...food.name }, amount: parsed.amount, unit: parsed.unit }));
      ambiguities.push({
        ...buildAmbiguity({
          segment,
          kind: "match",
          foodId: options[0].foodId,
          choices: options,
          fallback: { foodId: options[0].foodId, label: { ...best[0].food.name }, amount: parsed.amount, unit: parsed.unit }
        }),
        segmentIndex,
        amount: parsed.amount,
        unit: parsed.unit
      });
      return;
    }
    try {
      const resolution = estimateNaturalPortion(best[0].food, parsed, segment);
      if (resolution.ambiguity) {
        ambiguities.push({ ...resolution.ambiguity, segmentIndex, amount: parsed.amount, unit: parsed.unit });
        return;
      }
      if (resolution.error) {
        errors.push({ segment, segmentIndex, code: resolution.error });
        return;
      }
      entries.push(resolution.entry);
    } catch (error) {
      errors.push({ segment, segmentIndex, code: error.message });
    }
  });

  return {
    status: ambiguities.length ? "needs-clarification" : errors.length ? "partial" : "ready",
    entries,
    errors,
    ambiguities
  };
}

function resolveFoodChoice(foodId, { amount = null, unit = "", customFoods = [], estimate = null, rawText = "" } = {}) {
  const food = catalogWithCustom(customFoods).find((item) => item.id === foodId);
  if (!food) throw new Error("UNKNOWN_FOOD");
  if (estimate) return estimatedEntry(food, amount, {
    count: estimate.count || 1,
    size: estimate.portionSize || "",
    portionKind: estimate.portionKind || "",
    confidence: estimate.confidence || "low",
    composite: estimate.composite === true,
    reason: estimate.reason || "",
    unit: estimate.unit || "g",
    rawText
  });
  return { ...scaleFood(food, amount, unit), rawText, estimated: false, approximate: false };
}

function totalsForEntries(entries = []) {
  return entries.reduce((totals, entry) => ({
    calories: round(totals.calories + Number(entry.calories || 0)),
    proteinGrams: round(totals.proteinGrams + Number(entry.proteinGrams || 0)),
    carbsGrams: round(totals.carbsGrams + Number(entry.carbsGrams || 0)),
    fatGrams: round(totals.fatGrams + Number(entry.fatGrams || 0))
  }), { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
}

function macroEnergyPercentages(totals = {}) {
  const energy = {
    protein: Number(totals.proteinGrams || 0) * 4,
    carbs: Number(totals.carbsGrams || 0) * 4,
    fat: Number(totals.fatGrams || 0) * 9
  };
  const total = energy.protein + energy.carbs + energy.fat;
  if (!total) return { protein: 0, carbs: 0, fat: 0, macroCalories: 0 };
  return {
    protein: round((energy.protein / total) * 100),
    carbs: round((energy.carbs / total) * 100),
    fat: round((energy.fat / total) * 100),
    macroCalories: round(total)
  };
}

function remainingAgainstTargets(totals = {}, targets = {}) {
  return {
    calories: round(Number(targets.dailyCalories || 0) - Number(totals.calories || 0)),
    proteinGrams: round(Number(targets.proteinGrams || 0) - Number(totals.proteinGrams || 0)),
    carbsGrams: round(Number(targets.carbsGrams || 0) - Number(totals.carbsGrams || 0)),
    fatGrams: round(Number(targets.fatGrams || 0) - Number(totals.fatGrams || 0))
  };
}

function classifyEstimatedBalance(consumedCalories, maintenanceCalories, neutralBand = 100) {
  const consumed = Number(consumedCalories);
  const maintenance = Number(maintenanceCalories);
  if (!Number.isFinite(consumed) || !Number.isFinite(maintenance) || maintenance <= 0) return { status: "unknown", balance: null, neutralBand };
  const balance = round(consumed - maintenance, 0);
  return {
    status: balance < -neutralBand ? "deficit" : balance > neutralBand ? "surplus" : "maintenance",
    balance,
    neutralBand
  };
}

function localDateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) throw new Error("INVALID_DATE");
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
}

function shiftDateKey(dateKey, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) throw new Error("INVALID_DATE_KEY");
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  date.setDate(date.getDate() + Number(days || 0));
  return localDateKey(date);
}

function weekDateKeys(anchorDateKey) {
  return Array.from({ length: 7 }, (_, index) => shiftDateKey(anchorDateKey, index - 6));
}

function weeklySummary(logs = []) {
  const relevant = logs.filter((log) => Array.isArray(log?.entries) && log.entries.length > 0);
  const total = relevant.reduce((summary, log) => {
    const totals = log.totals || totalsForEntries(log.entries);
    const maintenance = Number(log.maintenanceSnapshot || log.targetSnapshot?.maintenanceCalories || 0);
    return {
      calories: summary.calories + Number(totals.calories || 0),
      proteinGrams: summary.proteinGrams + Number(totals.proteinGrams || 0),
      carbsGrams: summary.carbsGrams + Number(totals.carbsGrams || 0),
      fatGrams: summary.fatGrams + Number(totals.fatGrams || 0),
      maintenance: summary.maintenance + (maintenance > 0 ? maintenance : 0),
      maintenanceDays: summary.maintenanceDays + (maintenance > 0 ? 1 : 0),
      balance: summary.balance + (maintenance > 0 ? Number(totals.calories || 0) - maintenance : 0),
      completedDays: summary.completedDays + (log.completed ? 1 : 0)
    };
  }, { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, maintenance: 0, maintenanceDays: 0, balance: 0, completedDays: 0 });
  const denominator = relevant.length;
  const average = (value) => denominator ? round(value / denominator) : 0;
  const averageMaintenance = total.maintenanceDays ? round(total.maintenance / total.maintenanceDays) : null;
  const averageBalance = total.maintenanceDays ? round(total.balance / total.maintenanceDays) : null;
  const averageCalories = average(total.calories);
  return {
    loggedDays: denominator,
    completedDays: total.completedDays,
    averageCalories,
    averageProteinGrams: average(total.proteinGrams),
    averageCarbsGrams: average(total.carbsGrams),
    averageFatGrams: average(total.fatGrams),
    averageMaintenance,
    averageBalance,
    balanceStatus: averageBalance === null ? "unknown" : classifyEstimatedBalance(averageMaintenance + averageBalance, averageMaintenance).status
  };
}

function recentFoodsFromLogs(logs = [], limit = 8) {
  const seen = new Set();
  const recents = [];
  for (const log of logs) {
    for (const entry of [...(log.entries || [])].reverse()) {
      const key = entry.foodId || normalizeText(entry.name?.en || entry.name?.he || "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      recents.push({ ...entry });
      if (recents.length >= limit) return recents;
    }
  }
  return recents;
}

function validateCustomFood(input = {}) {
  const name = String(input.name || "").trim().slice(0, 80);
  const baseAmount = Number(input.baseAmount);
  const baseUnit = normalizeUnit(input.baseUnit);
  const macros = {
    calories: Number(input.calories),
    protein: Number(input.proteinGrams),
    carbs: Number(input.carbsGrams),
    fat: Number(input.fatGrams)
  };
  if (!name || !Number.isFinite(baseAmount) || baseAmount <= 0 || !baseUnit) throw new Error("INVALID_CUSTOM_FOOD");
  if (Object.values(macros).some((value) => !Number.isFinite(value) || value < 0 || value > 10000)) throw new Error("INVALID_CUSTOM_FOOD");
  return {
    id: String(input.id || `custom-${normalizeText(name).replace(/[^a-z0-9\u0590-\u05ff]+/gu, "-")}`).slice(0, 100),
    name: { en: name, he: String(input.nameHe || name).trim().slice(0, 80) },
    aliases: [name, input.nameHe].filter(Boolean),
    baseAmount: round(baseAmount, 2),
    baseUnit,
    macros,
    favorite: input.favorite === true,
    source: "custom"
  };
}

function targetSnapshot({ activePlan = null, calculatedTargets = null } = {}) {
  const raw = activePlan?.plan || activePlan || calculatedTargets || {};
  const maintenance = Number(raw.maintenanceCalories || raw.tdee || activePlan?.calculationSnapshot?.tdee || calculatedTargets?.tdee || 0);
  const result = {
    dailyCalories: Number(raw.dailyCalories || 0) || null,
    proteinGrams: Number(raw.proteinGrams || 0) || null,
    carbsGrams: Number(raw.carbsGrams || 0) || null,
    fatGrams: Number(raw.fatGrams || 0) || null,
    maintenanceCalories: maintenance > 0 ? maintenance : null,
    source: activePlan ? "active-plan" : calculatedTargets ? "athlete-core" : "missing"
  };
  result.complete = Boolean(result.dailyCalories && result.proteinGrams);
  return result;
}

export {
  FOOD_CATALOG,
  PIZZA_WHOLE_CHOICES,
  PORTION_REFERENCES,
  classifyEstimatedBalance,
  localDateKey,
  macroEnergyPercentages,
  normalizeText,
  normalizeUnit,
  parseFoodText,
  recentFoodsFromLogs,
  remainingAgainstTargets,
  resolveFoodChoice,
  scaleFood,
  shiftDateKey,
  splitFoodInput,
  targetSnapshot,
  totalsForEntries,
  validateCustomFood,
  weekDateKeys,
  weeklySummary
};
