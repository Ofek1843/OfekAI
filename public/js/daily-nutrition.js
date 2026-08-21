import { auth, db } from "./firebase-config.js";
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
} from "./daily-nutrition-domain.mjs";
import {
  copyPreviousDay,
  loadCustomFoods,
  loadDailyLog,
  loadNutritionWeek,
  loadSavedCombinations,
  saveCustomFood,
  saveDailyLog,
  saveFoodCombination
} from "./daily-nutrition-store.mjs";
import { dailyNutritionCopy } from "./daily-nutrition-i18n.mjs";

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

const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const format = (template, values = {}) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), String(template || ""));
const number = (value, precision = 0) => Number(value || 0).toLocaleString(language === "he" ? "he-IL" : "en-US", { maximumFractionDigits: precision });

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
    ? ["50 גרם שיבולת שועל", "250 גרם קוטג׳ 3% ו-4 פריכיות", "1 משקה חלבון"]
    : ["50g oats", "250g cottage cheese 3% and 4 rice cakes", "1 protein drink"];
  document.querySelectorAll("[data-example]").forEach((button, index) => {
    button.dataset.example = examples[index];
    button.textContent = examples[index];
  });
}

function entryName(entry) {
  return entry.name?.[language] || entry.name?.en || entry.name?.he || "—";
}

function displayUnit(unit, amount) {
  if (unit === "g") return language === "he" ? `${number(amount, 1)} גרם` : `${number(amount, 1)} g`;
  if (unit === "ml") return language === "he" ? `${number(amount, 1)} מ״ל` : `${number(amount, 1)} ml`;
  return language === "he" ? `${number(amount, 1)} יח׳` : `${number(amount, 1)} item${Number(amount) === 1 ? "" : "s"}`;
}

function dateFromKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function dateLabel(dateKey) {
  if (dateKey === localDateKey()) return copy.today;
  return new Intl.DateTimeFormat(language === "he" ? "he-IL" : "en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(dateFromKey(dateKey));
}

function setPageStatus(message = "", error = false) {
  $("#pageStatus").textContent = message;
  $("#pageStatus").classList.toggle("error", error);
}

function setComposerMessage(message = "", error = false) {
  $("#composerMessage").textContent = message;
  $("#composerMessage").classList.toggle("error", error);
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
  const status = $("#autosaveState");
  status.textContent = copy.savingStatus;
  status.className = "autosave-state saving";
  state.saveChain = state.saveChain
    .catch(() => undefined)
    .then(() => saveDailyLog(db, state.user.uid, state.dateKey, state.log))
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
  $("#calorieTarget").textContent = calorieTarget ? `${number(calorieTarget)} kcal` : "—";
  $("#calorieRemaining").textContent = calorieTarget
    ? `${number(Math.abs(remaining.calories))} kcal${remaining.calories < 0 ? ` ${copy.over}` : ""}`
    : "—";
  $("#proteinConsumed").textContent = number(totals.proteinGrams, 1);
  $("#proteinRemaining").textContent = proteinTarget
    ? `${number(Math.abs(remaining.proteinGrams), 1)} g${remaining.proteinGrams < 0 ? ` ${copy.over}` : ""}`
    : "—";
  const proteinPercent = proteinTarget ? Math.min(100, (totals.proteinGrams / proteinTarget) * 100) : 0;
  $("#proteinProgress").style.width = `${proteinPercent}%`;
  $(".protein-progress").setAttribute("aria-valuenow", String(Math.round(proteinPercent)));
  const maintenance = Number(targets.maintenanceCalories || state.log?.maintenanceSnapshot || 0);
  $("#maintenanceValue").textContent = maintenance ? `${number(maintenance)} kcal` : "—";
  $("#targetMessage").textContent = !targets.complete ? copy.targetMissing : maintenance ? `${copy.goalTarget}: ${number(calorieTarget)} kcal` : copy.maintenanceMissing;
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
  $("#balanceValue").textContent = balance.balance === null ? "—" : `${balance.balance > 0 ? "+" : ""}${number(balance.balance)} kcal`;
  $("#balanceCard").dataset.status = balance.status;
}

function renderEntries() {
  const body = $("#foodEntries");
  $("#entryCount").textContent = String(state.log.entries.length);
  $("#emptyEntries").hidden = state.log.entries.length > 0;
  body.innerHTML = state.log.entries.map((entry) => {
    const editing = state.editingId === entry.id;
    const amountCell = editing
      ? `<div class="entry-edit"><input data-edit-amount="${esc(entry.id)}" type="number" min="0.1" max="10000" step="0.1" value="${esc(entry.amount)}"><span>${esc(entry.unit)}</span></div>`
      : esc(displayUnit(entry.unit, entry.amount));
    const actions = editing
      ? `<button type="button" data-entry-action="save" data-entry-id="${esc(entry.id)}">${esc(copy.save)}</button><button type="button" data-entry-action="cancel" data-entry-id="${esc(entry.id)}">${esc(copy.cancel)}</button>`
      : `<button type="button" data-entry-action="edit" data-entry-id="${esc(entry.id)}">${esc(copy.edit)}</button><button type="button" data-entry-action="duplicate" data-entry-id="${esc(entry.id)}">${esc(copy.duplicate)}</button><button type="button" data-entry-action="delete" data-entry-id="${esc(entry.id)}">${esc(copy.delete)}</button>`;
    return `<tr data-entry-row="${esc(entry.id)}"><td><div class="food-name"><strong>${esc(entryName(entry))}</strong><small>${esc(entry.rawText || entry.source || "")}</small></div></td><td data-label="${esc(copy.amount)}">${amountCell}</td><td data-label="${esc(copy.calories)}">${number(entry.calories, 1)}</td><td data-label="${esc(copy.protein)}">${number(entry.proteinGrams, 1)} g</td><td data-label="${esc(copy.carbs)}">${number(entry.carbsGrams, 1)} g</td><td data-label="${esc(copy.fat)}">${number(entry.fatGrams, 1)} g</td><td><div class="entry-actions">${actions}</div></td></tr>`;
  }).join("");
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
    ? foods.map((entry, index) => `<button type="button" data-recent-index="${index}">${esc(entryName(entry))}<small> · ${esc(displayUnit(entry.unit, entry.amount))}</small></button>`).join("")
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
  $("#weeklyCalories").textContent = summary.loggedDays ? `${number(summary.averageCalories)} kcal` : "—";
  $("#weeklyProtein").textContent = summary.loggedDays ? `${number(summary.averageProteinGrams, 1)} g` : "—";
  $("#weeklyBalance").textContent = summary.averageBalance === null ? "—" : `${summary.averageBalance > 0 ? "+" : ""}${number(summary.averageBalance)} kcal`;
  $("#weeklyLogged").textContent = `${summary.loggedDays} / 7`;
  $("#weeklyDenominator").textContent = summary.loggedDays
    ? format(summary.loggedDays === 1 ? copy.averageOverOne : copy.averageOver, { count: summary.loggedDays })
    : copy.noWeekData;

  const maxCalories = Math.max(1, ...state.weekLogs.map((log) => Number(log.totals?.calories || 0)), Number(currentTargets().dailyCalories || 0));
  $("#weeklyChart").innerHTML = state.weekLogs.map((log) => {
    const calories = Number(log.totals?.calories || 0);
    const height = calories ? Math.max(5, Math.min(100, (calories / maxCalories) * 100)) : 0;
    const date = dateFromKey(log.dateKey);
    const weekday = copy.weekdayShort[date.getDay()];
    return `<div class="trend-day${calories ? "" : " is-empty"}"><div class="trend-bar-track"><span class="trend-bar" style="height:${height}%"></span></div><strong>${calories ? `${number(calories)} kcal` : "—"}</strong><span>${esc(weekday)}</span></div>`;
  }).join("");
  $("#weeklyTextAlternative").textContent = state.weekLogs.map((log) => {
    const calories = Number(log.totals?.calories || 0);
    return `${dateLabel(log.dateKey)}: ${calories ? `${number(calories)} kcal` : copy.notLogged}`;
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
  const [log, weekLogs] = await Promise.all([
    loadDailyLog(db, state.user.uid, state.dateKey),
    loadNutritionWeek(db, state.user.uid, state.dateKey)
  ]);
  state.log = log;
  if (!state.log.targetSnapshot && state.targets.complete) {
    state.log.targetSnapshot = { ...state.targets };
    state.log.maintenanceSnapshot = state.targets.maintenanceCalories;
  }
  state.weekLogs = weekLogs;
  render();
  setPageStatus(state.log.completed ? copy.dayFinished : "");
}

function addEntries(entries) {
  const createdAt = new Date().toISOString();
  const added = entries.map((entry) => ({ ...entry, id: crypto.randomUUID(), createdAt }));
  state.log.entries = [...state.log.entries, ...added].slice(0, 80);
  render();
  queueSave();
  $("#foodInput").value = "";
  $("#foodInput").focus();
}

function renderClarification(result) {
  state.pendingClarification = result;
  const ambiguity = result.ambiguities[0];
  const panel = $("#clarificationPanel");
  panel.hidden = false;
  panel.innerHTML = `<h3>${esc(copy.clarificationTitle)}</h3><p>${esc(copy.clarificationHint)}</p><div class="clarification-choices">${ambiguity.choices.map((choice) => `<button type="button" data-food-choice="${esc(choice.foodId)}">${esc(choice.name?.[language] || choice.name?.en)}</button>`).join("")}</div>`;
}

function submitFoodText(value) {
  let result = parseFoodText(value, { customFoods: state.customFoods });
  if (result.ambiguities.length === 1) {
    const remembered = localStorage.getItem(`fp-daily-choice-${result.ambiguities[0].segment.replace(/\d+/g, "").trim()}`);
    if (remembered && result.ambiguities[0].choices.some((choice) => choice.foodId === remembered)) {
      const resolved = resolveFoodChoice(remembered, { amount: result.ambiguities[0].amount, unit: result.ambiguities[0].unit, customFoods: state.customFoods });
      result = { ...result, status: result.errors.length ? "partial" : "ready", entries: [...result.entries, resolved], ambiguities: [] };
    }
  }
  if (result.errors.length) {
    setComposerMessage(format(copy.unknownFood, { food: result.errors.map((error) => error.segment).join(", ") }), true);
    return;
  }
  if (result.ambiguities.length) {
    renderClarification(result);
    return;
  }
  setComposerMessage();
  $("#clarificationPanel").hidden = true;
  addEntries(result.entries);
}

function bindEvents() {
  $("#foodComposerForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = $("#foodInput").value.trim();
    if (value) submitFoodText(value);
  });
  document.querySelectorAll("[data-example]").forEach((button) => button.addEventListener("click", () => {
    $("#foodInput").value = button.dataset.example;
    $("#foodInput").focus();
  }));
  $("#clarificationPanel").addEventListener("click", (event) => {
    const button = event.target.closest("[data-food-choice]");
    if (!button || !state.pendingClarification) return;
    const ambiguity = state.pendingClarification.ambiguities[0];
    const resolved = resolveFoodChoice(button.dataset.foodChoice, { amount: ambiguity.amount, unit: ambiguity.unit, customFoods: state.customFoods });
    localStorage.setItem(`fp-daily-choice-${ambiguity.segment.replace(/\d+/g, "").trim()}`, button.dataset.foodChoice);
    addEntries([...state.pendingClarification.entries, resolved]);
    state.pendingClarification = null;
    $("#clarificationPanel").hidden = true;
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
      state.log.entries.splice(index + 1, 0, { ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
      queueSave();
    }
    if (action === "save") {
      const amount = Number(document.querySelector(`[data-edit-amount="${CSS.escape(entry.id)}"]`)?.value);
      try {
        const scaled = resolveFoodChoice(entry.foodId, { amount, unit: entry.unit, customFoods: state.customFoods });
        state.log.entries[index] = { ...entry, ...scaled };
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
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    values.favorite = event.currentTarget.elements.favorite.checked;
    try {
      const food = validateCustomFood(values);
      await saveCustomFood(db, state.user.uid, food);
      state.customFoods = [...state.customFoods.filter((item) => item.id !== food.id), food];
      event.currentTarget.reset();
      setComposerMessage(copy.customSaved);
      renderRecentFoods();
    } catch {
      setComposerMessage(copy.saveError, true);
    }
  });
  $("#combinationForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name");
    if (!state.log.entries.length) return setComposerMessage(copy.emptyEntries, true);
    try {
      const combination = await saveFoodCombination(db, state.user.uid, { name, entries: state.log.entries });
      state.combinations = [...state.combinations.filter((item) => item.id !== combination.id), combination];
      event.currentTarget.reset();
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

async function init(user) {
  state.user = user;
  applyLanguage();
  bindEvents();
  try {
    await loadTargets();
    [state.customFoods, state.combinations] = await Promise.all([
      loadCustomFoods(db, user.uid),
      loadSavedCombinations(db, user.uid)
    ]);
    await loadDate(state.dateKey);
  } catch (error) {
    console.error("Daily nutrition initialization failed:", error);
    setPageStatus(copy.saveError, true);
  }
}

guardProtectedPage({ onAuthenticated: init });
