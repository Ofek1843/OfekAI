import { auth, db } from "./firebase-config.js";
import { normalizeSubscription } from "./subscription-plans.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const plansGrid = document.querySelector("#plansGrid");
const plansStatus = document.querySelector("#plansStatus");
const planCount = document.querySelector("#planCount");
const currentLanguage = localStorage.getItem("ofek-ai-language") || "en";
const isHebrew = currentLanguage === "he";

const ui = isHebrew
  ? {
      title: "תוכניות האימון שלי",
      description: "בחר את התוכנית שבה אתה משתמש כרגע. התוכנית הפעילה מסומנת בירוק.",
      back: "חזרה ל־TrainIQ ←",
      create: "+ יצירת תוכנית אימון",
      count: " מתוך 5 תוכניות שמורות",
      loading: "טוען את התוכניות שלך...",
      emptyTitle: "עדיין אין תוכניות שמורות",
      emptyText: "צור תוכנית אימון ולאחר מכן לחץ על שמירת תוכנית.",
      active: "● תוכנית פעילה",
      usePlan: "השתמש בתוכנית הזאת",
      currentPlan: "התוכנית הנוכחית",
      days: "ימים בשבוע",
      weeks: "שבועות",
      activating: "מפעיל...",
      rename: "שינוי שם",
      delete: "מחיקה",
      renamePrompt: "הזן שם חדש לתוכנית:",
      invalidName: "שם התוכנית חייב להכיל בין 1 ל־80 תווים.",
      renameError: "לא ניתן היה לשנות את שם התוכנית.",
      deleteConfirm: "למחוק את התוכנית הזאת? לא ניתן לבטל את הפעולה.",
      deleting: "מוחק...",
      deleteError: "לא ניתן היה למחוק את התוכנית.",
      loadError: "לא ניתן היה לטעון את תוכניות האימון.",
      activateError: "לא ניתן היה להפעיל את התוכנית. נסה שוב.",
      startWorkout: "התחלת אימון"
    }
  : {
      title: "My Workout Plans",
      description: "Choose the plan you are currently following. Your active plan is highlighted in green.",
      back: "← Back to TrainIQ",
      create: "+ Create workout plan",
      count: " of 5 saved plans",
      loading: "Loading your plans...",
      emptyTitle: "No saved plans yet",
      emptyText: "Create a workout plan and then select Save Workout.",
      active: "● Active plan",
      usePlan: "Use this plan",
      currentPlan: "Current plan",
      days: "days per week",
      weeks: "weeks",
      activating: "Activating...",
      rename: "Rename",
      delete: "Delete",
      renamePrompt: "Enter a new name for this plan:",
      invalidName: "The plan name must contain between 1 and 80 characters.",
      renameError: "Could not rename the plan.",
      deleteConfirm: "Delete this plan? This action cannot be undone.",
      deleting: "Deleting...",
      deleteError: "Could not delete the plan.",
      loadError: "Could not load your workout plans.",
      activateError: "Could not activate the plan. Please try again.",
      startWorkout: "Start Workout"
    };

document.documentElement.lang = isHebrew ? "he" : "en";
document.documentElement.dir = isHebrew ? "rtl" : "ltr";
document.querySelector("#pageTitle").textContent = ui.title;
document.querySelector("#pageDescription").textContent = ui.description;
document.querySelector("#backLink").textContent = ui.back;
document.querySelector("#builderLink").textContent = ui.create;
document.querySelector("#planCountLabel").textContent = ui.count;
plansStatus.textContent = ui.loading;

let currentUser = null;
let workoutPlans = [];
let activeWorkoutPlanId = null;
let subscription = normalizeSubscription({});

