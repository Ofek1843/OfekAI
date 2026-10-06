"use strict";

// A program title should describe the work the athlete actually received,
// rather than repeat a generic goal selected before generation.  This module
// deliberately derives the split from the final sessions, after catalog and
// volume repair, so a provider cannot label a mixed plan "Upper/Lower" when
// it produced a different structure.

const { canonicalizeExerciseId, getCatalogExercise } = require("./workout-exercise-catalog");

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

function classifyExplicitSessionSplit(session) {
  return classifyDeclaredSessionSplit(session) || splitFromExplicitSessionName(session?.name);
}

function classifyDeclaredSessionSplit(session) {
  const declared = normalizedText(session?.splitType || session?.workoutType || "");
  return new Map([
    ["full", "full"], ["full body", "full"], ["full-body", "full"],
    ["upper", "upper"], ["upper body", "upper"],
    ["lower", "lower"], ["lower body", "lower"],
    ["push", "push"], ["pull", "pull"], ["legs", "legs"], ["leg", "legs"]
  ]).get(declared);
}

function movementRolesForSession(session) {
  const roles = new Set();
  for (const exercise of session?.exercises || []) {
    const exerciseId = canonicalizeExerciseId(exercise?.exerciseId || exercise?.demoName || exercise?.name || "");
    const catalogEntry = getCatalogExercise(exerciseId);
    // Use the programming role for identity too, not just set credits. A
    // hip hinge with substantial back credit must not become an Upper day.
    const role = catalogEntry?.splitRole;
    if (role) roles.add(role);
  }
  return roles;
}

function splitFromSessionExercises(session) {
  const roles = movementRolesForSession(session);
  const hasPush = roles.has("push") || roles.has("mixed-upper");
  const hasPull = roles.has("pull") || roles.has("mixed-upper");
  const hasUpper = hasPush || hasPull;
  const hasLower = roles.has("lower");

  if (hasUpper && hasLower) return "full";
  if (hasLower) return "lower";
  if (hasPush && hasPull) return "upper";
  if (hasPush) return "push";
  if (hasPull) return "pull";
  if (roles.size === 1 && roles.has("core")) return "full";
  return "";
}

function classifySessionSplit(session) {
  return classifyExplicitSessionSplit(session) || splitFromSessionExercises(session);
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
  classifyDeclaredSessionSplit,
  classifyExplicitSessionSplit,
  classifySessionSplit,
  deriveProgramSplitKey,
  deriveProgramSplitName,
  splitFromSessionExercises
};
