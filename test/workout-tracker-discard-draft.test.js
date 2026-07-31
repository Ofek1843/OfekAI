// Regression coverage for the "discard workout draft" action.
//
// Previously the only discard control lived inside #finishBar, which stays
// hidden until the user reaches the end of the workout (see the .hidden
// class in workout-tracker.html and openWorkout()'s
// $("#finishBar")?.classList.add("hidden")) -- so a user who tapped "Start
// Workout" and immediately wanted out had no way to discard without either
// completing the workout or navigating away and hoping the draft expired.
//
// This project has no DOM test harness (no jsdom dependency), so -- matching
// the existing pattern in this test suite (see
// workout-mobility-stretch-fallback.test.js, workout-builder-assets.test.js)
// -- these are source-level regression tests: they assert the actual markup
// and control-flow structure of workout-tracker.html/.js/.css, not a
// simulated DOM.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "public", "workout-tracker.html"), "utf8");
const JS = fs.readFileSync(path.join(ROOT, "public", "js", "workout-tracker.js"), "utf8");
const CSS = fs.readFileSync(path.join(ROOT, "public", "css", "workout-tracker.css"), "utf8");

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start !== -1, `expected to find "${startMarker}"`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end !== -1, `expected to find "${endMarker}" after "${startMarker}"`);
  return source.slice(start, end);
}

test("a toolbar discard button exists next to Exit workout, outside the finish bar", () => {
  const toolbar = section(HTML, '<header class="workout-toolbar panel">', "</header>");
  assert.match(toolbar, /id="discardWorkoutToolbarButton"/, "expected the discard button inside the workout toolbar");
  assert.match(toolbar, /id="exitWorkoutLink"|class="exit-workout-link"/, "expected it placed near Exit workout");

  // It must NOT live inside #finishBar, which is hidden until the workout
  // is finished (openWorkout() adds .hidden to #finishBar on start).
  const finishBar = section(HTML, '<div id="finishBar"', '<section id="successPanel"');
  assert.doesNotMatch(finishBar, /discardWorkoutToolbarButton/, "the toolbar discard control must not be the same element hidden inside the finish bar");
  assert.match(finishBar, /id="discardWorkoutButton"/, "the original finish-bar discard button should still exist as a second access point");
});

test("the toolbar discard button is a real always-visible control, not gated behind quick mode or focus panel", () => {
  // openWorkout() shows #workoutPanel (which contains the toolbar) for the
  // entire active workout; the toolbar itself carries no .hidden class and
  // is never toggled by quick-mode state.
  assert.doesNotMatch(HTML, /class="[^"]*hidden[^"]*"[^>]*id="discardWorkoutToolbarButton"/);
  assert.doesNotMatch(HTML, /id="discardWorkoutToolbarButton"[^>]*class="[^"]*hidden/);
});

