// Deterministic, non-AI repair pass applied to a generated program BEFORE
// validateWorkoutProgram() runs. This does not weaken or bypass any
// validation rule — it makes the DATA satisfy the existing rules
// (required exerciseId, session-duration cap) wherever that's possible
// without guessing content the AI didn't provide. If a program is still
// invalid after repair, validateWorkoutProgram() still rejects it exactly
// as before.
//
// Repair order (each step only acts where the previous ones left a gap):
//   1. normalize known exercise name aliases -> canonical exerciseId
//      (lib/workout-exercise-aliases.js, matches lib/workout-setcredits-map.js)
//   2. deterministically assign an exerciseId via slug when no alias matches
//      (never leaves exerciseId missing, never invents muscle credits)
//   3. repair minor formatting/schema defects (numeric-string sets/rest,
//      untrimmed strings) that would otherwise trip schema validation
//   4. if a session still exceeds the duration cap, drop its lowest-
//      priority accessory exercises (from the end of the list, where the
//      prompt places isolation/accessory work) down to a floor of 3
//      exercises, recalculating duration after each removal

const { slugifyExerciseId, calculateWeeklyVolume } = require("./workout-volume");
const { estimateSessionDuration } = require("./workout-duration");
const { EXERCISE_NAME_ALIASES } = require("./workout-exercise-aliases");
const { EXERCISE_SETCREDITS } = require("./workout-setcredits-map");
const { allTargetRanges, volumeStatus, classifyMuscleRequirement } = require("./workout-volume-targets");
const {
  getCatalogExercise,
  getDisabledExercise,
  isPublicExerciseEnabled,
  WORKOUT_EXERCISE_CATALOG
} = require("./workout-exercise-catalog");
const { normalizeEquipment } = require("./workout-validator");

// AI-reported muscleGroup strings ("Shoulders", "Lats") don't always match
// the catalog's setCredits keys ("delts", "back") exactly. Best-effort
// mapping so the catalog-wide substitution below can still find same-muscle
// alternatives; unmapped groups just lowercase-and-underscore as a fallback.
// Includes the Hebrew muscle-group names the generation prompt asks for in
// Hebrew mode (see server.js's "Muscle groups:" translation table) — without
// this, a Hebrew-labeled exercise's muscle group never matches any catalog
// entry, so the catalog substitution below silently finds nothing to
// replace it with and the program falls through to the AI correction retry
// (or 422) instead of being fixed deterministically.
const MUSCLE_GROUP_ALIASES = {
  shoulders: "delts",
  shoulder: "delts",
  "rear delts": "rear_delts",
  "rear deltoids": "rear_delts",
  lats: "back",
  quadriceps: "quads",
  legs: "quads",
  abs: "core",
  abdominals: "core",
  glutes: "glutes",
  hamstrings: "hamstrings",
  calves: "calves",
  חזה: "chest",
  גב: "back",
  כתפיים: "delts",
  "יד קדמית": "biceps",
  "יד אחורית": "triceps",
  "ארבע ראשי": "quads",
  המסטרינג: "hamstrings",
  ישבן: "glutes",
  תאומים: "calves",
  ליבה: "core"
};

function normalizeMuscleGroup(value = "") {
  const lower = String(value || "").trim().toLowerCase();
  if (!lower) return "";
  return MUSCLE_GROUP_ALIASES[lower] || lower.replace(/\s+/g, "_");
}

// Every catalog exercise's primary muscle (first setCredits key), computed
// once so the general substitution below is a plain lookup, not a rescan.
const CATALOG_IDS_BY_PRIMARY_MUSCLE = (() => {
  const map = new Map();
  for (const [exerciseId, entry] of Object.entries(WORKOUT_EXERCISE_CATALOG)) {
    const primaryMuscle = Object.keys(entry.setCredits || {})[0];
    if (!primaryMuscle) continue;
    if (!map.has(primaryMuscle)) map.set(primaryMuscle, []);
    map.get(primaryMuscle).push(exerciseId);
  }
  return map;
})();

