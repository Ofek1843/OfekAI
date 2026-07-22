import { auth, db } from "./firebase-config.js";
import { normalizeSubscription } from "./subscription-plans.js";
import { trackPageView } from "./analytics.js";
import {
  createWeeklyScheduleDays,
  getWeekdayLabels,
  normalizeDayIndex
} from "./schedule-utils.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
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
      back: "← חזרה ל־FuelPhysique",
      create: "+ יצירת תוכנית אימון",
      manualCreate: "בניית תוכנית בעצמי",
      count: " מתוך 5 תוכניות שמורות",
      loading: "טוען את התוכניות שלך...",
      emptyTitle: "עדיין אין תוכניות שמורות",
      emptyText: "צור תוכנית אימון ולאחר מכן לחץ על שמירת תוכנית.",
      earlyAccess: "<strong>גישה מוקדמת:</strong> כל חמשת המקומות לתוכניות אימון פתוחים עכשיו בחינם. מקומות 2–5 מתוכננים לעבור ל־Pro בהמשך.",
      active: "● תוכנית פעילה",
      usePlan: "השתמש בתוכנית הזאת",
      currentPlan: "התוכנית הנוכחית",
      days: "ימים בשבוע",
      weeks: "שבועות",
      activating: "מפעיל...",
      rename: "שינוי שם",
      edit: "עריכה",
      delete: "מחיקה",
      renamePrompt: "הזן שם חדש לתוכנית:",
      invalidName: "שם התוכנית חייב להכיל בין 1 ל־80 תווים.",
      renameError: "לא ניתן היה לשנות את שם התוכנית.",
      deleteConfirm: "למחוק את התוכנית הזאת? לא ניתן לבטל את הפעולה.",
      deleting: "מוחק...",
      deleteError: "לא ניתן היה למחוק את התוכנית.",
      loadError: "לא ניתן היה לטעון את תוכניות האימון.",
      activateError: "לא ניתן היה להפעיל את התוכנית. נסה שוב.",
      startWorkout: "התחלת אימון",
      editTitle: "עריכת תוכנית אימון",
      sessionName: "שם האימון",
      trainingDay: "יום בשבוע",
      exerciseName: "תרגיל",
      sets: "סטים",
      reps: "חזרות",
      rest: "מנוחה בשניות",
      addExercise: "+ הוסף תרגיל",
      addDay: "+ הוסף יום אימון",
      remove: "הסר",
      saveChanges: "שמירת שינויים",
      saving: "שומר...",
      cancel: "ביטול",
      editError: "לא ניתן היה לשמור את השינויים בתוכנית.",
      defaultSession: "אימון",
      defaultExercise: "תרגיל חדש"
    }
  : {
      title: "My Workout Plans",
      description: "Choose the plan you are currently following. Your active plan is highlighted in green.",
      back: "← Back to FuelPhysique",
      create: "+ Create workout plan",
      manualCreate: "Build my own",
      count: " of 5 saved plans",
      loading: "Loading your plans...",
      emptyTitle: "No saved plans yet",
      emptyText: "Create a workout plan and then select Save Workout.",
      earlyAccess: "<strong>Early Access:</strong> All five workout-plan slots are free right now. Slots 2–5 are planned for Pro later.",
      active: "● Active plan",
      usePlan: "Use this plan",
      currentPlan: "Current plan",
      days: "days per week",
      weeks: "weeks",
      activating: "Activating...",
      rename: "Rename",
      edit: "Edit",
      delete: "Delete",
      renamePrompt: "Enter a new name for this plan:",
      invalidName: "The plan name must contain between 1 and 80 characters.",
      renameError: "Could not rename the plan.",
      deleteConfirm: "Delete this plan? This action cannot be undone.",
      deleting: "Deleting...",
      deleteError: "Could not delete the plan.",
      loadError: "Could not load your workout plans.",
      activateError: "Could not activate the plan. Please try again.",
      startWorkout: "Start Workout",
      editTitle: "Edit workout plan",
      sessionName: "Session name",
      trainingDay: "Training day",
      exerciseName: "Exercise",
      sets: "Sets",
      reps: "Reps",
      rest: "Rest seconds",
      addExercise: "+ Add exercise",
      addDay: "+ Add workout day",
      remove: "Remove",
      saveChanges: "Save changes",
      saving: "Saving...",
      cancel: "Cancel",
      editError: "Could not save plan changes.",
      defaultSession: "Workout",
      defaultExercise: "New exercise"
    };

