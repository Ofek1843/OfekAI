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
//   4. daysPerWeek          — the ceiling is capped for low training
//                            frequency: spreading a large weekly set count
//                            across only 2 sessions usually isn't
//                            deliverable within a sane per-session duration,
//                            so the upper bound is capped rather than
//                            flagging every low-frequency program as
//                            "under-target".
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
  generalFitness: { min: 0.7, max: 0.85 }
});

function daysPerWeekCapMultiplier(daysPerWeek) {
  const days = Number(daysPerWeek) || 3;
  if (days <= 2) return 0.75;
  if (days === 3) return 0.9;
  return 1; // 4+ days/week can realistically deliver the full range.
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
  const goalProfile = GOAL_PROFILE_MULTIPLIERS[String(profile.priority || "hypertrophy").trim()]
    || GOAL_PROFILE_MULTIPLIERS.hypertrophy;
  const daysMultiplier = daysPerWeekCapMultiplier(profile.daysPerWeek);

  const minMultiplier = experience.min * goalProfile.min;
  const maxMultiplier = experience.max * goalProfile.max * daysMultiplier;

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

module.exports = {
  BASE_RANGES,
  targetRangeForMuscle,
  allTargetRanges,
  volumeStatus
};
