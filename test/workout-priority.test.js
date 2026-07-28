"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { derivePriorityFromGoal } = require("../lib/workout-priority");

test("derivePriorityFromGoal maps removed wizard priority semantics deterministically", () => {
  assert.equal(derivePriorityFromGoal("buildMuscle"), "hypertrophy");
  assert.equal(derivePriorityFromGoal("increaseStrength"), "strength");
  assert.equal(derivePriorityFromGoal("improveSkills"), "skills");
  assert.equal(derivePriorityFromGoal("loseFat"), "generalFitness");
  assert.equal(derivePriorityFromGoal("maintainPerformance"), "generalFitness");
});

test("derivePriorityFromGoal falls back safely when priority is missing", () => {
  assert.equal(derivePriorityFromGoal(""), "generalFitness");
  assert.equal(derivePriorityFromGoal(null), "generalFitness");
  assert.equal(derivePriorityFromGoal("unknownGoal"), "generalFitness");
});
