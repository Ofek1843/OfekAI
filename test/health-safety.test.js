const test = require("node:test");
const assert = require("node:assert/strict");
const { assessSafety, cleanSafetyText } = require("../lib/health-safety");

test("ordinary preferences and allergy exclusions remain usable", () => {
  const result = assessSafety({ text: "I have a peanut allergy; avoid peanuts. I prefer vegetarian meals.", route: "nutrition" });
  assert.equal(result.allowed, true);
  assert.equal(result.action, "ALLOW_WITH_CAUTION");
  assert.equal(cleanSafetyText("  a\u0000  b "), "a b");
});

test("current urgent symptoms receive an urgent, category-specific restriction", () => {
  const result = assessSafety({ text: "I am having severe chest pain right now", route: "workout" });
  assert.equal(result.allowed, false);
  assert.equal(result.category, "urgent_symptoms");
  assert.equal(result.status, "CURRENT_HIGH_RISK");
  assert.equal(result.action, "URGENT_SAFETY_RESPONSE");
  assert.match(result.message, /urgent|emergency/i);
});

test("historical, educational, and third-person contexts are not emergency blocked", () => {
  for (const [text, category] of [
    ["I fainted once years ago and was medically cleared.", null],
    ["Explain pregnancy fitness generally.", "pregnancy"],
    ["My wife is pregnant.", "pregnancy"],
    ["I used to have an eating disorder and have been recovered for years.", "eating_disorder"],
    ["I tore my ACL six years ago, recovered and medically cleared.", "acute_injury"]
  ]) {
    const result = assessSafety({ text, route: "workout" });
    assert.equal(result.allowed, true, text);
    if (category) assert.equal(result.category, category, text);
  }
});

test("current personalized pregnancy, eating-disorder, and acute-injury requests are restricted", () => {
  for (const [text, category] of [
    ["I'm pregnant; build me an aggressive fat-loss program.", "pregnancy"],
    ["I currently have anorexia and need a rapid calorie-cut plan.", "eating_disorder"],
    ["I tore my ACL yesterday; give me a heavy leg workout.", "acute_injury"]
  ]) {
    const result = assessSafety({ text, route: "workout" });
    assert.equal(result.allowed, false, text);
    assert.equal(result.category, category, text);
    assert.equal(result.action, "RESTRICT_PERSONALIZED_PLAN", text);
  }
});

test("Hebrew safety copy remains localized without diagnosing", () => {
  const result = assessSafety({ text: "I am pregnant", language: "he", route: "nutrition" });
  assert.equal(result.allowed, false);
  assert.match(result.message, /[\u0590-\u05ff]/);
  assert.doesNotMatch(result.message, /diagnos/i);
});
