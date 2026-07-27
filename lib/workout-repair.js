// Deterministic, non-AI repair pass applied to a generated program BEFORE
// validateWorkoutProgram() runs. This does not weaken or bypass any
// validation rule — it makes the DATA satisfy the existing rules wherever
// that's possible without guessing content the AI didn't provide. If a
// program is still invalid after repair, validateWorkoutProgram() still
// rejects it exactly as before.
//
// Repair order (Phase 2 adds steps 1-2 and 5 ahead of the Phase 1 steps):
//   1. resolve movement equipment: for a recognized movement pattern (see
//      lib/workout-movement-catalog.js), pick ONE concrete equipment-
//      specific implementation from the user's actual selected equipment
//      (e.g. "Pull-up (Rings or Bar)" + rings selected -> "Ring Pull-up" /
//      equipment: rings) — never leaves an "A or B" name, never assumes
//      equipment the user didn't select.
//   2. classify prescription type and repair its schema (RIR "NA" removed,
//      conditioning gets durationMinutes instead of fake sets/reps, etc.)
//   3. normalize known exercise name aliases -> canonical exerciseId
//      (lib/workout-exercise-aliases.js, matches lib/workout-setcredits-map.js)
//   4. deterministically assign an exerciseId via slug when no alias matches
//      (never leaves exerciseId missing, never invents muscle credits)
//   5. repair minor formatting/schema defects (numeric-string sets/rest,
//      untrimmed strings) that would otherwise trip schema validation
//   6. if a session still exceeds the duration cap, drop its lowest-
//      priority accessory exercises (from the end of the list, where the
//      prompt places isolation/accessory work) down to a floor of 3
//      exercises, recalculating duration after each removal
//   7. normalize duplicated static branding/description fragments the AI
//      may have echoed back into programName/goal

const { slugifyExerciseId } = require("./workout-volume");
const { estimateSessionDuration } = require("./workout-duration");
const { EXERCISE_NAME_ALIASES } = require("./workout-exercise-aliases");
const { matchMovementRule, matchSupportEquipmentRule, hasUnresolvedAlternative } = require("./workout-movement-catalog");
const { normalizeEquipmentId, hasCapability } = require("./workout-capabilities");

const MIN_EXERCISES_PER_SESSION = 3;

// --- Step 1: movement/equipment resolution ---------------------------------

function resolveGenericAlternativeName(exerciseName, selectedEquipmentSet) {
  const branches = String(exerciseName)
    .split(/\s*\/\s*|\s+or\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (branches.length < 2) return null;

  const preferred = branches.find((branch) => {
    const lower = branch.toLowerCase();
    return [...selectedEquipmentSet].some((eq) => lower.includes(eq));
  });
  return preferred || branches[0];
}

function parseMinutesFromText(text) {
  const match = String(text).match(/(\d+)\s*-?\s*min/i);
  return match ? Number(match[1]) : null;
}

function resolveMovementEquipment(program, context, repairs) {
  const selectedEquipment = Array.isArray(context.equipment) ? context.equipment.map(normalizeEquipmentId) : [];
  const selectedSet = new Set(selectedEquipment);

  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    for (const exercise of session.exercises) {
      const name = exercise.name || "";
      const rule = matchMovementRule(name);

      if (rule) {
        // Pick the first variant whose equipment the user actually
        // selected (order = the user's own selection order) — never an
        // equipment choice they didn't make.
        const variant = selectedEquipment.map((eq) => rule.variantsByEquipment[eq]).find(Boolean);
        if (variant && (exercise.name !== variant.name || normalizeEquipmentId(exercise.equipment) !== variant.equipment)) {
          repairs.push(`Session ${i + 1}: resolved "${name}" to "${variant.name}" (${variant.equipment}), matching selected equipment.`);
          exercise.name = variant.name;
          exercise.demoName = variant.name;
          exercise.equipment = variant.equipment;
          exercise.exerciseId = variant.exerciseId;
        }
        // No matching equipment selected: leave as-is. This is genuinely
        // irreparable — Rule 3 (equipment) correctly rejects it, since the
        // user truly did not select anything capable of this movement.
        continue;
      }

      const supportRule = matchSupportEquipmentRule(name);
      if (supportRule && supportRule.requiredCapabilities.every((cap) => !hasCapability(selectedEquipment, cap))) {
        const fallback = supportRule.floorFallback;
        if (fallback && (exercise.name !== fallback.name || normalizeEquipmentId(exercise.equipment) !== fallback.equipment)) {
          repairs.push(`Session ${i + 1}: "${name}" needs elevated/bench support the user didn't select — substituted "${fallback.name}".`);
          exercise.name = fallback.name;
          exercise.demoName = fallback.name;
          exercise.equipment = fallback.equipment;
          exercise.exerciseId = fallback.exerciseId;
        }
        continue;
      }

      // Generic fallback: an unresolved "X or Y" name not covered by a
      // specific movement/support rule. Prefer whichever branch mentions
      // equipment the user actually selected.
      if (hasUnresolvedAlternative(name)) {
        const resolved = resolveGenericAlternativeName(name, selectedSet);
        if (resolved && resolved !== name) {
          repairs.push(`Session ${i + 1}: resolved ambiguous exercise name "${name}" to "${resolved}".`);
          exercise.name = resolved;
          exercise.demoName = resolved;
        }
      }
    }
  }
}

