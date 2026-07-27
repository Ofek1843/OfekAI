// Enhanced validation for complete workout programs.
//
// Rules:
// 1. exact-days: sessions.length === daysPerWeek
// 2. schedule-days: weeklyScheduleDays.length === daysPerWeek, every scheduled day
//    is a member of availableDayIndexes, and scheduled days are unique. Selecting
//    MORE available days than daysPerWeek is valid and produces no warning — we
//    only ever check the scheduled set against the available set, never against
//    the available set's total size.
// 3. equipment-strict: every exercise.equipment matches the selected set via
//    canonical exact matching (see normalizeEquipment) — no substring matching.
// 4. session-cap: estimated duration <= user duration + 10%
// 5. frequency-distribution: ≤8 hard sets per muscle per session when distributable
// 6. strength-rest: 1-6 rep work gets ≥180s rest (sets_reps prescriptionType only)
// 7. rep-suitability: hypertrophy 5-30 (sets_reps prescriptionType only)
// 8. rir-suitability: values in valid format (skipped when rirApplicable === false
//    or prescriptionType is continuous_conditioning/intervals)
// 9. duplicate-exercise: unique exerciseId per session
// 10. schema: required fields present and types valid, including exerciseId.
//     Which fields are required depends on prescriptionType (Phase 2) — see
//     getPrescriptionType()/PRESCRIPTION_TYPES. Every exercise still needs a
//     name and exerciseId regardless of type. An exercise with NO
//     prescriptionType is treated as "sets_reps" — byte-for-byte the same
//     strict requirements Phase 1 always enforced, so existing sets/reps
//     programs are completely unaffected by this rule.

const { estimateSessionDuration } = require("./workout-duration");

// Phase 2: prescription types. Not every exercise is a strength set —
// applying sets/reps/RIR/≥15s-rest rules to a timed hold, a conditioning
// circuit or a skill drill was the root cause of false 422s on cardio and
// skill work. Each type declares which fields are required/optional so a
// single schema rule (Rule 10) can apply the RIGHT requirements instead of
// one-size-fits-all.
const PRESCRIPTION_TYPES = {
  sets_reps: { requiresSets: true, requiresReps: true, minRestSeconds: 15, ripApplicableByDefault: true },
  timed_hold: { requiresSets: true, requiresDurationSeconds: true, minRestSeconds: 15, ripApplicableByDefault: true },
  skill_practice: { requiresSets: true, minRestSeconds: 15, ripApplicableByDefault: false },
  continuous_conditioning: { requiresDurationMinutes: true, minRestSeconds: 0, ripApplicableByDefault: false },
  intervals: { requiresRounds: true, requiresWorkSeconds: true, minRestSeconds: 0, ripApplicableByDefault: false }
};

function getPrescriptionType(exercise) {
  const type = exercise?.prescriptionType;
  return PRESCRIPTION_TYPES[type] ? type : "sets_reps";
}

function isRirApplicable(exercise) {
  if (exercise?.rirApplicable === false) return false;
  if (exercise?.rirApplicable === true) return true;
  return PRESCRIPTION_TYPES[getPrescriptionType(exercise)].ripApplicableByDefault;
}

// Canonical equipment vocabulary. Every alias below normalizes to one of
// these tokens so validation can use exact equality instead of substring
// matching (substring matching previously let equipment strings pass just
// because they *contained* a selected token, e.g. an unrelated multi-word
// description).
const CANONICAL_EQUIPMENT_ALIASES = {
  bodyweight: "bodyweight",
  "body weight": "bodyweight",
  pullupbar: "pullupbar",
  "pull up bar": "pullupbar",
  machine: "machine",
  machines: "machine",
  dumbbell: "dumbbell",
  dumbbells: "dumbbell",
  barbell: "barbell",
  barbells: "barbell",
  cable: "cable",
  cables: "cable",
  rings: "rings",
  "gymnastic rings": "rings"
};

