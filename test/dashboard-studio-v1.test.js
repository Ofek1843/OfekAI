const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "public", "dashboard.html"), "utf8");
const JS = fs.readFileSync(path.join(ROOT, "public", "js", "dashboard.js"), "utf8");
const CSS = fs.readFileSync(path.join(ROOT, "public", "css", "dashboard-studio-v1.css"), "utf8");
const SHELL = fs.readFileSync(path.join(ROOT, "public", "js", "redesign-shell.js"), "utf8");

test("dashboard concept is scoped to the dashboard and keeps the two create-plan routes", () => {
  assert.match(HTML, /<body class="dashboard-design-v2">/);
  assert.match(HTML, /dashboard-studio-v1\.css/);
  assert.match(HTML, /id="dashboardCreateWorkoutPlan"[^>]*href="\/workout-builder\.html"[^>]*hidden/);
  assert.match(HTML, /id="dashboardCreateNutritionPlan"[^>]*href="\/nutrition-builder\.html"[^>]*hidden/);
  assert.match(CSS, /\.dashboard-grid\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(CSS, /@media\s*\(max-width:\s*760px\)/);
});

test("missing plans expose an empty-state create action without a dead start action", () => {
  assert.match(JS, /if\s*\(!planDoc\)[\s\S]*?action\.hidden\s*=\s*true[\s\S]*?createPlan\.hidden\s*=\s*false[\s\S]*?ui\.buildWorkout/);
  assert.match(JS, /if\s*\(!saved\)[\s\S]*?action\.hidden\s*=\s*true[\s\S]*?createPlan\.hidden\s*=\s*false[\s\S]*?ui\.buildNutrition/);
});

test("create-plan labels use the dashboard locale and the wordmark is split for the blue brand treatment", () => {
  assert.match(JS, /createPlan\.querySelector\("span:last-child"\)\.textContent\s*=\s*ui\.buildWorkout/);
  assert.match(JS, /createPlan\.querySelector\("span:last-child"\)\.textContent\s*=\s*ui\.buildNutrition/);
  assert.match(SHELL, /brand-fuel/);
  assert.match(SHELL, /brand-physique/);
  assert.match(CSS, /\.brand-fuel\s*\{\s*color:\s*#16181b/);
  assert.match(CSS, /\.brand-physique\s*\{\s*color:\s*#2465b5/);
});

test("workout image is resolved from the existing exercise catalog rather than a placeholder", () => {
  assert.match(JS, /import \{ exerciseImageUrl \} from "\.\/exercise-image\.js"/);
  assert.match(JS, /workoutImage\.src\s*=\s*exerciseImageUrl\(exercises\[0\]\)/);
  assert.match(HTML, /id="dashboardWorkoutImage"[^>]*loading="lazy"[^>]*decoding="async"[^>]*hidden/);
});
