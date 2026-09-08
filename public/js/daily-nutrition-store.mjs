import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import { shiftDateKey, totalsForEntries, weekDateKeys } from "./daily-nutrition-domain.mjs";

const MAX_DAILY_ENTRIES = 80;

function assertIdentity(uid) {
  const value = String(uid || "").trim();
  if (!value || value.includes("/")) throw new Error("INVALID_USER");
  return value;
}

function dailyLogRef(db, uid, dateKey) {
  return doc(db, "users", assertIdentity(uid), "dailyNutritionLogs", dateKey);
}

function normalizeEntry(entry, index = 0) {
  const estimatedGrams = Number(entry.estimatedGrams);
  const portionCount = Number(entry.portionCount);
  const confidence = ["high", "medium", "low"].includes(entry.estimateConfidence) ? entry.estimateConfidence : null;
  const value = {
    id: String(entry.id || `entry-${Date.now()}-${index}`).slice(0, 120),
    foodId: String(entry.foodId || "").slice(0, 120),
    name: {
      en: String(entry.name?.en || entry.name || "Food").slice(0, 100),
      he: String(entry.name?.he || entry.name?.en || entry.name || "מזון").slice(0, 100)
    },
    amount: Number(entry.amount),
    unit: String(entry.unit || "item").slice(0, 20),
    calories: Number(entry.calories),
    proteinGrams: Number(entry.proteinGrams),
    carbsGrams: Number(entry.carbsGrams),
    fatGrams: Number(entry.fatGrams),
    source: String(entry.source || "catalog").slice(0, 30),
    rawText: String(entry.rawText || "").slice(0, 180),
    estimated: entry.estimated === true,
    approximate: entry.approximate === true,
    estimateConfidence: confidence,
    estimateReason: String(entry.estimateReason || "").slice(0, 30) || null,
    estimatedGrams: Number.isFinite(estimatedGrams) && estimatedGrams > 0 ? estimatedGrams : null,
    portionCount: Number.isFinite(portionCount) && portionCount > 0 ? portionCount : null,
    portionSize: String(entry.portionSize || "").slice(0, 20) || null,
    portionKind: String(entry.portionKind || "").slice(0, 20) || null,
    compositeEstimate: entry.compositeEstimate === true
  };
  if ([value.amount, value.calories, value.proteinGrams, value.carbsGrams, value.fatGrams].some((number) => !Number.isFinite(number) || number < 0)) {
    throw new Error("INVALID_ENTRY");
  }
  return value;
}

function normalizeLog(dateKey, raw = {}) {
  const entries = (Array.isArray(raw.entries) ? raw.entries : []).slice(0, MAX_DAILY_ENTRIES).map(normalizeEntry);
  return {
    schemaVersion: 1,
    dateKey,
    entries,
    totals: totalsForEntries(entries),
    targetSnapshot: raw.targetSnapshot && typeof raw.targetSnapshot === "object" ? raw.targetSnapshot : null,
    maintenanceSnapshot: Number(raw.maintenanceSnapshot || raw.targetSnapshot?.maintenanceCalories || 0) || null,
    completed: raw.completed === true,
    completedAt: raw.completedAt || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null
  };
}

async function loadDailyLog(db, uid, dateKey) {
  const snapshot = await getDoc(dailyLogRef(db, uid, dateKey));
  return snapshot.exists() ? normalizeLog(dateKey, snapshot.data()) : normalizeLog(dateKey);
}

async function saveDailyLog(db, uid, dateKey, log) {
  const value = normalizeLog(dateKey, log);
  const reference = dailyLogRef(db, uid, dateKey);
  const existing = await getDoc(reference);
  const payload = {
    schemaVersion: 1,
    dateKey,
    entries: value.entries,
    totals: value.totals,
    targetSnapshot: value.targetSnapshot,
    maintenanceSnapshot: value.maintenanceSnapshot,
    completed: value.completed,
    completedAt: value.completed ? (value.completedAt || serverTimestamp()) : null,
    updatedAt: serverTimestamp()
  };
  if (!existing.exists()) payload.createdAt = serverTimestamp();
  await setDoc(reference, payload, { merge: true });
  return value;
}

async function loadNutritionWeek(db, uid, anchorDateKey) {
  const keys = weekDateKeys(anchorDateKey);
  return Promise.all(keys.map((dateKey) => loadDailyLog(db, uid, dateKey)));
}

async function copyPreviousDay(db, uid, destinationDateKey, idFactory = () => crypto.randomUUID()) {
  const previous = await loadDailyLog(db, uid, shiftDateKey(destinationDateKey, -1));
  const destination = await loadDailyLog(db, uid, destinationDateKey);
  const copied = previous.entries.map((entry) => ({ ...entry, id: idFactory(), copiedFromDate: previous.dateKey }));
  const result = normalizeLog(destinationDateKey, {
    ...destination,
    entries: [...destination.entries, ...copied].slice(0, MAX_DAILY_ENTRIES),
    completed: false,
    completedAt: null
  });
  await saveDailyLog(db, uid, destinationDateKey, result);
  return { log: result, copiedCount: copied.length };
}

function customFoodRef(db, uid, foodId) {
  return doc(db, "users", assertIdentity(uid), "customFoods", foodId);
}

async function loadCustomFoods(db, uid) {
  const snapshot = await getDocs(collection(db, "users", assertIdentity(uid), "customFoods"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function saveCustomFood(db, uid, food) {
  const foodId = String(food.id || "").trim();
  if (!foodId || foodId.includes("/")) throw new Error("INVALID_CUSTOM_FOOD");
  await setDoc(customFoodRef(db, uid, foodId), { ...food, updatedAt: serverTimestamp() }, { merge: true });
  return food;
}

async function deleteCustomFood(db, uid, foodId) {
  await deleteDoc(customFoodRef(db, uid, foodId));
}

function combinationRef(db, uid, combinationId) {
  return doc(db, "users", assertIdentity(uid), "savedFoodCombinations", combinationId);
}

async function loadSavedCombinations(db, uid) {
  const snapshot = await getDocs(collection(db, "users", assertIdentity(uid), "savedFoodCombinations"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function saveFoodCombination(db, uid, combination) {
  const id = String(combination.id || `combination-${Date.now()}`).replace(/[^a-z0-9-]/gi, "-").slice(0, 100);
  const entries = (combination.entries || []).slice(0, 20).map(normalizeEntry);
  if (!String(combination.name || "").trim() || !entries.length) throw new Error("INVALID_COMBINATION");
  const value = { id, name: String(combination.name).trim().slice(0, 80), entries, updatedAt: serverTimestamp() };
  await setDoc(combinationRef(db, uid, id), value, { merge: true });
  return { ...value, updatedAt: null };
}

export {
  MAX_DAILY_ENTRIES,
  copyPreviousDay,
  dailyLogRef,
  deleteCustomFood,
  loadCustomFoods,
  loadDailyLog,
  loadNutritionWeek,
  loadSavedCombinations,
  normalizeEntry,
  normalizeLog,
  saveCustomFood,
  saveDailyLog,
  saveFoodCombination
};
