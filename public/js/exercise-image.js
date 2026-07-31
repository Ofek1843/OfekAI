// Resolves an exercise name to its demo image in public/images/exercises/.
//
// The plan generator writes demoName as free text ("the precise canonical
// English exercise name"), so the same movement arrives under many spellings:
// Back Squat / Barbell Squat, Overhead Triceps Extension / Overhead Tricep
// Extension, Australian Pull-up / Australian Row. Slugifying alone therefore
// misses art we already have and the card renders an empty purple tile.
//
// ALIASES maps those variants onto the slug that actually exists on disk. Keys
// and values are both slugs, so a new spelling costs one line here instead of a
// duplicated image file. When adding art, name the file after the most common
// spelling and alias the rest to it.

export const EXERCISE_FALLBACK_IMAGE_URL =
  "/images/exercises/fuelphysique-demo-fallback.svg";

export const KNOWN_EXERCISE_IMAGE_SLUGS = new Set([
  "ab-wheel-rollout",
  "abductors",
  "adductors",
  "archer-push-up",
  "arnold-press",
  "australian-row",
  "barbell-bicep-curl",
  "barbell-front-squat",
  "barbell-hip-thrust",
  "barbell-row",
  "barbell-shoulder-press",
  "barbell-shrug",
  "barbell-squat",
  "barbell-upright-row",
  "bench-press",
  "cable-bicep-curl",
  "cable-crossover",
  "cable-crunch",
  "crunch",
  "cable-lateral-raise",
  "cable-tricep-pushdown",
  "cable-woodchopper",
  "chin-up",
  "close-grip-bench-press",
  "close-grip-lat-pulldown",
  "concentration-curl",
  "diamond-push-up",
  "dip",
  "dumbbell-bench-press",
  "dumbbell-bicep-curl",
  "dumbbell-bulgarian-split-squat",
  "dumbbell-calf-raise",
  "dumbbell-fly",
  "dumbbell-front-raise",
  "dumbbell-goblet-squat",
  "dumbbell-hip-thrust",
  "dumbbell-lateral-raise",
  "dumbbell-reverse-fly",
  "dumbbell-row",
  "dumbbell-shoulder-press",
  "dumbbell-shrug",
  "dumbbell-walking-lunge",
  "face-pull",
  "good-morning",
  "hack-squat",
  "hammer-curl",
  "handstand",
  "handstand-push-up",
  "hanging-leg-raise",
  "incline-bench-press",
  "incline-dumbbell-bench-press",
  "incline-dumbbell-curl",
  "kettlebell-swing",
  "l-sit",
  "lat-pulldown",
  "leg-extension",
  "leg-press",
  "lying-leg-curl",
  "machine-chest-fly",
  "machine-chest-press",
  "machine-shoulder-press",
  "muscle-up",
  "neutral-grip-pull-up",
  "one-arm-pull-up",
  "overhead-tricep-extension",
  "pike-push-up",
  "pistol-squat",
  "plank",
  "preacher-curl",
  "pull-up",
  "push-up",
  "rack-pull",
  "reverse-pec-deck",
  "reverse-lunge",
  "romanian-deadlift",
  "russian-twist",
  "seated-cable-row",
  "seated-calf-raise",
  "seated-leg-curl",
  "side-plank",
  "skull-crusher",
  "standing-calf-raise",
  "step-up",
  "sumo-deadlift",
  "t-bar-row",
  "tricep-dip",
  "typewriter-pull-ups",
  "wide-grip-push-up",
  // --- Newly imaged (previously routed to the branded fallback) ---
  "assisted-pull-up",
  "assisted-chin-up",
  "bench-dip",
  "hip-thrust-machine",
  "chest-supported-row",
  "seated-machine-row",
  "single-arm-cable-row",
  "cable-overhead-triceps-extension",
  "hanging-knee-raise",
  "conventional-deadlift",
  "wide-grip-pull-up",
  "forward-lunge"
]);

const missingExerciseImageWarnings = new Set();

