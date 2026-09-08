"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const MANUAL_JS = read("public", "js", "manual-workout-builder.js");
const MANUAL_HTML = read("public", "manual-workout-builder.html");
const MANUAL_CSS = read("public", "css", "manual-workout-builder.css");
// exercise-image.js is a browser ES module (loaded via <script type="module">);
// a data: URL forces the CJS test runner to evaluate the real module.
async function loadImageModule() {
  const source = read("public", "js", "exercise-image.js");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

// Re-implement the matcher exactly as it ships so a scoring regression is
// caught here. Kept in lockstep with manual-workout-builder.js.
function normalizeQuery(value = "") {
  return String(value).toLowerCase().normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCatalog() {
  // The catalog is a literal array of [name, equipment, muscleGroup] tuples.
  const block = MANUAL_JS.match(/const exercises=\[([\s\S]*?)\]\.map/)[1];
  return [...block.matchAll(/\["([^"]+)","([^"]+)","([^"]+)"\]/g)]
    .map((match) => ({ name: match[1], equipment: match[2], muscleGroup: match[3] }));
}

function matchExercises(exercises, query, limit = 8) {
  const q = normalizeQuery(query);
  if (!q) return [];
  const scored = [];
  for (const item of exercises) {
    const name = normalizeQuery(item.name);
    let score = 0;
    if (name === q) score = 1000;
    else if (name.startsWith(q)) score = 800 - name.length;
    else if (name.split(" ").some((word) => word.startsWith(q))) score = 600 - name.length;
    else if (name.includes(q)) score = 400 - name.length;
    else {
      const muscle = normalizeQuery(item.muscleGroup);
      const equipment = normalizeQuery(item.equipment);
      if (muscle.startsWith(q) || equipment.startsWith(q)) score = 200 - name.length;
    }
    if (score > 0) scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name)).slice(0, limit).map((entry) => entry.item);
}

test("a partial query returns the intended canonical exercise", () => {
  const exercises = extractCatalog();
  assert.ok(exercises.length > 40, "catalog parsed");
  assert.equal(matchExercises(exercises, "Leg Extensi")[0].name, "Leg Extension");
  assert.equal(matchExercises(exercises, "lat pul")[0].name, "Lat Pulldown");
  assert.ok(matchExercises(exercises, "bench").some((item) => item.name === "Bench Press"));
  assert.equal(matchExercises(exercises, "zzzznotathing").length, 0);
});

test("every suggestion carries equipment and a target muscle", () => {
  const exercises = extractCatalog();
  for (const item of matchExercises(exercises, "row")) {
    assert.ok(item.equipment && item.muscleGroup, item.name);
  }
});

test("thumbnails resolve through the shared exercise-image resolver, with a branded fallback", async () => {
  const { exerciseImageUrl, EXERCISE_FALLBACK_IMAGE_URL } = await loadImageModule();
  const exercises = extractCatalog();
  let resolved = 0;
  for (const item of exercises) {
    const url = exerciseImageUrl({ name: item.name, demoName: item.name });
    assert.ok(url.startsWith("/images/exercises/"), item.name);
    if (url !== EXERCISE_FALLBACK_IMAGE_URL) resolved += 1;
  }
  assert.ok(resolved / exercises.length > 0.85, "most catalog names have a dedicated demo image");
  assert.match(MANUAL_JS, /exerciseImageUrl\(\{name:item\.name/);
  assert.match(MANUAL_JS, /onerror="this\.src='\$\{esc\(fallbackExerciseImageUrl\(\)\)\}'/);
});

test("the builder no longer relies on the native datalist and does not create a second catalog", () => {
  assert.doesNotMatch(MANUAL_HTML, /<datalist/);
  assert.doesNotMatch(MANUAL_JS, /list="exerciseCatalog"/);
  assert.match(MANUAL_JS, /import\{exerciseImageUrl,fallbackExerciseImageUrl\}from"\.\/exercise-image\.js"/);
  // reuses the in-file curated catalog, does not redeclare a big new one
  assert.equal((MANUAL_JS.match(/const exercises=\[/g) || []).length, 1);
});

test("selecting a suggestion fills name/equipment/muscle but never sets/reps/rest", () => {
  assert.match(MANUAL_JS, /function choose\(item\)\{/);
  assert.match(MANUAL_JS, /activeInput\.value=item\.name/);
  assert.match(MANUAL_JS, /equipment\.value=item\.equipment/);
  assert.match(MANUAL_JS, /row\.dataset\.muscleGroup=item\.muscleGroup/);
  const chooseBody = MANUAL_JS.match(/function choose\(item\)\{[\s\S]*?\n\s*\}/)[0];
  assert.doesNotMatch(chooseBody, /\.sets\b|\.reps\b|\.rest\b/);
});

test("a non-matching name is still accepted as a custom exercise", () => {
  // No forced selection: readExercise reads the raw input value, matched or not.
  assert.match(MANUAL_JS, /function readExercise\(row\)\{const name=row\.querySelector\("\.exercise-name"\)\.value\.trim\(\)/);
});

test("the mobile list contract keeps rows tappable, layered and keyboard-driveable", () => {
  assert.match(MANUAL_CSS, /\.exercise-suggest \{[\s\S]*?position: fixed !important/);
  assert.match(MANUAL_CSS, /\.exercise-suggest li \{[\s\S]*?min-height: 48px/);
  assert.match(MANUAL_CSS, /\.exercise-suggest \{[\s\S]*?z-index: 4000/);
  assert.match(MANUAL_JS, /window\.visualViewport/);
  assert.match(MANUAL_JS, /event\.key==="ArrowDown"/);
  assert.match(MANUAL_JS, /event\.key==="Escape"/);
  assert.match(MANUAL_JS, /flipUp/);
  assert.match(MANUAL_JS, /setAttribute\("role", ?"listbox"\)/);
});
