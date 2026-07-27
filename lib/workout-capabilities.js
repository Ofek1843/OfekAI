// Canonical equipment -> capability model (Phase 2).
//
// Equipment strings are what the user selects and what the wire format
// carries (unchanged from Phase 1 — bodyweight, pullupbar, rings,
// dumbbell, barbell, machine, cable, plus the new support-equipment ids
// below). Capabilities are what a MOVEMENT actually needs; equipment
// provides zero or more capabilities. This is what lets "rings" and
// "pullupbar" be alternatives for a vertical-hang movement without ever
// treating them as universally identical (rings also provide
// horizontal_pull/dip_support/skill_support that a bar does not).

const CANONICAL_EQUIPMENT_IDS = [
  "bodyweight",
  "rings",
  "pullupbar",
  "dumbbell",
  "barbell",
  "machine",
  "cable",
  "bench",
  "adjustable_bench",
  "box",
  "rack",
  "dip_bars",
  "cardio_machine"
];

// Every capability a piece of equipment provides. Bodyweight always
// provides floor_bodyweight regardless of what else is selected — it is
// never something the user needs to opt into (see workout-preferences-
// validator.js, which treats it as intrinsic in calisthenics mode).
const EQUIPMENT_CAPABILITIES = {
  bodyweight: ["floor_bodyweight"],
  rings: ["vertical_hang", "vertical_pull", "horizontal_pull", "hanging_core", "dip_support", "skill_support"],
  pullupbar: ["vertical_hang", "vertical_pull", "hanging_core"],
  dumbbell: ["external_load", "unilateral_load"],
  barbell: ["external_load", "barbell_load"],
  machine: ["guided_resistance"],
  cable: ["guided_resistance"],
  bench: ["bench_support", "elevated_support"],
  adjustable_bench: ["bench_support", "elevated_support"],
  box: ["elevated_support"],
  rack: ["barbell_rack"],
  dip_bars: ["dip_support"],
  cardio_machine: ["conditioning_machine"]
};

function normalizeEquipmentId(raw) {
  return String(raw || "").trim().toLowerCase();
}

// All capabilities available given a user's selected equipment list.
// bodyweight's floor_bodyweight is always included — see module comment.
function getAvailableCapabilities(selectedEquipment = []) {
  const capabilities = new Set(EQUIPMENT_CAPABILITIES.bodyweight);
  for (const item of selectedEquipment) {
    const id = normalizeEquipmentId(item);
    for (const capability of EQUIPMENT_CAPABILITIES[id] || []) {
      capabilities.add(capability);
    }
  }
  return capabilities;
}

function hasCapability(selectedEquipment, capability) {
  return getAvailableCapabilities(selectedEquipment).has(capability);
}

// Which selected equipment ids provide a given capability, in selection
// order — used to deterministically pick ONE concrete implementation
// (e.g. the first of rings/pullupbar the user actually selected).
function equipmentProvidingCapability(selectedEquipment, capability) {
  return selectedEquipment
    .map(normalizeEquipmentId)
    .filter((id) => (EQUIPMENT_CAPABILITIES[id] || []).includes(capability));
}

module.exports = {
  CANONICAL_EQUIPMENT_IDS,
  EQUIPMENT_CAPABILITIES,
  normalizeEquipmentId,
  getAvailableCapabilities,
  hasCapability,
  equipmentProvidingCapability
};
