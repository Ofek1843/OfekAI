import { auth, db } from "./firebase-config.js";
import { normalizeSubscription } from "./subscription-plans.js";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const grid = document.querySelector("#plansGrid");
const status = document.querySelector("#plansStatus");
const count = document.querySelector("#planCount");
const isHebrew = (localStorage.getItem("ofek-ai-language") || "en") === "he";
const ui = isHebrew ? {
  title: "תוכניות התזונה שלי", description: "בחר את תוכנית התזונה הנוכחית שלך. התוכנית הפעילה מסומנת בירוק.", back: "חזרה ל־TrainIQ ←", create: "+ יצירת תוכנית תזונה", count: " מתוך 5 תוכניות שמורות", loading: "טוען את התוכניות שלך...", empty: "עדיין אין תוכניות תזונה שמורות.", active: "● תוכנית פעילה", use: "השתמש בתוכנית הזאת", current: "התוכנית הנוכחית", rename: "שינוי שם", remove: "מחיקה", prompt: "הזן שם חדש לתוכנית:", confirm: "למחוק את תוכנית התזונה? לא ניתן לבטל פעולה זו.", calories: "קלוריות", protein: "גרם חלבון", error: "לא ניתן היה להשלים את הפעולה. נסה שוב."
} : {
  title: "My Nutrition Plans", description: "Choose your current nutrition plan. The active plan is highlighted in green.", back: "← Back to TrainIQ", create: "+ Create nutrition plan", count: " of 5 saved plans", loading: "Loading your plans...", empty: "No saved nutrition plans yet.", active: "● Active plan", use: "Use this plan", current: "Current plan", rename: "Rename", remove: "Delete", prompt: "Enter a new name for this plan:", confirm: "Delete this nutrition plan? This cannot be undone.", calories: "calories", protein: "g protein", error: "Could not complete the action. Please try again."
};

document.documentElement.lang = isHebrew ? "he" : "en";
document.documentElement.dir = isHebrew ? "rtl" : "ltr";
document.querySelector("#pageTitle").textContent = ui.title;
document.querySelector("#pageDescription").textContent = ui.description;
document.querySelector("#backLink").textContent = ui.back;
document.querySelector("#builderLink").textContent = ui.create;
document.querySelector("#planCountLabel").textContent = ui.count;
status.textContent = ui.loading;

let user = null;
let plans = [];
let activeId = null;
let subscription = normalizeSubscription({});
const esc = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function lockedSlotsMarkup() {
  return ""; // Early Access keeps all five slots unlocked.
  if (subscription.planId === "pro") return "";
  const firstLockedSlot = Math.max(2, plans.length + 1);
  return Array.from({ length: Math.max(0, 6 - firstLockedSlot) }, (_, index) => {
    const slot = firstLockedSlot + index;
    const title = isHebrew ? `תוכנית תזונה ${slot}` : `Nutrition plan ${slot}`;
    const copy = isHebrew ? "זמין במסלול TrainIQ Pro" : "Available with TrainIQ Pro";
    const action = isHebrew ? "פתיחת Pro" : "Unlock with Pro";
    return `<a class="plan-card locked-plan" href="/pricing.html" aria-label="${esc(action)}"><span class="lock-animation" aria-hidden="true"><span class="lock-shackle"></span><span class="lock-body">●</span></span><span class="pro-slot">PRO</span><h2>${esc(title)}</h2><p>${esc(copy)}</p><span class="unlock-action">${esc(action)} →</span></a>`;
  }).join("");
}