function lockedSlotsMarkup() {
  return ""; // Early Access keeps all five slots unlocked.
  if (subscription.planId === "pro") return "";
  const firstLockedSlot = Math.max(2, workoutPlans.length + 1);
  return Array.from({ length: Math.max(0, 6 - firstLockedSlot) }, (_, index) => {
    const slot = firstLockedSlot + index;
    const title = isHebrew ? `תוכנית אימון ${slot}` : `Workout plan ${slot}`;
    const copy = isHebrew ? "זמין במסלול TrainIQ Pro" : "Available with TrainIQ Pro";
    const action = isHebrew ? "פתיחת Pro" : "Unlock with Pro";
    return `<a class="plan-card locked-plan" href="/pricing.html" aria-label="${escapeHtml(action)}">
      <span class="lock-animation" aria-hidden="true"><span class="lock-shackle"></span><span class="lock-body">●</span></span>
      <span class="pro-slot">PRO</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p><span class="unlock-action">${escapeHtml(action)} →</span>
    </a>`;
  }).join("");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPlans() {
  planCount.textContent = String(workoutPlans.length);
  plansStatus.textContent = "";
  plansStatus.classList.remove("error");

  document.querySelector("#planCountLabel").textContent = true
    ? ui.count
    : (isHebrew ? " מתוך תוכנית חינמית אחת" : " of 1 Free plan");

  if (workoutPlans.length === 0) {
    plansGrid.innerHTML = `<div class="empty-state"><h2>${ui.emptyTitle}</h2><p>${ui.emptyText}</p><a class="primary-link" href="/workout-builder.html">${ui.create}</a></div>${lockedSlotsMarkup()}`;
    return;
  }

  plansGrid.innerHTML = workoutPlans.map(({ id, ...savedPlan }) => {
    const plan = savedPlan.plan || {};
    const isActive = id === activeWorkoutPlanId;
    const name = savedPlan.name || plan.programName || "Workout Plan";
    const meta = [
      plan.daysPerWeek ? `${escapeHtml(plan.daysPerWeek)} ${ui.days}` : "",
      plan.durationWeeks ? `${escapeHtml(plan.durationWeeks)} ${ui.weeks}` : "",
      plan.goal ? escapeHtml(plan.goal) : ""
    ].filter(Boolean);

    return `
      <article class="plan-card${isActive ? " active" : ""}" data-plan-id="${escapeHtml(id)}">
        <span class="active-badge">${ui.active}</span>
        <h2>${escapeHtml(name)}</h2>
        <div class="plan-meta">${meta.map((item) => `<span>${item}</span>`).join("")}</div>
        <div class="plan-actions">
          ${isActive ? `<a class="start-workout-link" href="/workout-tracker.html">🏋️ ${ui.startWorkout}</a>` : ""}
          <button class="activate-button" type="button" ${isActive ? "disabled" : ""}>
            ${isActive ? ui.currentPlan : ui.usePlan}
          </button>
          <div class="manage-actions">
            <button class="rename-button" type="button">✏️ ${ui.rename}</button>
            <button class="delete-button" type="button">🗑️ ${ui.delete}</button>
          </div>
        </div>
      </article>`;
  }).join("") + lockedSlotsMarkup();

  plansGrid.querySelectorAll(".activate-button:not(:disabled)").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest(".plan-card");
      await activatePlan(card.dataset.planId, button);
    });
  });

  plansGrid.querySelectorAll(".rename-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest(".plan-card");
      await renamePlan(card.dataset.planId);
    });
  });

  plansGrid.querySelectorAll(".delete-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest(".plan-card");
      await deletePlan(card.dataset.planId, button);
    });
  });
}

