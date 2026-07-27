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
  "bulgarian-split-squat",
  "cable-bicep-curl",
  "cable-crossover",
  "cable-crunch",
  "cable-lateral-raise",
  "cable-tricep-pushdown",
  "cable-wood-chopper",
  "cable-woodchopper",
  "chin-up",
  "close-grip-bench-press",
  "close-grip-lat-pulldown",
  "concentration-curl",
  "diamond-push-up",
  "dip",
  "dumbbell-bench-press",
  "dumbbell-bicep-curl",
  "dumbbell-fly",
  "dumbbell-front-raise",
  "dumbbell-goblet-squat",
  "dumbbell-hip-thrust",
  "dumbbell-lateral-raise",
  "dumbbell-reverse-fly",
  "dumbbell-row",
  "dumbbell-shoulder-press",
  "dumbbell-shrug",
  "face-pull",
  "good-morning",
  "hack-squat",
  "hammer-curl",
  "handstand",
  "handstand-push-up",
  "hanging-leg-raise",
  "incline-bench-press",
  "incline-dumbbell-bench-press",
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
  "wide-grip-push-up"
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
  lunge: "reverse-lunge",
  "dumbbell-lunge": "reverse-lunge",
  "forward-lunge": "reverse-lunge",
  "split-squat": "bulgarian-split-squat",
  "bulgarian-split-squat-dumbbell": "bulgarian-split-squat",
  "step-ups": "step-up",
  "box-step-up": "step-up",
  "dumbbell-step-up": "step-up",
  "barbell-step-up": "step-up",

  // --- Calf raise: generic name must land somewhere ---
  "calf-raise": "standing-calf-raise",
  "standing-calf-raises": "standing-calf-raise",
  "seated-calf-raises": "seated-calf-raise",
  "machine-calf-raise": "standing-calf-raise",
  "smith-machine-calf-raise": "standing-calf-raise",

  // --- Hinge ---
  "hip-thrust": "barbell-hip-thrust",
  "glute-bridge": "barbell-hip-thrust",
  "barbell-glute-bridge": "barbell-hip-thrust",
  deadlift: "romanian-deadlift",
  "stiff-leg-deadlift": "romanian-deadlift",
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
  abductors: "abductors",
  "hip-abductor-machine": "abductors",
  "hip-abduction-machine": "abductors",
  "abductor-machine": "abductors",
  "seated-hip-abduction": "abductors",
  "hip-adductor": "adductors",
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
  "incline-dumbbell-press": "incline-dumbbell-bench-press",
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
  "wide-grip-pull-up": "pull-up",
  "chin-ups": "chin-up",
  "neutral-grip-pullup": "neutral-grip-pull-up",
  "assisted-one-arm-pull-up": "one-arm-pull-up",
  "one-arm-chin-up": "one-arm-pull-up",
  "archer-pull-up": "one-arm-pull-up",
  "typewriter-pull-up": "typewriter-pull-ups",
  "typewriter-pullups": "typewriter-pull-ups",
  "typewriter-pull-ups": "typewriter-pull-ups",
  "lat-pulldowns": "lat-pulldown",
  "neutral-grip-lat-pulldown": "close-grip-lat-pulldown",
  "wide-grip-lat-pulldown": "lat-pulldown",
  "cable-lat-pulldown": "lat-pulldown",
  "one-arm-dumbbell-row": "dumbbell-row",
  "single-arm-dumbbell-row": "dumbbell-row",
  "dumbbell-bent-over-row": "dumbbell-row",
  "chest-supported-row": "seated-cable-row",
  "seated-row": "seated-cable-row",
  "cable-row": "seated-cable-row",
  "machine-row": "seated-cable-row",
  "bent-over-barbell-row": "barbell-row",
  "bent-over-row": "barbell-row",
  "pendlay-row": "barbell-row",
  "conventional-deadlift": "rack-pull",
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
  "side-lateral-raise": "dumbbell-lateral-raise",
  "lateral-raises": "dumbbell-lateral-raise",
  "front-raise": "dumbbell-front-raise",
  "rear-delt-fly": "dumbbell-reverse-fly",
  "reverse-pec-deck": "dumbbell-reverse-fly",
  "rear-delt-raise": "dumbbell-reverse-fly",
  "bent-over-lateral-raise": "dumbbell-reverse-fly",
  "reverse-fly": "dumbbell-reverse-fly",
  "upright-row": "barbell-upright-row",
  shrug: "barbell-shrug",
  shrugs: "barbell-shrug",

  // --- Arms ---
  "barbell-curl": "barbell-bicep-curl",
  "barbell-biceps-curl": "barbell-bicep-curl",
  "ez-bar-curl": "barbell-bicep-curl",
  "dumbbell-curl": "dumbbell-bicep-curl",
  "dumbbell-biceps-curl": "dumbbell-bicep-curl",
  "alternating-dumbbell-curl": "dumbbell-bicep-curl",
  "incline-dumbbell-curl": "dumbbell-bicep-curl",
  "bicep-curl": "dumbbell-bicep-curl",
  "biceps-curl": "dumbbell-bicep-curl",
  "cable-curl": "cable-bicep-curl",
  "cable-biceps-curl": "cable-bicep-curl",
  "machine-preacher-curl": "preacher-curl",
  "cable-preacher-curl": "preacher-curl",
  "ez-bar-preacher-curl": "preacher-curl",
  "hammer-curls": "hammer-curl",
  "triceps-pushdown": "cable-tricep-pushdown",
  "tricep-pushdown": "cable-tricep-pushdown",
  "rope-triceps-pushdown": "cable-tricep-pushdown",
  "rope-tricep-pushdown": "cable-tricep-pushdown",
  "cable-triceps-pushdown": "cable-tricep-pushdown",
  "overhead-triceps-extension": "overhead-tricep-extension",
  "cable-overhead-triceps-extension": "overhead-tricep-extension",
  "dumbbell-overhead-triceps-extension": "overhead-tricep-extension",
  "skull-crushers": "skull-crusher",
  "lying-triceps-extension": "skull-crusher",
  "triceps-dip": "tricep-dip",
  "bench-dip": "tricep-dip",
  "parallel-bar-dip": "dip",
  "chest-dip": "dip",

  // --- Core ---
  "cable-crunch": "cable-crunch",
  "kneeling-cable-crunch": "cable-crunch",
  crunch: "russian-twist",
  "hanging-knee-raise": "hanging-leg-raise",
  "leg-raise": "hanging-leg-raise",
  "ab-rollout": "ab-wheel-rollout",
  "plank-hold": "plank",
  "woodchopper": "cable-woodchopper",
  "cable-woodchop": "cable-woodchopper"
};

