import { auth, db } from "./firebase-config.js";
import { normalizeSubscription } from "./subscription-plans.js";
import { trackPageView } from "./analytics.js";
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const $ = selector => document.querySelector(selector);
const he = (localStorage.getItem("ofek-ai-language") || "en") === "he";

const rawUi = he ? {
  today: "היום",
  welcome: name => `ברוך שובך${name ? `, ${name}` : ""}`,
  intro: "הנה תמונת המצב של האימונים והתזונה שלך.",
  chat: "שאל את המאמן שלך ←",
  loading: "טוען את הדשבורד שלך...",
  week: "אימונים השבוע",
  streak: "רצף נוכחי",
  weight: "משקל אחרון",
  sets: "סטים שהושלמו",
  update: "עדכון התקדמות",
  next: "האימון הבא",
  noneWorkout: "אין תוכנית אימון פעילה",
  start: "התחלת אימון",
  nutrition: "תזונה פעילה",
  noneNutrition: "אין תוכנית תזונה פעילה",
  calories: "קלוריות",
  protein: "חלבון",
  manageNutrition: "ניהול תוכניות תזונה",
  recent: "האימון האחרון",
  noWorkouts: "עדיין אין אימונים",
  history: "היסטוריית אימונים",
  progress: "התקדמות",
  momentum: "ממשיכים לצבור תנופה",
  analytics: "ניתוח תרגילים",
  goal: (done, target) => target ? `${done} מתוך ${target} אימונים מתוכננים` : "הגדר יעד ב־Athlete Core",
  streakHint: n => n ? "ימים רצופים עם פעילות" : "האימון הראשון מתחיל את הרצף",
  setsHint: "ב־30 האימונים האחרונים",
  exerciseMore: n => `ועוד ${n}`,
  minutes: "דקות",
  completed: "סטים הושלמו",
  progressMessage: n => n ? `השלמת ${n} אימונים. כל אימון מתועד משפר את ניתוח ההתקדמות שלך.` : "סיים את האימון הראשון כדי להתחיל למדוד התקדמות.",
  error: "לא ניתן לטעון את הדשבורד.",
  quickFoodLabel: "בדיקה מהירה",
  quickFoodTitle: "חרגת מהתפריט היום?",
  quickFoodText: "כתוב בקירוב מה אכלת היום. אל תשכח משקאות. זה חישוב משוער בלבד.",
  quickFoodEstimate: "חשב קירוב",
  quickFoodClear: "נקה",
  quickFoodEmpty: "כאן יופיעו קלוריות ומאקרו משוערים.",
  quickFoodPlaceholder: "לדוגמה: 2 ביצים, חזה עוף, אורז, סלט, חלב, קפה",
  quickFoodLow: "נראה שהיום לא היה דרמטי במיוחד — אפשר לסגור אותו עם הליכה קלה.",
  quickFoodMid: "יש כאן חריגה מתונה. חזרה למסלול מחר תספיק.",
  quickFoodHigh: "נראה שהיום היה גבוה יותר קלורית. עדיף לחזור לשגרה ולא להילחץ."
} : {
  today: "TODAY",
  welcome: name => `Welcome back${name ? `, ${name}` : ""}`,
  intro: "Here is your training and nutrition overview.",
  chat: "Chat with your coach",
  loading: "Loading your dashboard...",
  week: "Workouts this week",
  streak: "Current streak",
  weight: "Latest weight",
  sets: "Sets completed",
  update: "Update progress",
  next: "NEXT WORKOUT",
  noneWorkout: "No active workout plan",
  start: "Start Workout",
  nutrition: "ACTIVE NUTRITION",
  noneNutrition: "No active nutrition plan",
  calories: "Calories",
  protein: "Protein",
  manageNutrition: "Manage nutrition plans",
  recent: "LAST WORKOUT",
  noWorkouts: "No workouts yet",
  history: "View workout history",
  progress: "PROGRESS",
  momentum: "Keep building momentum",
  analytics: "Exercise analytics",
  goal: (done, target) => target ? `${done} of ${target} planned workouts` : "Set a goal in Athlete Core",
  streakHint: n => n ? "consecutive active days" : "Your first workout starts the streak",
  setsHint: "Across your last 30 workouts",
  exerciseMore: n => `and ${n} more`,
  minutes: "minutes",
  completed: "sets completed",
  progressMessage: n => n ? `You have completed ${n} workouts. Every logged session improves your progress insights.` : "Finish your first workout to begin measuring progress.",
  error: "Could not load your dashboard.",
  quickFoodLabel: "Quick check-in",
  quickFoodTitle: "Did you stray from the plan today?",
  quickFoodText: "Write roughly what you ate today, and don't forget drinks. This is only an estimate.",
  quickFoodEstimate: "Estimate calories",
  quickFoodClear: "Clear",
  quickFoodEmpty: "Approximate calories and macros will appear here.",
  quickFoodPlaceholder: "Example: 2 eggs, chicken breast, rice, salad, milk, coffee",
  quickFoodLow: "That does not look too dramatic — a light walk is enough.",
  quickFoodMid: "This looks like a moderate deviation. Get back on track tomorrow.",
  quickFoodHigh: "This looks like a higher-calorie day. No drama — just return to the routine tomorrow."
};

