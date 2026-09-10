"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { calculateNutritionTargets } = require("../lib/nutrition-targets");
const { buildLocalWorkoutProgram } = require("../lib/local-demo-generators");
const { deriveAllowedEquipment } = require("../lib/workout-equipment-policy");
const { getEnabledPublicExerciseIds, getPublicExerciseImageMap, WORKOUT_EXERCISE_ALIAS_MAP } = require("../lib/workout-exercise-catalog");
const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "public/js/manual-nutrition-builder.js"), "utf8");
const workoutSource = fs.readFileSync(path.join(root, "public/js/workout-builder.js"), "utf8");

function targetHarness() {
  const nodes = new Map();
  const pending = [];
  let renders = 0;
  const state = { user: {}, targets: { dailyCalories: 1650 }, selected: [{ id: "meal" }] };
  const context = vm.createContext({ state,
    $: id => { if (!nodes.has(id)) nodes.set(id, { checkValidity: () => true }); return nodes.get(id); },
    targetInput: () => ({ goal: "muscle-gain" }),
    api: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    targetsMarkup: targets => String(targets.dailyCalories),
    renderSelected: () => renders++, status() {}
  });
  vm.runInContext(source.slice(source.indexOf("let targetRequestId"), source.indexOf("async function savePlan")), context);
  return { state, nodes, pending, context, renders: () => renders };
}

test("adult manual targets change between cut, maintenance and bulk", () => {
  const profile = { age: 30, gender: "female", height: 165, weight: 60, activityLevel: "moderatelyActive" };
  const targets = ["fat-loss", "maintenance", "muscle-gain"].map(goal => calculateNutritionTargets({ ...profile, goal }));
  assert.ok(targets[0].dailyCalories < targets[1].dailyCalories);
  assert.ok(targets[1].dailyCalories < targets[2].dailyCalories);
  assert.equal(targets[0].tdee, targets[2].tdee);
});

test("weekly volume controls expose an actionable central focus view", () => {
  assert.match(workoutSource, /weekly-volume-focus-panel/);
  assert.match(workoutSource, /data-volume-adjust="\$\{escapeHtml\(muscleKey\)\}"/);
  assert.match(workoutSource, /data-volume-delta="1"/);
  assert.match(workoutSource, /data-volume-delta="-1"/);
  assert.match(workoutSource, /function adjustWeeklyVolume/);
  assert.match(workoutSource, /activeDayIndex/);
  assert.match(workoutSource, /weeklyVolumeCapReached/);
  assert.match(workoutSource, /hardMaximum/);
});

test("new modern exercise catalog entries have dedicated local images and aliases", () => {
  const modern = [
    "nordic-hamstring-curl", "dragon-flag", "ring-muscle-up", "landmine-press",
    "sissy-squat", "cable-glute-kickback", "bayesian-cable-curl", "pallof-press",
    "ring-dip", "pseudo-planche-push-up", "toes-to-bar", "tibialis-raise"
  ];
  const images = getPublicExerciseImageMap();
  for (const id of modern) {
    assert.ok(getEnabledPublicExerciseIds().includes(id), `${id} is enabled`);
    assert.equal(images[id], `${id}.png`);
  }
  assert.equal(WORKOUT_EXERCISE_ALIAS_MAP["nordic-curl"], "nordic-hamstring-curl");
  assert.equal(WORKOUT_EXERCISE_ALIAS_MAP["anti-rotation-press"], "pallof-press");
});

test("manual target inputs trigger recalculation, update totals and retain selected meals", async () => {
  assert.match(source, /for \(const id of \["goal", "age", "gender", "height", "weight", "activityLevel"\]\)/);
  assert.match(source, /addEventListener\("input", calculateTargets\)/);
  const h = targetHarness();
  const work = h.context.calculateTargets();
  assert.equal(h.state.targets, null, "stale targets cannot be saved while recalculating");
  h.pending[0].resolve({ targets: { dailyCalories: 2300 } });
  await work;
  assert.equal(h.state.targets.dailyCalories, 2300);
  assert.equal(h.nodes.get("#targetSummary").innerHTML, "2300");
  assert.equal(h.state.selected.length, 1);
  assert.equal(h.renders(), 2);
});

