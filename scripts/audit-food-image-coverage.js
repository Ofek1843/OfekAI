// Audits the food-image pipeline: the localFoodImages dictionary in
// server.js (the single source of truth the nutrition builder and its
// reroll-food endpoint both read from) against the physical files in
// public/images/foods/.
//
// Exits non-zero for anything that would actually break a food image at
// runtime (missing mapped file, invalid image, case mismatch, broken URL
// shape). Orphan files and duplicate-target aliases are reported but do
// not fail the build — an unused photo or two keys sharing one photo are
// not bugs.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FOODS_DIR = path.join(ROOT, "public", "images", "foods");
const SERVER_JS = path.join(ROOT, "server.js");

function loadLocalFoodImages() {
  const source = fs.readFileSync(SERVER_JS, "utf8");
  const match = source.match(/const localFoodImages = \{([\s\S]*?)\n\};/);
  if (!match) {
    throw new Error("Could not find `const localFoodImages = { ... };` in server.js");
  }
  const body = match[1];
  const entries = [...body.matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map(([, key, urlPath]) => ({
    key,
    urlPath
  }));
  if (!entries.length) {
    throw new Error("localFoodImages block found but no entries parsed — regex may be stale.");
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
    brokenUrlShapes: brokenUrlShapes.length
  };

  console.log("Food image coverage audit");
  console.log(JSON.stringify(summary, null, 2));

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
