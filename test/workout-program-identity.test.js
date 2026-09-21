"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classifySessionSplit,
  deriveProgramSplitName
} = require("../lib/workout-program-identity");

const named = (name) => ({ name, exercises: [] });

test("program identity uses the actual Upper / Lower sessions instead of a generic goal title", () => {
  assert.equal(deriveProgramSplitName([named("Upper A"), named("Lower A"), named("Upper B"), named("Lower B")]), "Upper / Lower");
  assert.equal(deriveProgramSplitName([named("Upper A"), named("Lower A")], "he"), "פלג גוף עליון / תחתון");
});

test("program identity represents truthful split combinations", () => {
  assert.equal(
    deriveProgramSplitName([named("Push Day"), named("Pull Day"), named("Leg Day")]),
    "Push / Pull / Legs"
  );
  assert.equal(
    deriveProgramSplitName([named("Full Body"), named("Upper"), named("Lower")]),
    "Full Body + Upper / Lower"
  );
  assert.equal(
    deriveProgramSplitName([named("Push"), named("Pull"), named("Legs"), named("Upper"), named("Lower")]),
    "Push / Pull / Legs + Upper / Lower"
  );
});

test("session identity falls back to catalog-mapped exercise structure when a provider returns Day 1", () => {
  const session = {
    name: "Day 1",
    exercises: [
      { exerciseId: "machine-chest-press" },
      { exerciseId: "leg-press" }
    ]
  };
  assert.equal(classifySessionSplit(session), "full");
  assert.equal(deriveProgramSplitName([session]), "Full Body");
});
