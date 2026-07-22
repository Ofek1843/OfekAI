import { auth, db } from "./firebase-config.js";
import { setupExerciseDemos } from "./exercise-demos.js";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

setupExerciseDemos(document);

const $ = selector => document.querySelector(selector);
const he = (localStorage.getItem("ofek-ai-language") || "en") === "he";

const rawUi = he ? {
  title: "מעקב אימון",
  description: "תעד כל סט מתוכנית האימון הפעילה שלך.",
  back: "← חזרה ל-FuelPhysique",
  plans: "התוכניות שלי",
  loading: "טוען את התוכנית הפעילה...",
  active: "תוכנית פעילה",
  choose: "בחר את האימון של היום",
  start: "התחלת אימון",
  noPlan: "אין תוכנית אימון פעילה",
  noPlanText: "צריך לבחור תוכנית פעילה לפני שמתחילים אימון.",
  choosePlan: "בחר תוכנית",
  live: "● אימון בתהליך",
  duration: "זמן",
  sets: "סטים",
  reps: "חזרות",
  rest: "מנוחה",
  target: "יעד",
  weight: "משקל (ק\"ג)",
  actualReps: "חזרות",
  rpe: "RPE",
  done: "בוצע",
  notes: "הערות לאימון (אופציונלי)",
  finish: "סיום ושמירת האימון",
  saving: "שומר...",
  saved: "האימון נשמר!",
  another: "התחלת אימון נוסף",
  home: "חזרה ל-FuelPhysique",
  completed: (done, total, minutes) => `${done} מתוך ${total} סטים הושלמו ב-${minutes} דקות.`,
  loadError: "לא ניתן לטעון את התוכנית הפעילה.",
  saveError: "לא ניתן לשמור את האימון. נסה שוב.",
  noSessions: "בתוכנית הפעילה אין אימונים זמינים.",
  history: "היסטוריית אימונים",
  viewHistory: "צפייה בהיסטוריית האימונים",
  exercise: "תרגיל",
  focusLabel: "סט ממוקד",
  workingSet: "סט עבודה",
  warmupSet: "חימום",
  backSet: "חזרה לסט קודם",
  nextSet: "התחלת הסט הבא",
  pause: "השהיית אימון",
  resume: "המשך אימון",
  markDone: "סמן כבוצע",
  restTimer: "טיימר מנוחה",
  restHint: "סיים את הסט, חכה עד שהטיימר יסתיים ואז התחל את הסט הבא.",
  warmup: "סט חימום",
  warmupHint: "חימום נשמר ביומן, אבל לא נספר בסטטיסטיקת ההיפרטרופיה."
} : {
  title: "Workout Tracker",
  description: "Record every set from your active workout plan.",
  back: "← Back to FuelPhysique",
  plans: "My Workout Plans",
  loading: "Loading your active plan...",
  active: "ACTIVE PLAN",
  choose: "Choose today's workout",
  start: "Start Workout",
  noPlan: "No active workout plan",
  noPlanText: "Choose an active plan before starting a workout.",
  choosePlan: "Choose a plan",
  live: "● WORKOUT IN PROGRESS",
  duration: "Duration",
  sets: "sets",
  reps: "reps",
  rest: "rest",
  target: "Target",
  weight: "Weight (kg)",
  actualReps: "Reps",
  rpe: "RPE",
  done: "Done",
  notes: "Workout notes (optional)",
  finish: "Finish & Save Workout",
  saving: "Saving...",
  saved: "Workout saved!",
  another: "Start another workout",
  home: "Back to FuelPhysique",
  completed: (done, total, minutes) => `${done} of ${total} sets completed in ${minutes} minutes.`,
  loadError: "Could not load your active workout plan.",
  saveError: "Could not save the workout. Please try again.",
  noSessions: "The active plan has no available sessions.",
  history: "Workout History",
  viewHistory: "View workout history",
  exercise: "Exercise",
  focusLabel: "Focused set",
  workingSet: "Working set",
  warmupSet: "Warm-up",
  backSet: "Back one set",
  nextSet: "Start next set",
  pause: "Pause workout",
  resume: "Resume workout",
  markDone: "Mark done",
  restTimer: "Rest timer",
  restHint: "Finish the set, wait for the rest timer to end, then start the next set.",
  warmup: "Warm-up set",
  warmupHint: "Warm-up sets are logged, but they do not count toward hypertrophy stats."
};

// The source strings are UTF-8. Re-decoding them here corrupts Hebrew in the
// browser, so keep the selected language object as-is.
const ui = rawUi;

const esc = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const DRAFT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const draftKey = () => user ? `fuelphysique-workout-draft:${user.uid}` : "fuelphysique-workout-draft";
const timeBudgetKey = () => user ? `fuelphysique-workout-time-budget:${user.uid}` : "fuelphysique-workout-time-budget";
const RPE_HELP = he
  ? "RPE הוא דירוג המאמץ מ-1 עד 10. RPE 10 אומר שנשארו 0 חזרות, RPE 8 אומר בערך 2 חזרות נשארו."
  : "RPE (Rate of Perceived Exertion) rates effort from 1-10. RPE 10 means no reps left; RPE 8 means about two reps remained.";
const RIR_HELP = he
  ? "RIR הוא מספר החזרות שנשארו לפני כשל. RIR 0 = כשל; RIR 2 = בערך שתי חזרות נשארו."
  : "RIR (Reps In Reserve) is the number of reps left before failure. RIR 0 = failure; RIR 2 = about two reps left.";

let user;
let activePlanId;
let savedPlan;
let workoutStartedAt = 0;
let workoutElapsedBaseMs = 0;
let workoutRunningSince = 0;
let workoutTimerId = 0;
let focusTimerId = 0;
let paused = false;
let focus = { exerciseIndex: 0, setIndex: 0 };
let rest = { active: false, endsAt: 0, remainingMs: 0, paused: false };
let quickModeEnabled = localStorage.getItem("fuelphysique-quick-mode") !== "false";
let sessionOverride = null;
let timeBudgetMinutes = null;
let timeFitSummary = null;
let transitionTimerId = 0;
let completionTimerId = 0;

