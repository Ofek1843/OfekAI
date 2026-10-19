import { auth, db } from "./firebase-config.js";
import { cacheInterpretedFood, cachedWeighedFood, preparationIdentity, preparationLabels } from './food-preparation.mjs';
import { withDeadline, nutritionTimestampMillis } from "./daily-nutrition-recovery.mjs";
import { foodThumbnailMarkup, FOOD_THUMBNAIL_FALLBACK } from "./daily-food-visuals.mjs?v=20260928-multilingual-food-1";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { guardProtectedPage } from "./verification-gate.js";
import {
  localDateKey,
  macroEnergyPercentages,
  parseAmountPrefix,
  parseFoodText,
  remainingAgainstTargets,
  resolveFoodChoice,
  rescaleEntrySnapshot,
  shiftDateKey,
  targetSnapshot,
  totalsForEntries
} from "./daily-nutrition-domain.mjs?v=20261013-nutrition-recovery-1";
import {
  loadCustomFoods,
  loadDailyLog,
  loadNutritionWeek,
  loadSavedCombinations,
  normalizeLog,
  saveDailyLog,
  saveFoodCombination
} from "./daily-nutrition-store.mjs?v=20261013-nutrition-recovery-1";
import { dailyNutritionCopy } from "./daily-nutrition-i18n.mjs?v=20260928-language-coverage-1";
import {
  formatNutritionAmount,
  formatNutritionDate,
  formatNutritionNumber,
  nutritionAmountParts,
  nutritionUnitLabel
} from "./daily-nutrition-format.mjs?v=20261019-date-label-1";

const $ = (selector) => document.querySelector(selector);
const language = ["en", "he", "es", "fr", "de", "ar", "zh"].includes(localStorage.getItem("ofek-ai-language"))
  ? localStorage.getItem("ofek-ai-language")
  : "en";
document.documentElement.lang = language;
document.documentElement.dir = ["he", "ar"].includes(language) ? "rtl" : "ltr";
const copy = dailyNutritionCopy(language);
const SMART_FOODS_STORAGE_KEY = "fp-daily-smart-foods-v1";
const DAILY_DRAFT_STORAGE_PREFIX = "fp-daily-log-draft-v2";

function loadSmartFoods() {
  try {
    const stored = JSON.parse(localStorage.getItem(SMART_FOODS_STORAGE_KEY) || "[]");
    return Array.isArray(stored)
      ? stored.filter((food) => food && typeof food === "object" && String(food.id || "").startsWith("ai-food-")).slice(0, 60)
      : [];
  } catch {
    return [];
  }
}

function persistSmartFoods() {
  try {
    localStorage.setItem(SMART_FOODS_STORAGE_KEY, JSON.stringify(state.smartFoods.slice(-60)));
  } catch {
    // Storage is a convenience cache only. An unavailable localStorage must
    // never prevent the current food entry from being saved.
  }
}

function dailyDraftKey(uid, dateKey) {
  return `${DAILY_DRAFT_STORAGE_PREFIX}:${String(uid || "")}:${String(dateKey || "")}`;
}

function writeDailyDraft(uid, dateKey, log, token) {
  try {
    localStorage.setItem(dailyDraftKey(uid, dateKey), JSON.stringify({ token, savedAt: Date.now(), log }));
  } catch {
    // The Firestore path remains authoritative when browser storage is full or unavailable.
  }
}

function readDailyDraft(uid, dateKey) {
  try {
    const value = JSON.parse(localStorage.getItem(dailyDraftKey(uid, dateKey)) || "null");
    return value?.log && value.token ? value : null;
  } catch {
    return null;
  }
}

function clearDailyDraft(uid, dateKey, token) {
  try {
    const current = readDailyDraft(uid, dateKey);
    if (!token || current?.token === token) localStorage.removeItem(dailyDraftKey(uid, dateKey));
  } catch {
    // A successful Firestore save is still a successful save if cleanup is unavailable.
  }
}

function timestampMillis(value) {
  return nutritionTimestampMillis(value);
}

async function loadDailyLogFromServer(dateKey, user = state.user) {
  const token = await user.getIdToken();
  const response = await withTimeout(fetch(`/api/daily-nutrition/day/${encodeURIComponent(dateKey)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  }), 7000);
  if (!response.ok) throw new Error(`DAILY_LOG_SERVER_${response.status}`);
  const payload = await withTimeout(response.json(), 7000);
  return normalizeLog(dateKey, payload.log || {});
}

async function saveDailyLogToServer(dateKey, log, user = state.user) {
  const token = await user.getIdToken();
  const response = await fetch(`/api/daily-nutrition/day/${encodeURIComponent(dateKey)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ log }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`DAILY_LOG_SERVER_SAVE_${response.status}`);
  if ((await response.json()).saved !== true) throw new Error("DAILY_LOG_SERVER_SAVE_UNCONFIRMED");
}

function stableLogValue(value) {
  if (Array.isArray(value)) return value.map(stableLogValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableLogValue(value[key])]));
  }
  return value;
}

function sameSavedLog(first, second) {
  // The server read is authoritative; timestamps are intentionally ignored.
  // A false negative only leaves the draft available for retry, never loses it.
  return first.completed === second.completed
    && JSON.stringify(stableLogValue(first.entries)) === JSON.stringify(stableLogValue(second.entries))
    && JSON.stringify(stableLogValue(first.targetSnapshot)) === JSON.stringify(stableLogValue(second.targetSnapshot))
    && first.maintenanceSnapshot === second.maintenanceSnapshot;
}

const state = {
  user: null,
  dateKey: localDateKey(),
  log: null,
  weekLogs: [],
  customFoods: [],
  smartFoods: loadSmartFoods(),
  combinations: [],
  targets: targetSnapshot(),
  calendarMonthKey: localDateKey().slice(0, 7),
  editingId: null,
  pendingClarification: null,
  saveChain: Promise.resolve()
};

function availableFoods() {
  return [...state.customFoods, ...state.smartFoods];
}

// A loopback/offline Firestore stream can leave getDoc() pending forever. The
// daily log read must never hang the whole page: if today's document does not
// resolve quickly, fall back to a local working log so the composer stays
// usable, then recover-and-merge on the next successful save.
const LOG_LOAD_TIMEOUT_MS = 12000;
function withTimeout(promise, ms) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms))
  ]);
}

