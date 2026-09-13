import { auth, db } from "./firebase-config.js";
import { foodThumbnailMarkup, FOOD_THUMBNAIL_FALLBACK } from "./daily-food-visuals.mjs?v=20260913-smart-food-1";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { guardProtectedPage } from "./verification-gate.js";
import {
  localDateKey,
  macroEnergyPercentages,
  parseFoodText,
  remainingAgainstTargets,
  resolveFoodChoice,
  shiftDateKey,
  targetSnapshot,
  totalsForEntries
} from "./daily-nutrition-domain.mjs?v=20260913-smart-food-1";
import {
  copyPreviousDay,
  loadCustomFoods,
  loadDailyLog,
  loadNutritionWeek,
  loadSavedCombinations,
  normalizeLog,
  saveDailyLog,
  saveFoodCombination
} from "./daily-nutrition-store.mjs?v=20260821-v45-daily-nutrition-v11-4";
import { dailyNutritionCopy } from "./daily-nutrition-i18n.mjs?v=20260913-smart-food-1";
import {
  formatNutritionAmount,
  formatNutritionNumber,
  nutritionAmountParts,
  nutritionUnitLabel
} from "./daily-nutrition-format.mjs?v=20260821-v45-daily-nutrition-v11-4";

const $ = (selector) => document.querySelector(selector);
const language = localStorage.getItem("ofek-ai-language") === "he" ? "he" : "en";
const copy = dailyNutritionCopy(language);
const SMART_FOODS_STORAGE_KEY = "fp-daily-smart-foods-v1";

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
  document.documentElement.dir = language === "he" ? "rtl" : "ltr";
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
  if (dateKey === localDateKey()) return copy.today;
  return new Intl.DateTimeFormat(language === "he" ? "he-IL" : "en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(dateFromKey(dateKey));
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
  updateWeekLog();
  // Capture this day now, not when an earlier asynchronous save finishes.
  const uid = state.user.uid;
  const dateKey = state.dateKey;
  const log = structuredClone(state.log);
  const status = $("#autosaveState");
  status.textContent = copy.savingStatus;
  status.className = "autosave-state saving";
  state.saveChain = state.saveChain
    .catch(() => undefined)
    .then(async () => {
      // The saved day could not be read earlier. Try once more now and merge
      // the user's new entries onto whatever was already stored, so a
      // transient read failure never drops an existing log.
      if (log.readFailed) {
        try {
          const fresh = await loadDailyLog(db, uid, dateKey);
          const localOnly = log.entries.filter((entry) => !fresh.entries.some((saved) => saved.id === entry.id));
          log.entries = [...fresh.entries, ...localOnly].slice(0, 80);
          delete log.readFailed;
          if (state.dateKey === dateKey && state.log?.readFailed) {
            state.log.entries = structuredClone(log.entries);
            state.log.readFailed = false;
            render();
            setPageStatus(state.log.completed ? copy.dayFinished : "");
          }
        } catch {
          // Still unreachable: save the local log so the explicit action is kept.
        }
      }
    })
    .then(() => saveDailyLog(db, uid, dateKey, log))
    .then(() => {
      status.textContent = copy.saveStatus;
      status.className = "autosave-state";
    })
    .catch((error) => {
      console.error("Daily nutrition autosave failed:", error);
      status.textContent = copy.saveError;
      status.className = "autosave-state error";
    });
  return state.saveChain;
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
  $("#targetMessage").hidden = targets.complete;
  $(".target-inline-link").hidden = targets.complete;
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
  $("#selectedDateLabel").textContent = dateLabel(state.dateKey);
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
  await state.saveChain;
  state.dateKey = dateKey;
  state.calendarMonthKey = dateKey.slice(0, 7);
  state.editingId = null;
  state.pendingClarification = null;
  $("#clarificationPanel").hidden = true;
  setComposerMessage();
  setPageStatus(copy.loading);
  // A read failure (or an offline stream that never resolves) must not disable
  // the composer. Fall back to a local working log so logging keeps working;
  // queueSave() then re-reads and merges the saved day before the next write,
  // so an unread saved log is never silently overwritten with new-only entries.
  let log;
  try {
    log = await withTimeout(loadDailyLog(db, state.user.uid, state.dateKey), LOG_LOAD_TIMEOUT_MS);
  } catch (error) {
    console.warn("Daily nutrition: today's log did not load; starting a local working log.", error);
    log = normalizeLog(state.dateKey);
    log.readFailed = true;
  }
  const weekLogs = await loadNutritionWeek(db, state.user.uid, state.dateKey).catch(() => [log]);
  state.log = log;
  if (!state.log.targetSnapshot && state.targets.complete) {
    state.log.targetSnapshot = { ...state.targets };
    state.log.maintenanceSnapshot = state.targets.maintenanceCalories;
  }
  state.weekLogs = weekLogs;
  render();
  if (state.log.readFailed) setPageStatus(copy.logLoadFailed, true, { retry: () => loadDate(state.dateKey) });
  else setPageStatus(state.log.completed ? copy.dayFinished : "");
}

function addEntries(entries) {
  if (!state.log) {
    setComposerMessage(copy.loading, true);
    return;
  }
  const createdAt = new Date().toISOString();
  const added = entries.map((entry) => ({ ...entry, id: createEntryId(), createdAt }));
  state.log.entries = [...state.log.entries, ...added].slice(0, 80);
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
  state.pendingClarification = result;
  const ambiguity = result.ambiguities[0];
  const panel = $("#clarificationPanel");
  panel.hidden = false;
  const title = ambiguity.kind === "brand" ? copy.brandClarificationTitle
    : ambiguity.kind === "size" ? copy.sizeClarificationTitle
    : ambiguity.kind === "smart-food" ? copy.smartFoodClarificationTitle
    : copy.clarificationTitle;
  const hint = ambiguity.kind === "brand" ? copy.brandClarificationHint
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
  panel.innerHTML = `<h3>${esc(title)}</h3><p>${esc(hint)}</p>${brandForm}<div class="clarification-choices">${choices}</div>${advanced}`;
  panel.querySelector("[data-brand-input]")?.focus();
}

