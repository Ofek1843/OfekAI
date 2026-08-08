const test = require("node:test");
const assert = require("node:assert/strict");
const { assessSafety, cleanSafetyText } = require("../lib/health-safety");

test("safety guard permits ordinary preference text without diagnosing it", () => {
  assert.deepEqual(assessSafety({ text: "Avoid peanuts and overhead presses; I prefer vegetarian meals." }), { allowed: true });
  assert.equal(cleanSafetyText("  a\u0000  b "), "a b");
});

test("safety guard blocks deterministic urgent, allergy, pregnancy, eating-disorder and acute-injury signals", () => {
  for (const [text, code] of [
    ["I have chest pain when training", "urgent_symptoms"],
    ["I carry an EpiPen for severe allergic reactions", "severe_allergy"],
    ["I am pregnant", "pregnancy"],
    ["I have anorexia", "eating_disorder"],
    ["I have a torn tendon", "acute_injury"]
  ]) {
    const result = assessSafety({ text });
    assert.equal(result.allowed, false, text);
    assert.equal(result.code, code);
    assert.match(result.message, /can’t safely generate/i);
  }
});
