// Weekly Muscle Volume summary: server response shape, stale-summary
// regression (mirroring the nutrition stale-summary bug pattern), and
// frontend wiring. workout-builder.js has same-directory relative imports
// (./firebase-config.js, ./analytics.js, ...) that cannot resolve from a
// data: URL module, so — matching the established pattern in
// test/workout-builder-result-cards.test.js — the frontend checks here are
// source-level assertions against the real file text, not a live DOM.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { repairWorkoutProgram } = require("../lib/workout-repair");
const { calculateWeeklyVolume } = require("../lib/workout-volume");
const { EXERCISE_SETCREDITS } = require("../lib/workout-setcredits-map");
const { allTargetRanges, volumeStatus } = require("../lib/workout-volume-targets");

const ROOT = path.join(__dirname, "..");

function buildPerMuscleWithTargets(perMuscle, profile) {
  // Mirrors server.js's buildPerMuscleWithTargets exactly (see server.js) so
  // this test exercises the real merge shape without needing to spin up an
  // HTTP server for every case.
  const targets = allTargetRanges(profile);
  const muscles = new Set([...Object.keys(perMuscle || {}), ...Object.keys(targets)]);
  const merged = {};
  for (const muscle of muscles) {
    const volume = perMuscle?.[muscle] || { direct: 0, fractional: 0, total: 0 };
    const targetRange = targets[muscle] || null;
    merged[muscle] = {
      direct: volume.direct,
      fractional: volume.fractional,
      total: volume.total,
      targetRange,
      status: volumeStatus(volume.total, targetRange)
    };
  }
  return merged;
}

function ex(overrides = {}) {
  return {
    name: "Placeholder", demoName: "Placeholder", muscleGroup: "Chest", equipment: "Machine",
    sets: 3, reps: "8-12", restSeconds: 90, rir: "1-2", notes: "", ...overrides
  };
}

test("server-shape: perMuscle entries carry direct, fractional, total, targetRange and status together", () => {
  const program = {
    sessions: [{
      name: "Day 1",
      exercises: [
        ex({ name: "Machine Chest Press", demoName: "Machine Chest Press", muscleGroup: "Chest", equipment: "Machine", sets: 4, exerciseId: "machine-chest-press" }),
        ex({ name: "Machine Chest Fly", demoName: "Machine Chest Fly", muscleGroup: "Chest", equipment: "Machine", sets: 3, exerciseId: "machine-chest-fly" })
      ]
    }]
  };
  const { perMuscle } = calculateWeeklyVolume(program, EXERCISE_SETCREDITS);
  const merged = buildPerMuscleWithTargets(perMuscle, { experience: "intermediate", priority: "hypertrophy", daysPerWeek: 3 });

  assert.ok(merged.chest, "expected a chest entry");
  assert.equal(typeof merged.chest.direct, "number");
  assert.equal(typeof merged.chest.fractional, "number");
  assert.equal(typeof merged.chest.total, "number");
  assert.equal(merged.chest.total, merged.chest.direct + merged.chest.fractional, "total must equal direct + fractional");
  assert.ok(merged.chest.targetRange && typeof merged.chest.targetRange.min === "number");
  assert.ok(["below", "in-range", "above"].includes(merged.chest.status));
});

test("no muscle is falsely labeled in-range when it is actually below or above its target", () => {
  const range = { min: 10, max: 18 };
  assert.notEqual(volumeStatus(5, range), "in-range");
  assert.notEqual(volumeStatus(25, range), "in-range");
  assert.equal(volumeStatus(14, range), "in-range");
});

// --- Stale summary regression (mirrors the nutrition stale-summary bug) ---

