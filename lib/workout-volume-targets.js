// Deterministic, non-AI weekly hard-set target policy per muscle group.
//
// PRODUCT POLICY, NOT MEDICAL FACT: these are deterministic starting-point
// defaults derived from commonly cited hypertrophy training-volume guidance
// (roughly "10-20 weekly hard sets per major muscle group for most trained
// lifters, entering diminishing returns beyond that for a natural recovery
// budget"). They are not a universal biological ceiling and not personalized
// medical advice -- they exist so the product can (a) never gate a plan on
// an ungrounded number and (b) never label a bare-minimum plan as equally
// good as a well-targeted one. A future explicit high-volume/specialization
// mode may deliberately exceed hardMaximum; that is out of scope here.
//
// THREE DISTINCT VALUES per muscle, not one wide range:
//   - minimumEffective : the floor below which a set is not doing
//                         meaningfully more than nothing for that muscle
//                         this week. This is the HARD GATE floor.
//   - preferredRange    : {min,max} — the zone a well-targeted plan should
//                         land in for this profile. Missing this is valid
//                         (never blocks generation) but is NOT "optimal".
//                         Two tiers exist -- preferredGeneral (default) and
//                         preferredAdvanced (used when profile.experience is
//                         "advanced" AND schedule/recovery assumptions
//                         permit it, i.e. daysPerWeek >= 4) -- because
//                         advanced training tolerance is a *preference*
//                         shift, not a ceiling shift (see below).
//   - hardMaximum       : the HARD GATE ceiling. Capped at the muscle's
//                         baseline (see MUSCLE_POLICY) regardless of
//                         experience -- being advanced increases *training
//                         tolerance and preferred target*, it does not
//                         relicense a higher biological ceiling by default.
//                         This is the fix for the reported "26 weekly sets
//                         for chest" bug: the old code multiplied a 20-set
//                         base maximum by an advanced-experience 1.3x
//                         ceiling multiplier (20 * 1.3 = 26). Advanced
//                         experience no longer multiplies the ceiling at
//                         all; it only selects the higher preferredAdvanced
//                         zone within the SAME capped ceiling.
//
// Counting model: every number here is compared against
// lib/workout-volume.js's calculateWeeklyVolume() total, which is
// direct-credit sets (credit === 1.0, e.g. bench press -> chest) PLUS
// fractional/indirect-credit sets (credit < 1.0, e.g. bench press -> 0.5
// triceps) for that muscle, summed across the whole week. See
// lib/workout-setcredits-map.js for the authoritative per-exercise credit
// table and its own header comment for the indirect-credit policy
// (compound presses/rows are credited fractionally toward their secondary
// movers, never double-counted as a second full direct set).
//
// Adjustment axes, in the order they're applied:
//   1. MUSCLE_POLICY       — per-muscle baseline tier for an intermediate,
//                            hypertrophy-focused athlete training >=4
//                            days/week (the "full textbook range" case).
//   2. experience           — beginners get a narrower, lower ceiling AND
//                            floor (recovery capacity is the limiter).
//                            Advanced athletes get NEITHER floor nor
//                            ceiling raised on the hard gate -- see above.
//                            What advanced DOES change: which preferred
//                            tier (preferredGeneral vs preferredAdvanced)
//                            the quality-optimization pass targets.
//   3. priority/goal profile — see derivePriorityFromGoal() in
//                            lib/workout-priority.js. Strength and skills
//                            work displaces hypertrophy volume by design,
//                            so their ranges (floor, ceiling, AND preferred
//                            zone) are scaled down.
//   4. daysPerWeek          — BOTH ends scale down for low training
//                            frequency: spreading the textbook weekly set
//                            count across only 1-2 sessions usually isn't
//                            deliverable within a sane per-session duration.
//                            The preferredAdvanced tier additionally
//                            requires daysPerWeek >= 4 -- a 2-day/week
//                            advanced profile is schedule-limited, not
//                            recovery-limited, so it targets
//                            preferredGeneral instead.
//
// Priority-muscle treatment: this codebase has no existing canonical field
// naming specific priority muscle groups (only a whole-program goal/priority
// profile — see lib/workout-priority.js). Per-muscle prioritization is
// therefore intentionally NOT implemented here rather than invented; add it
// only if/when such a field is added to the request/profile schema.

