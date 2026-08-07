"use strict";

const crypto = require("crypto");
const { calculateWeeklyVolume } = require("./workout-volume");
const { estimateSessionDuration } = require("./workout-duration");
const { EXERCISE_SETCREDITS } = require("./workout-setcredits-map");
const { canonicalizeExerciseId } = require("./workout-exercise-catalog");
const { normalizeEquipment } = require("./workout-validator");
const { normalizeMuscleFocusContract } = require("./workout-focus");

const USERNAME_PATTERN = /^[A-Za-z0-9_](?:[A-Za-z0-9_.]{1,18}[A-Za-z0-9_])?$/;
const MESSAGE_MAX_LENGTH = 2000;
const ARTIFACT_SCHEMA_VERSION = 1;
const ARTIFACT_LIMITS = Object.freeze({
  workout: 64 * 1024,
  nutrition: 96 * 1024,
  personal_record: 16 * 1024,
  progress_graph: 16 * 1024,
  weight_progress: 16 * 1024,
  completed_workout: 24 * 1024
});
const GRAPH_PRIVACY_MODES = Object.freeze([
  "exact_values",
  "total_change",
  "percentage_change",
  "trend_only"
]);
const PUBLIC_BADGES = Object.freeze(["athlete", "pro", "coach", "developer"]);

class SocialError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.name = "SocialError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function cleanString(value, max = 120) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanBio(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 160);
}

function sanitizeProfilePhotoURL(value, { imageKitEndpoint = process.env.IMAGEKIT_URL_ENDPOINT } = {}) {
  const raw = cleanString(value, 1000);
  if (!raw) return "";
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new SocialError("invalid_profile_photo", "Choose a valid profile photo.");
  }
  if (parsed.protocol !== "https:") {
    throw new SocialError("invalid_profile_photo", "Profile photos must use HTTPS.");
  }
  const endpoint = String(imageKitEndpoint || "").trim().replace(/\/$/, "");
  const isImageKit = endpoint && raw.startsWith(`${endpoint}/`);
  const isGooglePhoto = /(^|\.)googleusercontent\.com$/i.test(parsed.hostname);
  if (!isImageKit && !isGooglePhoto) {
    throw new SocialError("invalid_profile_photo", "Profile photos must come from FuelPhysique photo storage or Google.");
  }
  return raw;
}

function sanitizePublicBadges(value) {
  const badges = Array.isArray(value) ? value : [];
  return [...new Set(badges.filter((badge) => PUBLIC_BADGES.includes(String(badge).toLowerCase())).map((badge) => String(badge).toLowerCase()))];
}

function derivePublicBadges({ storedBadges = [], subscription = {} } = {}) {
  const trusted = sanitizePublicBadges(storedBadges).filter((badge) => ["coach", "developer"].includes(badge));
  const isPro = String(subscription?.planId || "").toLowerCase() === "pro"
    && String(subscription?.status || "").toLowerCase() === "active";
  if (isPro) trusted.push("pro");
  return ["athlete", ...new Set(trusted)];
}

function publicRoleForBadges(badges) {
  const safe = sanitizePublicBadges(badges);
  return ["developer", "coach", "pro", "athlete"].find((badge) => safe.includes(badge)) || "athlete";
}

function finiteNumber(value, fallback = 0, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeUsername(value) {
  return cleanString(value, 20).toLowerCase();
}

function validateUsername(value) {
  const username = cleanString(value, 40);
  const usernameLower = username.toLowerCase();
  const errors = [];
  if (username.length < 3 || username.length > 20) errors.push("length");
  if (!USERNAME_PATTERN.test(username)) errors.push("characters_or_edge_period");
  if (username.includes("..")) errors.push("repeated_period");
  return { ok: errors.length === 0, username, usernameLower, errors };
}

function canonicalPair(firstUid, secondUid) {
  const first = cleanString(firstUid, 128);
  const second = cleanString(secondUid, 128);
  if (!first || !second || first === second) {
    throw new SocialError("invalid_pair", "Two different users are required.");
  }
  return [first, second].sort();
}

function pairKey(firstUid, secondUid) {
  return canonicalPair(firstUid, secondUid).map((uid) => encodeURIComponent(uid)).join("__");
}

function sanitizeMessage(value) {
  const text = String(value ?? "").replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
  if (!text) throw new SocialError("empty_message", "Write a message before sending.");
  if ([...text].length > MESSAGE_MAX_LENGTH) {
    throw new SocialError("message_too_long", `Messages can contain up to ${MESSAGE_MAX_LENGTH} characters.`);
  }
  return text;
}

function sanitizeClientId(value) {
  const clientId = cleanString(value, 80);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(clientId)) {
    throw new SocialError("invalid_client_id", "A valid message idempotency key is required.");
  }
  return clientId;
}

