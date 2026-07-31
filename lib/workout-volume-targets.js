// Deterministic, non-AI weekly hard-set target ranges per muscle group.
//
// These are the "Recommended weekly range" values shown next to each
// muscle's actual credited volume in the Weekly Muscle Volume summary. They
// are NOT a universally perfect or medically exact optimum — they're a
// deterministic starting-point range derived from the same evidence-based
// hypertrophy guidance already embedded in the workout-generation prompt in
// server.js ("generally provide about 6-12 sets per major muscle group for
// beginners/intermediates and 8-16 for advanced users"). Nothing here reads
// an AI-generated number; every range is computed from the user's own
// canonical profile fields.
//
// Adjustment axes, in the order they're applied:
//   1. BASE_RANGES        — per-muscle baseline for an intermediate,
//                            hypertrophy-focused athlete (the modal case).
//   2. experience          — beginners get a narrower, lower-ceiling range
//                            (recovery capacity is the limiter); advanced
//                            athletes get a raised ceiling only, not a
//                            raised floor (more volume tolerance, not a
//                            higher minimum requirement).
//   3. priority/goal profile — see derivePriorityFromGoal() in
//                            lib/workout-priority.js, which is already the
//                            canonical goal->profile mapping used elsewhere
//                            (hypertrophy/strength/skills/generalFitness).
//                            Strength and skills work displaces hypertrophy
//                            volume by design, so their ranges are scaled
//                            down rather than treated as a hypertrophy
//                            program that merely under-delivered.
//   4. daysPerWeek          — BOTH ends scale down for low training
//                            frequency: spreading the textbook weekly set
//                            count across only 1-2 sessions usually isn't
//                            deliverable within a sane per-session duration
//                            (or would require training every muscle in
//                            every single session), so low-frequency
//                            programs get a genuinely lower floor, not just
//                            a capped ceiling -- otherwise a 1-2 day/week
//                            program could never satisfy every required
//                            muscle's minimum no matter how it's repaired.
//
// Priority-muscle treatment: this codebase has no existing canonical field
// naming specific priority muscle groups (only a whole-program goal/priority
// profile — see lib/workout-priority.js). Per-muscle prioritization is
// therefore intentionally NOT implemented here rather than invented; add it
// only if/when such a field is added to the request/profile schema.

const BASE_RANGES = Object.freeze({
  chest: [10, 20],
  back: [10, 20],
  quads: [8, 18],
  hamstrings: [6, 14],
  glutes: [6, 14],
  delts: [8, 18],
  rear_delts: [6, 12],
  biceps: [6, 14],
  triceps: [6, 14],
  calves: [6, 14],
  core: [4, 12],
  traps: [4, 10]
});

// { min, max } multipliers. max is allowed to move independently of min:
// experience/goal typically raises or caps the ceiling without changing the
// floor needed for a minimum effective dose.
const EXPERIENCE_MULTIPLIERS = Object.freeze({
  beginner: { min: 0.7, max: 0.75 },
  intermediate: { min: 1, max: 1 },
  advanced: { min: 1, max: 1.3 }
});

const GOAL_PROFILE_MULTIPLIERS = Object.freeze({
  hypertrophy: { min: 1, max: 1 },
  // Strength training favors intensity/specificity over volume.
  strength: { min: 0.6, max: 0.75 },
  // Skill practice (e.g. calisthenics skill work) displaces hypertrophy
  // volume rather than adding to it.
  skills: { min: 0.5, max: 0.7 },
  // Lowercase key: profile.priority is matched case-insensitively (see
  // targetRangeForMuscle/classifyMuscleRequirement, which both lowercase
  // before comparing) -- caller-supplied priority strings aren't guaranteed
  // to match derivePriorityFromGoal()'s exact camelCase output verbatim
  // (e.g. a request body sending "Skills" or "GeneralFitness").
  generalfitness: { min: 0.7, max: 0.85 }
});