const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const format = (template, values = {}) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), String(template || ""));
const number = (value, precision = 0) => formatNutritionNumber(value, language, precision);

function amountMarkup(value, unit, precision = 1, { approximate = false, signed = false } = {}) {
  const parts = nutritionAmountParts(Math.abs(Number(value || 0)), unit, language, precision);
  const sign = signed && Number(value) > 0 ? "+" : signed && Number(value) < 0 ? "−" : "";
  const approximation = approximate ? "~" : "";
  const unitDirection = language === "he" ? ' lang="he" dir="rtl"' : ' dir="ltr"';
  return `<span class="nutrition-amount" dir="ltr"><span class="nutrition-number">${esc(`${sign}${approximation}${parts.number}`)}</span><span class="nutrition-unit"${unitDirection}>${esc(parts.unit)}</span></span>`;
}

function setAmount(element, value, unit, precision = 1, options = {}) {
  element.innerHTML = amountMarkup(value, unit, precision, options);
}

function applyLanguage() {
  document.documentElement.lang = language;
  document.documentElement.dir = ["he", "ar"].includes(language) ? "rtl" : "ltr";
  document.title = copy.pageTitle;
  document.querySelectorAll("[data-copy]").forEach((element) => {
    const value = copy[element.dataset.copy];
    if (typeof value === "string") element.textContent = value;
  });
  document.querySelectorAll("[data-copy-placeholder]").forEach((element) => {
    const value = copy[element.dataset.copyPlaceholder];
    if (typeof value === "string") element.placeholder = value;
  });
  document.querySelectorAll("[data-copy-aria]").forEach((element) => {
    const value = copy[element.dataset.copyAria];
    if (typeof value === "string") element.setAttribute("aria-label", value);
  });
  const examples = language === "he"
    ? ["50 גרם שיבולת שועל", "250 גרם קוטג׳ 5%", "בטטה בינונית", "2 משולשי פיצה", "משקה חלבון אחד"]
    : ["50g oats", "250g cottage cheese 5%", "medium sweet potato", "2 pizza slices", "one protein drink"];
  document.querySelectorAll("[data-example]").forEach((button, index) => {
    button.dataset.example = examples[index];
    button.textContent = examples[index];
  });
}

function entryName(entry) {
  return entry.name?.[language] || entry.name?.en || entry.name?.he || "—";
}

function dateFromKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function dateLabel(dateKey) {
  return new Intl.DateTimeFormat(language === "he" ? "he-IL" : "en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" }).format(dateFromKey(dateKey));
}

function setPageStatus(message = "", error = false, { retry = null } = {}) {
  const element = $("#pageStatus");
  element.textContent = message;
  element.classList.toggle("error", error);
  document.getElementById("retryLoadButton")?.remove();
  if (typeof retry === "function") {
    const button = document.createElement("button");
    button.id = "retryLoadButton";
    button.type = "button";
    button.className = "daily-retry-button";
    button.textContent = copy.retry;
    button.addEventListener("click", () => {
      button.disabled = true;
      retry();
    });
    element.after(button);
  }
}

function setComposerMessage(message = "", error = false) {
  const element = $("#composerMessage");
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", error);
}

function currentTargets() {
  return state.log?.targetSnapshot || state.targets || targetSnapshot();
}

function updateWeekLog() {
  const index = state.weekLogs.findIndex((log) => log.dateKey === state.dateKey);
  if (index >= 0) state.weekLogs[index] = { ...state.log };
  else state.weekLogs.push({ ...state.log });
}

function queueSave() {
  if (!state.user || !state.log) return Promise.resolve(false);
  updateWeekLog();
  // Capture this day now, not when an earlier asynchronous save finishes.
  const uid = state.user.uid;
  const user = state.user;
  const dateKey = state.dateKey;
  const log = structuredClone(state.log);
  const draftToken = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  writeDailyDraft(uid, dateKey, log, draftToken);
  const status = $("#autosaveState");
  const setSaveStatus = (message, className) => {
    if (state.dateKey !== dateKey || (readDailyDraft(uid, dateKey)?.token && readDailyDraft(uid, dateKey).token !== draftToken)) return;
    status.textContent = message;
    status.className = `autosave-state ${className || ""}`.trim();
  };
  setSaveStatus(copy.savingStatus, "saving");
  state.saveChain = state.saveChain
    .catch(() => undefined)
    .then(async () => {
      // The saved day could not be read earlier. Try once more now and merge
      // the user's new entries onto whatever was already stored, so a
      // transient read failure never drops an existing log.
      if (log.readFailed) {
        try {
          let fresh;
          try {
            fresh = await withDeadline(loadDailyLog(db, uid, dateKey));
          } catch {
            fresh = await loadDailyLogFromServer(dateKey, user);
          }
          const localOnly = log.entries.filter((entry) => !fresh.entries.some((saved) => saved.id === entry.id));
          log.entries = [...fresh.entries, ...localOnly].slice(0, 80);
          delete log.readFailed;
          if (state.dateKey === dateKey && state.log?.readFailed && readDailyDraft(uid, dateKey)?.token === draftToken) {
            state.log.entries = structuredClone(log.entries);
            state.log.readFailed = false;
            render();
            setPageStatus(state.log.completed ? copy.dayFinished : "");
          }
        } catch (error) {
          // Keep the durable local draft. Never replace an unread cloud log.
          throw error;
        }
      }
    })
    .then(async () => {
      let lastError;
      try {
        await saveDailyLogToServer(dateKey, log, user);
        clearDailyDraft(uid, dateKey, draftToken);
        return true;
      } catch (error) {
        lastError = error;
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          // A UI deadline cannot cancel a Firestore write. Keep the real
          // write in the queue until it settles, or a late old write could
          // overwrite the newer snapshot after the timeout released it.
          const saved = await saveDailyLog(db, uid, dateKey, log).then((value) => {
            clearDailyDraft(uid, dateKey, draftToken);
            return value;
          });
          return saved;
        } catch (error) {
          lastError = error;
          if (error.message === "TIMEOUT") break;
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }
      throw lastError;
    })
    .then(() => {
      setSaveStatus(copy.saveStatus, "");
      state.lastSaveOk = true;
      return true;
    })
    .catch((error) => {
      console.error("Daily nutrition autosave failed:", error);
      setSaveStatus(readDailyDraft(uid, dateKey) ? copy.savedOnDevice : copy.saveError, "error");
      state.lastSaveOk = false;
      return false;
    });
  // Only the caller/UI times out. The authoritative queue remains serialized.
  return withDeadline(state.saveChain).catch(() => {
    setSaveStatus(readDailyDraft(uid, dateKey) ? copy.savedOnDevice : copy.saveError, "error");
    return false;
  });
}