test("stale-summary regression: the volume summary changes after a repair that changes sets, and is never left stale", () => {
  // A program deliberately far under target for chest (2 sets), Gym +
  // Machines only, Advanced -- applyVolumeTargets:true must bump it, and a
  // freshly recalculated summary must reflect the NEW number, not the
  // pre-repair one.
  const program = {
    sessions: [{
      name: "Day 1",
      exercises: [
        ex({ name: "Machine Chest Press", demoName: "Machine Chest Press", muscleGroup: "Chest", equipment: "Machine", sets: 2 }),
        ex({ name: "Machine Row", demoName: "Machine Row", muscleGroup: "Back", equipment: "Machine", sets: 3 }),
        ex({ name: "Leg Press", demoName: "Leg Press", muscleGroup: "Quads", equipment: "Machine", sets: 3 })
      ]
    }]
  };

  const beforeVolume = calculateWeeklyVolume(program, EXERCISE_SETCREDITS);
  const chestBefore = beforeVolume.perMuscle.chest?.total || 0;

  const { program: repaired } = repairWorkoutProgram(program, {
    sessionDuration: 60,
    equipment: ["machine"],
    experience: "advanced",
    priority: "hypertrophy",
    daysPerWeek: 4,
    applyVolumeTargets: true
  });

  const afterVolume = calculateWeeklyVolume(repaired, EXERCISE_SETCREDITS);
  const chestAfter = afterVolume.perMuscle.chest?.total || 0;

  assert.notEqual(chestAfter, chestBefore, "the repair must have changed chest volume for this under-target fixture");
  assert.ok(chestAfter > chestBefore, "the repair must move an under-target muscle UP, not leave it stale");
});

test("stale-summary regression: reroll produces a fresh summary reflecting the replacement exercise, not the old one", () => {
  const programBefore = {
    daysPerWeek: 1,
    sessions: [{
      name: "Day 1",
      exercises: [
        ex({ exerciseId: "machine-chest-press", name: "Machine Chest Press", demoName: "Machine Chest Press", muscleGroup: "Chest", equipment: "Machine", sets: 3 })
      ]
    }]
  };
  const volumeBefore = calculateWeeklyVolume(programBefore, EXERCISE_SETCREDITS);

  // Simulate what the reroll endpoint does: replace the exercise, then
  // recalculate against the FULL updated program (not the pre-reroll one).
  const programAfter = JSON.parse(JSON.stringify(programBefore));
  programAfter.sessions[0].exercises[0] = ex({
    exerciseId: "dumbbell-bench-press", name: "Dumbbell Bench Press", demoName: "Dumbbell Bench Press", muscleGroup: "Chest", equipment: "Dumbbell", sets: 5
  });
  const volumeAfter = calculateWeeklyVolume(programAfter, EXERCISE_SETCREDITS);

  assert.notEqual(volumeAfter.perMuscle.chest.total, volumeBefore.perMuscle.chest.total, "reroll must produce a genuinely different total, proving it isn't reusing the pre-reroll summary");
});

// --- English/Hebrew: identical numeric totals, labels localized only at render ---

test("English and Hebrew programs with the same exercises/sets produce identical numeric weekly volume totals", () => {
  const englishProgram = {
    sessions: [{ name: "Day 1", exercises: [ex({ exerciseId: "machine-chest-press", name: "Machine Chest Press", muscleGroup: "Chest", equipment: "Machine", sets: 4 })] }]
  };
  const hebrewProgram = {
    sessions: [{ name: "יום 1", exercises: [ex({ exerciseId: "machine-chest-press", name: "לחיצת חזה במכונה", demoName: "Machine Chest Press", muscleGroup: "חזה", equipment: "מכונה", sets: 4 })] }]
  };

  const englishVolume = calculateWeeklyVolume(englishProgram, EXERCISE_SETCREDITS);
  const hebrewVolume = calculateWeeklyVolume(hebrewProgram, EXERCISE_SETCREDITS);

  assert.equal(hebrewVolume.perMuscle.chest.total, englishVolume.perMuscle.chest.total, "the numeric total must depend only on exerciseId + sets, never on which language name/muscleGroup string was used");
});

// --- Frontend wiring (source-level, matching this suite's established pattern) ---