function imagePath(value, root) {
  const image = cleanString(value, 240);
  return image.startsWith(root) && !image.includes("..") ? image : "";
}

function sanitizeExercise(exercise = {}) {
  const name = cleanString(exercise.name || exercise.exercise || exercise.demoName, 100) || "Exercise";
  const exerciseId = canonicalizeExerciseId(exercise.exerciseId || exercise.id || exercise.demoName || name);
  const restFromText = String(exercise.rest || "").match(/\d+/)?.[0];
  return {
    exerciseId,
    name,
    demoName: cleanString(exercise.demoName || name, 100),
    sets: Math.round(finiteNumber(exercise.sets, 1, 1, 20)),
    reps: cleanString(exercise.reps || exercise.repRange || "", 32),
    restSeconds: Math.round(finiteNumber(exercise.restSeconds ?? restFromText, 90, 0, 600)),
    rir: finiteNumber(exercise.rir ?? exercise.RIR, 0, 0, 10),
    equipment: cleanString(exercise.equipment, 60)
  };
}

function sanitizeWorkoutSnapshot(source = {}, creatorUsername = "") {
  const plan = source.plan && typeof source.plan === "object" ? source.plan : source;
  const muscleFocus = normalizeMuscleFocusContract(plan, { strict: false });
  const sessions = (Array.isArray(plan.sessions) ? plan.sessions : []).slice(0, 7).map((session, index) => ({
    name: cleanString(session.name || session.title, 80) || `Session ${index + 1}`,
    exercises: (Array.isArray(session.exercises) ? session.exercises : []).slice(0, 20).map(sanitizeExercise)
  })).filter((session) => session.exercises.length);
  if (!sessions.length) throw new SocialError("invalid_workout", "This workout has no shareable sessions.");
  const normalizedPlan = { sessions };
  const volume = calculateWeeklyVolume(normalizedPlan, EXERCISE_SETCREDITS);
  const equipment = [...new Set([
    ...(Array.isArray(plan.equipment) ? plan.equipment : []),
    ...sessions.flatMap((session) => session.exercises.map((exercise) => exercise.equipment))
  ].map((item) => normalizeEquipment(item) || cleanString(item, 60)).filter(Boolean))].slice(0, 20);
  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    title: cleanString(source.name || plan.programName || plan.name, 80) || "Workout Plan",
    goal: cleanString(plan.goal, 100),
    trainingStyle: cleanString(plan.trainingStyle || plan.style, 80),
    daysPerWeek: Math.round(finiteNumber(plan.daysPerWeek, sessions.length, 1, 7)),
    durationWeeks: Math.round(finiteNumber(plan.durationWeeks, 0, 0, 104)),
    estimatedSessionMinutes: Math.round(finiteNumber(plan.estimatedSessionMinutes || plan.sessionDuration, 0, 0, 360)),
    muscleFocusMode: muscleFocus.muscleFocusMode,
    selectedMuscles: muscleFocus.selectedMuscles,
    equipment,
    sessions,
    weeklyVolume: {
      totalHardSets: finiteNumber(volume.totalHardSets, 0, 0, 1000),
      mappingCoveragePercent: finiteNumber(volume.mappingCoveragePercent, 0, 0, 100),
      perMuscle: Object.fromEntries(Object.entries(volume.perMuscle || {}).slice(0, 30).map(([muscle, value]) => [
        cleanString(muscle, 40),
        finiteNumber(value?.total, 0, 0, 200)
      ]))
    },
    creatorUsername: cleanString(creatorUsername, 20)
  };
}

