const round = (value, precision = 1) => {
  const factor = 10 ** precision;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const FOOD_CATALOG = Object.freeze([
  { id: "oats", name: { en: "Oats", he: "שיבולת שועל" }, aliases: ["oats", "oatmeal", "rolled oats", "שיבולת שועל", "קוואקר"], baseAmount: 100, baseUnit: "g", macros: { calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9 } },
  { id: "cottage-3", name: { en: "Cottage cheese 3%", he: "קוטג׳ 3%" }, aliases: ["cottage cheese 3%", "cottage 3%", "3% cottage", "קוטג 3%", "קוטג׳ 3%", "קוטג", "קוטג׳", "cottage", "cottage cheese"], baseAmount: 100, baseUnit: "g", macros: { calories: 84, protein: 11.5, carbs: 3, fat: 3 } },
  { id: "cottage-5", name: { en: "Cottage cheese 5%", he: "קוטג׳ 5%" }, aliases: ["cottage cheese 5%", "cottage 5%", "5% cottage", "קוטג 5%", "קוטג׳ 5%", "קוטג", "קוטג׳", "cottage", "cottage cheese"], baseAmount: 100, baseUnit: "g", macros: { calories: 100, protein: 11.5, carbs: 3, fat: 5 } },
  { id: "rice-cake", name: { en: "Rice cake", he: "פריכית אורז" }, aliases: ["rice cake", "rice cakes", "פריכית", "פריכיות", "פריכית אורז", "פריכיות אורז"], baseAmount: 1, baseUnit: "item", macros: { calories: 35, protein: 0.7, carbs: 7.3, fat: 0.3 } },
  { id: "protein-drink", name: { en: "Protein drink", he: "משקה חלבון" }, aliases: ["protein drink", "protein shake", "protein bottle", "משקה חלבון", "שייק חלבון"], baseAmount: 1, baseUnit: "item", macros: { calories: 160, protein: 25, carbs: 8, fat: 3 } },
  { id: "high-protein-yogurt", name: { en: "High-protein yogurt", he: "יוגורט חלבון" }, aliases: ["high protein yogurt", "protein yogurt", "greek yogurt", "יוגורט חלבון", "יוגורט פרו", "יוגורט יווני"], baseAmount: 1, baseUnit: "item", macros: { calories: 150, protein: 20, carbs: 12, fat: 2 } },
  { id: "banana", name: { en: "Banana", he: "בננה" }, aliases: ["banana", "bananas", "בננה", "בננות"], baseAmount: 1, baseUnit: "item", macros: { calories: 105, protein: 1.3, carbs: 27, fat: 0.4 } },
  { id: "apple", name: { en: "Apple", he: "תפוח" }, aliases: ["apple", "apples", "תפוח", "תפוחים"], baseAmount: 1, baseUnit: "item", macros: { calories: 95, protein: 0.5, carbs: 25, fat: 0.3 } },
  { id: "tuna-water", name: { en: "Tuna in water", he: "טונה במים" }, aliases: ["tuna in water", "tuna", "טונה במים", "טונה"], baseAmount: 100, baseUnit: "g", macros: { calories: 116, protein: 26, carbs: 0, fat: 1 } },
  { id: "pita", name: { en: "Pita", he: "פיתה" }, aliases: ["pita", "pitta", "פיתה", "פיתות"], baseAmount: 1, baseUnit: "item", macros: { calories: 165, protein: 5.5, carbs: 33, fat: 1 } },
  { id: "bread-slice", name: { en: "Bread slice", he: "פרוסת לחם" }, aliases: ["bread slice", "slice of bread", "bread", "פרוסת לחם", "לחם"], baseAmount: 1, baseUnit: "item", macros: { calories: 80, protein: 3, carbs: 14, fat: 1 } },
  { id: "white-cheese-5", name: { en: "White cheese 5%", he: "גבינה לבנה 5%" }, aliases: ["white cheese 5%", "white cheese", "גבינה לבנה 5%", "גבינה לבנה"], baseAmount: 100, baseUnit: "g", macros: { calories: 100, protein: 9, carbs: 3, fat: 5 } },
  { id: "egg", name: { en: "Egg", he: "ביצה" }, aliases: ["egg", "eggs", "ביצה", "ביצים"], baseAmount: 1, baseUnit: "item", macros: { calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 } },
  { id: "hummus", name: { en: "Hummus", he: "חומוס" }, aliases: ["hummus", "humus", "חומוס"], baseAmount: 100, baseUnit: "g", macros: { calories: 166, protein: 7.9, carbs: 14.3, fat: 9.6 } },
  { id: "turkey-pastrami", name: { en: "Turkey pastrami", he: "פסטרמה הודו" }, aliases: ["turkey pastrami", "turkey slices", "pastrami", "פסטרמה הודו", "פסטרמה"], baseAmount: 100, baseUnit: "g", macros: { calories: 120, protein: 21, carbs: 3, fat: 3 } },
  { id: "ready-rice", name: { en: "Cooked rice", he: "אורז מוכן" }, aliases: ["ready rice", "cooked rice", "rice", "אורז מוכן", "אורז מבושל", "אורז"], baseAmount: 100, baseUnit: "g", macros: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 } },
  { id: "ready-chicken", name: { en: "Cooked chicken breast", he: "חזה עוף מוכן" }, aliases: ["ready chicken", "cooked chicken", "chicken breast", "חזה עוף מוכן", "חזה עוף"], baseAmount: 100, baseUnit: "g", macros: { calories: 165, protein: 31, carbs: 0, fat: 3.6 } }
]);

