import { auth, db } from "./firebase-config.js";
import { foodThumbnailMarkup, FOOD_THUMBNAIL_FALLBACK } from "./daily-food-visuals.mjs";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { guardProtectedPage } from "./verification-gate.js";
import {
  classifyEstimatedBalance,
  localDateKey,
  macroEnergyPercentages,
  parseFoodText,
  recentFoodsFromLogs,
  remainingAgainstTargets,
  resolveFoodChoice,
  shiftDateKey,
  targetSnapshot,
  totalsForEntries,
  validateCustomFood,
  weekDateKeys,
  weeklySummary
} from "./daily-nutrition-domain.mjs?v=20260821-v45-daily-nutrition-v11-4";
import {
  copyPreviousDay,
  loadCustomFoods,
  loadDailyLog,
  loadNutritionWeek,
  loadSavedCombinations,
  normalizeLog,
  saveCustomFood,
  saveDailyLog,
  saveFoodCombination
} from "./daily-nutrition-store.mjs?v=20260821-v45-daily-nutrition-v11-4";
import { dailyNutritionCopy } from "./daily-nutrition-i18n.mjs?v=20260821-v45-daily-nutrition-v11-4";
import {
  formatNutritionAmount,
  formatNutritionNumber,
  nutritionAmountParts,
  nutritionUnitLabel
} from "./daily-nutrition-format.mjs?v=20260821-v45-daily-nutrition-v11-4";

const $ = (selector) => document.querySelector(selector);
const language = localStorage.getItem("ofek-ai-language") === "he" ? "he" : "en";
const copy = dailyNutritionCopy(language);
const state = {
  user: null,
  dateKey: localDateKey(),
  log: null,
  weekLogs: [],
  customFoods: [],
  combinations: [],
  targets: targetSnapshot(),
  editingId: null,
  pendingClarification: null,
  saveChain: Promise.resolve()
};

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
  const calorieProgress = calorieTarget ? Math.min(360, (totals.calories / calorieTarget) * 360) : 0;
  $("#calorieRing").style.setProperty("--calorie-progress", `${calorieProgress}deg`);
  $("#calorieConsumed").textContent = number(totals.calories);
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
  const maintenance = Number(targets.maintenanceCalories || state.log?.maintenanceSnapshot || 0);
  if (maintenance) setAmount($("#maintenanceValue"), maintenance, "kcal", 0);
  else $("#maintenanceValue").textContent = "—";
  $("#targetMessage").textContent = !targets.complete ? copy.targetMissing : maintenance ? `${copy.goalTarget}: ${formatNutritionAmount(calorieTarget, "kcal", language, 0)}` : copy.maintenanceMissing;
}

function renderMacroDistribution(totals) {
  const macro = macroEnergyPercentages(totals);
  $("#proteinPercent").textContent = `${number(macro.protein, 1)}%`;
  $("#carbsPercent").textContent = `${number(macro.carbs, 1)}%`;
  $("#fatPercent").textContent = `${number(macro.fat, 1)}%`;
  const proteinEnd = macro.protein;
  const carbEnd = macro.protein + macro.carbs;
  $("#macroRing").style.background = macro.macroCalories
    ? `conic-gradient(var(--daily-blue) 0 ${proteinEnd}%, var(--daily-amber) ${proteinEnd}% ${carbEnd}%, var(--daily-purple) ${carbEnd}% 100%)`
    : "conic-gradient(rgba(131, 194, 239, 0.14) 0 100%)";
  $("#macroRing").setAttribute("aria-label", `${copy.protein} ${number(macro.protein, 1)}%, ${copy.carbs} ${number(macro.carbs, 1)}%, ${copy.fat} ${number(macro.fat, 1)}%`);
}

