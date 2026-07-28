// Deterministic alias map: common AI-generated exercise name phrasing ->
// the canonical exerciseId used as a key in lib/workout-setcredits-map.js.
//
// This does NOT invent new muscle-credit mappings — it only helps a real
// exercise the AI names slightly differently ("Barbell Back Squat") resolve
// to the SAME canonical id an exact/slug match would have missed
// ("barbell-squat"), so calculateWeeklyVolume can find the mapping that
// already exists for it. An exercise with no entry here (and no slug match)
// still gets a deterministic exerciseId (see workout-repair.js) — it just
// isn't credited toward weekly volume, exactly like any other unmapped
// exercise, and is reported via unknownExercises/mappingCoveragePercent.
//
// Keys are normalized the same way as lib/workout-volume.js's
// slugifyExerciseId (lowercase, non-alphanumeric collapsed to single
// hyphens, trimmed) so lookups are exact-match against a normalized name.

const EXERCISE_NAME_ALIASES = {
  "barbell-back-squat": "barbell-squat",
  "back-squat": "barbell-squat",
  "barbell-romanian-deadlift": "romanian-deadlift",
  "romanian-deadlift-rdl": "romanian-deadlift",
  "rdl": "romanian-deadlift",
  "cable-triceps-pushdown": "cable-tricep-pushdown",
  "triceps-pushdown": "cable-tricep-pushdown",
  "tricep-pushdown": "cable-tricep-pushdown",
  "dumbbell-biceps-curl": "dumbbell-curl",
  "biceps-curl": "dumbbell-curl",
  "bicep-curl": "dumbbell-curl",
  "barbell-biceps-curl": "barbell-bicep-curl",
  "cable-biceps-curl": "cable-bicep-curl",
  "pull-up-assisted-if-needed": "pull-up",
  "assisted-pull-up": "pull-up",
  "chin-up-assisted-if-needed": "chin-up",
  "single-arm-cable-row": "seated-cable-row",
  "seated-row": "seated-cable-row",
  "machine-row": "seated-cable-row",
  "seated-machine-row": "seated-cable-row",
  "seated-row-machine": "seated-cable-row",
  "seated-leg-curl": "leg-curl",
  "leg-press-machine": "leg-press",
  "leg-extension-machine": "leg-extension",
  "machine-chest-fly": "machine-chest-fly",
  "cable-chest-fly": "cable-crossover",
  "cable-crossover-fly": "cable-crossover",
  "incline-dumbbell-press": "dumbbell-bench-press",
  "flat-dumbbell-press": "dumbbell-bench-press",
  "incline-dumbbell-curl": "dumbbell-curl",
  "dumbbell-hammer-curl": "hammer-curl",
  "hammer-curls": "hammer-curl",
  "machine-rear-delt-fly": "dumbbell-reverse-fly",
  "rear-delt-machine-fly": "dumbbell-reverse-fly",
  "reverse-pec-deck": "dumbbell-reverse-fly",
  "cable-face-pull": "face-pull",
  "standing-calf-raise-machine": "standing-calf-raise",
  "seated-calf-raise-machine": "seated-calf-raise",
  "dumbbell-bulgarian-split-squat": "dumbbell-goblet-squat",
  "bulgarian-split-squat": "dumbbell-goblet-squat",
  "cable-overhead-triceps-extension": "overhead-tricep-extension",
  "overhead-triceps-extension": "overhead-tricep-extension",
  "dumbbell-shoulder-press-seated-or-standing": "dumbbell-shoulder-press",
  "barbell-hip-thrust-machine": "barbell-hip-thrust",
  "hanging-knee-raise": "hanging-leg-raise",
  "push-up-standard": "push-up",
  "triceps-dip": "dip",
  "bench-dip": "dip"
};

module.exports = { EXERCISE_NAME_ALIASES };
