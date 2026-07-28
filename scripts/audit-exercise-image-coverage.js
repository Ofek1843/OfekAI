"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { EXERCISE_SETCREDITS } = require("../lib/workout-setcredits-map");
const { EXERCISE_NAME_ALIASES } = require("../lib/workout-exercise-aliases");
const { resolveExerciseId } = require("../lib/workout-repair");
const { slugifyExerciseId } = require("../lib/workout-volume");
const {
  MISSING_DEDICATED_IMAGE_EXERCISES,
  getPublicExerciseImageMap,
  isPublicExerciseEnabled
} = require("../lib/workout-exercise-catalog");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const EXERCISE_DIR = path.join(PUBLIC, "images", "exercises");
const FALLBACK_FILE = "fuelphysique-demo-fallback.svg";
const JSON_REPORT = path.join(ROOT, "outputs", "exercise-image-coverage.json");
const MARKDOWN_REPORT = path.join(ROOT, "docs", "exercise-image-coverage-report.md");

const KNOWN_GENERATED_EXERCISE_VARIANTS = [
  { name: "Bulgarian Split Squat", demoName: "Bulgarian Split Squat", equipment: "Dumbbell", muscleGroup: "Quads", expectedCanonical: "bulgarian-split-squat", dedicatedExactImage: true },
  { name: "Incline Dumbbell Press", demoName: "Incline Dumbbell Press", equipment: "Dumbbell", muscleGroup: "Chest", expectedCanonical: "incline-dumbbell-bench-press", dedicatedExactImage: true },
  { name: "Incline Dumbbell Chest Press", demoName: "Incline Dumbbell Chest Press", equipment: "Dumbbell", muscleGroup: "Chest", expectedCanonical: "incline-dumbbell-bench-press", dedicatedExactImage: true },
  { name: "Seated Leg Curl", demoName: "Seated Leg Curl", equipment: "Machine", muscleGroup: "Hamstrings", expectedCanonical: "seated-leg-curl", dedicatedExactImage: true },
  { name: "Ab Crunch Machine", demoName: "Ab Crunch Machine", equipment: "Machine", muscleGroup: "Core", expectedCanonical: "crunch", dedicatedExactImage: true },
  { name: "Reverse Pec Deck", demoName: "Reverse Pec Deck", equipment: "Machine", muscleGroup: "Rear Delts", expectedCanonical: "reverse-pec-deck", dedicatedExactImage: true },
  { name: "Reverse Machine Fly", demoName: "Reverse Machine Fly", equipment: "Machine", muscleGroup: "Rear Delts", expectedCanonical: "reverse-pec-deck", dedicatedExactImage: true },
  { name: "Adduction Machine", demoName: "Adduction Machine", equipment: "Machine", muscleGroup: "Adductors", expectedCanonical: "adductors", dedicatedExactImage: true },
  { name: "Abduction Machine", demoName: "Abduction Machine", equipment: "Machine", muscleGroup: "Abductors", expectedCanonical: "abductors", dedicatedExactImage: true },
  { name: "Triceps Dip", demoName: "Triceps Dip", equipment: "Parallel Bars", muscleGroup: "Triceps", expectedCanonical: "tricep-dip", dedicatedExactImage: true },
  { name: "Dumbbell Hammer Curl", demoName: "Dumbbell Hammer Curl", equipment: "Dumbbell", muscleGroup: "Biceps", expectedCanonical: "hammer-curl", dedicatedExactImage: true },
  { name: "Hammer Curls", demoName: "Hammer Curls", equipment: "Dumbbell", muscleGroup: "Biceps", expectedCanonical: "hammer-curl", dedicatedExactImage: true },
  { name: "Cable Triceps Pushdown", demoName: "Cable Triceps Pushdown", equipment: "Cable", muscleGroup: "Triceps", expectedCanonical: "cable-tricep-pushdown", dedicatedExactImage: true },
  { name: "Cable Face Pull", demoName: "Cable Face Pull", equipment: "Cable", muscleGroup: "Rear Delts", expectedCanonical: "face-pull", dedicatedExactImage: true }
];

