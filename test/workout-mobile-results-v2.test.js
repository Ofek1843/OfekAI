"use strict";

// Presentation-only regression coverage for generated workout results.
// Runtime geometry is exercised during the browser acceptance pass; these
// assertions keep the structural contracts behind those measurements from
// silently drifting between visual reviews.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (...segments) => fs.readFileSync(path.join(ROOT, ...segments), "utf8");

const CSS = read("public", "css", "workout-builder.css");
const JS = read("public", "js", "workout-builder.js");
const HTML = read("public", "workout-builder.html");
const FEEDBACK = read("public", "js", "site-feedback.js");

const mobileStart = CSS.indexOf("@media (max-width: 480px)");
const mobileEnd = CSS.indexOf("@media (prefers-reduced-motion: reduce)", mobileStart);
assert.ok(mobileStart >= 0 && mobileEnd > mobileStart, "expected the dedicated phone result breakpoint");
const MOBILE = CSS.slice(mobileStart, mobileEnd);

function rule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing rule for ${selector}`);
  return match[1];
}

test("phone results use one safe-area-aware page gutter", () => {
  const page = rule(MOBILE, ".builder-page");
  assert.match(page, /width:\s*auto/);
  assert.match(page, /margin-inline-start:\s*max\(12px,\s*env\(safe-area-inset-left\)\)/);
  assert.match(page, /margin-inline-end:\s*max\(12px,\s*env\(safe-area-inset-right\)\)/);

  for (const selector of ["#program-result,\n  .program-result", ".program-card", ".workout-day", ".exercise-cards", ".muscle-exercise-group"]) {
    assert.match(rule(MOBILE, selector), /padding:\s*0/, `${selector} must not add another phone gutter`);
  }
  assert.doesNotMatch(MOBILE, /width:\s*100vw/, "nested result elements must not use overflow-prone viewport widths");
});

test("phone exercise cards and media fill their available section width", () => {
  const card = rule(MOBILE, ".exercise-card");
  assert.match(card, /width:\s*100%/);
  assert.match(card, /max-width:\s*100%/);
  assert.match(card, /min-width:\s*0/);
  assert.match(card, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);

  const media = rule(MOBILE, ".exercise-card-media");
  assert.match(media, /width:\s*100%/);
  assert.match(media, /aspect-ratio:\s*16\s*\/\s*11/);
  assert.match(rule(MOBILE, ".exercise-card-image"), /object-fit:\s*contain/);
});

test("phone stat grid is compact, readable and keeps values on one line", () => {
  assert.match(rule(MOBILE, ".exercise-card-stats"), /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(rule(MOBILE, ".exercise-stat"), /min-height:\s*clamp\(88px,\s*25vw,\s*98px\)/);

  const values = rule(MOBILE, ".exercise-stat-value,\n  .exercise-stat--effort .exercise-stat-value");
  assert.match(values, /white-space:\s*nowrap/);
  assert.match(values, /overflow-wrap:\s*normal/);
  assert.match(values, /word-break:\s*normal/);
  assert.match(rule(MOBILE, ".exercise-stat--effort .exercise-stat-label"), /flex-wrap:\s*nowrap/);
});

test("titles retain hierarchy and badges prefer an inline row", () => {
  const title = rule(MOBILE, ".exercise-card-name");
  assert.match(title, /font-size:\s*clamp\(26px,\s*8vw,\s*30px\)/);
  assert.match(title, /text-wrap:\s*balance/);
  assert.match(rule(MOBILE, ".muscle-badge,\n  .equipment-badge"), /white-space:\s*nowrap/);
  assert.match(CSS, /\.exercise-card-badges\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/s);
});

test("persistent RIR education is rendered once per plan, never once per exercise", () => {
  assert.match(JS, /function renderTrainingEffortGuidance\(\)/);
  assert.match(JS, /class="training-effort-panel" aria-labelledby="trainingEffortTitle"/);
  assert.equal((JS.match(/\$\{renderTrainingEffortGuidance\(\)\}/g) || []).length, 1);
  assert.doesNotMatch(JS, /class="exercise-effort-guidance"/);
  assert.match(JS, /rirGuidanceTitle: "Training effort"/);
  assert.match(JS, /Use the prescribed RIR to choose your load/);
  assert.match(JS, /rirGuidanceTitle: "עצימות האימון"/);
});

test("every exercise retains its Effort value and accessible RIR control", () => {
  const cardStart = JS.indexOf('<article class="exercise-card"');
  const cardEnd = JS.indexOf("</article>", cardStart);
  const card = JS.slice(cardStart, cardEnd);
  assert.match(card, /exercise-stat--effort/);
  assert.match(card, /ui\.rirUnit\(String\(exercise\.rir\)\)/);
  assert.match(card, /class="rir-help-trigger"/);
  assert.match(card, /data-rir-help/);
  assert.match(card, /aria-haspopup="dialog"/);
  assert.match(JS, /event\.key === "Escape"/);
});

test("mobile controls remain touch-sized and the feedback control clears safe areas", () => {
  assert.match(rule(MOBILE, ".exercise-demo-button"), /min-height:\s*44px/);
  assert.match(rule(MOBILE, ".reroll-button"), /width:\s*44px[^}]*height:\s*44px/s);
  assert.match(rule(MOBILE, ".training-effort-help"), /width:\s*44px[^}]*height:\s*44px/s);
  assert.match(FEEDBACK, /right:\s*max\(10px,\s*env\(safe-area-inset-right\)\)/);
  assert.match(FEEDBACK, /bottom:\s*calc\(12px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(rule(MOBILE, ".builder-page"), /padding-bottom:\s*calc\(112px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(FEEDBACK, /const collisionTargets = \[/);
  assert.match(FEEDBACK, /"\.exercise-card-stats"/);
  assert.match(FEEDBACK, /"\.exercise-demo-button"/);
  assert.match(FEEDBACK, /"\.reroll-button"/);
  assert.match(FEEDBACK, /"\.rir-help-trigger"/);
  assert.match(FEEDBACK, /\["bottom-end", "bottom-start", "top-end", "top-start"\]/);
  assert.match(FEEDBACK, /rectanglesOverlap\(triggerRect, targetRect\)/);
});

test("desktop card hierarchy remains the established two-column design", () => {
  const baseCard = rule(CSS.slice(0, mobileStart), ".exercise-card");
  assert.match(baseCard, /grid-template-columns:\s*minmax\(330px,\s*0\.9fr\)\s*minmax\(300px,\s*1fr\)/);
  assert.match(rule(CSS.slice(0, mobileStart), ".program-card"), /padding:\s*34px/);
  assert.match(MOBILE, /@media \(max-width: 480px\)/);
  assert.doesNotMatch(CSS, /@media\s*\(min-width:\s*768px\)[\s\S]*?\.exercise-card\s*\{[^}]*grid-template-columns:\s*1fr/);
});

test("Hebrew uses logical layout, readable RIR and the shared RTL direction", () => {
  assert.match(JS, /document\.documentElement\.dir = isHebrew \? "rtl" : "ltr"/);
  assert.match(JS, /rirUnit: \(value\) => `\$\{value\} RIR`/);
  assert.match(JS, /עצימות האימון/);
  assert.match(MOBILE, /margin-inline-start/);
  assert.match(MOBILE, /margin-inline-end/);
  assert.match(CSS, /inset-inline-start/);
  assert.match(CSS, /inset-inline-end/);
});

test("the versioned page loads the mobile result assets", () => {
  assert.match(HTML, /workout-builder\.css\?v=20260807-mobile-v2/);
  assert.match(HTML, /workout-builder\.js\?v=20260807-mobile-v2/);
});
