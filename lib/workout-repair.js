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
const { allTargetRanges, allVolumePolicies, volumeStatus, classifyMuscleRequirement } = require("./workout-volume-targets");
const { buildVolumeLedger, targetPointForPolicy } = require("./workout-volume-ledger");
const { primaryMuscleForExerciseId, isPrimaryMuscleAllowed } = require("./workout-focus");
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
const MIN_EXERCISES_FOR_ALLOCATION = 1;

function volumeProfile(program, context = {}) {
  return {
    experience: context.experience,
    priority: context.priority,
    daysPerWeek: context.daysPerWeek || program?.sessions?.length || 0,
    equipment: Array.isArray(context.equipment) ? context.equipment : [],
    muscleFocusMode: context.muscleFocusMode || "balanced",
    selectedMuscles: Array.isArray(context.selectedMuscles) ? context.selectedMuscles : []
  };
}

function orderedTargetEntries(targets, profile) {
  const selected = new Set(profile.selectedMuscles || []);
  return Object.entries(targets).sort(([left], [right]) => {
    const leftPriority = selected.has(left) ? 0 : 1;
    const rightPriority = selected.has(right) ? 0 : 1;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.localeCompare(right);
  });
}

function isDirectIsolationForMuscle(exerciseId, muscle) {
  const credits = EXERCISE_SETCREDITS[exerciseId] || {};
  const creditedMuscles = Object.entries(credits).filter(([, credit]) => Number(credit) > 0);
  return primaryMuscleForExerciseId(exerciseId) === muscle
    && Number(credits[muscle]) === 1
    && creditedMuscles.length === 1;
}

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