// Older dashboard strings were saved with a legacy UTF-8/Windows-1252
// conversion. Repair those values at the presentation boundary so the
// dashboard never renders mojibake, while keeping the stored data untouched.
const repairText = value => {
  if (typeof value !== "string" || !/[׳ג]/.test(value)) return value;
  try {
    return decodeURIComponent(escape(value));
  } catch {
    return value;
  }
};

const ui = new Proxy(rawUi, {
  get(target, property) {
    const value = target[property];
    if (typeof value === "function") {
      return (...args) => repairText(value(...args));
    }
    return repairText(value);
  }
});

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));

function localize() {
  document.documentElement.lang = he ? "he" : "en";
  document.documentElement.dir = he ? "rtl" : "ltr";
  for (const [id, key] of [["todayLabel", "today"], ["welcomeText", "intro"], ["chatLink", "chat"], ["weekLabel", "week"], ["streakLabel", "streak"], ["weightLabel", "weight"], ["setsLabel", "sets"], ["weightLink", "update"], ["nextLabel", "next"], ["startWorkoutLink", "start"], ["nutritionLabel", "nutrition"], ["caloriesLabel", "calories"], ["proteinLabel", "protein"], ["nutritionLink", "manageNutrition"], ["recentLabel", "recent"], ["historyAction", "history"], ["progressLabel", "progress"], ["progressTitle", "momentum"], ["analyticsAction", "analytics"], ["quickFoodLabel", "quickFoodLabel"], ["quickFoodTitle", "quickFoodTitle"], ["quickFoodText", "quickFoodText"], ["quickFoodEstimate", "quickFoodEstimate"], ["quickFoodClear", "quickFoodClear"]]) {
    const node = $("#" + id);
    if (node) node.textContent = ui[key];
  }
  $("#dashboardStatus").textContent = ui.loading;
  const input = $("#quickFoodInput");
  const result = $("#quickFoodResult");
  if (input) input.placeholder = ui.quickFoodPlaceholder;
  if (result) result.textContent = ui.quickFoodEmpty;
}

function timestampDate(value) {
  return value?.toDate?.() || (value instanceof Date ? value : null);
}

function startOfWeek() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  return start;
}

function calculateStreak(logs) {
  const days = [...new Set(logs.map(log => timestampDate(log.completedAt) || timestampDate(log.startedAt)).filter(Boolean).map(date => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
  }))].sort((a, b) => b - a);
  if (!days.length) return 0;
  const oneDay = 86400000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today.getTime() - days[0] > oneDay) return 0;
  let streak = 1;
  for (let index = 1; index < days.length; index += 1) {
    const difference = Math.round((days[index - 1] - days[index]) / oneDay);
    if (difference === 1) streak += 1;
    else if (difference > 1) break;
  }
  return streak;
}

function dateText(value) {
  const date = timestampDate(value);
  return date ? new Intl.DateTimeFormat(he ? "he-IL" : "en-US", { dateStyle: "medium" }).format(date) : "";
}