const MIN_EXERCISES_PER_SESSION = 3;

function resolveExerciseId(exercise) {
  const existing = typeof exercise.exerciseId === "string" ? exercise.exerciseId.trim() : "";
  const candidates = [
    ["existing", existing],
    ["name", exercise.name],
    ["demoName", exercise.demoName]
  ];

  for (const [source, value] of candidates) {
    const slug = slugifyExerciseId(value || "");
    if (!slug) continue;
    if (EXERCISE_NAME_ALIASES[slug]) {
      return { id: EXERCISE_NAME_ALIASES[slug], source: `${source}-alias` };
    }
    if (EXERCISE_SETCREDITS[slug]) {
      return { id: slug, source: `${source}-canonical` };
    }
  }

  if (existing) {
    return { id: slugifyExerciseId(existing) || existing, source: "existing-slug" };
  }

  const nameSlug = slugifyExerciseId(exercise.name || exercise.demoName || "");
  if (nameSlug) {
    return { id: nameSlug, source: "name-slug" };
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
      } else if (exercise.exerciseId !== uniqueId) {
        repairs.push(`Session ${i + 1}: normalized exerciseId "${exercise.exerciseId}" to "${uniqueId}" for "${exercise.name || "unnamed exercise"}" (${source}).`);
        exercise.exerciseId = uniqueId;
      }
    }
  }
}

const EQUIPMENT_SUBSTITUTIONS = {
  "cable-tricep-pushdown": [
    {
      exerciseId: "overhead-tricep-extension",
      name: "Dumbbell Overhead Triceps Extension",
      demoName: "Dumbbell Overhead Triceps Extension",
      muscleGroup: "Triceps",
      equipment: "Dumbbell"
    },
    {
      exerciseId: "skull-crusher",
      name: "Barbell Skull Crusher",
      demoName: "Skull Crusher",
      muscleGroup: "Triceps",
      equipment: "Barbell"
    },
    {
      exerciseId: "close-grip-bench-press",
      name: "Close-Grip Bench Press",
      demoName: "Close-Grip Bench Press",
      muscleGroup: "Triceps",
      equipment: "Barbell"
    }
  ],
  "face-pull": [
    {
      exerciseId: "dumbbell-reverse-fly",
      name: "Dumbbell Reverse Fly",
      demoName: "Dumbbell Reverse Fly",
      muscleGroup: "Rear Delts",
      equipment: "Dumbbell"
    }
  ],
  "cable-lateral-raise": [
    {
      exerciseId: "dumbbell-lateral-raise",
      name: "Dumbbell Lateral Raise",
      demoName: "Dumbbell Lateral Raise",
      muscleGroup: "Shoulders",
      equipment: "Dumbbell"
    },
    {
      exerciseId: "machine-shoulder-press",
      name: "Machine Shoulder Press",
      demoName: "Machine Shoulder Press",
      muscleGroup: "Shoulders",
      equipment: "Machine"
    }
  ],
  "cable-bicep-curl": [
    {
      exerciseId: "hammer-curl",
      name: "Dumbbell Hammer Curl",
      demoName: "Dumbbell Hammer Curl",
      muscleGroup: "Biceps",
      equipment: "Dumbbell"
    },
    {
      exerciseId: "barbell-bicep-curl",
      name: "Barbell Biceps Curl",
      demoName: "Barbell Biceps Curl",
      muscleGroup: "Biceps",
      equipment: "Barbell"
    },
    {
      exerciseId: "preacher-curl",
      name: "Preacher Curl",
      demoName: "Preacher Curl",
      muscleGroup: "Biceps",
      equipment: "Machine"
    }
  ],
  "cable-crossover": [
    {
      exerciseId: "machine-chest-fly",
      name: "Machine Chest Fly",
      demoName: "Machine Chest Fly",
      muscleGroup: "Chest",
      equipment: "Machine"
    },
    {
      exerciseId: "dumbbell-fly",
      name: "Dumbbell Fly",
      demoName: "Dumbbell Fly",
      muscleGroup: "Chest",
      equipment: "Dumbbell"
    }
  ],
  "cable-crunch": [
    {
      exerciseId: "plank",
      name: "Plank",
      demoName: "Plank",
      muscleGroup: "Core",
      equipment: "Bodyweight"
    }
  ],
  "cable-woodchopper": [
    {
      exerciseId: "russian-twist",
      name: "Russian Twist",
      demoName: "Russian Twist",
      muscleGroup: "Core",
      equipment: "Bodyweight"
    }
  ]
};