// Per-muscle baseline tiers (intermediate, hypertrophy, >=4 days/week).
// [minimumEffective, preferredGeneral min, preferredGeneral max,
//  preferredAdvanced min, preferredAdvanced max, hardMaximum]
//
// Tiering rationale:
//   MAJOR           chest, back        — largest muscle mass, most catalog
//                                         exercise variety, most direct-set
//                                         capacity per session.
//   UPPER_MED       quads, delts       — large but recover faster / are hit
//                                         indirectly more often than chest/back.
//   LOWER_MED       hamstrings, glutes — meaningful indirect credit from
//                                         compound quad/hip-hinge work.
//   SMALL_INDIRECT  biceps, triceps,   — substantial fractional credit from
//                   calves               pressing/pulling/leg compounds
//                                         already in the program; direct
//                                         isolation work only needs to close
//                                         the remaining gap, not supply the
//                                         whole target from scratch.
//   CORE            core               — trained incidentally by most
//                                         compound work; lowest dedicated
//                                         floor of the required muscles.
//   SECONDARY       rear_delts, traps  — real numbers, shown for visibility,
//                                         never gate a response (see
//                                         SECONDARY_MUSCLES below). Kept
//                                         deliberately low so the repair
//                                         pass never tries to force a
//                                         dedicated isolation exercise onto
//                                         a plan that doesn't need one.
const MUSCLE_POLICY = Object.freeze({
  chest: { minimumEffective: 9, preferredGeneral: [12, 16], preferredAdvanced: [14, 18], hardMaximum: 20 },
  back: { minimumEffective: 9, preferredGeneral: [12, 16], preferredAdvanced: [14, 18], hardMaximum: 20 },
  quads: { minimumEffective: 8, preferredGeneral: [11, 14], preferredAdvanced: [12, 16], hardMaximum: 18 },
  delts: { minimumEffective: 8, preferredGeneral: [11, 14], preferredAdvanced: [12, 16], hardMaximum: 18 },
  hamstrings: { minimumEffective: 6, preferredGeneral: [8, 11], preferredAdvanced: [9, 12], hardMaximum: 14 },
  glutes: { minimumEffective: 6, preferredGeneral: [8, 11], preferredAdvanced: [9, 12], hardMaximum: 14 },
  // hardMaximum is 18, not 14: biceps/triceps pick up substantial secondary
  // credit from every press/pull/OHP-family compound already in the
  // program (see lib/workout-setcredits-map.js), which stacks with even a
  // modest amount of dedicated isolation work -- and the Dumbbell+Machine
  // catalog has only ONE direct triceps exercise, so a realistic advanced
  // 4-day split that includes it twice a week plus 3-4 pressing compounds
  // can legitimately land in the 14-16.5 total-credited-sets range with no
  // unnecessary volume left to trim. A 14-set ceiling made that an
  // unrepairable false failure (nothing to cut without sacrificing a
  // compound movement or the only direct triceps option available). 18
  // keeps real programs inside the ceiling while staying under the 20-set
  // default cap.
  biceps: { minimumEffective: 6, preferredGeneral: [8, 10], preferredAdvanced: [8, 11], hardMaximum: 18 },
  triceps: { minimumEffective: 6, preferredGeneral: [8, 10], preferredAdvanced: [8, 11], hardMaximum: 18 },
  calves: { minimumEffective: 6, preferredGeneral: [8, 10], preferredAdvanced: [8, 11], hardMaximum: 18 },
  core: { minimumEffective: 4, preferredGeneral: [6, 9], preferredAdvanced: [6, 10], hardMaximum: 12 },
  rear_delts: { minimumEffective: 3, preferredGeneral: [4, 7], preferredAdvanced: [4, 8], hardMaximum: 12 },
  traps: { minimumEffective: 2, preferredGeneral: [3, 6], preferredAdvanced: [3, 7], hardMaximum: 10 }
});