const UNIT_ALIASES = new Map([
  ["g", "g"], ["gr", "g"], ["gram", "g"], ["grams", "g"], ["גרם", "g"], ["גרמים", "g"],
  ["kg", "kg"], ["kilogram", "kg"], ["kilograms", "kg"], ["קג", "kg"], ["קילו", "kg"],
  ["ml", "ml"], ["milliliter", "ml"], ["milliliters", "ml"], ["מל", "ml"],
  ["item", "item"], ["items", "item"], ["unit", "item"], ["units", "item"], ["יחידה", "item"], ["יחידות", "item"]
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

function splitFoodInput(value) {
  return String(value || "")
    .replace(/[;+]/g, ",")
    .replace(/\s+and\s+/giu, ",")
    .replace(/\s+ו-?\s*(?=\d)/gu, ",")
    .replace(/\s+ו\s+(?=[\u0590-\u05ff])/gu, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseAmountPrefix(segment) {
  const match = normalizeText(segment).match(/^(\d+(?:[.,]\d+)?)\s*([a-z\u0590-\u05ff.'״׳]*)\s+(.+)$/iu);
  if (!match) return { amount: null, unit: "", foodText: normalizeText(segment) };
  const amount = Number(match[1].replace(",", "."));
  const unit = normalizeUnit(match[2]);
  if (match[2] && !unit) return { amount, unit: "", foodText: normalizeText(`${match[2]} ${match[3]}`) };
  return { amount, unit, foodText: normalizeText(match[3]) };
}

function catalogWithCustom(customFoods = []) {
  return [...FOOD_CATALOG, ...customFoods.map((food) => ({
    ...food,
    id: String(food.id || "").trim(),
    name: typeof food.name === "object" ? food.name : { en: String(food.name || ""), he: String(food.name || "") },
    aliases: [...new Set([...(food.aliases || []), food.name?.en, food.name?.he, typeof food.name === "string" ? food.name : ""].filter(Boolean))],
    baseAmount: Number(food.baseAmount) || 1,
    baseUnit: normalizeUnit(food.baseUnit) || "item"
  }))];
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
    source: food.source || (String(food.id).startsWith("custom-") ? "custom" : "catalog")
  };
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
      .sort((a, b) => b.match.score - a.match.score);
    if (!matches.length) {
      errors.push({ segment, segmentIndex, code: "UNKNOWN_FOOD" });
      return;
    }
    const bestScore = matches[0].match.score;
    const best = matches.filter((candidate) => candidate.match.score === bestScore);
    if (best.length > 1) {
      ambiguities.push({
        segment,
        segmentIndex,
        amount: parsed.amount,
        unit: parsed.unit,
        choices: best.map(({ food }) => ({ foodId: food.id, name: { ...food.name } }))
      });
      return;
    }
    try {
      entries.push({ ...scaleFood(best[0].food, parsed.amount, parsed.unit), rawText: segment });
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

function resolveFoodChoice(foodId, { amount = null, unit = "", customFoods = [] } = {}) {
  const food = catalogWithCustom(customFoods).find((item) => item.id === foodId);
  if (!food) throw new Error("UNKNOWN_FOOD");
  return scaleFood(food, amount, unit);
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
      completedDays: summary.completedDays + (log.completed ? 1 : 0)
    };
  }, { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, maintenance: 0, maintenanceDays: 0, completedDays: 0 });
  const denominator = relevant.length;
  const average = (value) => denominator ? round(value / denominator) : 0;
  const averageMaintenance = total.maintenanceDays ? round(total.maintenance / total.maintenanceDays) : null;
  const averageCalories = average(total.calories);
  return {
    loggedDays: denominator,
    completedDays: total.completedDays,
    averageCalories,
    averageProteinGrams: average(total.proteinGrams),
    averageCarbsGrams: average(total.carbsGrams),
    averageFatGrams: average(total.fatGrams),
    averageMaintenance,
    averageBalance: averageMaintenance === null ? null : round(averageCalories - averageMaintenance),
    balanceStatus: averageMaintenance === null ? "unknown" : classifyEstimatedBalance(averageCalories, averageMaintenance).status
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
