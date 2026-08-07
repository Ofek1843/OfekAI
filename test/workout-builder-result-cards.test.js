"use strict";

// Regression tests for the workout-builder result renderer.
//
// Root cause this guards against: the large-card exercise result layout
// (public/js/workout-builder.js renderProgram()) was built in an orphaned,
// never-merged commit whose CSS was never committed, so the mainline
// renderer silently stayed on an old compact <table> layout indefinitely.
// These tests assert the card markup/CSS/engine wiring stay present so a
// future edit can't quietly regress back to the table without a test
// failure, and so the deterministic engine (validator/volume/duration/
// repair) stays wired into the two workout endpoints.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

const workoutBuilderJs = fs.readFileSync(
  path.join(PUBLIC, "js", "workout-builder.js"),
  "utf8"
);
const workoutBuilderCss = fs.readFileSync(
  path.join(PUBLIC, "css", "workout-builder.css"),
  "utf8"
);

test("renderProgram emits large visual exercise cards, not the compact table", () => {
  assert.match(workoutBuilderJs, /class="exercise-cards"/);
  assert.match(workoutBuilderJs, /class="exercise-card"/);
  assert.match(workoutBuilderJs, /class="exercise-card-media"/);
  assert.match(workoutBuilderJs, /class="exercise-card-image"/);
  assert.match(workoutBuilderJs, /class="exercise-card-stats"/);

  assert.doesNotMatch(
    workoutBuilderJs,
    /class="workout-table"/,
    "the compact table renderer must not come back"
  );
});

test("exercise cards use the canonical exerciseId-first image resolver with a branded fallback", () => {
  assert.match(
    workoutBuilderJs,
    /import \{ exerciseImageUrl, fallbackExerciseImageUrl \} from "\.\/exercise-image\.js";/
  );
  assert.match(workoutBuilderJs, /exerciseImageUrl\(exercise\)/);
  assert.match(workoutBuilderJs, /data-fallback-src="\$\{escapeHtml\(fallbackExerciseImageUrl\(\)\)\}"/);
  assert.match(
    workoutBuilderJs,
    /image\.src = image\.dataset\.fallbackSrc/,
    "a broken/missing demo image must fall back to the branded image, not a broken-image icon"
  );
});

test("each exercise card exposes sets, reps, rest and RIR plus an optional note", () => {
  assert.match(workoutBuilderJs, /\$\{ui\.sets\}/);
  // The rep tile is labelled "Target reps" (ui.targetReps), not the bare
  // "Reps" (ui.reps), so the range cannot be read as a stop-at-this-number
  // instruction. Same tile, same value -- see test/workout-guidance-ux.test.js.
  assert.match(workoutBuilderJs, /\$\{ui\.targetReps\}/);
  assert.match(workoutBuilderJs, /\$\{ui\.rest\}/);
  // RIR now renders as an "Effort" tile carrying its unit.
  assert.match(workoutBuilderJs, /exercise-stat--effort/);
  assert.match(workoutBuilderJs, /ui\.rirUnit\(String\(exercise\.rir\)\)/);
  assert.match(workoutBuilderJs, /class="exercise-stat-value"/);
  assert.match(workoutBuilderJs, /class="exercise-note"/);
});

test("reroll updates the exercise card in place by session/exercise index", () => {
  assert.match(
    workoutBuilderJs,
    /\.exercise-card\[data-session="\$\{sessionIndex\}"\]\[data-exercise="\$\{exerciseIndex\}"\]/
  );
  assert.doesNotMatch(
    workoutBuilderJs,
    /tr\[data-session="\$\{sessionIndex\}"\]\[data-exercise="\$\{exerciseIndex\}"\]/,
    "reroll must not look up a <tr> row that no longer exists in the card layout"
  );
});

test("workout-builder.css defines the card grid, not the removed table styles", () => {
  assert.match(workoutBuilderCss, /\.exercise-cards\s*\{/);
  assert.match(workoutBuilderCss, /\.exercise-card-media\s*\{/);
  assert.match(workoutBuilderCss, /\.exercise-card-stats\s*\{/);

  assert.doesNotMatch(workoutBuilderCss, /\.workout-table\s*\{/);
  assert.doesNotMatch(workoutBuilderCss, /\.workout-table-wrapper\s*\{/);
});

test("exercise card grid uses a full-width scan-friendly layout on desktop and mobile", () => {
  const gridRuleMatch = workoutBuilderCss.match(/\.exercise-cards\s*\{([^}]*)\}/);
  assert.ok(gridRuleMatch, "base .exercise-cards rule must exist");
  assert.match(gridRuleMatch[1], /grid-template-columns:\s*1fr/);
  assert.match(workoutBuilderCss, /\.muscle-exercise-group\s*\{/);
  assert.match(workoutBuilderCss, /\.muscle-exercise-group-grid\s*\{/);

  const mobileBlockMatch = workoutBuilderCss.match(
    /@media \(max-width: 760px\) \{([\s\S]*?)\n\}/
  );
  assert.ok(mobileBlockMatch, "mobile breakpoint must exist");
  assert.match(
    mobileBlockMatch[1],
    /\.exercise-cards\{grid-template-columns:1fr/,
    "mobile breakpoint must keep the exercise card grid to one column"
  );
});

test("deterministic workout engine stays wired into both workout endpoints", () => {
  const serverSource = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");

  for (const engineFile of [
    "lib/workout-duration.js",
    "lib/workout-setcredits-map.js",
    "lib/workout-validator.js",
    "lib/workout-volume.js",
    "lib/workout-repair.js",
    "lib/workout-exercise-aliases.js",
    "lib/workout-validation-i18n.js"
  ]) {
    assert.ok(
      fs.existsSync(path.join(ROOT, engineFile)),
      `Engine module must exist: ${engineFile}`
    );
  }

  assert.match(serverSource, /calculateWeeklyVolume\(program, EXERCISE_SETCREDITS\)/);
  assert.match(serverSource, /estimateSessionDuration\(session\)/);
  assert.match(serverSource, /validateWorkoutProgram\(program, \{/);
  assert.match(
    serverSource,
    /repairGeneratedWorkoutProgram\(program, \{\s*sessionDuration: parsedDuration,\s*equipment: equipmentForGeneration,/
  );
  assert.match(serverSource, /program\.weeklyScheduleDays = \[\]/);

  const responseFieldCount = (field) =>
    (serverSource.match(new RegExp(`\\b${field}\\b`, "g")) || []).length;

  assert.ok(
    responseFieldCount("weeklyVolume") >= 2,
    "both /api/workout-builder and reroll-exercise must return weeklyVolume"
  );
  assert.ok(
    responseFieldCount("sessionDurations") >= 2,
    "both endpoints must return sessionDurations"
  );
  assert.ok(
    responseFieldCount("validationSummary") >= 2,
    "both endpoints must return validationSummary"
  );
});
