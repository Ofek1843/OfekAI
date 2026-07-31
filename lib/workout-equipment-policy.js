// Single source of truth for "what equipment is this program allowed to
// use" — the canonical allowed set this returns must be used identically by
// generation (the model prompt), deterministic repair, catalog substitution,
// reroll, validation, the saved plan and the Workout Tracker. Before this
// module existed, the same "is bodyweight implicit?" decision was
// re-implemented slightly differently in workout-repair.js
// (isExerciseEquipmentAllowed unconditionally allowed bodyweight) and in
// workout-validator.js (validateWorkoutProgram unconditionally skipped
// bodyweight), which is how a Gym-style program with only Dumbbells +
// Machines selected still generated and PASSED VALIDATION for Archer Push Up
// and Australian Row — both Bodyweight exercises nobody selected.
//
// Canonical equipment tokens (see normalizeEquipment in workout-validator.js
// for the full alias table, including Hebrew forms):
//   bodyweight, dumbbell, machine, barbell, cable, pullupbar, rings
//
// STYLE POLICY — the only place this decision is made:
//
//   Gym: only explicitly selected equipment is available. Bodyweight is
//   NEVER implicit for Gym — "Dumbbells + Machines" means exactly those two
//   tokens, nothing else.
//
//   Calisthenics: bodyweight is intrinsic to the style, so it is always
//   added to the allowed set even if the user never checked the Bodyweight
//   box. This must never be a SILENT server-side add: the Workout Builder
//   wizard force-checks the Bodyweight checkbox the moment Calisthenics is
//   selected (see applyCalisthenicsImplicitBodyweight in
//   public/js/workout-builder.js) specifically so the derived equipment is
//   visible in the user's own Summary and in the submitted request payload,
//   not just materialized invisibly here. This module's own addition is a
//   defensive backstop for callers that don't go through that wizard step
//   (e.g. a saved plan replayed through reroll).
//
//   Hybrid: bodyweight is NOT implicit. A Hybrid athlete may or may not want
//   bodyweight work mixed in with equipment-based training, unlike
//   Calisthenics where bodyweight IS the entire modality — so Hybrid follows
//   the same explicit-selection rule as Gym. This is a deliberate, documented
//   product decision, not an oversight: change it only via an explicit
//   product decision, not a silent code change.
//
//   Any other/unrecognized style: treated the same as Gym (the safe
//   default — never assume equipment nobody selected).
//
// No other equipment (Pull-up Bar, Rings, Cable, Machines, Dumbbells,
// Barbell) is ever implicit for any style. A Barbell is not a Pull-up Bar.

const { normalizeEquipment } = require("./workout-validator");

const CANONICAL_EQUIPMENT_TOKENS = Object.freeze([
  "bodyweight",
  "dumbbell",
  "machine",
  "barbell",
  "cable",
  "pullupbar",
  "rings"
]);

const STYLES_WITH_IMPLICIT_BODYWEIGHT = new Set(["calisthenics"]);

// deriveAllowedEquipment({ trainingStyle, selectedEquipment }) -> {
//   explicit:  canonical tokens the user actually selected (deduped)
//   derived:   canonical tokens added by style policy (e.g. ["bodyweight"]
//              for Calisthenics), never anything the user could not also
//              see reflected in their own Summary
//   allowed:   explicit + derived, deduped — THE canonical set every other
//              module (repair, validator, catalog substitution, reroll,
//              prompt, saved plan, Tracker) must treat as authoritative
//   style:     the normalized style string this decision was made against
// }
function deriveAllowedEquipment({ trainingStyle, selectedEquipment } = {}) {
  const rawList = Array.isArray(selectedEquipment)
    ? selectedEquipment
    : selectedEquipment
      ? [selectedEquipment]
      : [];

  const explicit = [...new Set(rawList.map((item) => normalizeEquipment(item)).filter(Boolean))];
  const style = String(trainingStyle || "").trim().toLowerCase();

  const derived = [];
  if (STYLES_WITH_IMPLICIT_BODYWEIGHT.has(style) && !explicit.includes("bodyweight")) {
    derived.push("bodyweight");
  }

  const allowed = [...new Set([...explicit, ...derived])];

  return { explicit, derived, allowed, style };
}

module.exports = { deriveAllowedEquipment, CANONICAL_EQUIPMENT_TOKENS };
