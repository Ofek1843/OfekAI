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

const { slugifyExerciseId } = require("./workout-volume");
const { estimateSessionDuration } = require("./workout-duration");
const { EXERCISE_NAME_ALIASES } = require("./workout-exercise-aliases");
const { EXERCISE_SETCREDITS } = require("./workout-setcredits-map");
const { normalizeEquipment } = require("./workout-validator");

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

function isExerciseEquipmentAllowed(equipmentValue, selectedEquipmentNorm) {
  const normalized = normalizeEquipment(equipmentValue);
  if (normalized === "bodyweight") return true;
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

function repairWorkoutProgram(program, context = {}) {
  const repairs = [];

  if (!program || !Array.isArray(program.sessions)) {
    return { program, repairs };
  }

  assignExerciseIds(program, repairs);
  repairEquipmentConstraints(program, context, repairs);
  assignExerciseIds(program, repairs);
  repairSchemaDefects(program, repairs);
  trimAccessoryExercisesForDuration(program, context, repairs);

  return { program, repairs };
}

module.exports = { repairWorkoutProgram, resolveExerciseId };
