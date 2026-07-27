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
  "seated-leg-curl": "lying-leg-curl",
  "hamstring-curl": "lying-leg-curl",
  "leg-extensions": "leg-extension",
  "knee-extension": "leg-extension",
  "seated-leg-extension": "leg-extension",

  // --- Chest ---
  "barbell-bench-press": "bench-press",
  "flat-bench-press": "bench-press",
  "flat-barbell-bench-press": "bench-press",
  "incline-barbell-bench-press": "incline-bench-press",
  "incline-press": "incline-bench-press",
  "incline-dumbbell-press": "dumbbell-bench-press",
  "incline-dumbbell-bench-press": "dumbbell-bench-press",
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
  "cable-crunch": "cable-woodchopper",
  crunch: "russian-twist",
  "hanging-knee-raise": "hanging-leg-raise",
  "leg-raise": "hanging-leg-raise",
  "ab-rollout": "ab-wheel-rollout",
  "plank-hold": "plank",
  "woodchopper": "cable-woodchopper",
  "cable-woodchop": "cable-woodchopper"
};

export const EXERCISE_FALLBACK_IMAGE_URL =
  "/images/exercises/fuelphysique-demo-fallback.svg";

export function exerciseImageSlug(name = "") {
  const slug = slugifyExerciseName(name);
  if (!slug) return "";
  return ALIASES[slug] || slug;
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
  return slug ? `/images/exercises/${slug}.png` : EXERCISE_FALLBACK_IMAGE_URL;
}

export function fallbackExerciseImageUrl() {
  return EXERCISE_FALLBACK_IMAGE_URL;
}
