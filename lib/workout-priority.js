"use strict";

const PRIORITY_BY_GOAL = Object.freeze({
  buildMuscle: "hypertrophy",
  increaseStrength: "strength",
  improveSkills: "skills",
  loseFat: "generalFitness",
  maintainPerformance: "generalFitness"
});

function derivePriorityFromGoal(goal) {
  const key = String(goal || "").trim();
  return PRIORITY_BY_GOAL[key] || "generalFitness";
}

module.exports = {
  PRIORITY_BY_GOAL,
  derivePriorityFromGoal
};