test("older target response cannot overwrite the latest goal and failures leave no stale target", async () => {
  const h = targetHarness();
  const old = h.context.calculateTargets();
  const latest = h.context.calculateTargets();
  h.pending[1].resolve({ targets: { dailyCalories: 2300 } });
  await latest;
  h.pending[0].resolve({ targets: { dailyCalories: 1650 } });
  await old;
  assert.equal(h.state.targets.dailyCalories, 2300);
  const failure = h.context.calculateTargets();
  h.pending[2].reject(new Error("offline"));
  await failure;
  assert.equal(h.state.targets, null);
});

test("professional skills plans generate with actual canonical equipment, including bodyweight only", () => {
  for (const selectedEquipment of [["bodyweight"], ["bodyweight", "pull-up bar"]]) {
    const equipment = deriveAllowedEquipment({ trainingStyle: "calisthenics", selectedEquipment }).allowed;
    const program = buildLocalWorkoutProgram({ goal: "improveSkills", experience: "professional", trainingStyle: "calisthenics", equipment, daysPerWeek: 3 });
    assert.equal(program.sessions.length, 3);
    assert.ok(program.sessions.every(session => session.exercises.length > 0));
    assert.ok(program.sessions.flatMap(s => s.exercises).some(e => e.exerciseId === "planche"));
  }
  assert.throws(() => buildLocalWorkoutProgram({ goal: "improveSkills", equipment: ["unsupported"] }), /No compatible/);
});

test("HTTP generation forwards professional experience into local generation", () => {
  const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
  assert.match(server, /JSON\.stringify\(buildLocalWorkoutProgram\(\{\s*goal,\s*experience,/);
  assert.match(server, /muscleFocusMode: muscleFocus\.muscleFocusMode/);
  assert.match(server, /selectedMuscles: muscleFocus\.selectedMuscles/);
});

test("local workout generation applies muscle focus and session duration", () => {
  const equipment = deriveAllowedEquipment({
    trainingStyle: "gym",
    selectedEquipment: ["dumbbell", "cable", "machine"]
  }).allowed;
  const base = {
    goal: "buildMuscle",
    experience: "intermediate",
    trainingStyle: "gym",
    equipment,
    daysPerWeek: 3
  };
  const balanced = buildLocalWorkoutProgram({ ...base, sessionDuration: 60 });
  const focused = buildLocalWorkoutProgram({
    ...base,
    sessionDuration: 30,
    muscleFocusMode: "selected_only",
    selectedMuscles: ["chest", "triceps"]
  });
  const prioritized = buildLocalWorkoutProgram({
    ...base,
    sessionDuration: 60,
    muscleFocusMode: "prioritize",
    selectedMuscles: ["chest"]
  });

  assert.deepEqual(focused.selectedMuscles, ["chest", "triceps"]);
  assert.ok(focused.sessions.flatMap(session => session.exercises)
    .every(exercise => ["chest", "triceps"].includes(exercise.muscleGroup)));
  assert.ok(prioritized.sessions.flatMap(session => session.exercises)
    .filter(exercise => exercise.muscleGroup === "chest")
    .reduce((total, exercise) => total + exercise.sets, 0)
    > balanced.sessions.flatMap(session => session.exercises)
      .filter(exercise => exercise.muscleGroup === "chest")
      .reduce((total, exercise) => total + exercise.sets, 0));
  assert.equal(buildLocalWorkoutProgram({ ...base, sessionDuration: 30 }).sessions
    .flatMap(session => session.exercises)[0].restSeconds, 60);
  assert.equal(balanced.sessions.flatMap(session => session.exercises)[0].restSeconds, 90);
});

test("advanced hybrid generation prefers real pulling progressions over Australian rows", () => {
  const equipment = deriveAllowedEquipment({
    trainingStyle: "hybrid",
    selectedEquipment: ["bodyweight", "pull-up bar", "dumbbell"]
  }).allowed;
  const program = buildLocalWorkoutProgram({
    goal: "buildMuscle",
    experience: "advanced",
    trainingStyle: "hybrid",
    equipment,
    daysPerWeek: 3
  });
  const ids = program.sessions.flatMap(session => session.exercises).map(exercise => exercise.exerciseId);
  assert.ok(ids.includes("pull-up") || ids.includes("chin-up"));
  assert.ok(!ids.includes("australian-row"));
});
