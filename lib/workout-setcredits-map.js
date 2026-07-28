"use strict";

// Public Workout Builder set-credit map is derived from the central exercise
// catalog. Exercises without verified dedicated media stay out of public
// generation and out of this map until their exact image is added.
const { getPublicSetCredits } = require("./workout-exercise-catalog");

const EXERCISE_SETCREDITS = getPublicSetCredits();

module.exports = { EXERCISE_SETCREDITS };
