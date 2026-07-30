"use strict";

const { slugifyExerciseId } = require("./workout-volume");

function slug(value = "") {
  return slugifyExerciseId(value);
}

function titleFromId(id) {
  return String(id || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const PUBLIC_EXERCISES = {
  "ab-wheel-rollout": { image: "ab-wheel-rollout.png", setCredits: { core: 1.0 }, equipment: "Bodyweight" },
  abductors: { image: "abductors.png", setCredits: { glutes: 1.0 }, equipment: "Machine" },
  adductors: { image: "adductors.png", setCredits: { glutes: 0.5, quads: 0.5 }, equipment: "Machine" },
  "archer-push-up": { image: "archer-push-up.png", setCredits: { chest: 1.0, triceps: 0.5, delts: 0.5 }, equipment: "Bodyweight" },
  "arnold-press": { image: "arnold-press.png", setCredits: { delts: 1.0, triceps: 0.25 }, equipment: "Dumbbell" },
  "australian-row": { image: "australian-row.png", setCredits: { back: 1.0, biceps: 0.5 }, equipment: "Bodyweight" },
  "barbell-bench-press": { image: "bench-press.png", setCredits: { chest: 1.0, triceps: 0.5, delts: 0.5 }, equipment: "Barbell" },
  "barbell-bicep-curl": { image: "barbell-bicep-curl.png", setCredits: { biceps: 1.0 }, equipment: "Barbell" },
  "barbell-front-squat": { image: "barbell-front-squat.png", setCredits: { quads: 1.0, glutes: 0.5, core: 0.5 }, equipment: "Barbell" },
  "barbell-hip-thrust": { image: "barbell-hip-thrust.png", setCredits: { glutes: 1.0, hamstrings: 1.0, back: 0.25 }, equipment: "Barbell" },
  "barbell-row": { image: "barbell-row.png", setCredits: { back: 1.0, biceps: 0.5, delts: 0.25 }, equipment: "Barbell" },
  "barbell-shoulder-press": { image: "barbell-shoulder-press.png", setCredits: { delts: 1.0, triceps: 0.5, chest: 0.25 }, equipment: "Barbell" },
  "barbell-shrug": { image: "barbell-shrug.png", setCredits: { traps: 1.0, delts: 0.25 }, equipment: "Barbell" },
  "barbell-squat": { image: "barbell-squat.png", setCredits: { quads: 1.0, glutes: 0.5, core: 0.5 }, equipment: "Barbell" },
  "barbell-upright-row": { image: "barbell-upright-row.png", setCredits: { delts: 1.0, traps: 0.5 }, equipment: "Barbell" },
  "bulgarian-split-squat": { image: "dumbbell-bulgarian-split-squat.png", setCredits: { quads: 1.0, glutes: 0.75, core: 0.25 }, equipment: "Dumbbell" },
  "cable-bicep-curl": { image: "cable-bicep-curl.png", setCredits: { biceps: 1.0 }, equipment: "Cable" },
  "cable-crossover": { image: "cable-crossover.png", setCredits: { chest: 1.0, delts: 0.25 }, equipment: "Cable" },
  "cable-crunch": { image: "cable-crunch.png", setCredits: { core: 1.0 }, equipment: "Cable" },
  crunch: { image: "crunch.png", setCredits: { core: 1.0 }, equipment: "Machine" },
  "cable-lateral-raise": { image: "cable-lateral-raise.png", setCredits: { delts: 1.0 }, equipment: "Cable" },
  "cable-tricep-pushdown": { image: "cable-tricep-pushdown.png", setCredits: { triceps: 1.0 }, equipment: "Cable" },
  "cable-woodchopper": { image: "cable-woodchopper.png", setCredits: { core: 1.0 }, equipment: "Cable" },
  "chin-up": { image: "chin-up.png", setCredits: { back: 1.0, biceps: 1.0 }, equipment: "Pull-up Bar" },
  "close-grip-bench-press": { image: "close-grip-bench-press.png", setCredits: { triceps: 1.0, chest: 0.5, delts: 0.25 }, equipment: "Barbell" },
  "close-grip-lat-pulldown": { image: "close-grip-lat-pulldown.png", setCredits: { back: 1.0, biceps: 0.5 }, equipment: "Cable" },
  "concentration-curl": { image: "concentration-curl.png", setCredits: { biceps: 1.0 }, equipment: "Dumbbell" },
  "diamond-push-up": { image: "diamond-push-up.png", setCredits: { triceps: 1.0, chest: 0.75, delts: 0.25 }, equipment: "Bodyweight" },
  dip: { image: "dip.png", setCredits: { chest: 1.0, triceps: 1.0, delts: 0.5 }, equipment: "Parallel Bars" },
  "dumbbell-bench-press": { image: "dumbbell-bench-press.png", setCredits: { chest: 1.0, triceps: 0.5, delts: 0.5 }, equipment: "Dumbbell" },
  "dumbbell-bicep-curl": { image: "dumbbell-bicep-curl.png", setCredits: { biceps: 1.0 }, equipment: "Dumbbell" },
  "dumbbell-bulgarian-split-squat": { image: "dumbbell-bulgarian-split-squat.png", setCredits: { quads: 1.0, glutes: 0.75, core: 0.25 }, equipment: "Dumbbell" },
  "dumbbell-calf-raise": { image: "dumbbell-calf-raise.png", setCredits: { calves: 1.0 }, equipment: "Dumbbell" },
  "dumbbell-curl": { image: "dumbbell-bicep-curl.png", setCredits: { biceps: 1.0 }, equipment: "Dumbbell" },
  "dumbbell-fly": { image: "dumbbell-fly.png", setCredits: { chest: 1.0 }, equipment: "Dumbbell" },
  "dumbbell-front-raise": { image: "dumbbell-front-raise.png", setCredits: { delts: 1.0 }, equipment: "Dumbbell" },
  "dumbbell-goblet-squat": { image: "dumbbell-goblet-squat.png", setCredits: { quads: 1.0, glutes: 0.5, core: 0.25 }, equipment: "Dumbbell" },
  "dumbbell-hip-thrust": { image: "dumbbell-hip-thrust.png", setCredits: { glutes: 1.0, hamstrings: 0.75 }, equipment: "Dumbbell" },
  "dumbbell-lateral-raise": { image: "dumbbell-lateral-raise.png", setCredits: { delts: 1.0 }, equipment: "Dumbbell" },
  "dumbbell-reverse-fly": { image: "dumbbell-reverse-fly.png", setCredits: { rear_delts: 1.0 }, equipment: "Dumbbell" },
  "dumbbell-row": { image: "dumbbell-row.png", setCredits: { back: 1.0, biceps: 0.5 }, equipment: "Dumbbell" },
  "dumbbell-shoulder-press": { image: "dumbbell-shoulder-press.png", setCredits: { delts: 1.0, triceps: 0.5, chest: 0.25 }, equipment: "Dumbbell" },
  "dumbbell-shrug": { image: "dumbbell-shrug.png", setCredits: { traps: 1.0, delts: 0.25 }, equipment: "Dumbbell" },
  "dumbbell-walking-lunge": { image: "dumbbell-walking-lunge.png", setCredits: { quads: 1.0, glutes: 0.75 }, equipment: "Dumbbell" },
  "face-pull": { image: "face-pull.png", setCredits: { rear_delts: 1.0 }, equipment: "Cable" },
  "good-morning": { image: "good-morning.png", setCredits: { hamstrings: 1.0, glutes: 0.75, back: 0.5 }, equipment: "Barbell" },
  "hack-squat": { image: "hack-squat.png", setCredits: { quads: 1.0, glutes: 0.25 }, equipment: "Machine" },
  "hammer-curl": { image: "hammer-curl.png", setCredits: { biceps: 1.0 }, equipment: "Dumbbell" },
  handstand: { image: "handstand.png", setCredits: { delts: 0.75, core: 0.5 }, equipment: "Bodyweight" },
  "handstand-push-up": { image: "handstand-push-up.png", setCredits: { delts: 1.0, triceps: 0.75 }, equipment: "Bodyweight" },
  "hanging-leg-raise": { image: "hanging-leg-raise.png", setCredits: { core: 1.0 }, equipment: "Pull-up Bar" },
  "kettlebell-swing": { image: "kettlebell-swing.png", setCredits: { glutes: 1.0, hamstrings: 0.75, core: 0.5 }, equipment: "Kettlebell" },
  "incline-bench-press": { image: "incline-bench-press.png", setCredits: { chest: 1.0, delts: 0.5, triceps: 0.5 }, equipment: "Barbell" },
  "incline-dumbbell-bench-press": { image: "incline-dumbbell-bench-press.png", setCredits: { chest: 1.0, delts: 0.5, triceps: 0.5 }, equipment: "Dumbbell" },
  "incline-dumbbell-curl": { image: "incline-dumbbell-curl.png", setCredits: { biceps: 1.0 }, equipment: "Dumbbell" },
  "lat-pulldown": { image: "lat-pulldown.png", setCredits: { back: 1.0, biceps: 0.5 }, equipment: "Cable" },
  "leg-curl": { image: "lying-leg-curl.png", setCredits: { hamstrings: 1.0 }, equipment: "Machine" },
  "leg-extension": { image: "leg-extension.png", setCredits: { quads: 1.0 }, equipment: "Machine" },
  "leg-press": { image: "leg-press.png", setCredits: { quads: 1.0, glutes: 0.5 }, equipment: "Machine" },
  "lying-leg-curl": { image: "lying-leg-curl.png", setCredits: { hamstrings: 1.0 }, equipment: "Machine" },
  "machine-chest-fly": { image: "machine-chest-fly.png", setCredits: { chest: 1.0 }, equipment: "Machine" },
  "machine-chest-press": { image: "machine-chest-press.png", setCredits: { chest: 1.0, triceps: 0.5, delts: 0.25 }, equipment: "Machine" },
  "machine-shoulder-press": { image: "machine-shoulder-press.png", setCredits: { delts: 1.0, triceps: 0.5, chest: 0.25 }, equipment: "Machine" },
  "muscle-up": { image: "muscle-up.png", setCredits: { back: 1.0, chest: 0.5, triceps: 0.5, biceps: 0.5 }, equipment: "Pull-up Bar" },
  "neutral-grip-pull-up": { image: "neutral-grip-pull-up.png", setCredits: { back: 1.0, biceps: 0.75 }, equipment: "Pull-up Bar" },
  "one-arm-pull-up": { image: "one-arm-pull-up.png", setCredits: { back: 1.0, biceps: 0.75 }, equipment: "Pull-up Bar" },
  "overhead-press": { image: "barbell-shoulder-press.png", setCredits: { delts: 1.0, triceps: 0.5, chest: 0.25 }, equipment: "Barbell" },
  "overhead-tricep-extension": { image: "overhead-tricep-extension.png", setCredits: { triceps: 1.0 }, equipment: "Dumbbell" },
  "pec-deck": { image: "machine-chest-fly.png", setCredits: { chest: 1.0 }, equipment: "Machine" },
  "pike-push-up": { image: "pike-push-up.png", setCredits: { delts: 1.0, triceps: 0.5 }, equipment: "Bodyweight" },
  "pistol-squat": { image: "pistol-squat.png", setCredits: { quads: 1.0, glutes: 0.5, core: 0.5 }, equipment: "Bodyweight" },
  plank: { image: "plank.png", setCredits: { core: 1.0 }, equipment: "Bodyweight" },
  "preacher-curl": { image: "preacher-curl.png", setCredits: { biceps: 1.0 }, equipment: "Machine" },
  "pull-up": { image: "pull-up.png", setCredits: { back: 1.0, biceps: 0.5 }, equipment: "Pull-up Bar" },
  "push-up": { image: "push-up.png", setCredits: { chest: 1.0, triceps: 0.5, delts: 0.5 }, equipment: "Bodyweight" },
  "rack-pull": { image: "rack-pull.png", setCredits: { back: 1.0, hamstrings: 0.5, glutes: 0.5 }, equipment: "Barbell" },
  "reverse-pec-deck": { image: "reverse-pec-deck.png", setCredits: { rear_delts: 1.0 }, equipment: "Machine" },
  "reverse-lunge": { image: "reverse-lunge.png", setCredits: { quads: 1.0, glutes: 0.75 }, equipment: "Dumbbell" },
  "romanian-deadlift": { image: "romanian-deadlift.png", setCredits: { hamstrings: 1.0, glutes: 1.0, back: 0.25 }, equipment: "Barbell" },
  "russian-twist": { image: "russian-twist.png", setCredits: { core: 1.0 }, equipment: "Bodyweight" },
  "l-sit": { image: "l-sit.png", setCredits: { core: 1.0 }, equipment: "Bodyweight" },
  "seated-cable-row": { image: "seated-cable-row.png", setCredits: { back: 1.0, biceps: 0.5 }, equipment: "Cable" },
  "seated-calf-raise": { image: "seated-calf-raise.png", setCredits: { calves: 1.0 }, equipment: "Machine" },
  "seated-leg-curl": { image: "seated-leg-curl.png", setCredits: { hamstrings: 1.0 }, equipment: "Machine" },
  "side-plank": { image: "side-plank.png", setCredits: { core: 1.0 }, equipment: "Bodyweight" },
  "skull-crusher": { image: "skull-crusher.png", setCredits: { triceps: 1.0 }, equipment: "Barbell" },
  "standing-calf-raise": { image: "standing-calf-raise.png", setCredits: { calves: 1.0 }, equipment: "Machine" },
  "standing-calf-raise-machine": { image: "standing-calf-raise.png", setCredits: { calves: 1.0 }, equipment: "Machine" },
  "step-up": { image: "step-up.png", setCredits: { quads: 1.0, glutes: 0.75 }, equipment: "Dumbbell" },
  "sumo-deadlift": { image: "sumo-deadlift.png", setCredits: { hamstrings: 0.75, glutes: 1.0, back: 0.5 }, equipment: "Barbell" },
  "t-bar-row": { image: "t-bar-row.png", setCredits: { back: 1.0, biceps: 0.5 }, equipment: "Machine" },
  "tricep-dip": { image: "tricep-dip.png", setCredits: { triceps: 1.0, chest: 0.5, delts: 0.25 }, equipment: "Parallel Bars" },
  "typewriter-pull-ups": { image: "typewriter-pull-ups.png", setCredits: { back: 1.0, biceps: 0.75 }, equipment: "Pull-up Bar" },
  "wide-grip-push-up": { image: "wide-grip-push-up.png", setCredits: { chest: 1.0, triceps: 0.5, delts: 0.5 }, equipment: "Bodyweight" },

  // --- Newly imaged (previously in DISABLED_EXERCISES pending dedicated art) ---
  "assisted-pull-up": { image: "assisted-pull-up.png", setCredits: { back: 1.0, biceps: 0.5 }, equipment: "Machine" },
  "assisted-chin-up": { image: "assisted-chin-up.png", setCredits: { back: 1.0, biceps: 0.75 }, equipment: "Machine" },
  "bench-dip": { image: "bench-dip.png", setCredits: { triceps: 1.0, chest: 0.5, delts: 0.25 }, equipment: "Bodyweight" },
  "hip-thrust-machine": { image: "hip-thrust-machine.png", setCredits: { glutes: 1.0, hamstrings: 0.75 }, equipment: "Machine" },
  "chest-supported-row": { image: "chest-supported-row.png", setCredits: { back: 1.0, biceps: 0.5, delts: 0.25 }, equipment: "Machine" },
  "seated-machine-row": { image: "seated-machine-row.png", setCredits: { back: 1.0, biceps: 0.5 }, equipment: "Machine" },
  "single-arm-cable-row": { image: "single-arm-cable-row.png", setCredits: { back: 1.0, biceps: 0.5 }, equipment: "Cable" },
  "cable-overhead-triceps-extension": { image: "cable-overhead-triceps-extension.png", setCredits: { triceps: 1.0 }, equipment: "Cable" },
  "hanging-knee-raise": { image: "hanging-knee-raise.png", setCredits: { core: 1.0 }, equipment: "Pull-up Bar" },
  "conventional-deadlift": { image: "conventional-deadlift.png", setCredits: { hamstrings: 1.0, glutes: 1.0, back: 0.5 }, equipment: "Barbell" },
  "wide-grip-pull-up": { image: "wide-grip-pull-up.png", setCredits: { back: 1.0, biceps: 0.5 }, equipment: "Pull-up Bar" },
  "forward-lunge": { image: "forward-lunge.png", setCredits: { quads: 1.0, glutes: 0.75 }, equipment: "Bodyweight" }
};

const DISABLED_EXERCISES = {};

const SAFE_ALIASES = {
  "barbell-back-squat": "barbell-squat",
  "back-squat": "barbell-squat",
  "high-bar-squat": "barbell-squat",
  "low-bar-squat": "barbell-squat",
  squat: "barbell-squat",
  "front-squat": "barbell-front-squat",
  "goblet-squat": "dumbbell-goblet-squat",
  "bulgarian-split-squat": "dumbbell-bulgarian-split-squat",
  "split-squat": "dumbbell-bulgarian-split-squat",
  "bulgarian-dumbbell-split-squat": "dumbbell-bulgarian-split-squat",
  "bulgarian-split-squat-dumbbell": "dumbbell-bulgarian-split-squat",
  "dumbbell-bulgarian-split-squat": "dumbbell-bulgarian-split-squat",
  "barbell-romanian-deadlift": "romanian-deadlift",
  "romanian-deadlift-rdl": "romanian-deadlift",
  rdl: "romanian-deadlift",
  "lying-leg-curls": "lying-leg-curl",
  "leg-curl": "lying-leg-curl",
  "hamstring-curl": "lying-leg-curl",
  "seated-leg-curls": "seated-leg-curl",
  "seated-hamstring-curl": "seated-leg-curl",
  "leg-press-machine": "leg-press",
  "leg-extension-machine": "leg-extension",
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
  "barbell-bench-press": "barbell-bench-press",
  "flat-bench-press": "barbell-bench-press",
  "flat-barbell-bench-press": "barbell-bench-press",
  "incline-barbell-bench-press": "incline-bench-press",
  "incline-press": "incline-bench-press",
  "incline-dumbbell-press": "incline-dumbbell-bench-press",
  "incline-dumbbell-chest-press": "incline-dumbbell-bench-press",
  "incline-dumbbell-bench-chest-press": "incline-dumbbell-bench-press",
  "incline-dumbbell-chest-press-machine": "incline-dumbbell-bench-press",
  "incline-dumbbell-bench": "incline-dumbbell-bench-press",
  "incline-db-press": "incline-dumbbell-bench-press",
  "incline-db-bench-press": "incline-dumbbell-bench-press",
  "flat-dumbbell-press": "dumbbell-bench-press",
  "dumbbell-press": "dumbbell-bench-press",
  "chest-press-machine": "machine-chest-press",
  "chest-press": "machine-chest-press",
  "seated-chest-press": "machine-chest-press",
  "pec-deck": "pec-deck",
  "chest-fly": "machine-chest-fly",
  "machine-fly": "machine-chest-fly",
  "cable-fly": "cable-crossover",
  "cable-chest-fly": "cable-crossover",
  "cable-crossover-fly": "cable-crossover",
  "high-to-low-cable-fly": "cable-crossover",
  "dumbbell-chest-fly": "dumbbell-fly",
  "flat-dumbbell-fly": "dumbbell-fly",
  "push-ups": "push-up",
  pushup: "push-up",
  "push-up-standard": "push-up",
  "knee-push-up": "push-up",
  "knee-push-ups": "push-up",
  "wide-push-up": "wide-grip-push-up",
  "close-grip-push-up": "diamond-push-up",
  "australian-pull-up": "australian-row",
  "inverted-row": "australian-row",
  "ring-row": "australian-row",
  "bodyweight-row": "australian-row",
  "suspension-row": "australian-row",
  "pull-ups": "pull-up",
  pullup: "pull-up",
  "chin-ups": "chin-up",
  "neutral-grip-pullup": "neutral-grip-pull-up",
  "neutral-grip-pull-up": "neutral-grip-pull-up",
  "lat-pulldowns": "lat-pulldown",
  "wide-grip-lat-pulldown": "lat-pulldown",
  "cable-lat-pulldown": "lat-pulldown",
  "neutral-grip-lat-pulldown": "close-grip-lat-pulldown",
  "one-arm-dumbbell-row": "dumbbell-row",
  "single-arm-dumbbell-row": "dumbbell-row",
  "dumbbell-bent-over-row": "dumbbell-row",
  "cable-row": "seated-cable-row",
  "bent-over-barbell-row": "barbell-row",
  "bent-over-row": "barbell-row",
  "pendlay-row": "barbell-row",
  "straight-arm-pulldown": "close-grip-lat-pulldown",
  "back-extension": "good-morning",
  hyperextension: "good-morning",
  "overhead-press": "barbell-shoulder-press",
  "military-press": "barbell-shoulder-press",
  "standing-overhead-press": "barbell-shoulder-press",
  "seated-barbell-shoulder-press": "barbell-shoulder-press",
  "dumbbell-shoulder-press-seated-or-standing": "dumbbell-shoulder-press",
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
  "barbell-curl": "barbell-bicep-curl",
  "barbell-biceps-curl": "barbell-bicep-curl",
  "ez-bar-curl": "barbell-bicep-curl",
  "dumbbell-biceps-curl": "dumbbell-curl",
  "biceps-curl": "dumbbell-curl",
  "bicep-curl": "dumbbell-curl",
  "alternating-dumbbell-curl": "dumbbell-curl",
  "incline-dumbbell-curl": "incline-dumbbell-curl",
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
  "dumbbell-overhead-triceps-extension": "overhead-tricep-extension",
  "skull-crushers": "skull-crusher",
  "lying-triceps-extension": "skull-crusher",
  "triceps-dip": "tricep-dip",
  "parallel-bar-dip": "dip",
  "chest-dip": "dip",
  "ab-crunch": "crunch",
  "ab-crunch-machine": "crunch",
  "machine-ab-crunch": "crunch",
  "machine-crunch": "crunch",
  "seated-ab-crunch": "crunch",
  crunch: "crunch",
  "kneeling-cable-crunch": "cable-crunch",
  "leg-raise": "hanging-leg-raise",
  "lying-leg-raise": "hanging-leg-raise",
  "ab-rollout": "ab-wheel-rollout",
  "plank-hold": "plank",
  "forearm-plank": "plank",
  "woodchopper": "cable-woodchopper",
  "wood-chopper": "cable-woodchopper",
  "cable-wood-chopper": "cable-woodchopper",
  "cable-woodchop": "cable-woodchopper",
  "walking-dumbbell-lunge": "dumbbell-walking-lunge",
  "walking-dumbbell-lunges": "dumbbell-walking-lunge",
  "dumbbell-walking-lunges": "dumbbell-walking-lunge",
  "step-ups": "step-up",
  "box-step-up": "step-up",
  "dumbbell-step-up": "step-up",
  "standing-dumbbell-calf-raise": "dumbbell-calf-raise",
  "standing-dumbbell-calf-raises": "dumbbell-calf-raise",
  "dumbbell-standing-calf-raise": "dumbbell-calf-raise",
  "dumbbell-standing-calf-raises": "dumbbell-calf-raise"
};

// Word-variant aliases for the 12 exercises above that now have dedicated
// art but previously didn't (this block used to be DISABLED_ALIASES,
// pointing at ids that were routed away in DISABLED_EXERCISES). Kept
// separate from SAFE_ALIASES only for change-history clarity; functionally
// identical since both are merged into WORKOUT_EXERCISE_ALIAS_MAP below.
const NEWLY_ENABLED_ALIASES = {
  "pull-up-assisted-if-needed": "assisted-pull-up",
  "assisted-pull-up": "assisted-pull-up",
  "chin-up-assisted-if-needed": "assisted-chin-up",
  "assisted-chin-up": "assisted-chin-up",
  "bench-dip": "bench-dip",
  "hip-thrust-machine": "hip-thrust-machine",
  "barbell-hip-thrust-machine": "hip-thrust-machine",
  "chest-supported-row": "chest-supported-row",
  "seated-row": "seated-machine-row",
  "machine-row": "seated-machine-row",
  "seated-machine-row": "seated-machine-row",
  "seated-row-machine": "seated-machine-row",
  "single-arm-cable-row": "single-arm-cable-row",
  "cable-overhead-triceps-extension": "cable-overhead-triceps-extension",
  "hanging-knee-raise": "hanging-knee-raise",
  "standing-calf-raise": "standing-calf-raise",
  "standing-calf-raises": "standing-calf-raise",
  "calf-raise": "standing-calf-raise",
  "machine-calf-raise": "standing-calf-raise-machine",
  "smith-machine-calf-raise": "standing-calf-raise-machine",
  "conventional-deadlift": "conventional-deadlift",
  "wide-grip-pull-up": "wide-grip-pull-up",
  "forward-lunge": "forward-lunge",
  lunge: "forward-lunge",
  "dumbbell-lunge": "forward-lunge",
  "dumbbell-lunges": "forward-lunge"
};

const DISABLED_ALIASES = {};

const WORKOUT_EXERCISE_ALIAS_MAP = { ...SAFE_ALIASES, ...NEWLY_ENABLED_ALIASES, ...DISABLED_ALIASES };

const WORKOUT_EXERCISE_CATALOG = Object.fromEntries(
  Object.entries(PUBLIC_EXERCISES).map(([exerciseId, entry]) => [
    exerciseId,
    {
      exerciseId,
      title: entry.title || titleFromId(exerciseId),
      image: entry.image,
      setCredits: entry.setCredits,
      equipment: entry.equipment,
      publicGeneration: true,
      disabled: false
    }
  ])
);

const MISSING_DEDICATED_IMAGE_EXERCISES = Object.entries(DISABLED_EXERCISES).map(
  ([exerciseId, entry]) => ({
    exerciseId,
    title: titleFromId(exerciseId),
    reason: entry.reason,
    replacementIds: entry.replacementIds
  })
);

const PUBLIC_DISABLED_EXERCISE_IDS = new Set(Object.keys(DISABLED_EXERCISES));

function canonicalizeExerciseId(value = "") {
  const normalized = slug(value);
  if (!normalized) return "";
  return WORKOUT_EXERCISE_ALIAS_MAP[normalized] || normalized;
}

function getCatalogExercise(exerciseId) {
  return WORKOUT_EXERCISE_CATALOG[canonicalizeExerciseId(exerciseId)];
}

function isPublicExerciseEnabled(exerciseId) {
  const canonical = canonicalizeExerciseId(exerciseId);
  return Boolean(WORKOUT_EXERCISE_CATALOG[canonical]?.publicGeneration && !PUBLIC_DISABLED_EXERCISE_IDS.has(canonical));
}

function getDisabledExercise(exerciseId) {
  const canonical = canonicalizeExerciseId(exerciseId);
  return DISABLED_EXERCISES[canonical] ? { exerciseId: canonical, ...DISABLED_EXERCISES[canonical] } : null;
}

function getEnabledPublicExerciseIds() {
  return Object.keys(WORKOUT_EXERCISE_CATALOG)
    .filter(isPublicExerciseEnabled)
    .sort();
}

function getPublicSetCredits() {
  return Object.fromEntries(
    Object.entries(WORKOUT_EXERCISE_CATALOG)
      .filter(([exerciseId, entry]) => isPublicExerciseEnabled(exerciseId) && entry.setCredits)
      .map(([exerciseId, entry]) => [exerciseId, entry.setCredits])
  );
}

function getPublicExerciseImageMap() {
  return Object.fromEntries(
    Object.entries(WORKOUT_EXERCISE_CATALOG)
      .filter(([exerciseId]) => isPublicExerciseEnabled(exerciseId))
      .map(([exerciseId, entry]) => [exerciseId, entry.image])
  );
}

module.exports = {
  WORKOUT_EXERCISE_CATALOG,
  WORKOUT_EXERCISE_ALIAS_MAP,
  PUBLIC_DISABLED_EXERCISE_IDS,
  MISSING_DEDICATED_IMAGE_EXERCISES,
  canonicalizeExerciseId,
  getCatalogExercise,
  getDisabledExercise,
  getEnabledPublicExerciseIds,
  getPublicExerciseImageMap,
  getPublicSetCredits,
  isPublicExerciseEnabled
};