document.documentElement.lang = isHebrew ? "he" : "en";
document.documentElement.dir = isHebrew ? "rtl" : "ltr";
trackPageView({ page: "my-workout-plans" });
document.querySelector("#pageTitle").textContent = ui.title;
document.querySelector("#pageDescription").textContent = ui.description;
document.querySelector("#backLink").textContent = ui.back;
document.querySelector("#builderLink").textContent = ui.create;
document.querySelector("#manualBuilderLink").textContent = ui.manualCreate;
document.querySelector("#planCountLabel").textContent = ui.count;
document.querySelector("#earlyAccessNote").innerHTML = ui.earlyAccess;
plansStatus.textContent = ui.loading;

let currentUser = null;
let workoutPlans = [];
let activeWorkoutPlanId = null;
let subscription = normalizeSubscription({});
let editingPlanId = null;

function lockedSlotsMarkup() {
  return ""; // Early Access keeps all five slots unlocked.
  if (subscription.planId === "pro") return "";
  const firstLockedSlot = Math.max(2, workoutPlans.length + 1);
  return Array.from({ length: Math.max(0, 6 - firstLockedSlot) }, (_, index) => {
    const slot = firstLockedSlot + index;
    const title = isHebrew ? `תוכנית אימון ${slot}` : `Workout plan ${slot}`;
    const copy = isHebrew ? "זמין במסלול FuelPhysique Pro" : "Available with FuelPhysique Pro";
    const action = isHebrew ? "פתיחת Pro" : "Unlock with Pro";
    return `<a class="plan-card locked-plan" href="/pricing.html" aria-label="${escapeHtml(action)}">
      <span class="lock-animation" aria-hidden="true"><span class="lock-shackle"></span><span class="lock-body">🔒</span></span>
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

function readPlanScheduleDays(plan, sessionCount) {
  const source =
    (Array.isArray(plan?.weeklyScheduleDays) && plan.weeklyScheduleDays) ||
    (Array.isArray(plan?.trainingDaysOfWeek) && plan.trainingDaysOfWeek) ||
    (Array.isArray(plan?.scheduleDays) && plan.scheduleDays) ||
    [];

  if (source.length === sessionCount && source.every(day => Number.isFinite(Number(day)))) {
    return source.map(normalizeDayIndex);
  }

  return createWeeklyScheduleDays(sessionCount, Number(plan?.scheduleAnchorDay) || 0);
}

function makeUniqueDays(days) {
  const used = new Set();
  return days.map((day, index) => {
    let nextDay = normalizeDayIndex(day);
    while (used.has(nextDay)) {
      nextDay = normalizeDayIndex(nextDay + 1);
    }
    used.add(nextDay);
    return Number.isFinite(nextDay) ? nextDay : normalizeDayIndex(index);
  });
}

function renderDayOptions(selectedDay) {
  const labels = getWeekdayLabels(isHebrew);
  return labels.map((label, index) => (
    `<option value="${index}" ${normalizeDayIndex(selectedDay) === index ? "selected" : ""}>${escapeHtml(label)}</option>`
  )).join("");
}

function getExerciseRestSeconds(exercise = {}) {
  if (Number.isFinite(Number(exercise.restSeconds))) return Number(exercise.restSeconds);
  const rest = String(exercise.rest || "").match(/\d+/)?.[0];
  return rest ? Number(rest) : 90;
}

function renderExerciseRow(exercise = {}, index = 0) {
  return `
    <div class="editor-exercise-row" data-exercise-index="${index}">
      <label>
        <span>${ui.exerciseName}</span>
        <input class="editor-exercise-name" value="${escapeHtml(exercise.name || exercise.exercise || "")}" placeholder="${escapeHtml(ui.defaultExercise)}" />
      </label>
      <label>
        <span>${ui.sets}</span>
        <input class="editor-exercise-sets" type="number" min="1" max="20" value="${escapeHtml(exercise.sets || 3)}" />
      </label>
      <label>
        <span>${ui.reps}</span>
        <input class="editor-exercise-reps" value="${escapeHtml(exercise.reps || "8-12")}" />
      </label>
      <label>
        <span>${ui.rest}</span>
        <input class="editor-exercise-rest" type="number" min="0" max="600" step="5" value="${escapeHtml(getExerciseRestSeconds(exercise))}" />
      </label>
      <button class="remove-exercise-button" type="button">${ui.remove}</button>
    </div>
  `;
}

function renderSessionEditor(session = {}, sessionIndex = 0, selectedDay = sessionIndex) {
  const exercises = Array.isArray(session.exercises) && session.exercises.length
    ? session.exercises
    : [{ name: "", sets: 3, reps: "8-12", restSeconds: 90 }];

  return `
    <section class="editor-session" data-session-index="${sessionIndex}">
      <div class="editor-session-head">
        <label>
          <span>${ui.sessionName}</span>
          <input class="editor-session-name" value="${escapeHtml(session.name || session.title || `${ui.defaultSession} ${sessionIndex + 1}`)}" />
        </label>
        <label>
          <span>${ui.trainingDay}</span>
          <select class="editor-day-select">${renderDayOptions(selectedDay)}</select>
        </label>
        <button class="remove-session-button" type="button">${ui.remove}</button>
      </div>
      <div class="editor-exercise-list">
        ${exercises.map((exercise, exerciseIndex) => renderExerciseRow(exercise, exerciseIndex)).join("")}
      </div>
      <button class="add-exercise-button" type="button">${ui.addExercise}</button>
    </section>
  `;
}

function renderPlanEditor(savedPlan) {
  const plan = savedPlan.plan || {};
  const sessions = Array.isArray(plan.sessions) && plan.sessions.length
    ? plan.sessions
    : [{ name: `${ui.defaultSession} 1`, exercises: [] }];
  const scheduleDays = readPlanScheduleDays(plan, sessions.length);

  return `
    <form class="plan-editor-form" data-plan-id="${escapeHtml(savedPlan.id)}">
      <div class="plan-editor-header">
        <h3>${ui.editTitle}</h3>
        <p>${isHebrew ? "השינויים נשמרים בתוכנית עצמה וישפיעו גם על ימי האימון השבועיים בדשבורד." : "Changes are saved to this plan and reflected in the weekly schedule on the dashboard."}</p>
      </div>
      <div class="editor-session-list">
        ${sessions.map((session, index) => renderSessionEditor(session, index, scheduleDays[index] ?? index)).join("")}
      </div>
      <button class="add-session-button" type="button">${ui.addDay}</button>
      <div class="editor-actions">
        <button class="save-plan-edit-button" type="submit">${ui.saveChanges}</button>
        <button class="cancel-edit-button" type="button">${ui.cancel}</button>
      </div>
    </form>
  `;
}

function attachPlanEventListeners() {
  plansGrid.querySelectorAll(".activate-button:not(:disabled)").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const card = button.closest(".plan-card");
      await activatePlan(card.dataset.planId, button);
    });
  });

  plansGrid.querySelectorAll(".rename-button").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const card = button.closest(".plan-card");
      await renamePlan(card.dataset.planId);
    });
  });

  plansGrid.querySelectorAll(".edit-button").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const card = button.closest(".plan-card");
      editingPlanId = editingPlanId === card.dataset.planId ? null : card.dataset.planId;
      renderPlans();
    });
  });

  plansGrid.querySelectorAll(".delete-button").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const card = button.closest(".plan-card");
      await deletePlan(card.dataset.planId, button);
    });
  });

  plansGrid.querySelectorAll(".cancel-edit-button").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      editingPlanId = null;
      renderPlans();
    });
  });

  plansGrid.querySelectorAll(".add-exercise-button").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const list = button.closest(".editor-session").querySelector(".editor-exercise-list");
      list.insertAdjacentHTML("beforeend", renderExerciseRow({ name: "", sets: 3, reps: "8-12", restSeconds: 90 }, list.children.length));
      attachEditorRowListeners(list);
    });
  });

  plansGrid.querySelectorAll(".add-session-button").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const list = button.closest(".plan-editor-form").querySelector(".editor-session-list");
      const index = list.querySelectorAll(".editor-session").length;
      list.insertAdjacentHTML("beforeend", renderSessionEditor({ name: `${ui.defaultSession} ${index + 1}`, exercises: [] }, index, index));
      attachPlanEventListeners();
    });
  });

  plansGrid.querySelectorAll(".plan-editor-form").forEach((form) => {
    if (form.dataset.bound === "true") return;
    form.dataset.bound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveEditedPlan(form.dataset.planId, form);
    });
  });

  attachEditorRowListeners(plansGrid);
}

function attachEditorRowListeners(root) {
  root.querySelectorAll(".remove-exercise-button").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const list = button.closest(".editor-exercise-list");
      if (list.querySelectorAll(".editor-exercise-row").length <= 1) {
        const row = button.closest(".editor-exercise-row");
        row.querySelectorAll("input").forEach(input => {
          input.value = input.classList.contains("editor-exercise-sets") ? "3" : "";
        });
        row.querySelector(".editor-exercise-reps").value = "8-12";
        row.querySelector(".editor-exercise-rest").value = "90";
        return;
      }
      button.closest(".editor-exercise-row").remove();
    });
  });

  root.querySelectorAll(".remove-session-button").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const list = button.closest(".editor-session-list");
      if (list.querySelectorAll(".editor-session").length <= 1) return;
      button.closest(".editor-session").remove();
    });
  });
}

function renderPlans() {
  planCount.textContent = String(workoutPlans.length);
  plansStatus.textContent = "";
  plansStatus.classList.remove("error");
  document.querySelector("#planCountLabel").textContent = ui.count;

  if (workoutPlans.length === 0) {
    plansGrid.innerHTML = `<div class="empty-state"><h2>${ui.emptyTitle}</h2><p>${ui.emptyText}</p><a class="primary-link" href="/workout-builder.html">${ui.create}</a></div>${lockedSlotsMarkup()}`;
    return;
  }

  plansGrid.innerHTML = workoutPlans.map((savedPlan) => {
    const { id } = savedPlan;
    const plan = savedPlan.plan || {};
    const isActive = id === activeWorkoutPlanId;
    const name = savedPlan.name || plan.programName || "Workout Plan";
    const meta = [
      plan.daysPerWeek ? `${escapeHtml(plan.daysPerWeek)} ${ui.days}` : "",
      plan.durationWeeks ? `${escapeHtml(plan.durationWeeks)} ${ui.weeks}` : "",
      plan.goal ? escapeHtml(plan.goal) : ""
    ].filter(Boolean);

    return `
      <article class="plan-card${isActive ? " active" : ""}${editingPlanId === id ? " is-editing" : ""}" data-plan-id="${escapeHtml(id)}">
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
            <button class="edit-button" type="button">🛠️ ${ui.edit}</button>
            <button class="delete-button" type="button">🗑️ ${ui.delete}</button>
          </div>
        </div>
        ${editingPlanId === id ? renderPlanEditor(savedPlan) : ""}
      </article>`;
  }).join("") + lockedSlotsMarkup();

  attachPlanEventListeners();
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

    if (editingPlanId === planId) {
      editingPlanId = null;
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

function readEditedExercises(sessionElement, existingSession = {}) {
  const existingExercises = Array.isArray(existingSession.exercises) ? existingSession.exercises : [];
  return Array.from(sessionElement.querySelectorAll(".editor-exercise-row"))
    .map((row, index) => {
      const existingExercise = existingExercises[index] || {};
      const name = row.querySelector(".editor-exercise-name").value.trim();
      if (!name) return null;

      const sets = Math.max(1, Math.min(20, Number(row.querySelector(".editor-exercise-sets").value) || Number(existingExercise.sets) || 3));
      const reps = row.querySelector(".editor-exercise-reps").value.trim() || existingExercise.reps || "8-12";
      const restSeconds = Math.max(0, Math.min(600, Number(row.querySelector(".editor-exercise-rest").value) || getExerciseRestSeconds(existingExercise)));

      return {
        ...existingExercise,
        name,
        exercise: name,
        sets,
        reps,
        restSeconds,
        rest: `${restSeconds}s`
      };
    })
    .filter(Boolean);
}

async function saveEditedPlan(planId, form) {
  const savedPlan = workoutPlans.find((plan) => plan.id === planId);
  if (!savedPlan) return;

  const button = form.querySelector(".save-plan-edit-button");
  button.disabled = true;
  button.textContent = ui.saving;

  const currentPlan = savedPlan.plan || {};
  const currentSessions = Array.isArray(currentPlan.sessions) ? currentPlan.sessions : [];
  const sessionElements = Array.from(form.querySelectorAll(".editor-session"));
  const weeklyScheduleDays = makeUniqueDays(sessionElements.map((sessionElement, index) => (
    sessionElement.querySelector(".editor-day-select")?.value ?? index
  )));

  const sessions = sessionElements.map((sessionElement, index) => {
    const existingSession = currentSessions[index] || {};
    const name = sessionElement.querySelector(".editor-session-name").value.trim() || `${ui.defaultSession} ${index + 1}`;

    return {
      ...existingSession,
      day: index + 1,
      name,
      title: name,
      exercises: readEditedExercises(sessionElement, existingSession)
    };
  });

  const updatedPlan = {
    ...currentPlan,
    sessions,
    daysPerWeek: sessions.length,
    weeklyScheduleDays,
    scheduleAnchorDay: weeklyScheduleDays[0] ?? 0
  };

  try {
    await updateDoc(
      doc(db, "users", currentUser.uid, "workoutPlans", planId),
      { plan: updatedPlan, updatedAt: serverTimestamp() }
    );
    savedPlan.plan = updatedPlan;
    editingPlanId = null;
    renderPlans();
  } catch (error) {
    console.error("Could not save workout plan edits:", error);
    plansStatus.textContent = ui.editError;
    plansStatus.classList.add("error");
    button.disabled = false;
    button.textContent = ui.saveChanges;
  }
}

async function loadPlans(user) {
  const plansRef = collection(db, "users", user.uid, "workoutPlans");
  const plansQuery = query(plansRef, orderBy("createdAt", "desc"));
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
