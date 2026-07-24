import { auth, db } from "./firebase-config.js";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const $ = s => document.querySelector(s);
const he = (localStorage.getItem("ofek-ai-language") || "en") === "he";
const esc = (v = "") => String(v).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);

const ui = he ? {
  title: "פספסת אימון? תעד אותו כאן",
  intro: "הוסף את האימון עכשיו כדי שההיסטוריה וגרפי ההתקדמות יישארו מלאים.",
  session: "אימון", date: "תאריך", start: "התחל לתעד →",
  currentSet: "סט נוכחי", exerciseOf: "תרגיל", setOf: "סט",
  weightKg: "משקל (ק\"ג)", targetReps: "יעד חזרות", actualReps: "חזרות בפועל",
  rpe: "RPE", optional: "(אופציונלי)", nextExercise: "תרגיל הבא",
  backSet: "סט אחורה", completeSet: "סיים סט →",
  allLogged: "כל הסטים תועדו!", saveSubtitle: "בדוק ושמור את האימון להיסטוריה ולגרפים.",
  notes: "הערות (אופציונלי)", save: "שמירת אימון", saving: "שומר...",
  loading: "טוען את התוכנית הפעילה...", noPlan: "יש לבחור קודם תוכנית אימון פעילה.",
  saved: "האימון נוסף להיסטוריה ולגרפים.", error: "לא ניתן לשמור את האימון.",
  exit: "יציאה", history: "היסטוריית אימונים", liveLabel: "תיעוד אימון קודם",
  of: "מתוך", progress: "סטים הושלמו"
} : {
  title: "Missed a workout? Log it here",
  intro: "Add the workout later so your history and progress charts stay complete.",
  session: "Workout", date: "Date", start: "Start logging →",
  currentSet: "CURRENT SET", exerciseOf: "EXERCISE", setOf: "SET",
  weightKg: "Weight (kg)", targetReps: "Target reps", actualReps: "Actual reps",
  rpe: "RPE", optional: "(optional)", nextExercise: "NEXT EXERCISE",
  backSet: "Back one set", completeSet: "Complete set →",
  allLogged: "All sets logged!", saveSubtitle: "Review and save your workout to your history and charts.",
  notes: "Notes (optional)", save: "Save workout", saving: "Saving...",
  loading: "Loading your active plan...", noPlan: "Choose an active workout plan first.",
  saved: "Workout added to your history and charts.", error: "Could not save the workout.",
  exit: "Exit", history: "Workout history", liveLabel: "LOGGING PAST WORKOUT",
  of: "of", progress: "sets completed"
};

let user, plan, planId;
let setList = [];   // flat list of all sets
let setData = [];   // stored data per set
let currentIdx = 0;

// Weight options: 0, 2.5, 5 … 200, then bodyweight
function buildWeightOptions() {
  const opts = ["Bodyweight"];
  for (let w = 0; w <= 200; w += 2.5) opts.push(w === 0 ? "0" : String(w));
  return opts;
}

function buildSetList(session) {
  const list = [];
  for (const [exIdx, ex] of (session.exercises || []).entries()) {
    const count = Math.max(1, Math.min(20, Number(ex.sets) || 1));
    for (let s = 0; s < count; s++) {
      list.push({
        exerciseIndex: exIdx,
        exerciseName: ex.name || `Exercise ${exIdx + 1}`,
        setNumber: s + 1,
        totalSets: count,
        targetReps: String(ex.reps || "—"),
        totalExercises: session.exercises.length
      });
    }
  }
  return list;
}