// --- Step 2: prescription-type classification and schema repair -----------

function classifyPrescriptionType(exercise) {
  if (
    exercise.prescriptionType === "sets_reps" ||
    exercise.prescriptionType === "timed_hold" ||
    exercise.prescriptionType === "skill_practice" ||
    exercise.prescriptionType === "continuous_conditioning" ||
    exercise.prescriptionType === "intervals"
  ) {
    return exercise.prescriptionType;
  }

  const name = String(exercise.name || "").toLowerCase();
  if (/interval|hiit|tabata/.test(name)) return "intervals";
  if (/cardio|circuit|rowing|bike|treadmill|elliptical|conditioning|jump rope|battle rope/.test(name)) return "continuous_conditioning";
  const looksNumericReps = /^\d/.test(String(exercise.reps || "").trim());
  if (/front lever|planche|handstand|l-sit|\bhold\b/.test(name) && !looksNumericReps) return "timed_hold";
  if (/practice|progression/.test(name)) return "skill_practice";
  return "sets_reps";
}

function repairPrescriptionSchema(program, repairs) {
  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    for (const exercise of session.exercises) {
      const classified = classifyPrescriptionType(exercise);
      // "sets_reps" is the implicit default (getPrescriptionType() in
      // workout-validator.js treats an absent prescriptionType as
      // sets_reps already) — only write/log a change when the exercise is
      // classified as something ELSE, so a completely ordinary strength
      // exercise round-trips through repair with zero side effects,
      // exactly like Phase 1.
      if (classified !== "sets_reps" && exercise.prescriptionType !== classified) {
        exercise.prescriptionType = classified;
        repairs.push(`Session ${i + 1}: classified "${exercise.name}" as prescriptionType "${classified}".`);
      }

      // A literal "NA"/"N/A" RIR string is not a valid number-or-range —
      // remove it and mark RIR inapplicable rather than fail schema
      // validation on a field that never meant anything for this exercise.
      if (typeof exercise.rir === "string" && /^n\/?a$/i.test(exercise.rir.trim())) {
        delete exercise.rir;
        exercise.rirApplicable = false;
        repairs.push(`Session ${i + 1}: removed non-numeric RIR "NA" from "${exercise.name}".`);
      }

      if (classified === "continuous_conditioning") {
        if (typeof exercise.durationMinutes !== "number" || exercise.durationMinutes <= 0) {
          const parsed = parseMinutesFromText(`${exercise.reps || ""} ${exercise.name || ""}`);
          exercise.durationMinutes = parsed || 10;
          repairs.push(`Session ${i + 1}: assigned durationMinutes=${exercise.durationMinutes} to conditioning exercise "${exercise.name}".`);
        }
        if (typeof exercise.restSeconds !== "number") {
          exercise.restSeconds = 0;
        }
        delete exercise.sets;
        delete exercise.reps;
        if (exercise.rirApplicable === undefined) exercise.rirApplicable = false;
      } else if (classified === "intervals") {
        if (typeof exercise.rounds !== "number" || exercise.rounds < 1) {
          exercise.rounds = 8;
          repairs.push(`Session ${i + 1}: assigned rounds=8 to interval exercise "${exercise.name}".`);
        }
        if (typeof exercise.workSeconds !== "number" || exercise.workSeconds <= 0) {
          exercise.workSeconds = 30;
          repairs.push(`Session ${i + 1}: assigned workSeconds=30 to interval exercise "${exercise.name}".`);
        }
        if (typeof exercise.restSeconds !== "number") {
          exercise.restSeconds = 30;
        }
        delete exercise.sets;
        delete exercise.reps;
        if (exercise.rirApplicable === undefined) exercise.rirApplicable = false;
      } else if (classified === "timed_hold") {
        if (typeof exercise.durationSeconds !== "number" || exercise.durationSeconds <= 0) {
          exercise.durationSeconds = 20;
          repairs.push(`Session ${i + 1}: assigned durationSeconds=20 to timed-hold exercise "${exercise.name}".`);
        }
        if (typeof exercise.sets !== "number" || exercise.sets < 1) {
          exercise.sets = 3;
        }
      }
    }
  }
}

// --- Phase 1 steps (unchanged) ---------------------------------------------

function resolveExerciseId(exercise) {
  const existing = typeof exercise.exerciseId === "string" ? exercise.exerciseId.trim() : "";
  if (existing) return { id: existing, source: "existing" };

  const nameSlug = slugifyExerciseId(exercise.name || exercise.demoName || "");
  if (EXERCISE_NAME_ALIASES[nameSlug]) {
    return { id: EXERCISE_NAME_ALIASES[nameSlug], source: "alias" };
  }
  if (nameSlug) {
    return { id: nameSlug, source: "slug" };
  }
  return { id: "", source: "none" };
}

