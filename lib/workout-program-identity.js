"use strict";

// A program title should describe the work the athlete actually received,
// rather than repeat a generic goal selected before generation.  This module
// deliberately derives the split from the final sessions, after catalog and
// volume repair, so a provider cannot label a mixed plan "Upper/Lower" when
// it produced a different structure.

const { canonicalizeExerciseId, getCatalogExercise } = require("./workout-exercise-catalog");

const UPPER_MUSCLES = new Set(["chest", "back", "delts", "rear_delts", "traps", "biceps", "triceps"]);
const LOWER_MUSCLES = new Set(["quads", "hamstrings", "glutes", "calves"]);
const PUSH_MUSCLES = new Set(["chest", "delts", "triceps"]);
const PULL_MUSCLES = new Set(["back", "biceps", "rear_delts", "traps"]);

const DISPLAY_NAMES = Object.freeze({
  en: {
    full: "Full Body",
    upperLower: "Upper / Lower",
    ppl: "Push / Pull / Legs",
    upper: "Upper Body",
    lower: "Lower Body",
    push: "Push",
    pull: "Pull",
    legs: "Legs",
    personalized: "Personalized Training"
  },
  he: {
    full: "פול באדי",
    upperLower: "פלג גוף עליון / תחתון",
    ppl: "פוש / פול / רגליים",
    upper: "פלג גוף עליון",
    lower: "פלג גוף תחתון",
    push: "פוש",
    pull: "פול",
    legs: "רגליים",
    personalized: "אימון אישי"
  }
});

function normalizedText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[–—_]/g, "-")
    .replace(/\s+/g, " ");
}

function splitFromExplicitSessionName(name) {
  const text = normalizedText(name);
  if (!text) return "";

  if (/\bfull\s*-?\s*body\b|\bfullbody\b|\btotal body\b|פול\s*באדי|כל\s*הגוף/.test(text)) return "full";
  // Check Push/Pull before a broader Upper-body match, so a session called
  // "Upper Push" is faithfully categorized as Push.
  if (/\bpush\b|פוש|דחיפה/.test(text)) return "push";
  if (/\bpull\b|פול|משיכה/.test(text)) return "pull";
  if (/\blegs?\b|רגליים/.test(text)) return "legs";
  if (/\blower\b|פלג\s*גוף\s*תחתון/.test(text)) return "lower";
  if (/\bupper\b|פלג\s*גוף\s*עליון/.test(text)) return "upper";
  return "";
}

function primaryMusclesForSession(session) {
  const muscles = new Set();
  for (const exercise of session?.exercises || []) {
    const exerciseId = canonicalizeExerciseId(exercise?.exerciseId || exercise?.demoName || exercise?.name || "");
    const catalogEntry = getCatalogExercise(exerciseId);
    const primary = Object.entries(catalogEntry?.setCredits || {})
      .sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0];
    if (primary) muscles.add(primary);
  }
  return muscles;
}

function hasAny(muscles, candidates) {
  return [...candidates].some((muscle) => muscles.has(muscle));
}

function splitFromSessionExercises(session) {
  const muscles = primaryMusclesForSession(session);
  const hasUpper = hasAny(muscles, UPPER_MUSCLES);
  const hasLower = hasAny(muscles, LOWER_MUSCLES);
  const hasPush = hasAny(muscles, PUSH_MUSCLES);
  const hasPull = hasAny(muscles, PULL_MUSCLES);

  if (hasUpper && hasLower) return "full";
  if (hasLower) return "lower";
  if (hasPush && hasPull) return "upper";
  if (hasPush) return "push";
  if (hasPull) return "pull";
  return "";
}

function classifySessionSplit(session) {
  return splitFromExplicitSessionName(session?.name) || splitFromSessionExercises(session);
}

function deriveProgramSplitKey(sessions = []) {
  const splitSet = new Set((Array.isArray(sessions) ? sessions : [])
    .map(classifySessionSplit)
    .filter(Boolean));

  const hasFull = splitSet.has("full");
  const hasUpperLower = splitSet.has("upper") && (splitSet.has("lower") || splitSet.has("legs"));
  const hasPpl = splitSet.has("push") && splitSet.has("pull") && (splitSet.has("lower") || splitSet.has("legs"));
  const components = [];

  if (hasFull) components.push("full");
  if (hasPpl) components.push("ppl");
  if (hasUpperLower) components.push("upperLower");

  // A partial split is still more truthful than a generic program title.
  if (!hasPpl && !hasUpperLower) {
    for (const key of ["upper", "lower", "legs", "push", "pull"]) {
      if (splitSet.has(key)) components.push(key);
    }
  }

  return components.length ? components : ["personalized"];
}

function deriveProgramSplitName(sessions = [], language = "en") {
  const locale = language === "he" ? "he" : "en";
  const names = DISPLAY_NAMES[locale];
  return deriveProgramSplitKey(sessions).map((key) => names[key]).join(" + ");
}

function applyProgramSplitIdentity(program, { language = "en" } = {}) {
  if (!program || !Array.isArray(program.sessions)) return program;
  program.programName = deriveProgramSplitName(program.sessions, language);
  program.programSplit = deriveProgramSplitKey(program.sessions);
  return program;
}

module.exports = {
  applyProgramSplitIdentity,
  classifySessionSplit,
  deriveProgramSplitKey,
  deriveProgramSplitName,
  splitFromSessionExercises
};