function renderWorkout(planDoc, logs) {
  const action = $("#startWorkoutLink");
  if (!planDoc) {
    $("#nextWorkoutName").textContent = ui.noneWorkout;
    $("#workoutPlanName").textContent = "";
    $("#exercisePreview").innerHTML = "";
    action.href = "/workout-builder.html";
    action.textContent = he ? "יצירת תוכנית אימון" : "Create workout plan";
    return;
  }
  action.href = "/workout-tracker.html";
  action.textContent = ui.start;
  const plan = planDoc.plan || {};
  const sessions = Array.isArray(plan.sessions) ? plan.sessions : [];
  const latest = logs.find(log => log.workoutPlanId === planDoc.id);
  const index = sessions.length ? (latest ? ((Number(latest.sessionIndex) || 0) + 1) % sessions.length : 0) : 0;
  const session = sessions[index] || {};
  $("#nextWorkoutName").textContent = session.name || plan.programName || planDoc.name || "Workout";
  $("#workoutPlanName").textContent = planDoc.name || plan.programName || "";
  const exercises = Array.isArray(session.exercises) ? session.exercises : [];
  $("#exercisePreview").innerHTML = exercises.slice(0, 5).map(item => `<span>${esc(item.name || "Exercise")}</span>`).join("") + (exercises.length > 5 ? `<span>+ ${ui.exerciseMore(exercises.length - 5)}</span>` : "");
}

function renderNutrition(saved) {
  const action = $("#nutritionLink");
  if (!saved) {
    $("#nutritionPlanName").textContent = ui.noneNutrition;
    $("#caloriesValue").textContent = "—";
    $("#proteinValue").textContent = "—";
    action.href = "/nutrition-builder.html";
    action.textContent = he ? "יצירת תוכנית תזונה" : "Create nutrition plan";
    return;
  }
  action.href = "/my-nutrition-plans.html";
  action.textContent = ui.manageNutrition;
  const plan = saved.plan || {};
  $("#nutritionPlanName").textContent = saved.name || plan.planName || "Nutrition Plan";
  $("#caloriesValue").textContent = plan.dailyCalories ? Number(plan.dailyCalories).toLocaleString() : "—";
  $("#proteinValue").textContent = plan.proteinGrams ? `${plan.proteinGrams}g` : "—";
}

function renderRecent(log) {
  const details = $("#lastWorkoutDetails");
  if (!log) {
    $("#lastWorkoutName").textContent = ui.noWorkouts;
    details.innerHTML = "";
    return;
  }
  $("#lastWorkoutName").textContent = log.workoutName || log.planName || "Workout";
  const duration = Number(log.durationMinutes) || 0;
  const sets = Number(log.completedSets) || 0;
  const exerciseCount = Array.isArray(log.exerciseLogs) ? log.exerciseLogs.length : 0;
  details.innerHTML = [
    ["Date", dateText(log.completedAt)],
    ["Duration", duration ? `${duration} ${ui.minutes}` : "—"],
    ["Sets", sets || "—"],
    ["Exercises", exerciseCount || "—"]
  ].map(([label, val]) => `<div><span>${label}</span><strong>${val}</strong></div>`).join("");
}

const FOOD_RULES = [
  { match: /\b(oats?|שיבולת שועל)\b/i, cal: 150, p: 5, c: 27, f: 3, unit: "serving" },
  { match: /\b(milk|חלב)\b/i, cal: 50, p: 2.7, c: 4.0, f: 2.7, unit: "100ml" },
  { match: /\b(egg|eggs|ביצה|ביצים)\b/i, cal: 72, p: 6, c: 0.4, f: 5, unit: "1" },
  { match: /\b(chicken breast|chicken|חזה עוף|עוף)\b/i, cal: 165, p: 31, c: 0, f: 4, unit: "100g" },
  { match: /\b(rice|אורז)\b/i, cal: 130, p: 2.5, c: 28, f: 0.3, unit: "100g cooked" },
  { match: /\b(apple|תפוח)\b/i, cal: 95, p: 0.5, c: 25, f: 0.3, unit: "1 medium" },
  { match: /\b(banana|בננה)\b/i, cal: 105, p: 1.3, c: 27, f: 0.4, unit: "1 medium" },
  { match: /\b(salad|סלט|vegetable|ירקות)\b/i, cal: 35, p: 1.5, c: 7, f: 0.5, unit: "serving" },
  { match: /\b(beer|בירה)\b/i, cal: 150, p: 1.5, c: 13, f: 0, unit: "330ml" },
  { match: /\b(coffee|קפה)\b/i, cal: 20, p: 0.5, c: 3, f: 0.5, unit: "cup" },
  { match: /\b(water|מים)\b/i, cal: 0, p: 0, c: 0, f: 0, unit: "glass" },
  { match: /\b(cheese|גבינה)\b/i, cal: 110, p: 7, c: 1, f: 9, unit: "30g" },
  { match: /\b(yogurt|יוגורט)\b/i, cal: 100, p: 9, c: 10, f: 3, unit: "cup" },
  { match: /\b(protein powder|אבקת חלבון|whey)\b/i, cal: 120, p: 24, c: 3, f: 2, unit: "scoop" },
  { match: /\b(peanut butter|חמאת בוטנים)\b/i, cal: 190, p: 8, c: 7, f: 16, unit: "2 tbsp" }
];

