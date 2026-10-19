// Regression tests for the authoritative food-image pipeline.
//
// lib/food-image-map.js is the single source of truth used by the nutrition
// builder, its reroll-food endpoint and the meal catalog. These tests verify
// the map, the physical assets and the catalog's actual runtime resolution.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const sharp = require("sharp");
const {
  FOOD_IMAGE_MAP,
  FOOD_PLACEHOLDER_IMAGE,
  resolveFoodImage
} = require("../lib/food-image-map");
const { FOODS, CATALOG, buildMealOption } = require("../lib/meal-catalog");

const ROOT = path.join(__dirname, "..");
const FOODS_DIR = path.join(ROOT, "public", "images", "foods");
const PLACEHOLDER = path.join(ROOT, "public", FOOD_PLACEHOLDER_IMAGE.replace(/^\//, ""));

function signature(filePath) {
  const buffer = fs.readFileSync(filePath);
  return {
    png: buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    jpeg: buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    webp: buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  };
}

function mappedFile(urlPath) {
  assert.match(urlPath, /^\/images\/foods\/[a-z0-9-]+\.(?:png|jpe?g|webp)$/);
  return path.join(ROOT, "public", urlPath.replace(/^\//, ""));
}

test("the authoritative resolver maps representative and newly restored foods", () => {
  assert.equal(FOOD_IMAGE_MAP.tofu, "/images/foods/tofu.jpg");
  assert.equal(FOOD_IMAGE_MAP.salmon, "/images/foods/salmon.jpg");
  assert.equal(FOOD_IMAGE_MAP.asparagus, "/images/foods/asparagus.png");
  assert.equal(resolveFoodImage("asparagus"), "/images/foods/asparagus.png");
});

test("specific food keys remain distinct from generic keys", () => {
  // Generic aliases such as `chicken` intentionally reuse the canonical
  // chicken-breast asset. Compare canonical entries whose images must remain
  // distinct instead of treating an intentional alias as a collision.
  assert.notEqual(FOOD_IMAGE_MAP["chicken breast"], FOOD_IMAGE_MAP["chicken thigh"]);
  assert.notEqual(FOOD_IMAGE_MAP["whole wheat wrap"], FOOD_IMAGE_MAP.wrap);
  assert.notEqual(FOOD_IMAGE_MAP["red lentils"], FOOD_IMAGE_MAP.lentils);
});

test("all authoritative resolver keys are lowercase and trimmed", () => {
  for (const key of Object.keys(FOOD_IMAGE_MAP)) {
    assert.equal(key, key.toLowerCase(), `key "${key}" is not lowercase`);
    assert.equal(key, key.trim(), `key "${key}" has surrounding whitespace`);
  }
});

test("every mapped asset exists with a signature matching its extension", () => {
  const missing = [];
  const invalid = [];
  for (const [key, urlPath] of Object.entries(FOOD_IMAGE_MAP)) {
    const filePath = mappedFile(urlPath);
    if (!fs.existsSync(filePath)) {
      missing.push(`${key} -> ${urlPath}`);
      continue;
    }
    const actual = signature(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const valid = ext === ".png" ? actual.png : ext === ".webp" ? actual.webp : actual.jpeg;
    if (!valid) invalid.push(`${key} -> ${urlPath}`);
  }
  assert.deepEqual(missing, []);
  assert.deepEqual(invalid, []);
});

test("PNG resolver assets have a matching valid WebP sibling when present", () => {
  const failures = [];
  for (const [key, urlPath] of Object.entries(FOOD_IMAGE_MAP)) {
    if (!urlPath.endsWith(".png")) continue;
    const webpPath = path.join(FOODS_DIR, `${path.basename(urlPath, ".png")}.webp`);
    if (!fs.existsSync(webpPath) || !signature(webpPath).webp) failures.push(key);
  }
  assert.deepEqual(failures, []);
});

test("every catalog food image key resolves to a real mapped asset", () => {
  const unresolved = Object.entries(FOODS)
    .filter(([, food]) => food.img && !resolveFoodImage(food.img))
    .map(([key, food]) => `${key} -> ${food.img}`);
  assert.deepEqual(unresolved, []);
});

test("catalog meals prefer existing exact WebP plates and expose a truthful fallback for unpictured meals", () => {
  const failures = [];
  for (const meal of CATALOG) {
    const expectedWebp = `/images/meals/${meal.id}.webp`;
    const pngPath = path.join(ROOT, "public", "images", "meals", `${meal.id}.png`);
    const webpPath = path.join(ROOT, "public", "images", "meals", `${meal.id}.webp`);
    if(!fs.existsSync(webpPath) && !fs.existsSync(pngPath)) {
      assert.equal(meal.image,null,`${meal.id} must not invent a missing photo`);
      assert.equal(meal.imageKey,meal.id);
      assert.match(fs.readFileSync(path.join(ROOT,'public/js/nutrition-builder.js'),'utf8'),/meal-photo-fallback/);
      continue;
    }
    if (meal.image !== expectedWebp || meal.imageKey !== meal.id) failures.push(`${meal.id}: catalog path`);
    if (!fs.existsSync(pngPath) || !signature(pngPath).png) failures.push(`${meal.id}: PNG`);
    if (!fs.existsSync(webpPath) || !signature(webpPath).webp) failures.push(`${meal.id}: WebP`);
  }
  assert.deepEqual(failures, []);
});

test("catalog meal photos have enough source detail for the large meal view", async () => {
  const tooSmall = [];
  for (const meal of CATALOG) {
    if (!meal.image) continue;
    const pngPath = path.join(ROOT, "public", "images", "meals", `${meal.id}.png`);
    const webpPath = path.join(ROOT, "public", "images", "meals", `${meal.id}.webp`);
    if (!fs.existsSync(pngPath) || !fs.existsSync(webpPath)) continue; // Missing pairs are reported above.
    const source = fs.readFileSync(pngPath);
    const width = source.readUInt32BE(16);
    const height = source.readUInt32BE(20);
    const displayed = await sharp(webpPath).metadata();
    if (Math.min(width, height) < 500 || Math.min(displayed.width, displayed.height) < 500) {
      tooSmall.push(`${meal.id}: PNG ${width}x${height}, WebP ${displayed.width}x${displayed.height}`);
    }
    if (fs.statSync(webpPath).size < 35 * 1024) tooSmall.push(`${meal.id}: suspiciously small WebP`);
  }
  assert.deepEqual(tooSmall, []);
});

test("legacy meal SVG URLs normalize to reviewed photographic WebP assets", async () => {
  const mealPhoto = await import("../public/js/meal-photo.mjs");
  const mealImageDir = path.join(ROOT, "public", "images", "meals");
  const legacyIllustrations = fs.readdirSync(mealImageDir).filter((name) => name.endsWith(".svg"));
  assert.ok(legacyIllustrations.length > 0, "exercise the legacy illustration migration");

  for (const filename of legacyIllustrations) {
    const id = path.basename(filename, ".svg");
    const photoPath = path.join(mealImageDir, `${id}.webp`);
    assert.ok(fs.existsSync(photoPath), `${id} needs a photographic WebP sibling`);
    const photo = await sharp(photoPath).metadata();
    assert.ok(Math.min(photo.width, photo.height) >= 500, `${id} photo has enough detail`);
    assert.equal(
      mealPhoto.mealPhotoFor({ mealId: id, image: `/images/meals/${filename}` }),
      `/images/meals/${id}.webp?v=20261018-meal-photo-1`,
      `${id} legacy saved plan should display its photo`
    );
  }
});

test("no catalog meal ingredient reaches the unexpected placeholder", () => {
  const fallbackRows = [];
  for (const meal of CATALOG) {
    const option = buildMealOption(meal.id, { targetCalories: meal.baseCalories });
    for (const food of option.foods) {
      if (food.imageUrl === FOOD_PLACEHOLDER_IMAGE) fallbackRows.push(`${meal.id}:${food.catalogKey}`);
    }
  }
  assert.deepEqual(fallbackRows, []);
  assert.ok(fs.existsSync(PLACEHOLDER), "the placeholder remains available for truly unknown foods");
  assert.equal(resolveFoodImage("unknown food that is not mapped"), null);
});

test("the complete food-image audit exits successfully", () => {
  assert.doesNotThrow(() => {
    execFileSync(process.execPath, [path.join(ROOT, "scripts", "audit-food-image-coverage.js")], {
      cwd: ROOT,
      stdio: "pipe"
    });
  });
});

test("nutrition-builder renders the resolver's food image URL", () => {
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "nutrition-builder.js"), "utf8");
  assert.match(source, /food\.imageUrl/);
});
