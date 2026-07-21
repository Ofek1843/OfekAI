import { auth, db } from "./firebase-config.js";
import { setupExerciseDemos } from "./exercise-demos.js";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

setupExerciseDemos(document);

const $ = selector => document.querySelector(selector);
const he = (localStorage.getItem("ofek-ai-language") || "en") === "he";

const ui = he ? {
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

const esc = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const DRAFT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const draftKey = () => user ? `fuelphysique-workout-draft:${user.uid}` : "fuelphysique-workout-draft";
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

const read = input => input.value === "" ? null : Number(input.value);
const setValue = (selector, value) => { const el = $(selector); if (el) el.value = value ?? ""; };

function localize() {
  document.documentElement.lang = he ? "he" : "en";
  document.documentElement.dir = he ? "rtl" : "ltr";
  const map = [
    ["pageTitle", "title"],
    ["pageDescription", "description"],
    ["backLink", "back"],
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
  updateRestTimer();
  clearInterval(focusTimerId);
  focusTimerId = setInterval(updateRestTimer, 250);
  $("#focusNextButton").disabled = true;
  $("#focusNextButton").textContent = ui.nextSet;
}

function stopRestTimer() {
  rest.active = false;
  rest.paused = false;
  rest.remainingMs = 0;
  rest.endsAt = 0;
  clearInterval(focusTimerId);
  $("#focusRestTimer").textContent = "00:00";
  $("#focusNextButton").disabled = false;
}

function updateRestTimer() {
  if (!rest.active || rest.paused) return;
  const remaining = Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000));
  $("#focusRestTimer").textContent = formatTime(remaining);
  if (remaining <= 0) {
    clearInterval(focusTimerId);
    rest.active = false;
    $("#focusNextButton").disabled = false;
    $("#focusNextButton").textContent = ui.nextSet;
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
    return show("#emptyPanel");
  }
  $("#sessionSelect").innerHTML = sessions.map((session, index) => `<option value="${index}">${esc(session.name || `${ui.exercise} ${index + 1}`)}</option>`).join("");
  $("#trackerStatus").textContent = "";
  show("#setupPanel");
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

function syncFocusFromRow() {
  const row = document.querySelector(`.set-row[data-exercise-index="${focus.exerciseIndex}"][data-set-index="${focus.setIndex}"]`);
  if (!row) return;
  document.querySelectorAll(".exercise-card").forEach(card => {
    card.classList.toggle("active-card", Number(card.dataset.exerciseIndex) === focus.exerciseIndex);
  });
  setValue("#focusWeight", row.querySelector(".weight-input")?.value);
  setValue("#focusReps", row.querySelector(".reps-input")?.value);
  setValue("#focusRpe", row.querySelector(".rpe-input")?.value);
  $("#focusWarmup").checked = row.classList.contains("warmup-set");
  $("#focusModeBadge").textContent = row.classList.contains("warmup-set") ? ui.warmupSet : ui.workingSet;
  $("#focusExerciseName").textContent = $("#exerciseList").querySelectorAll(".exercise-card")[focus.exerciseIndex]?.querySelector("h3")?.childNodes?.[0]?.textContent?.trim() || `${ui.exercise} ${focus.exerciseIndex + 1}`;
  $("#focusSetMeta").textContent = `${ui.exercise} ${focus.exerciseIndex + 1} • ${focus.setIndex + 1}`;
  setHighlightedRow(focus.exerciseIndex, focus.setIndex);
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
}

function saveCurrentDraft() {
  if (!user || !savedPlan || $("#workoutPanel").classList.contains("hidden")) return;
  const sessionIndex = Number($("#workoutPanel").dataset.sessionIndex);
  const session = savedPlan.plan.sessions[sessionIndex];
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
  const session = savedPlan.plan.sessions[sessionIndex];
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
  const session = savedPlan.plan.sessions[sessionIndex];
  const exercises = session.exercises || [];
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
  if (moveFocus(-1)) saveCurrentDraft();
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
  const session = savedPlan.plan.sessions[index];
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
  const session = savedPlan.plan.sessions[sessionIndex];
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
  renderSetup();
  restoreDraft();
}

localize();
bindFocusInputs();

$("#startWorkoutButton").addEventListener("click", beginWorkout);
$("#focusDoneButton").addEventListener("click", finishOrAdvanceSet);
$("#focusNextButton").addEventListener("click", startNextSet);
$("#focusBackButton").addEventListener("click", backOneSet);
$("#focusPauseButton").addEventListener("click", togglePause);
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
