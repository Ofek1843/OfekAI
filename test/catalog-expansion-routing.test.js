"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const meals = require("../lib/catalog-expansion-meals");
const { filterMeals, getMealById, buildMealOption } = require("../lib/meal-catalog");
const { eligibleExerciseCatalog, isExerciseLevelSuitable } = require("../lib/exercise-suitability");
const { buildLocalWorkoutProgram, buildLocalExerciseReplacement } = require("../lib/local-demo-generators");
const { repairWorkoutProgram } = require("../lib/workout-repair");
const { validateWorkoutProgram } = require("../lib/workout-validator");
const ids = ["dumbbell-floor-press","dumbbell-reverse-lunge","cable-overhead-triceps-extension","single-arm-cable-row","bodyweight-glute-bridge","dead-bug","standing-bodyweight-calf-raise","ring-row"];
test("new meal catalog entries reach generator selection with exact local media", () => {
 const pool = new Set(filterMeals({foodStylePreference:"supermarket"}).map(m=>m.id));
 for(const meal of meals) {
   assert.ok(pool.has(meal.id), meal.id);
   const entry = getMealById(meal.id);
   assert.match(entry.he, /[א-ת]/);
   assert.ok(entry.baseCalories > 0);
   for(const ext of ["png","webp"]) assert.ok(fs.existsSync(path.join(__dirname,"../public/images/meals",meal.id+"."+ext)));
 }
});
test("new meals obey diet, allergy, slot and preparation constraints", () => {
 const vegan = new Set(filterMeals({diet:"vegan"}).map(m=>m.id));
 assert.ok(vegan.has("tofu-quinoa-edamame"));
 assert.ok(!vegan.has("cod-potato-green-beans"));
 const dairyFree = new Set(filterMeals({excludeAllergens:["dairy"]}).map(m=>m.id));
 assert.ok(!dairyFree.has("skyr-banana-oats-walnuts"));
 const quick = new Set(filterMeals({prepTimePreference:"five"}).map(m=>m.id));
 assert.ok(quick.has("skyr-banana-oats-walnuts"));
 assert.ok(!quick.has("chicken-couscous-vegetables"));
 assert.ok(!filterMeals({slot:"breakfast"}).some(m=>m.id==="cod-potato-green-beans"));
});
test("expanded exercise candidates have images and remain equipment scoped", () => {
 const all = eligibleExerciseCatalog(["bodyweight","dumbbell","cable","rings"],"professional");
 for(const id of ids) {
   assert.ok(all.some(e=>e.exerciseId===id),id);
   for(const ext of ["png","webp"]) assert.ok(fs.existsSync(path.join(__dirname,"../public/images/exercises",id+"."+ext)));
 }
 const bw = eligibleExerciseCatalog(["bodyweight"],"professional");
 assert.ok(!bw.some(e=>e.exerciseId.startsWith("ring-")));
 const rings = eligibleExerciseCatalog(["rings"],"beginner");
 assert.ok(rings.some(e=>e.exerciseId==="ring-row"));
 assert.ok(!rings.some(e=>e.exerciseId==="ring-muscle-up"));
});
test("beginner generation and reroll cannot select elite skill exercises", () => {
 const program=buildLocalWorkoutProgram({experience:"beginner",daysPerWeek:3,sessionDuration:60,equipment:["bodyweight","pullupbar","rings","dumbbell"],trainingStyle:"calisthenics"});
 for(const exercise of program.sessions.flatMap(s=>s.exercises)) assert.ok(isExerciseLevelSuitable(exercise.exerciseId,"beginner"),exercise.exerciseId);
 const replacement=buildLocalExerciseReplacement({currentExercise:{exerciseId:"australian-row"},experience:"beginner",equipment:["bodyweight","pullupbar","rings"],reservedExerciseIds:[]});
 if(replacement) assert.ok(isExerciseLevelSuitable(replacement.exerciseId,"beginner"));
 assert.ok(eligibleExerciseCatalog(["bodyweight"],"professional").some(e=>e.exerciseId==="planche"));
 assert.ok(!eligibleExerciseCatalog(["bodyweight"],"beginner").some(e=>e.exerciseId==="planche"));
});
test("production repair replaces an elite exercise for a beginner and validator rejects an unresolved mismatch", () => {
 const exercise={exerciseId:"planche",name:"Planche",equipment:"Bodyweight",sets:3,reps:"8-12",restSeconds:90,rir:"2"};
 const p={daysPerWeek:1,weeklyScheduleDays:[1],sessions:[{day:1,name:"Day 1",exercises:[exercise]}]};
 const ctx={experience:"beginner",equipment:["bodyweight"],daysPerWeek:1,sessionDuration:60,availableDayIndexes:[1]};
 assert.ok(validateWorkoutProgram(p,ctx).errors.some(e=>e.includes("experience")));
 repairWorkoutProgram(p,ctx);
 assert.notEqual(p.sessions[0].exercises[0].exerciseId,"planche");
 assert.ok(isExerciseLevelSuitable(p.sessions[0].exercises[0].exerciseId,"beginner"));
});