test("workout-builder.js: renders the Weekly Muscle Volume section for both initial generation and after reroll", () => {
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "workout-builder.js"), "utf8");

  assert.match(source, /function renderWeeklyVolumeSummary\(/);
  assert.match(source, /function renderProgram\(program, weeklyVolume\)/);
  assert.match(source, /renderProgram\(data\.program, data\.weeklyVolume\)/, "the initial generation response must pass weeklyVolume through to rendering");
  assert.match(source, /id="weekly-volume-container"/);
  assert.match(source, /volumeContainer\.innerHTML = renderWeeklyVolumeSummary\(data\.weeklyVolume\)/, "reroll must re-render the summary from the reroll response's OWN weeklyVolume, not reuse the pre-reroll one");
  assert.match(source, /window\.currentWeeklyVolume = data\.weeklyVolume/);
});

test("workout-builder.js: every canonical setCredits muscle key has a display-name mapping", () => {
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "workout-builder.js"), "utf8");
  const { EXERCISE_SETCREDITS } = require("../lib/workout-setcredits-map");

  const allMuscles = new Set();
  for (const credits of Object.values(EXERCISE_SETCREDITS)) {
    for (const muscle of Object.keys(credits)) allMuscles.add(muscle);
  }

  const mapMatch = source.match(/const MUSCLE_DISPLAY_NAMES = \{([\s\S]*?)\};/);
  assert.ok(mapMatch, "expected a MUSCLE_DISPLAY_NAMES map");
  for (const muscle of allMuscles) {
    assert.match(mapMatch[1], new RegExp(`\\b${muscle}:`), `MUSCLE_DISPLAY_NAMES is missing an entry for "${muscle}"`);
  }
});

test("workout-builder.js: number formatting is whole for exact values and one decimal only when fractional", () => {
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "workout-builder.js"), "utf8");
  const fnMatch = source.match(/function formatVolumeNumber\(value\) \{[\s\S]*?\n\}/);
  assert.ok(fnMatch, "expected a formatVolumeNumber function");

  // Execute the REAL function body (not a re-implementation) to verify its
  // actual behavior.
  // eslint-disable-next-line no-new-func
  const formatVolumeNumber = new Function(`${fnMatch[0]}; return formatVolumeNumber;`)();
  assert.equal(formatVolumeNumber(12), "12");
  assert.equal(formatVolumeNumber(12.0), "12");
  assert.equal(formatVolumeNumber(12.5), "12.5");
  assert.equal(formatVolumeNumber(12.333), "12.3");
  assert.equal(formatVolumeNumber(0), "0");
});

test("workout-builder.js: weekly volume UI strings are defined for both English and Hebrew, and labels are applied only at render time", () => {
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "workout-builder.js"), "utf8");

  for (const key of [
    "weeklyVolumeTitle", "weeklyVolumeBelow", "weeklyVolumeValidBelowPreferred",
    "weeklyVolumeInPreferredZone", "weeklyVolumeValidAbovePreferred", "weeklyVolumeAbove",
    "weeklyVolumeRecommendedRange",
    // The range line is described as two plain ranges instead of
    // "Minimum effective: N · Preferred target: A-B · Maximum programmed: M".
    // Same numbers, different framing -- see test/workout-guidance-ux.test.js.
    "weeklyVolumeProgrammingRange", "weeklyVolumeTargetRange",
    "weeklyVolumeDetails"
  ]) {
    const matches = source.match(new RegExp(`${key}:`, "g")) || [];
    assert.ok(matches.length >= 2, `expected "${key}" defined in both language tables, found ${matches.length}`);
  }

  // The renderer must key its status lookup off the CANONICAL status string
  // coming from the server ("below" / "valid-below-preferred" /
  // "in-preferred-zone" / "valid-above-preferred" / "above"), translating to
  // a label only inside the render function -- not baking a language choice
  // into the calculation layer.
  assert.match(source, /statusLabel\s*=\s*\{\s*below:\s*ui\.weeklyVolumeBelow/);
  assert.match(source, /"valid-below-preferred":\s*ui\.weeklyVolumeValidBelowPreferred/);
  assert.match(source, /"in-preferred-zone":\s*ui\.weeklyVolumeInPreferredZone/);
});

