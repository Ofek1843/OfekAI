import { totalsForEntries } from './daily-nutrition-domain.mjs?v=20260928-multilingual-food-1';

export function withDeadline(promise, ms = 12000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('TIMEOUT')), ms); })
  ]).finally(() => clearTimeout(timer));
}

export function readNutritionDraft(uid, dateKey, storage = globalThis.localStorage) {
  try {
    const draft = JSON.parse(storage.getItem(`fp-daily-log-draft-v2:${uid}:${dateKey}`) || 'null');
    return draft?.token && draft.log?.dateKey === dateKey && Array.isArray(draft.log.entries) ? draft : null;
  } catch { return null; }
}

export function nutritionTimestampMillis(updated) {
  const millis = typeof updated?.toMillis === 'function' ? updated.toMillis()
    : updated?.seconds != null ? updated.seconds * 1000 + (Number(updated.nanoseconds) || 0) / 1e6
    : typeof updated === 'string' ? Date.parse(updated) : Number(updated);
  return Number.isFinite(millis) ? millis : 0;
}

export function preferNutritionDraft(remote, draft) {
  const millis = nutritionTimestampMillis(remote?.updatedAt);
  if (!draft || (remote && draft.savedAt <= millis)) return remote;
  return { ...draft.log, totals: totalsForEntries(draft.log.entries), pendingSync: true };
}

export async function loadVisibleNutritionLog(loadRemote, uid, dateKey, storage = globalThis.localStorage) {
  let remote;
  try { remote = await withDeadline(loadRemote()); }
  catch (error) {
    const draft = readNutritionDraft(uid, dateKey, storage);
    if (!draft) throw error;
    return preferNutritionDraft(null, draft);
  }
  return preferNutritionDraft(remote, readNutritionDraft(uid, dateKey, storage));
}

// A browser Firestore stream can stall while the authenticated server remains
// available. Never treat an unread day as empty; preserve a newer local draft.
export async function loadPreviousNutritionLog({ uid, dateKey, loadClient, loadServer, storage, clientTimeout = 4000 }) {
  let remote;
  try {
    remote = await withDeadline(Promise.resolve().then(loadClient), clientTimeout);
  } catch (clientError) {
    try {
      remote = await loadServer();
    } catch (serverError) {
      const draft = readNutritionDraft(uid, dateKey, storage);
      if (draft) return preferNutritionDraft(null, draft);
      throw serverError;
    }
  }
  return preferNutritionDraft(remote, readNutritionDraft(uid, dateKey, storage));
}