// Bodyweight is equipment like any other canonical token here too — it is
// allowed only when it's a member of selectedEquipmentNorm. Callers must
// pass the FINAL allowed canonical set (see deriveAllowedEquipment() in
// workout-equipment-policy.js), which already includes "bodyweight"
// explicitly for styles where it's intrinsic (Calisthenics). There is no
// unconditional exemption: a Gym program with Dumbbells + Machines selected
// must never let a Bodyweight exercise (or any other unselected equipment)
// through this check.
function isExerciseEquipmentAllowed(equipmentValue, selectedEquipmentNorm) {
  const normalized = normalizeEquipment(equipmentValue);
  if (!selectedEquipmentNorm.size) return true;
  return Boolean(normalized && selectedEquipmentNorm.has(normalized));
}

function applyReplacementFields(target, replacement) {
  target.exerciseId = replacement.exerciseId;
  target.name = replacement.name;
  target.demoName = replacement.demoName;
  target.muscleGroup = replacement.muscleGroup;
  target.equipment = replacement.equipment;
}

function replacementFromExerciseId(exerciseId) {
  const catalogEntry = getCatalogExercise(exerciseId);
  if (!catalogEntry) return null;
  return {
    exerciseId: catalogEntry.exerciseId,
    name: catalogEntry.title,
    demoName: catalogEntry.title,
    muscleGroup: Object.keys(catalogEntry.setCredits || {})[0] || "General",
    equipment: catalogEntry.equipment
  };
}

function findAllowedReplacement(replacementIds, selectedEquipmentNorm) {
  for (const replacementId of replacementIds || []) {
    if (!isPublicExerciseEnabled(replacementId)) continue;
    const replacement = replacementFromExerciseId(replacementId);
    if (replacement && isExerciseEquipmentAllowed(replacement.equipment, selectedEquipmentNorm)) {
      return replacement;
    }
  }
  return null;
}

function repairDisabledPublicExercises(program, context, repairs) {
  const selectedEquipmentNorm = new Set(
    (Array.isArray(context.equipment) ? context.equipment : [])
      .map(normalizeEquipment)
      .filter(Boolean)
  );
  if (!Array.isArray(program.sessions)) return;

  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    session.exercises = session.exercises.filter((exercise) => {
      const { id } = resolveExerciseId(exercise);
      const disabled = getDisabledExercise(id);
      if (!disabled) return true;

      const replacement = findAllowedReplacement(disabled.replacementIds, selectedEquipmentNorm);
      const originalName = exercise.name || exercise.exerciseId || disabled.exerciseId;

      if (replacement) {
        applyReplacementFields(exercise, replacement);
        repairs.push(
          `Session ${i + 1}: replaced disabled exercise "${originalName}" with "${replacement.name}" because ${disabled.reason}.`
        );
        return true;
      }

      if (session.exercises.length > MIN_EXERCISES_PER_SESSION) {
        repairs.push(
          `Session ${i + 1}: removed disabled exercise "${originalName}" because ${disabled.reason} and no selected-equipment replacement was available.`
        );
        return false;
      }

      return true;
    });
  }
}