function renderTargets(totals) {
  const targets = currentTargets();
  const remaining = remainingAgainstTargets(totals, targets);
  const calorieTarget = Number(targets.dailyCalories || 0);
  const proteinTarget = Number(targets.proteinGrams || 0);
  $("#calorieConsumed").textContent = number(totals.calories);
  [$("#calorieConsumed"), $("#proteinConsumed")].forEach((element) => {
    if (!element) return;
    element.classList.remove("fp-v47-number-update");
    void element.offsetWidth;
    element.classList.add("fp-v47-number-update");
  });
  if (calorieTarget) setAmount($("#calorieTarget"), calorieTarget, "kcal", 0);
  else $("#calorieTarget").textContent = "—";
  if (calorieTarget) {
    setAmount($("#calorieRemaining"), Math.abs(remaining.calories), "kcal", 0);
    if (remaining.calories < 0) $("#calorieRemaining").append(` ${copy.over}`);
  } else $("#calorieRemaining").textContent = "—";
  $("#proteinConsumed").textContent = number(totals.proteinGrams, 1);
  $("#proteinConsumedUnit").textContent = nutritionUnitLabel("g", language, totals.proteinGrams);
  if (proteinTarget) {
    setAmount($("#proteinRemaining"), Math.abs(remaining.proteinGrams), "g", 1);
    if (remaining.proteinGrams < 0) $("#proteinRemaining").append(` ${copy.over}`);
  } else $("#proteinRemaining").textContent = "—";
  const proteinPercent = proteinTarget ? Math.min(100, (totals.proteinGrams / proteinTarget) * 100) : 0;
  $("#proteinProgress").style.width = `${proteinPercent}%`;
  $(".protein-progress").setAttribute("aria-valuenow", String(Math.round(proteinPercent)));
  $("#targetSetup").hidden = targets.complete;
}

function renderMacroDistribution(totals) {
  const macro = macroEnergyPercentages(totals);
  $("#proteinPercent").textContent = `${number(macro.protein, 1)}%`;
  $("#carbsPercent").textContent = `${number(macro.carbs, 1)}%`;
  $("#fatPercent").textContent = `${number(macro.fat, 1)}%`;
  if (window.fpV47AnimateMacroRing) window.fpV47AnimateMacroRing($("#macroRing"), macro);
  else {
    const proteinEnd = macro.protein;
    const carbEnd = macro.protein + macro.carbs;
    $("#macroRing").style.background = macro.macroCalories
      ? `conic-gradient(var(--daily-blue) 0 ${proteinEnd}%, var(--daily-amber) ${proteinEnd}% ${carbEnd}%, var(--daily-purple) ${carbEnd}% 100%)`
      : "conic-gradient(rgba(131, 194, 239, 0.14) 0 100%)";
  }
  $("#macroRing").setAttribute("aria-label", `${copy.protein} ${number(macro.protein, 1)}%, ${copy.carbs} ${number(macro.carbs, 1)}%, ${copy.fat} ${number(macro.fat, 1)}%`);
}

function renderEntries() {
  const body = $("#foodEntries");
  $("#entryCount").textContent = String(state.log.entries.length);
  $("#emptyEntries").hidden = state.log.entries.length > 0;
  body.innerHTML = state.log.entries.map((entry) => {
    const editing = state.editingId === entry.id;
    const amountCell = editing
      ? `<div class="entry-edit" dir="ltr"><input data-edit-amount="${esc(entry.id)}" type="number" min="0.1" max="10000" step="0.1" value="${esc(entry.amount)}"><span class="nutrition-unit"${language === "he" ? ' lang="he" dir="rtl"' : ""}>${esc(nutritionUnitLabel(entry.unit, language, entry.amount))}</span></div>`
      : amountMarkup(entry.amount, entry.unit, 1, { approximate: entry.approximate === true });
    const actions = editing
      ? `<button type="button" data-entry-action="save" data-entry-id="${esc(entry.id)}">${esc(copy.save)}</button><button type="button" data-entry-action="cancel" data-entry-id="${esc(entry.id)}">${esc(copy.cancel)}</button>`
      : `<button type="button" data-entry-action="edit" data-entry-id="${esc(entry.id)}">${esc(copy.edit)}</button><button type="button" data-entry-action="duplicate" data-entry-id="${esc(entry.id)}">${esc(copy.duplicate)}</button><button type="button" data-entry-action="delete" data-entry-id="${esc(entry.id)}">${esc(copy.delete)}</button>`;
    const estimateText = entry.estimated
      ? (entry.estimatedGrams
        ? format(entry.compositeEstimate ? copy.estimatedComposite : copy.estimatedPortion, { amount: formatNutritionAmount(entry.estimatedGrams, "g", language, 1) })
        : copy.estimatedGeneric)
      : "";
    return `<tr data-entry-row="${esc(entry.id)}"><td><div class="food-identity">${foodThumbnailMarkup(entry)}<div class="food-name"><strong>${esc(entryName(entry))}</strong><small dir="auto">${esc(entry.rawText || entry.source || "")}</small>${estimateText ? `<small class="estimate-note">${esc(estimateText)}</small>` : ""}</div></div></td><td data-label="${esc(copy.amount)}">${amountCell}</td><td data-label="${esc(copy.calories)}">${amountMarkup(entry.calories, "kcal", 1, { approximate: entry.approximate === true })}</td><td data-label="${esc(copy.protein)}">${amountMarkup(entry.proteinGrams, "g", 1, { approximate: entry.approximate === true })}</td><td data-label="${esc(copy.carbs)}">${amountMarkup(entry.carbsGrams, "g", 1, { approximate: entry.approximate === true })}</td><td data-label="${esc(copy.fat)}">${amountMarkup(entry.fatGrams, "g", 1, { approximate: entry.approximate === true })}</td><td><div class="entry-actions">${actions}</div></td></tr>`;
  }).join("");
  body.querySelectorAll("img.food-thumbnail").forEach((image) => {
    image.onerror = () => { image.onerror = null; image.src = FOOD_THUMBNAIL_FALLBACK; };
  });
}

