// Audits the food-image pipeline: the shared map in lib/food-image-map.js
// (the single source of truth the nutrition builder, its reroll-food
// endpoint and lib/meal-catalog.js all resolve through) against the physical
// files in public/images/foods/ AND against every food in the meal catalog.
//
// Exits non-zero for anything that would actually break a food image at
// runtime (missing mapped file, invalid image, case mismatch, broken URL
// shape, or a catalog food that resolves to the placeholder). Orphan files
// and duplicate-target aliases are reported but do not fail the build — an
// unused photo or two keys sharing one photo are not bugs.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FOODS_DIR = path.join(ROOT, "public", "images", "foods");
const { FOOD_IMAGE_MAP, resolveFoodImage } = require("../lib/food-image-map");
const { FOODS, MEALS_PENDING_IMAGE, getMealById, filterMeals } = require("../lib/meal-catalog");

// Catalog foods that are knowingly shipping without a dedicated photo and
// intentionally render the placeholder. Every entry here is a content gap
// awaiting a real image, NOT a routing bug -- keep this list empty when you
// can. Anything that reaches the placeholder and is not listed here fails
// the audit.
const KNOWN_MISSING_FOOD_PHOTOS = new Set(["asparagus"]);

function loadLocalFoodImages() {
  const entries = Object.entries(FOOD_IMAGE_MAP).map(([key, urlPath]) => ({ key, urlPath }));
  if (!entries.length) {
    throw new Error("lib/food-image-map.js exported an empty FOOD_IMAGE_MAP.");
  }
  return entries;
}

// A handful of representative meal/food names the nutrition builder is
// expected to be able to resolve via the AI-selected imageKey (the prompt
// constrains imageKey to exactly one of the localFoodImages keys, so these
// prove the constrained vocabulary covers the meals in
// docs/meal-images-plan.md and lib/meal-catalog.js where present).
const TEST_MEAL_KEYS = [
  "salmon",
  "couscous",
  "zucchini",
  "chicken breast",
  "white rice",
  "broccoli",
  "tofu",
  "greek yogurt",
  "blueberries",
  "eggs",
  "whole wheat bread",
  "lentils",
  "whole wheat wrap",
  "wrap",
  "red lentils"
];

