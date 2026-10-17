"use strict";

const MAX_ENTRIES = 80;
const NUMBER_FIELDS = ["amount", "calories", "proteinGrams", "carbsGrams", "fatGrams"];
const STRING_FIELDS = {
  id: 120, foodId: 120, unit: 20, source: 30, rawText: 180,
  estimateReason: 30, portionSize: 20, portionKind: 20
};
const REFERENCE_FIELDS = {
  source: 160, status: 160, dataType: 160, url: 500, version: 160,
  publicationDate: 160, retrievedAt: 160, state: 160, basisUnit: 160, policy: 160
};

function invalid() {
  const error = new Error("INVALID_DAILY_LOG");
  error.status = 400;
  throw error;
}

function plain(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value, limit) {
  if (value == null) return "";
  if (typeof value !== "string") invalid();
  return value.slice(0, limit);
}

function optionalNumber(value, max = 100000) {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) invalid();
  return value;
}

function normalizeReference(reference) {
  if (reference == null) return null;
  if (!plain(reference)) invalid();
  const result = {};
  for (const [field, limit] of Object.entries(REFERENCE_FIELDS)) {
    if (reference[field] != null) result[field] = optionalString(reference[field], limit);
  }
  if (reference.recordId != null) {
    if (!Number.isSafeInteger(reference.recordId) || reference.recordId < 1) invalid();
    result.recordId = reference.recordId;
  }
  if (reference.basisAmount != null) result.basisAmount = optionalNumber(reference.basisAmount);
  if (reference.ediblePortion != null) {
    if (typeof reference.ediblePortion !== "boolean") invalid();
    result.ediblePortion = reference.ediblePortion;
  }
  return Object.keys(result).length ? result : null;
}

function normalizeEntry(entry) {
  if (!plain(entry) || !plain(entry.name)) invalid();
  const result = {};
  for (const [field, limit] of Object.entries(STRING_FIELDS)) {
    result[field] = optionalString(entry[field], limit);
  }
  if (!result.id) invalid();
  result.name = {
    en: optionalString(entry.name.en, 100),
    he: optionalString(entry.name.he, 100)
  };
  if (!result.name.en && !result.name.he) invalid();
  result.unit ||= "item";
  result.source ||= "catalog";
  for (const field of ["estimateReason", "portionSize", "portionKind"]) result[field] ||= null;
  for (const field of NUMBER_FIELDS) {
    result[field] = optionalNumber(entry[field]);
    if (result[field] == null) invalid();
  }
  for (const field of ["estimated", "approximate", "compositeEstimate"]) result[field] = entry[field] === true;
  result.estimateConfidence = ["high", "medium", "low"].includes(entry.estimateConfidence) ? entry.estimateConfidence : null;
  result.estimatedGrams = optionalNumber(entry.estimatedGrams) || null;
  result.portionCount = optionalNumber(entry.portionCount) || null;
  result.reference = normalizeReference(entry.reference);
  return result;
}

function normalizeTargetSnapshot(target) {
  if (target == null) return null;
  if (!plain(target)) invalid();
  const result = {};
  for (const field of ["dailyCalories", "proteinGrams", "carbsGrams", "fatGrams", "maintenanceCalories"]) {
    result[field] = optionalNumber(target[field]);
  }
  result.source = optionalString(target.source, 30);
  result.complete = target.complete === true;
  return result;
}

function normalizeDailyNutritionWrite(log) {
  if (!plain(log) || !Array.isArray(log.entries) || log.entries.length > MAX_ENTRIES || typeof log.completed !== "boolean") invalid();
  const entries = log.entries.map(normalizeEntry);
  const ids = new Set(entries.map((entry) => entry.id));
  if (ids.size !== entries.length) invalid();
  const totals = entries.reduce((sum, entry) => {
    for (const field of ["calories", "proteinGrams", "carbsGrams", "fatGrams"]) {
      sum[field] = Math.round((sum[field] + entry[field]) * 10) / 10;
    }
    return sum;
  }, { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
  const targetSnapshot = normalizeTargetSnapshot(log.targetSnapshot);
  const maintenanceSnapshot = optionalNumber(log.maintenanceSnapshot) || targetSnapshot?.maintenanceCalories || null;
  return {
    schemaVersion: 1, entries, totals, targetSnapshot, maintenanceSnapshot,
    completed: log.completed,
    completedAt: log.completed ? new Date().toISOString() : null
  };
}

module.exports = { normalizeDailyNutritionWrite };
