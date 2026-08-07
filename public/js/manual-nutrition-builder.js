import { db } from "./firebase-config.js";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { guardProtectedPage } from "./verification-gate.js";

const $ = selector => document.querySelector(selector);
const CATEGORY_OPTIONS = [
  ["high-protein", "High Protein", "חלבון גבוה"], ["low-calorie", "Low Calorie", "דל קלוריות"], ["balanced", "Balanced", "מאוזן"],
  ["vegan", "Vegan", "טבעוני"], ["vegetarian", "Vegetarian", "צמחוני"], ["pescatarian", "Pescatarian", "פסקטריאני"],
  ["breakfast", "Breakfast", "ארוחת בוקר"], ["lunch", "Lunch", "צהריים"], ["dinner", "Dinner", "ערב"], ["snack", "Snack", "נשנוש"],
  ["high-fiber", "High Fiber", "עשיר בסיבים"], ["lower-carb", "Lower Carb", "דל יחסית בפחמימות"], ["pre-workout", "Pre-Workout", "לפני אימון"], ["post-workout", "Post-Workout", "אחרי אימון"]
];
const state = {
  user: null, targets: null, selected: [], editingId: null,
  language: localStorage.getItem("ofek-ai-language") === "he" ? "he" : "en",
  activeCategories: [], menuOpen: false,
  discovery: { offset: 0, hasMore: false, requestId: 0, controller: null, timer: null, loading: false, results: [] }
};
document.documentElement.lang = state.language;
document.documentElement.dir = state.language === "he" ? "rtl" : "ltr";
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const parseList = value => String(value || "").split(/[,;|\n]+/).map(item => item.trim()).filter(Boolean);