function renderCombinations() {
  $("#savedCombinations").innerHTML = state.combinations.length
    ? state.combinations.map((combination, index) => `<button type="button" data-combination-index="${index}">${esc(combination.name)}<small> · ${combination.entries?.length || 0}</small></button>`).join("")
    : `<span class="empty-tool">${esc(copy.noCombinations)}</span>`;
}

function calendarLabel(monthKey) {
  return new Intl.DateTimeFormat(language === "he" ? "he-IL" : "en-US", { month: "long", year: "numeric" })
    .format(dateFromKey(`${monthKey}-01`));
}

function logByDateKey() {
  return new Map([
    ...state.weekLogs.map((log) => [log.dateKey, log]),
    [state.log.dateKey, state.log]
  ]);
}

function caloriesForDate(dateKey, logs) {
  const log = logs.get(dateKey);
  return Number(log?.totals?.calories || (log?.entries ? totalsForEntries(log.entries).calories : 0));
}

function renderDayHistory() {
  const logs = logByDateKey();
  const nearbyKeys = Array.from({ length: 5 }, (_, index) => shiftDateKey(state.dateKey, index - 4)).reverse();
  $("#nearbyDays").innerHTML = nearbyKeys.map((dateKey) => {
    const calories = caloriesForDate(dateKey, logs);
    const date = dateFromKey(dateKey);
    const isSelected = dateKey === state.dateKey;
    const day = new Intl.DateTimeFormat(language === "he" ? "he-IL" : "en-US", { weekday: "short" }).format(date);
    const shortDate = new Intl.DateTimeFormat(language === "he" ? "he-IL" : "en-US", { month: "short", day: "numeric" }).format(date);
    return `<button type="button" class="nearby-day${isSelected ? " is-selected" : ""}" data-history-date="${dateKey}" role="listitem" aria-current="${isSelected ? "date" : "false"}"><span><b>${esc(dateKey === localDateKey() ? copy.today : day)}</b><small>${esc(shortDate)}</small></span><strong>${calories ? amountMarkup(calories, "kcal", 0) : "—"}</strong></button>`;
  }).join("");

  const [year, month] = state.calendarMonthKey.split("-").map(Number);
  const first = new Date(year, month - 1, 1, 12);
  const lastDay = new Date(year, month, 0, 12).getDate();
  const leadingCells = first.getDay();
  $("#calendarMonthLabel").textContent = calendarLabel(state.calendarMonthKey);
  $("#calendarWeekdays").innerHTML = copy.weekdayShort.map((day) => `<span>${esc(day)}</span>`).join("");
  $("#calendarGrid").innerHTML = Array.from({ length: leadingCells + lastDay }, (_, index) => {
    if (index < leadingCells) return '<span class="calendar-day calendar-day--empty" aria-hidden="true"></span>';
    const day = index - leadingCells + 1;
    const dateKey = `${state.calendarMonthKey}-${String(day).padStart(2, "0")}`;
    const calories = caloriesForDate(dateKey, logs);
    const isSelected = dateKey === state.dateKey;
    const isToday = dateKey === localDateKey();
    return `<button type="button" class="calendar-day${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}" data-calendar-date="${dateKey}" role="gridcell" aria-current="${isSelected ? "date" : "false"}"><b>${day}</b><small>${calories ? amountMarkup(calories, "kcal", 0) : "—"}</small></button>`;
  }).join("");
}

function render() {
  $("#selectedDate").value = state.dateKey;
  $("#selectedDateLabel").textContent = formatNutritionDate(state.dateKey, language);
  $("#selectedDate").setAttribute("aria-label", `${copy.chooseDate}: ${dateLabel(state.dateKey)}`);
  const totals = totalsForEntries(state.log.entries);
  state.log.totals = totals;
  updateWeekLog();
  renderTargets(totals);
  renderMacroDistribution(totals);
  renderEntries();
  renderCombinations();
  renderDayHistory();
  const finish = $("#finishDayButton");
  finish.textContent = state.log.completed ? copy.dayFinished : copy.finishDay;
  finish.disabled = state.log.completed;
}

async function loadTargets() {
  const [rootSnapshot, settingsSnapshot] = await Promise.all([
    getDoc(doc(db, "users", state.user.uid)),
    getDoc(doc(db, "users", state.user.uid, "settings", "main"))
  ]);
  const root = rootSnapshot.exists() ? rootSnapshot.data() : {};
  const settings = settingsSnapshot.exists() ? settingsSnapshot.data() : {};
  let activePlan = null;
  if (root.activeNutritionPlanId) {
    const planSnapshot = await getDoc(doc(db, "users", state.user.uid, "nutritionPlans", root.activeNutritionPlanId));
    activePlan = planSnapshot.exists() ? planSnapshot.data() : null;
  }
  state.targets = targetSnapshot({ activePlan });
  if (!state.targets.maintenanceCalories && settings.nutritionTargets?.maintenanceCalories) {
    state.targets = {
      ...state.targets,
      maintenanceCalories: Number(settings.nutritionTargets.maintenanceCalories),
      source: state.targets.source === "none" ? "athlete-core" : state.targets.source
    };
  }
}