test("a dedicated confirmation modal exists with semantically distinct Keep/Discard actions", () => {
  const modal = section(HTML, 'id="discardDraftModal"', "</html>");
  assert.match(modal, /id="discardDraftModalTitle"/);
  assert.match(modal, /id="discardDraftModalText"/);
  assert.match(modal, /id="discardDraftKeepButton"/);
  assert.match(modal, /id="discardDraftConfirmButton"/);

  // Keep = safe/non-destructive styling; Discard = danger styling. They must
  // not share the same visual/semantic treatment.
  assert.match(modal, /discardDraftKeepButton"\s+type="button"\s+class="confirm-modal-button confirm-modal-button--agree"/);
  assert.match(modal, /discardDraftConfirmButton"\s+type="button"\s+class="confirm-modal-button confirm-modal-button--danger"/);

  assert.match(CSS, /\.confirm-modal-button--danger\{[^}]*\}/, "expected a distinct danger button style for the destructive action");
});

test("discardDraft() shows the confirmation modal and explains what will be removed before deleting anything", () => {
  assert.match(JS, /async function discardDraft\(\)\s*\{/);

  const body = JS.slice(JS.indexOf("async function discardDraft()"));
  const openCall = body.indexOf("openDiscardDraftModal()");
  const clearCall = body.indexOf("clearDraft()");
  assert.ok(openCall !== -1, "discardDraft must open the confirmation modal");
  assert.ok(clearCall !== -1, "discardDraft must clear the draft");
  assert.ok(openCall < clearCall, "the modal must be awaited BEFORE any state is cleared");
  assert.match(body.slice(0, clearCall), /if \(!confirmed\) return;/, "cancelling the modal must skip all cleanup");
});

test("discardDraft() no longer uses the native confirm() dialog", () => {
  const body = JS.slice(JS.indexOf("async function discardDraft()"), JS.indexOf("async function discardDraft()") + 2000);
  assert.doesNotMatch(body, /\bconfirm\(/, "must use the styled, localized modal instead of window.confirm()");
});

test("discardDraft() clears every piece of active-workout state", () => {
  const start = JS.indexOf("async function discardDraft()");
  const body = JS.slice(start, start + 2500);

  const expectedClears = [
    "clearInterval(workoutTimerId)",
    "clearInterval(focusTimerId)",
    "stopRestTimer()",
    "clearDraft()",
    "localStorage.removeItem(timeBudgetKey())",
    "sessionOverride = null",
    "timeBudgetMinutes = null",
    "focus = { exerciseIndex: 0, setIndex: 0 }",
    '$("#workoutNotes").value = ""',
    '$("#exerciseList").innerHTML = ""'
  ];

  for (const expected of expectedClears) {
    assert.ok(body.includes(expected), `expected discardDraft() to include: ${expected}`);
  }

  assert.match(body, /renderSetup\(\)/, "must return to the session-selection screen after discarding");
});

test("clearDraft() removes the localStorage draft so a page reload cannot restore it", () => {
  assert.match(JS, /function clearDraft\(\)\s*\{\s*if \(user\) localStorage\.removeItem\(draftKey\(\)\);\s*\}/);

  // restoreDraft() must genuinely depend on that same key being present.
  assert.match(JS, /function restoreDraft\(\)[\s\S]*?localStorage\.getItem\(draftKey\(\)\)/);
});

test("discardDraft() guards against double submission and handles failure safely", () => {
  assert.match(JS, /let discardInProgress = false;/);

  const start = JS.indexOf("async function discardDraft()");
  const body = JS.slice(start, start + 2500);

  assert.match(body, /if \(discardInProgress\) return;/, "a second tap while the modal/cleanup is in flight must be a no-op");
  assert.match(body, /discardInProgress = true;/);
  assert.match(body, /try\s*\{/, "cleanup must be wrapped so a failure doesn't leave the UI stuck");
  assert.match(body, /catch\s*\(error\)\s*\{/);
  assert.match(body, /finally\s*\{/, "the busy state must always be released, success or failure");
  assert.match(body, /discardInProgress = false;/);

  // The buttons themselves must be disabled while in flight, not just the
  // internal flag -- otherwise a fast double-tap still fires two handlers.
  assert.match(body, /button\.disabled = true/);
  assert.match(body, /button\.disabled = false/);
});

test("discard button labels are localized for Hebrew and English via the shared localize() map", () => {
  assert.match(JS, /\["discardWorkoutButton",\s*"discardConfirm"\]/);
  assert.match(JS, /\["discardWorkoutToolbarButton",\s*"discardToolbar"\]/);

  // Both language tables must define every key discardDraft()/localize() use.
  for (const key of ["discardToolbar", "discardModalTitle", "discardModalText", "discardKeep", "discardConfirm", "discardBusy", "discardFailed"]) {
    const matches = JS.match(new RegExp(`${key}:\\s*(?:"[^"]*"|\\([^)]*\\)\\s*=>)`, "g")) || [];
    assert.ok(matches.length >= 2, `expected "${key}" to be defined in both the Hebrew and English UI tables, found ${matches.length}`);
  }
});

test("both the toolbar and finish-bar discard buttons are wired to the same discardDraft handler", () => {
  assert.match(JS, /\$\("#discardWorkoutButton"\)\.addEventListener\("click", discardDraft\)/);
  assert.match(JS, /\$\("#discardWorkoutToolbarButton"\)\?\.addEventListener\("click", discardDraft\)/);
});