function finishClarification(resolvedEntries, note = "") {
  const pending = state.pendingClarification;
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
  const normalized = String(rawText || "food").toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]+/giu, "-").replace(/^-+|-+$/g, "").slice(0, 42) || "food";
  const existing = state.smartFoods.find((food) => food.lookupKey === String(rawText || "").trim().toLowerCase());
  if (existing) return existing;
  const nutrition = interpretation.nutritionPer100g;
  const food = {
    id: `ai-food-${normalized}-${Date.now().toString(36)}`,
    lookupKey: String(rawText || "").trim().toLowerCase(),
    name: interpretation.food.name,
    aliases: [...new Set([rawText, ...(interpretation.food.aliases || []), interpretation.food.name?.en, interpretation.food.name?.he].filter(Boolean))],
    baseAmount: 100,
    baseUnit: "g",
    specificity: "custom",
    source: "ai-estimate",
    macros: {
      calories: nutrition.calories,
      protein: nutrition.proteinGrams,
      carbs: nutrition.carbsGrams,
      fat: nutrition.fatGrams
    },
    reference: { source: "AI-assisted representative estimate", policy: "estimated-not-brand" }
  };
  state.smartFoods = [...state.smartFoods, food].slice(-60);
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
  let result = parseFoodText(value, { customFoods: availableFoods() });
  if (result.ambiguities.length === 1) {
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
        const interpretation = await requestSmartFoodInterpretation(firstUnknown.segment);
        const ambiguity = smartFoodAmbiguity(interpretation, firstUnknown.segment);
        renderClarification({
          ...result,
          errors: result.errors.filter((error) => error !== firstUnknown),
          ambiguities: [ambiguity]
        });
        return;
      } catch (error) {
        // The local catalog remains the primary path. A provider/key outage
        // must not look like the food itself was invalid or block known foods.
        console.warn("Smart food lookup unavailable:", error.code || error.message);
      }
    }
  }
  if (result.errors.length && !result.entries.length) {
    setComposerMessage(format(copy.unknownFood, { food: result.errors.map((error) => error.segment).join(", ") }), true);
    return;
  }
  setComposerMessage(result.errors.length ? format(copy.partialAdded, { food: result.errors.map((error) => error.segment).join(", ") }) : "", result.errors.length > 0);
  $("#clarificationPanel").hidden = true;
  addEntries(result.entries);
}

function bindEvents() {
  document.querySelectorAll("[data-example]").forEach((button) => button.addEventListener("click", () => {
    $("#foodInput").value = button.dataset.example;
    $("#foodInput").focus();
  }));
  $("#clarificationPanel").addEventListener("click", (event) => {
    const button = event.target.closest("[data-food-choice-index]");
    if (!button || !state.pendingClarification) return;
    const ambiguity = state.pendingClarification.ambiguities[0];
    const choice = ambiguity.choices[Number(button.dataset.foodChoiceIndex)];
    if (!choice) return;
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
    if (!button) return;
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
        const scaled = resolveFoodChoice(entry.foodId, { amount, unit: entry.unit, rawText: entry.rawText, customFoods: availableFoods() });
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
  $("#copyYesterdayButton").addEventListener("click", async () => {
    const button = $("#copyYesterdayButton");
    button.disabled = true;
    try {
      const result = await copyPreviousDay(db, state.user.uid, state.dateKey);
      state.log = result.log;
      setComposerMessage(result.copiedCount ? format(copy.copied, { count: result.copiedCount }) : copy.nothingToCopy);
      state.weekLogs = await loadNutritionWeek(db, state.user.uid, state.dateKey);
      render();
    } catch {
      setComposerMessage(copy.saveError, true);
    } finally {
      button.disabled = false;
    }
  });
  $("#finishDayButton").addEventListener("click", () => {
    state.log.completed = true;
    state.log.completedAt = new Date().toISOString();
    setPageStatus(copy.dayFinished);
    render();
    window.fpV47Success?.($("#finishDayButton"));
    queueSave();
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

// Bind the primary composer before the protected-page gate finishes. This
// keeps a click from becoming a silent no-op while Firebase is resolving or
// when a transient profile read prevents the rest of the page from starting.
function bindFoodComposer() {
  const form = $("#foodComposerForm");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("#foodInput");
    const value = input?.value.trim();
    if (!value) return;
    if (!state.log) {
      setComposerMessage(copy.loading, true);
      return;
    }
    try {
      await submitFoodText(value);
    } catch (error) {
      console.error("Daily nutrition food entry failed:", error);
      setComposerMessage(copy.saveError, true);
    }
  });
}

async function init(user) {
  state.user = user;
  bindEvents();
  try {
    const optional = await Promise.allSettled([
      loadTargets(),
      loadCustomFoods(db, user.uid),
      loadSavedCombinations(db, user.uid)
    ]);
    state.customFoods = optional[1].status === "fulfilled" ? optional[1].value : [];
    state.combinations = optional[2].status === "fulfilled" ? optional[2].value : [];
    await loadDate(state.dateKey);
    // Targets and saved combinations enrich the view, but a temporary read
    // failure must never make a fully usable food log look broken.
    if (optional.some((result) => result.status === "rejected")) setPageStatus("");
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
