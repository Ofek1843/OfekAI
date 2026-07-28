"use strict";

// Single source of truth: all backend exercise aliases live in the release
// catalog so image routing, repair and weekly-volume credits cannot drift.
const { WORKOUT_EXERCISE_ALIAS_MAP } = require("./workout-exercise-catalog");

const EXERCISE_NAME_ALIASES = { ...WORKOUT_EXERCISE_ALIAS_MAP };

module.exports = { EXERCISE_NAME_ALIASES };