// Back-compat: some callers only need the set of known muscle keys plus a
// baseline [min,max] pair (e.g. iterating "every muscle group"). Derived
// from MUSCLE_POLICY rather than hand-duplicated so the two can never drift.
const BASE_RANGES = Object.freeze(
  Object.fromEntries(
    Object.entries(MUSCLE_POLICY).map(([muscle, policy]) => [muscle, [policy.minimumEffective, policy.hardMaximum]])
  )
);

// { min, max } multipliers applied to minimumEffective/hardMaximum. Advanced
// no longer raises max: see the header comment above for why (this is the
// fix for the 20 -> 26 chest ceiling bug). Beginners still get a lower floor
// AND ceiling -- recovery capacity is the actual limiter there, not a
// preference.
const EXPERIENCE_MULTIPLIERS = Object.freeze({
  beginner: { min: 0.7, max: 0.8 },
  intermediate: { min: 1, max: 1 },
  advanced: { min: 1, max: 1 }
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

function resolveMultipliers(profile) {
  const experience = EXPERIENCE_MULTIPLIERS[String(profile.experience || "intermediate").trim().toLowerCase()]
    || EXPERIENCE_MULTIPLIERS.intermediate;
  const goalProfile = GOAL_PROFILE_MULTIPLIERS[String(profile.priority || "hypertrophy").trim().toLowerCase()]
    || GOAL_PROFILE_MULTIPLIERS.hypertrophy;
  const daysMultiplier = daysPerWeekMultiplier(profile.daysPerWeek);
  return {
    min: experience.min * goalProfile.min * daysMultiplier.min,
    max: experience.max * goalProfile.max * daysMultiplier.max
  };
}

// targetRangeForMuscle(muscle, { experience, priority, daysPerWeek })
//   muscle: a lowercase setCredits key (see lib/workout-setcredits-map.js),
//           e.g. "chest", "rear_delts".
//   profile.experience: "beginner" | "intermediate" | "advanced"
//   profile.priority: the goal-profile string from
//           derivePriorityFromGoal() — "hypertrophy" | "strength" |
//           "skills" | "generalFitness".
//   profile.daysPerWeek: number
// Returns { min, max } (both non-negative integers, min <= max) — the HARD
// GATE range (minimumEffective..hardMaximum), or null if `muscle` isn't a
// recognized muscle group. For the preferred (quality) zone, see
// preferredRangeForMuscle / volumePolicyForMuscle below.
function targetRangeForMuscle(muscle, profile = {}) {
  const key = String(muscle || "").trim().toLowerCase();
  const policy = MUSCLE_POLICY[key];
  if (!policy) return null;

  const mult = resolveMultipliers(profile);
  const min = Math.max(2, Math.round(policy.minimumEffective * mult.min));
  let max = Math.round(policy.hardMaximum * mult.max);
  // Keep the range sane (non-inverted) even under heavy compression from
  // stacked multipliers (e.g. beginner + skills + 2 days/week).
  if (max < min) max = min + 2;

  return { min, max };
}

// preferredRangeForMuscle(muscle, profile) -> { min, max } | null
// The zone a well-targeted plan should land in -- always clamped inside the
// muscle's hard-gate range for this same profile, so a "preferred" number
// can never fall outside what's actually allowed to ship. Selects the
// preferredAdvanced tier only when the profile is both advanced AND has the
// schedule (>=4 days/week) to plausibly deliver it; otherwise preferredGeneral.
function preferredRangeForMuscle(muscle, profile = {}) {
  const key = String(muscle || "").trim().toLowerCase();
  const policy = MUSCLE_POLICY[key];
  if (!policy) return null;

  const hardRange = targetRangeForMuscle(key, profile);
  const isAdvanced = String(profile.experience || "").trim().toLowerCase() === "advanced";
  const hasScheduleForAdvancedTier = (Number(profile.daysPerWeek) || 0) >= 4;
  const tier = isAdvanced && hasScheduleForAdvancedTier ? policy.preferredAdvanced : policy.preferredGeneral;

  const mult = resolveMultipliers(profile);
  let min = Math.round(tier[0] * mult.max);
  let max = Math.round(tier[1] * mult.max);
  // Clamp inside the hard gate range -- a preferred zone that fell outside
  // [minimumEffective, hardMaximum] for this same profile would be
  // self-contradictory (it would ask the quality pass to aim somewhere the
  // hard gate would then reject).
  min = Math.min(Math.max(min, hardRange.min), hardRange.max);
  max = Math.min(Math.max(max, min), hardRange.max);

  return { min, max };
}

// volumePolicyForMuscle(muscle, profile) -> the full three-value policy for
// this muscle/profile, or null. This is what the Weekly Muscle Volume UI and
// the quality-optimization repair pass both read.
function volumePolicyForMuscle(muscle, profile = {}) {
  const hardRange = targetRangeForMuscle(muscle, profile);
  if (!hardRange) return null;
  const preferred = preferredRangeForMuscle(muscle, profile);
  return {
    minimumEffective: hardRange.min,
    preferredMin: preferred.min,
    preferredMax: preferred.max,
    hardMaximum: hardRange.max
  };
}

// allTargetRanges(profile) -> { [muscle]: {min,max}, ... } for every known
// muscle group (hard-gate ranges). Convenience for building the full weekly
// summary at once.
function allTargetRanges(profile = {}) {
  const ranges = {};
  for (const muscle of Object.keys(MUSCLE_POLICY)) {
    ranges[muscle] = targetRangeForMuscle(muscle, profile);
  }
  return ranges;
}

// allVolumePolicies(profile) -> { [muscle]: volumePolicyForMuscle result }
function allVolumePolicies(profile = {}) {
  const policies = {};
  for (const muscle of Object.keys(MUSCLE_POLICY)) {
    policies[muscle] = volumePolicyForMuscle(muscle, profile);
  }
  return policies;
}

// volumeStatus(actualSets, range) -> "below" | "in-range" | "above"
// Hard-gate status only (used by requiredMusclesOutOfRange). For the
// UI-facing five-state status, see detailedVolumeStatus.
function volumeStatus(actualSets, range) {
  if (!range) return "unknown";
  const sets = Number(actualSets) || 0;
  if (sets < range.min) return "below";
  if (sets > range.max) return "above";
  return "in-range";
}

// detailedVolumeStatus(actualSets, policy) -> one of:
//   "below-minimum" | "valid-below-preferred" | "in-preferred-zone" |
//   "valid-above-preferred" | "above-maximum" | "unknown"
// A required muscle sitting at its bare minimum (e.g. chest at 10/10) is
// technically valid but should never read the same as a well-targeted plan
// (e.g. chest at 15, inside the preferred zone) -- this is the fix for the
// reported "the plan sits at the minimum but still looks fully optimized"
// complaint. Both "below-minimum" and "above-maximum" mean the hard gate
// failed; a shipped response should never actually carry those statuses for
// a required muscle (see requiredMusclesOutOfRange), but the status is
// still computed honestly here for diagnostics/quality-scoring use.
function detailedVolumeStatus(actualSets, policy) {
  if (!policy) return "unknown";
  const sets = Number(actualSets) || 0;
  if (sets < policy.minimumEffective) return "below-minimum";
  if (sets > policy.hardMaximum) return "above-maximum";
  if (sets < policy.preferredMin) return "valid-below-preferred";
  if (sets > policy.preferredMax) return "valid-above-preferred";
  return "in-preferred-zone";
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
  const focusMode = String(profile.muscleFocusMode || "balanced").trim().toLowerCase();
  const selectedMuscles = new Set(
    (Array.isArray(profile.selectedMuscles) ? profile.selectedMuscles : [])
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean)
  );

  // Focus semantics are deliberately expressed through the same canonical
  // requirement classifier consumed by repair, validation, quality scoring,
  // and the final API gate. This prevents selected_only from being enforced
  // in one layer but silently ignored by another.
  if (focusMode === "selected_only") {
    return selectedMuscles.has(key) && MUSCLE_POLICY[key] ? "required" : "optional";
  }
  if (focusMode === "prioritize" && selectedMuscles.has(key) && MUSCLE_POLICY[key]) {
    return "required";
  }
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
// their HARD GATE range right now. An empty array means every required
// muscle is inside [minimumEffective, hardMaximum] (or mapping coverage made
// the number moot -- callers should check mappingCoveragePercent/
// unknownExercises separately). This never uses the preferred zone -- being
// below preferred is valid, not a gate failure (see the quality score for
// that signal instead).
function requiredMusclesOutOfRange(perMuscle, profile = {}) {
  const out = [];
  for (const muscle of Object.keys(MUSCLE_POLICY)) {
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

// muscleQualityScore(actualSets, policy) -> 0-100 | null
// A single required muscle's "how well-targeted is this" score, NOT a
// pass/fail gate (see requiredMusclesOutOfRange for that). 100 means inside
// the preferred zone. Outside the preferred zone but still inside the hard
// gate range, the score falls off linearly toward 40 at the gate edge --
// still a valid plan, just not a well-targeted one. Outside the hard gate
// range entirely scores 0 (a shipped response should never actually carry
// this — the hard gate rejects it first — but the score is defined
// consistently for diagnostics/testing).
function muscleQualityScore(actualSets, policy) {
  if (!policy) return null;
  const sets = Number(actualSets) || 0;
  if (sets < policy.minimumEffective || sets > policy.hardMaximum) return 0;
  if (sets >= policy.preferredMin && sets <= policy.preferredMax) return 100;
  if (sets < policy.preferredMin) {
    const span = policy.preferredMin - policy.minimumEffective;
    if (span <= 0) return 100;
    return Math.round(40 + 60 * ((sets - policy.minimumEffective) / span));
  }
  const span = policy.hardMaximum - policy.preferredMax;
  if (span <= 0) return 100;
  return Math.round(40 + 60 * ((policy.hardMaximum - sets) / span));
}

// calculateProgramQualityScore(perMuscle, profile) -> { score, perMuscle }
// score: 0-100 average of every REQUIRED muscle's muscleQualityScore, or
// null if there are no required muscles for this profile (e.g. a
// skills-priority program). This is a QUALITY signal for observability and
// testing -- see section 3 of the engine-quality spec -- never a gate.
// Secondary/optional muscles are intentionally excluded: forcing a
// major-muscle-grade target onto rear delts/traps would contradict their
// documented lower-expectation policy (see SECONDARY_MUSCLES above).
function calculateProgramQualityScore(perMuscle, profile = {}) {
  const perMuscleScores = {};
  let total = 0;
  let count = 0;
  for (const muscle of Object.keys(MUSCLE_POLICY)) {
    if (classifyMuscleRequirement(muscle, profile) !== "required") continue;
    const policy = volumePolicyForMuscle(muscle, profile);
    const actual = perMuscle?.[muscle]?.total || 0;
    const score = muscleQualityScore(actual, policy);
    perMuscleScores[muscle] = score;
    if (typeof score === "number") {
      total += score;
      count += 1;
    }
  }
  return { score: count ? Math.round(total / count) : null, perMuscle: perMuscleScores };
}

module.exports = {
  MUSCLE_POLICY,
  BASE_RANGES,
  REQUIRED_MUSCLES,
  SECONDARY_MUSCLES,
  classifyMuscleRequirement,
  requiredMusclesOutOfRange,
  targetRangeForMuscle,
  preferredRangeForMuscle,
  volumePolicyForMuscle,
  allTargetRanges,
  allVolumePolicies,
  volumeStatus,
  detailedVolumeStatus,
  muscleQualityScore,
  calculateProgramQualityScore
};