function repairEquipmentConstraints(program, context, repairs) {
  const selectedEquipmentNorm = new Set(
    (Array.isArray(context.equipment) ? context.equipment : [])
      .map(normalizeEquipment)
      .filter(Boolean)
  );
  if (!selectedEquipmentNorm.size || !Array.isArray(program.sessions)) return;

  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    for (const exercise of session.exercises) {
      if (isExerciseEquipmentAllowed(exercise.equipment, selectedEquipmentNorm)) continue;

      const { id } = resolveExerciseId(exercise);
      const replacements = EQUIPMENT_SUBSTITUTIONS[id] || [];
      const replacement = replacements.find((candidate) =>
        isExerciseEquipmentAllowed(candidate.equipment, selectedEquipmentNorm)
      );

      if (!replacement) continue;

      const originalName = exercise.name || exercise.exerciseId || "unnamed exercise";
      const originalEquipment = exercise.equipment || "unknown equipment";
      applyReplacementFields(exercise, replacement);
      repairs.push(
        `Session ${i + 1}: replaced "${originalName}" (${originalEquipment}) with "${replacement.name}" (${replacement.equipment}) because the original equipment was not selected.`
      );
    }
  }
}

// Catch-all for any equipment mismatch the small hand-curated
// EQUIPMENT_SUBSTITUTIONS map above doesn't cover (which is most of them —
// that map only names 7 specific cable exercises). Searches the full
// exercise catalog for another exercise that trains the same primary muscle
// and uses equipment the user actually selected, so an invented
// "pull-up-bar" or Hebrew-labeled exercise the model produces for a user
// who never selected that equipment always has a deterministic way out
// instead of guaranteed validation failure.
function repairUnmatchedEquipmentViaCatalog(program, context, repairs) {
  const selectedEquipmentNorm = new Set(
    (Array.isArray(context.equipment) ? context.equipment : [])
      .map(normalizeEquipment)
      .filter(Boolean)
  );
  if (!selectedEquipmentNorm.size || !Array.isArray(program.sessions)) return;

  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    const usedIdsInSession = new Set([
      ...(Array.isArray(context.reservedExerciseIds) ? context.reservedExerciseIds : []),
      ...session.exercises.map((exercise) => resolveExerciseId(exercise).id).filter(Boolean)
    ]);

    // Tracked explicitly: inside filter(), session.exercises still refers to
    // the pre-filter array (see the identical note on
    // repairExercisesMissingFromCatalog below).
    let remaining = session.exercises.length;

    session.exercises = session.exercises.filter((exercise) => {
      if (isExerciseEquipmentAllowed(exercise.equipment, selectedEquipmentNorm)) return true;

      const primaryMuscle = normalizeMuscleGroup(exercise.muscleGroup);
      const candidateIds = CATALOG_IDS_BY_PRIMARY_MUSCLE.get(primaryMuscle) || [];
      const { id: originalId } = resolveExerciseId(exercise);

      const replacementId = candidateIds.find((candidateId) => {
        if (candidateId === originalId || usedIdsInSession.has(candidateId)) return false;
        if (!isPublicExerciseEnabled(candidateId)) return false;
        const candidate = getCatalogExercise(candidateId);
        return candidate && isExerciseEquipmentAllowed(candidate.equipment, selectedEquipmentNorm);
      });

      const originalName = exercise.name || exercise.exerciseId || "unnamed exercise";
      const originalEquipment = exercise.equipment || "unknown equipment";
      const replacement = replacementId ? replacementFromExerciseId(replacementId) : null;

      if (replacement) {
        applyReplacementFields(exercise, replacement);
        usedIdsInSession.delete(originalId);
        usedIdsInSession.add(replacementId);
        repairs.push(
          `Session ${i + 1}: replaced "${originalName}" (${originalEquipment}) with "${replacement.name}" (${replacement.equipment}) — same target muscle, matches selected equipment.`
        );
        return true;
      }

      // No same-muscle exercise using the selected equipment exists in the
      // catalog (e.g. the catalog's only matching option was already used
      // elsewhere in this session) — never leave disallowed equipment in
      // place for the validator to catch; remove it if the session can
      // still stand on its own, exactly like the other catalog-repair
      // passes in this file.
      if (remaining > MIN_EXERCISES_PER_SESSION) {
        remaining -= 1;
        repairs.push(
          `Session ${i + 1}: removed "${originalName}" (${originalEquipment}) — no same-muscle replacement using the selected equipment was available.`
        );
        return false;
      }

      return true;
    });
  }
}

