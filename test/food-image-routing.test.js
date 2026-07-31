// Release regression tests for the food-image pipeline.
//
// Reported bug: the user added public/images/foods/cinnamon.jpg but generated
// nutrition plans still rendered the placeholder for cinnamon. Root cause was
// not the file -- lib/meal-catalog.js declares `img: "cinnamon"` for the food,
// but the image map had no "cinnamon" key, so the lookup missed and every meal
// containing cinnamon fell back. The map also lived inline in server.js, so
// nothing could enforce that catalog foods and the map stayed in sync.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const FOODS_DIR = path.join(ROOT, "public", "images", "foods");
const {
  FOOD_IMAGE_MAP,
  FOOD_PLACEHOLDER_IMAGE,
  resolveFoodImage,
  normalizeFoodName
} = require("../lib/food-image-map");
const { FOODS, buildMealOption, CATALOG } = require("../lib/meal-catalog");

// Image URLs are absolute paths served out of public/, so the on-disk
// location is public/ + the URL path.
function physicalPathFor(url) {
  return path.join(ROOT, "public", url.replace(/^\//, "").split("/").join(path.sep));
}

// ---------------------------------------------------------------- cinnamon

test("cinnamon resolves to its real image instead of the placeholder", () => {
  const url = resolveFoodImage("cinnamon");
  assert.equal(url, "/images/foods/cinnamon.jpg");
  assert.notEqual(url, FOOD_PLACEHOLDER_IMAGE);
});

test("cinnamon spelling, casing and qualifier variants all resolve to the same image", () => {
  const variants = [
    "cinnamon",
    "Cinnamon",
    "CINNAMON",
    "  cinnamon  ",
    "cinnamon.",
    "ground cinnamon",
    "Ground Cinnamon",
    "cinnamon powder",
    "cinnamon, ground",
    "1 tsp ground cinnamon"
  ];
  for (const variant of variants) {
    assert.equal(
      resolveFoodImage(variant),
      "/images/foods/cinnamon.jpg",
      `variant "${variant}" must resolve to the cinnamon image`
    );
  }
});

test("the cinnamon image file physically exists and is a real JPEG", () => {
  const file = physicalPathFor(resolveFoodImage("cinnamon"));
  assert.ok(fs.existsSync(file), "cinnamon.jpg must exist on disk");
  const buffer = Buffer.alloc(3);
  const fd = fs.openSync(file, "r");
  fs.readSync(fd, buffer, 0, 3, 0);
  fs.closeSync(fd);
  assert.ok(
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    "cinnamon.jpg must contain real JPEG bytes, not a mislabeled WebP/PNG"
  );
});

test("every catalog meal containing cinnamon renders it with a real image", () => {
  const mealsWithCinnamon = CATALOG.filter(meal =>
    meal.items.some(([key]) => key === "cinnamon")
  );
  assert.ok(mealsWithCinnamon.length > 0, "expected at least one meal to use cinnamon");

  for (const meal of mealsWithCinnamon) {
    const option = buildMealOption(meal.id, { targetCalories: 600 });
    const cinnamonRow = option.foods.find(food => food.imageKey === "cinnamon");
    assert.ok(cinnamonRow, `meal ${meal.id} should expose a cinnamon ingredient row`);
    assert.equal(
      cinnamonRow.imageUrl,
      "/images/foods/cinnamon.jpg",
      `meal ${meal.id} rendered cinnamon with ${cinnamonRow.imageUrl}`
    );
  }
});

// ------------------------------------------------- catalog / map invariant

test("every meal-catalog food resolves to a real image or is an acknowledged gap", () => {
  // asparagus is the one catalog food shipping without a photo; it is
  // tracked in the audit's KNOWN_MISSING_FOOD_PHOTOS allowlist. Any OTHER
  // food reaching the placeholder is a routing bug.
  const acknowledged = new Set(["asparagus"]);
  const fallingBack = [];
  for (const [key, food] of Object.entries(FOODS)) {
    if (!resolveFoodImage(food.img) && !acknowledged.has(key)) {
      fallingBack.push(`${key} (img="${food.img}")`);
    }
  }
  assert.deepEqual(fallingBack, []);
});

test("every mapped food image URL points at a file that exists on disk", () => {
  const missing = [];
  for (const [key, url] of Object.entries(FOOD_IMAGE_MAP)) {
    if (!fs.existsSync(physicalPathFor(url))) missing.push(`${key} -> ${url}`);
  }
  assert.deepEqual(missing, []);
});

test("mapped filenames match disk exactly (case-sensitive, for Linux hosting)", () => {
  const onDisk = new Set(fs.readdirSync(FOODS_DIR));
  const mismatches = [];
  for (const [key, url] of Object.entries(FOOD_IMAGE_MAP)) {
    const fileName = url.slice("/images/foods/".length);
    if (!onDisk.has(fileName)) mismatches.push(`${key} -> ${fileName}`);
  }
  assert.deepEqual(mismatches, []);
});

// --------------------------------------------------------- match precedence

test("a longer, more specific food name never collapses into its generic root", () => {
  // Pairs where the specific food owns its OWN photo. ("chicken" is
  // deliberately aliased to chicken-breast.jpg, so it is excluded here and
  // covered by the duplicate-alias reporting in the audit instead.)
  const pairs = [
    ["whole wheat wrap", "wrap"],
    ["red lentils", "lentils"],
    ["sweet potato", "potato"],
    ["whole wheat bread", "bread"],
    ["whole wheat pasta", "pasta"]
  ];
  for (const [specific, generic] of pairs) {
    const specificUrl = resolveFoodImage(specific);
    const genericUrl = resolveFoodImage(generic);
    assert.ok(specificUrl, `${specific} must resolve`);
    assert.ok(genericUrl, `${generic} must resolve`);
    assert.notEqual(
      specificUrl,
      genericUrl,
      `"${specific}" must not resolve to the same image as "${generic}"`
    );
  }
});

test("compound ingredient text still resolves to the most specific match", () => {
  assert.equal(resolveFoodImage("200g grilled chicken breast"), FOOD_IMAGE_MAP["chicken breast"]);
  assert.equal(resolveFoodImage("1 whole wheat wrap"), FOOD_IMAGE_MAP["whole wheat wrap"]);
});

test("partial word overlap does not produce a false image match", () => {
  // "unicorn" contains "corn", "scorn" contains "corn": substring matching
  // used to hand these the sweetcorn photo.
  for (const input of ["unicorn meat", "scorn", "grapeseed oil", "cornerstone"]) {
    assert.equal(resolveFoodImage(input), null, `"${input}" must not match a food image`);
  }
});

test("empty, blank and non-string food names resolve to null rather than throwing", () => {
  for (const input of ["", "   ", null, undefined, 0]) {
    assert.equal(resolveFoodImage(input), null);
  }
});

test("all map keys are lowercase and trimmed so lookups cannot miss on casing", () => {
  for (const key of Object.keys(FOOD_IMAGE_MAP)) {
    assert.equal(key, key.toLowerCase(), `key "${key}" must be lowercase`);
    assert.equal(key, key.trim(), `key "${key}" must be trimmed`);
    assert.equal(normalizeFoodName(key), key, `key "${key}" must survive normalization unchanged`);
  }
});

// ------------------------------------------------------------ fallback path

test("the placeholder image used for unmapped foods exists on disk", () => {
  assert.ok(
    fs.existsSync(physicalPathFor(FOOD_PLACEHOLDER_IMAGE)),
    "the fallback placeholder must exist so an unmapped food degrades to a real image"
  );
});

test("nutrition-builder renders the resolved imageUrl for each ingredient row", () => {
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "nutrition-builder.js"), "utf8");
  assert.match(source, /food\.imageUrl/, "the ingredient renderer must use food.imageUrl");
});

test("scripts/audit-food-image-coverage.js exits 0 on the shipped assets", () => {
  assert.doesNotThrow(() => {
    execFileSync(process.execPath, [path.join(ROOT, "scripts", "audit-food-image-coverage.js")], {
      cwd: ROOT,
      stdio: "pipe"
    });
  });
});