function assignExerciseIds(program, context, repairs) {
  const selectedEquipmentNorm = new Set(
    (Array.isArray(context?.equipment) ? context.equipment : [])
      .map(normalizeEquipment)
      .filter(Boolean)
  );

  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    const seenIds = new Set();
    for (const exercise of session.exercises) {
      const hadId = typeof exercise.exerciseId === "string" && exercise.exerciseId.trim().length > 0;
      let { id, source } = resolveExerciseId(exercise);

      // Guarantee uniqueness within the session (Rule 9) even if two
      // different exercises would otherwise slugify/alias to the same id.
      // Prefer swapping the repeat for a *different* same-muscle catalog
      // exercise over a numeric-suffixed id: a suffixed id like
      // "t-bar-row-2" doesn't exist in the catalog/setCredits map, so it
      // would silently fall out of weekly-volume mapping coverage (and lose
      // its demo image) even though the exercise itself is perfectly valid.
      let uniqueId = id || `exercise-${i}-${session.exercises.indexOf(exercise)}`;
      if (seenIds.has(uniqueId) && getCatalogExercise(uniqueId)) {
        const primaryMuscle = Object.keys(getCatalogExercise(uniqueId).setCredits || {})[0];
        const candidateIds = primaryMuscle ? (CATALOG_IDS_BY_PRIMARY_MUSCLE.get(primaryMuscle) || []) : [];
        let replacement = null;
        for (const candidateId of candidateIds) {
          if (!isPublicExerciseEnabled(candidateId)) continue;
          const candidate = getCatalogExercise(candidateId);
          if (!candidate || !isExerciseEquipmentAllowed(candidate.equipment, selectedEquipmentNorm)) continue;
          // Some catalog ids are pure name-variants of another id (e.g.
          // "bulgarian-split-squat" vs "dumbbell-bulgarian-split-squat",
          // both titled "Dumbbell Bulgarian Split Squat" and aliased to the
          // same canonical id) -- resolve by title before comparing against
          // seenIds, or picking one would just re-collide with the
          // duplicate we're trying to replace on the very next repair pass.
          const canonicalId = resolveExerciseId({ name: candidate.title }).id || candidateId;
          if (seenIds.has(canonicalId)) continue;
          const candidateReplacement = replacementFromExerciseId(canonicalId) || replacementFromExerciseId(candidateId);
          if (!candidateReplacement || seenIds.has(candidateReplacement.exerciseId)) continue;
          replacement = candidateReplacement;
          break;
        }
        if (replacement) {
          applyReplacementFields(exercise, replacement);
          uniqueId = replacement.exerciseId;
          seenIds.add(uniqueId);
          repairs.push(`Session ${i + 1}: replaced duplicate "${id}" with "${replacement.name}" — the program listed the same exercise twice in one session.`);
          continue;
        }
      }

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

function enforceSelectedOnlyPrimaryTargets(program, context, repairs) {
  if (context.muscleFocusMode !== "selected_only") return;
  const selected = new Set(context.selectedMuscles || []);
  const selectedEquipmentNorm = new Set(
    (Array.isArray(context.equipment) ? context.equipment : [])
      .map(normalizeEquipment)
      .filter(Boolean)
  );

  for (let sessionIndex = 0; sessionIndex < program.sessions.length; sessionIndex += 1) {
    const session = program.sessions[sessionIndex];
    if (!Array.isArray(session?.exercises)) continue;
    const original = [...session.exercises];
    session.exercises = session.exercises.filter((exercise) => {
      const allowed = isPrimaryMuscleAllowed(exercise.exerciseId, context);
      if (!allowed) {
        repairs.push(`Session ${sessionIndex + 1}: removed "${exercise.name || exercise.exerciseId}" because selected_only does not allow primary ${primaryMuscleForExerciseId(exercise.exerciseId) || "unknown"} work.`);
      }
      return allowed;
    });

    if (original.length > 0 && session.exercises.length === 0) {
      let replacement = null;
      for (const muscle of selected) {
        const candidateId = (CATALOG_IDS_BY_PRIMARY_MUSCLE.get(muscle) || []).find((exerciseId) => {
          const entry = getCatalogExercise(exerciseId);
          return isPublicExerciseEnabled(exerciseId)
            && entry
            && isExerciseEquipmentAllowed(entry.equipment, selectedEquipmentNorm);
        });
        if (candidateId) {
          replacement = replacementFromExerciseId(candidateId);
          break;
        }
      }
      if (replacement) {
        session.exercises.push({
          ...replacement,
          sets: 3,
          reps: "8-12",
          restSeconds: 90,
          rir: "1-3",
          notes: ""
        });
        repairs.push(`Session ${sessionIndex + 1}: added "${replacement.name}" to preserve selected_only primary coverage after filtering.`);
      }
    }
  }
}

function trimUnnecessaryDirectIsolation(program, context, repairs) {
  if (!context.applyVolumeTargets || !Array.isArray(program.sessions) || !program.sessions.length) return;
  const profile = volumeProfile(program, context);
  const selected = new Set(profile.selectedMuscles || []);
  const MAX_ISOLATION_TRIM_STEPS = 48;

  for (let step = 0; step < MAX_ISOLATION_TRIM_STEPS; step += 1) {
    const ledger = buildVolumeLedger(program, profile);
    const muscles = Object.values(ledger.muscles)
      .filter((entry) => entry.requirement === "required")
      .sort((left, right) => {
        const leftPriority = profile.muscleFocusMode === "prioritize" && selected.has(left.muscle) ? 1 : 0;
        const rightPriority = profile.muscleFocusMode === "prioritize" && selected.has(right.muscle) ? 1 : 0;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return right.amountAbovePreferred - left.amountAbovePreferred;
      });
    let changed = false;

    for (const entry of muscles) {
      const needsHardTrim = entry.amountAboveHardMaximum > 0;
      const aboveOptimizationTarget = entry.effectiveTotal > entry.targetPoint;
      const compoundsAlreadySufficient = entry.fractionalIndirectSets >= entry.preferredMinimum;
      if (!needsHardTrim && !aboveOptimizationTarget && !compoundsAlreadySufficient) continue;

      const candidates = entry.sourceExercises
        .filter((source) => isDirectIsolationForMuscle(source.exerciseId, entry.muscle))
        .sort((left, right) => right.sessionIndex - left.sessionIndex || right.exerciseIndex - left.exerciseIndex);

      for (const source of candidates) {
        const session = program.sessions[source.sessionIndex];
        const exercise = session?.exercises?.[source.exerciseIndex];
        if (!exercise || exercise.exerciseId !== source.exerciseId) continue;
        const currentSets = Number(exercise.sets) || 0;
        const contributionPerSet = Number(EXERCISE_SETCREDITS[source.exerciseId]?.[entry.muscle]) || 0;
        const minimumAfterChange = needsHardTrim ? entry.hardMinimum : entry.preferredMinimum;

        if (currentSets > MIN_SETS_PER_EXERCISE && entry.effectiveTotal - contributionPerSet >= minimumAfterChange) {
          exercise.sets = currentSets - 1;
          repairs.push(`Session ${source.sessionIndex + 1}: reduced direct isolation "${exercise.name}" from ${currentSets} to ${exercise.sets} sets before changing compounds; ${entry.muscle} effective volume exceeded its programming target.`);
          changed = true;
          break;
        }
        if (session.exercises.length > MIN_EXERCISES_FOR_ALLOCATION && entry.effectiveTotal - currentSets * contributionPerSet >= minimumAfterChange) {
          session.exercises.splice(source.exerciseIndex, 1);
          repairs.push(`Session ${source.sessionIndex + 1}: removed redundant direct isolation "${exercise.name}" before changing compounds; ${entry.muscle} remained at or above ${minimumAfterChange} effective sets.`);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
    if (!changed) break;
  }
}

function candidateProgrammingValue(exercise, session, ledger, profile) {
  const credits = EXERCISE_SETCREDITS[exercise.exerciseId] || {};
  const sets = Number(exercise.sets) || 0;
  const primaryMuscle = primaryMuscleForExerciseId(exercise.exerciseId);
  const selected = new Set(profile.selectedMuscles || []);
  let value = 0;

  if (selected.has(primaryMuscle)) value += profile.muscleFocusMode === "selected_only" ? 2000 : 600;
  if (classifyMuscleRequirement(primaryMuscle, profile) === "required") value += 100;

  for (const [muscle, rawCredit] of Object.entries(credits)) {
    const credit = Number(rawCredit) || 0;
    const contribution = sets * credit;
    const muscleLedger = ledger.muscles[muscle];
    if (!muscleLedger) continue;
    if (muscleLedger.effectiveTotal - contribution < muscleLedger.hardMinimum && muscleLedger.requirement === "required") value += 1000;
    else if (muscleLedger.remainingDeficit > 0) value += contribution * 25;
    else if (muscleLedger.amountAbovePreferred > 0) value -= contribution * 15;
    else value += contribution * 3;
  }

  if (isDirectIsolationForMuscle(exercise.exerciseId, primaryMuscle)) {
    const primaryLedger = ledger.muscles[primaryMuscle];
    if (primaryLedger?.amountAbovePreferred > 0) value -= 150;
    else value -= 10;
  }

  const samePrimaryCount = (session.exercises || []).filter((candidate) => primaryMuscleForExerciseId(candidate.exerciseId) === primaryMuscle).length;
  if (samePrimaryCount > 1) value -= 20;
  return value;
}

function trimPreferredExcessWithoutCreatingDeficits(program, context, repairs) {
  if (!context.applyVolumeTargets) return;
  const profile = volumeProfile(program, context);
  const selected = new Set(profile.selectedMuscles || []);
  const MAX_PREFERRED_TRIM_STEPS = 48;

  function canRemoveSets(ledger, exerciseId, setsToRemove) {
    const credits = EXERCISE_SETCREDITS[exerciseId] || {};
    return Object.entries(credits).every(([muscle, rawCredit]) => {
      const entry = ledger.muscles[muscle];
      if (!entry || entry.requirement !== "required") return true;
      return entry.effectiveTotal - Number(rawCredit || 0) * setsToRemove >= entry.preferredMinimum;
    });
  }

  for (let step = 0; step < MAX_PREFERRED_TRIM_STEPS; step += 1) {
    const ledger = buildVolumeLedger(program, profile);
    const excessMuscles = Object.values(ledger.muscles)
      .filter((entry) => entry.requirement === "required" && entry.amountAbovePreferred > 0)
      .sort((left, right) => {
        const leftSelected = selected.has(left.muscle) ? 1 : 0;
        const rightSelected = selected.has(right.muscle) ? 1 : 0;
        if (profile.muscleFocusMode === "prioritize" && leftSelected !== rightSelected) return leftSelected - rightSelected;
        return right.amountAbovePreferred - left.amountAbovePreferred;
      });
    let changed = false;

    for (const entry of excessMuscles) {
      const candidates = entry.sourceExercises
        .map((source) => {
          const session = program.sessions[source.sessionIndex];
          const exercise = session?.exercises?.[source.exerciseIndex];
          if (!exercise || exercise.exerciseId !== source.exerciseId) return null;
          return {
            source,
            session,
            exercise,
            isolationRank: isDirectIsolationForMuscle(source.exerciseId, entry.muscle) ? 0 : 1,
            value: candidateProgrammingValue(exercise, session, ledger, profile)
          };
        })
        .filter(Boolean)
        .sort((left, right) => left.isolationRank - right.isolationRank
          || left.value - right.value
          || right.source.exerciseIndex - left.source.exerciseIndex);

      let candidate = candidates.find(({ exercise }) => Number(exercise.sets) > MIN_SETS_PER_EXERCISE
        && canRemoveSets(ledger, exercise.exerciseId, 1));
      if (candidate) {
        const previousSets = Number(candidate.exercise.sets);
        candidate.exercise.sets = previousSets - 1;
        repairs.push(`Session ${candidate.source.sessionIndex + 1}: reduced "${candidate.exercise.name}" from ${previousSets} to ${candidate.exercise.sets} sets to remove feasible preferred-range excess without creating a deficit.`);
        changed = true;
        break;
      }

      candidate = candidates.find(({ exercise, session }) => session.exercises.length > MIN_EXERCISES_FOR_ALLOCATION
        && canRemoveSets(ledger, exercise.exerciseId, Number(exercise.sets) || 0));
      if (candidate) {
        candidate.session.exercises.splice(candidate.source.exerciseIndex, 1);
        repairs.push(`Session ${candidate.source.sessionIndex + 1}: removed "${candidate.exercise.name}" to eliminate feasible preferred-range excess after isolation-first repair.`);
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
}

function trimAccessoryExercisesForDuration(program, context, repairs) {
  const { sessionDuration = 60 } = context;
  const tolerance = Math.max(5, sessionDuration * 0.1);
  const budget = sessionDuration + tolerance;
  const profile = volumeProfile(program, context);

  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (!Array.isArray(session?.exercises)) continue;

    let estimate = estimateSessionDuration(session);
    while (
      estimate.estimatedMinutes > budget &&
      session.exercises.length > MIN_EXERCISES_PER_SESSION
    ) {
      const ledger = buildVolumeLedger(program, profile);
      const candidates = session.exercises
        .map((exercise, exerciseIndex) => ({
          exercise,
          exerciseIndex,
          value: candidateProgrammingValue(exercise, session, ledger, profile)
        }))
        .sort((left, right) => left.value - right.value || right.exerciseIndex - left.exerciseIndex);
      const candidate = candidates[0];
      const [removed] = session.exercises.splice(candidate.exerciseIndex, 1);
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
//   1. If the program has NO PRIMARY mover (credit===1) for this muscle at
//      all, try ADDING one first (see below) rather than grinding out many
//      +1 increments on a weak SECONDARY contributor. This is not just an
//      optimization: a muscle whose only in-program candidates are
//      secondary (e.g. 0.25 credit/set, capped at MAX_SETS_PER_EXERCISE)
//      can contribute at most ~1.5 total credit from any single exercise --
//      nowhere near closing a real deficit -- so without this, the pass
//      loop could exhaust MAX_VOLUME_REPAIR_PASSES on tiny increments and
//      leave a genuinely fixable muscle still below range. This was the
//      exact cause of a reported false-negative: Core stuck at "below"
//      after 28 repairs, because its only in-program candidates were two
//      squat variants crediting core 0.25 (secondary) each, and a
//      dedicated core exercise (credit 1.0) was never tried.
//   2. Increase sets on the existing exercise with the HIGHEST credit for
//      this muscle (prefer a primary mover, fall back to the best
//      secondary contributor) — SETS ONLY, never touches equipment, never
//      exceeds the duration budget.
//   3. If step 2 found nothing usable (every candidate maxed out or would
//      blow the duration budget), try ADD again as a last resort.
// ADD: one enabled, selected-equipment catalog exercise whose PRIMARY
// credit is this muscle, placed in whichever session has room and duration
// budget for it. This is the only step that adds a new exercise.
// Above-range required muscles are trimmed by reducing sets on the
// LOWEST-credit contributor first (protects primary/compound movements).
//
// This is a bounded, best-effort repair, not a guarantee every muscle lands
// in range: a program that genuinely cannot fit more required volume within
// the session-duration/equipment/exercise-count constraints is left for the
// caller to judge via the returned volume/status (server.js's volumePassed
// gate turns a still-out-of-range required muscle into a controlled failure
// rather than a "successful" plan with a misleading status). See
// diagnoseVolumeGateFailure() below, which server.js uses to tell a genuine
// equipment/schedule infeasibility apart from a solver limitation so the
// user-facing error is never wrongly blamed on equipment that was actually
// sufficient.
const MAX_VOLUME_REPAIR_PASSES = 64;
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
  const profile = volumeProfile(program, context);
  const selectedEquipmentNorm = new Set(
    (Array.isArray(context.equipment) ? context.equipment : [])
      .map(normalizeEquipment)
      .filter(Boolean)
  );

  // Adds ONE enabled, selected-equipment, primary-mover catalog exercise for
  // `muscle` to the first session with room and duration budget. Returns
  // true if it added one, false otherwise (nothing eligible, would blow
  // every session's budget/exercise-count ceiling, or -- if `guard` is
  // given -- the guard rejects every otherwise-eligible candidate). `guard`,
  // when provided, is called with the chosen candidate's exerciseId and may
  // return false to reject it (used by the quality-optimization pass below
  // to veto a candidate whose OTHER muscle credits would push some other
  // required muscle over ITS hard maximum as a side effect).
  function tryAddPrimaryExercise(muscle, range, guard) {
    const primaryCandidateIds = CATALOG_IDS_BY_PRIMARY_MUSCLE.get(muscle) || [];
    for (let s = 0; s < program.sessions.length; s++) {
      const session = program.sessions[s];
      // A session with ZERO exercises is a schema violation (Rule 10 in
      // workout-validator.js: "must have at least one exercise"), not a
      // normal program that's merely under-target for one muscle. This
      // pass must never be the thing that silently turns a genuinely
      // broken/empty AI response into a passing one — that's
      // validateWorkoutProgram's job to reject, not this repair's job to
      // paper over.
      if (!Array.isArray(session?.exercises) || session.exercises.length === 0 || session.exercises.length >= MAX_EXERCISES_PER_SESSION) continue;

      const usedIds = new Set(session.exercises.map((exercise) => resolveExerciseId(exercise).id).filter(Boolean));
      let replacement = null;
      for (const candidateId of primaryCandidateIds) {
        if (usedIds.has(candidateId)) continue;
        if (!isPublicExerciseEnabled(candidateId)) continue;
        const candidate = getCatalogExercise(candidateId);
        if (!candidate || !isExerciseEquipmentAllowed(candidate.equipment, selectedEquipmentNorm)) continue;
        const candidateReplacement = replacementFromExerciseId(candidateId);
        if (!candidateReplacement || usedIds.has(candidateReplacement.exerciseId)) continue;
        if (guard && !guard(candidateReplacement.exerciseId)) continue;
        replacement = candidateReplacement;
        break;
      }
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
        `Session ${s + 1}: added "${replacement.name}" — weekly ${muscle} volume was below its recommended range (${range.min}-${range.max}).`
      );
      return true;
    }
    return false;
  }

  // True if adding `extraSets` of `exerciseId` would push ANY muscle it
  // credits (not just the one currently being repaired/optimized) past that
  // muscle's own hard maximum for this profile. A compound exercise credits
  // several muscles at once (e.g. a bench press variant also credits
  // triceps) -- both the hard-gate loop and the quality-optimization pass
  // below must check every credited muscle's ceiling, not just the one
  // they're currently fixing/improving, or bumping sets for one muscle can
  // silently push a DIFFERENT required muscle out of its valid hard-gate
  // range as a side effect. `getMax(muscle)` returns that muscle's hard
  // maximum for this profile, or null/undefined if unknown/not gated.
  function wouldExceedAnyHardMaximum(exerciseId, extraSets, perMuscle, getMax) {
    const credits = EXERCISE_SETCREDITS[exerciseId];
    if (!credits) return false;
    for (const [creditMuscle, creditValue] of Object.entries(credits)) {
      const max = getMax(creditMuscle);
      if (max == null) continue;
      const currentTotal = perMuscle[creditMuscle]?.total || 0;
      if (currentTotal + creditValue * extraSets > max) return true;
    }
    return false;
  }

  function canReduceWithoutBreakingHardMinimum(candidate, setsToRemove, perMuscle, policies) {
    const credits = EXERCISE_SETCREDITS[candidate.exercise.exerciseId] || {};
    return Object.entries(credits).every(([creditMuscle, rawCredit]) => {
      if (classifyMuscleRequirement(creditMuscle, profile) !== "required") return true;
      const minimum = policies[creditMuscle]?.min ?? policies[creditMuscle]?.hardMinimum;
      if (minimum == null) return true;
      const currentTotal = perMuscle[creditMuscle]?.total || 0;
      return currentTotal - Number(rawCredit || 0) * setsToRemove >= minimum;
    });
  }

  function reductionPriority(candidate, ledger) {
    const exerciseId = candidate.exercise.exerciseId;
    const primaryMuscle = primaryMuscleForExerciseId(exerciseId);
    return {
      isolationRank: isDirectIsolationForMuscle(exerciseId, candidate.muscle)
        ? 0
        : primaryMuscle === candidate.muscle ? 1 : 2,
      value: candidateProgrammingValue(candidate.exercise, candidate.session, ledger, profile)
    };
  }

  for (let pass = 0; pass < MAX_VOLUME_REPAIR_PASSES; pass++) {
    const { perMuscle } = calculateWeeklyVolume(program, EXERCISE_SETCREDITS);
    const targets = allTargetRanges(profile);
    let changedThisPass = false;

    hardGatePass:
    for (const [muscle, range] of orderedTargetEntries(targets, profile)) {
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

        // Step 1: no primary mover in the program at all — adding one
        // closes the gap far faster than incrementing a weak secondary
        // contributor ever could.
        const hasPrimaryCandidate = candidates.some((c) => c.credit === 1);
        if (!hasPrimaryCandidate) {
          repaired = tryAddPrimaryExercise(muscle, range);
        }

        // Step 2: bump the highest-credit existing candidate.
        if (!repaired) {
          for (const target of candidates) {
            const currentSets = Number(target.exercise.sets) || 0;
            if (currentSets >= MAX_SETS_PER_EXERCISE) continue;
            // Don't fix this muscle's deficit by pushing a DIFFERENT
            // required muscle (also credited by this same exercise) over
            // ITS hard maximum.
            if (wouldExceedAnyHardMaximum(target.exercise.exerciseId, 1, perMuscle, (m) => targets[m]?.max)) continue;

            target.exercise.sets = currentSets + 1;
            const estimate = estimateSessionDuration(target.session);
            if (estimate.estimatedMinutes > budget) {
              target.exercise.sets = currentSets; // would exceed the duration budget — try the next candidate
              continue;
            }
            repairs.push(
              `Session ${target.sessionIndex + 1}: increased "${target.exercise.name}" from ${currentSets} to ${target.exercise.sets} sets — weekly ${muscle} volume was below its recommended range (${range.min}-${range.max}).`
            );
            repaired = true;
            break;
          }
        }

        // Step 3: last resort, try ADD again (covers the "had a primary
        // mover, but it's already maxed out" case).
        if (!repaired) {
          repaired = tryAddPrimaryExercise(muscle, range);
        }

        if (repaired) {
          changedThisPass = true;
          break hardGatePass;
        }
      } else if (status === "above" && candidates.length) {
        const ledger = buildVolumeLedger(program, profile);
        const rankedCandidates = candidates
          .map((candidate) => ({
            ...candidate,
            muscle,
            priority: reductionPriority({ ...candidate, muscle }, ledger)
          }))
          .sort((left, right) => left.priority.isolationRank - right.priority.isolationRank
            || left.priority.value - right.priority.value
            || left.credit - right.credit);
        let target = rankedCandidates.find((candidate) => {
          const currentSets = Number(candidate.exercise.sets) || 0;
          return currentSets > MIN_SETS_PER_EXERCISE
            && canReduceWithoutBreakingHardMinimum(candidate, 1, perMuscle, targets);
        });

        if (target) {
          const currentSets = Number(target.exercise.sets) || 0;
          target.exercise.sets = currentSets - 1;
          repairs.push(
            `Session ${target.sessionIndex + 1}: reduced "${target.exercise.name}" from ${currentSets} to ${target.exercise.sets} sets — weekly ${muscle} volume was above its recommended range (${range.min}-${range.max}).`
          );
          changedThisPass = true;
          break hardGatePass;
        }

        target = rankedCandidates.find((candidate) => {
          const currentSets = Number(candidate.exercise.sets) || 0;
          return candidate.session.exercises.length > MIN_EXERCISES_FOR_ALLOCATION
            && canReduceWithoutBreakingHardMinimum(candidate, currentSets, perMuscle, targets);
        });
        if (target) {
          // Already at the floor of MIN_SETS_PER_EXERCISE — the same
          // low-credit exercise repeated across many sessions/week (e.g. a
          // 6 day/week split) can still push weekly volume well above range
          // with no set left to trim. Remove it from this ONE session
          // (redundant volume — it still trains this muscle elsewhere)
          // rather than getting stuck unable to repair at all.
          const removedName = target.exercise.name;
          target.session.exercises = target.session.exercises.filter((exercise) => exercise !== target.exercise);
          repairs.push(
            `Session ${target.sessionIndex + 1}: removed "${removedName}" — weekly ${muscle} volume was above its recommended range (${range.min}-${range.max}) and its sets were already at the minimum per-session floor.`
          );
          changedThisPass = true;
          break hardGatePass;
        }
      }
    }

    if (!changedThisPass) break;
  }

  // --- Quality-optimization pass -----------------------------------------
  // The hard gate above only guarantees every required muscle sits inside
  // [minimumEffective, hardMaximum] (lib/workout-volume-targets.js). A plan
  // sitting exactly at the floor for every major muscle is technically
  // valid but is NOT what "optimize for the preferred target, not the
  // minimum" means for an advanced, high-frequency profile that has the
  // schedule to do better. This pass is BEST-EFFORT and NEVER reopens or
  // weakens the hard gate: it only nudges a required muscle that's already
  // inside its valid range toward its preferred zone, bounded by
  // hardMaximum and the same session-duration budget used above. Failing to
  // reach the preferred zone (duration budget exhausted, no further catalog
  // candidates) does not fail the plan -- this is a quality improvement,
  // not a second gate. See requiredMusclesOutOfRange() for the actual gate.
  const MAX_QUALITY_PASSES = 48;
  for (let pass = 0; pass < MAX_QUALITY_PASSES; pass++) {
    const { perMuscle } = calculateWeeklyVolume(program, EXERCISE_SETCREDITS);
    const policies = allVolumePolicies(profile);
    let changedThisPass = false;

    qualityPass:
    for (const [muscle, policy] of orderedTargetEntries(policies, profile)) {
      if (!policy) continue;
      if (classifyMuscleRequirement(muscle, profile) !== "required") continue;

      const actual = perMuscle[muscle]?.total || 0;
      // Already at/above the preferred floor, or already at/above the hard
      // ceiling (shouldn't happen post-gate, but never push further either
      // way) -- nothing for the quality pass to improve here.
      const targetPoint = targetPointForPolicy(policy);
      if (actual >= targetPoint || actual >= policy.hardMaximum) continue;

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
      candidates.sort((a, b) => b.credit - a.credit);

      let improved = false;

      // Prefer bumping an existing candidate's sets (cheapest duration
      // cost) before adding a whole new exercise.
      for (const target of candidates) {
        const currentSets = Number(target.exercise.sets) || 0;
        if (currentSets >= MAX_SETS_PER_EXERCISE) continue;
        // Never let a quality nudge push the muscle's weekly total -- OR any
        // OTHER muscle this same exercise credits -- past its hard maximum
        // for this profile.
        if (actual + target.credit > policy.preferredMax) continue;
        if (wouldExceedAnyHardMaximum(target.exercise.exerciseId, 1, perMuscle, (m) => policies[m]?.hardMaximum)) continue;
        if (wouldExceedAnyHardMaximum(target.exercise.exerciseId, 1, perMuscle, (m) => policies[m]?.preferredMax)) continue;

        target.exercise.sets = currentSets + 1;
        const estimate = estimateSessionDuration(target.session);
        if (estimate.estimatedMinutes > budget) {
          target.exercise.sets = currentSets;
          continue;
        }
        repairs.push(
          `Session ${target.sessionIndex + 1}: increased "${target.exercise.name}" from ${currentSets} to ${target.exercise.sets} sets — moving weekly ${muscle} volume toward the preferred target (${policy.preferredMin}-${policy.preferredMax}).`
        );
        improved = true;
        break;
      }

      // No existing candidate had room -- try adding one more primary-mover
      // exercise, same ADD strategy as the hard gate, but only when a fresh
      // 3-set exercise couldn't itself blow the hard maximum.
      if (!improved && actual + 3 <= policy.preferredMax) {
        improved = tryAddPrimaryExercise(
          muscle,
          { min: policy.preferredMin, max: policy.preferredMax },
          (candidateId) => !wouldExceedAnyHardMaximum(candidateId, 3, perMuscle, (m) => policies[m]?.hardMaximum)
            && !wouldExceedAnyHardMaximum(candidateId, 3, perMuscle, (m) => policies[m]?.preferredMax)
        );
      }

      if (improved) {
        changedThisPass = true;
        break qualityPass;
      }
    }

    if (!changedThisPass) break;
  }
}

// diagnoseVolumeGateFailure(perMuscle, outOfRangeRequired, profile) -> {
//   cause: "equipment" | "schedule" | "solver",
//   equipmentCoverage: { [muscle]: boolean },
//   details: [{ muscle, status, total, min, max, hasEquipmentCompatibleExercise }]
// }
// Called by server.js only when validationSummary.volumePassed is about to
// be false, to pick a cause-specific error message instead of always
// blaming equipment. "equipment": at least one out-of-range required muscle
// has literally zero enabled catalog exercises compatible with the final
// allowed equipment set (see lib/workout-volume-targets.js's
// muscleHasEquipmentCompatibleExercise, reused here). "schedule": equipment
// is fine everywhere, but the profile's days/session-duration are tight
// (<=2 days/week or <30min sessions) — plausibly a genuine scheduling
// squeeze. "solver": equipment and schedule both look feasible; the
// deterministic repair simply couldn't finish within its bounded pass
// count. Never exposed to the client verbatim — server.js logs it and
// selects a user-facing message; see server.js's volumeFailureMessage().
function diagnoseVolumeGateFailure(outOfRangeRequired, context) {
  const selectedEquipmentNorm = new Set(
    (Array.isArray(context.equipment) ? context.equipment : [])
      .map(normalizeEquipment)
      .filter(Boolean)
  );

  const details = outOfRangeRequired.map(({ muscle, status, total, range }) => {
    const hasEquipmentCompatibleExercise = Object.entries(WORKOUT_EXERCISE_CATALOG).some(([exerciseId, entry]) => {
      if (!isPublicExerciseEnabled(exerciseId)) return false;
      if (!entry.setCredits?.[muscle]) return false;
      return isExerciseEquipmentAllowed(entry.equipment, selectedEquipmentNorm);
    });
    return { muscle, status, total, min: range?.min, max: range?.max, hasEquipmentCompatibleExercise };
  });

  const equipmentCoverage = {};
  for (const detail of details) equipmentCoverage[detail.muscle] = detail.hasEquipmentCompatibleExercise;

  let cause = "solver";
  if (details.some((d) => !d.hasEquipmentCompatibleExercise)) {
    cause = "equipment";
  } else if (Number(context.daysPerWeek) <= 2 || Number(context.sessionDuration) < 30) {
    cause = "schedule";
  }

  return { cause, equipmentCoverage, details };
}

function repairWorkoutProgram(program, context = {}) {
  const repairs = [];

  if (!program || !Array.isArray(program.sessions)) {
    return { program, repairs };
  }

  assignExerciseIds(program, context, repairs);
  repairDisabledPublicExercises(program, context, repairs);
  repairImagelessMobilityExercises(program, repairs);
  assignExerciseIds(program, context, repairs);
  repairEquipmentConstraints(program, context, repairs);
  // Catch-all pass: anything the small hand-curated substitution map above
  // didn't cover (most equipment mismatches) gets a same-muscle catalog
  // replacement here instead of reaching the validator unrepaired.
  repairUnmatchedEquipmentViaCatalog(program, context, repairs);
  repairDisabledPublicExercises(program, context, repairs);
  // Last content pass: anything still lacking a catalog entry (and therefore
  // a real image) is swapped for a same-muscle catalog exercise, or dropped.
  repairExercisesMissingFromCatalog(program, context, repairs);
  assignExerciseIds(program, context, repairs);
  repairSchemaDefects(program, repairs);
  enforceSelectedOnlyPrimaryTargets(program, context, repairs);
  trimUnnecessaryDirectIsolation(program, context, repairs);
  trimAccessoryExercisesForDuration(program, context, repairs);
  // Last pass: nudge weekly per-muscle set volume toward the profile's
  // target range. Runs last so it acts on the program's final exercise/set
  // shape (post equipment substitution, post duration trim) and its own
  // duration-budget check stays accurate.
  repairWeeklyVolumeTargets(program, context, repairs);
  trimUnnecessaryDirectIsolation(program, context, repairs);
  trimPreferredExcessWithoutCreatingDeficits(program, context, repairs);

  return { program, repairs };
}

module.exports = { repairWorkoutProgram, resolveExerciseId, repairWeeklyVolumeTargets, diagnoseVolumeGateFailure };
