"use strict";

// Minimum technical experience; external load is still scaled by reps/RIR.
const LEVELS = { beginner: 0, intermediate: 1, advanced: 2, professional: 3 };
const MINIMUM_LEVEL = {
  "planche": 3, "straddle-planche": 3, "one-arm-pull-up": 3,
  "front-lever": 2, "front-lever-raise": 2, "muscle-up": 2,
  "ring-muscle-up": 2, "handstand-push-up": 2, "typewriter-pull-ups": 2,
  "dragon-flag": 2, "pistol-squat": 1, "nordic-hamstring-curl": 1,
  "ring-dip": 1, "archer-push-up": 1, "pseudo-planche-push-up": 1,
  "toes-to-bar": 1, "sissy-squat": 1, "handstand": 1, "l-sit": 1
};

function isExerciseLevelSuitable(exerciseId, experience) {
  // Legacy saved plans may not carry experience; preserve their readability.
  if (!experience) return true;
  const level = LEVELS[String(experience).trim().toLowerCase()] ?? LEVELS.beginner;
  return level >= (MINIMUM_LEVEL[exerciseId] || 0);
}

function eligibleExerciseCatalog(equipment = [], experience) {
  const { getEnabledPublicExerciseIds, getCatalogExercise } = require("./workout-exercise-catalog");
  const { normalizeEquipment } = require("./workout-validator");
  const allowed = new Set(equipment.map(normalizeEquipment));
  return getEnabledPublicExerciseIds().filter(id => isExerciseLevelSuitable(id, experience))
    .map(getCatalogExercise).filter(entry => allowed.has(normalizeEquipment(entry.equipment)));
}

module.exports = { isExerciseLevelSuitable, eligibleExerciseCatalog, MINIMUM_LEVEL };