// Normalizes any equipment string to a canonical token, or "" for
// empty/unrecognized input. Callers must treat "" as "must not silently
// pass" — it is never treated as equivalent to bodyweight.
const normalizeEquipment = (raw) => {
  const trimmed = String(raw || "").trim().toLowerCase();
  if (!trimmed) return "";

  if (CANONICAL_EQUIPMENT_ALIASES[trimmed]) return CANONICAL_EQUIPMENT_ALIASES[trimmed];

  const collapsed = trimmed.replace(/[\s-]+/g, " ").trim();
  if (CANONICAL_EQUIPMENT_ALIASES[collapsed]) return CANONICAL_EQUIPMENT_ALIASES[collapsed];

  const noSpace = collapsed.replace(/\s+/g, "");
  if (CANONICAL_EQUIPMENT_ALIASES[noSpace]) return CANONICAL_EQUIPMENT_ALIASES[noSpace];

  // Deterministic fallback for equipment outside our known vocabulary
  // (e.g. "kettlebells"): strip a trailing simple plural "s" so the same
  // unmapped item still compares equal to its singular form, without
  // inventing a new canonical category for it.
  if (noSpace.endsWith("s") && noSpace.length > 1) {
    return noSpace.slice(0, -1);
  }
  return noSpace;
};

