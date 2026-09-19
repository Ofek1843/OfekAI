const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const dashboard = fs.readFileSync("public/dashboard.html", "utf8");
const script = fs.readFileSync("public/js/dashboard.js", "utf8");
const styles = fs.readFileSync("public/css/dashboard.css", "utf8");

test("check-in lives inside the Today workout card and announces updates accessibly", () => {
  const workoutCard = dashboard.slice(dashboard.indexOf('class="card next-workout-card"'), dashboard.indexOf('class="card nutrition-card"'));
  assert.match(workoutCard, /id="workoutCheckins"[^>]*aria-live="polite"/);
  assert.match(workoutCard, /id="startWorkoutLink"/);
});

test("check-in copy follows the dashboard locale table with English as the fallback", () => {
  assert.match(script, /checkin:\s*CHECKIN_COPY\.he/);
  assert.match(script, /checkin:\s*CHECKIN_COPY\.en/);
  assert.match(script, /const checkinUi = ui\.checkin/);
  assert.match(script, /Did you complete \$\{name\} today\?/);
  assert.match(script, /השלמת את \$\{name\} היום\?/);
});

test("the workout identity remains visible through button-only questions and answers", () => {
  assert.match(script, /<h3>\$\{esc\(checkin\.workoutName/);
  assert.match(script, /<button type="button" class="workout-checkin-button/);
  assert.match(script, /name, workoutCheckinDate\(checkin\.scheduledDate\)/);
  assert.match(script, /focus\(\{ preventScroll: true \}\)/);
});

test("mobile check-in buttons have generous tap targets and reduced-motion support", () => {
  const buttonStart = styles.indexOf(".workout-checkin-button {");
  const buttonRule = styles.slice(buttonStart, styles.indexOf("\n}", buttonStart));
  assert.match(buttonRule, /min-height:\s*44px/);
  const mobileRule = ".workout-checkin-button { width: 100%; min-height: 46px; }";
  const mobileRuleIndex = styles.indexOf(mobileRule);
  assert.notEqual(mobileRuleIndex, -1);
  assert.notEqual(styles.lastIndexOf("@media (max-width: 520px)", mobileRuleIndex), -1);
  const reducedMotionStart = styles.indexOf("@media (prefers-reduced-motion: reduce)", buttonStart);
  assert.match(styles.slice(reducedMotionStart), /\.workout-checkin-card/);
});