async function renamePlan(planId) {
  const savedPlan = workoutPlans.find((plan) => plan.id === planId);

  if (!savedPlan) {
    return;
  }

  const currentName = savedPlan.name || savedPlan.plan?.programName || "Workout Plan";
  const requestedName = window.prompt(ui.renamePrompt, currentName);

  if (requestedName === null) {
    return;
  }

  const newName = requestedName.trim();

  if (!newName || newName.length > 80) {
    plansStatus.textContent = ui.invalidName;
    plansStatus.classList.add("error");
    return;
  }

  if (newName === currentName) {
    return;
  }

  try {
    await updateDoc(
      doc(db, "users", currentUser.uid, "workoutPlans", planId),
      { name: newName, updatedAt: serverTimestamp() }
    );
    savedPlan.name = newName;
    renderPlans();
  } catch (error) {
    console.error("Could not rename workout plan:", error);
    plansStatus.textContent = ui.renameError;
    plansStatus.classList.add("error");
  }
}

async function deletePlan(planId, button) {
  if (!window.confirm(ui.deleteConfirm)) {
    return;
  }

  button.disabled = true;
  button.textContent = ui.deleting;

  try {
    const batch = writeBatch(db);
    batch.delete(
      doc(db, "users", currentUser.uid, "workoutPlans", planId)
    );

    if (planId === activeWorkoutPlanId) {
      batch.set(
        doc(db, "users", currentUser.uid),
        { activeWorkoutPlanId: null },
        { merge: true }
      );
    }

    await batch.commit();
    workoutPlans = workoutPlans.filter((plan) => plan.id !== planId);

    if (planId === activeWorkoutPlanId) {
      activeWorkoutPlanId = null;
    }

    renderPlans();
  } catch (error) {
    console.error("Could not delete workout plan:", error);
    plansStatus.textContent = ui.deleteError;
    plansStatus.classList.add("error");
    button.disabled = false;
    button.textContent = `🗑️ ${ui.delete}`;
  }
}

async function activatePlan(planId, button) {
  button.disabled = true;
  button.textContent = ui.activating;

  try {
    await setDoc(
      doc(db, "users", currentUser.uid),
      { activeWorkoutPlanId: planId },
      { merge: true }
    );
    activeWorkoutPlanId = planId;
    renderPlans();
  } catch (error) {
    console.error("Could not activate workout plan:", error);
    plansStatus.textContent = ui.activateError;
    plansStatus.classList.add("error");
    button.disabled = false;
    button.textContent = ui.usePlan;
  }
}

async function loadPlans(user) {
  const plansRef = collection(db, "users", user.uid, "workoutPlans");
  const plansQuery = query(plansRef, orderBy("createdAt", "desc"), limit(5));
  const [plansSnapshot, userSnapshot] = await Promise.all([
    getDocs(plansQuery),
    getDoc(doc(db, "users", user.uid))
  ]);

  workoutPlans = plansSnapshot.docs.map((planDocument) => ({
    id: planDocument.id,
    ...planDocument.data()
  }));
  const userData = userSnapshot.exists() ? userSnapshot.data() : {};
  activeWorkoutPlanId = userData.activeWorkoutPlanId || null;
  subscription = normalizeSubscription(userData.subscription);
  renderPlans();
}

document.querySelector("#builderLink")?.addEventListener("click", (event) => {
  if (false && subscription.planId !== "pro" && workoutPlans.length >= 1) {
    event.preventDefault();
    window.location.href = "/pricing.html";
  }
});

document.querySelector("#manualBuilderLink")?.addEventListener("click", (event) => {
  if (false && subscription.planId !== "pro" && workoutPlans.length >= 1) {
    event.preventDefault();
    window.location.href = "/pricing.html";
  }
});

if (isHebrew) document.querySelector("#earlyAccessNote").innerHTML = "<strong>גישה מוקדמת:</strong> כל חמשת המקומות לתוכניות אימון פתוחים עכשיו בחינם. מקומות 2–5 מתוכננים לעבור ל־Pro בהמשך.";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("/auth.html");
    return;
  }

  currentUser = user;
  try {
    await loadPlans(user);
  } catch (error) {
    console.error("Could not load workout plans:", error);
    plansStatus.textContent = ui.loadError;
    plansStatus.classList.add("error");
  }
});