function sanitizeFood(food = {}) {
  return {
    name: cleanString(food.name || food.food, 100),
    amount: cleanString(food.amount || food.quantity, 60),
    calories: finiteNumber(food.calories, 0, 0, 10000),
    proteinGrams: finiteNumber(food.proteinGrams ?? food.protein, 0, 0, 1000),
    carbsGrams: finiteNumber(food.carbsGrams ?? food.carbs, 0, 0, 1000),
    fatGrams: finiteNumber(food.fatGrams ?? food.fat, 0, 0, 1000),
    image: imagePath(food.image || food.imageUrl, "/images/foods/")
  };
}

function sanitizeMeal(meal = {}, index = 0) {
  const option = Array.isArray(meal.options) ? (meal.options[0] || {}) : meal;
  const foods = (Array.isArray(option.foods) ? option.foods : Array.isArray(meal.ingredients) ? meal.ingredients : [])
    .slice(0, 30)
    .map(sanitizeFood)
    .filter((food) => food.name);
  const sums = foods.reduce((total, food) => ({
    calories: total.calories + food.calories,
    proteinGrams: total.proteinGrams + food.proteinGrams,
    carbsGrams: total.carbsGrams + food.carbsGrams,
    fatGrams: total.fatGrams + food.fatGrams
  }), { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
  return {
    name: cleanString(meal.name || meal.mealName || option.name, 100) || `Meal ${index + 1}`,
    foods,
    ...sums,
    image: imagePath(option.image || option.imageUrl || meal.image || meal.imageUrl, "/images/")
  };
}

function sanitizeNutritionSnapshot(source = {}, creatorUsername = "") {
  const plan = source.plan && typeof source.plan === "object" ? source.plan : source;
  const meals = (Array.isArray(plan.meals) ? plan.meals : []).slice(0, 10).map(sanitizeMeal).filter((meal) => meal.foods.length);
  if (!meals.length) throw new SocialError("invalid_nutrition", "This nutrition plan has no shareable meals.");
  const totals = meals.reduce((total, meal) => ({
    calories: total.calories + meal.calories,
    proteinGrams: total.proteinGrams + meal.proteinGrams,
    carbsGrams: total.carbsGrams + meal.carbsGrams,
    fatGrams: total.fatGrams + meal.fatGrams
  }), { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
  const rawTargets = source.targetSummary || plan.targetSummary || {};
  const targetSummary = {
    dailyCalories: finiteNumber(rawTargets.dailyCalories, 0, 0, 10000),
    proteinGrams: finiteNumber(rawTargets.proteinGrams, 0, 0, 1000),
    carbsGrams: finiteNumber(rawTargets.carbsGrams, 0, 0, 1000),
    fatGrams: finiteNumber(rawTargets.fatGrams, 0, 0, 1000)
  };
  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    title: cleanString(source.name || plan.planName || plan.name, 80) || "Nutrition Plan",
    dietaryStyle: cleanString(plan.dietaryStyle || plan.dietStyle, 80),
    mealCount: meals.length,
    meals,
    totals,
    targetSummary,
    creatorUsername: cleanString(creatorUsername, 20)
  };
}

function sanitizeRecordSnapshot(record = {}, creatorUsername = "") {
  const exerciseName = cleanString(record.exerciseName || record.name, 100);
  if (!exerciseName) throw new SocialError("invalid_record", "Choose a valid personal record.");
  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    exerciseId: canonicalizeExerciseId(record.exerciseId || exerciseName),
    exerciseName,
    value: finiteNumber(record.value ?? record.weightKg ?? record.durationSeconds, 0, 0, 1000000),
    unit: cleanString(record.unit || (record.durationSeconds ? "seconds" : "kg"), 24),
    repetitions: Math.round(finiteNumber(record.repetitions ?? record.reps, 0, 0, 10000)),
    achievedDate: cleanString(record.achievedDate || record.completedAt, 40),
    note: cleanString(record.note, 160),
    image: imagePath(record.image, "/images/exercises/"),
    creatorUsername: cleanString(creatorUsername, 20)
  };
}

function sanitizeCompletedWorkoutSnapshot(log = {}, creatorUsername = "") {
  const exercises = (Array.isArray(log.exercises) ? log.exercises : []).slice(0, 30).map((exercise) => ({
    exerciseId: canonicalizeExerciseId(exercise.exerciseId || exercise.name),
    name: cleanString(exercise.name, 100),
    completedSets: (Array.isArray(exercise.sets) ? exercise.sets : []).filter((set) => set.completed !== false).length
  })).filter((exercise) => exercise.name);
  if (!exercises.length) throw new SocialError("invalid_completed_workout", "This workout has no completed exercises to share.");
  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    title: cleanString(log.workoutPlanName || log.sessionName, 80) || "Completed Workout",
    completedAt: cleanString(log.completedAt, 40),
    durationSeconds: Math.round(finiteNumber(log.durationSeconds, 0, 0, 86400)),
    completedSets: Math.round(finiteNumber(log.completedSets, exercises.reduce((sum, item) => sum + item.completedSets, 0), 0, 1000)),
    totalSets: Math.round(finiteNumber(log.totalSets, 0, 0, 1000)),
    exercises,
    personalRecords: (Array.isArray(log.personalRecords) ? log.personalRecords : []).slice(0, 12).map((record) => sanitizeRecordSnapshot(record, creatorUsername)),
    creatorUsername: cleanString(creatorUsername, 20)
  };
}

function graphDirection(points) {
  if (points.length < 2) return "flat";
  const change = points.at(-1).value - points[0].value;
  if (Math.abs(change) < 0.0001) return "flat";
  return change > 0 ? "up" : "down";
}

function sanitizeGraphSnapshot(graph = {}, creatorUsername = "") {
  const privacyMode = GRAPH_PRIVACY_MODES.includes(graph.privacyMode) ? graph.privacyMode : "total_change";
  const rawPoints = (Array.isArray(graph.points) ? graph.points : []).slice(-60).map((point) => ({
    date: cleanString(point.date, 24),
    value: finiteNumber(point.value, 0, -1000000, 1000000)
  })).filter((point) => point.date);
  if (rawPoints.length < 2) throw new SocialError("insufficient_graph_data", "At least two data points are required.");
  const first = rawPoints[0].value;
  const last = rawPoints.at(-1).value;
  const totalChange = last - first;
  const percentageChange = first ? totalChange / Math.abs(first) * 100 : 0;
  const values = rawPoints.map((point) => point.value);
  const min = Math.min(...values);
  const range = Math.max(0.0001, Math.max(...values) - min);
  const trend = rawPoints.map((point) => ({ date: point.date, value: Math.round((point.value - min) / range * 1000) / 1000 }));
  const points = privacyMode === "exact_values" ? rawPoints : rawPoints.map((point) => ({ date: point.date }));
  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    graphType: cleanString(graph.graphType, 40),
    title: cleanString(graph.title, 100) || "Progress",
    privacyMode,
    unit: privacyMode === "trend_only" ? "" : cleanString(graph.unit, 20),
    dateRange: { from: rawPoints[0].date, to: rawPoints.at(-1).date },
    points,
    trend,
    summary: {
      direction: graphDirection(rawPoints),
      totalChange: privacyMode === "total_change" || privacyMode === "exact_values" ? totalChange : null,
      percentageChange: privacyMode === "percentage_change" || privacyMode === "exact_values" ? percentageChange : null
    },
    creatorUsername: cleanString(creatorUsername, 20)
  };
}