// Backstop for stretch/mobility/warm-up/cool-down exercises the AI invents
// that aren't already named in DISABLED_EXERCISES above. The generation
// prompt never asks for a separate warm-up phase, but the model
// occasionally adds one as a regular exercise entry; since it is always
// "Bodyweight" equipment it sails past every equipment-repair pass above
// untouched. Covers both English and Hebrew wording, since the prompt lets
// name/demoName be Hebrew while exerciseId stays English.
const STRETCH_MOBILITY_PATTERN =
  /\b(stretch|stretching|mobility|warm[\s-]?up|cool[\s-]?down|cooldown)\b|מתיח|חימום|קירור|גמיש/i;

function repairImagelessMobilityExercises(program, repairs) {
  if (!Array.isArray(program.sessions)) return;

  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    // See repairExercisesMissingFromCatalog: session.exercises.length is not
    // usable as a live count from inside filter().
    let remaining = session.exercises.length;

    session.exercises = session.exercises.filter((exercise) => {
      const label = `${exercise.name || ""} ${exercise.demoName || ""}`;
      if (!STRETCH_MOBILITY_PATTERN.test(label)) return true;

      const { id } = resolveExerciseId(exercise);
      if (getCatalogExercise(id)) return true; // has a real, enabled, imaged catalog entry — keep it

      const originalName = exercise.name || exercise.exerciseId || "unnamed exercise";
      if (remaining > MIN_EXERCISES_PER_SESSION) {
        remaining -= 1;
        repairs.push(
          `Session ${i + 1}: removed "${originalName}" — a stretch/mobility/warm-up movement with no accurate dedicated image, rather than render a fallback image.`
        );
        return false;
      }
      return true;
    });
  }
}