async function loadDate(dateKey) {
  const request = state.dateLoadRequest = (state.dateLoadRequest || 0) + 1;
  const uid = state.user.uid;
  state.dateKey = dateKey;
  state.log = null;
  state.calendarMonthKey = dateKey.slice(0, 7);
  state.editingId = null;
  state.pendingClarification = null;
  $("#clarificationPanel").hidden = true;
  setComposerMessage();
  setPageStatus(copy.loading);
  await withDeadline(state.saveChain).catch(() => undefined);
  if (request !== state.dateLoadRequest || state.user?.uid !== uid) return;
  // A read failure (or an offline stream that never resolves) must not disable
  // the composer. Fall back to a local working log so logging keeps working;
  // queueSave() then re-reads and merges the saved day before the next write,
  // so an unread saved log is never silently overwritten with new-only entries.
  let log;
  let serverConfirmed = false;
  const localDraft = readDailyDraft(uid, dateKey);
  try {
    log = await withTimeout(loadDailyLog(db, uid, dateKey), LOG_LOAD_TIMEOUT_MS);
  } catch (error) {
    try {
      log = await loadDailyLogFromServer(dateKey);
      serverConfirmed = true;
    } catch (serverError) {
      console.warn("Daily nutrition: today's log could not be confirmed by the browser or server.", error, serverError);
      log = normalizeLog(dateKey, localDraft?.log || {});
      log.readFailed = true;
    }
  }
  if (localDraft) {
    // A timed-out browser write may actually have completed. Verify against an
    // uncached server read before continuing to show an alarming pending badge.
    if (!serverConfirmed) {
      try {
        log = await loadDailyLogFromServer(dateKey);
        serverConfirmed = true;
      } catch {
        // Keep the draft and its pending indicator until cloud confirmation.
      }
    }
    const draftLog = normalizeLog(dateKey, localDraft.log);
    if (serverConfirmed && sameSavedLog(log, draftLog)) {
      clearDailyDraft(uid, dateKey, localDraft.token);
    } else if (log.readFailed || localDraft.savedAt > timestampMillis(log.updatedAt)) {
      const readFailed = log.readFailed;
      log = draftLog;
      if (readFailed) log.readFailed = true;
    }
  }
  if (request !== state.dateLoadRequest || state.user?.uid !== uid) return;
  const weekLogs = await withDeadline(loadNutritionWeek(db, uid, dateKey)).catch(() => [log]);
  if (request !== state.dateLoadRequest || state.user?.uid !== uid) return;
  state.log = log;
  if (!state.log.targetSnapshot && state.targets.complete) {
    state.log.targetSnapshot = { ...state.targets };
    state.log.maintenanceSnapshot = state.targets.maintenanceCalories;
  }
  state.weekLogs = weekLogs;
  render();
  if (readDailyDraft(state.user.uid, state.dateKey)) {
    $("#autosaveState").textContent = copy.savedOnDevice;
    $("#autosaveState").className = "autosave-state error";
  } else {
    $("#autosaveState").textContent = copy.saveStatus;
    $("#autosaveState").className = "autosave-state";
  }
  if (state.log.readFailed) setPageStatus(copy.logLoadFailed, true, { retry: () => loadDate(state.dateKey) });
  else setPageStatus(state.log.completed ? copy.dayFinished : "");
  if (navigator.onLine && readDailyDraft(state.user.uid, state.dateKey)) queueSave();
}

function addEntries(entries) {
  if (!state.log) {
    setComposerMessage(copy.loading, true);
    return;
  }
  const createdAt = new Date().toISOString();
  const added = entries.map((entry) => ({ ...entry, id: createEntryId(), createdAt }));
  state.log.entries = [...state.log.entries, ...added].slice(0, 80);
  state.pendingClarification = null;
  $("#clarificationPanel").hidden = true;
  render();
  window.fpV47Success?.($("#autosaveState"));
  queueSave();
  $("#foodInput").value = "";
  $("#foodInput").focus();
}

function createEntryId() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return `food-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clarificationChoiceLabel(ambiguity, choice) {
  if (choice.isEstimateFallback) {
    if (ambiguity.kind === "brand") {
      return ambiguity.foodId === "protein-drink" ? copy.estimateUnknownDrink
        : ambiguity.foodId === "protein-bar" ? copy.estimateUnknownBar
        : copy.estimateUnknown;
    }
    if (ambiguity.kind === "size") return copy.estimateUnknownMedium;
    if (ambiguity.kind === "portion") {
      return ambiguity.choices.some((item) => String(item.choiceId).startsWith("slice")) ? copy.estimateUnknown : copy.estimateUnknownTray;
    }
    return copy.estimateUnknown;
  }
  if (ambiguity.kind === "size") {
    const sizeLabels = { small: copy.sizeSmall, medium: copy.sizeMedium, large: copy.sizeLarge };
    if (sizeLabels[choice.choiceId]) return sizeLabels[choice.choiceId];
  }
  return choice.label?.[language] || choice.label?.en || choice.name?.[language] || choice.name?.en || String(choice.choiceId || "");
}

function renderClarification(result) {
  setComposerMessage('');
  state.pendingClarification = result;
  const ambiguity = result.ambiguities[0];
  const panel = $("#clarificationPanel");
  panel.hidden = false;
  const title = ambiguity.kind === "preparation" ? (language === 'he' ? 'איך נשקל המזון?' : 'How was the food weighed?')
    : ambiguity.kind === "brand" ? copy.brandClarificationTitle
    : ambiguity.kind === "size" ? copy.sizeClarificationTitle
    : ambiguity.kind === "smart-food" ? copy.smartFoodClarificationTitle
    : copy.clarificationTitle;
  const hint = ambiguity.kind === "preparation" ? (language === 'he' ? 'בחרו את מצב המזון בזמן השקילה. אותו משקל יבש ומבושל אינו שווה בערכים. אם לא ידוע, בדקו את האריזה או הזינו תיאור מדויק יותר — לא נבחר מצב אוטומטית.' : 'Choose its state when weighed. Equal dry and cooked weights have different nutrition. If unsure, check the label or enter a more specific description; no state is selected automatically.')
    : ambiguity.kind === "brand" ? copy.brandClarificationHint
    : ambiguity.kind === "size" ? copy.sizeClarificationHint
    : ambiguity.kind === "smart-food" ? copy.smartFoodClarificationHint
    : ambiguity.kind === "portion" ? copy.portionClarificationHint
    : copy.clarificationHint;
  const brandForm = ambiguity.allowBrandInput
    ? `<form class="clarification-brand" data-brand-form><input type="text" data-brand-input autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(copy.brandInputPlaceholder)}" aria-label="${esc(copy.brandInputPlaceholder)}"><button type="submit">${esc(copy.brandSearch)}</button></form>`
    : "";
  const advanced = ambiguity.kind === "brand" ? `<p class="clarification-advanced">${esc(copy.customFoodAdvancedHint)}</p>` : "";
  const choices = ambiguity.choices.map((choice, index) =>
    `<button type="button" class="clarification-choice${choice.isEstimateFallback ? " clarification-choice--estimate" : ""}" data-food-choice-index="${index}">${esc(clarificationChoiceLabel(ambiguity, choice))}</button>`
  ).join("");
  const weightForm = ambiguity.kind === "smart-food"
    ? `<form data-weight-form><label>${language === "he" ? "יודעים כמה אכלתם בגרמים? הזינו את המשקל הכולל" : "Know the weight? Enter total grams eaten"}<input name="grams" type="number" min="1" max="1500" step="0.1" required></label><button type="submit">${esc(copy.add || "Add")}</button></form>` : "";
  panel.innerHTML = `<h3>${esc(title)}</h3><p>${esc(ambiguity.segment)}</p><p>${esc(hint)}</p>${brandForm}${weightForm}<div class="clarification-choices">${choices}</div>${advanced}`;
  panel.querySelector("[data-brand-input]")?.focus();
}

