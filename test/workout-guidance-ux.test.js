// Regression tests for the Workout Guidance UX copy and controls.
//
// These cover PRESENTATION only. They assert what the user reads and can
// operate; they never assert a set count, a target range value or an
// exercise choice, because this branch changed none of those.
//
// Two invariants matter most and are easy to regress:
//   1. the quality-score CALCULATION must survive even though the number is
//      no longer rendered, and an older saved plan carrying it must load;
//   2. the RIR explanation must stay reachable without a mouse.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (...segments) => fs.readFileSync(path.join(ROOT, ...segments), "utf8");

const BUILDER_JS = read("public", "js", "workout-builder.js");
const BUILDER_CSS = read("public", "css", "workout-builder.css");
const TRACKER_JS = read("public", "js", "workout-tracker.js");
const SOCIAL_JS = read("public", "js", "social.js");
const SOCIAL_CORE = read("public", "js", "social-core.mjs");
const MANUAL_JS = read("public", "js", "manual-workout-builder.js");

// Strings only present inside a // comment are not user-facing. Strip them so
// the "no longer shown" assertions test rendered copy, not documentation.
function withoutComments(source) {
  return source
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/*"))
    .join("\n");
}

const BUILDER_CODE = withoutComments(BUILDER_JS);

// --- 1. Quality score removed from the UI, kept in the engine ----------

test("the program quality score is no longer rendered", () => {
  assert.doesNotMatch(BUILDER_CODE, /Program quality score/i);
  assert.doesNotMatch(BUILDER_CODE, /ציון איכות/);
  assert.doesNotMatch(BUILDER_CODE, /\$\{score\}\/100/);
  assert.doesNotMatch(BUILDER_CODE, /weeklyVolumeQualityScore/);
});

test("no other user-facing surface prints a quality score", () => {
  for (const [name, source] of [
    ["workout-tracker.js", TRACKER_JS],
    ["social.js", SOCIAL_JS],
    ["social-core.mjs", SOCIAL_CORE],
    ["manual-workout-builder.js", MANUAL_JS]
  ]) {
    assert.doesNotMatch(withoutComments(source), /quality score|ציון איכות/i, `${name} still shows a quality score`);
  }
});

test("the quality-score calculation is untouched and still exported", () => {
  const targets = require("../lib/workout-volume-targets");
  assert.equal(typeof targets.calculateProgramQualityScore, "function");
  assert.equal(typeof targets.muscleQualityScore, "function");

  const profile = { experience: "intermediate", priority: "hypertrophy", daysPerWeek: 4 };
  const result = targets.calculateProgramQualityScore({ chest: { total: 12 } }, profile);
  assert.ok(Number.isFinite(result.score), "the score must still be computable");
  assert.ok(result.score >= 0 && result.score <= 100);
});

test("a saved plan carrying a quality score still loads", () => {
  // The field must still be READ from the response so an older saved plan
  // does not hit an undefined path -- it is simply not displayed.
  assert.match(BUILDER_JS, /weeklyVolume\?\.qualityScore/, "the response field must still be read");
  assert.match(BUILDER_JS, /const qualityScoreLine = ""/, "the line must render as empty, not be deleted from the flow");
  assert.match(BUILDER_JS, /\$\{qualityScoreLine\}/, "the placeholder must still be interpolated safely");
});

// --- 2. Volume status labels -------------------------------------------

test("volume status labels use the agreed user-facing wording", () => {
  for (const label of [
    "Within target range",
    "Below target range",
    "Above target range",
    "Supporting volume",
    "Below programming range",
    "Above programming range"
  ]) {
    assert.ok(BUILDER_JS.includes(label), `missing English label: ${label}`);
  }
  for (const label of [
    "בתוך טווח היעד",
    "מתחת לטווח היעד",
    "מעל טווח היעד",
    "נפח תומך",
    "מתחת לטווח התכנון",
    "מעל טווח התכנון"
  ]) {
    assert.ok(BUILDER_JS.includes(label), `missing Hebrew label: ${label}`);
  }
});

test("the internal-sounding labels are gone from the UI", () => {
  for (const gone of [
    "In preferred zone",
    "Valid — below preferred target",
    "Valid — above preferred target",
    "Secondary / optional",
    "Below minimum",
    "Above maximum"
  ]) {
    assert.ok(!BUILDER_CODE.includes(gone), `still user-facing: ${gone}`);
  }
});

test("the status mapping is presentation-only", () => {
  // The engine's status keys must be unchanged -- only their labels moved.
  for (const key of [
    '"valid-below-preferred"',
    '"in-preferred-zone"',
    '"valid-above-preferred"'
  ]) {
    assert.ok(BUILDER_JS.includes(key), `status key ${key} must still drive the mapping`);
  }
  const targets = require("../lib/workout-volume-targets");
  const policy = { minimumEffective: 8, preferredMin: 12, preferredMax: 16, hardMaximum: 20 };
  assert.equal(targets.detailedVolumeStatus(9, policy), "valid-below-preferred");
  assert.equal(targets.detailedVolumeStatus(14, policy), "in-preferred-zone");
  assert.equal(targets.detailedVolumeStatus(18, policy), "valid-above-preferred");
});

// --- 3. Range description ----------------------------------------------

test('"Minimum effective" is no longer user-facing', () => {
  assert.ok(!BUILDER_CODE.includes("Minimum effective"), "English still shows Minimum effective");
  assert.ok(!BUILDER_CODE.includes("מינימום אפקטיבי"), "Hebrew still shows Minimum effective");
  assert.ok(!BUILDER_CODE.includes("Maximum programmed"));
});

test("ranges are described as programming and target ranges", () => {
  assert.match(BUILDER_JS, /Programming range: \$\{min\}–\$\{max\}/);
  assert.match(BUILDER_JS, /Target range: \$\{min\}–\$\{max\}/);
  assert.match(BUILDER_JS, /טווח התכנון: \$\{min\}–\$\{max\}/);
  assert.match(BUILDER_JS, /טווח היעד: \$\{min\}–\$\{max\}/);
});

test("the range line still uses the same untouched numeric fields", () => {
  assert.match(
    BUILDER_JS,
    /weeklyVolumeProgrammingRange\(entry\.minimumEffective, entry\.hardMaximum\)/,
    "programming range must come from the engine's own min/max"
  );
  assert.match(
    BUILDER_JS,
    /weeklyVolumeTargetRange\(entry\.preferredMin, entry\.preferredMax\)/,
    "target range must come from the engine's own preferred zone"
  );
});

test("the not-a-medical-optimum disclaimer is retained", () => {
  assert.match(BUILDER_JS, /not a universal or medically exact optimum/i);
  assert.match(BUILDER_JS, /לא יעד רפואי מדויק ואוניברסלי/);
});

// --- 4. Reps and effort labelling --------------------------------------

test("the rep range is labelled as a target, not a stopping point", () => {
  assert.match(BUILDER_JS, /targetReps: "Target reps"/);
  assert.match(BUILDER_JS, /targetReps: "חזרות יעד"/);
  assert.match(BUILDER_JS, /exercise-stat-label">\$\{ui\.targetReps\}/, "the card must render the target-reps label");
});

test("RIR is presented as effort with its unit", () => {
  assert.match(BUILDER_JS, /effort: "Effort"/);
  assert.match(BUILDER_JS, /effort: "מאמץ"/);
  assert.match(BUILDER_JS, /rirUnit: \(value\) => `\$\{value\} RIR`/);
  assert.match(BUILDER_JS, /exercise-stat--effort/);
});

test("persistent effort education is consolidated into one plan-level panel", () => {
  assert.match(BUILDER_JS, /class="training-effort-panel"/);
  assert.match(BUILDER_JS, /\$\{renderTrainingEffortGuidance\(\)\}/);
  assert.doesNotMatch(BUILDER_JS, /class="exercise-effort-guidance"/);
  assert.match(BUILDER_JS, /Use the prescribed RIR to choose your load/);
  assert.match(BUILDER_JS, /Finish each working set with approximately the shown number of clean repetitions still possible/);
  assert.match(BUILDER_JS, /השתמשו ביעד ה-RIR כדי לבחור את המשקל/);
});

// --- 5. RIR help content ------------------------------------------------

test("the RIR acronym is expanded, not just shown", () => {
  assert.match(BUILDER_JS, /Reps In Reserve/);
  assert.match(BUILDER_JS, /חזרות שנותרו במלאי|חזרות נקיות/);
});

test("the help explains RIR 2 concretely", () => {
  assert.match(BUILDER_JS, /RIR 2 means .*about 2 more clean repetitions/i);
  assert.match(BUILDER_JS, /RIR 2 אומר/);
});

test("the help explicitly prevents stopping just because the rep number was reached", () => {
  assert.match(
    BUILDER_JS,
    /Do not stop solely because you reached the bottom of the rep range/i,
    "the anti-auto-stop sentence is the whole point of this change"
  );
  assert.match(BUILDER_JS, /use a more challenging load next time/i);
  assert.match(BUILDER_JS, /אל תעצרו רק בגלל שהגעתם לתחתית טווח החזרות/);
});

test("broken form is excluded from reserve reps", () => {
  assert.match(BUILDER_JS, /form breaks down/i);
  assert.match(BUILDER_JS, /הטכניקה מתקלקלת/);
});

test("nothing instructs the user to train to failure on every set", () => {
  assert.match(BUILDER_JS, /You do not need to train to complete failure on every set/i);
  assert.match(BUILDER_JS, /אין צורך להגיע לכשל מוחלט בכל סט/);
  // No absolute or medicalised claims.
  for (const forbidden of ["No hypertrophy", "Ineffective", "guaranteed", "must reach failure"]) {
    assert.ok(!BUILDER_CODE.includes(forbidden), `forbidden absolute claim present: ${forbidden}`);
  }
});

// --- 6. Accessible help control ----------------------------------------

test("the help control is a real, keyboard-reachable button", () => {
  assert.match(BUILDER_JS, /<button\s+type="button"\s+class="rir-help-trigger"/);
  assert.match(BUILDER_JS, /aria-label="\$\{escapeHtml\(ui\.rirHelpLabel\)\}"/);
  assert.match(BUILDER_JS, /aria-expanded="false"/);
  assert.match(BUILDER_JS, /aria-haspopup="dialog"/);
});

test("the explanation is not hover-only", () => {
  // The old title="" tooltip was invisible to touch and screen readers.
  assert.ok(!BUILDER_CODE.includes('title="${rirTitle}"'), "the hover-only tooltip must be gone");
  assert.match(BUILDER_JS, /rirHelpBody/, "the copy must live in the DOM, not a title attribute");
});

test("Escape closes the help and focus returns to the trigger", () => {
  assert.match(BUILDER_JS, /event\.key === "Escape"/);
  assert.match(BUILDER_JS, /function closeRirHelp/);
  assert.match(BUILDER_JS, /restoreFocus.*rirHelpLastTrigger\?\.focus\(\)/s);
  assert.match(BUILDER_JS, /rirHelpLastTrigger\?\.setAttribute\("aria-expanded", "false"\)/);
});

test("the help panel is exposed as a dialog with an accessible name", () => {
  assert.match(BUILDER_JS, /setAttribute\("role", "dialog"\)/);
  assert.match(BUILDER_JS, /setAttribute\("aria-labelledby", "rirHelpPopoverTitle"\)/);
});

test("the trigger keeps a usable touch target and cannot be squeezed flat", () => {
  assert.match(BUILDER_CSS, /\.rir-help-trigger\s*\{[^}]*flex:\s*0 0 auto/s);
  assert.match(BUILDER_CSS, /\.rir-help-trigger\s*\{[^}]*min-width:\s*24px/s);
  assert.match(BUILDER_CSS, /\.rir-help-trigger\s*\{[^}]*height:\s*24px/s);
  assert.match(BUILDER_CSS, /\.rir-help-trigger:focus-visible/, "the trigger needs a visible focus ring");
});

test("narrow stat tiles wrap instead of clipping", () => {
  assert.match(BUILDER_CSS, /\.exercise-card-stats > \.exercise-stat\s*\{[^}]*min-width:\s*0/s);
  assert.match(BUILDER_CSS, /\.exercise-stat-value\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});

// --- 7. Cross-surface terminology --------------------------------------

test("Tracker uses the same effort and target-reps wording", () => {
  assert.match(TRACKER_JS, /prescriptionTargetReps: "target reps"/);
  assert.match(TRACKER_JS, /prescriptionTargetReps: "חזרות יעד"/);
  assert.match(TRACKER_JS, /effortRir: \(value\) => `effort \$\{value\} RIR`/);
  assert.match(TRACKER_JS, /effortRir: \(value\) => `מאמץ \$\{value\} RIR`/);
  assert.match(TRACKER_JS, /exercise-effort-guidance/);
  assert.ok(!/<span>RIR \$\{esc\(exercise\.rir\)\}<\/span>/.test(TRACKER_JS), "bare RIR label must be gone");
});

test("shared-plan previews use the same wording", () => {
  assert.match(SOCIAL_CORE, /targetReps: "target reps"/);
  assert.match(SOCIAL_CORE, /targetReps: "חזרות יעד"/);
  assert.match(SOCIAL_CORE, /effortRir: \(value\) => `effort \$\{value\} RIR`/);
  assert.match(SOCIAL_JS, /\$\{ui\.targetReps\}/);
  assert.match(SOCIAL_JS, /ui\.effortRir\(exercise\.rir\)/);
  assert.ok(!/· RIR \$\{escapeHtml\(exercise\.rir\)\}/.test(SOCIAL_JS), "bare RIR label must be gone");
});

test("the Manual Builder labels its rep input consistently", () => {
  assert.match(MANUAL_JS, /reps:"Target reps"/);
  assert.match(MANUAL_JS, /reps:"חזרות יעד"/);
});

test("every surface ships both English and Hebrew copy", () => {
  const hebrew = /[֐-׿]/;
  for (const [name, source] of [
    ["workout-builder.js", BUILDER_JS],
    ["workout-tracker.js", TRACKER_JS],
    ["social-core.mjs", SOCIAL_CORE],
    ["manual-workout-builder.js", MANUAL_JS]
  ]) {
    assert.ok(hebrew.test(source), `${name} is missing Hebrew copy`);
  }
});

// --- 8. Generation behaviour untouched ---------------------------------

test("this branch changed no workout generation input", () => {
  // The prescribed values are rendered straight from the response object;
  // nothing here recomputes or rounds them.
  assert.match(BUILDER_JS, /escapeHtml\(String\(exercise\.reps\)\)/, "reps must be rendered verbatim");
  assert.match(BUILDER_JS, /escapeHtml\(String\(exercise\.sets\)\)/, "sets must be rendered verbatim");
  assert.match(BUILDER_JS, /escapeHtml\(String\(exercise\.restSeconds\)\)/, "rest must be rendered verbatim");
  assert.match(BUILDER_JS, /ui\.rirUnit\(String\(exercise\.rir\)\)/, "RIR must be rendered verbatim");
});
