// Regression tests for the food-image pipeline: server.js's localFoodImages
// dictionary (read by both POST /api/nutrition-builder and POST
// /api/nutrition-builder/reroll-food via the AI-selected, prompt-constrained
// imageKey field) plus the physical files it points at.
//
// The AI never free-matches a compound meal name against this dictionary —
// the nutrition-builder prompt constrains every food's imageKey to exactly
// one of these keys (see server.js's "For every food item, set imageKey to
// exactly one value from this allowed list" instruction), so the tests
// below cover key lookup, not name-similarity ranking.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const FOODS_DIR = path.join(ROOT, "public", "images", "foods");
const SERVER_JS = path.join(ROOT, "server.js");

function loadLocalFoodImages() {
  const source = fs.readFileSync(SERVER_JS, "utf8");
  const match = source.match(/const localFoodImages = \{([\s\S]*?)\n\};/);
  assert.ok(match, "server.js must define localFoodImages");
  const entries = [...match[1].matchAll(/"([^"]+)":\s*"([^"]+)"/g)];
  const map = new Map(entries.map(([, key, urlPath]) => [key, urlPath]));
  return map;
}

test("tofu resolves to /images/foods/tofu.jpg", () => {
  const map = loadLocalFoodImages();
  assert.equal(map.get("tofu"), "/images/foods/tofu.jpg");
});

test("salmon resolves to /images/foods/salmon.jpg", () => {
  const map = loadLocalFoodImages();
  assert.equal(map.get("salmon"), "/images/foods/salmon.jpg");
});

test("couscous and zucchini (Salmon with Couscous & Zucchini components) resolve predictably", () => {
  const map = loadLocalFoodImages();
  assert.equal(map.get("couscous"), "/images/foods/couscous.jpg");
  assert.equal(map.get("zucchini"), "/images/foods/zucchini.jpg");
  assert.equal(map.get("salmon"), "/images/foods/salmon.jpg");
});

test("longer, more specific keys are distinct entries from their generic root word", () => {
  const map = loadLocalFoodImages();
  // "chicken breast" and "chicken" are separate keys with independent
  // mappings — a specific match is never silently collapsed into the
  // generic one.
  assert.ok(map.has("chicken breast"));
  assert.ok(map.has("chicken"));
  assert.notEqual(map.get("chicken breast"), undefined);
});

test("whole wheat wrap has its own entry distinct from the generic wrap", () => {
  const map = loadLocalFoodImages();
  assert.equal(map.get("whole wheat wrap"), "/images/foods/whole-wheat-wrap.jpg");
  assert.equal(map.get("wrap"), "/images/foods/wrap.jpg");
  assert.notEqual(map.get("whole wheat wrap"), map.get("wrap"));
});

test("red lentils has its own entry distinct from the generic lentils", () => {
  const map = loadLocalFoodImages();
  assert.equal(map.get("red lentils"), "/images/foods/red-lentils.jpg");
  assert.equal(map.get("lentils"), "/images/foods/lentils.jpg");
  assert.notEqual(map.get("red lentils"), map.get("lentils"));
});

test("all dictionary keys are lowercase and trimmed (capitalization/whitespace variants must not silently miss)", () => {
  const map = loadLocalFoodImages();
  for (const key of map.keys()) {
    assert.equal(key, key.toLowerCase(), `key "${key}" is not lowercase`);
    assert.equal(key, key.trim(), `key "${key}" has leading/trailing whitespace`);
  }
});

test("every mapped physical file exists on disk", () => {
  const map = loadLocalFoodImages();
  const missing = [];
  for (const [key, urlPath] of map) {
    const fileName = urlPath.replace("/images/foods/", "");
    if (!fs.existsSync(path.join(FOODS_DIR, fileName))) {
      missing.push(`${key} -> ${fileName}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("no mapped food image is an empty or invalid file", () => {
  const map = loadLocalFoodImages();
  const invalid = [];
  for (const [key, urlPath] of map) {
    const fileName = urlPath.replace("/images/foods/", "");
    const fullPath = path.join(FOODS_DIR, fileName);
    if (!fs.existsSync(fullPath)) continue; // covered by the previous test
    const stat = fs.statSync(fullPath);
    if (stat.size === 0) {
      invalid.push(`${key}: zero-byte file`);
      continue;
    }
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(fullPath, "r");
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);
    const ext = path.extname(fileName).toLowerCase();
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if ((ext === ".jpg" || ext === ".jpeg") && !isJpeg) {
      invalid.push(`${key}: ${fileName} has .jpg/.jpeg extension but is not real JPEG content`);
    } else if (ext === ".png" && !isPng) {
      invalid.push(`${key}: ${fileName} has .png extension but is not real PNG content`);
    }
  }
  assert.deepEqual(invalid, []);
});

test("unknown food falls back to the placeholder, not a broken path", () => {
  const source = fs.readFileSync(SERVER_JS, "utf8");
  assert.match(
    source,
    /localFoodImages\[imageKey\]\s*\|\|\s*"\/images\/food-placeholder\.png"/,
    "food image resolution must fall back to /images/food-placeholder.png when imageKey is unmapped"
  );
  assert.ok(
    fs.existsSync(path.join(ROOT, "public", "images", "food-placeholder.png")),
    "the fallback placeholder image must actually exist on disk"
  );
});

test("scripts/audit-food-image-coverage.js exits 0 (no blocking coverage issues)", () => {
  assert.doesNotThrow(() => {
    execFileSync(process.execPath, [path.join(ROOT, "scripts", "audit-food-image-coverage.js")], {
      cwd: ROOT,
      stdio: "pipe"
    });
  });
});

test("nutrition-builder.js renders food.imageUrl for each food row (frontend displays the resolved image)", () => {
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "nutrition-builder.js"), "utf8");
  assert.match(source, /food\.imageUrl/, "nutrition-builder.js must render food.imageUrl on each food row");
});