function localize() {
  document.documentElement.lang = he ? "he" : "en";
  document.documentElement.dir = he ? "rtl" : "ltr";
  $("#title").textContent = ui.title;
  $("#intro").textContent = ui.intro;
  $("#sessionLabel").textContent = ui.session;
  $("#dateLabel").textContent = ui.date;
  $("#startButton").textContent = ui.start;
  $("#trackerLiveLabel").textContent = ui.liveLabel;
  $("#exitLogBtn").textContent = ui.exit;
  $("#currentSetKicker").textContent = ui.currentSet;
  $("#weightLabel").textContent = ui.weightKg;
  $("#targetRepsLabel").textContent = ui.targetReps;
  $("#actualRepsLabel").textContent = ui.actualReps;
  $("#rpeLabel").innerHTML = `${ui.rpe} <span class="optional">${ui.optional}</span>`;
  $("#backSetBtn").textContent = ui.backSet;
  $("#nextSetBtn").textContent = ui.completeSet;
  $("#summaryTitle").textContent = ui.allLogged;
  $("#summarySubtitle").textContent = ui.saveSubtitle;
  $("#notesLabel").textContent = ui.notes;
  $("#saveButton").textContent = ui.save;
  $("#historyLink").textContent = ui.history;

  // Date default = today
  const today = new Date().toISOString().slice(0, 10);
  $("#completedAt").value = today;
  $("#status").textContent = ui.loading;
}

function populateSessions() {
  const sessions = plan.plan?.sessions || [];
  $("#sessionSelect").innerHTML = sessions.map((s, i) =>
    `<option value="${i}">${esc(s.name || `Session ${i + 1}`)}</option>`
  ).join("");
}

function showSetup() {
  populateSessions();
  $("#setupPanel").classList.remove("hidden");
  $("#status").textContent = "";
}

function startLogging() {
  const sessionIdx = Number($("#sessionSelect").value) || 0;
  const session = plan.plan.sessions[sessionIdx];
  setList = buildSetList(session);
  setData = setList.map(() => ({ weightKg: null, actualReps: null, rpe: null, completed: true }));
  currentIdx = 0;

  // tracker header
  $("#trackerWorkoutName").textContent = session.name || `Session ${sessionIdx + 1}`;
  $("#trackerWorkoutSub").textContent = plan.name || plan.plan?.programName || "";

  // populate weight select
  const weightOpts = buildWeightOptions();
  $("#weightSelect").innerHTML = weightOpts.map(w =>
    `<option value="${w}">${w === "Bodyweight" ? (he ? "משקל גוף" : "Bodyweight") : w + " kg"}</option>`
  ).join("");

  $("#setupPanel").classList.add("hidden");
  $("#trackerPanel").classList.remove("hidden");
  renderSet();
}

function renderSet() {
  if (currentIdx >= setList.length) {
    showSummary();
    return;
  }
  const s = setList[currentIdx];
  const exNum = s.exerciseIndex + 1;

  $("#exerciseCounter").textContent =
    `${ui.exerciseOf} ${exNum} ${ui.of} ${s.totalExercises} · ${ui.setOf} ${currentIdx + 1} ${ui.of} ${setList.length}`;
  $("#exerciseName").textContent = s.exerciseName;
  $("#setOfSets").textContent = `Set ${s.setNumber} of ${s.totalSets}`;
  $("#targetRepsValue").textContent = s.targetReps;

  // restore saved data if going back
  const saved = setData[currentIdx];
  const weightSelect = $("#weightSelect");
  if (saved.weightKg !== null) {
    weightSelect.value = String(saved.weightKg);
  } else if (currentIdx > 0) {
    // carry forward previous set's weight for same exercise
    for (let i = currentIdx - 1; i >= 0; i--) {
      if (setList[i].exerciseIndex === s.exerciseIndex && setData[i].weightKg !== null) {
        weightSelect.value = String(setData[i].weightKg);
        break;
      }
    }
  }
  $("#actualReps").value = saved.actualReps !== null ? saved.actualReps : "";
  $("#rpeInput").value = saved.rpe !== null ? saved.rpe : "";

  // next exercise preview
  const nextDifferentEx = setList.slice(currentIdx + 1).find(x => x.exerciseIndex !== s.exerciseIndex);
  if (nextDifferentEx) {
    $("#nextPreview").classList.remove("hidden");
    $("#nextPreviewText").textContent = `${nextDifferentEx.exerciseName} · ${nextDifferentEx.totalSets} sets · ${nextDifferentEx.targetReps} reps`;
  } else {
    $("#nextPreview").classList.add("hidden");
  }

  // back button
  $("#backSetBtn").disabled = currentIdx === 0;

  // progress bar
  const pct = Math.round((currentIdx / setList.length) * 100);
  $("#logProgressFill").style.width = pct + "%";
  $("#logProgressText").textContent = `${currentIdx} ${ui.of} ${setList.length} ${ui.progress}`;
}