function assertArtifactSize(type, snapshot) {
  const limit = ARTIFACT_LIMITS[type];
  if (!limit) throw new SocialError("unsupported_artifact", "This share type is not supported.");
  const bytes = Buffer.byteLength(JSON.stringify(snapshot), "utf8");
  if (bytes > limit) {
    throw new SocialError("artifact_too_large", "This item is too large to share safely.", 413, { bytes, limit });
  }
  return bytes;
}

function buildWorkoutCopy(snapshot, attribution, sourceArtifactId) {
  if (snapshot?.schemaVersion !== ARTIFACT_SCHEMA_VERSION || !Array.isArray(snapshot.sessions) || !snapshot.sessions.length) {
    throw new SocialError("invalid_artifact_schema", "This workout uses an unsupported sharing format.");
  }
  const sessions = snapshot.sessions.map((session) => {
    const exercises = (session.exercises || []).map(sanitizeExercise).map((exercise) => ({
      ...exercise,
      equipment: normalizeEquipment(exercise.equipment),
      image: `/images/exercises/${exercise.exerciseId}.png`
    }));
    return {
      name: cleanString(session.name, 80),
      exercises,
      estimatedDuration: estimateSessionDuration({ exercises }).estimatedMinutes
    };
  });
  const plan = {
    programName: cleanString(snapshot.title, 80),
    goal: cleanString(snapshot.goal, 100),
    trainingStyle: cleanString(snapshot.trainingStyle, 80),
    daysPerWeek: sessions.length,
    durationWeeks: Math.round(finiteNumber(snapshot.durationWeeks, 0, 0, 104)),
    muscleFocusMode: normalizeMuscleFocusContract(snapshot, { strict: false }).muscleFocusMode,
    selectedMuscles: normalizeMuscleFocusContract(snapshot, { strict: false }).selectedMuscles,
    equipment: [...new Set((snapshot.equipment || []).map(normalizeEquipment).filter(Boolean))].slice(0, 20),
    sessions
  };
  plan.weeklyVolume = calculateWeeklyVolume(plan, EXERCISE_SETCREDITS);
  plan.estimatedSessionMinutes = Math.round(sessions.reduce((sum, session) => sum + session.estimatedDuration, 0) / sessions.length);
  return {
    name: plan.programName || "Shared Workout",
    active: false,
    plan,
    sourceType: "shared-copy",
    sourceArtifactId,
    attribution: cleanString(attribution, 80)
  };
}

