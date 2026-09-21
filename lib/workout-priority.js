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

// Requests normally use the canonical `loseFat` value, but a saved plan or
// a provider response can carry a human-readable variant.  Keep this small
// normalizer separate from priority: both fat loss and maintenance share the
// general-fitness volume family, while only fat loss gets the fatigue-aware
// cutting prescription.
function isFatLossGoal(goal) {
  const key = String(goal || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[ _-]+/g, "");
  return ["losefat", "fatloss", "cut", "cutting", "חיטוב", "ירידהבאחוזישומן"].includes(key);
}

module.exports = {
  PRIORITY_BY_GOAL,
  derivePriorityFromGoal,
  isFatLossGoal
};