function render() {
  count.textContent = String(plans.length);
  status.textContent = "";
  status.classList.remove("error");
  document.querySelector("#planCountLabel").textContent = subscription.planId === "pro" ? ui.count : (isHebrew ? " מתוך תוכנית חינמית אחת" : " of 1 Free plan");
  document.querySelector("#planCountLabel").textContent = ui.count;
  if (!plans.length) { grid.innerHTML = `<div class="empty-state"><h2>${ui.empty}</h2><a class="primary-link" href="/nutrition-builder.html">${ui.create}</a></div>${lockedSlotsMarkup()}`; return; }
  grid.innerHTML = plans.map((saved) => {
    const plan = saved.plan || {};
    const active = saved.id === activeId;
    return `<article class="plan-card${active ? " active" : ""}" data-id="${esc(saved.id)}">
      <span class="active-badge">${ui.active}</span><h2>${esc(saved.name || plan.planName || "Nutrition Plan")}</h2>
      <div class="plan-meta"><span>${esc(plan.dailyCalories ?? "-")} ${ui.calories}</span><span>${esc(plan.proteinGrams ?? "-")} ${ui.protein}</span></div>
      <div class="plan-actions"><button class="activate-button" type="button" ${active ? "disabled" : ""}>${active ? ui.current : ui.use}</button>
      <div class="manage-actions"><button class="rename-button" type="button">✏️ ${ui.rename}</button><button class="delete-button" type="button">🗑️ ${ui.remove}</button></div></div></article>`;
  }).join("") + lockedSlotsMarkup();
  grid.querySelectorAll(".activate-button:not(:disabled)").forEach((button) => button.addEventListener("click", () => activate(button.closest(".plan-card").dataset.id)));
  grid.querySelectorAll(".rename-button").forEach((button) => button.addEventListener("click", () => rename(button.closest(".plan-card").dataset.id)));
  grid.querySelectorAll(".delete-button").forEach((button) => button.addEventListener("click", () => remove(button.closest(".plan-card").dataset.id)));
}

async function activate(id) {
  try { await setDoc(doc(db, "users", user.uid), { activeNutritionPlanId: id }, { merge: true }); activeId = id; render(); }
  catch (error) { console.error(error); showError(); }
}

async function rename(id) {
  const saved = plans.find((item) => item.id === id);
  const name = window.prompt(ui.prompt, saved?.name || saved?.plan?.planName || "Nutrition Plan");
  if (name === null) return;
  const clean = name.trim();
  if (!clean || clean.length > 80) return showError();
  try { await updateDoc(doc(db, "users", user.uid, "nutritionPlans", id), { name: clean, updatedAt: serverTimestamp() }); saved.name = clean; render(); }
  catch (error) { console.error(error); showError(); }
}

async function remove(id) {
  if (!window.confirm(ui.confirm)) return;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, "users", user.uid, "nutritionPlans", id));
    if (id === activeId) batch.set(doc(db, "users", user.uid), { activeNutritionPlanId: null }, { merge: true });
    await batch.commit();
    plans = plans.filter((item) => item.id !== id);
    if (id === activeId) activeId = null;
    render();
  } catch (error) { console.error(error); showError(); }
}

function showError() { status.textContent = ui.error; status.classList.add("error"); }

onAuthStateChanged(auth, async (currentUser) => {
  if (!currentUser) return window.location.replace("/auth.html");
  user = currentUser;
  try {
    const [plansSnapshot, userSnapshot] = await Promise.all([
      getDocs(query(collection(db, "users", user.uid, "nutritionPlans"), orderBy("createdAt", "desc"), limit(5))),
      getDoc(doc(db, "users", user.uid))
    ]);
    plans = plansSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const userData = userSnapshot.exists() ? userSnapshot.data() : {};
    activeId = userData.activeNutritionPlanId || null;
    subscription = normalizeSubscription(userData.subscription);
    render();
  } catch (error) { console.error(error); showError(); }
});

if (isHebrew) document.querySelector("#earlyAccessNote").innerHTML = "<strong>גישה מוקדמת:</strong> כל חמשת המקומות לתוכניות תזונה פתוחים עכשיו בחינם. מקומות 2–5 מתוכננים לעבור ל־Pro בהמשך.";

document.querySelector("#builderLink")?.addEventListener("click", (event) => {
  if (false && subscription.planId !== "pro" && plans.length >= 1) {
    event.preventDefault();
    window.location.href = "/pricing.html";
  }
});