const NUMBER_WORDS = new Map([
  ["zero", 0], ["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5], ["six", 6],
  ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10], ["eleven", 11], ["twelve", 12]
]);

function parseQuantity(raw) {
  const match = raw.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gram|grams|ml|milliliter|milliliters|cup|cups|tbsp|tablespoon|tablespoons|scoop|scoops|piece|pieces|slice|slices|egg|eggs|serving|servings)?/i);
  if (!match) return null;
  const n = Number(match[1].replace(",", "."));
  const unit = (match[2] || "").toLowerCase();
  if (!Number.isFinite(n)) return null;
  return { n, unit };
}

function estimateFood(text) {
  const items = text.split(/\n|,|\u2022|\|/).map(part => part.trim()).filter(Boolean);
  if (!items.length) return null;
  const total = { cal: 0, p: 0, c: 0, f: 0, count: 0 };
  for (const item of items) {
    const lower = item.toLowerCase();
    const rule = FOOD_RULES.find(entry => entry.match.test(item));
    if (!rule) continue;
    let factor = 1;
    const qty = parseQuantity(item);
    if (qty) {
      const { n, unit } = qty;
      if (rule.unit === "100g" && unit === "kg") factor = n * 10;
      else if (rule.unit === "100g" && ["g", "gram", "grams"].includes(unit)) factor = n / 100;
      else if (rule.unit === "100ml" && unit === "ml") factor = n / 100;
      else if (rule.unit === "100ml" && ["cup", "cups"].includes(unit)) factor = (n * 240) / 100;
      else if (rule.unit === "330ml" && unit === "ml") factor = n / 330;
      else if (rule.unit === "30g" && unit === "g") factor = n / 30;
      else if (rule.unit === "2 tbsp" && ["tbsp", "tablespoon", "tablespoons"].includes(unit)) factor = n / 2;
      else if (rule.unit === "1" && ["piece", "pieces", "slice", "slices", "egg", "eggs", "serving", "servings"].includes(unit)) factor = n;
      else if (rule.unit === "cup" && ["cup", "cups"].includes(unit)) factor = n;
      else if (rule.unit === "scoop" && ["scoop", "scoops"].includes(unit)) factor = n;
      else if (rule.unit === "serving") factor = n;
      else factor = n;
    } else if (/pizza/.test(lower) && /family size|large|xl/.test(lower)) {
      factor = /three|3/.test(lower) ? 3 : 1;
      total.cal += 1800 * factor;
      total.p += 72 * factor;
      total.c += 216 * factor;
      total.f += 72 * factor;
      total.count += 1;
      continue;
    } else if (/pizza/.test(lower)) {
      const wordCount = [...NUMBER_WORDS.entries()].find(([word]) => new RegExp(`\\b${word}\\b`).test(lower));
      factor = wordCount ? wordCount[1] : (/(\d+)/.test(lower) ? Number(lower.match(/(\d+)/)[1]) : 1);
      total.cal += 900 * factor;
      total.p += 36 * factor;
      total.c += 108 * factor;
      total.f += 36 * factor;
      total.count += 1;
      continue;
    } else {
      const wordCount = [...NUMBER_WORDS.entries()].find(([word]) => new RegExp(`\\b${word}\\b`).test(lower));
      if (wordCount && /egg|ביצה/.test(lower)) factor = wordCount[1];
    }
    total.cal += rule.cal * factor;
    total.p += rule.p * factor;
    total.c += rule.c * factor;
    total.f += rule.f * factor;
    total.count += 1;
  }
  if (!total.count) return null;
  return total;
}

function recommendation(calories) {
  if (calories < 900) return ui.quickFoodLow;
  if (calories < 1700) return ui.quickFoodMid;
  return ui.quickFoodHigh;
}

