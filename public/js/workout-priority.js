export const PRIORITY_BY_GOAL = Object.freeze({
  buildMuscle: "hypertrophy",
  increaseStrength: "strength",
  improveSkills: "skills",
  loseFat: "generalFitness",
  maintainPerformance: "generalFitness"
});

export function derivePriorityFromGoal(goal) {
  const key = String(goal || "").trim();
  return PRIORITY_BY_GOAL[key] || "generalFitness";
}