const MUSCLE_BY_SLUG = {
  "ab-wheel-rollout": "core",
  abductors: "glutes",
  adductors: "glutes",
  "archer-push-up": "chest",
  "arnold-press": "shoulders",
  "australian-row": "back",
  "barbell-bicep-curl": "arms",
  "barbell-front-squat": "quadriceps",
  "barbell-hip-thrust": "glutes",
  "barbell-row": "back",
  "barbell-shoulder-press": "shoulders",
  "barbell-shrug": "shoulders",
  "barbell-squat": "quadriceps",
  "barbell-upright-row": "shoulders",
  "bench-press": "chest",
  "bulgarian-split-squat": "quadriceps",
  "cable-bicep-curl": "arms",
  "cable-crossover": "chest",
  "cable-crunch": "core",
  crunch: "core",
  "cable-lateral-raise": "shoulders",
  "cable-tricep-pushdown": "arms",
  "cable-woodchopper": "core",
  "chin-up": "back",
  "close-grip-bench-press": "arms",
  "close-grip-lat-pulldown": "back",
  "concentration-curl": "arms",
  "diamond-push-up": "chest",
  dip: "chest",
  "dumbbell-bench-press": "chest",
  "dumbbell-bicep-curl": "arms",
  "dumbbell-calf-raise": "calves",
  "dumbbell-fly": "chest",
  "dumbbell-front-raise": "shoulders",
  "dumbbell-goblet-squat": "quadriceps",
  "dumbbell-hip-thrust": "glutes",
  "dumbbell-lateral-raise": "shoulders",
  "dumbbell-reverse-fly": "shoulders",
  "dumbbell-row": "back",
  "dumbbell-shoulder-press": "shoulders",
  "dumbbell-shrug": "shoulders",
  "dumbbell-walking-lunge": "quadriceps",
  "face-pull": "shoulders",
  "good-morning": "hamstrings",
  "hack-squat": "quadriceps",
  "hammer-curl": "arms",
  handstand: "calisthenics",
  "handstand-push-up": "calisthenics",
  "hanging-leg-raise": "core",
  "incline-bench-press": "chest",
  "incline-dumbbell-bench-press": "chest",
  "incline-dumbbell-curl": "arms",
  "kettlebell-swing": "glutes",
  "lat-pulldown": "back",
  "leg-extension": "quadriceps",
  "leg-press": "quadriceps",
  "l-sit": "core",
  "lying-leg-curl": "hamstrings",
  "machine-chest-fly": "chest",
  "machine-chest-press": "chest",
  "machine-shoulder-press": "shoulders",
  "muscle-up": "calisthenics",
  "neutral-grip-pull-up": "back",
  "one-arm-pull-up": "calisthenics",
  "overhead-tricep-extension": "arms",
  "pike-push-up": "shoulders",
  "pistol-squat": "quadriceps",
  plank: "core",
  "preacher-curl": "arms",
  "pull-up": "back",
  "push-up": "chest",
  "rack-pull": "back",
  "reverse-pec-deck": "shoulders",
  "reverse-lunge": "quadriceps",
  "romanian-deadlift": "hamstrings",
  "russian-twist": "core",
  "seated-cable-row": "back",
  "seated-calf-raise": "calves",
  "seated-leg-curl": "hamstrings",
  "side-plank": "core",
  "skull-crusher": "arms",
  "standing-calf-raise": "calves",
  "step-up": "quadriceps",
  "sumo-deadlift": "hamstrings",
  "t-bar-row": "back",
  "tricep-dip": "arms",
  "typewriter-pull-ups": "calisthenics",
  "wide-grip-push-up": "chest"
};

