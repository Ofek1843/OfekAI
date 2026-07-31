// Server-side guarantee that a workout generated in one language does not
// ship user-facing text in the other.
//
// The generation prompt already asks for single-language output, but the same
// prompt contains Hebrew equipment/muscle tables and Hebrew few-shot wording,
// and models leak from them. Live generation in English mode produced a Hebrew
// program title, a Hebrew goal, Hebrew coaching notes and Hebrew unit words
// inside otherwise-numeric rep ranges. Prompt compliance is not trusted:
// anything user-facing is rewritten here before the response is sent.
//
// This lives in lib/ rather than inline in server.js so it is unit-testable
// and so the reroll endpoint and the generate endpoint cannot drift apart.

const HEBREW_CHAR_RANGE = /[֐-׿]/;

// Reverse of the Hebrew equipment/muscle translation table the generation
// prompt hands the model -- used only to repair language leakage into an
// English response, never for validation (lib/workout-validator.js's
// normalizeEquipment accepts the same Hebrew forms so a valid Hebrew-labelled
// equipment value is not wrongly rejected).
const HEBREW_TO_ENGLISH_EQUIPMENT = {
  "משקל גוף": "Bodyweight",
  מתח: "Pull-up Bar",
  מכונה: "Machine",
  מכונות: "Machine",
  "משקולת יד": "Dumbbell",
  "משקולות יד": "Dumbbell",
  מוט: "Barbell",
  "מוט ומשקולות": "Barbell",
  כבל: "Cable",
  כבלים: "Cable",
  טבעות: "Gymnastic Rings"
};

const HEBREW_TO_ENGLISH_MUSCLE = {
  חזה: "Chest",
  גב: "Back",
  כתפיים: "Shoulders",
  "יד קדמית": "Biceps",
  "יד אחורית": "Triceps",
  "ארבע ראשי": "Quads",
  המסטרינג: "Hamstrings",
  ישבן: "Glutes",
  תאומים: "Calves",
  ליבה: "Core",
  "כל הגוף": "Full Body"
};

// The prompt hands the model the raw goal slug ("Goal: improveSkills") and
// expects readable text back in program.goal. Unlike exercise names there is
// no English twin field to fall back to, so the canonical label is rebuilt
// from the slug the user actually submitted.
const GOAL_LABELS = {
  buildMuscle: "Build Muscle",
  loseFat: "Lose Fat",
  increaseStrength: "Increase Strength",
  improveSkills: "Improve Calisthenics Skills",
  maintainPerformance: "Maintain Performance"
};

// Hebrew words that appear inside an otherwise-numeric reps string for
// duration-based work ("30-45 שניות", "20-30 שניות לכל צד"). The numeric range
// is still useful, so the unit word is translated in place rather than
// discarding the field.
const HEBREW_REPS_UNIT_WORDS = {
  שניות: "seconds",
  שנייה: "second",
  חזרות: "reps",
  חזרה: "rep",
  "לכל צד": "per side",
  "לכל רגל": "per leg",
  "לכל יד": "per arm",
  "כל צד": "each side"
};

function sanitizeRepsUnitWords(reps) {
  let result = reps;
  for (const [hebrew, english] of Object.entries(HEBREW_REPS_UNIT_WORDS)) {
    result = result.split(hebrew).join(english);
  }
  return result;
}

/**
 * Rewrites Hebrew text left in an English program's user-facing fields.
 * Mutates in place and returns nothing, matching the previous inline helper.
 *
 * @param {object} program            the generated program
 * @param {string} [requestedGoal]    the goal slug the user submitted
 */
