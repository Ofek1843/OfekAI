"use strict";

// Build-time editorial examples only. No account data, API calls or live AI output.
// Exercise identities and meal arithmetic come from the same catalogs as the app.
const { getCatalogExercise } = require("./workout-exercise-catalog");
const { buildMealOption } = require("./meal-catalog");

const workoutProfile = {
  goal: "buildMuscle", experience: "beginner", trainingStyle: "gym",
  daysPerWeek: 3, sessionDuration: 60,
  equipment: ["bodyweight", "dumbbell", "barbell", "machine"],
  availableDayIndexes: [1, 3, 5]
};

// A representative week, assembled editorially from supported movements and
// validated in tests. It is never presented as an actual customer's AI result.
const sessionRows = [
  ["Monday", "Full body A", [
    ["dumbbell-goblet-squat", 3, "8–12", 90],
    ["dumbbell-floor-press", 3, "8–12", 90],
    ["dumbbell-row", 3, "8–12", 90],
    ["lying-leg-curl", 2, "10–15", 60],
    ["dumbbell-calf-raise", 2, "10–15", 60],
    ["dead-bug", 2, "8–12 / side", 60]
  ]],
  ["Wednesday", "Full body B", [
    ["leg-press", 3, "8–12", 90],
    ["barbell-bench-press", 3, "8–12", 90],
    ["assisted-pull-up", 3, "8–12", 90],
    ["dumbbell-hip-thrust", 2, "10–15", 60],
    ["dumbbell-shoulder-press", 2, "8–12", 90],
    ["plank", 2, "30–45 sec", 60]
  ]],
  ["Friday", "Full body C", [
    ["barbell-squat", 3, "8–12", 90],
    ["incline-dumbbell-bench-press", 3, "8–12", 90],
    ["barbell-row", 3, "8–12", 90],
    ["romanian-deadlift", 2, "8–12", 90],
    ["dumbbell-lateral-raise", 2, "10–15", 60],
    ["dumbbell-calf-raise", 2, "10–15", 60]
  ]]
];
const workoutExample = {
  profile: workoutProfile,
  program: {
    programName: "Illustrative three-day gym week", daysPerWeek: 3,
    durationWeeks: 8, goal: "Build muscle", weeklyScheduleDays: [1, 3, 5],
    sessions: sessionRows.map(([weekday, name, rows], index) => ({
      day: index + 1, weekday, name, splitType: "full",
      exercises: rows.map(([exerciseId, sets, reps, restSeconds]) => {
        const exercise = getCatalogExercise(exerciseId);
        if (!exercise || exercise.disabled || !exercise.publicGeneration) {
          throw new Error(`Unsupported SEO example exercise: ${exerciseId}`);
        }
        return { exerciseId, name: exercise.title, demoName: exercise.title,
          equipment: exercise.equipment, muscleGroup: Object.keys(exercise.setCredits)[0],
          sets, reps, restSeconds, rir: "2-3", notes: "" };
      })
    }))
  }
};

const mealExample = [
  ["Breakfast", "greek-yogurt-granola-berries"],
  ["Lunch", "grilled-chicken-rice-broccoli"],
  ["Snack", "apple-almond-butter"],
  ["Dinner", "salmon-quinoa-asparagus"]
].map(([slot, id]) => {
  const option = buildMealOption(id);
  if (!option) throw new Error(`Missing SEO example meal: ${id}`);
  return { slot, ...option };
});
const mealTotals = mealExample.reduce((total, meal) => ({
  calories: total.calories + meal.optionCalories,
  proteinGrams: total.proteinGrams + meal.optionProteinGrams
}), { calories: 0, proteinGrams: 0 });

module.exports = { workoutExample, mealExample, mealTotals };