const EQUIPMENT_BY_SLUG = {
  "ab-wheel-rollout": "ab wheel/bodyweight",
  abductors: "machine",
  adductors: "machine",
  "archer-push-up": "bodyweight",
  "arnold-press": "dumbbells",
  "australian-row": "bar/rings",
  "barbell-bicep-curl": "barbell",
  "barbell-front-squat": "barbell",
  "barbell-hip-thrust": "barbell",
  "barbell-row": "barbell",
  "barbell-shoulder-press": "barbell",
  "barbell-shrug": "barbell",
  "barbell-squat": "barbell",
  "barbell-upright-row": "barbell",
  "bench-press": "barbell",
  "bulgarian-split-squat": "bodyweight/dumbbells",
  "cable-bicep-curl": "cable",
  "cable-crossover": "cable",
  "cable-crunch": "cable",
  crunch: "machine",
  "cable-lateral-raise": "cable",
  "cable-tricep-pushdown": "cable",
  "cable-woodchopper": "cable",
  "chin-up": "pull-up bar",
  "close-grip-bench-press": "barbell",
  "close-grip-lat-pulldown": "machine/cable",
  "concentration-curl": "dumbbell",
  "diamond-push-up": "bodyweight",
  dip: "parallel bars",
  "dumbbell-bench-press": "dumbbells",
  "dumbbell-bicep-curl": "dumbbells",
  "dumbbell-calf-raise": "dumbbells",
  "dumbbell-fly": "dumbbells",
  "dumbbell-front-raise": "dumbbells",
  "dumbbell-goblet-squat": "dumbbell",
  "dumbbell-hip-thrust": "dumbbell",
  "dumbbell-lateral-raise": "dumbbells",
  "dumbbell-reverse-fly": "dumbbells",
  "dumbbell-row": "dumbbell",
  "dumbbell-shoulder-press": "dumbbells",
  "dumbbell-shrug": "dumbbells",
  "dumbbell-walking-lunge": "dumbbells",
  "face-pull": "cable/band",
  "good-morning": "barbell",
  "hack-squat": "machine",
  "hammer-curl": "dumbbells",
  handstand: "bodyweight",
  "handstand-push-up": "bodyweight",
  "hanging-leg-raise": "pull-up bar",
  "incline-bench-press": "barbell",
  "incline-dumbbell-bench-press": "dumbbells",
  "incline-dumbbell-curl": "dumbbells",
  "kettlebell-swing": "kettlebell",
  "lat-pulldown": "machine/cable",
  "leg-extension": "machine",
  "leg-press": "machine",
  "l-sit": "bodyweight",
  "lying-leg-curl": "machine",
  "machine-chest-fly": "machine",
  "machine-chest-press": "machine",
  "machine-shoulder-press": "machine",
  "muscle-up": "pull-up bar/rings",
  "neutral-grip-pull-up": "pull-up bar",
  "one-arm-pull-up": "pull-up bar",
  "overhead-tricep-extension": "dumbbell/cable",
  "pike-push-up": "bodyweight",
  "pistol-squat": "bodyweight",
  plank: "bodyweight",
  "preacher-curl": "bench/barbell",
  "pull-up": "pull-up bar",
  "push-up": "bodyweight",
  "rack-pull": "barbell",
  "reverse-pec-deck": "machine",
  "reverse-lunge": "bodyweight/dumbbells",
  "romanian-deadlift": "barbell/dumbbells",
  "russian-twist": "bodyweight/weight",
  "seated-cable-row": "cable",
  "seated-calf-raise": "machine",
  "seated-leg-curl": "machine",
  "side-plank": "bodyweight",
  "skull-crusher": "barbell/dumbbells",
  "standing-calf-raise": "machine/bodyweight",
  "step-up": "bodyweight/dumbbells",
  "sumo-deadlift": "barbell",
  "t-bar-row": "machine/barbell",
  "tricep-dip": "bodyweight",
  "typewriter-pull-ups": "pull-up bar",
  "wide-grip-push-up": "bodyweight"
};

function slugToTitle(slug) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .replace(/\bL Sit\b/, "L-sit");
}

function gitStatusByPath() {
  const lines = execFileSync("git", ["status", "--short", "--", "public/images/exercises"], {
    cwd: ROOT,
    encoding: "utf8"
  })
    .split(/\r?\n/)
    .filter(Boolean);
  const status = new Map();
  for (const line of lines) {
    const code = line.slice(0, 2);
    const file = line.slice(3).trim().replace(/\\/g, "/").split("/").pop();
    status.set(file, code.trim() || "tracked");
  }
  return status;
}

