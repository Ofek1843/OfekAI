"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

function publicFile(urlPath) {
  return path.join(PUBLIC, urlPath.replace(/^\//, "").split("?")[0]);
}

function loadBrowserExerciseImageModule() {
  const source = fs
    .readFileSync(path.join(PUBLIC, "js", "exercise-image.js"), "utf8")
    .replace(/\bexport\s+(?=(?:const|function)\b)/g, "");
  const sandbox = {
    console: { warn() {} },
    window: undefined,
    moduleExports: {}
  };

  vm.runInNewContext(
    `${source}
    moduleExports.exerciseImageUrl = exerciseImageUrl;
    moduleExports.fallbackExerciseImageUrl = fallbackExerciseImageUrl;
    moduleExports.exerciseImageSlug = exerciseImageSlug;
    moduleExports.hasExerciseImageSlug = hasExerciseImageSlug;`,
    sandbox
  );

  return sandbox.moduleExports;
}

test("workout-builder referenced JS/CSS assets exist on disk", () => {
  const html = fs.readFileSync(path.join(PUBLIC, "workout-builder.html"), "utf8");
  const referencedAssets = [
    ...html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)="([^"]+)"/g)
  ]
    .map((match) => match[1])
    .filter((asset) =>
      asset.includes("/js/workout-builder.js") ||
      asset.includes("/js/exercise-demos.js") ||
      asset.includes("/css/workout-builder.css") ||
      asset.includes("/css/exercise-demo.css") ||
      asset.includes("/css/exercise-demo-theme.css")
    );

  for (const asset of [
    "/js/workout-builder.js",
    "/js/exercise-demos.js",
    "/css/workout-builder.css",
    "/css/exercise-demo.css",
    "/css/exercise-demo-theme.css",
    ...referencedAssets
  ]) {
    assert.ok(fs.existsSync(publicFile(asset)), `Missing public asset: ${asset}`);
  }
});

test("workout builder wizard initializes before optional exercise demos", () => {
  const source = fs.readFileSync(path.join(PUBLIC, "js", "workout-builder.js"), "utf8");

  assert.match(source, /wizardNextButton\?\.addEventListener\("click"/);
  assert.match(source, /renderWizardStep\(\);/);
  assert.doesNotMatch(
    source,
    /import\s+\{[^}]*setupExerciseDemos[^}]*\}\s+from\s+["']\.\/exercise-demos\.js["']/,
    "exercise demos must not be a static import that can break wizard navigation"
  );
  assert.match(source, /await import\("\.\/exercise-demos\.js"\)/);
});

test("workout builder sends derived priority in generation and reroll payloads", () => {
  const source = fs.readFileSync(path.join(PUBLIC, "js", "workout-builder.js"), "utf8");

  assert.match(source, /import \{ derivePriorityFromGoal \} from "\.\/workout-priority\.js";/);
  assert.ok(
    source.match(/priority:\s*derivePriorityFromGoal\(formData\.get\("goal"\)\)/g)?.length >= 2,
    "Expected derived priority in generation and reroll payloads"
  );
});

test("exercise image resolver prefers canonical ids before free text names", () => {
  const source = fs.readFileSync(path.join(PUBLIC, "js", "exercise-image.js"), "utf8");
  const exerciseIdIndex = source.indexOf("exercise.exerciseId");
  const demoNameIndex = source.indexOf("exercise.demoName");

  assert.ok(exerciseIdIndex > -1, "exerciseId should be part of image resolution");
  assert.ok(demoNameIndex > -1, "demoName should remain supported");
  assert.ok(
    exerciseIdIndex < demoNameIndex,
    "canonical exerciseId should be checked before free-text demoName"
  );
});

test("exercise image resolver maps newly imported images to existing files", async () => {
  const imageModule = loadBrowserExerciseImageModule();

  const cases = [
    ["Seated Leg Curl", "seated-leg-curl.png"],
    ["Cable Crunch", "cable-crunch.png"],
    ["Hip Abductor Machine", "abductors.png"],
    ["Hip Adductor Machine", "adductors.png"],
    ["Incline Dumbbell Press", "incline-dumbbell-bench-press.png"],
    ["Typewriter Pull-up", "typewriter-pull-ups.png"],
    ["Dumbbell Step-up", "step-up.png"]
  ];

  for (const [exerciseName, expectedFile] of cases) {
    const url = imageModule.exerciseImageUrl(exerciseName);
    assert.equal(
      url,
      `/images/exercises/${expectedFile}`,
      `${exerciseName} should resolve to ${expectedFile}`
    );
    assert.ok(fs.existsSync(publicFile(url)), `Missing resolved demo image: ${url}`);
  }
});

test("unknown exercise images use the branded fallback instead of a broken PNG URL", async () => {
  const imageModule = loadBrowserExerciseImageModule();

  assert.equal(
    imageModule.exerciseImageUrl("Unmapped Experimental Movement"),
    "/images/exercises/fuelphysique-demo-fallback.svg"
  );
  assert.ok(
    fs.existsSync(publicFile("/images/exercises/fuelphysique-demo-fallback.svg")),
    "Fallback image must exist and return a real public asset"
  );
});

test("exercise image directory has no temporary replacement filenames left", () => {
  const exerciseFiles = fs.readdirSync(path.join(PUBLIC, "images", "exercises"));
  const temporaryReplacementFiles = exerciseFiles.filter((file) =>
    /\b(new|updated|final|replacement)\b/i.test(file.replace(/[-_]/g, " "))
  );

  assert.deepEqual(
    temporaryReplacementFiles,
    [],
    `Temporary exercise replacement files must be removed: ${temporaryReplacementFiles.join(", ")}`
  );
});

test("server uses the shared OpenAI default model instead of a stale hard-coded model", () => {
  const serverSource = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
  const diagnosticsSource = fs.readFileSync(
    path.join(ROOT, "lib", "openai-diagnostics.js"),
    "utf8"
  );

  assert.match(diagnosticsSource, /DEFAULT_OPENAI_CHAT_MODEL\s*=\s*"gpt-5-mini"/);
  assert.match(diagnosticsSource, /function isGpt5ChatModel/);
  assert.match(serverSource, /DEFAULT_OPENAI_CHAT_MODEL/);
  assert.match(serverSource, /requestBody\.max_completion_tokens = cappedMaxTokens/);
  assert.match(serverSource, /requestBody\.max_tokens = cappedMaxTokens/);
  assert.doesNotMatch(
    serverSource,
    /OPENAI_CHAT_MODEL\s*\|\|\s*"gpt-4o-mini"/,
    "server should not fall back to a model unavailable to the current OpenAI project"
  );
});
