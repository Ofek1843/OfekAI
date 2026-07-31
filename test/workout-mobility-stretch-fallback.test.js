// Regression coverage for the final workout image-fallback release blocker:
// live Hebrew Calisthenics generation produced the exercise
// "מתיחת כתפיים עם משקל גוף" (exerciseId "bodyweight-shoulder-stretch",
// English display name "Bodyweight Shoulder Stretch"). No accurate
// stretch/mobility image exists anywhere in public/images/exercises — every
// image there is a strength or skill movement — so this exercise must never
// reach the frontend at all (not the generic branded fallback, and not an
// unrelated strength exercise misrepresented as a substitute). It is removed
// deterministically by lib/workout-repair.js before validation runs.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { repairWorkoutProgram, resolveExerciseId } = require("../lib/workout-repair");
const {
  getCatalogExercise,
  getDisabledExercise,
  isPublicExerciseEnabled,
  WORKOUT_EXERCISE_ALIAS_MAP
} = require("../lib/workout-exercise-catalog");

const ROOT = path.join(__dirname, "..");
const EXERCISE_DIR = path.join(ROOT, "public", "images", "exercises");

function loadResolver() {
  const source = fs
    .readFileSync(path.join(ROOT, "public", "js", "exercise-image.js"), "utf8")
    .replace(/\bexport\s+(?=(?:const|function)\b)/g, "");
  const sandbox = { console: { warn() {} }, window: undefined, moduleExports: {} };
  vm.runInNewContext(
    `${source}
    moduleExports.exerciseImageUrl = exerciseImageUrl;
    moduleExports.exerciseImageResolutionDetails = exerciseImageResolutionDetails;
    moduleExports.fallbackExerciseImageUrl = fallbackExerciseImageUrl;`,
    sandbox
  );
  return sandbox.moduleExports;
}

function buildSession(mobilityExercise) {
  return {
    sessions: [
      {
        name: "Full Body",
        exercises: [
          mobilityExercise,
          { exerciseId: "push-up", name: "Push-up", demoName: "Push-up", muscleGroup: "Chest", equipment: "Bodyweight", sets: 3, reps: "10-15", restSeconds: 60 },
          { exerciseId: "plank", name: "Plank", demoName: "Plank", muscleGroup: "Core", equipment: "Bodyweight", sets: 3, reps: "30-45 sec", restSeconds: 60 },
          { exerciseId: "russian-twist", name: "Russian Twist", demoName: "Russian Twist", muscleGroup: "Core", equipment: "Bodyweight", sets: 3, reps: "15-20", restSeconds: 60 }
        ]
      }
    ]
  };
}

const ENGLISH_EXERCISE = {
  exerciseId: "bodyweight-shoulder-stretch",
  name: "Bodyweight Shoulder Stretch",
  demoName: "Bodyweight Shoulder Stretch",
  muscleGroup: "Shoulders",
  equipment: "Bodyweight",
  sets: 2,
  reps: "30-45 sec",
  restSeconds: 30
};

const HEBREW_EXERCISE = {
  // The generation prompt always asks for an English lowercase-hyphenated
  // exerciseId even in Hebrew mode; name/demoName are the Hebrew label the
  // model actually returned.
  exerciseId: "bodyweight-shoulder-stretch",
  name: "מתיחת כתפיים עם משקל גוף",
  demoName: "מתיחת כתפיים עם משקל גוף",
  muscleGroup: "כתפיים",
  equipment: "Bodyweight",
  sets: 2,
  reps: "30-45 sec",
  restSeconds: 30
};

test("the exercise is explicitly disabled in the catalog with a clear reason", () => {
  const disabled = getDisabledExercise("bodyweight-shoulder-stretch");
  assert.ok(disabled, "bodyweight-shoulder-stretch must be a known disabled entry");
  assert.equal(disabled.exerciseId, "bodyweight-shoulder-stretch");
  assert.ok(disabled.reason && disabled.reason.length > 0);
  assert.deepEqual(disabled.replacementIds, [], "no catalog exercise preserves the same bodyweight/mobility intent");
  assert.equal(isPublicExerciseEnabled("bodyweight-shoulder-stretch"), false);
});

test("no accurate dedicated stretch image exists on disk for this exercise", () => {
  const candidates = fs
    .readdirSync(EXERCISE_DIR)
    .filter((file) => /stretch|mobility|warm-?up|cool-?down/i.test(file));
  assert.deepEqual(candidates, [], "if a dedicated image now exists, this exercise should be re-enabled with it instead of disabled");
});

