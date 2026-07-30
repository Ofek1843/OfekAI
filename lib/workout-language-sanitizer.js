const HEBREW_CHAR_RANGE = /[֐-׿]/;

// Reverse of the Hebrew equipment/muscle translation table the generation
// prompt hands the model — used only to fix language leakage into an
// English response, not for validation (lib/workout-validator.js's
// normalizeEquipment covers that with the same Hebrew forms so valid
// Hebrew-labeled equipment isn't wrongly rejected).
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

// The prompt hands the model the raw goal slug (e.g. "Goal: improveSkills")
// and expects it back in program.goal as readable text — with no English
// label to fall back to, unlike programName. Cover the 5 canonical slugs so
// a Hebrew leak here still resolves to a correct label, not a generic one.
const GOAL_LABELS = {
  buildMuscle: "Build Muscle",
  loseFat: "Lose Fat",
  increaseStrength: "Increase Strength",
  improveSkills: "Improve Calisthenics Skills",
  maintainPerformance: "Maintain Performance"
};

// Hebrew unit words that can appear inside an otherwise-numeric reps string
// (e.g. duration-based exercises like planks: "30-45 שניות"). Word-replaced
// rather than clearing the whole field — the numeric range is still useful.
const HEBREW_REPS_UNIT_WORDS = {
  שניות: "seconds",
  שנייה: "second",
  חזרות: "reps",
  חזרה: "rep",
  "לכל צד": "per side"
};

function sanitizeRepsUnitWords(reps) {
  let result = reps;
  for (const [hebrew, english] of Object.entries(HEBREW_REPS_UNIT_WORDS)) {
    result = result.split(hebrew).join(english);
  }
  return result;
}

// Rewrites any Hebrew text left in a program's user-facing fields to its
// English equivalent, in place. Called only when the user selected English
// — the generation prompt already asks for English-only output, but models
// don't always comply (their own Hebrew few-shot examples in the same
// prompt can leak through), so this is enforced server-side rather than
// trusted to prompt compliance.
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
      // metadata used for media lookup) — the most reliable English
      // fallback available if the user-facing name itself leaked Hebrew.
      if (
        typeof exercise.name === "string" &&
        HEBREW_CHAR_RANGE.test(exercise.name) &&
        typeof exercise.demoName === "string" &&
        exercise.demoName.trim() &&
        !HEBREW_CHAR_RANGE.test(exercise.demoName)
      ) {
        exercise.name = exercise.demoName.trim();
      }
      // notes is free-form coaching guidance with no reliable English
      // source to fall back to (unlike name/demoName) — drop it rather than
      // show the user Hebrew text in an English-language program.
      if (typeof exercise.notes === "string" && HEBREW_CHAR_RANGE.test(exercise.notes)) {
        exercise.notes = "";
      }
      // reps can be a duration string ("30-45 seconds") rather than a rep
      // count for time-based exercises like planks — only the Hebrew unit
      // word leaks here, so translate it in place instead of discarding the
      // still-useful numeric range.
      if (typeof exercise.reps === "string" && HEBREW_CHAR_RANGE.test(exercise.reps)) {
        exercise.reps = sanitizeRepsUnitWords(exercise.reps);
      }
    }
  }
}

module.exports = { sanitizeLanguageLeakage, HEBREW_CHAR_RANGE };
