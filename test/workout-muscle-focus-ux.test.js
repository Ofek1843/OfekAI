// Regression tests for the optional Muscle Focus builder step.
//
// Presentation and contract only. Nothing here asserts how the solver should
// USE a focus selection -- that belongs to the backend branch. What is locked
// is the canonical payload shape, the default-to-balanced behaviour that
// keeps every existing user on the legacy path, the validation that refuses
// to silently downgrade a user's choice, and the accessibility of a selector
// that must work without its graphic.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (...segments) => fs.readFileSync(path.join(ROOT, ...segments), "utf8");

const BUILDER_HTML = read("public", "workout-builder.html");
const BUILDER_JS = read("public", "js", "workout-builder.js");
const BUILDER_CSS = read("public", "css", "workout-builder.css");
const SOCIAL_JS = read("public", "js", "social.js");
const MANUAL_JS = read("public", "js", "manual-workout-builder.js");

const stripComments = (source) =>
  source
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/*"))
    .join("\n");

// The canonical vocabulary. These are the engine's own muscle keys, so a
// mismatch here would silently break the solver contract.
const CANONICAL_MUSCLES = [
  "chest", "back", "delts", "rear_delts", "traps", "biceps",
  "triceps", "core", "glutes", "quads", "hamstrings", "calves"
];

// --- Step presence and default -----------------------------------------

test("the builder has a muscle focus step", () => {
  assert.match(BUILDER_HTML, /data-wizard-step="muscleFocus"/);
  assert.match(BUILDER_HTML, /data-step-title-en="Muscle Focus"/);
  assert.match(BUILDER_HTML, /data-step-title-he="מיקוד שרירים"/);
});

test("the step is presented as optional in both languages", () => {
  assert.match(BUILDER_HTML, /Optional — personalize which muscles receive the most attention\./);
  assert.match(BUILDER_HTML, /אופציונלי — התאימו אילו שרירים יקבלו את עיקר הדגש בתוכנית\./);
});

test("balanced is the default and is the only pre-checked mode", () => {
  const checked = [...BUILDER_HTML.matchAll(/<input type="radio" name="muscleFocusMode" value="(\w+)"([^>]*)>/g)]
    .filter(match => match[2].includes("checked"))
    .map(match => match[1]);
  assert.deepEqual(checked, ["balanced"], "exactly one mode may be pre-checked, and it must be balanced");
  assert.match(BUILDER_JS, /MUSCLE_FOCUS_DEFAULT_MODE = "balanced"/);
});

test("all three modes exist with the agreed values", () => {
  for (const mode of ["balanced", "prioritize", "selected_only"]) {
    assert.match(BUILDER_HTML, new RegExp(`name="muscleFocusMode" value="${mode}"`), `missing mode: ${mode}`);
  }
  assert.match(BUILDER_JS, /MUSCLE_FOCUS_MODES = Object\.freeze\(\["balanced", "prioritize", "selected_only"\]\)/);
});

test("mode copy is present in English and Hebrew", () => {
  for (const copy of [
    "Balanced",
    "Train all major muscle groups with balanced programming.",
    "Prioritize selected muscles",
    "Give your selected muscles first priority while still training the rest of the body.",
    "Selected muscles only",
    "Build the plan around the muscles you choose. Other muscles may still work indirectly during compound movements."
  ]) {
    assert.ok(BUILDER_HTML.includes(copy), `missing English copy: ${copy}`);
  }
  for (const copy of [
    "מאוזן",
    "אימון מאוזן של קבוצות השרירים המרכזיות.",
    "תעדוף השרירים שנבחרו",
    "השרירים שבחרתם יקבלו עדיפות, תוך המשך אימון שאר הגוף.",
    "רק השרירים שנבחרו"
  ]) {
    assert.ok(BUILDER_HTML.includes(copy), `missing Hebrew copy: ${copy}`);
  }
});

test("selected_only is not described as medically recommended", () => {
  for (const forbidden of ["recommended by", "medically", "clinically", "optimal for everyone", "best for"]) {
    assert.ok(!BUILDER_HTML.toLowerCase().includes(forbidden.toLowerCase()), `unsupported claim: ${forbidden}`);
  }
});

// --- Canonical muscles --------------------------------------------------

test("all twelve canonical muscle groups are selectable", () => {
  for (const id of CANONICAL_MUSCLES) {
    assert.match(BUILDER_JS, new RegExp(`id: "${id}"`), `missing canonical muscle: ${id}`);
  }
  const declared = [...BUILDER_JS.matchAll(/\{ id: "(\w+)", en: "/g)].map(match => match[1]);
  assert.deepEqual(declared.slice().sort(), CANONICAL_MUSCLES.slice().sort());
});

test("the UI muscle ids match the engine's own muscle keys", () => {
  // A drift here would break the solver contract silently.
  const { MUSCLE_POLICY } = require("../lib/workout-volume-targets");
  for (const id of CANONICAL_MUSCLES) {
    assert.ok(Object.hasOwn(MUSCLE_POLICY, id), `"${id}" is not an engine muscle key`);
  }
});

test("every muscle has an English and a Hebrew label", () => {
  const entries = [...BUILDER_JS.matchAll(/\{ id: "(\w+)", en: "([^"]+)", he: "([^"]+)"/g)];
  assert.equal(entries.length, CANONICAL_MUSCLES.length);
  for (const [, id, en, he] of entries) {
    assert.ok(en.trim(), `${id} has no English label`);
    assert.ok(/[֐-׿]/.test(he), `${id} has no Hebrew label`);
  }
});

// --- Payload contract ---------------------------------------------------

test("the payload uses the agreed field names", () => {
  assert.match(BUILDER_JS, /muscleFocusMode: mode/);
  assert.match(BUILDER_JS, /selectedMuscles\b/);
  assert.match(BUILDER_JS, /\.\.\.muscleFocusPayload\(\)/, "the payload must be spread into the request body");
  // No invented aliases.
  for (const alias of ["focusMode", "muscleFocus:", "targetMuscles", "muscleGroups:"]) {
    assert.ok(!stripComments(BUILDER_JS).includes(alias), `unexpected alternate field name: ${alias}`);
  }
});

test("balanced always sends an empty selection", () => {
  assert.match(
    BUILDER_JS,
    /const selectedMuscles = mode === "balanced"\s*\?\s*\[\]/,
    "balanced must send [] regardless of what is still ticked"
  );
});

test("an unrecognised mode falls back to balanced", () => {
  assert.match(BUILDER_JS, /MUSCLE_FOCUS_MODES\.includes\(muscleFocusState\.mode\)\s*\?[\s\S]{0,80}MUSCLE_FOCUS_DEFAULT_MODE/);
});

// --- Validation ---------------------------------------------------------

test("balanced needs no selection", () => {
  assert.match(BUILDER_JS, /if \(muscleFocusMode === "balanced"\) return "";/);
});

test("prioritize and selected_only require at least one muscle", () => {
  assert.match(BUILDER_JS, /if \(selectedMuscles\.length > 0\) return "";/);
  assert.match(BUILDER_JS, /Select at least one muscle to prioritize/);
  assert.match(BUILDER_JS, /Select at least one muscle for a selected-muscle plan/);
  assert.match(BUILDER_JS, /בחרו לפחות שריר אחד לתעדוף/);
  assert.match(BUILDER_JS, /בחרו לפחות שריר אחד לתוכנית ממוקדת/);
});

test("the wizard runs the focus validation for its step", () => {
  assert.match(BUILDER_JS, /if \(key === "muscleFocus"\) return validateMuscleFocus\(\);/);
});

test("an invalid focus choice is never silently reset to balanced", () => {
  // validateMuscleFocus must only ever RETURN a message; it must not mutate
  // the mode back to the default.
  const body = BUILDER_JS.slice(
    BUILDER_JS.indexOf("function validateMuscleFocus"),
    BUILDER_JS.indexOf("function validateWizardStep")
  );
  assert.ok(body.length > 0, "validateMuscleFocus must exist");
  assert.ok(
    !/muscleFocusState\.mode\s*=/.test(body),
    "validation must not overwrite the user's chosen mode"
  );
});

// --- Backward compatibility --------------------------------------------

test("a plan with no focus fields resolves to balanced", () => {
  const body = BUILDER_JS.slice(
    BUILDER_JS.indexOf("function applyMuscleFocus"),
    BUILDER_JS.indexOf("function setupMuscleFocus")
  );
  assert.match(body, /MUSCLE_FOCUS_MODES\.includes\(source\?\.muscleFocusMode\)/);
  assert.match(body, /:\s*MUSCLE_FOCUS_DEFAULT_MODE/);
  assert.match(body, /Array\.isArray\(source\?\.selectedMuscles\)\s*\?\s*source\.selectedMuscles\s*:\s*\[\]/);
  assert.match(body, /filter\(\(id\) => FOCUS_MUSCLES\.some/, "unknown muscle ids must be discarded");
});

test("the focus is carried on the plan so save, reopen and copy keep it", () => {
  assert.match(BUILDER_JS, /muscleFocusMode: data\.program\.muscleFocusMode \|\| requestedFocus\.muscleFocusMode/);
  assert.match(BUILDER_JS, /Array\.isArray\(data\.program\.selectedMuscles\)/);
  // saveWorkoutPlan spreads the whole plan, so no separate write path is needed.
  assert.match(BUILDER_JS, /plan: \{\s*\.\.\.plan/s);
});

// --- Result explanation -------------------------------------------------

test("balanced plans render no focus summary", () => {
  assert.match(BUILDER_JS, /if \(!mode \|\| mode === "balanced"[\s\S]{0,60}\) return "";/);
});

test("the focus summary uses the agreed wording in both languages", () => {
  assert.match(BUILDER_JS, /Focus priority:/);
  assert.match(BUILDER_JS, /Selected-muscle plan:/);
  assert.match(BUILDER_JS, /These muscles were prioritized when the plan was allocated\./);
  assert.match(BUILDER_JS, /Exercises are centered on your selected muscles\. Compound movements may still train other muscles indirectly\./);
  assert.match(BUILDER_JS, /עדיפות מיקוד:/);
  assert.match(BUILDER_JS, /תוכנית ממוקדת שרירים:/);
});

test("nothing claims other muscles receive zero stimulus", () => {
  // Comments are stripped: the source explains in a comment that it must not
  // make this claim, and that explanation is not user-facing copy.
  const code = stripComments(BUILDER_JS).toLowerCase();
  for (const forbidden of ["no stimulus", "zero stimulus", "will not be trained", "receive nothing"]) {
    assert.ok(!code.includes(forbidden), `overclaim present: ${forbidden}`);
  }
});

// --- Accessibility ------------------------------------------------------

test("muscles are selectable without the diagram", () => {
  assert.match(BUILDER_HTML, /id="muscleChipGrid"/);
  assert.match(BUILDER_JS, /class="muscle-chip"/);
  // The diagram is decorative; the chips are authoritative.
  assert.match(BUILDER_HTML, /id="muscleDiagram"[^>]*aria-hidden="true"/);
});

test("chips are semantic buttons carrying selection state", () => {
  assert.match(BUILDER_JS, /<button\s+type="button"\s+class="muscle-chip"/);
  assert.match(BUILDER_JS, /aria-pressed="\$\{muscleFocusState\.selected\.has\(muscle\.id\) \? "true" : "false"\}/);
  assert.match(BUILDER_JS, /chip\.setAttribute\("aria-pressed"/);
});

test("front/back switches are buttons with pressed state", () => {
  assert.match(BUILDER_HTML, /class="muscle-view-button[^"]*" data-body-view="front" aria-pressed="true"/);
  assert.match(BUILDER_HTML, /data-body-view="back" aria-pressed="false"/);
  assert.match(BUILDER_JS, /switchButton\.setAttribute\("aria-pressed"/);
});

test("selection is not signalled by colour alone", () => {
  assert.match(BUILDER_CSS, /\.muscle-chip\.is-selected::after\s*\{[^}]*content:\s*" ✓"/s);
  assert.match(BUILDER_CSS, /\.focus-mode-card:has\(input:checked\)[\s\S]{0,200}content:\s*" ✓"/);
  assert.match(BUILDER_CSS, /\.muscle-chip\.is-selected\s*\{[^}]*border-width:\s*2px/s);
});

test("controls meet a usable touch target and show focus", () => {
  assert.match(BUILDER_CSS, /\.muscle-chip\s*\{[^}]*min-height:\s*44px/s);
  assert.match(BUILDER_CSS, /\.muscle-view-button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(BUILDER_CSS, /\.muscle-view-button:focus-visible,\s*\.muscle-chip:focus-visible/);
});

test("the hidden mode radio cannot cause horizontal overflow", () => {
  // It inherits the global input { width: 100% } unless sized explicitly.
  assert.match(BUILDER_CSS, /\.focus-mode-card input\s*\{[^}]*width:\s*1px/s);
  assert.match(BUILDER_CSS, /\.focus-mode-card input\s*\{[^}]*height:\s*1px/s);
});

// --- No sex-based pathway ----------------------------------------------

test("no sex or gender based focus pathway exists", () => {
  const combined = stripComments(BUILDER_HTML) + stripComments(BUILDER_JS);
  for (const forbidden of [
    "Male workout", "Female workout", "womensPlan", "menPlan",
    "female-focus", "male-focus", "forWomen", "forMen"
  ]) {
    assert.ok(!combined.includes(forbidden), `sex-based pathway present: ${forbidden}`);
  }
  // Nothing may be preselected, so no muscle can be defaulted by profile.
  assert.match(BUILDER_JS, /selected: new Set\(\)/, "no muscle may be selected by default");
});

// --- Diagram provenance -------------------------------------------------

test("the diagram is built from original primitive shapes", () => {
  // Original geometry only -- no traced path data from third-party artwork.
  assert.match(BUILDER_JS, /function muscleDiagramSvg/);
  assert.match(BUILDER_JS, /<svg viewBox="0 0 120 210" role="presentation" focusable="false">/);
  assert.ok(!/<image\b/.test(BUILDER_JS), "no raster anatomy artwork may be embedded");
});

// --- Social -------------------------------------------------------------

test("shared plans show a focus line only when focus is active", () => {
  assert.match(SOCIAL_JS, /function sharedFocusSummary/);
  assert.match(SOCIAL_JS, /if \(!mode \|\| mode === "balanced"\) return "";/);
  assert.match(SOCIAL_JS, /<strong>Focus:<\/strong>/);
  assert.match(SOCIAL_JS, /if \(!names\.length\) return "";/, "an unknown or empty selection must render nothing");
});

// --- Manual builder follow-up documented -------------------------------

test("the manual builder RIR follow-up is documented, not implemented", () => {
  assert.match(MANUAL_JS, /FUTURE \(not in scope here\)/);
  assert.match(MANUAL_JS, /readExercise\(\)/);
  assert.match(MANUAL_JS, /rir:"1-3"/, "the stored literal must remain unchanged in this task");
});

// --- Existing guidance UX must not regress -----------------------------

test("the previous guidance UX is still in place", () => {
  const code = stripComments(BUILDER_JS);
  assert.ok(!code.includes("Program quality score"), "the quality score must stay hidden");
  assert.ok(!code.includes("Minimum effective"));
  for (const kept of [
    "Programming range: ${min}–${max}",
    "Target range: ${min}–${max}",
    "Within target range",
    "Below target range",
    "Above target range",
    "Supporting volume",
    "Target reps",
    "Reps In Reserve",
    "Do not stop solely because you reached the bottom of the rep range"
  ]) {
    assert.ok(BUILDER_JS.includes(kept), `regressed guidance UX: ${kept}`);
  }
  assert.match(BUILDER_JS, /rir-help-trigger/);
  assert.match(BUILDER_JS, /event\.key === "Escape"/);
});