// General backstop for ANY exercise the model names that doesn't resolve to
// a catalog entry -- e.g. "Machine Triceps Extension", which is a real
// exercise but has no dedicated image and no catalog id, so it rendered the
// branded "Demo image pending" card. The passes above only fire on a
// specific trigger (a disabled id, an equipment mismatch, stretch wording);
// an exercise that is simply absent from the catalog reached the frontend
// unrepaired.
//
// Substitute a catalog exercise that trains the same primary muscle and uses
// equipment the user actually selected. applyReplacementFields rewrites
// name/demoName/equipment too, so the card is honest about what it now shows
// rather than captioning one exercise with another's photo. If nothing
// matches, drop the exercise rather than render a fallback image.
function repairExercisesMissingFromCatalog(program, context, repairs) {
  const selectedEquipmentNorm = new Set(
    (Array.isArray(context.equipment) ? context.equipment : [])
      .map(normalizeEquipment)
      .filter(Boolean)
  );
  if (!Array.isArray(program.sessions)) return;

  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    // reservedExerciseIds lets a caller that repairs a synthetic session --
    // the reroll endpoint repairs just the single replacement exercise --
    // declare the ids already present in the real session, so a substitution
    // here cannot collide with one of them and trip the "appears more than
    // once" validation rule.
    const usedIdsInSession = new Set([
      ...(Array.isArray(context.reservedExerciseIds) ? context.reservedExerciseIds : []),
      ...session.exercises.map((exercise) => resolveExerciseId(exercise).id).filter(Boolean)
    ]);

    // Tracked explicitly: inside filter(), session.exercises still refers to
    // the pre-filter array, so reading .length there would never see earlier
    // removals and would happily cut past MIN_EXERCISES_PER_SESSION.
    let remaining = session.exercises.length;

    session.exercises = session.exercises.filter((exercise) => {
      const { id: originalId } = resolveExerciseId(exercise);
      if (getCatalogExercise(originalId)) return true;

      // An exercise with no usable muscle group has nothing to match a
      // replacement against, so candidateIds is simply empty here -- it
      // falls through to the same "no replacement found" removal branch
      // below instead of being silently left in the program. Previously
      // this returned true immediately, which let an exercise with no
      // catalog entry AND no parseable muscle group reach the response
      // still unmapped -- exactly the "a few exercises were not included
      // in this calculation" case reported against the weekly volume
      // summary. A successful response must have 100% mapping coverage
      // (see server.js's volumePassed gate), so this can no longer be
      // silently left unresolved.
      const primaryMuscle = normalizeMuscleGroup(exercise.muscleGroup);
      const candidateIds = primaryMuscle ? (CATALOG_IDS_BY_PRIMARY_MUSCLE.get(primaryMuscle) || []) : [];
      const replacementId = candidateIds.find((candidateId) => {
        if (candidateId === originalId || usedIdsInSession.has(candidateId)) return false;
        if (!isPublicExerciseEnabled(candidateId)) return false;
        const candidate = getCatalogExercise(candidateId);
        return candidate && isExerciseEquipmentAllowed(candidate.equipment, selectedEquipmentNorm);
      });

      const originalName = exercise.name || exercise.exerciseId || "unnamed exercise";
      const replacement = replacementId ? replacementFromExerciseId(replacementId) : null;

      if (replacement) {
        applyReplacementFields(exercise, replacement);
        usedIdsInSession.delete(originalId);
        usedIdsInSession.add(replacementId);
        repairs.push(
          `Session ${i + 1}: replaced "${originalName}" with "${replacement.name}" — the original has no catalog entry or dedicated image; the replacement trains the same muscle with selected equipment.`
        );
        return true;
      }

      if (remaining > MIN_EXERCISES_PER_SESSION) {
        remaining -= 1;
        repairs.push(
          `Session ${i + 1}: removed "${originalName}" — no catalog entry, no dedicated image and no same-muscle replacement using the selected equipment.`
        );
        return false;
      }

      return true;
    });
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

// Nudges weekly muscle volume toward the profile's target range (see
// lib/workout-volume-targets.js). Only REQUIRED muscles (classifyMuscleRequirement
// === "required") trigger repair — secondary muscles (rear delts, traps) and
// optional ones (skills-priority profiles) are shown for visibility but must
// never gate or force a change; see the classification module for why.
//
// Repair strategy, tried in order per below-range required muscle:
//   1. Increase sets on the existing exercise with the HIGHEST credit for
//      that muscle (prefer a primary mover, but fall back to the best
//      secondary contributor if no primary exists in the program) —
//      SETS ONLY, never touches equipment, never exceeds the duration budget.
//   2. If no exercise in the program credits this muscle at all (or every
//      candidate is already maxed out / would blow the duration budget),
//      ADD one enabled, selected-equipment catalog exercise whose PRIMARY
//      credit is this muscle to whichever session has room and duration
//      budget for it. This is the only pass in this file that adds a new
//      exercise; it's a required capability for muscles the program simply
//      never trained at all (e.g. a split with no rear-delt isolation and,
//      before the catalog credit fix, no incidental rear-delt credit
//      anywhere either).
// Above-range required muscles are trimmed by reducing sets on the
// LOWEST-credit contributor first (protects primary/compound movements).
//
// This is a bounded, best-effort repair, not a guarantee every muscle lands
// in range: a program that genuinely cannot fit more required volume within
// the session-duration/equipment/exercise-count constraints is left for the
// caller to judge via the returned volume/status (server.js's volumePassed
// gate turns a still-out-of-range required muscle into a controlled failure
// rather than a "successful" plan with a misleading status).
const MAX_VOLUME_REPAIR_PASSES = 3;
const MAX_SETS_PER_EXERCISE = 6;
const MIN_SETS_PER_EXERCISE = 2;
const MAX_EXERCISES_PER_SESSION = 8;

function repairWeeklyVolumeTargets(program, context, repairs) {
  // Opt-in, not opt-out: this pass changes SET COUNTS (and, as of the ADD
  // strategy above, exercise composition), which every other repair pass in
  // this file otherwise avoids doing blindly. Callers that don't opt in —
  // e.g. isolated single-exercise repairs, or tests exercising a specific
  // earlier pass — must not have their fixtures silently perturbed by a
  // volume nudge they never asked for. server.js opts in explicitly for the
  // real /api/workout-builder generation path only; the reroll endpoint's
  // synthetic single-exercise repair never opts in.
  if (!context.applyVolumeTargets) return;
  if (!Array.isArray(program.sessions) || !program.sessions.length) return;

  const { sessionDuration = 60 } = context;
  const tolerance = Math.max(5, sessionDuration * 0.1);
  const budget = sessionDuration + tolerance;
  const profile = {
    experience: context.experience,
    priority: context.priority,
    daysPerWeek: context.daysPerWeek || program.sessions.length,
    equipment: Array.isArray(context.equipment) ? context.equipment : []
  };
  const selectedEquipmentNorm = new Set(
    (Array.isArray(context.equipment) ? context.equipment : [])
      .map(normalizeEquipment)
      .filter(Boolean)
  );

  for (let pass = 0; pass < MAX_VOLUME_REPAIR_PASSES; pass++) {
    const { perMuscle } = calculateWeeklyVolume(program, EXERCISE_SETCREDITS);
    const targets = allTargetRanges(profile);
    let changedThisPass = false;

    for (const [muscle, range] of Object.entries(targets)) {
      if (!range) continue;
      if (classifyMuscleRequirement(muscle, profile) !== "required") continue;

      const actual = perMuscle[muscle]?.total || 0;
      const status = volumeStatus(actual, range);
      if (status === "in-range") continue;

      const candidates = [];
      for (let s = 0; s < program.sessions.length; s++) {
        const session = program.sessions[s];
        if (!Array.isArray(session?.exercises)) continue;
        for (const exercise of session.exercises) {
          const credits = EXERCISE_SETCREDITS[exercise.exerciseId];
          if (credits && credits[muscle] > 0) {
            candidates.push({ session, exercise, sessionIndex: s, credit: credits[muscle] });
          }
        }
      }
      // Highest credit (primary mover) first, so bumping sets targets the
      // exercise that actually trains this muscle the most.
      candidates.sort((a, b) => b.credit - a.credit);

      if (status === "below") {
        let repaired = false;
        for (const target of candidates) {
          const currentSets = Number(target.exercise.sets) || 0;
          if (currentSets >= MAX_SETS_PER_EXERCISE) continue;

          target.exercise.sets = currentSets + 1;
          const estimate = estimateSessionDuration(target.session);
          if (estimate.estimatedMinutes > budget) {
            target.exercise.sets = currentSets; // would exceed the duration budget — try the next candidate
            continue;
          }
          repairs.push(
            `Session ${target.sessionIndex + 1}: increased "${target.exercise.name}" from ${currentSets} to ${target.exercise.sets} sets — weekly ${muscle} volume was below its recommended range (${range.min}-${range.max}).`
          );
          changedThisPass = true;
          repaired = true;
          break;
        }

        if (!repaired) {
          // Tier 3: nothing in the program credits this muscle usefully (or
          // every candidate is maxed out) — add a primary-mover, selected-
          // equipment catalog exercise to the first session with room.
          const primaryCandidateIds = CATALOG_IDS_BY_PRIMARY_MUSCLE.get(muscle) || [];
          for (let s = 0; s < program.sessions.length; s++) {
            const session = program.sessions[s];
            // A session with ZERO exercises is a schema violation (Rule 10
            // in workout-validator.js: "must have at least one exercise"),
            // not a normal program that's merely under-target for one
            // muscle. This pass must never be the thing that silently turns
            // a genuinely broken/empty AI response into a passing one —
            // that's validateWorkoutProgram's job to reject, not this
            // repair's job to paper over.
            if (!Array.isArray(session?.exercises) || session.exercises.length === 0 || session.exercises.length >= MAX_EXERCISES_PER_SESSION) continue;

            const usedIds = new Set(session.exercises.map((exercise) => resolveExerciseId(exercise).id).filter(Boolean));
            const replacementId = primaryCandidateIds.find((candidateId) => {
              if (usedIds.has(candidateId)) return false;
              if (!isPublicExerciseEnabled(candidateId)) return false;
              const candidate = getCatalogExercise(candidateId);
              return candidate && isExerciseEquipmentAllowed(candidate.equipment, selectedEquipmentNorm);
            });
            if (!replacementId) continue;

            const replacement = replacementFromExerciseId(replacementId);
            if (!replacement) continue;

            const newExercise = {
              ...replacement,
              sets: 3,
              reps: "10-12",
              restSeconds: 75,
              rir: "1-2",
              notes: ""
            };
            const estimate = estimateSessionDuration({ exercises: [...session.exercises, newExercise] });
            if (estimate.estimatedMinutes > budget) continue;

            session.exercises.push(newExercise);
            repairs.push(
              `Session ${s + 1}: added "${replacement.name}" — weekly ${muscle} volume was below its recommended range (${range.min}-${range.max}) and no existing exercise could be safely increased.`
            );
            changedThisPass = true;
            break;
          }
        }
      } else if (status === "above" && candidates.length) {
        const target = candidates[candidates.length - 1]; // lowest-credit contributor — protects compound movements
        const currentSets = Number(target.exercise.sets) || 0;
        if (currentSets > MIN_SETS_PER_EXERCISE) {
          target.exercise.sets = currentSets - 1;
          repairs.push(
            `Session ${target.sessionIndex + 1}: reduced "${target.exercise.name}" from ${currentSets} to ${target.exercise.sets} sets — weekly ${muscle} volume was above its recommended range (${range.min}-${range.max}).`
          );
          changedThisPass = true;
        }
      }
    }

    if (!changedThisPass) break;
  }
}

function repairWorkoutProgram(program, context = {}) {
  const repairs = [];

  if (!program || !Array.isArray(program.sessions)) {
    return { program, repairs };
  }

  assignExerciseIds(program, repairs);
  repairDisabledPublicExercises(program, context, repairs);
  repairImagelessMobilityExercises(program, repairs);
  assignExerciseIds(program, repairs);
  repairEquipmentConstraints(program, context, repairs);
  // Catch-all pass: anything the small hand-curated substitution map above
  // didn't cover (most equipment mismatches) gets a same-muscle catalog
  // replacement here instead of reaching the validator unrepaired.
  repairUnmatchedEquipmentViaCatalog(program, context, repairs);
  repairDisabledPublicExercises(program, context, repairs);
  // Last content pass: anything still lacking a catalog entry (and therefore
  // a real image) is swapped for a same-muscle catalog exercise, or dropped.
  repairExercisesMissingFromCatalog(program, context, repairs);
  assignExerciseIds(program, repairs);
  repairSchemaDefects(program, repairs);
  trimAccessoryExercisesForDuration(program, context, repairs);
  // Last pass: nudge weekly per-muscle set volume toward the profile's
  // target range. Runs last so it acts on the program's final exercise/set
  // shape (post equipment substitution, post duration trim) and its own
  // duration-budget check stays accurate.
  repairWeeklyVolumeTargets(program, context, repairs);

  return { program, repairs };
}

module.exports = { repairWorkoutProgram, resolveExerciseId, repairWeeklyVolumeTargets };
