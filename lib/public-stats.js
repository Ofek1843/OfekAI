const crypto = require("crypto");
const { serviceAccount, firebaseAccessToken } = require("./payplus-billing");
const { isRealRegisteredUser, summarizePublicStats } = require("./fuelphysique-policy");

let cache = null;
const CACHE_TTL_MS = Number(process.env.PUBLIC_STATS_CACHE_TTL_MS || 60_000);

function collectionPath(projectId, path) {
  return `projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${path}`;
}

async function listAllDocuments(collectionName) {
  const account = serviceAccount();
  const token = await firebaseAccessToken();
  const docs = [];
  let pageToken = "";
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/${collectionPath(account.project_id, collectionName)}`);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    url.searchParams.set("mask.fieldPaths", "email");
    url.searchParams.append("mask.fieldPaths", "status");
    url.searchParams.append("mask.fieldPaths", "role");
    url.searchParams.append("mask.fieldPaths", "deletedAt");
    url.searchParams.append("mask.fieldPaths", "deleted");
    url.searchParams.append("mask.fieldPaths", "isDeleted");
    url.searchParams.append("mask.fieldPaths", "banned");
    url.searchParams.append("mask.fieldPaths", "blocked");
    url.searchParams.append("mask.fieldPaths", "source");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(`Firestore list failed for ${collectionName}`), { status: 502, details: data });
    const pageDocs = Array.isArray(data.documents) ? data.documents : [];
    docs.push(...pageDocs.map(doc => ({ name: doc.name, ...flattenFirestoreFields(doc.fields || {}) })));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return docs;
}

function flattenFirestoreFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (value?.stringValue !== undefined) out[key] = value.stringValue;
    else if (value?.booleanValue !== undefined) out[key] = Boolean(value.booleanValue);
    else if (value?.integerValue !== undefined) out[key] = Number(value.integerValue);
    else if (value?.doubleValue !== undefined) out[key] = Number(value.doubleValue);
    else if (value?.timestampValue !== undefined) out[key] = value.timestampValue;
    else if (value?.mapValue?.fields) out[key] = flattenFirestoreFields(value.mapValue.fields);
    else if (value?.arrayValue?.values) out[key] = value.arrayValue.values.map(entry => flattenFirestoreValue(entry));
  }
  return out;
}

function flattenFirestoreValue(value) {
  if (!value || typeof value !== "object") return value;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.booleanValue !== undefined) return Boolean(value.booleanValue);
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.mapValue?.fields) return flattenFirestoreFields(value.mapValue.fields);
  if (value.arrayValue?.values) return value.arrayValue.values.map(flattenFirestoreValue);
  return value;
}

async function runCollectionGroupCount(collectionId) {
  const account = serviceAccount();
  const token = await firebaseAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId, allDescendants: true }],
      select: { fields: [{ fieldPath: "__name__" }] },
      where: {
        fieldFilter: {
          field: { fieldPath: "__name__" },
          op: "GREATER_THAN_OR_EQUAL",
          value: { stringValue: "" }
        }
      },
      limit: 3000
    }
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const lines = await response.json();
  if (!response.ok) throw Object.assign(new Error(`Firestore collection-group query failed for ${collectionId}`), { status: 502, details: lines });
  return lines.map(item => flattenFirestoreFields(item.document?.fields || {}));
}

async function getPublicStats() {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const [users, workoutPlans, nutritionPlans, workoutLogs] = await Promise.all([
    listAllDocuments("users"),
    runCollectionGroupCount("workoutPlans"),
    runCollectionGroupCount("nutritionPlans"),
    runCollectionGroupCount("workoutLogs")
  ]);
  const value = summarizePublicStats({ users, workoutPlans, nutritionPlans, workoutLogs });
  cache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
  return value;
}

module.exports = {
  flattenFirestoreFields,
  getPublicStats,
  isRealRegisteredUser
};