export function slugifyExerciseName(name = "") {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ALIASES = {
  // --- Squat / leg patterns ---
  "back-squat": "barbell-squat",
  "barbell-back-squat": "barbell-squat",
  "high-bar-squat": "barbell-squat",
  "low-bar-squat": "barbell-squat",
  squat: "barbell-squat",
  "smith-machine-squat": "hack-squat",
  "front-squat": "barbell-front-squat",
  "goblet-squat": "dumbbell-goblet-squat",
  "walking-lunge": "reverse-lunge",
  "walking-lunges": "reverse-lunge",
  lunge: "reverse-lunge",
  "dumbbell-lunge": "reverse-lunge",
  "dumbbell-lunges": "reverse-lunge",
  "dumbbell-walking-lunges": "dumbbell-walking-lunge",
  "walking-dumbbell-lunge": "dumbbell-walking-lunge",
  "walking-dumbbell-lunges": "dumbbell-walking-lunge",
  "forward-lunge": "forward-lunge",
  "bulgarian-split-squat": "dumbbell-bulgarian-split-squat",
  "split-squat": "dumbbell-bulgarian-split-squat",
  "dumbbell-bulgarian-split-squat": "dumbbell-bulgarian-split-squat",
  "bulgarian-dumbbell-split-squat": "dumbbell-bulgarian-split-squat",
  "bulgarian-split-squat-dumbbell": "dumbbell-bulgarian-split-squat",
  "step-ups": "step-up",
  "box-step-up": "step-up",
  "dumbbell-step-up": "step-up",
  "barbell-step-up": "step-up",

  // --- Calf raise: generic name must land somewhere ---
  "calf-raise": "calf-raise",
  "standing-calf-raises": "standing-calf-raise",
  "seated-calf-raises": "seated-calf-raise",
  "dumbbell-calf-raises": "dumbbell-calf-raise",
  "standing-dumbbell-calf-raise": "dumbbell-calf-raise",
  "standing-dumbbell-calf-raises": "dumbbell-calf-raise",
  "dumbbell-standing-calf-raise": "dumbbell-calf-raise",
  "dumbbell-standing-calf-raises": "dumbbell-calf-raise",
  "standing-calf-raise-machine": "standing-calf-raise",
  "machine-calf-raise": "standing-calf-raise",
  "smith-machine-calf-raise": "standing-calf-raise",

  // --- Hinge ---
  "hip-thrust": "barbell-hip-thrust",
  "glute-bridge": "barbell-hip-thrust",
  "barbell-glute-bridge": "barbell-hip-thrust",
  deadlift: "deadlift",
  "stiff-leg-deadlift": "stiff-leg-deadlift",
  "dumbbell-romanian-deadlift": "romanian-deadlift",
  rdl: "romanian-deadlift",
  "lying-leg-curls": "lying-leg-curl",
  "leg-curl": "lying-leg-curl",
  "seated-leg-curl": "seated-leg-curl",
  "seated-leg-curls": "seated-leg-curl",
  "seated-hamstring-curl": "seated-leg-curl",
  "hamstring-curl": "lying-leg-curl",
  "leg-extensions": "leg-extension",
  "knee-extension": "leg-extension",
  "seated-leg-extension": "leg-extension",
  "hip-abductor": "abductors",
  abduction: "abductors",
  "abduction-machine": "abductors",
  "hip-abduction": "abductors",
  abductors: "abductors",
  "hip-abductor-machine": "abductors",
  "hip-abduction-machine": "abductors",
  "abductor-machine": "abductors",
  "seated-hip-abduction": "abductors",
  "hip-adductor": "adductors",
  adduction: "adductors",
  "adduction-machine": "adductors",
  "hip-adduction": "adductors",
  adductors: "adductors",
  "hip-adductor-machine": "adductors",
  "hip-adduction-machine": "adductors",
  "adductor-machine": "adductors",
  "seated-hip-adduction": "adductors",

  // --- Chest ---
  "barbell-bench-press": "bench-press",
  "flat-bench-press": "bench-press",
  "flat-barbell-bench-press": "bench-press",
  "incline-barbell-bench-press": "incline-bench-press",
  "incline-press": "incline-bench-press",
  // The generator says "chest press" as often as "bench press" for this
  // movement; without these the card fell back despite the image existing.
  "incline-barbell-chest-press": "incline-bench-press",
  "incline-chest-press-barbell": "incline-bench-press",
  "barbell-incline-chest-press": "incline-bench-press",
  "barbell-incline-bench-press": "incline-bench-press",
  "incline-dumbbell-press": "incline-dumbbell-bench-press",
  "incline-dumbbell-chest-press": "incline-dumbbell-bench-press",
  "incline-dumbbell-bench-chest-press": "incline-dumbbell-bench-press",
  "incline-dumbbell-chest-press-machine": "incline-dumbbell-bench-press",
  "incline-dumbbell-bench": "incline-dumbbell-bench-press",
  "dumbell-incline-bench-press": "incline-dumbbell-bench-press",
  "dumbell-incline-press": "incline-dumbbell-bench-press",
  "incline-dumbbell-bench-press": "incline-dumbbell-bench-press",
  "incline-db-press": "incline-dumbbell-bench-press",
  "incline-db-bench-press": "incline-dumbbell-bench-press",
  "dumbbell-press": "dumbbell-bench-press",
  "chest-press-machine": "machine-chest-press",
  "chest-press": "machine-chest-press",
  "seated-chest-press": "machine-chest-press",
  "pec-deck": "machine-chest-fly",
  "chest-fly": "machine-chest-fly",
  "machine-fly": "machine-chest-fly",
  "cable-fly": "cable-crossover",
  "cable-chest-fly": "cable-crossover",
  "high-to-low-cable-fly": "cable-crossover",
  "dumbbell-chest-fly": "dumbbell-fly",
  "flat-dumbbell-fly": "dumbbell-fly",
  "push-ups": "push-up",
  pushup: "push-up",
  "wide-push-up": "wide-grip-push-up",
  "close-grip-push-up": "diamond-push-up",

  // --- Back ---
  "australian-pull-up": "australian-row",
  "inverted-row": "australian-row",
  "ring-row": "australian-row",
  "bodyweight-row": "australian-row",
  "suspension-row": "australian-row",
  "pull-ups": "pull-up",
  pullup: "pull-up",
  "wide-grip-pull-up": "wide-grip-pull-up",
  "chin-ups": "chin-up",
  "neutral-grip-pullup": "neutral-grip-pull-up",
  "assisted-one-arm-pull-up": "one-arm-pull-up",
  "one-arm-chin-up": "one-arm-pull-up",
  "archer-pull-up": "one-arm-pull-up",
  "typewriter-pull-up": "typewriter-pull-ups",
  "typewriter-pullups": "typewriter-pull-ups",
  "typewriter-pull-ups": "typewriter-pull-ups",
  "lat-pulldowns": "lat-pulldown",
  // The generator frequently appends the equipment word ("Lat Pulldown
  // Machine"), which slugged to an unmapped id and fell back.
  "lat-pulldown-machine": "lat-pulldown",
  "machine-lat-pulldown": "lat-pulldown",
  "front-lat-pulldown": "lat-pulldown",
  "neutral-grip-lat-pulldown": "close-grip-lat-pulldown",
  "wide-grip-lat-pulldown": "lat-pulldown",
  "cable-lat-pulldown": "lat-pulldown",
  "one-arm-dumbbell-row": "dumbbell-row",
  "single-arm-dumbbell-row": "dumbbell-row",
  "dumbbell-bent-over-row": "dumbbell-row",
  "chest-supported-row": "chest-supported-row",
  "seated-row": "seated-row",
  "seated-machine-row": "seated-machine-row",
  // Same movement, equipment word first ("Machine Seated Row").
  "machine-seated-row": "seated-machine-row",
  "seated-row-machine": "seated-row-machine",
  "cable-row": "seated-cable-row",
  "machine-row": "machine-row",
  "bent-over-barbell-row": "barbell-row",
  "bent-over-row": "barbell-row",
  // Same movement, different word order -- only the "bent-over-barbell-row"
  // ordering was aliased, so "Barbell Bent Over Row" fell back.
  "barbell-bent-over-row": "barbell-row",
  "barbell-bent-over-rows": "barbell-row",
  "bent-over-row-barbell": "barbell-row",
  "pendlay-row": "barbell-row",
  "conventional-deadlift": "conventional-deadlift",
  "straight-arm-pulldown": "close-grip-lat-pulldown",
  "back-extension": "good-morning",
  hyperextension: "good-morning",

  // --- Shoulders ---
  "overhead-press": "barbell-shoulder-press",
  "military-press": "barbell-shoulder-press",
  "standing-overhead-press": "barbell-shoulder-press",
  "seated-barbell-shoulder-press": "barbell-shoulder-press",
  "seated-dumbbell-shoulder-press": "dumbbell-shoulder-press",
  "dumbbell-overhead-press": "dumbbell-shoulder-press",
  "shoulder-press-machine": "machine-shoulder-press",
  "lateral-raise": "dumbbell-lateral-raise",
  "dumbell-lateral-raise": "dumbbell-lateral-raise",
  "dumbell-lateral-raises": "dumbbell-lateral-raise",
  "side-lateral-raise": "dumbbell-lateral-raise",
  "lateral-raises": "dumbbell-lateral-raise",
  "front-raise": "dumbbell-front-raise",
  "rear-delt-fly": "dumbbell-reverse-fly",
  "machine-rear-delt-fly": "reverse-pec-deck",
  "rear-delt-machine-fly": "reverse-pec-deck",
  "reverse-pec-deck": "reverse-pec-deck",
  "reverse-pec-deck-fly": "reverse-pec-deck",
  "reverse-pec-deck-machine": "reverse-pec-deck",
  "reverse-machine-fly": "reverse-pec-deck",
  "machine-reverse-fly": "reverse-pec-deck",
  "rear-delt-pec-deck": "reverse-pec-deck",
  "rear-delt-raise": "dumbbell-reverse-fly",
  "bent-over-lateral-raise": "dumbbell-reverse-fly",
  "reverse-fly": "dumbbell-reverse-fly",
  "upright-row": "barbell-upright-row",
  "barbell-shrugs": "barbell-shrug",
  "dumbbell-shrugs": "dumbbell-shrug",
  "dumbbells-shrug": "dumbbell-shrug",
  "dumbbells-shrugs": "dumbbell-shrug",
  shrug: "barbell-shrug",
  shrugs: "barbell-shrug",

  // --- Arms ---
  "barbell-curl": "barbell-bicep-curl",
  "barbell-biceps-curl": "barbell-bicep-curl",
  "ez-bar-curl": "barbell-bicep-curl",
  "dumbbell-curl": "dumbbell-bicep-curl",
  "dumbbell-biceps-curl": "dumbbell-bicep-curl",
  "alternating-dumbbell-curl": "dumbbell-bicep-curl",
  "incline-dumbbell-curl": "incline-dumbbell-curl",
  "bicep-curl": "dumbbell-bicep-curl",
  "biceps-curl": "dumbbell-bicep-curl",
  "cable-curl": "cable-bicep-curl",
  "cable-biceps-curl": "cable-bicep-curl",
  "machine-preacher-curl": "preacher-curl",
  "cable-preacher-curl": "preacher-curl",
  "ez-bar-preacher-curl": "preacher-curl",
  "hammer-curls": "hammer-curl",
  "dumbbell-hammer-curl": "hammer-curl",
  "dumbbell-hammer-curls": "hammer-curl",
  "triceps-pushdown": "cable-tricep-pushdown",
  "tricep-pushdown": "cable-tricep-pushdown",
  "rope-triceps-pushdown": "cable-tricep-pushdown",
  "rope-tricep-pushdown": "cable-tricep-pushdown",
  "cable-triceps-pushdown": "cable-tricep-pushdown",
  "cable-face-pull": "face-pull",
  "overhead-triceps-extension": "overhead-tricep-extension",
  "cable-overhead-triceps-extension": "cable-overhead-triceps-extension",
  "dumbbell-overhead-triceps-extension": "overhead-tricep-extension",
  // The generator uses singular "tricep" and plural "triceps" interchangeably;
  // only the plural spellings were aliased.
  "dumbbell-overhead-tricep-extension": "overhead-tricep-extension",
  "overhead-dumbbell-triceps-extension": "overhead-tricep-extension",
  "overhead-dumbbell-tricep-extension": "overhead-tricep-extension",
  "seated-overhead-triceps-extension": "overhead-tricep-extension",
  "seated-overhead-tricep-extension": "overhead-tricep-extension",
  "skull-crushers": "skull-crusher",
  "lying-triceps-extension": "skull-crusher",
  "triceps-dip": "tricep-dip",
  "bench-dip": "bench-dip",
  "parallel-bar-dip": "dip",
  "chest-dip": "dip",

  // --- Core ---
  "cable-crunch": "cable-crunch",
  "kneeling-cable-crunch": "cable-crunch",
  crunch: "crunch",
  "ab-crunch": "crunch",
  "ab-crunch-machine": "crunch",
  "machine-ab-crunch": "crunch",
  "machine-crunch": "crunch",
  "seated-ab-crunch": "crunch",
  "hanging-knee-raise": "hanging-knee-raise",
  "leg-raise": "hanging-leg-raise",
  "ab-rollout": "ab-wheel-rollout",
  "plank-hold": "plank",
  "woodchopper": "cable-woodchopper",
  "wood-chopper": "cable-woodchopper",
  "cable-wood-chopper": "cable-woodchopper",
  "cable-woodchop": "cable-woodchopper"
};

// Deterministic rewrites applied only when a slug matches nothing, so a
// wording difference that does not change the movement still finds its
// demo. Each rewrite is semantically neutral: dropping the equipment word
// ("Lat Pulldown Machine"), or swapping an exact synonym for the same lift
// ("chest press" is the same movement as "bench press"). Applied one at a
// time and kept only if the result is a real known slug or alias, so these
// can never invent a mapping or hand over another exercise's photo.
const NEUTRAL_SLUG_REWRITES = [
  slug => slug.replace(/-machine$/, ""),
  slug => slug.replace(/^machine-/, ""),
  slug => slug.replace(/-chest-press$/, "-bench-press"),
  slug => slug.replace(/^chest-press-/, "bench-press-"),
  slug => slug.replace(/tricep(?!s)/g, "triceps"),
  slug => slug.replace(/triceps/g, "tricep"),
  slug => slug.replace(/bicep(?!s)/g, "biceps"),
  slug => slug.replace(/biceps/g, "bicep"),
  // The generator often appends a posture or grip qualifier that the catalog
  // carries at the front, or not at all ("Barbell Shoulder Press Seated",
  // "Cable Lat Pulldown Wide Grip"). Drop a trailing qualifier, or move it to
  // the front, and keep the result only if it names a real exercise.
  slug => slug.replace(/-(seated|standing|lying|kneeling|incline|decline|flat)$/, ""),
  slug => slug.replace(/^(seated|standing|lying|kneeling)-/, ""),
  slug => slug.replace(/^(.*)-(seated|standing|lying|kneeling|incline|decline)$/, "$2-$1"),
  slug => slug.replace(/-(wide|close|neutral|reverse|underhand|overhand)-grip$/, ""),
  slug => slug.replace(/^(.*)-(wide|close|neutral|underhand|overhand)-grip$/, "$2-grip-$1"),
  slug => slug.replace(/^reverse-/, ""),
  slug => slug.replace(/-reverse-/, "-")
];

function resolveKnownSlug(slug) {
  if (!slug) return "";
  if (ALIASES[slug]) return ALIASES[slug];
  if (KNOWN_EXERCISE_IMAGE_SLUGS.has(slug)) return slug;
  return "";
}

export function exerciseImageSlug(name = "") {
  const slug = slugifyExerciseName(name);
  if (!slug) return "";

  const direct = resolveKnownSlug(slug);
  if (direct) return direct;

  for (const rewrite of NEUTRAL_SLUG_REWRITES) {
    const rewritten = rewrite(slug);
    if (rewritten === slug) continue;
    const resolved = resolveKnownSlug(rewritten);
    if (resolved) return resolved;
  }

  return slug;
}

export function hasExerciseImageSlug(slug = "") {
  return KNOWN_EXERCISE_IMAGE_SLUGS.has(slug);
}

function exerciseImageSource(exercise = {}) {
  if (typeof exercise === "string") {
    return { sourceField: "string", sourceValue: exercise };
  }

  // Canonical identity first, display text only as a recovery path.
  const candidates = [
    ["exerciseId", exercise.exerciseId],
    ["id", exercise.id],
    ["demoName", exercise.demoName],
    ["name", exercise.name],
    ["exercise", exercise.exercise]
  ].map(([sourceField, rawValue]) => [sourceField, String(rawValue || "").trim()])
    .filter(([, sourceValue]) => sourceValue);

  // Take the first candidate that actually resolves to a known demo image,
  // not merely the first that is non-empty. The generator sometimes emits a
  // placeholder exerciseId copied from the prompt's schema example
  // ("exercise-2-0") alongside a perfectly good name ("Barbell Bent Over
  // Row"); stopping at the first non-empty field meant that placeholder won
  // and the card fell back even though the image existed. Live generation
  // showed 11 of 16 exercises failing this way in a single program.
  for (const [sourceField, sourceValue] of candidates) {
    const slug = exerciseImageSlug(sourceValue);
    if (slug && hasExerciseImageSlug(slug)) return { sourceField, sourceValue };
  }

  // Nothing resolved: keep the first candidate so the reported details still
  // describe what was attempted, and let the caller use the branded fallback.
  if (candidates.length) {
    const [sourceField, sourceValue] = candidates[0];
    return { sourceField, sourceValue };
  }

  return { sourceField: "none", sourceValue: "" };
}

function warnMissingExerciseImage(details) {
  if (
    typeof window === "undefined" ||
    typeof console === "undefined" ||
    window.location?.hostname !== "localhost" ||
    missingExerciseImageWarnings.has(details.attemptedSlug)
  ) {
    return;
  }

  missingExerciseImageWarnings.add(details.attemptedSlug);
  console.warn("Missing exercise demo image; using branded fallback.", details);
}

export function exerciseImageResolutionDetails(exercise = {}) {
  const { sourceField, sourceValue } = exerciseImageSource(exercise);
  const attemptedSlug = exerciseImageSlug(sourceValue);
  const hasDedicatedImage = Boolean(attemptedSlug && hasExerciseImageSlug(attemptedSlug));
  const imageUrl = hasDedicatedImage
    ? `/images/exercises/${attemptedSlug}.png`
    : EXERCISE_FALLBACK_IMAGE_URL;

  return {
    originalName: typeof exercise === "object" ? exercise.name || "" : String(exercise || ""),
    demoName: typeof exercise === "object" ? exercise.demoName || "" : "",
    exerciseId: typeof exercise === "object" ? exercise.exerciseId || exercise.id || "" : "",
    equipment: typeof exercise === "object" ? exercise.equipment || "" : "",
    muscle: typeof exercise === "object" ? exercise.muscleGroup || exercise.muscle || "" : "",
    sourceField,
    sourceValue,
    attemptedSlug,
    imageUrl,
    usedFallback: !hasDedicatedImage,
    fallbackReason: hasDedicatedImage
      ? ""
      : attemptedSlug
        ? "resolved slug is not in KNOWN_EXERCISE_IMAGE_SLUGS"
        : "no usable exercise name, demoName or exerciseId"
  };
}

export function exerciseImageUrl(exercise = {}) {
  const details = exerciseImageResolutionDetails(exercise);
  if (!details.usedFallback) {
    return details.imageUrl;
  }

  if (details.attemptedSlug) {
    warnMissingExerciseImage(details);
  }

  return EXERCISE_FALLBACK_IMAGE_URL;
}

export function fallbackExerciseImageUrl() {
  return EXERCISE_FALLBACK_IMAGE_URL;
}