const read = input => input.value === "" ? null : Number(input.value);
const setValue = (selector, value) => { const el = $(selector); if (el) el.value = value ?? ""; };
const numberValue = (selector) => { const value = Number($(selector)?.value); return Number.isFinite(value) ? value : null; };

function localize() {
  document.documentElement.lang = he ? "he" : "en";
  document.documentElement.dir = he ? "rtl" : "ltr";
  document.body.classList.toggle("quick-mode-enabled", quickModeEnabled);
  const map = [
    ["pageTitle", "title"],
    ["pageDescription", "description"],
    ["backLink", "back"],
    ["historyLink", "history"],
    ["plansLink", "plans"],
    ["activeLabel", "active"],
    ["sessionLabel", "choose"],
    ["startWorkoutButton", "start"],
    ["emptyTitle", "noPlan"],
    ["emptyText", "noPlanText"],
    ["choosePlanLink", "choosePlan"],
    ["liveLabel", "live"],
    ["durationLabel", "duration"],
    ["notesLabel", "notes"],
    ["finishWorkoutButton", "finish"],
    ["successTitle", "saved"],
    ["anotherWorkoutButton", "another"],
    ["viewHistoryLink", "viewHistory"],
    ["homeLink", "home"],
    ["focusLabel", "focusLabel"],
    ["focusModeBadge", "workingSet"],
    ["focusWeightLabel", "weight"],
    ["focusRepsLabel", "actualReps"],
    ["focusRpeLabel", "rpe"],
    ["focusWarmupLabel", "warmup"],
    ["restLabel", "restTimer"],
    ["restHint", "restHint"],
    ["focusDoneButton", "markDone"],
    ["focusBackButton", "backSet"],
    ["focusPauseButton", "pause"],
    ["focusNextButton", "nextSet"]
  ];
  for (const [id, key] of map) {
    const el = document.getElementById(id);
    if (el) el.textContent = ui[key];
  }
  const quickButton = document.getElementById("quickModeButton");
  if (quickButton) {
    quickButton.textContent = quickModeEnabled ? (he ? "⚡ מצב מהיר פעיל" : "⚡ Quick mode on") : (he ? "⚡ מצב מהיר כבוי" : "⚡ Quick mode off");
    quickButton.setAttribute("aria-pressed", String(quickModeEnabled));
  }
  const timeLabel = document.getElementById("timeBudgetLabel");
  if (timeLabel) timeLabel.textContent = he ? "זמן זמין היום" : "Time available today";
  const timeSuffix = document.getElementById("timeBudgetSuffix");
  if (timeSuffix) timeSuffix.textContent = he ? "דקות" : "min";
  const timeButton = document.getElementById("timeBudgetButton");
  if (timeButton) timeButton.textContent = he ? "התאם את האימון לזמן" : "Fit workout to time";
  const panel = document.getElementById("focusPanel");
  if (panel) panel.classList.toggle("quick-mode", quickModeEnabled);
  $("#trackerStatus").textContent = ui.loading;
}

