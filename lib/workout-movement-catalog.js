// Pattern-based movement rules (Phase 2).
//
// The AI generates exercise names freely — there is no fixed exercise
// database to pre-populate with capability requirements. This catalog
// recognizes MOVEMENT PATTERNS by name (regex, not literal per-exercise
// hardcoding) and attaches the same conceptual fields a real exercise
// record would have: requiredEquipmentAll, requiredEquipmentAny,
// requiredCapabilities, and a concrete name/exerciseId/equipment per
// satisfying equipment choice. lib/workout-repair.js uses this to resolve
// a generated exercise (which may reference "Pull-up Bar" literally, or a
// vague "X or Y" name) to exactly one concrete, capability-correct
// implementation before validation ever runs — the validator's equipment
// rule stays untouched and strict.
//
// This generalizes to any movement matching these patterns, not only the
// specific exercise names seen in the five captured production cases.

const HANGING_CORE_VARIANTS = {
  rings: { exerciseId: "hanging-leg-raise-rings", name: "Hanging Leg Raise on Rings", equipment: "rings" },
  pullupbar: { exerciseId: "hanging-leg-raise", name: "Hanging Leg Raise", equipment: "pullupbar" }
};

const VERTICAL_PULL_VARIANTS = {
  rings: { exerciseId: "ring-pull-up", name: "Ring Pull-up", equipment: "rings" },
  pullupbar: { exerciseId: "pull-up", name: "Pull-up", equipment: "pullupbar" }
};

const MOVEMENT_RULES = [
  {
    // Weighted / advanced pull-up variants — keep the "weighted"/"one-arm"
    // qualifier, but resolve the apparatus.
    pattern: /weighted\s+pull-?up/i,
    requiredCapabilities: ["vertical_hang", "vertical_pull"],
    variantsByEquipment: {
      rings: { exerciseId: "weighted-ring-pull-up", name: "Weighted Ring Pull-up", equipment: "rings" },
      pullupbar: { exerciseId: "weighted-pull-up", name: "Weighted Pull-up", equipment: "pullupbar" }
    }
  },
  {
    pattern: /one-?arm\s+pull-?up/i,
    requiredCapabilities: ["vertical_hang", "vertical_pull"],
    variantsByEquipment: {
      rings: { exerciseId: "one-arm-ring-pull-up-practice", name: "One-Arm Ring Pull-up Practice", equipment: "rings" },
      pullupbar: { exerciseId: "one-arm-pull-up-practice", name: "One-Arm Pull-up Practice", equipment: "pullupbar" }
    }
  },
  {
    pattern: /front\s+lever/i,
    requiredCapabilities: ["vertical_hang"],
    variantsByEquipment: {
      rings: { exerciseId: "front-lever-hold-rings", name: "Front Lever Hold on Rings", equipment: "rings" },
      pullupbar: { exerciseId: "front-lever-hold", name: "Front Lever Hold Practice", equipment: "pullupbar" }
    }
  },
  {
    pattern: /scapular\s+pull-?up/i,
    requiredCapabilities: ["vertical_hang"],
    variantsByEquipment: {
      rings: { exerciseId: "ring-scapular-pull", name: "Ring Scapular Pull", equipment: "rings" },
      pullupbar: { exerciseId: "scapular-pull-up", name: "Scapular Pull-up", equipment: "pullupbar" }
    }
  },
  {
    pattern: /hanging\s+(leg|knee)\s+raise/i,
    requiredCapabilities: ["vertical_hang", "hanging_core"],
    variantsByEquipment: HANGING_CORE_VARIANTS
  },
  {
    pattern: /chin-?up/i,
    requiredCapabilities: ["vertical_hang", "vertical_pull"],
    variantsByEquipment: {
      rings: { exerciseId: "ring-chin-up", name: "Ring Chin-up", equipment: "rings" },
      pullupbar: { exerciseId: "chin-up", name: "Chin-up", equipment: "pullupbar" }
    }
  },
  {
    // Plain pull-up, including AI names like "Pull-up (Rings or Bar)".
    pattern: /^pull-?up\b|pull-?up\s*\(/i,
    requiredCapabilities: ["vertical_hang", "vertical_pull"],
    variantsByEquipment: VERTICAL_PULL_VARIANTS
  }
];

// Movements that need an elevated/bench support surface beyond just the
// load equipment — dumbbells/barbell alone are NOT sufficient. When the
// required support capability isn't available, repair substitutes the
// floorFallback (a real, equally valid variant needing no support surface)
// rather than silently assuming a bench/box exists.
const SUPPORT_EQUIPMENT_RULES = [
  {
    pattern: /incline\s+dumbbell\s+press/i,
    requiredCapabilities: ["bench_support"],
    floorFallback: { exerciseId: "dumbbell-floor-press", name: "Dumbbell Floor Press", equipment: "dumbbell" }
  },
  {
    pattern: /incline\s+barbell\s+press/i,
    requiredCapabilities: ["bench_support"],
    floorFallback: { exerciseId: "barbell-bench-press", name: "Barbell Bench Press", equipment: "barbell" }
  },
  {
    pattern: /bulgarian\s+split\s+squat/i,
    requiredCapabilities: ["elevated_support"],
    floorFallback: { exerciseId: "dumbbell-reverse-lunge", name: "Dumbbell Reverse Lunge", equipment: "dumbbell" }
  },
  {
    pattern: /\bstep-?up\b/i,
    requiredCapabilities: ["elevated_support"],
    floorFallback: { exerciseId: "dumbbell-reverse-lunge", name: "Dumbbell Reverse Lunge", equipment: "dumbbell" }
  }
];

function matchMovementRule(exerciseName = "") {
  const name = String(exerciseName);
  return MOVEMENT_RULES.find((rule) => rule.pattern.test(name)) || null;
}

function matchSupportEquipmentRule(exerciseName = "") {
  const name = String(exerciseName);
  return SUPPORT_EQUIPMENT_RULES.find((rule) => rule.pattern.test(name)) || null;
}

// Names containing an unresolved alternative ("X or Y", "X/Y") that must
// never be returned to the client as a final exercise name.
const UNRESOLVED_ALTERNATIVE_PATTERN = /\s(or)\s|\//i;

function hasUnresolvedAlternative(exerciseName = "") {
  return UNRESOLVED_ALTERNATIVE_PATTERN.test(String(exerciseName));
}

module.exports = {
  MOVEMENT_RULES,
  SUPPORT_EQUIPMENT_RULES,
  matchMovementRule,
  matchSupportEquipmentRule,
  hasUnresolvedAlternative
};