function validateWorkoutProgram(program, context = {}) {
  const {
    daysPerWeek = 0,
    sessionDuration = 60,
    equipment = [],
    availableDayIndexes = [],
    goalProfile = "hypertrophy"
  } = context;

  const errors = [];
  const warnings = [];

  // Rule 1: Exact days
  if (!Array.isArray(program?.sessions)) {
    errors.push("Program has no sessions array.");
    return { ok: false, errors, warnings };
  }

  if (program.sessions.length !== daysPerWeek) {
    errors.push(
      `Program contains ${program.sessions.length} sessions, but user requested ${daysPerWeek}.`
    );
  }

  // Rule 2: Schedule days — exact count, subset of available, unique.
  // Selecting more available days than daysPerWeek is valid: we never
  // compare the scheduled count against the size of the available set,
  // only against daysPerWeek and membership in the available set.
  if (Array.isArray(program.weeklyScheduleDays)) {
    const scheduledDays = program.weeklyScheduleDays.map((d) => Number(d));

    if (scheduledDays.length !== daysPerWeek) {
      errors.push(
        `Program schedules ${scheduledDays.length} days, but user requested ${daysPerWeek} training days.`
      );
    }

    const seenDays = new Set();
    for (const day of scheduledDays) {
      if (seenDays.has(day)) {
        errors.push(`Day ${day} is scheduled more than once in weeklyScheduleDays.`);
      }
      seenDays.add(day);
    }

    if (Array.isArray(availableDayIndexes) && availableDayIndexes.length > 0) {
      const available = new Set(availableDayIndexes.map((d) => Number(d)));
      for (const day of seenDays) {
        if (!available.has(day)) {
          errors.push(
            `Session scheduled for day ${day}, which is not in the user's available days.`
          );
        }
      }
    }
  }

  // Rule 3: Equipment strict (canonical exact matching)
  const selectedNorm = new Set(equipment.map(normalizeEquipment).filter(Boolean));

  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) {
      errors.push(`Session ${i + 1} has no exercises array.`);
      continue;
    }

    for (const exercise of session.exercises) {
      if (!exercise.exerciseId && !exercise.name) {
        errors.push(`Session ${i + 1}: unnamed exercise detected.`);
        continue;
      }

      const norm = normalizeEquipment(exercise.equipment);

      // An empty equipment string only avoids being a violation when it
      // resolves to bodyweight. It must never silently pass otherwise.
      if (norm === "bodyweight") continue;

      if (selectedNorm.size > 0 && norm !== "" && !selectedNorm.has(norm)) {
        errors.push(
          `${exercise.name || "Exercise"} (Session ${i + 1}) requires "${exercise.equipment}", which is not selected.`
        );
      } else if (selectedNorm.size > 0 && norm === "") {
        errors.push(
          `${exercise.name || "Exercise"} (Session ${i + 1}) has no recognizable equipment value.`
        );
      }
    }
  }

  // Rule 4: Session cap
  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    const estimate = estimateSessionDuration(session);
    const tolerance = Math.max(5, sessionDuration * 0.1); // At least 5 min tolerance

    if (estimate.estimatedMinutes > sessionDuration + tolerance) {
      errors.push(
        `Session ${i + 1} estimated at ${estimate.estimatedMinutes}min, exceeds ${sessionDuration}min limit by ${Math.round(estimate.estimatedMinutes - sessionDuration)}min.`
      );
    }
  }

  // Rule 5: Frequency distribution
  const musclePerSession = {};
  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    musclePerSession[i] = {};

    if (!Array.isArray(session?.exercises)) continue;

    for (const exercise of session.exercises) {
      // Simplified: only counts primary muscle (calculateWeeklyVolume
      // gives the full-accuracy, setCredits-weighted version).
      const primaryMuscle = String(exercise.muscleGroup || "general").toLowerCase();
      const sets = Number(exercise.sets) || 0;

      if (!musclePerSession[i][primaryMuscle]) {
        musclePerSession[i][primaryMuscle] = 0;
      }
      musclePerSession[i][primaryMuscle] += sets;
    }

    for (const [muscle, sets] of Object.entries(musclePerSession[i])) {
      if (sets > 8 && program.sessions.length >= 3) {
        warnings.push(
          `Session ${i + 1}: ${muscle} receives ${sets} hard sets; consider distributing.`
        );
      }
    }
  }

  // Rule 6: Strength rest (1-6 reps = main strength work). Only meaningful
  // for traditional sets/reps work — a timed hold or conditioning circuit
  // has no "reps" in this sense, so it's exempt rather than coincidentally
  // failing to match the regex.
  if (goalProfile === "strength") {
    for (let i = 0; i < program.sessions.length; i++) {
      const session = program.sessions[i];
      if (!Array.isArray(session?.exercises)) continue;

      for (const exercise of session.exercises) {
        if (getPrescriptionType(exercise) !== "sets_reps") continue;

        const reps = String(exercise.reps || "");
        const rest = Number(exercise.restSeconds) || 0;

        const isMainStrength =
          reps.match(/^[1-6]$/) || (reps.includes("-") && reps.split("-")[1] <= 6);

        if (isMainStrength && rest < 180) {
          errors.push(
            `${exercise.name || "Exercise"} (Session ${i + 1}): ${reps} reps requires ≥180s rest, has ${rest}s.`
          );
        }
      }
    }
  }

  // Rule 7: Rep suitability (hypertrophy focused) — sets_reps only, same
  // reasoning as Rule 6.
  if (goalProfile === "hypertrophy") {
    for (let i = 0; i < program.sessions.length; i++) {
      const session = program.sessions[i];
      if (!Array.isArray(session?.exercises)) continue;

      for (const exercise of session.exercises) {
        if (getPrescriptionType(exercise) !== "sets_reps") continue;

        const reps = String(exercise.reps || "");

        if (reps && !reps.includes("-")) {
          const single = Number(reps);
          if (single > 0 && (single < 5 || single > 30)) {
            warnings.push(
              `${exercise.name || "Exercise"} (Session ${i + 1}): ${reps} reps is outside typical hypertrophy range (5-30).`
            );
          }
        }
      }
    }
  }

  // Rule 8: RIR suitability. Skipped when RIR isn't applicable to this
  // exercise (conditioning/intervals by default, or any exercise explicitly
  // marked rirApplicable: false) — RIR describes proximity to failure on a
  // set, which is meaningless for continuous/interval conditioning work.
  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    for (const exercise of session.exercises) {
      if (!isRirApplicable(exercise)) continue;

      const rir = String(exercise.rir || "");
      if (rir && !/^[\d\-]+$/.test(rir)) {
        errors.push(
          `${exercise.name || "Exercise"} (Session ${i + 1}): RIR "${rir}" is not a valid number or range.`
        );
      }
    }
  }

  // Rule 9: Duplicate exercise in session
  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    const seen = new Set();
    for (const exercise of session.exercises) {
      const id = exercise.exerciseId || exercise.name || "unknown";
      if (seen.has(id)) {
        errors.push(`Session ${i + 1}: "${id}" appears more than once.`);
      }
      seen.add(id);
    }
  }

  // Rule 10: Schema validation. name and exerciseId are required for every
  // exercise regardless of type. Which OTHER fields are required, and what
  // the minimum rest is, depends on prescriptionType — see
  // PRESCRIPTION_TYPES. An exercise with no prescriptionType is "sets_reps",
  // reproducing Phase 1's original unconditional requirements exactly.
  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (typeof session.name !== "string") {
      errors.push(`Session ${i + 1}: name must be a string.`);
    }
    if (!Array.isArray(session.exercises) || session.exercises.length === 0) {
      errors.push(`Session ${i + 1}: must have at least one exercise.`);
    }

    for (const exercise of session.exercises || []) {
      if (typeof exercise.name !== "string" || !exercise.name.trim()) {
        errors.push(`Session ${i + 1}: exercise must have a non-empty name.`);
      }
      if (typeof exercise.exerciseId !== "string" || !exercise.exerciseId.trim()) {
        errors.push(`Session ${i + 1}: exercise "${exercise.name || "unknown"}" is missing exerciseId.`);
      }

      const type = getPrescriptionType(exercise);
      const spec = PRESCRIPTION_TYPES[type];

      if (spec.requiresSets && (typeof exercise.sets !== "number" || exercise.sets < 1 || exercise.sets > 20)) {
        errors.push(`Session ${i + 1}: sets must be 1-20.`);
      }
      if (spec.requiresDurationSeconds && (typeof exercise.durationSeconds !== "number" || exercise.durationSeconds <= 0)) {
        errors.push(`Session ${i + 1}: exercise "${exercise.name}" must have a positive durationSeconds.`);
      }
      if (spec.requiresDurationMinutes && (typeof exercise.durationMinutes !== "number" || exercise.durationMinutes <= 0)) {
        errors.push(`Session ${i + 1}: exercise "${exercise.name}" must have a positive durationMinutes.`);
      }
      if (spec.requiresRounds && (typeof exercise.rounds !== "number" || exercise.rounds < 1)) {
        errors.push(`Session ${i + 1}: exercise "${exercise.name}" must have at least 1 round.`);
      }
      if (spec.requiresWorkSeconds && (typeof exercise.workSeconds !== "number" || exercise.workSeconds <= 0)) {
        errors.push(`Session ${i + 1}: exercise "${exercise.name}" must have a positive workSeconds.`);
      }

      // restSeconds: always a number when present, but the floor depends on
      // type — continuous/interval work may legitimately be 0 (no rest
      // between work, e.g. a straight 10-minute circuit).
      if (typeof exercise.restSeconds !== "number" || exercise.restSeconds < spec.minRestSeconds) {
        errors.push(
          spec.minRestSeconds > 0
            ? `Session ${i + 1}: rest must be ≥${spec.minRestSeconds} seconds.`
            : `Session ${i + 1}: exercise "${exercise.name}" restSeconds must be a number ≥0.`
        );
      }
    }
  }

  const ok = errors.length === 0;
  return { ok, errors, warnings };
}

module.exports = {
  validateWorkoutProgram,
  normalizeEquipment,
  getPrescriptionType,
  isRirApplicable,
  PRESCRIPTION_TYPES
};