function status(message, error = false, target = $("#pageStatus")) { target.textContent = message; target.classList.toggle("error", error); }
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { Authorization: "Bearer " + await state.user.getIdToken(), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The manual nutrition action failed.");
  return data;
}
function targetInput() { return { age: number($("#age").value), gender: $("#gender").value, height: number($("#height").value), weight: number($("#weight").value), activityLevel: $("#activityLevel").value, goal: $("#goal").value }; }
function targetsMarkup(targets) {
  return [["BMR", targets.bmr, "kcal"], ["TDEE", targets.tdee, "kcal"], ["Daily calories", targets.dailyCalories, "kcal"], ["Protein", targets.proteinGrams, "g"], ["Carbohydrates", targets.carbsGrams, "g"], ["Fat", targets.fatGrams, "g"]]
    .map(item => '<div class="target-stat"><span>' + item[0] + '</span><strong>' + Math.round(item[1]) + ' ' + item[2] + '</strong></div>').join("");
}
function discoveryHasInput() { return $("#mealQuery").value.trim().length >= 2 || state.activeCategories.length > 0 || Boolean($("#mealSlot").value); }
function renderDiscoveryPrompt() {
  const text = $("#mealQuery").value.trim().length === 1 ? "Type one more character to search." : "Search by meal, ingredient or category to discover compatible meals.";
  $("#mealResults").innerHTML = '<div class="discovery-empty"><strong>Find your next meal</strong><span>' + esc(text) + '</span></div>';
  $("#loadMoreMeals").hidden = true;
}
function renderCategoryChips() {
  const hebrew = state.language === "he";
  $("#categoryChips").innerHTML = CATEGORY_OPTIONS.map(item => '<button type="button" class="category-chip' + (state.activeCategories.includes(item[0]) ? " active" : "") + '" aria-pressed="' + state.activeCategories.includes(item[0]) + '" data-category="' + item[0] + '">' + esc(hebrew ? item[2] : item[1]) + '</button>').join("");
}
function mealQuery(offset = 0) {
  const params = new URLSearchParams({ q: $("#mealQuery").value.trim(), diet: $("#diet").value, allergies: parseList($("#allergies").value).join(","), exclusions: parseList($("#exclusions").value).join(","), categories: state.activeCategories.join(","), language: state.language, limit: "8", offset: String(offset) });
  if ($("#mealSlot").value) params.set("slot", $("#mealSlot").value);
  return params;
}
function renderResults() {
  const selectedIds = new Set(state.selected.map(item => item.id));
  $("#mealResults").innerHTML = state.discovery.results.length ? state.discovery.results.map(meal => {
    const labels = (meal.categoryLabels || []).join(" · ");
    return '<article class="meal-card"><img src="' + esc(meal.image || "/images/food-placeholder.png") + '" alt="" loading="lazy" onerror="this.src=\'/images/food-placeholder.png\'"><div class="meal-card-body"><h3>' + esc(meal.title) + '</h3><p>' + esc(meal.ingredients) + '</p><p>' + esc(meal.servingSize) + '</p>' +
      (labels ? '<p class="meal-categories">' + esc(labels) + '</p>' : "") +
      '<div class="meal-meta" aria-label="' + (state.language === "he" ? "ערכים תזונתיים" : "Nutrition") + '"><span><strong>Calories</strong> ' + meal.calories + ' kcal</span><span><strong>Protein</strong> ' + meal.proteinGrams + 'g</span><span><strong>Carbohydrates</strong> ' + meal.carbsGrams + 'g</span><span><strong>Fat</strong> ' + meal.fatGrams + 'g</span></div><button type="button" data-add-meal="' + esc(meal.id) + '"' + (selectedIds.has(meal.id) ? " disabled" : "") + '>' + (selectedIds.has(meal.id) ? "Added" : "Add meal") + '</button></div></article>';
  }).join("") : '<p class="manual-status">No compatible meals found. Try another search or category.</p>';
}
async function searchMeals({ append = false, immediate = false } = {}) {
  if (!discoveryHasInput()) { state.discovery.offset = 0; state.discovery.hasMore = false; state.discovery.results = []; renderDiscoveryPrompt(); return; }
  if (!immediate && $("#mealQuery").value.trim().length === 1) { renderDiscoveryPrompt(); return; }
  const requestId = ++state.discovery.requestId;
  state.discovery.controller?.abort();
  state.discovery.controller = new AbortController();
  const offset = append ? state.discovery.offset : 0;
  if (!append) state.discovery.results = [];
  try {
    const data = await api("/api/nutrition/manual/meals?" + mealQuery(offset), { signal: state.discovery.controller.signal });
    if (requestId !== state.discovery.requestId) return;
    const seen = new Set(state.discovery.results.map(meal => meal.id));
    const incoming = (data.meals || []).filter(meal => !seen.has(meal.id));
    state.discovery.results = append ? state.discovery.results.concat(incoming) : incoming;
    state.discovery.offset = offset + (data.meals || []).length;
    state.discovery.hasMore = Boolean(data.hasMore);
    renderResults();
    $("#loadMoreMeals").hidden = !state.discovery.hasMore;
  } catch (error) {
    if (error.name !== "AbortError" && requestId === state.discovery.requestId) {
      $("#mealResults").innerHTML = '<p class="manual-status error">' + esc(error.message) + '</p>';
      $("#loadMoreMeals").hidden = true;
    }
  }
}
function queueSearch() { clearTimeout(state.discovery.timer); state.discovery.timer = setTimeout(() => searchMeals(), 250); }
function scaledMeal(item) {
  const servings = Math.max(.25, Math.min(8, number(item.servings) || 1));
  const foods = item.foods.map(food => ({ ...food, grams: food.grams ? Math.round(food.grams * servings) : food.grams, amount: (food.amount || "") + (servings === 1 ? "" : " · " + servings), calories: Math.round(number(food.calories) * servings), proteinGrams: Math.round(number(food.proteinGrams) * servings), carbsGrams: Math.round(number(food.carbsGrams) * servings), fatGrams: Math.round(number(food.fatGrams) * servings), fiberGrams: Number((number(food.fiberGrams) * servings).toFixed(1)) }));
  return { ...item, foods, calories: foods.reduce((sum, food) => sum + food.calories, 0), proteinGrams: foods.reduce((sum, food) => sum + food.proteinGrams, 0), carbsGrams: foods.reduce((sum, food) => sum + food.carbsGrams, 0), fatGrams: foods.reduce((sum, food) => sum + food.fatGrams, 0), fiberGrams: Number(foods.reduce((sum, food) => sum + food.fiberGrams, 0).toFixed(1)) };
}
function currentTotals() {
  return state.selected.reduce((sum, item) => { const meal = scaledMeal(item); for (const key of ["calories", "proteinGrams", "carbsGrams", "fatGrams", "fiberGrams"]) sum[key] += meal[key]; return sum; }, { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 });
}
function renderRunningTotals() {
  const total = currentTotals();
  if (!state.selected.length) { $("#runningTotals").hidden = true; return; }
  $("#runningTotals").hidden = false;
  const rows = [["Calories", total.calories, state.targets?.dailyCalories || 0, "kcal"], ["Protein", total.proteinGrams, state.targets?.proteinGrams || 0, "g"], ["Carbohydrates", total.carbsGrams, state.targets?.carbsGrams || 0, "g"], ["Fat", total.fatGrams, state.targets?.fatGrams || 0, "g"]];
  $("#runningTotals").innerHTML = rows.map(item => {
    const delta = Math.round(item[2] - item[1]);
    const guidance = delta > 0 ? "Add approximately " + Math.abs(delta) + " " + item[3] + " " + item[0].toLowerCase() : delta < 0 ? Math.abs(delta) + " " + item[3] + " above target" : "Close to target";
    return '<div class="running-stat"><span><strong>' + item[0] + '</strong> ' + Math.round(item[1]) + ' / ' + Math.round(item[2]) + ' ' + item[3] + '</span><b>' + (delta > 0 ? Math.abs(delta) + " " + item[3] + " left" : delta < 0 ? Math.abs(delta) + " " + item[3] + " over" : "On target") + '</b><div class="progress-track" role="progressbar" aria-label="' + esc(item[0]) + ' progress" aria-valuemin="0" aria-valuemax="' + Math.max(1, Math.round(item[2])) + '" aria-valuenow="' + Math.max(0, Math.round(item[1])) + '"><i style="--progress:' + Math.min(100, item[2] ? item[1] / item[2] * 100 : 0) + '%"></i></div><span>' + esc(guidance) + '</span></div>';
  }).join("");
}
function renderSelected() {
  $("#selectedMeals").innerHTML = state.selected.length ? state.selected.map((item, index) => {
    const meal = scaledMeal(item);
    return '<article class="selected-meal" data-index="' + index + '"><img src="' + esc(item.image || "/images/food-placeholder.png") + '" alt="" loading="lazy" onerror="this.src=\'/images/food-placeholder.png\'"><div class="selected-meal-body"><h3>' + (index + 1) + '. ' + esc(item.title) + '</h3><p>' + esc(meal.foods.map(food => food.name + " · " + food.amount).join(", ")) + '</p><div class="meal-meta"><span><strong>Calories</strong> ' + meal.calories + ' kcal</span><span><strong>Protein</strong> ' + meal.proteinGrams + 'g</span><span><strong>Carbohydrates</strong> ' + meal.carbsGrams + 'g</span><span><strong>Fat</strong> ' + meal.fatGrams + 'g</span></div><div class="selected-controls"><label>Servings <input type="number" min="0.25" max="8" step="0.25" value="' + item.servings + '" data-portion></label><button type="button" data-up' + (index === 0 ? " disabled" : "") + '>↑ Move up</button><button type="button" data-down' + (index === state.selected.length - 1 ? " disabled" : "") + '>↓ Move down</button><button type="button" data-remove>Remove</button></div></div></article>';
  }).join("") : '<p class="manual-status">Add meals above to start your menu.</p>';
  renderRunningTotals();
  const total = currentTotals();
  $("#mobileMenuCount").textContent = state.selected.length + " " + (state.selected.length === 1 ? "meal" : "meals");
  $("#mobileMenuCalories").textContent = Math.round(total.calories) + " kcal";
  $("#mobileMenuToggle").hidden = !state.selected.length;
}
function addMeal(mealId) {
  if (state.selected.some(item => item.id === mealId)) return;
  api("/api/nutrition/manual/meals/" + encodeURIComponent(mealId) + "?language=" + state.language).then(({ meal }) => { state.selected.push({ ...meal, servings: 1 }); renderSelected(); renderResults(); }).catch(error => status(error.message, true));
}
function readExistingMeal(meal) {
  const option = meal.options?.[0] || meal;
  return { id: meal.mealId || meal.id || "saved-" + Math.random(), title: meal.name || option.name || "Meal", image: option.image || meal.image || "/images/food-placeholder.png", foods: option.baseFoods || option.foods || [], servings: Math.max(.25, Math.min(8, number(option.servings) || 1)) };
}
async function loadExisting() {
  const params = new URLSearchParams(location.search), sourceId = params.get("duplicate") || params.get("edit");
  state.editingId = params.get("edit") || null;
  if (!sourceId) return;
  const snapshot = await getDoc(doc(db, "users", state.user.uid, "nutritionPlans", sourceId));
  if (!snapshot.exists()) return;
  const saved = snapshot.data();
  $("#planTitle").value = params.get("duplicate") ? (saved.name || saved.plan?.planName || "Nutrition Plan") + " · copy" : saved.name || saved.plan?.planName || "Nutrition Plan";
  state.targets = saved.targetSummary || { dailyCalories: saved.plan?.dailyCalories || 0, proteinGrams: saved.plan?.proteinGrams || 0, carbsGrams: saved.plan?.carbsGrams || 0, fatGrams: saved.plan?.fatGrams || 0, bmr: saved.calculationSnapshot?.bmr || 0, tdee: saved.calculationSnapshot?.tdee || 0 };
  $("#targetSummary").hidden = false; $("#targetSummary").innerHTML = targetsMarkup(state.targets);
  state.selected = (saved.plan?.meals || []).map(readExistingMeal); renderSelected();
}
function planPayload() {
  const totals = currentTotals();
  const meals = state.selected.map((item, index) => { const meal = scaledMeal(item); return { mealNumber: index + 1, name: item.title, options: [{ optionNumber: 1, name: item.title, servings: item.servings, baseFoods: item.foods, foods: meal.foods, optionCalories: meal.calories, optionProteinGrams: meal.proteinGrams, optionCarbsGrams: meal.carbsGrams, optionFatGrams: meal.fatGrams, optionFiberGrams: meal.fiberGrams, image: item.image }] }; });
  return { name: $("#planTitle").value.trim() || "Manual nutrition plan", sourceType: "manual", calculationSnapshot: { bmr: state.targets?.bmr || null, tdee: state.targets?.tdee || null, goal: state.targets?.goal || null }, targetSummary: { dailyCalories: state.targets?.dailyCalories || 0, proteinGrams: state.targets?.proteinGrams || 0, carbsGrams: state.targets?.carbsGrams || 0, fatGrams: state.targets?.fatGrams || 0 }, plan: { planName: $("#planTitle").value.trim() || "Manual nutrition plan", dietaryStyle: $("#diet").value, meals, dailyCalories: state.targets?.dailyCalories || 0, proteinGrams: state.targets?.proteinGrams || 0, carbsGrams: state.targets?.carbsGrams || 0, fatGrams: state.targets?.fatGrams || 0, actualTotals: totals } };
}
async function calculateTargets(event) {
  event.preventDefault();
  try { const data = await api("/api/nutrition/manual/targets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(targetInput()) }); state.targets = data.targets; $("#targetSummary").hidden = false; $("#targetSummary").innerHTML = targetsMarkup(state.targets); renderDiscoveryPrompt(); status(data.estimateNotice); } catch (error) { status(error.message, true); }
}
async function savePlan() {
  if (!state.targets || !state.selected.length) return status("Calculate targets and add at least one meal before saving.", true, $("#saveStatus"));
  const payload = planPayload(); if (!payload.name || payload.name.length > 80) return status("Enter a plan title up to 80 characters.", true, $("#saveStatus"));
  const button = $("#savePlan"); button.disabled = true;
  try {
    let id = state.editingId;
    if (id && !new URLSearchParams(location.search).get("duplicate")) await updateDoc(doc(db, "users", state.user.uid, "nutritionPlans", id), { ...payload, updatedAt: serverTimestamp() });
    else { const ref = await addDoc(collection(db, "users", state.user.uid, "nutritionPlans"), { ...payload, active: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); id = ref.id; state.editingId = id; }
    $("#shareSavedPlan").href = "/social.html?share=nutrition&sourceId=" + encodeURIComponent(id); $("#shareSavedPlan").hidden = false; status("Manual plan saved.", false, $("#saveStatus"));
  } catch (error) { status(error.message || "Could not save this plan.", true, $("#saveStatus")); } finally { button.disabled = false; }
}
function toggleMenu(open = !state.menuOpen) { state.menuOpen = open; $("#dailyMenuPanel").classList.toggle("open", open); $("#dailyMenuPanel").setAttribute("aria-hidden", String(!open)); $("#mobileMenuToggle").setAttribute("aria-expanded", String(open)); }

$("#targetForm").addEventListener("submit", calculateTargets);
$("#mealSearchForm").addEventListener("submit", event => { event.preventDefault(); clearTimeout(state.discovery.timer); searchMeals({ immediate: true }); });
$("#mealQuery").addEventListener("input", queueSearch);
$("#mealSlot").addEventListener("change", () => searchMeals({ immediate: true }));
$("#categoryChips").addEventListener("click", event => { const button = event.target.closest("[data-category]"); if (!button) return; const key = button.dataset.category; state.activeCategories = state.activeCategories.includes(key) ? state.activeCategories.filter(item => item !== key) : state.activeCategories.concat(key); renderCategoryChips(); searchMeals({ immediate: true }); });
$("#clearMealFilters").addEventListener("click", () => { $("#mealQuery").value = ""; $("#mealSlot").value = ""; state.activeCategories = []; renderCategoryChips(); renderDiscoveryPrompt(); });
$("#loadMoreMeals").addEventListener("click", () => searchMeals({ append: true, immediate: true }));
$("#mealResults").addEventListener("click", event => { const button = event.target.closest("[data-add-meal]"); if (button) addMeal(button.dataset.addMeal); });
$("#selectedMeals").addEventListener("input", event => { if (!event.target.matches("[data-portion]")) return; const item = state.selected[Number(event.target.closest("[data-index]").dataset.index)]; item.servings = Math.max(.25, Math.min(8, number(event.target.value) || 1)); renderSelected(); });
$("#selectedMeals").addEventListener("click", event => { const card = event.target.closest("[data-index]"); if (!card) return; const index = Number(card.dataset.index); if (event.target.closest("[data-remove]")) state.selected.splice(index, 1); if (event.target.closest("[data-up]") && index > 0) [state.selected[index - 1], state.selected[index]] = [state.selected[index], state.selected[index - 1]]; if (event.target.closest("[data-down]") && index < state.selected.length - 1) [state.selected[index + 1], state.selected[index]] = [state.selected[index], state.selected[index + 1]]; renderSelected(); });
$("#savePlan").addEventListener("click", savePlan);
$("#mobileMenuToggle").addEventListener("click", () => toggleMenu());
$("#closeMenuDrawer").addEventListener("click", () => toggleMenu(false));

renderCategoryChips(); renderDiscoveryPrompt();
guardProtectedPage({ onAuthenticated: async user => { state.user = user; try { await loadExisting(); if (!state.targets) await calculateTargets({ preventDefault() {} }); renderDiscoveryPrompt(); } catch (error) { status(error.message, true); } } });