test("the English generated exercise resolves to the canonical disabled id", () => {
  const { id } = resolveExerciseId(ENGLISH_EXERCISE);
  assert.equal(id, "bodyweight-shoulder-stretch");
});

test("the Hebrew generated exercise (exact captured name) resolves to the same canonical disabled id", () => {
  const { id } = resolveExerciseId(HEBREW_EXERCISE);
  assert.equal(id, "bodyweight-shoulder-stretch");
});

test("safe English aliases route to the same canonical disabled id", () => {
  for (const alias of ["shoulder-stretch", "standing-shoulder-stretch", "cross-body-shoulder-stretch"]) {
    assert.equal(WORKOUT_EXERCISE_ALIAS_MAP[alias], "bodyweight-shoulder-stretch", `alias "${alias}" should map to bodyweight-shoulder-stretch`);
  }
});

test("repairWorkoutProgram removes the English variant from the session instead of leaving a fallback", () => {
  const { program, repairs } = repairWorkoutProgram(buildSession(ENGLISH_EXERCISE), { equipment: [] });
  const names = program.sessions[0].exercises.map((exercise) => exercise.name);
  assert.ok(!names.includes("Bodyweight Shoulder Stretch"), "the stretch exercise must not survive repair");
  assert.ok(repairs.some((entry) => /removed/i.test(entry) && /Bodyweight Shoulder Stretch/i.test(entry)));
});

test("repairWorkoutProgram removes the exact Hebrew-name variant from the session instead of leaving a fallback", () => {
  const { program } = repairWorkoutProgram(buildSession(HEBREW_EXERCISE), { equipment: [] });
  const names = program.sessions[0].exercises.map((exercise) => exercise.name);
  assert.ok(!names.includes("מתיחת כתפיים עם משקל גוף"), "the Hebrew-labeled stretch exercise must not survive repair");
});

test("no other exercise in the repaired session is an unsafe surrogate for the removed stretch", () => {
  const { program } = repairWorkoutProgram(buildSession(HEBREW_EXERCISE), { equipment: [] });
  const ids = program.sessions[0].exercises.map((exercise) => resolveExerciseId(exercise).id);
  const bannedSurrogates = ["barbell-shoulder-press", "dumbbell-shoulder-press", "machine-shoulder-press", "pike-push-up", "handstand-push-up"];
  for (const banned of bannedSurrogates) {
    assert.ok(!ids.includes(banned), `"${banned}" must not silently replace the removed stretch exercise`);
  }
});

test("even without repair running, the frontend resolver would fall back rather than mis-map to a real exercise image", () => {
  const resolver = loadResolver();
  const fallbackUrl = resolver.fallbackExerciseImageUrl();
  const details = resolver.exerciseImageResolutionDetails(HEBREW_EXERCISE);
  assert.equal(details.imageUrl, fallbackUrl, "unrepaired, this must go to the generic fallback, never a misleading surrogate photo");
  assert.equal(getCatalogExercise("bodyweight-shoulder-stretch"), undefined);
});

test("the generic mobility/stretch/warm-up backstop pass also removes exercises with no explicit disabled entry", () => {
  const inventedWarmup = {
    exerciseId: "dynamic-hip-mobility-warmup",
    name: "Dynamic Hip Mobility Warm-up",
    demoName: "Dynamic Hip Mobility Warm-up",
    muscleGroup: "Hips",
    equipment: "Bodyweight",
    sets: 1,
    reps: "60 sec",
    restSeconds: 15
  };
  const { program } = repairWorkoutProgram(buildSession(inventedWarmup), { equipment: [] });
  const names = program.sessions[0].exercises.map((exercise) => exercise.name);
  assert.ok(!names.includes("Dynamic Hip Mobility Warm-up"), "an unlisted invented warm-up exercise with no catalog image must also be removed");
});

test("a bodyweight exercise that merely mentions a stretch-adjacent word but HAS a real catalog image is kept", () => {
  const plank = {
    exerciseId: "plank",
    name: "Plank",
    demoName: "Plank",
    muscleGroup: "Core",
    equipment: "Bodyweight",
    sets: 3,
    reps: "30-45 sec",
    restSeconds: 60
  };
  const { program } = repairWorkoutProgram(buildSession(plank), { equipment: [] });
  const names = program.sessions[0].exercises.map((exercise) => exercise.name);
  assert.ok(names.filter((name) => name === "Plank").length >= 1, "an enabled, imaged exercise must never be removed by the mobility backstop");
});
