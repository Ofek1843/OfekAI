import { loadVisibleNutritionLog, withDeadline } from './daily-nutrition-recovery.mjs';

// A missing remote document resolves to an empty log. A failed read must not
// silently become zero: try the authenticated server channel, then show a
// local unsynced draft (if one exists), otherwise leave the error visible.
export function loadDashboardDay({ uid, dateKey, loadClient, loadServer, storage = globalThis.localStorage }) {
  return loadVisibleNutritionLog(async () => {
    try { return await withDeadline(loadClient(), 4500); }
    catch (clientError) {
      try { return await withDeadline(loadServer(), 6500); }
      catch { throw clientError; }
    }
  }, uid, dateKey, storage);
}