function finishClarification(resolvedEntries, note = "") {
  const pending = state.pendingClarification;
  if (pending?.ambiguities.length > 1) {
    renderClarification({ ...pending, entries: [...pending.entries, ...resolvedEntries], ambiguities: pending.ambiguities.slice(1) });
    return;
  }
  const unresolved = pending?.errors || [];
  const message = unresolved.length
    ? format(copy.partialAdded, { food: unresolved.map((error) => error.segment).join(", ") })
    : note;
  setComposerMessage(message, unresolved.length > 0);
  addEntries([...(pending?.entries || []), ...resolvedEntries]);
  state.pendingClarification = null;
  $("#clarificationPanel").hidden = true;
}

function smartFoodFromInterpretation(interpretation, rawText) {
  const { food, foods } = cacheInterpretedFood(state.smartFoods, interpretation, parseAmountPrefix(rawText), rawText);
  state.smartFoods = foods;
  persistSmartFoods();
  return food;
}

function smartFoodAmbiguity(interpretation, segment) {
  const food = smartFoodFromInterpretation(interpretation, segment);
  const estimate = (grams) => ({
    confidence: interpretation.confidence || "low",
    portionKind: interpretation.portion.kind || "unknown",
    reason: "ai-food-estimate",
    count: 1
  });
  const choices = (interpretation.portion.choices || [])
    .filter((choice) => choice.id !== "average")
    .map((choice) => ({ choiceId: choice.id, foodId: food.id, label: choice.label, amount: choice.grams, unit: "g", estimate: estimate(choice.grams) }));
  const average = (interpretation.portion.choices || []).find((choice) => choice.id === "average") || {
    id: "average",
    label: { en: "I don't know — use average", he: "לא יודע — השתמש בממוצע" },
    grams: interpretation.portion.defaultGrams
  };
  return {
    segment,
    kind: "smart-food",
    foodId: food.id,
    amount: null,
    unit: "g",
    choices: [...choices, {
      choiceId: "estimate",
      foodId: food.id,
      label: average.label,
      amount: average.grams,
      unit: "g",
      estimate: estimate(average.grams),
      isEstimateFallback: true
    }]
  };
}

async function requestSmartFoodInterpretation(segment) {
  const token = await state.user?.getIdToken?.();
  if (!token) throw new Error("AUTH_REQUIRED");
  const response = await fetch("/api/daily-nutrition/interpret-food", {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text: segment, language })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.interpretation) {
    const error = new Error(payload?.code || "SMART_FOOD_UNAVAILABLE");
    error.code = payload?.code || "SMART_FOOD_UNAVAILABLE";
    throw error;
  }
  return payload.interpretation;
}

async function submitFoodText(value) {
  const uid = state.user?.uid, dateKey = state.dateKey, request = state.dateLoadRequest;
  const isCurrentDay = () => state.user?.uid === uid && state.dateKey === dateKey && state.dateLoadRequest === request && !!state.log;
  if (!isCurrentDay()) return;
  // Cache compositions, not serving sizes. Never bypass preparation questions.
  let result = { ...parseFoodText(value, { customFoods: state.customFoods }), originalInput: value };
  result.ambiguities.sort((a, b) => Number(b.kind === 'preparation') - Number(a.kind === 'preparation'));
  let lookupUnavailable = false;
  if (result.ambiguities.length === 1 && result.ambiguities[0].kind !== 'preparation') {
    const remembered = localStorage.getItem(`fp-daily-choice-${result.ambiguities[0].segment.replace(/\d+/g, "").trim()}`);
    const rememberedChoice = result.ambiguities[0].choices.find((choice) => (choice.choiceId || choice.foodId) === remembered);
    if (rememberedChoice) {
      const resolved = resolveFoodChoice(rememberedChoice.foodId, {
        amount: rememberedChoice.amount ?? result.ambiguities[0].amount,
        unit: rememberedChoice.unit || result.ambiguities[0].unit,
        estimate: rememberedChoice.estimate || null,
        rawText: result.ambiguities[0].segment,
        customFoods: availableFoods()
      });
      result = { ...result, status: result.errors.length ? "partial" : "ready", entries: [...result.entries, resolved], ambiguities: [] };
    }
  }
  if (result.ambiguities.length) {
    renderClarification(result);
    return;
  }
  if (result.errors.length) {
    const firstUnknown = result.errors.find((error) => error.code === "UNKNOWN_FOOD");
    if (firstUnknown) {
      setComposerMessage(language === "he" ? "מזהים את המאכל…" : "Identifying that food…");
      try {
        const explicit = parseAmountPrefix(firstUnknown.segment);
        const cached = cachedWeighedFood(state.smartFoods, explicit);
        const interpretation = cached ? null : await requestSmartFoodInterpretation(firstUnknown.segment);
        if (!isCurrentDay()) return;
        if (interpretation?.clarification?.kind === 'preparation') {
          const identity = preparationIdentity(explicit.foodText);
          renderClarification({ ...result, ambiguities: [{ kind: 'preparation', segment: firstUnknown.segment,
            choices: interpretation.clarification.options.map(option => ({ choiceId: option, label: preparationLabels[option],
              query: `${explicit.amount || ''} ${explicit.unit || ''} ${option} ${identity.key}`.trim() })) }] });
          return;
        }
        if (["g", "kg"].includes(explicit.unit) && explicit.amount > 0) {
          const food = cached || smartFoodFromInterpretation(interpretation, firstUnknown.segment);
          const scaled = resolveFoodChoice(food.id, {
            amount: explicit.amount,
            unit: explicit.unit,
            rawText: firstUnknown.segment,
            customFoods: availableFoods()
          });
          const entry = { ...scaled, estimated: true, approximate: true,
            estimateConfidence: interpretation?.confidence || "low", estimateReason: "ai-food-estimate",
            estimatedGrams: scaled.unit === "g" ? scaled.amount : null };
          const remaining = result.errors.filter((error) => error !== firstUnknown);
          setComposerMessage(remaining.length ? format(copy.partialAdded, { food: remaining.map((error) => error.segment).join(", ") }) : "", remaining.length > 0);
          addEntries([...result.entries, entry]);
          return;
        }
        const ambiguity = smartFoodAmbiguity(interpretation, firstUnknown.segment);
        renderClarification({
          ...result,
          errors: result.errors.filter((error) => error !== firstUnknown),
          ambiguities: [ambiguity]
        });
        return;
      } catch (error) {
        if (!isCurrentDay()) return;
        // The local catalog remains the primary path. A provider/key outage
        // must not look like the food itself was invalid or block known foods.
        console.warn("Smart food lookup unavailable:", error.code || error.message);
        lookupUnavailable = error.code !== "UNKNOWN_FOOD";
      }
    }
  }
  if (result.errors.length && !result.entries.length) {
    setComposerMessage(format(lookupUnavailable ? copy.smartFoodUnavailable : copy.unknownFood, { food: result.errors.map((error) => error.segment).join(", ") }), true);
    return;
  }
  setComposerMessage(result.errors.length ? format(lookupUnavailable ? copy.smartFoodUnavailable : copy.partialAdded, { food: result.errors.map((error) => error.segment).join(", ") }) : "", result.errors.length > 0);
  $("#clarificationPanel").hidden = true;
  addEntries(result.entries);
}

