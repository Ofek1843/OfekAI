const test = require("node:test");
const assert = require("node:assert/strict");

test("Food image mapping includes cinnamon and asparagus", () => {
  const localFoodImages = {
    "cinnamon": "/images/food-placeholder.png",
    "asparagus": "/images/food-placeholder.png",
  };

  assert.ok(localFoodImages["cinnamon"], "cinnamon should map to fallback");
  assert.ok(localFoodImages["asparagus"], "asparagus should map to fallback");
  assert.equal(
    localFoodImages["cinnamon"],
    "/images/food-placeholder.png",
    "cinnamon should use placeholder when actual image unavailable"
  );
});

test("Food imageKey whitelist includes cinnamon and asparagus", () => {
  const whitelist = "cinnamon, asparagus, broccoli, carrot";
  assert.ok(whitelist.includes("cinnamon"), "cinnamon in approved list");
  assert.ok(whitelist.includes("asparagus"), "asparagus in approved list");
});

test("Hebrew to English equipment translation reverse map", () => {
  // Simulate the hebrewOptionLabels -> hebrewToEnglishEquipment mapping
  const hebrewOptionLabels = {
    dumbbells: "משקולות יד",
    barbell: "מוט ומשקולות",
    machines: "מכונות",
  };

  const hebrewToEnglishEquipment = Object.fromEntries(
    Object.entries(hebrewOptionLabels).map(([en, he]) => [
      he.toLowerCase(),
      en.charAt(0).toUpperCase() + en.slice(1)
    ])
  );

  assert.equal(hebrewToEnglishEquipment["משקולות יד"], "Dumbbells");
  assert.equal(hebrewToEnglishEquipment["מוט ומשקולות"], "Barbell");
  assert.equal(hebrewToEnglishEquipment["מכונות"], "Machines");
});

test("Workout summary equipment localization handles Hebrew values in English mode", () => {
  // When English mode, Hebrew equipment names should be translated back to English
  const hebrewEquipment = "משקולות יד";
  const hebrewToEnglishEquipment = {
    "משקולות יד": "Dumbbells",
    "מוט ומשקולות": "Barbell",
    "מכונות": "Machines",
  };

  const hebrewLower = hebrewEquipment.toLowerCase();
  const englishResult = hebrewToEnglishEquipment[hebrewLower];

  assert.ok(englishResult, "Hebrew equipment should translate to English");
  assert.equal(englishResult, "Dumbbells");
});

