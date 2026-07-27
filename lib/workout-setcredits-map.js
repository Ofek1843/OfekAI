// Hardcoded setCredits mapping for the most common exercises in current blueprints.
//
// Each entry maps exerciseId -> { muscle: credit, ... }
// credit 1.0 = primary, 0.5 = meaningful secondary, 0.25 = minor secondary.
//
// Unknown exercises will trigger a warning in calculateWeeklyVolume and receive 0 credit.

const EXERCISE_SETCREDITS = {
  // --- Barbell compound lifts ---
  "barbell-bench-press": { chest: 1.0, triceps: 0.5, delts: 0.5 },
  "barbell-squat": { quads: 1.0, glutes: 0.5, core: 0.5 },
  "barbell-row": { back: 1.0, biceps: 0.5, delts: 0.25 },
  "barbell-shoulder-press": { delts: 1.0, triceps: 0.5, chest: 0.25 },
  "barbell-hip-thrust": { glutes: 1.0, hamstrings: 1.0, back: 0.25 },

  // --- Dumbbell compound lifts ---
  "dumbbell-bench-press": { chest: 1.0, triceps: 0.5, delts: 0.5 },
  "dumbbell-shoulder-press": { delts: 1.0, triceps: 0.5, chest: 0.25 },
  "dumbbell-goblet-squat": { quads: 1.0, glutes: 0.5, core: 0.25 },

  // --- Machine compound lifts ---
  "leg-press": { quads: 1.0, glutes: 0.5 },
  "hack-squat": { quads: 1.0, glutes: 0.25 },
  "machine-chest-press": { chest: 1.0, triceps: 0.5, delts: 0.25 },
  "machine-shoulder-press": { delts: 1.0, triceps: 0.5, chest: 0.25 },

  // --- Hinge patterns ---
  "romanian-deadlift": { hamstrings: 1.0, glutes: 1.0, back: 0.25 },
  "leg-curl": { hamstrings: 1.0 },
  "lying-leg-curl": { hamstrings: 1.0 },

  // --- Vertical push ---
  "overhead-press": { delts: 1.0, triceps: 0.5, chest: 0.25 },

  // --- Vertical pull ---
  "lat-pulldown": { back: 1.0, biceps: 0.5 },
  "pull-up": { back: 1.0, biceps: 0.5 },
  "chin-up": { back: 1.0, biceps: 1.0 },
  "neutral-grip-lat-pulldown": { back: 1.0, biceps: 0.5 },

  // --- Horizontal pull ---
  "seated-cable-row": { back: 1.0, biceps: 0.5 },
  "chest-supported-row": { back: 1.0, biceps: 0.5, delts: 0.25 },

  // --- Horizontal push ---
  "cable-crossover": { chest: 1.0, delts: 0.25 },
  "dumbbell-fly": { chest: 1.0 },

  // --- Isolation arms ---
  "dumbbell-curl": { biceps: 1.0 },
  "barbell-bicep-curl": { biceps: 1.0 },
  "cable-bicep-curl": { biceps: 1.0 },
  "hammer-curl": { biceps: 1.0 },
  "cable-tricep-pushdown": { triceps: 1.0 },
  "overhead-tricep-extension": { triceps: 1.0 },
  "skull-crusher": { triceps: 1.0 },

  // --- Isolation legs ---
  "leg-extension": { quads: 1.0 },
  "standing-calf-raise": { calves: 1.0 },
  "seated-calf-raise": { calves: 1.0 },

  // --- Isolation shoulders ---
  "dumbbell-lateral-raise": { delts: 1.0 },
  "cable-lateral-raise": { delts: 1.0 },
  "dumbbell-reverse-fly": { rear_delts: 1.0 },
  "face-pull": { rear_delts: 1.0 },

  // --- Isolation chest ---
  "machine-chest-fly": { chest: 1.0 },
  "pec-deck": { chest: 1.0 },

  // --- Core ---
  "plank": { core: 1.0 },
  "hanging-leg-raise": { core: 1.0 },
  "cable-crunch": { core: 1.0 },
  "ab-wheel-rollout": { core: 1.0 },
  "russian-twist": { core: 1.0 },

  // --- Bodyweight / skill ---
  "push-up": { chest: 1.0, triceps: 0.5, delts: 0.5 },
  "dip": { chest: 1.0, triceps: 1.0, delts: 0.5 },
  "australian-row": { back: 1.0, biceps: 0.5 },
  "muscle-up": { back: 1.0, chest: 0.5, triceps: 0.5, biceps: 0.5 }
};

module.exports = { EXERCISE_SETCREDITS };