test("workout-builder.css: distinct visual states exist for below/preferred-zone/above status, with a visually distinct 'valid but off-target' state", () => {
  const css = fs.readFileSync(path.join(ROOT, "public", "css", "workout-builder.css"), "utf8");
  assert.match(css, /\.muscle-volume-status--below\s*\{/);
  assert.match(css, /\.muscle-volume-status--in-preferred-zone\s*\{/);
  assert.match(css, /\.muscle-volume-status--above\s*\{/);
  assert.match(css, /\.muscle-volume-status--valid-below-preferred/);
  assert.match(css, /\.muscle-volume-status--valid-above-preferred/);

  // The "valid but below/above preferred" rule must not reuse the
  // in-preferred-zone success color -- a bare-minimum value must never look
  // identical to a well-targeted one (the reported "sits at the minimum but
  // reads as fully optimized" bug).
  const successRule = css.match(/\.muscle-volume-status--in-preferred-zone\s*\{([^}]*)\}/)[1];
  const validOffTargetRule = css.match(/\.muscle-volume-status--valid-below-preferred,\s*\n\.muscle-volume-status--valid-above-preferred\s*\{([^}]*)\}/)[1];
  assert.notEqual(successRule.trim(), validOffTargetRule.trim(), "a bare-minimum value must be visually distinct from a preferred-zone value");
});

test("Weekly Muscle Volume section is positioned after all workout sessions, not interleaved with them", () => {
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "workout-builder.js"), "utf8");
  const programDaysIndex = source.indexOf('<div class="program-days">');
  const volumeContainerIndex = source.indexOf('<div id="weekly-volume-container">');
  assert.ok(programDaysIndex !== -1 && volumeContainerIndex !== -1);
  assert.ok(volumeContainerIndex > programDaysIndex, "the weekly volume section must render after the sessions grid");
});

// --- Secondary / not-targeted / incomplete statuses (release-blocking fix) ---

test("workout-builder.js: secondary/not-targeted/incomplete statuses are mapped to distinct, non-alarming labels", () => {
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "workout-builder.js"), "utf8");
  assert.match(source, /secondary:\s*ui\.weeklyVolumeSecondary/);
  assert.match(source, /"not-targeted":\s*ui\.weeklyVolumeNotTargeted/);
  assert.match(source, /incomplete:\s*ui\.weeklyVolumeIncomplete/);

  for (const key of ["weeklyVolumeSecondary", "weeklyVolumeNotTargeted", "weeklyVolumeIncomplete"]) {
    const matches = source.match(new RegExp(`${key}:`, "g")) || [];
    assert.ok(matches.length >= 2, `expected "${key}" defined in both language tables, found ${matches.length}`);
  }
});

test("workout-builder.css: secondary/not-targeted/incomplete use a neutral style, never the success/warning/danger colors", () => {
  const css = fs.readFileSync(path.join(ROOT, "public", "css", "workout-builder.css"), "utf8");
  const ruleMatch = css.match(/\.muscle-volume-status--secondary,\s*\n\.muscle-volume-status--not-targeted,\s*\n\.muscle-volume-status--incomplete\s*\{([^}]*)\}/);
  assert.ok(ruleMatch, "expected a shared neutral rule for secondary/not-targeted/incomplete");
  assert.doesNotMatch(ruleMatch[1], /--fp-(success|warning|danger)/, "these statuses must never reuse a below/in-range/above color token");
});

test("a secondary muscle's badge carries an explanatory tooltip so it doesn't read as a silent mandatory minimum", () => {
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "workout-builder.js"), "utf8");
  assert.match(source, /secondaryNote\s*=\s*entry\.status === "secondary" \? ui\.weeklyVolumeSecondaryNote/);
  assert.match(source, /muscle-volume-status--\$\{statusClass\}"\$\{secondaryNote/);
});