function sanitizeLanguageLeakage(program, requestedGoal = "") {
  if (!Array.isArray(program?.sessions)) return;

  if (typeof program.programName === "string" && HEBREW_CHAR_RANGE.test(program.programName)) {
    program.programName = "Workout Program";
  }

  if (typeof program.goal === "string" && HEBREW_CHAR_RANGE.test(program.goal)) {
    program.goal = GOAL_LABELS[requestedGoal] || "Workout Goal";
  }

  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    if (typeof session?.name === "string" && HEBREW_CHAR_RANGE.test(session.name)) {
      session.name = `Day ${i + 1}`;
    }
    if (!Array.isArray(session?.exercises)) continue;

    for (const exercise of session.exercises) {
      if (typeof exercise.equipment === "string" && HEBREW_CHAR_RANGE.test(exercise.equipment)) {
        exercise.equipment = HEBREW_TO_ENGLISH_EQUIPMENT[exercise.equipment.trim()] || exercise.equipment;
      }
      if (typeof exercise.muscleGroup === "string" && HEBREW_CHAR_RANGE.test(exercise.muscleGroup)) {
        exercise.muscleGroup = HEBREW_TO_ENGLISH_MUSCLE[exercise.muscleGroup.trim()] || exercise.muscleGroup;
      }
      // demoName is the prompt-guaranteed English name (hidden technical
      // metadata used for media lookup) -- the most reliable English fallback
      // available when the user-facing name itself leaked Hebrew.
      if (
        typeof exercise.name === "string" &&
        HEBREW_CHAR_RANGE.test(exercise.name) &&
        typeof exercise.demoName === "string" &&
        exercise.demoName.trim() &&
        !HEBREW_CHAR_RANGE.test(exercise.demoName)
      ) {
        exercise.name = exercise.demoName.trim();
      }
      // notes is free-form coaching guidance with no English twin field, so
      // there is nothing correct to translate it to -- drop it rather than
      // show Hebrew prose inside an English program.
      if (typeof exercise.notes === "string" && HEBREW_CHAR_RANGE.test(exercise.notes)) {
        exercise.notes = "";
      }
      if (typeof exercise.reps === "string" && HEBREW_CHAR_RANGE.test(exercise.reps)) {
        exercise.reps = sanitizeRepsUnitWords(exercise.reps);
      }
    }
  }
}

/**
 * Reports every user-facing field still carrying the wrong script, so a
 * release check can assert zero leakage instead of eyeballing a program.
 * Proper nouns that are intentionally Latin in Hebrew mode (FuelPhysique, RIR)
 * are ignored.
 */
const ALLOWED_LATIN_IN_HEBREW = /FuelPhysique|RIR|AMRAP|EMOM|HIIT|kg|cm|min|sec/gi;

function findLanguageLeaks(program, language) {
  const leaks = [];
  const wantsHebrew = language === "he";

  const check = (path, value) => {
    if (typeof value !== "string" || !value.trim()) return;
    const hasHebrew = HEBREW_CHAR_RANGE.test(value);
    if (wantsHebrew) {
      // In Hebrew mode, flag a field that is entirely Latin prose once the
      // allowed proper nouns and numbers are removed.
      const stripped = value.replace(ALLOWED_LATIN_IN_HEBREW, "").replace(/[^A-Za-z]/g, "");
      if (!hasHebrew && stripped.length > 3) leaks.push({ path, value, expected: "he" });
    } else if (hasHebrew) {
      leaks.push({ path, value, expected: "en" });
    }
  };

  check("programName", program?.programName);
  check("goal", program?.goal);
  for (const [i, session] of (program?.sessions || []).entries()) {
    check(`sessions[${i}].name`, session?.name);
    for (const [j, exercise] of (session?.exercises || []).entries()) {
      const base = `sessions[${i}].exercises[${j}]`;
      check(`${base}.name`, exercise?.name);
      check(`${base}.muscleGroup`, exercise?.muscleGroup);
      check(`${base}.equipment`, exercise?.equipment);
      check(`${base}.notes`, exercise?.notes);
      check(`${base}.reps`, exercise?.reps);
    }
  }
  return leaks;
}

module.exports = {
  GOAL_LABELS,
  HEBREW_CHAR_RANGE,
  HEBREW_TO_ENGLISH_EQUIPMENT,
  HEBREW_TO_ENGLISH_MUSCLE,
  findLanguageLeaks,
  sanitizeLanguageLeakage
};