function main() {
  const entries = loadLocalFoodImages();
  const physicalFiles = fs.readdirSync(FOODS_DIR);
  const physicalFileSet = new Set(physicalFiles);
  // Case-insensitive index — Windows dev machines won't catch a case
  // mismatch that Render's case-sensitive Linux filesystem will 404 on.
  const lowerCaseIndex = new Map();
  for (const file of physicalFiles) {
    const lower = file.toLowerCase();
    if (!lowerCaseIndex.has(lower)) lowerCaseIndex.set(lower, []);
    lowerCaseIndex.get(lower).push(file);
  }

  const issues = [];
  const missingMappedFiles = [];
  const caseMismatches = [];
  const invalidFiles = [];
  const brokenUrlShapes = [];
  const duplicateAliases = new Map(); // urlPath -> [keys]

  for (const { key, urlPath } of entries) {
    if (!urlPath.startsWith("/images/foods/")) {
      brokenUrlShapes.push(`${key} -> ${urlPath}`);
      issues.push(`BROKEN_URL_SHAPE ${key} -> ${urlPath} (must start with /images/foods/)`);
      continue;
    }
    const fileName = urlPath.slice("/images/foods/".length);
    if (!duplicateAliases.has(urlPath)) duplicateAliases.set(urlPath, []);
    duplicateAliases.get(urlPath).push(key);

    if (physicalFileSet.has(fileName)) continue;

    const caseMatches = lowerCaseIndex.get(fileName.toLowerCase());
    if (caseMatches && caseMatches.length) {
      caseMismatches.push(`${key}: mapping says "${fileName}", disk has "${caseMatches[0]}"`);
      issues.push(`CASE_MISMATCH ${key}: mapping="${fileName}" disk="${caseMatches[0]}"`);
      continue;
    }

    missingMappedFiles.push(`${key} -> ${fileName}`);
    issues.push(`MISSING_MAPPED_FILE ${key} -> ${fileName}`);
  }

  // Invalid/zero-byte files among every physical food image, not just
  // mapped ones — a corrupt orphan is still worth catching before someone
  // maps a new key to it.
  for (const file of physicalFiles) {
    const fullPath = path.join(FOODS_DIR, file);
    const stat = fs.statSync(fullPath);
    if (stat.size === 0) {
      invalidFiles.push(`${file}: zero-byte file`);
      issues.push(`INVALID_FILE ${file}: zero-byte file`);
      continue;
    }
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(fullPath, "r");
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);
    const ext = path.extname(file).toLowerCase();
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp = buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP";
    if ((ext === ".jpg" || ext === ".jpeg") && !isJpeg) {
      invalidFiles.push(`${file}: extension is .jpg/.jpeg but content is not a JPEG${isWebp ? " (it's WebP)" : isPng ? " (it's PNG)" : ""}`);
      issues.push(`INVALID_FILE ${file}: .jpg extension but non-JPEG content`);
    } else if (ext === ".png" && !isPng) {
      invalidFiles.push(`${file}: extension is .png but content is not a PNG${isWebp ? " (it's WebP)" : isJpeg ? " (it's JPEG)" : ""}`);
      issues.push(`INVALID_FILE ${file}: .png extension but non-PNG content`);
    }
  }

  const mappedFileNames = new Set(
    entries
      .filter((e) => e.urlPath.startsWith("/images/foods/"))
      .map((e) => e.urlPath.slice("/images/foods/".length))
  );
  const orphanFiles = physicalFiles.filter((file) => !mappedFileNames.has(file));

  const aliasesWithDuplicates = [...duplicateAliases.entries()].filter(([, keys]) => keys.length > 1);

  const unresolvedTestMeals = TEST_MEAL_KEYS.filter(
    (name) => !entries.some((e) => e.key === name.toLowerCase().trim())
  );

  // Every food the meal catalog can actually put on a plate must resolve to
  // a real image. This is the check that was missing when cinnamon shipped
  // with a photo on disk but no mapping entry.
  const catalogFallbacks = [];
  const knownMissingStillMissing = [];
  for (const [foodKey, food] of Object.entries(FOODS)) {
    const resolved = food.img ? resolveFoodImage(food.img) : null;
    if (resolved) continue;
    if (KNOWN_MISSING_FOOD_PHOTOS.has(foodKey)) {
      knownMissingStillMissing.push(`${foodKey} (img="${food.img}")`);
      continue;
    }
    catalogFallbacks.push(`${foodKey} (img="${food.img}")`);
    issues.push(`CATALOG_FOOD_FALLBACK ${foodKey} -> img="${food.img}" resolves to the placeholder`);
  }

  // Explicit named regression: the reported release bug.
  const cinnamonUrl = resolveFoodImage("cinnamon");
  const cinnamonVariants = ["cinnamon", "Ground Cinnamon", "cinnamon powder"];
  const cinnamonFailures = cinnamonVariants.filter((v) => !resolveFoodImage(v));
  if (cinnamonFailures.length) {
    issues.push(`CINNAMON_FALLBACK unresolved variants: ${cinnamonFailures.join(", ")}`);
  }

  const summary = {
    totalPhysicalFiles: physicalFiles.length,
    totalMappingEntries: entries.length,
    mappedFilesThatExist: entries.length - missingMappedFiles.length - caseMismatches.length,
    missingMappedFiles: missingMappedFiles.length,
    caseMismatches: caseMismatches.length,
    invalidFiles: invalidFiles.length,
    orphanFiles: orphanFiles.length,
    duplicateAliasGroups: aliasesWithDuplicates.length,
    unresolvedTestMealNames: unresolvedTestMeals.length,
    brokenUrlShapes: brokenUrlShapes.length,
    catalogFoods: Object.keys(FOODS).length,
    catalogFoodsReachingFallback: catalogFallbacks.length,
    knownMissingFoodPhotos: knownMissingStillMissing.length,
    cinnamonResolvesTo: cinnamonUrl || "FALLBACK"
  };

  console.log("Food image coverage audit");
  console.log(JSON.stringify(summary, null, 2));

  if (knownMissingStillMissing.length) {
    console.log("\nKnown missing food photos (needs a real image):");
    knownMissingStillMissing.forEach((f) => console.log(`  - ${f}`));
    console.log("  Meals using them are withheld from public selection:");
    MEALS_PENDING_IMAGE.forEach((id) => {
      const meal = getMealById(id);
      console.log(`    - ${id} (${meal ? meal.en : "unknown"})`);
    });
  }

  // A food without a photo must not be reachable by any publicly selectable
  // meal, or a user still sees the placeholder in a generated plan.
  const selectableIds = new Set(filterMeals({ diet: "omnivore" }).map((m) => m.id));
  const reachableWithoutPhoto = MEALS_PENDING_IMAGE.filter((id) => selectableIds.has(id));
  if (reachableWithoutPhoto.length) {
    reachableWithoutPhoto.forEach((id) =>
      issues.push(`PENDING_IMAGE_MEAL_SELECTABLE ${id} can still be chosen but has an ingredient with no photo`)
    );
  }

  if (catalogFallbacks.length) {
    console.log("\nCatalog foods reaching the placeholder (BLOCKING):");
    catalogFallbacks.forEach((f) => console.log(`  - ${f}`));
  }

  if (orphanFiles.length) {
    console.log("\nOrphan files (on disk, not referenced by any mapping — not a failure):");
    orphanFiles.forEach((f) => console.log(`  - ${f}`));
  }

  if (aliasesWithDuplicates.length) {
    console.log("\nAliases sharing one image (intentional reuse, reported for visibility):");
    aliasesWithDuplicates.forEach(([urlPath, keys]) => console.log(`  - ${urlPath}: ${keys.join(", ")}`));
  }

  if (unresolvedTestMeals.length) {
    console.log("\nTest meal/food names with no direct mapping entry (informational only):");
    unresolvedTestMeals.forEach((name) => console.log(`  - ${name}`));
  }

  if (issues.length) {
    console.log("\nCoverage issues:");
    issues.forEach((issue) => console.log(`- ${issue}`));
    process.exitCode = 1;
  } else {
    console.log("\nNo blocking coverage issues found.");
  }
}

main();