// { min, max } multipliers keyed by training frequency. Both ends scale down
// for low-frequency programs -- not just the ceiling. A 1-2 day/week program
// genuinely cannot deliver the same per-muscle set count as a 4-6 day split
// without either cramming an unrealistic number of sets into one or two
// sessions (blowing the session-duration budget) or training every muscle
// group in every single session. Only capping the max and leaving the
// textbook min in place made low-frequency programs structurally unable to
// ever satisfy every required muscle -- min needed to move too.
function daysPerWeekMultiplier(daysPerWeek) {
  const days = Number(daysPerWeek) || 3;
  if (days <= 2) return { min: 0.55, max: 0.75 };
  if (days === 3) return { min: 0.8, max: 0.9 };
  return { min: 1, max: 1 }; // 4+ days/week can realistically deliver the full textbook range.
}

// targetRangeForMuscle(muscle, { experience, priority, daysPerWeek })
//   muscle: a lowercase setCredits key (see lib/workout-setcredits-map.js),
//           e.g. "chest", "rear_delts".
//   profile.experience: "beginner" | "intermediate" | "advanced"
//   profile.priority: the goal-profile string from
//           derivePriorityFromGoal() — "hypertrophy" | "strength" |
//           "skills" | "generalFitness".
//   profile.daysPerWeek: number
// Returns { min, max } (both non-negative integers, min <= max), or null if
// `muscle` isn't a recognized muscle group.
function targetRangeForMuscle(muscle, profile = {}) {
  const key = String(muscle || "").trim().toLowerCase();
  const base = BASE_RANGES[key];
  if (!base) return null;

  const experience = EXPERIENCE_MULTIPLIERS[String(profile.experience || "intermediate").trim().toLowerCase()]
    || EXPERIENCE_MULTIPLIERS.intermediate;
  const goalProfile = GOAL_PROFILE_MULTIPLIERS[String(profile.priority || "hypertrophy").trim().toLowerCase()]
    || GOAL_PROFILE_MULTIPLIERS.hypertrophy;
  const daysMultiplier = daysPerWeekMultiplier(profile.daysPerWeek);

  const minMultiplier = experience.min * goalProfile.min * daysMultiplier.min;
  const maxMultiplier = experience.max * goalProfile.max * daysMultiplier.max;

  const min = Math.max(2, Math.round(base[0] * minMultiplier));
  let max = Math.round(base[1] * maxMultiplier);
  // Keep the range sane (non-inverted) even under heavy compression from
  // stacked multipliers (e.g. beginner + skills + 2 days/week).
  if (max < min) max = min + 2;

  return { min, max };
}

// allTargetRanges(profile) -> { [muscle]: {min,max}, ... } for every known
// muscle group. Convenience for building the full weekly summary at once.
function allTargetRanges(profile = {}) {
  const ranges = {};
  for (const muscle of Object.keys(BASE_RANGES)) {
    ranges[muscle] = targetRangeForMuscle(muscle, profile);
  }
  return ranges;
}

// volumeStatus(actualSets, range) -> "below" | "in-range" | "above"
function volumeStatus(actualSets, range) {
  if (!range) return "unknown";
  const sets = Number(actualSets) || 0;
  if (sets < range.min) return "below";
  if (sets > range.max) return "above";
  return "in-range";
}

// Required-vs-secondary-vs-optional classification: not every one of the 12
// displayed muscles should be able to block a plan. The 10 REQUIRED_MUSCLES
// are the major groups any general hypertrophy/strength Gym or Hybrid
// program is expected to train directly. The 2 SECONDARY_MUSCLES (rear
// delts, traps) have real but comparatively sparse dedicated catalog
// coverage even after adding rowing/pulling secondary credits (see
// lib/workout-exercise-catalog.js) -- a program can be a perfectly good
// hypertrophy plan without a dedicated rear-delt or trap isolation
// exercise, so these are shown for visibility but never gate a successful
// response. For a "skills"-priority (Calisthenics skill work) profile,
// standard hypertrophy volume targets don't meaningfully apply to any
// muscle, so nothing is required there either.
const REQUIRED_MUSCLES = new Set([
  "chest", "back", "quads", "hamstrings", "glutes",
  "delts", "biceps", "triceps", "core", "calves"
]);
const SECONDARY_MUSCLES = new Set(["rear_delts", "traps"]);

