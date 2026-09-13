const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  FOOD_INTERPRETATION_MODEL,
  MAX_FOOD_TEXT_LENGTH,
  foodInterpretationMessages,
  sanitizeFoodInterpretation
} = require("../lib/food-interpretation");

test("AI food interpretation defaults to the approved low-cost model and bounds input", () => {
  assert.equal(FOOD_INTERPRETATION_MODEL, "gpt-4o-mini");
  const messages = foodInterpretationMessages({ text: "אינג'רה ".repeat(100), language: "he" });
  assert.equal(messages.length, 2);
  assert.match(messages[0].content, /regional foods \(for example injera\)/);
  assert.ok(messages[1].content.length <= "Unknown food text: ".length + MAX_FOOD_TEXT_LENGTH);
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
  assert.match(server, /process\.env\.OPENAI_FOOD_MODEL \|\| FOOD_INTERPRETATION_MODEL/);
  assert.match(server, /SMART_FOOD_UNAVAILABLE/);
  assert.doesNotMatch(server, /res\.status\(500\)\.json\(\{ error: "OPENAI_API_KEY is missing" \}\);[\s\S]*daily-food-interpretation/);
});