function loadResolver() {
  const source = fs
    .readFileSync(path.join(PUBLIC, "js", "exercise-image.js"), "utf8")
    .replace(/\bexport\s+(?=(?:const|function)\b)/g, "");
  const sandbox = {
    console: { warn() {} },
    window: undefined,
    moduleExports: {}
  };
  vm.runInNewContext(
    `${source}
    moduleExports.KNOWN_EXERCISE_IMAGE_SLUGS = KNOWN_EXERCISE_IMAGE_SLUGS;
    moduleExports.ALIASES = ALIASES;
    moduleExports.exerciseImageUrl = exerciseImageUrl;
    moduleExports.exerciseImageResolutionDetails = exerciseImageResolutionDetails;
    moduleExports.exerciseImageSlug = exerciseImageSlug;
    moduleExports.hasExerciseImageSlug = hasExerciseImageSlug;
    moduleExports.fallbackExerciseImageUrl = fallbackExerciseImageUrl;`,
    sandbox
  );
  return sandbox.moduleExports;
}

function isKebabLowercasePng(file) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*\.png$/.test(file) || file === FALLBACK_FILE;
}

function imageValidity(filePath, file) {
  const size = fs.statSync(filePath).size;
  if (size === 0) return { valid: false, reason: "zero-byte" };
  const bytes = fs.readFileSync(filePath);
  if (file.endsWith(".png")) {
    const png = bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
    return { valid: png, reason: png ? "" : "invalid-png-signature" };
  }
  if (file.endsWith(".svg")) {
    const text = bytes.toString("utf8", 0, Math.min(bytes.length, 200)).toLowerCase();
    const svg = text.includes("<svg");
    return { valid: svg, reason: svg ? "" : "invalid-svg" };
  }
  return { valid: false, reason: "unsupported-extension" };
}