// Lazily required so a plain `node --check` / early load of this file never
// needs the full exercise catalog, and so there's no risk of a require-order
// cycle (workout-exercise-catalog.js and workout-validator.js do not, and
// must never, require this file back).
let catalogModule = null;
let validatorModule = null;
function loadCatalogModule() {
  if (!catalogModule) catalogModule = require("./workout-exercise-catalog");
  return catalogModule;
}
function loadNormalizeEquipment() {
  if (!validatorModule) validatorModule = require("./workout-validator");
  return validatorModule.normalizeEquipment;
}

// True if at least one enabled public catalog exercise credits `muscle`
// (any credit, not just primary) using equipment inside `allowedEquipmentSet`.
// Used to downgrade a muscle out of REQUIRED_MUSCLES when the user's actual
// equipment selection has no compatible exercise for it at all -- e.g. this
// catalog has zero bodyweight-only hamstrings or calves exercises, so a
// Bodyweight-only selection can never be expected to hit a hypertrophy
// minimum for either, no matter how the program is repaired.
function muscleHasEquipmentCompatibleExercise(muscle, allowedEquipmentSet) {
  const { WORKOUT_EXERCISE_CATALOG, isPublicExerciseEnabled } = loadCatalogModule();
  const normalizeEquipment = loadNormalizeEquipment();
  for (const [exerciseId, entry] of Object.entries(WORKOUT_EXERCISE_CATALOG)) {
    if (!entry.setCredits || !entry.setCredits[muscle]) continue;
    if (!isPublicExerciseEnabled(exerciseId)) continue;
    if (allowedEquipmentSet.has(normalizeEquipment(entry.equipment))) return true;
  }
  return false;
}

// classifyMuscleRequirement(muscle, profile) -> "required" | "secondary" | "optional"
// profile.equipment, when provided, is expected to be the FINAL canonical
// allowed equipment array (see lib/workout-equipment-policy.js's
// deriveAllowedEquipment().allowed) -- the same array passed to repair and
// validation, so this classification can never drift from what the program
// was actually allowed to contain.
function classifyMuscleRequirement(muscle, profile = {}) {
  const key = String(muscle || "").trim().toLowerCase();
  if (String(profile.priority || "").trim().toLowerCase() === "skills") return "optional";
  if (SECONDARY_MUSCLES.has(key)) return "secondary";
  if (!REQUIRED_MUSCLES.has(key)) return "optional";

  if (Array.isArray(profile.equipment) && profile.equipment.length) {
    const allowedEquipmentSet = new Set(profile.equipment.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean));
    if (!muscleHasEquipmentCompatibleExercise(key, allowedEquipmentSet)) return "secondary";
  }

  return "required";
}

// requiredMusclesOutOfRange(perMuscle, profile) -> [{ muscle, status, total, range }, ...]
// The single check used both by server.js's pre-response volumePassed gate
// and by lib/workout-repair.js's repair loop: which REQUIRED muscles (never
// secondary/optional -- see classifyMuscleRequirement) are below or above
// their target range right now. An empty array means every required muscle
// is in range (or mapping coverage made the number moot -- callers should
// check mappingCoveragePercent/unknownExercises separately).
function requiredMusclesOutOfRange(perMuscle, profile = {}) {
  const out = [];
  for (const muscle of Object.keys(BASE_RANGES)) {
    if (classifyMuscleRequirement(muscle, profile) !== "required") continue;
    const range = targetRangeForMuscle(muscle, profile);
    const total = perMuscle?.[muscle]?.total || 0;
    const status = volumeStatus(total, range);
    if (status === "below" || status === "above") {
      out.push({ muscle, status, total, range });
    }
  }
  return out;
}

module.exports = {
  BASE_RANGES,
  REQUIRED_MUSCLES,
  SECONDARY_MUSCLES,
  classifyMuscleRequirement,
  requiredMusclesOutOfRange,
  targetRangeForMuscle,
  allTargetRanges,
  volumeStatus
};
