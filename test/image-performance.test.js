// Release regression tests for image delivery weight and for exercises that
// reach the frontend without a real image.
//
// The product shipped ~254MB of full-resolution PNG/JPEG renders under
// public/images (exercise photos averaged 1.15MB at ~1400px wide but display
// at roughly 650 CSS px), and every asset was served with
// "max-age=0, must-revalidate" -- so a generated workout paid a blocking
// revalidation round-trip per image on every visit. Both are fixed by
// scripts/optimize-images.js (webp siblings) plus the webp content
// negotiation and cache headers in server.js.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { repairWorkoutProgram, resolveExerciseId } = require("../lib/workout-repair");
const { getCatalogExercise, getPublicExerciseImageMap } = require("../lib/workout-exercise-catalog");

const ROOT = path.join(__dirname, "..");
const IMAGES_DIR = path.join(ROOT, "public", "images");
const EXERCISE_DIR = path.join(IMAGES_DIR, "exercises");
const SERVER = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const sourceImages = walk(IMAGES_DIR).filter(f => /\.(png|jpe?g)$/i.test(f));

test("every source image has an optimized webp sibling", () => {
  const missing = sourceImages
    .filter(source => !fs.existsSync(`${source.replace(/\.[^.]+$/, "")}.webp`))
    .map(f => path.relative(IMAGES_DIR, f));
  assert.deepEqual(missing, [], "run: node scripts/optimize-images.js");
});

test("the webp siblings are dramatically smaller than the originals", () => {
  let sourceBytes = 0;
  let webpBytes = 0;
  for (const source of sourceImages) {
    sourceBytes += fs.statSync(source).size;
    const webp = `${source.replace(/\.[^.]+$/, "")}.webp`;
    if (fs.existsSync(webp)) webpBytes += fs.statSync(webp).size;
  }
  assert.ok(sourceBytes > 0, "expected source images to exist");
  const ratio = webpBytes / sourceBytes;
  assert.ok(ratio < 0.35, `webp payload should be well under a third of the originals, got ${(ratio * 100).toFixed(1)}%`);
});

test("no individual webp exercise image is heavy enough to stall a card", () => {
  const heavy = fs.readdirSync(EXERCISE_DIR)
    .filter(f => f.endsWith(".webp"))
    .filter(f => fs.statSync(path.join(EXERCISE_DIR, f)).size > 300 * 1024)
    .map(f => `${f} (${(fs.statSync(path.join(EXERCISE_DIR, f)).size / 1024).toFixed(0)}KB)`);
  assert.deepEqual(heavy, [], "these would still be slow on a mobile connection");
});

test("the server negotiates webp only when the client advertises support", () => {
  assert.match(SERVER, /image\\\/webp/, "must inspect the Accept header for webp support");
  assert.match(SERVER, /res\.setHeader\("Vary", "Accept"\)/, "a webp response must Vary on Accept or caches can replay it to non-webp clients");
  assert.match(SERVER, /WEBP_SOURCE_PATTERN/, "negotiation must be scoped to image paths");
});

// Pulls the Cache-Control string from the static-handler branch whose
// extension test mentions `marker`, so the assertion survives reordering or
// reformatting of the surrounding middleware.
function cacheControlForBranch(marker) {
  const branch = new RegExp(
    `test\\(filePath\\)[^{]*\\{[^}]*?res\\.setHeader\\(\\s*"Cache-Control",\\s*"([^"]+)"`,
    "g"
  );
  for (const match of SERVER.matchAll(branch)) {
    const start = SERVER.lastIndexOf("if (", match.index);
    const condition = SERVER.slice(start, match.index);
    if (condition.includes(marker)) return match[1];
  }
  return null;
}

test("images are cached instead of revalidated on every request", () => {
  const value = cacheControlForBranch("png");
  assert.ok(value, "images must have their own Cache-Control rule");
  assert.match(value, /max-age=\d{5,}/, "images should carry a long max-age, not max-age=0");
  assert.doesNotMatch(value, /must-revalidate/, "images must not force a blocking revalidation round-trip");
});

test("code assets still revalidate so a deploy is visible immediately", () => {
  const value = cacheControlForBranch("css");
  assert.ok(value, "css/js must keep their own Cache-Control rule");
  assert.match(value, /must-revalidate/);
});

test("webp negotiation is guarded against path traversal", () => {
  assert.match(SERVER, /absolute\.startsWith\(path\.join\(__dirname, "public"\) \+ path\.sep\)/);
});

// --- exercises with no real image -------------------------------------