function initQuickFood() {
  const input = $("#quickFoodInput");
  const estimate = $("#quickFoodEstimate");
  const clear = $("#quickFoodClear");
  const result = $("#quickFoodResult");
  if (!input || !estimate || !clear || !result) return;
  const update = () => {
    const value = input.value.trim();
    if (!value) {
      result.textContent = ui.quickFoodEmpty;
      result.classList.add("muted");
      return;
    }
    const totals = estimateFood(value);
    if (!totals) {
      result.textContent = he ? "לא הצלחתי לזהות כאן מאכלים מוכרים. נסה לכתוב קצת יותר פשוט או להפריד בפסיקים." : "I could not recognize common foods here. Try simpler items or separate them with commas.";
      result.classList.add("muted");
      return;
    }
    result.classList.remove("muted");
    result.innerHTML = `<strong>${Math.round(totals.cal)} ${he ? "קלוריות" : "calories"}</strong><span>${Math.round(totals.p)}g ${he ? "חלבון" : "protein"} · ${Math.round(totals.c)}g ${he ? "פחמימה" : "carbs"} · ${Math.round(totals.f)}g ${he ? "שומן" : "fat"}</span><p>${recommendation(totals.cal)}</p>`;
  };
  estimate.addEventListener("click", update);
  clear.addEventListener("click", () => {
    input.value = "";
    result.textContent = ui.quickFoodEmpty;
    result.classList.add("muted");
    input.focus();
  });
  input.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      update();
    }
  });
}

async function load(user) {
  const [userSnap, settingsSnap, logsSnap, weightSnap] = await Promise.all([
    getDoc(doc(db, "users", user.uid)),
    getDoc(doc(db, "users", user.uid, "settings", "main")),
    getDocs(query(collection(db, "users", user.uid, "workoutLogs"), orderBy("completedAt", "desc"), limit(30))),
    getDocs(query(collection(db, "users", user.uid, "weightEntries"), orderBy("date", "desc"), limit(1)))
  ]);
  const root = userSnap.exists() ? userSnap.data() : {};
  const settings = settingsSnap.exists() ? settingsSnap.data() : {};
  const logs = logsSnap.docs.map(item => ({ id: item.id, ...item.data() }));
  const activeWorkoutId = root.activeWorkoutPlanId;
  const activeNutritionId = root.activeNutritionPlanId;
  const subscription = normalizeSubscription(root.subscription);
  $("#dashboardPlanBadge").textContent = subscription.plan.name;
  const [workoutSnap, nutritionSnap] = await Promise.all([
    activeWorkoutId ? getDoc(doc(db, "users", user.uid, "workoutPlans", activeWorkoutId)) : null,
    activeNutritionId ? getDoc(doc(db, "users", user.uid, "nutritionPlans", activeNutritionId)) : null
  ]);
  const workout = workoutSnap?.exists() ? { id: workoutSnap.id, ...workoutSnap.data() } : null;
  const nutrition = nutritionSnap?.exists() ? { id: nutritionSnap.id, ...nutritionSnap.data() } : null;
  const name = (settings.displayName || user.displayName || "").trim().split(/\s+/)[0];
  $("#welcomeTitle").textContent = ui.welcome(name);
  const weekStart = startOfWeek();
  const weekly = logs.filter(log => {
    const date = timestampDate(log.completedAt) || timestampDate(log.startedAt);
    return date && date >= weekStart;
  }).length;
  const target = Number(settings.athleteCore?.trainingDays) || 0;
  const streak = calculateStreak(logs);
  const sets = logs.reduce((sum, log) => sum + (Number(log.completedSets) || 0), 0);
  const weight = weightSnap.docs[0]?.data()?.weight;
  $("#weeklyWorkouts").textContent = weekly;
  $("#weekGoal").textContent = ui.goal(weekly, target);
  $("#currentStreak").textContent = `${streak} 🔥`;
  $("#streakHint").textContent = ui.streakHint(streak);
  $("#completedSets").textContent = sets;
  $("#setsHint").textContent = ui.setsHint;
  $("#latestWeight").textContent = Number.isFinite(Number(weight)) ? `${Number(weight).toFixed(1)} kg` : "—";
  $("#progressMessage").textContent = ui.progressMessage(logs.length);
  renderWorkout(workout, logs);
  renderNutrition(nutrition);
  renderRecent(logs[0]);
  $("#dashboardStatus").textContent = "";
  $("#dashboardContent").classList.remove("hidden");
}

localize();
initQuickFood();
trackPageView({ page: "dashboard" });
onAuthStateChanged(auth, async user => {
  if (!user) return location.replace("/auth.html");
  try {
    await load(user);
  } catch (error) {
    console.error(error);
    $("#dashboardStatus").textContent = ui.error;
    $("#dashboardStatus").classList.add("error");
  }
});