export function exerciseImageSlug(name = "") {
  const slug = slugifyExerciseName(name);
  if (!slug) return "";
  return ALIASES[slug] || slug;
}

export function hasExerciseImageSlug(slug = "") {
  return KNOWN_EXERCISE_IMAGE_SLUGS.has(slug);
}

function warnMissingExerciseImage(source, slug) {
  if (
    typeof window === "undefined" ||
    typeof console === "undefined" ||
    window.location?.hostname !== "localhost" ||
    missingExerciseImageWarnings.has(slug)
  ) {
    return;
  }

  missingExerciseImageWarnings.add(slug);
  console.warn("Missing exercise demo image; using branded fallback.", {
    source,
    slug
  });
}

export function exerciseImageUrl(exercise = {}) {
  const source =
    typeof exercise === "string"
      ? exercise
      : exercise.exerciseId ||
        exercise.id ||
        exercise.demoName ||
        exercise.name ||
        exercise.exercise ||
        "";
  const slug = exerciseImageSlug(source);
  if (slug && hasExerciseImageSlug(slug)) {
    return `/images/exercises/${slug}.png`;
  }

  if (slug) {
    warnMissingExerciseImage(source, slug);
  }

  return EXERCISE_FALLBACK_IMAGE_URL;
}

export function fallbackExerciseImageUrl() {
  return EXERCISE_FALLBACK_IMAGE_URL;
}