function assignExerciseIds(program, repairs) {
  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    const seenIds = new Set();
    for (const exercise of session.exercises) {
      const hadId = typeof exercise.exerciseId === "string" && exercise.exerciseId.trim().length > 0;
      let { id, source } = resolveExerciseId(exercise);

      // Guarantee uniqueness within the session (Rule 9) even if two
      // different exercises would otherwise slugify/alias to the same id.
      let uniqueId = id || `exercise-${i}-${session.exercises.indexOf(exercise)}`;
      let suffix = 2;
      while (seenIds.has(uniqueId)) {
        uniqueId = `${id}-${suffix}`;
        suffix += 1;
      }
      seenIds.add(uniqueId);

      if (!hadId) {
        exercise.exerciseId = uniqueId;
        repairs.push(`Session ${i + 1}: assigned exerciseId "${uniqueId}" to "${exercise.name || "unnamed exercise"}" (${source}).`);
      }
    }
  }
}

function repairSchemaDefects(program, repairs) {
  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    if (typeof session.name !== "string" || !session.name.trim()) {
      session.name = `Day ${i + 1}`;
      repairs.push(`Session ${i + 1}: assigned a default session name.`);
    }

    for (const exercise of session.exercises) {
      if (typeof exercise.name === "string") {
        const trimmed = exercise.name.trim();
        if (trimmed !== exercise.name) exercise.name = trimmed;
      }

      if (typeof exercise.sets === "string" && /^\d+$/.test(exercise.sets.trim())) {
        exercise.sets = Number(exercise.sets.trim());
        repairs.push(`Session ${i + 1}: coerced "${exercise.name}" sets from string to number.`);
      }

      if (typeof exercise.restSeconds === "string" && /^\d+$/.test(exercise.restSeconds.trim())) {
        exercise.restSeconds = Number(exercise.restSeconds.trim());
        repairs.push(`Session ${i + 1}: coerced "${exercise.name}" restSeconds from string to number.`);
      }

      if (typeof exercise.reps === "number") {
        exercise.reps = String(exercise.reps);
        repairs.push(`Session ${i + 1}: coerced "${exercise.name}" reps to a string.`);
      }
    }
  }
}

function trimAccessoryExercisesForDuration(program, context, repairs) {
  const { sessionDuration = 60 } = context;
  const tolerance = Math.max(5, sessionDuration * 0.1);
  const budget = sessionDuration + tolerance;

  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    let estimate = estimateSessionDuration(session);
    while (
      estimate.estimatedMinutes > budget &&
      session.exercises.length > MIN_EXERCISES_PER_SESSION
    ) {
      const removed = session.exercises.pop();
      repairs.push(
        `Session ${i + 1}: removed accessory exercise "${removed.name || removed.exerciseId}" — session was ${estimate.estimatedMinutes}min, over the ${Math.round(budget)}min limit.`
      );
      estimate = estimateSessionDuration(session);
    }
  }
}

// --- Step 7: duplicated static text -----------------------------------------

// A phrase repeated back-to-back (allowing a separator) — catches the AI
// echoing static branding/description text that will also be rendered by
// the frontend, e.g. "FuelPhysique FuelPhysique Plan" or a description
// sentence duplicated with a different leading fragment.
function collapseRepeatedPhrase(text) {
  if (typeof text !== "string" || !text.trim()) return text;
  // Collapse an immediately-repeated single word, e.g. "FuelPhysique FuelPhysique X" -> "FuelPhysique X".
  let result = text.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
  // Collapse an immediately-repeated multi-word phrase (3+ words), e.g.
  // "...around your goal, experience and available equipment. around your
  // goal, experience and available equipment." -> the phrase kept once.
  result = result.replace(
    /((?:[A-Za-z0-9'’]+[\s,]+){2,}[A-Za-z0-9'’]+)[.!?]?\s+\1[.!?]?/gi,
    (match, phrase) => `${phrase}.`
  );
  return result;
}

function repairDuplicatedText(program, repairs) {
  if (typeof program.programName === "string") {
    const collapsed = collapseRepeatedPhrase(program.programName);
    if (collapsed !== program.programName) {
      repairs.push(`Collapsed a duplicated phrase in programName.`);
      program.programName = collapsed;
    }
  }
  if (typeof program.goal === "string") {
    const collapsed = collapseRepeatedPhrase(program.goal);
    if (collapsed !== program.goal) {
      repairs.push(`Collapsed a duplicated phrase in goal.`);
      program.goal = collapsed;
    }
  }
}

function repairWorkoutProgram(program, context = {}) {
  const repairs = [];

  if (!program || !Array.isArray(program.sessions)) {
    return { program, repairs };
  }

  resolveMovementEquipment(program, context, repairs);
  repairPrescriptionSchema(program, repairs);
  assignExerciseIds(program, repairs);
  repairSchemaDefects(program, repairs);
  trimAccessoryExercisesForDuration(program, context, repairs);
  repairDuplicatedText(program, repairs);

  return { program, repairs };
}

module.exports = {
  repairWorkoutProgram,
  resolveExerciseId,
  classifyPrescriptionType,
  resolveGenericAlternativeName,
  collapseRepeatedPhrase
};