function renderBalance(totals) {
  const targets = currentTargets();
  const maintenance = Number(targets.maintenanceCalories || state.log?.maintenanceSnapshot || 0);
  const balance = classifyEstimatedBalance(totals.calories, maintenance);
  const labels = { deficit: copy.deficit, maintenance: copy.maintenanceStatus, surplus: copy.surplus, unknown: copy.unknown };
  $("#balanceStatus").textContent = labels[balance.status];
  if (balance.balance === null) $("#balanceValue").textContent = "—";
  else setAmount($("#balanceValue"), balance.balance, "kcal", 0, { signed: true });
  $("#balanceCard").dataset.status = balance.status;
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

function renderRecentFoods() {
  const favorites = state.customFoods
    .filter((food) => food.favorite)
    .map((food) => resolveFoodChoice(food.id, { customFoods: state.customFoods }));
  const recent = recentFoodsFromLogs([...state.weekLogs].reverse(), 8);
  const seen = new Set();
  const foods = [...favorites, ...recent].filter((entry) => {
    if (!entry?.foodId || seen.has(entry.foodId)) return false;
    seen.add(entry.foodId);
    return true;
  }).slice(0, 8);
  $("#recentFoods").innerHTML = foods.length
    ? foods.map((entry, index) => `<button type="button" data-recent-index="${index}">${esc(entryName(entry))}<small> · ${esc(formatNutritionAmount(entry.amount, entry.unit, language, 1))}</small></button>`).join("")
    : `<span class="empty-tool">${esc(copy.noRecent)}</span>`;
  $("#recentFoods").dataset.entries = JSON.stringify(foods);
}

function renderCombinations() {
  $("#savedCombinations").innerHTML = state.combinations.length
    ? state.combinations.map((combination, index) => `<button type="button" data-combination-index="${index}">${esc(combination.name)}<small> · ${combination.entries?.length || 0}</small></button>`).join("")
    : `<span class="empty-tool">${esc(copy.noCombinations)}</span>`;
}

function renderWeek() {
  const summary = weeklySummary(state.weekLogs);
  const weeklyValues = [
    ["#weeklyCalories", summary.loggedDays, summary.averageCalories, "kcal", 0],
    ["#weeklyProtein", summary.loggedDays, summary.averageProteinGrams, "g", 1],
    ["#weeklyCarbs", summary.loggedDays, summary.averageCarbsGrams, "g", 1],
    ["#weeklyFat", summary.loggedDays, summary.averageFatGrams, "g", 1],
    ["#weeklyMaintenance", summary.averageMaintenance !== null, summary.averageMaintenance, "kcal", 0]
  ];
  weeklyValues.forEach(([selector, available, value, unit, precision]) => available ? setAmount($(selector), value, unit, precision) : $(selector).textContent = "—");
  if (summary.averageBalance === null) $("#weeklyBalance").textContent = "—";
  else setAmount($("#weeklyBalance"), summary.averageBalance, "kcal", 0, { signed: true });
  $("#weeklyLogged").textContent = `${summary.loggedDays} / 7`;
  $("#weeklyCompleted").textContent = `${summary.completedDays} / 7`;
  const balanceLabels = { deficit: copy.deficit, maintenance: copy.maintenanceStatus, surplus: copy.surplus, unknown: copy.unknown };
  $("#weeklyBalanceStatus").textContent = balanceLabels[summary.balanceStatus];
  $("#weeklyBalanceStatus").dataset.status = summary.balanceStatus;
  $("#weeklyDenominator").textContent = summary.loggedDays
    ? format(summary.loggedDays === 1 ? copy.averageOverOne : copy.averageOver, { count: summary.loggedDays })
    : copy.noWeekData;

  const maxCalories = Math.max(
    1,
    ...state.weekLogs.flatMap((log) => [
      Number(log.totals?.calories || 0),
      Number(log.targetSnapshot?.dailyCalories || 0),
      Number(log.maintenanceSnapshot || log.targetSnapshot?.maintenanceCalories || 0)
    ]),
    Number(currentTargets().dailyCalories || 0),
    Number(currentTargets().maintenanceCalories || 0)
  );
  $("#weeklyChart").innerHTML = state.weekLogs.map((log) => {
    const calories = Number(log.totals?.calories || 0);
    const height = calories ? Math.max(5, Math.min(100, (calories / maxCalories) * 100)) : 0;
    const goal = Number(log.targetSnapshot?.dailyCalories || 0);
    const maintenance = Number(log.maintenanceSnapshot || log.targetSnapshot?.maintenanceCalories || 0);
    const goalLine = goal ? `<span class="trend-reference trend-reference--goal" style="bottom:${Math.min(100, (goal / maxCalories) * 100)}%"></span>` : "";
    const maintenanceLine = maintenance ? `<span class="trend-reference trend-reference--maintenance" style="bottom:${Math.min(100, (maintenance / maxCalories) * 100)}%"></span>` : "";
    const date = dateFromKey(log.dateKey);
    const weekday = copy.weekdayShort[date.getDay()];
    return `<div class="trend-day${calories ? "" : " is-empty"}"><div class="trend-bar-track">${goalLine}${maintenanceLine}<span class="trend-bar" style="height:${height}%"></span></div><strong>${calories ? amountMarkup(calories, "kcal", 0) : "—"}</strong><span>${esc(weekday)}</span></div>`;
  }).join("");
  $("#weeklyTextAlternative").textContent = state.weekLogs.map((log) => {
    const calories = Number(log.totals?.calories || 0);
    return `${dateLabel(log.dateKey)}: ${calories ? formatNutritionAmount(calories, "kcal", language, 0) : copy.notLogged}`;
  }).join(" · ");
  $("#weeklyChart").setAttribute("aria-label", $("#weeklyTextAlternative").textContent);
}

function render() {
  $("#selectedDate").value = state.dateKey;
  $("#selectedDateLabel").textContent = dateLabel(state.dateKey);
  const totals = totalsForEntries(state.log.entries);
  state.log.totals = totals;
  updateWeekLog();
  renderTargets(totals);
  renderMacroDistribution(totals);
  renderBalance(totals);
  renderEntries();
  renderRecentFoods();
  renderCombinations();
  renderWeek();
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
    console.error("Daily nutrition: today's log did not load; starting a local working log.", error);
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
    : copy.clarificationTitle;
  const hint = ambiguity.kind === "brand" ? copy.brandClarificationHint
    : ambiguity.kind === "size" ? copy.sizeClarificationHint
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

function submitFoodText(value) {
  let result = parseFoodText(value, { customFoods: state.customFoods });
  if (result.ambiguities.length === 1) {
    const remembered = localStorage.getItem(`fp-daily-choice-${result.ambiguities[0].segment.replace(/\d+/g, "").trim()}`);
    const rememberedChoice = result.ambiguities[0].choices.find((choice) => (choice.choiceId || choice.foodId) === remembered);
    if (rememberedChoice) {
      const resolved = resolveFoodChoice(rememberedChoice.foodId, {
        amount: rememberedChoice.amount ?? result.ambiguities[0].amount,
        unit: rememberedChoice.unit || result.ambiguities[0].unit,
        estimate: rememberedChoice.estimate || null,
        rawText: result.ambiguities[0].segment,
        customFoods: state.customFoods
      });
      result = { ...result, status: result.errors.length ? "partial" : "ready", entries: [...result.entries, resolved], ambiguities: [] };
    }
  }
  if (result.ambiguities.length) {
    renderClarification(result);
    return;
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
      customFoods: state.customFoods
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
    const branded = parseFoodText(brand, { customFoods: state.customFoods });
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
      customFoods: state.customFoods
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
        const scaled = resolveFoodChoice(entry.foodId, { amount, unit: entry.unit, rawText: entry.rawText, customFoods: state.customFoods });
        state.log.entries[index] = { ...entry, ...scaled, estimated: false, approximate: false, estimateConfidence: null, estimatedGrams: null, portionCount: null, portionSize: null, portionKind: null, compositeEstimate: false };
        state.editingId = null;
        queueSave();
      } catch {
        setComposerMessage(copy.saveError, true);
      }
    }
    render();
  });
  $("#recentFoods").addEventListener("click", (event) => {
    const button = event.target.closest("[data-recent-index]");
    if (!button) return;
    const entries = JSON.parse($("#recentFoods").dataset.entries || "[]");
    const entry = entries[Number(button.dataset.recentIndex)];
    if (entry) addEntries([{ ...entry, id: undefined }]);
  });
  $("#customFoodForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const customForm = event.currentTarget;
    const values = Object.fromEntries(new FormData(customForm).entries());
    values.favorite = customForm.elements.favorite.checked;
    try {
      const food = validateCustomFood(values);
      await saveCustomFood(db, state.user.uid, food);
      state.customFoods = [...state.customFoods.filter((item) => item.id !== food.id), food];
      customForm.reset();
      setComposerMessage(copy.customSaved);
      renderRecentFoods();
    } catch {
      setComposerMessage(copy.saveError, true);
    }
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
    queueSave();
  });
  $("#previousDay").addEventListener("click", () => loadDate(shiftDateKey(state.dateKey, -1)));
  $("#nextDay").addEventListener("click", () => loadDate(shiftDateKey(state.dateKey, 1)));
  $("#todayButton").addEventListener("click", () => loadDate(localDateKey()));
  $("#selectedDate").addEventListener("change", (event) => event.target.value && loadDate(event.target.value));
}

// Bind the primary composer before the protected-page gate finishes. This
// keeps a click from becoming a silent no-op while Firebase is resolving or
// when a transient profile read prevents the rest of the page from starting.
function bindFoodComposer() {
  const form = $("#foodComposerForm");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#foodInput");
    const value = input?.value.trim();
    if (!value) return;
    if (!state.log) {
      setComposerMessage(copy.loading, true);
      return;
    }
    try {
      submitFoodText(value);
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
    if (optional.some((result) => result.status === "rejected")) {
      setPageStatus(language === "he"
        ? "חלק מהיעדים או המזונות השמורים לא נטענו. ניתן לתעד מזון מהקטלוג."
        : "Some targets or saved foods could not load. Catalog food logging is available.", true);
    }
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