function buildNutritionCopy(snapshot, attribution, sourceArtifactId) {
  if (snapshot?.schemaVersion !== ARTIFACT_SCHEMA_VERSION || !Array.isArray(snapshot.meals) || !snapshot.meals.length) {
    throw new SocialError("invalid_artifact_schema", "This nutrition plan uses an unsupported sharing format.");
  }
  const meals = snapshot.meals.map((meal, index) => {
    const clean = sanitizeMeal(meal, index);
    return {
      mealNumber: index + 1,
      name: clean.name,
      options: [{
        optionNumber: 1,
        name: clean.name,
        foods: clean.foods,
        optionCalories: clean.calories,
        optionProteinGrams: clean.proteinGrams,
        optionCarbsGrams: clean.carbsGrams,
        optionFatGrams: clean.fatGrams,
        image: clean.image
      }]
    };
  });
  const totals = meals.reduce((sum, meal) => {
    const option = meal.options[0];
    sum.calories += option.optionCalories;
    sum.proteinGrams += option.optionProteinGrams;
    sum.carbsGrams += option.optionCarbsGrams;
    sum.fatGrams += option.optionFatGrams;
    return sum;
  }, { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
  const title = cleanString(snapshot.title, 80) || "Shared Nutrition Plan";
  return {
    name: title,
    plan: {
      planName: title,
      dietaryStyle: cleanString(snapshot.dietaryStyle, 80),
      meals,
      dailyCalories: totals.calories,
      proteinGrams: totals.proteinGrams,
      carbsGrams: totals.carbsGrams,
      fatGrams: totals.fatGrams,
      actualTotals: totals,
      ...(snapshot.targetSummary ? { targetSummary: snapshot.targetSummary } : {})
    },
    sourceType: "shared-copy",
    sourceArtifactId,
    attribution: cleanString(attribution, 80)
  };
}

function stableMessageId(uid, clientId) {
  return crypto.createHash("sha256").update(`${uid}:${sanitizeClientId(clientId)}`).digest("hex").slice(0, 40);
}

module.exports = {
  ARTIFACT_LIMITS,
  ARTIFACT_SCHEMA_VERSION,
  GRAPH_PRIVACY_MODES,
  PUBLIC_BADGES,
  MESSAGE_MAX_LENGTH,
  SocialError,
  assertArtifactSize,
  buildNutritionCopy,
  buildWorkoutCopy,
  canonicalPair,
  cleanBio,
  cleanString,
  derivePublicBadges,
  normalizeUsername,
  pairKey,
  publicRoleForBadges,
  sanitizeClientId,
  sanitizeCompletedWorkoutSnapshot,
  sanitizeGraphSnapshot,
  sanitizeMessage,
  sanitizeProfilePhotoURL,
  sanitizePublicBadges,
  sanitizeNutritionSnapshot,
  sanitizeRecordSnapshot,
  sanitizeWorkoutSnapshot,
  stableMessageId,
  validateUsername
};