function bindEvents() {
  document.querySelectorAll("[data-example]").forEach((button) => button.addEventListener("click", () => {
    $("#foodInput").value = button.dataset.example;
    $("#foodInput").focus();
  }));
  $("#clarificationPanel").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-food-choice-index]");
    if (!button || !state.pendingClarification) return;
    const ambiguity = state.pendingClarification.ambiguities[0];
    const choice = ambiguity.choices[Number(button.dataset.foodChoiceIndex)];
    if (!choice) return;
    if (ambiguity.kind === 'preparation') {
      if (state.preparationBusy) return;
      state.preparationBusy = true;
      const pending = state.pendingClarification;
      const input = pending.originalInput || ambiguity.segment;
      const nextInput = input.replace(ambiguity.segment, () => choice.query);
      try {
        panelChoicesDisabled(true);
        await submitFoodText(nextInput);
      } catch {
        setComposerMessage(copy.saveError, true);
      } finally {
        state.preparationBusy = false;
        panelChoicesDisabled(false);
      }
      return;
    }
    const resolved = resolveFoodChoice(choice.foodId, {
      amount: choice.amount ?? ambiguity.amount,
      unit: choice.unit || ambiguity.unit,
      estimate: choice.estimate || null,
      rawText: ambiguity.segment,
      customFoods: availableFoods()
    });
    localStorage.setItem(`fp-daily-choice-${ambiguity.segment.replace(/\d+/g, "").trim()}`, choice.choiceId || choice.foodId);
    finishClarification([resolved], resolved.estimated ? copy.estimateAddedNote : "");
  });
  $("#clarificationPanel").addEventListener("submit", (event) => {
    if (event.target.matches("[data-weight-form]") && state.pendingClarification) {
      event.preventDefault();
      const grams = Number(new FormData(event.target).get("grams"));
      if (!(grams >= 1 && grams <= 1500)) return;
      const ambiguity = state.pendingClarification.ambiguities[0];
      const resolved = resolveFoodChoice(ambiguity.foodId, {
        amount: grams, unit: "g", rawText: ambiguity.segment, customFoods: availableFoods(),
        estimate: { confidence: "low", reason: "ai-food-estimate", count: 1 }
      });
      finishClarification([resolved], copy.estimateAddedNote);
      return;
    }
    const form = event.target.closest("[data-brand-form]");
    if (!form || !state.pendingClarification) return;
    event.preventDefault();
    const ambiguity = state.pendingClarification.ambiguities[0];
    const brand = form.querySelector("[data-brand-input]")?.value.trim();
    if (!brand) return;
    // Re-run the parser with the product/brand the user just supplied. If it
    // resolves to a known food, use it; otherwise fall back to the
    // representative average so this is never a dead end.
    const branded = parseFoodText(brand, { customFoods: availableFoods() });
    if (branded.entries.length && !branded.ambiguities.length) {
      finishClarification(branded.entries, "");
      return;
    }
    const fallback = ambiguity.choices.find((choice) => choice.isEstimateFallback) || ambiguity.choices[0];
    const resolved = resolveFoodChoice(fallback.foodId, {
      amount: fallback.amount ?? ambiguity.amount,
      unit: fallback.unit || ambiguity.unit,
      estimate: fallback.estimate || null,
      rawText: brand || ambiguity.segment,
      customFoods: availableFoods()
    });
    finishClarification([resolved], copy.brandNotFoundNote);
  });
  $("#foodEntries").addEventListener("click", (event) => {
    const button = event.target.closest("[data-entry-action]");
    if (!button || !state.log) return;
    const index = state.log.entries.findIndex((entry) => entry.id === button.dataset.entryId);
    if (index < 0) return;
    const entry = state.log.entries[index];
    const action = button.dataset.entryAction;
    if (action === "edit") state.editingId = entry.id;
    if (action === "cancel") state.editingId = null;
    if (action === "delete") {
      state.log.entries.splice(index, 1);
      state.editingId = null;
      queueSave();
    }
    if (action === "duplicate") {
      state.log.entries.splice(index + 1, 0, { ...entry, id: createEntryId(), createdAt: new Date().toISOString() });
      queueSave();
    }
    if (action === "save") {
      const amount = Number(document.querySelector(`[data-edit-amount="${CSS.escape(entry.id)}"]`)?.value);
      try {
        const scaled = rescaleEntrySnapshot(entry, amount);
        state.log.entries[index] = { ...entry, ...scaled, estimated: false, approximate: false, estimateConfidence: null, estimatedGrams: null, portionCount: null, portionSize: null, portionKind: null, compositeEstimate: false };
        state.editingId = null;
        queueSave();
      } catch {
        setComposerMessage(copy.saveError, true);
      }
    }
    render();
  });
  $("#combinationForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.log) return;
    const combinationForm = event.currentTarget;
    const name = new FormData(combinationForm).get("name");
    if (!state.log.entries.length) return setComposerMessage(copy.emptyEntries, true);
    try {
      const combination = await saveFoodCombination(db, state.user.uid, { name, entries: state.log.entries });
      state.combinations = [...state.combinations.filter((item) => item.id !== combination.id), combination];
      combinationForm.reset();
      renderCombinations();
    } catch {
      setComposerMessage(copy.saveError, true);
    }
  });
  $("#savedCombinations").addEventListener("click", (event) => {
    const button = event.target.closest("[data-combination-index]");
    if (!button) return;
    const combination = state.combinations[Number(button.dataset.combinationIndex)];
    if (combination) addEntries(combination.entries.map((entry) => ({ ...entry, id: undefined })));
  });
  $("#copyYesterdayButton").addEventListener("click", async function copyPreviousDayEntries() {
    if (!state.log) return;
    const uid = state.user.uid, dateKey = state.dateKey, request = state.dateLoadRequest;
    const button = $("#copyYesterdayButton");
    button.disabled = true;
    try {
      // Merge into the current local snapshot and use the same save queue.
      // A separate read/overwrite path would lose pending edits or race saves.
      const previous = await withDeadline(loadDailyLog(db, uid, shiftDateKey(dateKey, -1)));
      if (state.user?.uid !== uid || state.dateKey !== dateKey || state.dateLoadRequest !== request || !state.log) return;
      const entries = previous.entries.slice(0, Math.max(0, 80 - state.log.entries.length));
      if (entries.length) addEntries(entries);
      setComposerMessage(entries.length ? format(copy.copied, { count: entries.length }) : copy.nothingToCopy);
    } catch {
      setComposerMessage(copy.saveError, true);
    } finally {
      button.disabled = false;
    }
  });
  $("#finishDayButton").addEventListener("click", () => {
    if (!state.log) return;
    state.log.completed = true;
    state.log.completedAt = new Date().toISOString();
    setPageStatus(copy.dayFinished);
    render();
    window.fpV47Success?.($("#finishDayButton"));
    queueSave();
  });
  $("#saveDailyLogButton").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const saved = await queueSave();
      setComposerMessage(saved ? copy.saveStatus : (readDailyDraft(state.user.uid, state.dateKey) ? copy.savedOnDevice : copy.saveError), !saved);
    } finally {
      button.disabled = false;
    }
  });
  $("#previousDay").addEventListener("click", () => loadDate(shiftDateKey(state.dateKey, -1)));
  $("#nextDay").addEventListener("click", () => loadDate(shiftDateKey(state.dateKey, 1)));
  $("#todayButton").addEventListener("click", () => loadDate(localDateKey()));
  $("#selectedDate").addEventListener("change", (event) => event.target.value && loadDate(event.target.value));
  $("#nearbyDays").addEventListener("click", (event) => {
    const button = event.target.closest("[data-history-date]");
    if (button?.dataset.historyDate) loadDate(button.dataset.historyDate);
  });
  $("#calendarGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-calendar-date]");
    if (button?.dataset.calendarDate) loadDate(button.dataset.calendarDate);
  });
  $("#calendarPreviousMonth").addEventListener("click", () => {
    state.calendarMonthKey = shiftDateKey(`${state.calendarMonthKey}-01`, -1).slice(0, 7);
    renderDayHistory();
  });
  $("#calendarNextMonth").addEventListener("click", () => {
    const [year, month] = state.calendarMonthKey.split("-").map(Number);
    state.calendarMonthKey = localDateKey(new Date(year, month, 1, 12)).slice(0, 7);
    renderDayHistory();
  });
}

