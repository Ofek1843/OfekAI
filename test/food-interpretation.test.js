const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  FOOD_INTERPRETATION_MODEL,
  MAX_FOOD_TEXT_LENGTH,
  foodInterpretationMessages,
  heuristicFoodInterpretation,
  selectFoodInterpretationModel,
  sanitizeFoodInterpretation
} = require("../lib/food-interpretation");

test("AI food interpretation defaults to the app's supported GPT-4-class model and bounds input", () => {
  assert.equal(FOOD_INTERPRETATION_MODEL, "gpt-4.1-mini");
  const messages = foodInterpretationMessages({ text: "אינג'רה ".repeat(100), language: "he" });
  assert.equal(messages.length, 3);
  assert.match(messages[0].content, /regional foods \(for example injera\)/);
  assert.ok(messages.at(-1).content.length <= 220 + MAX_FOOD_TEXT_LENGTH);
  assert.match(messages.at(-1).content, /Unknown food text: /);
});

test("food interpretation follows the deployment's available model configuration", () => {
  assert.equal(selectFoodInterpretationModel({ OPENAI_FOOD_MODEL: "gpt-food", OPENAI_CHAT_MODEL: "gpt-chat" }), "gpt-food");
  assert.equal(selectFoodInterpretationModel({ OPENAI_CHAT_MODEL: "gpt-4.1-mini" }), "gpt-4.1-mini");
  assert.equal(selectFoodInterpretationModel({}), FOOD_INTERPRETATION_MODEL);
});

test("AI food fallback passes the selected supported language and spelled-quantity guidance", () => {
  for (const [language, expected] of [["en", "English"], ["he", "Hebrew"], ["es", "Spanish"], ["fr", "French"], ["de", "German"], ["ar", "Arabic"], ["zh", "Simplified Chinese"]]) {
    const messages = foodInterpretationMessages({ text: "forty grams of an unfamiliar food", language });
    assert.match(messages.at(-1).content, new RegExp(`interface language: ${expected}`));
    assert.match(messages.at(-1).content, /quantity may be written in any supported language/);
    assert.match(messages.at(-1).content, /Preserve any explicit weight/);
  }
});

test("AI food interpretation accepts a bounded representative food and always supplies an average", () => {
  const parsed = sanitizeFoodInterpretation({
    recognized: true,
    food: { name: { en: "Injera", he: "אינג'רה" }, aliases: ["injera", "אינג׳רה"] },
    nutritionPer100g: { calories: 170, proteinGrams: 5, carbsGrams: 35, fatGrams: 1 },
    portion: {
      kind: "serving",
      defaultGrams: 90,
      choices: [{ id: "small", label: { en: "Small piece", he: "חתיכה קטנה" }, grams: 45 }]
    },
    confidence: "medium",
    reason: "Representative plain injera"
  });
  assert.equal(parsed.food.name.he, "אינג'רה");
  assert.equal(parsed.nutritionPer100g.calories, 170);
  assert.equal(parsed.portion.choices.at(-1).id, "average");
  assert.equal(parsed.portion.choices.at(-1).grams, 90);
});

test("food interpretation keeps plausible specific snack wording usable when the model cannot classify it", () => {
  const parsed = heuristicFoodInterpretation("חטיף שוקולד גרנול", { language: "he" });
  assert.equal(parsed.recognized, true);
  assert.equal(parsed.confidence, "low");
  assert.equal(parsed.nutritionPer100g.calories, 450);
  assert.equal(parsed.portion.defaultGrams, 40);
  assert.equal(parsed.portion.choices.at(-1).id, "average");
});

test("local food fallback keeps common foods loggable during an AI outage", () => {
  const cheesecake = heuristicFoodInterpretation("Cheese cake", { language: "en" });
  const pomegranate = heuristicFoodInterpretation("רימון", { language: "he" });
  assert.equal(cheesecake.recognized, true);
  assert.equal(cheesecake.nutritionPer100g.calories, 321);
  assert.equal(cheesecake.portion.defaultGrams, 120);
  assert.equal(pomegranate.recognized, true);
  assert.equal(pomegranate.confidence, "low");
});

test("food interpretation does not invent a generic estimate for clearly non-food text", () => {
  assert.equal(heuristicFoodInterpretation("hello there", { language: "en" }), null);
});

test("keyword outage fallback never substitutes one ingredient for a package or filled meal", () => {
  for (const text of ["חבילת פריכיות", "באגט עם שניצל", "package of chocolate", "bread with chicken"]) {
    assert.equal(heuristicFoodInterpretation(text), null, text);
  }
});

test("AI food interpretation refuses unsafe, incoherent, or unrecognized data", () => {
  assert.equal(sanitizeFoodInterpretation({ recognized: false }), null);
  assert.equal(sanitizeFoodInterpretation({
    recognized: true,
    food: { name: { en: "Impossible", he: "לא אפשרי" } },
    nutritionPer100g: { calories: 10, proteinGrams: 100, carbsGrams: 100, fatGrams: 100 },
    portion: { defaultGrams: 100 }
  }), null);
  assert.equal(sanitizeFoodInterpretation({
    recognized: true,
    food: { name: { en: "Food", he: "מזון" } },
    nutritionPer100g: { calories: 100, proteinGrams: 5, carbsGrams: 12, fatGrams: 2 },
    portion: { defaultGrams: 2000 }
  }), null);
});

test("daily food fallback is authenticated, rate-limited, model-configurable, and does not expose a missing key", () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  assert.match(server, /app\.post\("\/api\/daily-nutrition\/interpret-food"/);
  assert.match(server, /requireFirebaseUser\(req, res\)/);
  assert.match(server, /rateLimiters\.ai\(req, user\.uid\)/);
  assert.match(server, /selectFoodInterpretationModel\(process\.env\)/);
  assert.match(server, /SMART_FOOD_UNAVAILABLE/);
  assert.match(server, /heuristicFoodInterpretation/);
  assert.match(server, /if \(localEstimate\) return res\.json\(\{ interpretation: localEstimate \}\)/);
  assert.match(server, /upstreamCode: error\.upstreamCode/);
  assert.doesNotMatch(server, /res\.status\(500\)\.json\(\{ error: "OPENAI_API_KEY is missing" \}\);[\s\S]*daily-food-interpretation/);
});
