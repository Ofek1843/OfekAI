// Verifies the exercise-image resolver actually used by the workout tracker
// focus panel (public/js/workout-tracker.js's updateFocusExerciseImage calls
// exerciseImageUrl from public/js/exercise-image.js) -- not just that the
// image tag was added to the markup.
//
// exercise-image.js is an ES module loaded via <script type="module"> in the
// browser. The project's package.json sets "type": "commonjs", so a plain
// require()/import() of the file fails. Loading it as a data: URL forces
// Node's ESM loader regardless of the package "type", which is the only way
// to exercise the real resolver logic (not a re-implementation of it) from
// a CommonJS test runner.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const EXERCISE_DIR = path.join(ROOT, "public", "images", "exercises");

async function loadExerciseImageModule() {
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "exercise-image.js"), "utf8");
  const dataUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  return import(dataUrl);
}

test("exercise-image resolver: canonical exercises used by the tracker", async (t) => {
  const { exerciseImageUrl, exerciseImageResolutionDetails } = await loadExerciseImageModule();

  const cases = [
    { exerciseId: "barbell-squat", name: "Barbell Squat", expectedSlug: "barbell-squat" },
    { exerciseId: "bench-press", name: "Bench Press", expectedSlug: "bench-press" },
    { exerciseId: "lat-pulldown", name: "Lat Pulldown", expectedSlug: "lat-pulldown" },
    { exerciseId: "dumbbell-shoulder-press", name: "Dumbbell Shoulder Press", expectedSlug: "dumbbell-shoulder-press" }
  ];

  for (const exercise of cases) {
    await t.test(exercise.name, () => {
      const details = exerciseImageResolutionDetails(exercise);
      assert.equal(details.usedFallback, false, `${exercise.name} must resolve to a dedicated image, not the fallback`);
      assert.equal(details.attemptedSlug, exercise.expectedSlug);
      assert.equal(details.sourceField, "exerciseId", "the canonical exerciseId must be the field that resolved");

      const url = exerciseImageUrl(exercise);
      assert.equal(url, `/images/exercises/${exercise.expectedSlug}.png`);

      // The URL the tracker requests must correspond to a real file on disk
      // (server.js's webp negotiation serves the .webp sibling of this exact
      // path transparently, so the .png existing is the real guarantee).
      const onDisk = path.join(EXERCISE_DIR, `${exercise.expectedSlug}.png`);
      assert.ok(fs.existsSync(onDisk), `expected ${onDisk} to exist on disk`);
    });
  }
});

test("exercise-image resolver: an aliased spelling still resolves to the real file", async () => {
  const { exerciseImageUrl, exerciseImageResolutionDetails } = await loadExerciseImageModule();

  // "Overhead Press" / "Military Press" have no dedicated file -- they alias
  // to barbell-shoulder-press.png, which does.
  const aliasedCases = [
    { exerciseId: "overhead-press", name: "Overhead Press", expectedSlug: "barbell-shoulder-press" },
    { exerciseId: "back-squat", name: "Back Squat", expectedSlug: "barbell-squat" }
  ];

  for (const exercise of aliasedCases) {
    const details = exerciseImageResolutionDetails(exercise);
    assert.equal(details.usedFallback, false, `${exercise.name} (alias) must resolve via ALIASES, not fall back`);
    assert.equal(details.attemptedSlug, exercise.expectedSlug);
    assert.equal(exerciseImageUrl(exercise), `/images/exercises/${exercise.expectedSlug}.png`);
    assert.ok(fs.existsSync(path.join(EXERCISE_DIR, `${exercise.expectedSlug}.png`)));
  }
});

test("exercise-image resolver: canonical exerciseId wins over a mismatched display name", async () => {
  // The reroll/repair passes sometimes rewrite `name` for honesty while the
  // exerciseId still points at the real catalog entry (see
  // lib/workout-repair.js's repairExercisesMissingFromCatalog). The image
  // must follow the id, not a stale or unrelated name string.
  const { exerciseImageResolutionDetails } = await loadExerciseImageModule();

  const exercise = {
    exerciseId: "barbell-squat",
    name: "Some Unrelated Exercise Name",
    demoName: "Also Unrelated"
  };

  const details = exerciseImageResolutionDetails(exercise);
  assert.equal(details.sourceField, "exerciseId");
  assert.equal(details.attemptedSlug, "barbell-squat");
  assert.equal(details.usedFallback, false);
});

test("exercise-image resolver: Hebrew exercise names do not affect resolution when exerciseId is canonical", async () => {
  const { exerciseImageUrl, exerciseImageResolutionDetails } = await loadExerciseImageModule();

  // Hebrew workout plans still carry the canonical English exerciseId --
  // the tracker's Hebrew UI must show the same correct photo as English.
  const exercise = {
    exerciseId: "barbell-squat",
    name: "סקוואט מוט",
    demoName: "סקוואט מוט"
  };

  const details = exerciseImageResolutionDetails(exercise);
  assert.equal(details.sourceField, "exerciseId", "exerciseId must be tried before the Hebrew name");
  assert.equal(details.attemptedSlug, "barbell-squat");
  assert.equal(details.usedFallback, false);
  assert.equal(exerciseImageUrl(exercise), "/images/exercises/barbell-squat.png");
});