test("an exercise absent from the catalog is replaced by a same-muscle catalog exercise", () => {
  // "Machine Triceps Extension" is a real exercise the generator produces,
  // but it has no catalog entry and no dedicated image, so it rendered the
  // branded "Demo image pending" placeholder.
  const program = {
    sessions: [{
      name: "Push",
      exercises: [
        { exerciseId: "machine-triceps-extension", name: "Machine Triceps Extension", demoName: "Machine Triceps Extension", muscleGroup: "Triceps", equipment: "Machine", sets: 3, reps: "10-12", restSeconds: 60 },
        { exerciseId: "barbell-bench-press", name: "Barbell Bench Press", demoName: "Barbell Bench Press", muscleGroup: "Chest", equipment: "Barbell", sets: 4, reps: "6-8", restSeconds: 120 },
        { exerciseId: "dumbbell-lateral-raise", name: "Dumbbell Lateral Raise", demoName: "Dumbbell Lateral Raise", muscleGroup: "Shoulders", equipment: "Dumbbell", sets: 3, reps: "12-15", restSeconds: 60 },
        { exerciseId: "push-up", name: "Push-up", demoName: "Push-up", muscleGroup: "Chest", equipment: "Bodyweight", sets: 3, reps: "10-15", restSeconds: 60 }
      ]
    }]
  };
  const { program: repaired } = repairWorkoutProgram(program, { equipment: ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight"] });

  for (const exercise of repaired.sessions[0].exercises) {
    const entry = getCatalogExercise(resolveExerciseId(exercise).id);
    assert.ok(entry, `"${exercise.name}" must resolve to a catalog exercise with a real image`);
    assert.ok(entry.image, `"${exercise.name}" must have an image filename`);
  }

  // The substitution must be honest: the card is renamed to what it now shows.
  const names = repaired.sessions[0].exercises.map(e => e.name);
  assert.ok(!names.includes("Machine Triceps Extension"), "the unmapped name must not survive with another exercise's photo");
});

test("substituted exercises keep the muscle group they were meant to train", () => {
  const program = {
    sessions: [{
      name: "Push",
      exercises: [
        { exerciseId: "machine-triceps-extension", name: "Machine Triceps Extension", demoName: "Machine Triceps Extension", muscleGroup: "Triceps", equipment: "Machine", sets: 3, reps: "10-12", restSeconds: 60 },
        { exerciseId: "barbell-bench-press", name: "Barbell Bench Press", demoName: "Barbell Bench Press", muscleGroup: "Chest", equipment: "Barbell", sets: 4, reps: "6-8", restSeconds: 120 },
        { exerciseId: "push-up", name: "Push-up", demoName: "Push-up", muscleGroup: "Chest", equipment: "Bodyweight", sets: 3, reps: "10-15", restSeconds: 60 },
        { exerciseId: "plank", name: "Plank", demoName: "Plank", muscleGroup: "Core", equipment: "Bodyweight", sets: 3, reps: "30-45 sec", restSeconds: 60 }
      ]
    }]
  };
  const { program: repaired } = repairWorkoutProgram(program, { equipment: ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight"] });
  const replaced = repaired.sessions[0].exercises[0];
  const entry = getCatalogExercise(resolveExerciseId(replaced).id);
  assert.ok(Object.keys(entry.setCredits || {}).includes("triceps"), "the replacement must still train triceps");
});

test("a substitution never collides with an exercise the caller reserved", () => {
  // The reroll endpoint repairs the replacement exercise in isolation, so
  // the substitution passes cannot see the rest of the session. Without
  // reservedExerciseIds they could swap in an exercise the session already
  // contains, which then fails validation with "appears more than once".
  // Core has several bodyweight options, so reserving two still leaves a
  // legitimate substitute available.
  const reserved = ["plank", "russian-twist"];
  const program = {
    sessions: [{
      name: "Core",
      exercises: [
        { exerciseId: "mock-core-replacement", name: "Mock Core Replacement", demoName: "Mock Core Replacement", muscleGroup: "Core", equipment: "Bodyweight", sets: 3, reps: "10-15", restSeconds: 90 }
      ]
    }]
  };
  const { program: repaired } = repairWorkoutProgram(program, {
    equipment: ["bodyweight"],
    reservedExerciseIds: reserved
  });
  const resulting = resolveExerciseId(repaired.sessions[0].exercises[0]).id;
  assert.ok(!reserved.includes(resulting), `substitution picked the reserved id "${resulting}"`);
  assert.ok(getCatalogExercise(resulting), "the substitute must still be a real catalog exercise with an image");
});

test("every enabled public exercise image resolves to a file that exists on disk", () => {
  const missing = Object.entries(getPublicExerciseImageMap())
    .filter(([, file]) => !fs.existsSync(path.join(EXERCISE_DIR, file)))
    .map(([id, file]) => `${id} -> ${file}`);
  assert.deepEqual(missing, []);
});