function buildGeneratorVariantInventory() {
  const byKey = new Map();
  const add = (variant, source) => {
    const name = String(variant.name || "").trim();
    if (!name) return;
    const key = `${name.toLowerCase()}|${variant.demoName || ""}|${variant.equipment || ""}`;
    if (!byKey.has(key)) {
      byKey.set(key, { ...variant, sources: [source] });
    } else {
      byKey.get(key).sources.push(source);
    }
  };

  for (const variant of KNOWN_GENERATED_EXERCISE_VARIANTS) {
    add(variant, "observed-fixture");
  }

  for (const exerciseId of Object.keys(EXERCISE_SETCREDITS)) {
    add(
      {
        name: slugToTitle(exerciseId),
        demoName: slugToTitle(exerciseId),
        exerciseId,
        equipment: EQUIPMENT_BY_SLUG[exerciseId] || "",
        muscleGroup: MUSCLE_BY_SLUG[exerciseId] || "",
        expectedCanonical: EXERCISE_NAME_ALIASES[exerciseId] || exerciseId,
        dedicatedExactImage: true
      },
      "setcredits"
    );
  }

  for (const [aliasSlug, canonical] of Object.entries(EXERCISE_NAME_ALIASES)) {
    if (!isPublicExerciseEnabled(canonical)) continue;
    add(
      {
        name: slugToTitle(aliasSlug),
        demoName: slugToTitle(aliasSlug),
        exerciseId: aliasSlug,
        equipment: EQUIPMENT_BY_SLUG[canonical] || "",
        muscleGroup: MUSCLE_BY_SLUG[canonical] || "",
        expectedCanonical: canonical,
        dedicatedExactImage: false
      },
      "backend-alias"
    );
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function buildAudit() {
  const resolver = loadResolver();
  const knownSlugs = [...resolver.KNOWN_EXERCISE_IMAGE_SLUGS].sort();
  const aliases = resolver.ALIASES;
  const files = fs.readdirSync(EXERCISE_DIR).sort();
  const statusMap = gitStatusByPath();
  const fileSet = new Set(files);
  const fallbackUrl = resolver.fallbackExerciseImageUrl();

  const aliasesByTarget = {};
  for (const [alias, target] of Object.entries(aliases)) {
    if (!aliasesByTarget[target]) aliasesByTarget[target] = [];
    aliasesByTarget[target].push(alias);
  }
  for (const list of Object.values(aliasesByTarget)) list.sort();

  const canonicalCatalog = knownSlugs.map((slug) => {
    const url = resolver.exerciseImageUrl({ exerciseId: slug });
    const file = `${slug}.png`;
    const physicalExists = fileSet.has(file);
    const validity = physicalExists ? imageValidity(path.join(EXERCISE_DIR, file), file) : { valid: false, reason: "missing-file" };
    const dedicated = url !== fallbackUrl && physicalExists && validity.valid;
    return {
      canonicalExerciseId: slug,
      englishName: slugToTitle(slug),
      muscleGroup: MUSCLE_BY_SLUG[slug] || "unknown",
      equipment: EQUIPMENT_BY_SLUG[slug] || "unknown",
      expectedSlug: slug,
      resolvedImageUrl: url,
      physicalFile: physicalExists ? file : null,
      dedicatedImage: dedicated,
      classification: dedicated ? "COVERED" : physicalExists ? "INVALID_FILE" : "MISSING_IMAGE",
      aliases: aliasesByTarget[slug] || []
    };
  });

  const setCreditAliases = Object.keys(EXERCISE_SETCREDITS)
    .filter((id) => !knownSlugs.includes(id))
    .map((id) => {
      const targetSlug = resolver.exerciseImageSlug(id);
      const url = resolver.exerciseImageUrl({ exerciseId: id });
      return {
        aliasExerciseId: id,
        resolvedSlug: targetSlug,
        resolvedImageUrl: url,
        classification: url === fallbackUrl ? "FALLBACK_ONLY" : "ALIAS_COVERED"
      };
    })
    .sort((a, b) => a.aliasExerciseId.localeCompare(b.aliasExerciseId));

  const generatorVariantInventory = buildGeneratorVariantInventory();
  const generatorToImageCoverage = generatorVariantInventory.map((variant) => {
    const exercise = {
      name: variant.name,
      demoName: variant.demoName,
      exerciseId: variant.exerciseId || "",
      equipment: variant.equipment,
      muscleGroup: variant.muscleGroup
    };
    const resolved = resolveExerciseId(exercise);
    const canonicalExerciseId = resolved.id;
    const details = resolver.exerciseImageResolutionDetails({
      ...exercise,
      exerciseId: canonicalExerciseId
    });
    const directSlug = slugifyExerciseId(variant.demoName || variant.name);
    const directPhysicalFile = directSlug ? `${directSlug}.png` : "";
    const directPhysicalExists = Boolean(directPhysicalFile && fileSet.has(directPhysicalFile));
    const canonicalFile = details.usedFallback ? "" : path.basename(details.imageUrl);
    const exactDedicatedFile = directPhysicalExists && canonicalFile === directPhysicalFile;
    const usesSurrogateImage =
      !details.usedFallback &&
      !variant.dedicatedExactImage &&
      (!directPhysicalExists || canonicalFile !== directPhysicalFile);
    const expectedMatches = !variant.expectedCanonical || variant.expectedCanonical === canonicalExerciseId;

    return {
      originalName: variant.name,
      demoName: variant.demoName || "",
      providedExerciseId: variant.exerciseId || "",
      equipment: variant.equipment || "",
      muscleGroup: variant.muscleGroup || "",
      sources: [...new Set(variant.sources)].sort(),
      expectedCanonical: variant.expectedCanonical || "",
      canonicalExerciseId,
      canonicalizationSource: resolved.source,
      expectedCanonicalMatches: expectedMatches,
      resolverSourceField: details.sourceField,
      attemptedSlug: details.attemptedSlug,
      resolvedImageUrl: details.imageUrl,
      usedFallback: details.usedFallback,
      fallbackReason: details.fallbackReason,
      directPhysicalFile: directPhysicalExists ? directPhysicalFile : "",
      directPhysicalExists,
      exactDedicatedFile,
      usesSurrogateImage,
      dedicatedExactImageExpected: Boolean(variant.dedicatedExactImage),
      classification: details.usedFallback
        ? directPhysicalExists
          ? "BROKEN_ROUTING_EXISTING_FILE"
          : "GENUINELY_MISSING_IMAGE"
        : usesSurrogateImage
          ? "COVERED_BY_SURROGATE_IMAGE"
          : "GENERATOR_COVERED"
    };
  });

  const knownFileSet = new Set(knownSlugs.map((slug) => `${slug}.png`));
  const physicalInventory = files.map((file) => {
    const filePath = path.join(EXERCISE_DIR, file);
    const stat = fs.statSync(filePath);
    const slug = file.replace(/\.[^.]+$/, "");
    const isFallback = file === FALLBACK_FILE;
    const representedByResolver = isFallback || knownFileSet.has(file);
    const canonicalExercise = isFallback ? null : knownSlugs.includes(slug) ? slug : null;
    const validity = imageValidity(filePath, file);
    let classification = representedByResolver ? "COVERED" : "ORPHAN_FILE";
    if (!validity.valid) classification = "INVALID_FILE";
    if (!isKebabLowercasePng(file)) classification = "BROKEN_MAPPING";
    return {
      filename: file,
      extension: path.extname(file),
      exactCase: file,
      size: stat.size,
      gitStatus: statusMap.get(file) || "tracked",
      referencedByResolver: representedByResolver,
      canonicalExercise,
      aliases: canonicalExercise ? aliasesByTarget[canonicalExercise] || [] : [],
      genericFallback: isFallback,
      validImage: validity.valid,
      invalidReason: validity.reason,
      classification
    };
  });

  const physicalLower = new Map();
  const caseMismatches = [];
  for (const file of files) {
    const lower = file.toLowerCase();
    if (physicalLower.has(lower) && physicalLower.get(lower) !== file) {
      caseMismatches.push([physicalLower.get(lower), file]);
    }
    physicalLower.set(lower, file);
  }

  const brokenMappings = knownSlugs
    .map((slug) => `${slug}.png`)
    .filter((file) => !fileSet.has(file));
  const orphanFiles = physicalInventory.filter((item) => item.classification === "ORPHAN_FILE");
  const invalidFiles = physicalInventory.filter((item) => item.classification === "INVALID_FILE");
  const badNames = physicalInventory.filter((item) => item.classification === "BROKEN_MAPPING");
  const missingCanonical = canonicalCatalog.filter((item) => item.classification !== "COVERED");
  const fallbackOnlyAliases = setCreditAliases.filter((item) => item.classification === "FALLBACK_ONLY");
  const generatorFallbacks = generatorToImageCoverage.filter((item) => item.usedFallback);
  const generatorBrokenRouting = generatorToImageCoverage.filter((item) => item.classification === "BROKEN_ROUTING_EXISTING_FILE");
  const generatorGenuinelyMissing = generatorToImageCoverage.filter((item) => item.classification === "GENUINELY_MISSING_IMAGE");
  const generatorSurrogateImages = generatorToImageCoverage.filter((item) => item.classification === "COVERED_BY_SURROGATE_IMAGE");
  const generatorCanonicalMismatches = generatorToImageCoverage.filter((item) => !item.expectedCanonicalMatches);
  const publicImageMap = getPublicExerciseImageMap();
  const publicReleaseCoverage = Object.entries(publicImageMap)
    .map(([exerciseId, imageFile]) => {
      const details = resolver.exerciseImageResolutionDetails({ exerciseId });
      const actualFile = details.usedFallback ? "" : path.basename(details.imageUrl);
      const physicalExists = fileSet.has(imageFile);
      const httpOk = physicalExists;
      const exactFileMatch = actualFile === imageFile;
      return {
        exerciseId,
        expectedImageFile: imageFile,
        resolvedImageUrl: details.imageUrl,
        resolvedImageFile: actualFile,
        usedFallback: details.usedFallback,
        physicalExists,
        httpOk,
        exactFileMatch,
        classification:
          !physicalExists ? "MISSING_FILE" :
          details.usedFallback ? "FALLBACK" :
          !exactFileMatch ? "SURROGATE_OR_MISMATCH" :
          "PUBLIC_READY"
      };
    })
    .sort((a, b) => a.exerciseId.localeCompare(b.exerciseId));
  const publicReleaseFailures = publicReleaseCoverage.filter((item) => item.classification !== "PUBLIC_READY");

  const issues = [
    ...missingCanonical.map((item) => `MISSING_IMAGE ${item.canonicalExerciseId}`),
    ...brokenMappings.map((file) => `BROKEN_MAPPING ${file}`),
    ...orphanFiles.map((item) => `ORPHAN_FILE ${item.filename}`),
    ...invalidFiles.map((item) => `INVALID_FILE ${item.filename}: ${item.invalidReason}`),
    ...badNames.map((item) => `BROKEN_FILENAME ${item.filename}`),
    ...caseMismatches.map((pair) => `CASE_MISMATCH ${pair.join(" vs ")}`),
    ...fallbackOnlyAliases.map((item) => `FALLBACK_ONLY ${item.aliasExerciseId}`),
    ...generatorFallbacks.map((item) => `GENERATOR_FALLBACK ${item.originalName} -> ${item.attemptedSlug || "(empty)"}`),
    ...generatorCanonicalMismatches.map((item) => `GENERATOR_CANONICAL_MISMATCH ${item.originalName}: expected ${item.expectedCanonical}, got ${item.canonicalExerciseId}`),
    ...publicReleaseFailures.map((item) => `PUBLIC_RELEASE_IMAGE_FAILURE ${item.exerciseId}: ${item.classification}`)
  ];

  const totals = {
    physicalFiles: physicalInventory.length,
    dedicatedExerciseImagesExcludingFallback: physicalInventory.filter((item) => !item.genericFallback && item.referencedByResolver).length,
    canonicalSupportedExercises: canonicalCatalog.length,
    canonicalExercisesWithDedicatedImages: canonicalCatalog.filter((item) => item.classification === "COVERED").length,
    canonicalExercisesMissingImages: missingCanonical.length,
    aliasesCovered: Object.keys(aliases).length + setCreditAliases.filter((item) => item.classification === "ALIAS_COVERED").length,
    orphanFiles: orphanFiles.length,
    brokenMappings: brokenMappings.length,
    invalidFiles: invalidFiles.length,
    caseMismatches: caseMismatches.length,
    fallbackOnlyAliases: fallbackOnlyAliases.length,
    generatorSupportedCanonicalExercises: new Set(generatorToImageCoverage.map((item) => item.canonicalExerciseId).filter(Boolean)).size,
    generatorKnownNameVariants: generatorToImageCoverage.length,
    generatorVariantsWithDedicatedOrSurrogateImage: generatorToImageCoverage.filter((item) => !item.usedFallback).length,
    generatorVariantsReachingFallback: generatorFallbacks.length,
    generatorExistingFilesWithBrokenRouting: generatorBrokenRouting.length,
    generatorGenuinelyMissingImages: generatorGenuinelyMissing.length,
    generatorSurrogateImageRoutes: generatorSurrogateImages.length,
    generatorCanonicalMismatches: generatorCanonicalMismatches.length,
    publicEnabledExercises: publicReleaseCoverage.length,
    publicReleaseImageFailures: publicReleaseFailures.length,
    disabledUntilDedicatedImages: MISSING_DEDICATED_IMAGE_EXERCISES.length
  };

  return {
    generatedAt: new Date().toISOString(),
    fallbackImage: `/images/exercises/${FALLBACK_FILE}`,
    note: "The workout model may still produce arbitrary free-text exercise names. This audit covers the canonical resolver inventory plus set-credit aliases; unsupported free text intentionally falls back to the branded image.",
    totals,
    canonicalCatalog,
    generatorToImageCoverage,
    generatorFallbacks,
    generatorBrokenRouting,
    generatorGenuinelyMissing,
    generatorSurrogateImages,
    generatorCanonicalMismatches,
    publicReleaseCoverage,
    publicReleaseFailures,
    disabledUntilDedicatedImages: MISSING_DEDICATED_IMAGE_EXERCISES,
    setCreditAliases,
    physicalInventory,
    orphanFiles,
    invalidFiles,
    badNames,
    brokenMappings,
    caseMismatches,
    fallbackOnlyAliases,
    missingCanonical,
    issues
  };
}

function markdownTable(headers, rows) {
  const safeRows = rows.length ? rows : [["None"]];
  if (!rows.length) headers = ["Item"];
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...safeRows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "\\|")).join(" | ")} |`)
  ].join("\n");
}

function writeMarkdown(report) {
  const missingRows = [...report.missingCanonical]
    .sort((a, b) => a.muscleGroup.localeCompare(b.muscleGroup) || a.englishName.localeCompare(b.englishName))
    .map((item) => [
      item.canonicalExerciseId,
      item.englishName,
      `${item.expectedSlug}.png`,
      item.muscleGroup,
      item.equipment,
      item.classification
    ]);

  const canonicalRows = report.canonicalCatalog.map((item) => [
    item.canonicalExerciseId,
    item.englishName,
    item.resolvedImageUrl,
    item.physicalFile,
    item.classification,
    item.aliases.join(", ")
  ]);

  const imageRows = report.physicalInventory.map((item) => [
    item.filename,
    item.size,
    item.gitStatus,
    item.canonicalExercise || "",
    item.referencedByResolver ? "yes" : "no",
    item.classification
  ]);

  const generatorRows = report.generatorToImageCoverage.map((item) => [
    item.originalName,
    item.demoName,
    item.providedExerciseId,
    item.canonicalExerciseId,
    item.resolvedImageUrl,
    item.classification,
    item.sources.join(", ")
  ]);

  const generatorMissingRows = report.generatorFallbacks.map((item) => [
    item.originalName,
    item.demoName,
    item.providedExerciseId,
    item.attemptedSlug,
    item.fallbackReason,
    item.directPhysicalFile || "none"
  ]);

  const surrogateRows = report.generatorSurrogateImages.map((item) => [
    item.originalName,
    item.canonicalExerciseId,
    item.resolvedImageUrl,
    item.directPhysicalFile || "no exact dedicated file"
  ]);

  const lines = [
    "# Exercise Image Coverage Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    report.note,
    "",
    "## Totals",
    "",
    markdownTable(
      ["Metric", "Value"],
      Object.entries(report.totals).map(([key, value]) => [key, value])
    ),
    "",
    "## A. Resolver-internal coverage",
    "",
    "This checks `KNOWN_EXERCISE_IMAGE_SLUGS` against files on disk. It proves resolver/disk consistency only.",
    "",
    "## Missing canonical exercise images",
    "",
    markdownTable(
      ["canonical exerciseId", "English exercise name", "suggested filename", "muscle group", "equipment", "reason"],
      missingRows
    ),
    "",
    "## Canonical exercise to image",
    "",
    markdownTable(
      ["exerciseId", "English name", "resolved URL", "physical file", "classification", "aliases"],
      canonicalRows
    ),
    "",
    "## Image file to exercise",
    "",
    markdownTable(
      ["filename", "size", "git status", "canonical exercise", "referenced by resolver", "classification"],
      imageRows
    ),
    "",
    "## B. Generator-to-image coverage",
    "",
    "This starts from names and IDs the Workout Builder backend can plausibly return: set-credit IDs, backend aliases and observed generated fixtures.",
    "",
    markdownTable(
      ["generated name", "demoName", "provided exerciseId", "canonical exerciseId", "resolved URL", "classification", "sources"],
      generatorRows
    ),
    "",
    "## Generator names reaching fallback",
    "",
    markdownTable(
      ["generated name", "demoName", "provided exerciseId", "attempted slug", "fallback reason", "existing direct file"],
      generatorMissingRows
    ),
    "",
    "## Generator names routed to surrogate images",
    "",
    markdownTable(
      ["generated name", "canonical exerciseId", "resolved URL", "exact dedicated file status"],
      surrogateRows
    ),
    "",
    "## Orphan files",
    "",
    markdownTable(["filename"], report.orphanFiles.map((item) => [item.filename])),
    "",
    "## Broken mappings",
    "",
    markdownTable(["filename"], report.brokenMappings.map((item) => [item])),
    "",
    "## Invalid files",
    "",
    markdownTable(["filename", "reason"], report.invalidFiles.map((item) => [item.filename, item.invalidReason])),
    "",
    "## Fallback-only set-credit aliases",
    "",
    markdownTable(
      ["alias exerciseId", "resolved slug", "resolved URL"],
      report.fallbackOnlyAliases.map((item) => [item.aliasExerciseId, item.resolvedSlug, item.resolvedImageUrl])
    )
  ];

  fs.writeFileSync(MARKDOWN_REPORT, `${lines.join("\n")}\n`);
}

function main() {
  const report = buildAudit();
  fs.mkdirSync(path.dirname(JSON_REPORT), { recursive: true });
  fs.writeFileSync(JSON_REPORT, `${JSON.stringify(report, null, 2)}\n`);
  writeMarkdown(report);

  console.log("Exercise image coverage audit");
  console.log(JSON.stringify(report.totals, null, 2));
  if (report.issues.length) {
    console.error("Coverage issues:");
    for (const issue of report.issues) console.error(`- ${issue}`);
    process.exitCode = 1;
    return;
  }
  console.log("Audit passed: every resolver image is routed, valid and represented.");
}

if (require.main === module) {
  main();
}

module.exports = { buildAudit };