test("exercise-image resolver: a Hebrew-only name with no exerciseId falls back safely instead of guessing", async () => {
  const { exerciseImageUrl, fallbackExerciseImageUrl } = await loadExerciseImageModule();

  // Hebrew text does not slugify into any known English slug, and the
  // resolver must never invent a mapping -- it must use the intentional
  // branded fallback rather than 404 or show a wrong exercise's photo.
  const exercise = { name: "תרגיל לא ידוע" };
  assert.equal(exerciseImageUrl(exercise), fallbackExerciseImageUrl());
});

test("exercise-image resolver: a genuinely unknown exercise uses the branded fallback, not a broken path", async () => {
  const { exerciseImageUrl, fallbackExerciseImageUrl, exerciseImageResolutionDetails } = await loadExerciseImageModule();

  const exercise = { exerciseId: "totally-invented-exercise-xyz", name: "Totally Invented Exercise XYZ" };
  const details = exerciseImageResolutionDetails(exercise);
  assert.equal(details.usedFallback, true);
  assert.equal(exerciseImageUrl(exercise), fallbackExerciseImageUrl());

  // The fallback asset itself must actually exist -- otherwise "safe
  // fallback" is itself a broken image.
  const fallbackPath = path.join(ROOT, "public", fallbackExerciseImageUrl());
  assert.ok(fs.existsSync(fallbackPath), `expected fallback asset to exist at ${fallbackPath}`);
});

test("workout-tracker.js updates the focus image when switching exercises", () => {
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "workout-tracker.js"), "utf8");

  assert.match(
    source,
    /import\s*\{\s*exerciseImageUrl\s*\}\s*from\s*"\.\/exercise-image\.js"/,
    "the tracker must use the shared resolver, not a re-implementation"
  );
  assert.match(
    source,
    /function updateFocusExerciseImage\(/,
    "expected an updateFocusExerciseImage function"
  );
  assert.match(
    source,
    /updateFocusExerciseImage\(exercise\)/,
    "updateFocusExerciseImage must be called from the focus-sync path (syncFocusFromRow), so it re-runs on every exercise/set switch"
  );
  assert.match(
    source,
    /img\.src\s*=\s*exerciseImageUrl\(exercise\)/,
    "the <img> src must come from the canonical exerciseImageUrl(), not a hand-built path"
  );
});

test("workout-tracker.html: the focus exercise image sits above the weight/reps controls without obscuring them", () => {
  const html = fs.readFileSync(path.join(ROOT, "public", "workout-tracker.html"), "utf8");

  const mediaIndex = html.indexOf('id="focusExerciseMedia"');
  const singleSetEntryIndex = html.indexOf('class="single-set-entry"');
  assert.ok(mediaIndex !== -1, "expected #focusExerciseMedia in the markup");
  assert.ok(singleSetEntryIndex !== -1, "expected the weight/reps entry block in the markup");
  assert.ok(
    mediaIndex < singleSetEntryIndex,
    "the exercise image must be positioned before (above) the weight/reps controls, not overlapping them"
  );

  const css = fs.readFileSync(path.join(ROOT, "public", "css", "workout-tracker.css"), "utf8");
  assert.match(
    css,
    /\.focus-exercise-media\{[^}]*aspect-ratio:1[^}]*\}/,
    "the image container must have a fixed aspect-ratio so it doesn't cause layout shift while loading"
  );
});

// --- HTTP-level check: the resolved image URLs actually serve 200 --------

test("resolved exercise image URLs return HTTP 200 from the real server", async (t) => {
  const PORT = 4174;
  const BASE_URL = `http://127.0.0.1:${PORT}`;
  let serverProcess;

  await t.test("start server", async () => {
    serverProcess = spawn(
      process.execPath,
      [path.join(ROOT, "server.js")],
      {
        env: { ...process.env, PORT: String(PORT), MOCK_EXTERNAL_SERVICES: "true", OPENAI_API_KEY: "test-key-not-used-in-mock-mode" },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    const deadline = Date.now() + 15_000;
    let lastError;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${BASE_URL}/health`);
        if (res.ok) return;
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`Server did not become healthy in time. Last error: ${lastError}`);
  });

  const slugs = ["barbell-squat", "bench-press", "lat-pulldown", "dumbbell-shoulder-press"];
  for (const slug of slugs) {
    await t.test(`GET /images/exercises/${slug}.png -> 200`, async () => {
      const res = await fetch(`${BASE_URL}/images/exercises/${slug}.png`);
      assert.equal(res.status, 200, `${slug}.png must serve with 200`);
      await res.arrayBuffer();
    });
  }

  await t.test("webp negotiation also serves 200 for the same slug", async () => {
    const res = await fetch(`${BASE_URL}/images/exercises/barbell-squat.png`, {
      headers: { Accept: "image/webp,image/*,*/*;q=0.8" }
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") || "", /webp/);
    await res.arrayBuffer();
  });

  await t.test("the branded fallback also serves 200", async () => {
    const res = await fetch(`${BASE_URL}/images/exercises/fuelphysique-demo-fallback.svg`);
    assert.equal(res.status, 200);
    await res.arrayBuffer();
  });

  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