function saveCurrentSet() {
  const weightVal = $("#weightSelect").value;
  setData[currentIdx] = {
    weightKg: weightVal === "Bodyweight" ? 0 : ($("#weightSelect").value === "" ? null : Number(weightVal)),
    actualReps: $("#actualReps").value === "" ? null : Number($("#actualReps").value),
    rpe: $("#rpeInput").value === "" ? null : Number($("#rpeInput").value),
    completed: true
  };
}

function showSummary() {
  $("#trackerPanel").classList.add("hidden");
  $("#summaryPanel").classList.remove("hidden");
  // update progress bar to 100%
}

async function saveWorkout() {
  const btn = $("#saveButton");
  btn.disabled = true;
  btn.textContent = ui.saving;

  const sessionIdx = Number($("#sessionSelect").value) || 0;
  const session = plan.plan.sessions[sessionIdx];

  // Build exercises array grouped
  const exercises = [];
  for (const [exIdx, ex] of (session.exercises || []).entries()) {
    const mySets = setList
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.exerciseIndex === exIdx)
      .map(({ s, i }) => ({
        setNumber: s.setNumber,
        targetReps: s.targetReps,
        weightKg: setData[i].weightKg,
        reps: setData[i].actualReps,
        rpe: setData[i].rpe,
        completed: setData[i].completed
      }));
    exercises.push({ name: ex.name, exerciseIndex: exIdx, sets: mySets });
  }

  const completedAt = new Date($("#completedAt").value);
  const allSets = exercises.flatMap(e => e.sets);

  try {
    await addDoc(collection(db, "users", user.uid, "workoutLogs"), {
      workoutPlanId: planId,
      workoutPlanName: plan.name || plan.plan?.programName || "Workout Plan",
      sessionIndex: sessionIdx,
      sessionName: session.name || `Session ${sessionIdx + 1}`,
      startedAt: completedAt,
      completedAt,
      durationSeconds: 0,
      completedSets: allSets.filter(s => s.completed).length,
      totalSets: allSets.length,
      notes: $("#notes").value.trim(),
      exercises,
      manuallyEntered: true,
      createdAt: serverTimestamp()
    });
    $("#status").textContent = ui.saved;
    btn.textContent = "✓ " + ui.saved;
    setTimeout(() => location.href = "/workout-history.html", 1800);
  } catch (err) {
    console.error(err);
    $("#status").textContent = ui.error;
    $("#status").classList.add("error");
    btn.disabled = false;
    btn.textContent = ui.save;
  }
}

async function load() {
  const userSnap = await getDoc(doc(db, "users", user.uid));
  planId = userSnap.data()?.activeWorkoutPlanId;
  if (!planId) throw new Error("NO_PLAN");
  const snap = await getDoc(doc(db, "users", user.uid, "workoutPlans", planId));
  if (!snap.exists()) throw new Error("NO_PLAN");
  plan = { id: snap.id, ...snap.data() };
  showSetup();
}

localize();

$("#startButton").addEventListener("click", startLogging);
$("#exitLogBtn").addEventListener("click", () => {
  if (confirm(he ? "לצאת? ההתקדמות תאבד." : "Exit? Your progress will be lost.")) {
    $("#trackerPanel").classList.add("hidden");
    $("#setupPanel").classList.remove("hidden");
  }
});
$("#backSetBtn").addEventListener("click", () => {
  if (currentIdx === 0) return;
  saveCurrentSet();
  currentIdx--;
  renderSet();
});
$("#nextSetBtn").addEventListener("click", () => {
  saveCurrentSet();
  currentIdx++;
  renderSet();
});
$("#saveButton").addEventListener("click", saveWorkout);

onAuthStateChanged(auth, async current => {
  if (!current) return location.replace("/auth.html");
  user = current;
  try {
    await load();
  } catch (err) {
    $("#status").textContent = err.message === "NO_PLAN" ? ui.noPlan : ui.error;
    $("#status").classList.add("error");
  }
});