function panelChoicesDisabled(disabled) {
  document.querySelectorAll('#clarificationPanel [data-food-choice-index]').forEach(button => { button.disabled = disabled; });
}

// Bind the primary composer before the protected-page gate finishes. This
// keeps a click from becoming a silent no-op while Firebase is resolving or
// when a transient profile read prevents the rest of the page from starting.
function bindFoodComposer() {
  const form = $("#foodComposerForm");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.submitting === "true") return;
    const input = $("#foodInput");
    const value = input?.value.trim();
    if (!value) return;
    if (!state.log) {
      setComposerMessage(copy.loading, true);
      return;
    }
    const addButton = $("#addFoodButton");
    form.dataset.submitting = "true";
    form.setAttribute("aria-busy", "true");
    if (addButton) addButton.disabled = true;
    try {
      await submitFoodText(value);
    } catch (error) {
      console.error("Daily nutrition food entry failed:", error);
      setComposerMessage(copy.saveError, true);
    } finally {
      form.dataset.submitting = "false";
      form.setAttribute("aria-busy", "false");
      if (addButton) addButton.disabled = false;
    }
  });
}

async function init(user) {
  state.user = user;
  bindEvents();
  window.addEventListener("online", () => {
    if (state.log && readDailyDraft(state.user.uid, state.dateKey)) queueSave();
  });
  try {
    const optional = await Promise.allSettled([
      withDeadline(loadTargets()),
      withDeadline(loadCustomFoods(db, user.uid)),
      withDeadline(loadSavedCombinations(db, user.uid))
    ]);
    state.customFoods = optional[1].status === "fulfilled" ? optional[1].value : [];
    state.combinations = optional[2].status === "fulfilled" ? optional[2].value : [];
    await loadDate(state.dateKey);
    // Targets and saved combinations enrich the view, but a temporary read
    // failure must never make a fully usable food log look broken.
    if (!state.log?.readFailed && optional.some((result) => result.status === "rejected")) setPageStatus("");
  } catch (error) {
    console.error("Daily nutrition initialization failed:", error);
    if (!state.log) {
      state.log = normalizeLog(state.dateKey);
      state.log.readFailed = true;
      state.weekLogs = [state.log];
      render();
    }
    setPageStatus(copy.logLoadFailed, true, { retry: () => loadDate(state.dateKey) });
  }
}

applyLanguage();
guardProtectedPage({ onAuthenticated: init });
bindFoodComposer();