function show(id) {
  ["#setupPanel", "#emptyPanel", "#workoutPanel", "#successPanel"].forEach(selector => {
    $(selector).classList.toggle("hidden", selector !== id);
  });
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function workoutElapsedMs() {
  return workoutElapsedBaseMs + (paused ? 0 : Date.now() - workoutRunningSince);
}

function updateWorkoutTimer() {
  $("#workoutTimer").textContent = formatTime(Math.floor(workoutElapsedMs() / 1000));
}

function startWorkoutTimer() {
  clearInterval(workoutTimerId);
  updateWorkoutTimer();
  workoutTimerId = setInterval(updateWorkoutTimer, 1000);
}

function startRestTimer(seconds) {
  rest.active = true;
  rest.paused = false;
  rest.remainingMs = Math.max(0, Number(seconds || 0)) * 1000;
  rest.endsAt = Date.now() + rest.remainingMs;
  document.body.classList.add("rest-active");
  $("#focusPanel").classList.add("resting");
  updateRestTimer();
  clearInterval(focusTimerId);
  focusTimerId = setInterval(updateRestTimer, 250);
  const nextButton = $("#focusNextButton");
  if (nextButton) {
    nextButton.disabled = true;
    nextButton.textContent = he ? `מנוחה ${formatTime(Math.ceil(rest.remainingMs / 1000))}` : `Rest ${formatTime(Math.ceil(rest.remainingMs / 1000))}`;
    nextButton.classList.add("rest-button-active");
    nextButton.setAttribute("aria-busy", "true");
  }
}

function stopRestTimer() {
  rest.active = false;
  rest.paused = false;
  rest.remainingMs = 0;
  rest.endsAt = 0;
  document.body.classList.remove("rest-active");
  $("#focusPanel").classList.remove("resting");
  clearInterval(focusTimerId);
  $("#focusRestTimer").textContent = "00:00";
  const nextButton = $("#focusNextButton");
  if (nextButton) {
    nextButton.disabled = false;
    nextButton.textContent = ui.nextSet;
    nextButton.classList.remove("rest-button-active");
    nextButton.removeAttribute("aria-busy");
  }
}

function pauseTimers() {
  if (paused) return;
  workoutElapsedBaseMs = workoutElapsedMs();
  paused = true;
  clearInterval(workoutTimerId);
  if (rest.active && !rest.paused) {
    rest.remainingMs = Math.max(0, rest.endsAt - Date.now());
    rest.paused = true;
    clearInterval(focusTimerId);
  }
  $("#focusPauseButton").textContent = ui.resume;
}

function resumeTimers() {
  if (!paused) return;
  workoutRunningSince = Date.now();
  paused = false;
  startWorkoutTimer();
  if (rest.active && rest.paused) {
    rest.paused = false;
    rest.endsAt = Date.now() + rest.remainingMs;
    updateRestTimer();
    focusTimerId = setInterval(updateRestTimer, 250);
  }
  $("#focusPauseButton").textContent = ui.pause;
}

function renderSetup() {
  const plan = savedPlan.plan || {};
  const sessions = Array.isArray(plan.sessions) ? plan.sessions : [];
  $("#planName").textContent = savedPlan.name || plan.programName || "Workout Plan";
  if (!sessions.length) {
    $("#trackerStatus").textContent = ui.noSessions;
    $("#trackerStatus").classList.add("error");
    const summary = $("#timeFitSummary");
    if (summary) summary.innerHTML = "";
    return show("#emptyPanel");
  }
  $("#sessionSelect").innerHTML = sessions.map((session, index) => `<option value="${index}">${esc(session.name || `${ui.exercise} ${index + 1}`)}</option>`).join("");
  const currentIndex = Number($("#sessionSelect")?.value || 0);
  const currentSession = sessions[currentIndex] || sessions[0];
  $("#trackerStatus").textContent = sessionOverride && Number.isFinite(timeBudgetMinutes)
    ? (he ? `מצב התאמת זמן פעיל: בערך ${timeBudgetMinutes} דקות.` : `Time-fit mode active: about ${timeBudgetMinutes} minutes.`)
    : "";
  $("#trackerStatus").classList.toggle("error", false);
  renderTimeFitSummary(currentSession, timeBudgetMinutes);
  show("#setupPanel");
}

function cloneExercise(exercise = {}) {
  return {
    ...exercise,
    sets: Math.max(1, Math.min(20, parseInt(exercise.sets, 10) || 1)),
    restSeconds: Math.max(0, Math.min(600, parseInt(exercise.restSeconds, 10) || 0))
  };
}

function cloneSession(session = {}) {
  return {
    ...session,
    exercises: Array.isArray(session.exercises) ? session.exercises.map(cloneExercise) : []
  };
}

function estimateExerciseMinutes(exercise) {
  const sets = Math.max(1, Math.min(20, parseInt(exercise?.sets, 10) || 1));
  const restSeconds = Math.max(0, Math.min(600, parseInt(exercise?.restSeconds, 10) || 0));
  const workSeconds = 45;
  return sets * ((restSeconds + workSeconds) / 60) + 0.25;
}

function estimateSessionMinutes(session) {
  return (session?.exercises || []).reduce((sum, exercise) => sum + estimateExerciseMinutes(exercise), 0);
}

function formatBudgetMinutes(value) {
  const minutes = Math.max(0, Number(value) || 0);
  return he ? `${Math.round(minutes)} דקות` : `${Math.round(minutes)} min`;
}

function buildTimeFitSummary(originalSession, adaptedSession, budgetMinutes) {
  const originalMinutes = estimateSessionMinutes(originalSession);
  const adaptedMinutes = estimateSessionMinutes(adaptedSession);
  const originalExercises = originalSession?.exercises || [];
  const adaptedExercises = adaptedSession?.exercises || [];
  const changes = [];
  let trimmedSets = 0;
  let trimmedExercises = 0;

  const max = Math.max(originalExercises.length, adaptedExercises.length);
  for (let i = 0; i < max; i += 1) {
    const before = originalExercises[i];
    const after = adaptedExercises[i];
    if (before && !after) {
      trimmedExercises += 1;
      changes.push(he
        ? `${before.name || `תרגיל ${i + 1}`} הוסר`
        : `${before.name || `Exercise ${i + 1}`} removed`);
      continue;
    }
    if (!before || !after) continue;
    const beforeSets = Math.max(1, Math.min(20, parseInt(before.sets, 10) || 1));
    const afterSets = Math.max(1, Math.min(20, parseInt(after.sets, 10) || 1));
    if (afterSets < beforeSets) {
      const diff = beforeSets - afterSets;
      trimmedSets += diff;
      changes.push(he
        ? `${after.name || `תרגיל ${i + 1}`}: ${diff}- סטים`
        : `${after.name || `Exercise ${i + 1}`}: -${diff} set${diff > 1 ? "s" : ""}`);
    }
  }

  const fits = adaptedMinutes <= Math.max(10, Number(budgetMinutes) || 0);
  return {
    fits,
    originalMinutes,
    adaptedMinutes,
    trimmedSets,
    trimmedExercises,
    changes: changes.slice(0, 3)
  };
}

function renderTimeFitSummary(session, budgetMinutes) {
  const box = $("#timeFitSummary");
  if (!box || !session) return;
  const parsedBudget = Number(budgetMinutes);
  if (!Number.isFinite(parsedBudget)) {
    const estimatedMinutes = estimateSessionMinutes(session);
    box.innerHTML = he
      ? `<strong>אורך אימון משוער</strong><p>האימון הזה אמור לקחת בערך ${formatBudgetMinutes(estimatedMinutes)}. אם יש לך פחות זמן היום, אפשר לקצר בלחיצה.</p>`
      : `<strong>Estimated workout length</strong><p>This workout should take about ${formatBudgetMinutes(estimatedMinutes)}. If you have less time, trim it with one click.</p>`;
    return;
  }
  const budget = Math.max(10, Math.round(parsedBudget));
  const adapted = sessionOverride && Number(sessionOverride.sessionIndex) === Number($("#sessionSelect")?.value)
    ? sessionOverride.session
    : shortenSessionToBudget(session, budget);
  const summary = buildTimeFitSummary(session, adapted, budget);
  if (summary.fits && summary.trimmedSets === 0 && summary.trimmedExercises === 0) {
    box.innerHTML = he
      ? `<strong>האימון כבר מתאים לזמן</strong><p>כל האימון נכנס בערך בתוך ${formatBudgetMinutes(summary.adaptedMinutes)}. אפשר להתחיל כמו שהוא.</p>`
      : `<strong>Workout already fits</strong><p>The full session fits in about ${formatBudgetMinutes(summary.adaptedMinutes)}. You can start right away.</p>`;
    return;
  }
  const changeList = summary.changes.length ? `<ul>${summary.changes.map(change => `<li>${esc(change)}</li>`).join("")}</ul>` : "";
  box.innerHTML = he
    ? `<strong>האימון קוצר לזמן שלך</strong><p>מ־${formatBudgetMinutes(summary.originalMinutes)} ל־${formatBudgetMinutes(summary.adaptedMinutes)}. קיצרנו ${summary.trimmedSets} סטים${summary.trimmedExercises ? ` ו-${summary.trimmedExercises} תרגילים` : ""} כדי להתאים לתקציב של ${budget} דקות.</p>${changeList}`
    : `<strong>Workout trimmed to time</strong><p>From about ${formatBudgetMinutes(summary.originalMinutes)} down to ${formatBudgetMinutes(summary.adaptedMinutes)}. We trimmed ${summary.trimmedSets} set${summary.trimmedSets === 1 ? "" : "s"}${summary.trimmedExercises ? ` and ${summary.trimmedExercises} exercise${summary.trimmedExercises === 1 ? "" : "s"}` : ""} to stay within ${budget} minutes.</p>${changeList}`;
}

function shortenSessionToBudget(session, budgetMinutes) {
  const next = cloneSession(session);
  const budget = Math.max(10, Number(budgetMinutes) || 0);
  if (!Number.isFinite(budget) || budget <= 0 || estimateSessionMinutes(next) <= budget) return next;
  const importantLimit = Math.min(2, next.exercises.length);
  let total = estimateSessionMinutes(next);

  const reduceOneSet = index => {
    const exercise = next.exercises[index];
    if (!exercise || exercise.sets <= 1) return false;
    exercise.sets -= 1;
    total = estimateSessionMinutes(next);
    return true;
  };

  while (total > budget) {
    let changed = false;
    for (let index = next.exercises.length - 1; index >= importantLimit; index -= 1) {
      if (reduceOneSet(index)) {
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }

  while (total > budget && next.exercises.length > 1) {
    const last = next.exercises[next.exercises.length - 1];
    if (last.sets > 1) {
      last.sets -= 1;
    } else {
      next.exercises.pop();
    }
    total = estimateSessionMinutes(next);
  }

  return next;
}

function activeSessionForIndex(index) {
  const base = savedPlan.plan.sessions[index];
  if (!base) return null;
  if (sessionOverride && Number(sessionOverride.sessionIndex) === Number(index)) return sessionOverride.session;
  return base;
}

function renderExercise(exercise, index) {
  const name = exercise.name || `${ui.exercise} ${index + 1}`;
  const count = Math.max(1, Math.min(20, parseInt(exercise.sets, 10) || 1));
  const rows = Array.from({ length: count }, (_, setIndex) => `
    <tr class="set-row" data-exercise-index="${index}" data-set-index="${setIndex}">
      <td><strong>${setIndex + 1}</strong></td>
      <td>${esc(exercise.reps || "-")}</td>
      <td><input class="weight-input" type="number" min="0" max="1000" step="0.25" inputmode="decimal" aria-label="${ui.weight}"></td>
      <td><input class="reps-input" type="number" min="0" max="999" step="1" inputmode="numeric" aria-label="${ui.actualReps}"></td>
      <td><input class="rpe-input" type="number" min="1" max="10" step="0.5" inputmode="decimal" aria-label="${ui.rpe}"></td>
      <td><label class="mini-check"><input class="set-complete" type="checkbox" aria-label="${ui.done}"><span>${ui.done}</span></label></td>
    </tr>
  `).join("");
  return `
    <article class="exercise-card" data-exercise-index="${index}">
      <header class="exercise-header">
        <div>
          <h3>${esc(name)} <button type="button" class="exercise-demo-button" data-exercise-demo="${esc(name)}">▶ Demo</button></h3>
          <div class="prescription">
            <span>${count} ${ui.sets}</span>
            <span>${esc(exercise.reps || "-")} ${ui.reps}</span>
            <span>${esc(exercise.restSeconds || 0)}s ${ui.rest}</span>
            ${exercise.rir !== undefined ? `<span>RIR ${esc(exercise.rir)}</span>` : ""}
          </div>
          ${exercise.notes ? `<p class="exercise-note">${esc(exercise.notes)}</p>` : ""}
        </div>
        <span class="exercise-number">${index + 1}</span>
      </header>
      <table class="sets-table">
        <thead>
          <tr>
            <th>#</th>
            <th>${ui.target}</th>
            <th>${ui.weight}</th>
            <th>${ui.actualReps}</th>
            <th>${ui.rpe}</th>
            <th>${ui.done}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </article>
  `;
}

function setHighlightedRow(exerciseIndex, setIndex) {
  document.querySelectorAll(".set-row").forEach(row => {
    const active = Number(row.dataset.exerciseIndex) === exerciseIndex && Number(row.dataset.setIndex) === setIndex;
    row.classList.toggle("active-set", active);
  });
}

function animateSetTransition(direction = "forward") {
  const panel = $("#focusPanel");
  if (!panel) return;
  clearTimeout(transitionTimerId);
  panel.classList.remove("transition-forward", "transition-back", "transition-exercise");
  panel.classList.add(direction === "back" ? "transition-back" : direction === "exercise" ? "transition-exercise" : "transition-forward");
  transitionTimerId = setTimeout(() => {
    panel.classList.remove("transition-forward", "transition-back", "transition-exercise");
  }, 320);
}

function renderNextSetPreview() {
  const sessionIndex = Number($("#workoutPanel").dataset.sessionIndex);
  const session = activeSessionForIndex(sessionIndex);
  const preview = $("#nextSetPreview");
  if (!preview || !session) return;
  const currentExercise = session.exercises?.[focus.exerciseIndex];
  const currentTotal = Math.max(1, Math.min(20, parseInt(currentExercise?.sets, 10) || 1));
  const nextSetNumber = focus.setIndex + 2;
  const nextExercise = session.exercises?.[focus.exerciseIndex + 1];
  if (nextSetNumber <= currentTotal) {
    preview.innerHTML = `
      <strong>${he ? "הסט הבא" : "Next set"}</strong>
      <span>${esc(currentExercise?.name || `${ui.exercise} ${focus.exerciseIndex + 1}`)} · ${he ? "סט" : "set"} ${nextSetNumber} · ${esc(currentExercise?.reps || "-")} ${ui.reps} · ${esc(currentExercise?.restSeconds || 0)}s ${ui.rest}</span>
    `;
    return;
  }
  if (nextExercise) {
    const total = Math.max(1, Math.min(20, parseInt(nextExercise.sets, 10) || 1));
    preview.innerHTML = `
      <strong>${he ? "התרגיל הבא" : "Next exercise"}</strong>
      <span>${esc(nextExercise.name || `${ui.exercise} ${focus.exerciseIndex + 2}`)} · ${total} ${ui.sets} · ${esc(nextExercise.reps || "-")} ${ui.reps}</span>
    `;
    return;
  }
  preview.innerHTML = `<strong>${he ? "סיום האימון קרוב" : "Workout nearly done"}</strong><span>${he ? "אין עוד סטים אחרי זה." : "There are no more sets after this one."}</span>`;
}

function getPreviousSetData() {
  const sessionIndex = Number($("#workoutPanel").dataset.sessionIndex);
  const session = activeSessionForIndex(sessionIndex);
  if (!session) return null;
  let exerciseIndex = focus.exerciseIndex;
  let setIndex = focus.setIndex - 1;
  while (exerciseIndex >= 0) {
    if (setIndex >= 0) {
      const row = document.querySelector(`.set-row[data-exercise-index="${exerciseIndex}"][data-set-index="${setIndex}"]`);
      if (row) {
        return {
          weight: row.querySelector(".weight-input")?.value || null,
          reps: row.querySelector(".reps-input")?.value || null,
          rpe: row.querySelector(".rpe-input")?.value || null,
          warmup: row.classList.contains("warmup-set")
        };
      }
      setIndex -= 1;
    } else {
      exerciseIndex -= 1;
      if (exerciseIndex < 0) break;
      const total = Math.max(1, Math.min(20, parseInt(session.exercises?.[exerciseIndex]?.sets, 10) || 1));
      setIndex = total - 1;
    }
  }
  return null;
}

function copyPreviousSetIntoFocus() {
  const previous = getPreviousSetData();
  if (!previous) return false;
  if (previous.weight !== null) $("#focusWeight").value = previous.weight;
  if (previous.reps !== null) $("#focusReps").value = previous.reps;
  if (previous.rpe !== null) $("#focusRpe").value = previous.rpe;
  if (previous.warmup !== null) $("#focusWarmup").checked = previous.warmup;
  writeFocusToRow(false);
  saveCurrentDraft();
  return true;
}

function adjustFocusNumber(selector, delta, min, max, step = 1) {
  const current = numberValue(selector);
  const next = Math.min(max, Math.max(min, (current ?? 0) + delta * step));
  $(selector).value = String(next);
  writeFocusToRow(false);
  saveCurrentDraft();
}

function syncFocusFromRow() {
  const row = document.querySelector(`.set-row[data-exercise-index="${focus.exerciseIndex}"][data-set-index="${focus.setIndex}"]`);
  if (!row) return;
  document.querySelectorAll(".exercise-card").forEach(card => {
    card.classList.toggle("active-card", Number(card.dataset.exerciseIndex) === focus.exerciseIndex);
  });
  const previous = quickModeEnabled ? getPreviousSetData() : null;
  setValue("#focusWeight", row.querySelector(".weight-input")?.value || previous?.weight);
  setValue("#focusReps", row.querySelector(".reps-input")?.value || previous?.reps);
  setValue("#focusRpe", row.querySelector(".rpe-input")?.value || previous?.rpe);
  $("#focusWarmup").checked = row.classList.contains("warmup-set");
  $("#focusModeBadge").textContent = row.classList.contains("warmup-set") ? ui.warmupSet : ui.workingSet;
  $("#focusExerciseName").textContent = $("#exerciseList").querySelectorAll(".exercise-card")[focus.exerciseIndex]?.querySelector("h3")?.childNodes?.[0]?.textContent?.trim() || `${ui.exercise} ${focus.exerciseIndex + 1}`;
  $("#focusSetMeta").textContent = `${ui.exercise} ${focus.exerciseIndex + 1} • ${focus.setIndex + 1}`;
  setHighlightedRow(focus.exerciseIndex, focus.setIndex);
  animateSetTransition("forward");
  renderNextSetPreview();
}

function writeFocusToRow(markComplete) {
  const row = document.querySelector(`.set-row[data-exercise-index="${focus.exerciseIndex}"][data-set-index="${focus.setIndex}"]`);
  if (!row) return;
  row.querySelector(".weight-input").value = $("#focusWeight").value;
  row.querySelector(".reps-input").value = $("#focusReps").value;
  row.querySelector(".rpe-input").value = $("#focusRpe").value;
  row.querySelector(".set-complete").checked = Boolean(markComplete);
  row.classList.toggle("completed", Boolean(markComplete));
  row.classList.toggle("warmup-set", $("#focusWarmup").checked);
  if (markComplete) {
    row.classList.remove("complete-pulse");
    void row.offsetWidth;
    row.classList.add("complete-pulse");
    clearTimeout(completionTimerId);
    completionTimerId = setTimeout(() => row.classList.remove("complete-pulse"), 700);
  }
}

function saveCurrentDraft() {
  if (!user || !savedPlan || $("#workoutPanel").classList.contains("hidden")) return;
  const sessionIndex = Number($("#workoutPanel").dataset.sessionIndex);
  const session = activeSessionForIndex(sessionIndex);
  if (!session) return;
  localStorage.setItem(draftKey(), JSON.stringify({
    version: 2,
    savedAt: Date.now(),
    workoutStartedAt,
    workoutElapsedBaseMs,
    workoutRunningSince,
    activePlanId,
    sessionIndex,
    focus,
    notes: $("#workoutNotes").value,
    paused,
    rest: {
      active: rest.active,
      paused: rest.paused,
      remainingMs: rest.paused ? rest.remainingMs : Math.max(0, rest.endsAt - Date.now())
    },
    exercises: collect(session)
  }));
}

function clearDraft() {
  if (user) localStorage.removeItem(draftKey());
}

function collect(session) {
  return [...document.querySelectorAll(".exercise-card")].map((card, index) => ({
    name: session.exercises?.[index]?.name || `${ui.exercise} ${index + 1}`,
    exerciseIndex: index,
    sets: [...card.querySelectorAll(".set-row")].map((row, setIndex) => ({
      setNumber: setIndex + 1,
      targetReps: String(session.exercises?.[index]?.reps || ""),
      weightKg: read(row.querySelector(".weight-input")),
      reps: read(row.querySelector(".reps-input")),
      rpe: read(row.querySelector(".rpe-input")),
      completed: row.querySelector(".set-complete").checked,
      warmup: row.classList.contains("warmup-set")
    }))
  }));
}

function restSecondsForCurrentSet() {
  const sessionIndex = Number($("#workoutPanel").dataset.sessionIndex);
  const session = activeSessionForIndex(sessionIndex);
  return Number(session?.exercises?.[focus.exerciseIndex]?.restSeconds || 0);
}

function applyCurrentFocus(rowAdvance = false) {
  writeFocusToRow(true);
  saveCurrentDraft();
  const restSeconds = restSecondsForCurrentSet();
  startRestTimer(restSeconds);
  if (rowAdvance) {
    // Keep the focus on the same row while the rest timer runs.
    setHighlightedRow(focus.exerciseIndex, focus.setIndex);
  }
}

function moveFocus(delta) {
  const sessionIndex = Number($("#workoutPanel").dataset.sessionIndex);
  const session = activeSessionForIndex(sessionIndex);
  const exercises = session.exercises || [];
  const previousExerciseIndex = focus.exerciseIndex;
  let exerciseIndex = focus.exerciseIndex;
  let setIndex = focus.setIndex + delta;
  while (exerciseIndex >= 0 && exerciseIndex < exercises.length) {
    const totalSets = Math.max(1, Math.min(20, parseInt(exercises[exerciseIndex]?.sets, 10) || 1));
    if (setIndex >= 0 && setIndex < totalSets) break;
    if (setIndex < 0) {
      exerciseIndex -= 1;
      if (exerciseIndex < 0) break;
      setIndex = Math.max(1, Math.min(20, parseInt(exercises[exerciseIndex]?.sets, 10) || 1)) - 1;
    } else {
      exerciseIndex += 1;
      if (exerciseIndex >= exercises.length) break;
      setIndex = 0;
    }
  }
  if (exerciseIndex < 0 || exerciseIndex >= exercises.length) return false;
  focus = { exerciseIndex, setIndex };
  if (focus.exerciseIndex !== previousExerciseIndex) animateSetTransition("exercise");
  syncFocusFromRow();
  saveCurrentDraft();
  return true;
}

function finishOrAdvanceSet() {
  writeFocusToRow(true);
  saveCurrentDraft();
  startRestTimer(restSecondsForCurrentSet());
}

function startNextSet() {
  if (rest.active && rest.remainingMs > 0) return;
  stopRestTimer();
  if (!moveFocus(1)) {
    $("#trackerStatus").textContent = he ? "אין עוד סטים בתוכנית הזאת." : "There are no more sets in this workout.";
    saveCurrentDraft();
  }
}

function backOneSet() {
  stopRestTimer();
  if (moveFocus(-1)) {
    animateSetTransition("back");
    saveCurrentDraft();
  }
}

function togglePause() {
  if (paused) {
    resumeTimers();
    $("#trackerStatus").textContent = "";
    return;
  }
  pauseTimers();
  $("#trackerStatus").textContent = he ? "האימון הושהה זמנית." : "Workout paused.";
}

function bindFocusInputs() {
  ["#focusWeight", "#focusReps", "#focusRpe", "#focusWarmup"].forEach(selector => {
    $(selector).addEventListener("input", () => {
      const row = document.querySelector(`.set-row[data-exercise-index="${focus.exerciseIndex}"][data-set-index="${focus.setIndex}"]`);
      if (!row) return;
      row.querySelector(".weight-input").value = $("#focusWeight").value;
      row.querySelector(".reps-input").value = $("#focusReps").value;
      row.querySelector(".rpe-input").value = $("#focusRpe").value;
      row.classList.toggle("warmup-set", $("#focusWarmup").checked);
      $("#focusModeBadge").textContent = $("#focusWarmup").checked ? ui.warmupSet : ui.workingSet;
      saveCurrentDraft();
    });
  });
}

function openWorkout(index, startTime = Date.now()) {
  const session = activeSessionForIndex(index);
  workoutStartedAt = startTime;
  workoutElapsedBaseMs = 0;
  workoutRunningSince = Date.now();
  paused = false;
  $("#focusPauseButton").textContent = ui.pause;
  $("#sessionName").textContent = session.name || `${ui.exercise} ${index + 1}`;
  $("#workoutMeta").textContent = savedPlan.name || savedPlan.plan.programName || "Workout Plan";
  $("#exerciseList").innerHTML = (session.exercises || []).map(renderExercise).join("");
  $("#workoutPanel").dataset.sessionIndex = index;
  show("#workoutPanel");
  startWorkoutTimer();
  focus = { exerciseIndex: 0, setIndex: 0 };
  syncFocusFromRow();
  stopRestTimer();
  return session;
}

function beginWorkout() {
  const index = Number($("#sessionSelect").value);
  openWorkout(index);
  saveCurrentDraft();
}

function discardDraft() {
  if (!confirm(he ? "לבטל את האימון הנוכחי ולמחוק את הטיוטה?" : "Discard the current workout and delete its draft?")) return;
  clearInterval(workoutTimerId);
  clearInterval(focusTimerId);
  clearDraft();
  localStorage.removeItem(timeBudgetKey());
  sessionOverride = null;
  timeBudgetMinutes = null;
  $("#workoutNotes").value = "";
  renderSetup();
}

function restoreDraft() {
  let draft;
  try {
    draft = JSON.parse(localStorage.getItem(draftKey()) || "null");
  } catch {
    clearDraft();
    return false;
  }
  if (!draft || draft.activePlanId !== activePlanId || Date.now() - Number(draft.savedAt) > DRAFT_MAX_AGE_MS || !savedPlan.plan.sessions?.[draft.sessionIndex]) {
    if (draft) clearDraft();
    return false;
  }
  openWorkout(Number(draft.sessionIndex), Number(draft.workoutStartedAt) || Date.now());
  workoutElapsedBaseMs = Number(draft.workoutElapsedBaseMs) || 0;
  workoutRunningSince = Number(draft.workoutRunningSince) || Date.now();
  paused = Boolean(draft.paused);
  if (paused) {
    clearInterval(workoutTimerId);
    $("#focusPauseButton").textContent = ui.resume;
  }
  focus = draft.focus || { exerciseIndex: 0, setIndex: 0 };
  $("#workoutNotes").value = String(draft.notes || "");
  const cards = [...document.querySelectorAll(".exercise-card")];
  (draft.exercises || []).forEach((exercise, exerciseIndex) => {
    (exercise.sets || []).forEach((set, setIndex) => {
      const row = cards[exerciseIndex]?.querySelectorAll(".set-row")?.[setIndex];
      if (!row) return;
      row.querySelector(".weight-input").value = set.weightKg ?? "";
      row.querySelector(".reps-input").value = set.reps ?? "";
      row.querySelector(".rpe-input").value = set.rpe ?? "";
      row.querySelector(".set-complete").checked = Boolean(set.completed);
      row.classList.toggle("completed", Boolean(set.completed));
      row.classList.toggle("warmup-set", Boolean(set.warmup));
    });
  });
  syncFocusFromRow();
  if (draft.rest && draft.rest.active) {
    startRestTimer(Number(draft.rest.remainingMs || 0) / 1000);
    if (draft.rest.paused) {
      rest.paused = true;
      clearInterval(focusTimerId);
    }
  }
  $("#trackerStatus").textContent = he ? "האימון שלא הסתיים שוחזר אוטומטית." : "Your unfinished workout was restored automatically.";
  return true;
}

async function finishWorkout() {
  const button = $("#finishWorkoutButton");
  const sessionIndex = Number($("#workoutPanel").dataset.sessionIndex);
  const session = activeSessionForIndex(sessionIndex);
  const exercises = collect(session);
  const sets = exercises.flatMap(item => item.sets);
  const workingSets = sets.filter(set => !set.warmup);
  const durationSeconds = Math.max(1, Math.floor(workoutElapsedMs() / 1000));
  button.disabled = true;
  button.textContent = ui.saving;
  try {
    await addDoc(collection(db, "users", user.uid, "workoutLogs"), {
      workoutPlanId: activePlanId,
      workoutPlanName: savedPlan.name || savedPlan.plan.programName || "Workout Plan",
      sessionIndex,
      sessionName: session.name || `Session ${sessionIndex + 1}`,
      startedAt: new Date(workoutStartedAt),
      completedAt: serverTimestamp(),
      durationSeconds,
      completedSets: workingSets.filter(set => set.completed).length,
      totalSets: workingSets.length,
      notes: $("#workoutNotes").value.trim(),
      exercises
    });
    clearInterval(workoutTimerId);
    clearInterval(focusTimerId);
    clearDraft();
    $("#successSummary").textContent = ui.completed(workingSets.filter(set => set.completed).length, workingSets.length, Math.max(1, Math.round(durationSeconds / 60)));
    show("#successPanel");
  } catch (error) {
    console.error(error);
    $("#trackerStatus").textContent = ui.saveError;
    $("#trackerStatus").classList.add("error");
    saveCurrentDraft();
  } finally {
    button.disabled = false;
    button.textContent = ui.finish;
  }
}

function updateRestTimer() {
  if (!rest.active || rest.paused) return;
  const remaining = Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000));
  const total = Math.max(1, Math.ceil(rest.remainingMs / 1000));
  const progress = Math.max(0, Math.min(100, (remaining / total) * 100));
  $("#focusRestTimer").textContent = formatTime(remaining);
  const nextButton = $("#focusNextButton");
  if (nextButton) {
    nextButton.textContent = he ? `מנוחה ${formatTime(remaining)}` : `Rest ${formatTime(remaining)}`;
    nextButton.classList.add("rest-button-active");
    nextButton.setAttribute("aria-busy", "true");
  }
  $("#restHint").textContent = remaining > 0
    ? (he ? "תן לטיימר להסתיים ואז עבור לסט הבא." : "Let the timer finish, then move to the next set.")
    : (he ? "אפשר לעבור לסט הבא." : "You can move to the next set.");
  const progressBar = $("#restProgress");
  if (progressBar) progressBar.style.setProperty("--rest-progress", `${progress}%`);
  if (remaining <= 0) {
    clearInterval(focusTimerId);
    rest.active = false;
    document.body.classList.remove("rest-active");
    $("#focusPanel").classList.remove("resting");
    if (nextButton) {
      nextButton.disabled = false;
      nextButton.textContent = ui.nextSet;
      nextButton.classList.remove("rest-button-active");
      nextButton.removeAttribute("aria-busy");
    }
  }
}

function applyTimeBudget() {
  const sessionIndex = Number($("#sessionSelect").value);
  const session = savedPlan.plan.sessions[sessionIndex];
  const budget = numberValue("#timeBudgetMinutes");
  if (!session || !budget) {
    $("#trackerStatus").textContent = he ? "בחר זמן זמין תקין כדי לקצר את האימון." : "Choose a valid time budget to trim the workout.";
    $("#trackerStatus").classList.add("error");
    return;
  }
  sessionOverride = {
    sessionIndex,
    session: shortenSessionToBudget(session, budget)
  };
  timeBudgetMinutes = Math.max(10, Math.round(budget));
  localStorage.setItem(timeBudgetKey(), JSON.stringify({
    activePlanId,
    sessionIndex,
    timeBudgetMinutes
  }));
  $("#trackerStatus").classList.remove("error");
  renderSetup();
}

function refreshTimeFitPreview() {
  if (!savedPlan?.plan?.sessions?.length) return;
  const sessionIndex = Number($("#sessionSelect").value || 0);
  const session = savedPlan.plan.sessions[sessionIndex];
  if (!session) return;
  const budget = numberValue("#timeBudgetMinutes");
  renderTimeFitSummary(session, budget);
}

async function load() {
  const userSnap = await getDoc(doc(db, "users", user.uid));
  activePlanId = userSnap.exists() ? userSnap.data().activeWorkoutPlanId : null;
  if (!activePlanId) {
    $("#trackerStatus").textContent = "";
    return show("#emptyPanel");
  }
  const planSnap = await getDoc(doc(db, "users", user.uid, "workoutPlans", activePlanId));
  if (!planSnap.exists()) return show("#emptyPanel");
  savedPlan = { id: planSnap.id, ...planSnap.data() };
  try {
    const savedBudget = JSON.parse(localStorage.getItem(timeBudgetKey()) || "null");
    const savedSessionIndex = Number(savedBudget?.sessionIndex);
    const savedMinutes = Number(savedBudget?.timeBudgetMinutes);
    if (savedBudget && savedBudget.activePlanId === activePlanId && Number.isFinite(savedSessionIndex) && savedPlan.plan?.sessions?.[savedSessionIndex] && Number.isFinite(savedMinutes)) {
      sessionOverride = {
        sessionIndex: savedSessionIndex,
        session: shortenSessionToBudget(savedPlan.plan.sessions[savedSessionIndex], savedMinutes)
      };
      timeBudgetMinutes = Math.max(10, Math.round(savedMinutes));
    }
  } catch {
    localStorage.removeItem(timeBudgetKey());
  }
  renderSetup();
  restoreDraft();
}

localize();
bindFocusInputs();

$("#startWorkoutButton").addEventListener("click", beginWorkout);
$("#timeBudgetButton").addEventListener("click", applyTimeBudget);
$("#timeBudgetMinutes").addEventListener("input", refreshTimeFitPreview);
document.querySelectorAll("[data-time-preset]").forEach(button => {
  button.addEventListener("click", () => {
    const preset = button.dataset.timePreset;
    if (!preset) return;
    $("#timeBudgetMinutes").value = preset;
    refreshTimeFitPreview();
  });
});
$("#sessionSelect").addEventListener("change", () => {
  if (!sessionOverride) return;
  const selectedIndex = Number($("#sessionSelect").value);
  if (Number(sessionOverride.sessionIndex) !== selectedIndex) {
    sessionOverride = null;
    timeBudgetMinutes = null;
    $("#trackerStatus").textContent = "";
  }
  refreshTimeFitPreview();
});
$("#focusDoneButton").addEventListener("click", finishOrAdvanceSet);
$("#focusNextButton").addEventListener("click", startNextSet);
$("#focusBackButton").addEventListener("click", backOneSet);
$("#focusPauseButton").addEventListener("click", togglePause);
$("#quickModeButton").addEventListener("click", () => {
  quickModeEnabled = !quickModeEnabled;
  localStorage.setItem("fuelphysique-quick-mode", String(quickModeEnabled));
  localize();
  syncFocusFromRow();
});
$("#copyPreviousButton").addEventListener("click", copyPreviousSetIntoFocus);
$("#weightMinusButton").addEventListener("click", () => adjustFocusNumber("#focusWeight", -1, 0, 1000, 2.5));
$("#weightPlusButton").addEventListener("click", () => adjustFocusNumber("#focusWeight", 1, 0, 1000, 2.5));
$("#repsMinusButton").addEventListener("click", () => adjustFocusNumber("#focusReps", -1, 0, 999, 1));
$("#repsPlusButton").addEventListener("click", () => adjustFocusNumber("#focusReps", 1, 0, 999, 1));
$("#exerciseList").addEventListener("input", saveCurrentDraft);
$("#exerciseList").addEventListener("change", event => {
  if (event.target.classList.contains("set-complete")) {
    event.target.closest(".set-row").classList.toggle("completed", event.target.checked);
  }
  saveCurrentDraft();
});
$("#workoutNotes").addEventListener("input", saveCurrentDraft);
window.addEventListener("pagehide", saveCurrentDraft);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) saveCurrentDraft();
});
$("#finishWorkoutButton").addEventListener("click", finishWorkout);
$("#anotherWorkoutButton").addEventListener("click", () => {
  clearDraft();
  localStorage.removeItem(timeBudgetKey());
  sessionOverride = null;
  timeBudgetMinutes = null;
  $("#workoutNotes").value = "";
  renderSetup();
});
$("#discardWorkoutButton").addEventListener("click", discardDraft);

onAuthStateChanged(auth, async current => {
  if (!current) return location.replace("/auth.html");
  user = current;
  try {
    await load();
  } catch (error) {
    console.error(error);
    $("#trackerStatus").textContent = ui.loadError;
    $("#trackerStatus").classList.add("error");
    show("#emptyPanel");
  }
});
