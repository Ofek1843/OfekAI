import {
 auth, db }
 from "./firebase-config.js";
import {
 normalizeSubscription }
 from "./subscription-plans.js";
import {
 trackEvent, trackPageView }
 from "./analytics.js";
import {
  createWeeklyScheduleDays,  getWeekdayLabels,  normalizeDayIndex,  shiftWeeklyScheduleDays}
 from "./schedule-utils.js";
import {
 collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc }
 from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
 getIdToken, onAuthStateChanged, signOut }
 from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { guardProtectedPage } from "./verification-gate.js";
import { disassociateCurrentInstallation } from "./push-notifications.js";
const $ = selector => document.querySelector(selector);
const he = (localStorage.getItem("ofek-ai-language") || "en") === "he";
let activeNutritionPlanForQuickFood = null;
let checkinRefreshTimer = 0;
const openedWorkoutCheckins = new Set();
const CHECKIN_COPY = {
he: {
  kicker: "צ׳ק־אין אימון", previous: "אימון קודם", makeup: "אימון להשלמה מחר", scheduled: "מתוכנן ל־", exercises: count => `${count} תרגילים`,
  initial: name => `השלמת את ${name} היום?`, initialPrevious: (name, date) => `השלמת את ${name} בתאריך ${date}?`, most: "השלמת את רוב האימון המתוכנן?", difficulty: "האימון הרגיש קשה במיוחד?", pain: "הרגשת כאב או אי־נוחות חריגה?",
  recovery: "דילגת על האימון כדי לנוח או להתאושש?", tomorrow: "להשאיר את האימון זמין למחר?", yes: "כן", no: "לא", later: "שאלו אותי מאוחר יותר — עוד לא התאמנתי",
  completed: "צ׳ק־אין הושלם ✓", trackerCompleted: "האימון כבר סומן כהושלם", completedNote: "תודה, המשוב נשמר.", skipped: "האימון לא הושלם", skippedNote: "אפשר לעבור על לוח הזמנים ולתכנן את האימון הבא.",
  makeupReady: "האימון נשמר כאפשרות למחר. התוכנית השבועית לא שונתה.", makeupToday: "האימון זמין היום כאפשרות חד־פעמית. התוכנית השבועית לא שונתה.", startMakeup: "פתיחת האימון", reviewSchedule: "מעבר ללוח האימונים", snoozed: "נשאל שוב ב־", snoozedNoTime: "האימון נשאר פתוח למענה בפעם הבאה שתיכנס.",
  retry: "נסה שוב", error: "לא ניתן לשמור כרגע. נסה שוב.", sent: "המשוב נשלח."
},
en: {
  kicker: "WORKOUT CHECK-IN", previous: "Previous workout", makeup: "Make-up workout", scheduled: "Scheduled ", exercises: count => `${count} exercises`,
  initial: name => `Did you complete ${name} today?`, initialPrevious: (name, date) => `Did you complete ${name} on ${date}?`, most: "Did you complete most of the planned workout?", difficulty: "Did it feel unusually difficult?", pain: "Did you experience pain or unusual discomfort?",
  recovery: "Did you skip it to rest or recover?", tomorrow: "Keep this workout available for tomorrow?", yes: "Yes", no: "No", later: "Ask me later — I haven't trained yet",
  completed: "Check-in complete ✓", trackerCompleted: "Workout already marked complete", completedNote: "Thanks — your feedback is saved.", skipped: "Workout not completed", skippedNote: "You can review your schedule and plan what comes next.",
  makeupReady: "This workout is saved as an option for tomorrow. Your weekly plan was not changed.", makeupToday: "This workout is available as a one-off option for today. Your weekly plan was not changed.", startMakeup: "Open this workout", reviewSchedule: "Review workout schedule", snoozed: "We'll ask again at ", snoozedNoTime: "This workout will stay here for you to answer later.",
  retry: "Try again", error: "Could not save your answer right now. Please try again.", sent: "Your feedback was saved."
}
};

function dashboardGreeting(name, isHebrew) {
  const cleanName = String(name || "").trim();
  const suffix = cleanName ? (isHebrew ? ` — ${cleanName}` : `, ${cleanName}`) : "";
  const day = new Date().getDay();

  if (isHebrew) {
    if (day === 0) return `שבוע טוב${suffix}`;
    if (day === 5 || day === 6) return `סוף שבוע נהדר${suffix}`;
    return cleanName ? `היי ${cleanName}` : "היי";
  }

  if (day === 0 || day === 1) return `Have a great week${suffix}`;
  if (day === 5 || day === 6) return `Have a great weekend${suffix}`;
  return cleanName ? `Hi, ${cleanName}` : "Hi";
}

const rawUi = he ? {
  checkin: CHECKIN_COPY.he,
  today: "היום",  welcome: name => dashboardGreeting(name, true),  intro: "בחר את הצעד הבא שלך בלי ללכת לאיבוד בין יותר מדי כפתורים.",  chat: "שאל את המאמן שלך →",  loading: "טוען את הדשבורד שלך...",  week: "אימונים השבוע",  streak: "רצף נוכחי",  weight: "משקל אחרון",  sets: "סטים שהושלמו",  update: "עדכון התקדמות",  next: "האימון הבא",  noneWorkout: "אין תוכנית אימון פעילה",  start: "התחלת אימון",  nutrition: "תזונה פעילה",  noneNutrition: "אין תוכנית תזונה פעילה",  calories: "קלוריות",  protein: "חלבון",  manageNutrition: "ניהול תוכניות תזונה",  recent: "האימון האחרון",  noWorkouts: "עדיין אין אימונים",  history: "היסטוריית אימונים",  progress: "התקדמות",  momentum: "ממשיכים לצבור תנופה",  analytics: "ניתוח תרגילים",  goal: (done, target) => target ? `${done} מתוך ${target} אימונים מתוכננים` : "הגדר יעד ב־Athlete Core",  streakHint: n => n ? "ימים רצופים עם פעילות" : "האימון הראשון מתחיל את הרצף",  setsHint: "ב־30 האימונים האחרונים",  exerciseMore: n => `ועוד ${n}`,  minutes: "דקות",  completed: "סטים הושלמו",  progressMessage: n => n ? `השלמת ${n} אימונים. כל אימון מתועד משפר את ניתוח ההתקדמות שלך.` : "סיים את האימון הראשון כדי להתחיל למדוד התקדמות.",  error: "לא ניתן לטעון את הדשבורד.",  quickFoodLabel: "בדיקה מהירה",  quickFoodTitle: "חרגת מהתפריט היום?",  quickFoodText: "כתוב בקירוב מה אכלת היום. אל תשכח משקאות. זה חישוב משוער בלבד.",  quickFoodEstimate: "חשב קירוב",  quickFoodClear: "נקה",  quickFoodEmpty: "כאן יופיעו קלוריות ומאקרו משוערים.",  quickFoodPlaceholder: "לדוגמה: 2 ביצים, חזה עוף, אורז, סלט, חלב, קפה",  quickFoodLow: "נראה שהיום לא היה דרמטי במיוחד — אפשר לסגור אותו עם הליכה קלה.",  quickFoodMid: "יש כאן חריגה מתונה. חזרה למסלול מחר תספיק.",  quickFoodHigh: "נראה שהיום היה גבוה יותר קלורית. עדיף לחזור לשגרה ולא להילחץ.",  scheduleLabel: "תצוגת השבוע",  scheduleTitle: "ימי האימון של השבוע",  scheduleHint: "גרור אימון ליום אחר כדי להזיז את כל השבוע קדימה בלי לפגוע במנוחה.",  scheduleShift: "הזז יום קדימה",  buildWorkout: "בניית תוכנית אימון",  buildNutrition: "בניית תוכנית תזונה",  trackProgress: "מעקב התקדמות",  heroHistory: "היסטוריית אימונים",  drawerCoach: "שיחה עם המאמן",  drawerPrimary: "התחלה מהירה",  drawerTraining: "כלי אימון",  drawerSupport: "התקדמות וחשבון",  missedLabel: "פספסת אימון?",  missedTitle: "הזן אותו כאן",  missedText: "הוסף את האימון עכשיו כדי שההיסטוריה וגרפי ההתקדמות יישארו מלאים.",  missedAction: "הזנת אימון שבוצע",  manualLabel: "תוכנית עצמית",  manualTitle: "בניית תוכנית בעצמך",  manualText: "בחר תרגילים, קבע סטים ומנוחות, ובנה או שכפל ימי אימון בקצב שלך.",  manualAction: "יצירת תוכנית עצמית",  manualNav: "בניית תוכנית עצמית",  toolsKicker: "כלים מתקדמים",  toolsSummary: "פתיחת כלים נוספים",  toolsText: "היסטוריה, בנייה ידנית ובדיקת חריגה נשמרים כאן כדי שהמסך הראשי יישאר פשוט וברור.",  logout: "התנתקות",  logoutConfirm: "להתנתק מהחשבון?",  logoutWorking: "מתנתק...",  logoutError: "לא הצלחנו להתנתק. נסה שוב."}
 : {
  checkin: CHECKIN_COPY.en,
  today: "TODAY",  welcome: name => dashboardGreeting(name, false),  intro: "Pick your next move without wading through too many buttons at once.",  chat: "Ask your coach",  loading: "Loading your dashboard...",  week: "Workouts this week",  streak: "Current streak",  weight: "Latest weight",  sets: "Sets completed",  update: "Update progress",  next: "NEXT WORKOUT",  noneWorkout: "No active workout plan",  start: "Start Workout",  nutrition: "ACTIVE NUTRITION",  noneNutrition: "No active nutrition plan",  calories: "Calories",  protein: "Protein",  manageNutrition: "Manage nutrition plans",  recent: "LAST WORKOUT",  noWorkouts: "No workouts yet",  history: "Workout history",  progress: "PROGRESS",  momentum: "Keep building momentum",  analytics: "Exercise analytics",  goal: (done, target) => target ? `${done} of ${target} planned workouts` : "Set a goal in Athlete Core",  streakHint: n => n ? "consecutive active days" : "Your first workout starts the streak",  setsHint: "Across your last 30 workouts",  exerciseMore: n => `and ${n} more`,  minutes: "minutes",  completed: "sets completed",  progressMessage: n => n ? `You have completed ${n} workouts. Every logged session improves your progress insights.` : "Finish your first workout to begin measuring progress.",  error: "Could not load your dashboard.",  quickFoodLabel: "Quick check-in",  quickFoodTitle: "Did you stray from the plan today?",  quickFoodText: "Write roughly what you ate today, and don't forget drinks. This is only an estimate.",  quickFoodEstimate: "Estimate calories",  quickFoodClear: "Clear",  quickFoodEmpty: "Approximate calories and macros will appear here.",  quickFoodPlaceholder: "Example: 2 eggs, chicken breast, rice, salad, milk, coffee",  quickFoodLow: "That does not look too dramatic — a light walk is enough.",  quickFoodMid: "This looks like a moderate deviation. Get back on track tomorrow.",  quickFoodHigh: "This looks like a higher-calorie day. No drama — just return to the routine tomorrow.",  scheduleLabel: "WEEKLY PLAN",  scheduleTitle: "Training days this week",  scheduleHint: "Drag a workout card to another day and the whole week slides together.",  scheduleShift: "Shift +1 day",  buildWorkout: "Build workout plan",  buildNutrition: "Build nutrition plan",  trackProgress: "Track progress",  heroHistory: "Workout history",  drawerCoach: "Chat with your coach",  drawerPrimary: "Start here",  drawerTraining: "Training tools",  drawerSupport: "Progress & account",  missedLabel: "MISSED TRACKING?",  missedTitle: "Missed a workout? Log it here",  missedText: "Add the workout later so your history and progress charts stay complete.",  missedAction: "Log a past workout",  manualLabel: "YOUR OWN PROGRAM",  manualTitle: "Build a plan manually",  manualText: "Search exercises, set your sets and rest times, and build or duplicate workout days at your pace.",  manualAction: "Create my plan",  manualNav: "Build a plan manually",  toolsKicker: "MORE TOOLS",  toolsSummary: "Open advanced tools",  toolsText: "History, manual planning, and nutrition check-ins live here so the main screen stays simple and easy to use.",  logout: "Log out",  logoutConfirm: "Log out of your account?",  logoutWorking: "Logging out...",  logoutError: "Could not log out. Please try again."}
;
const navLabels = he ? {
  dashboard: "דשבורד",
  programs: "תוכניות אימון",
  workouts: "מעקב אימון",
  nutrition: "תזונה",
  social: "חברים והודעות",
  progress: "התקדמות",
  settings: "הגדרות",
  plans: "מסלולים",
  history: "היסטוריה"
} : {
  dashboard: "Dashboard",
  programs: "Workout Plans",
  workouts: "Workout Tracker",
  nutrition: "Nutrition",
  social: "Friends & Messages",
  progress: "Progress",
  settings: "Settings",
  plans: "Plans",
  history: "History"
};
const drawerSearchCopy = he
  ? {
      topbar: "חיפוש מהיר",
      placeholder: "חפש עמוד או כלי...",
      open: "פתח חיפוש",
      noResults: "לא נמצאו תוצאות"
    }
  : {
      topbar: "Search dashboard",
      placeholder: "Search pages or tools...",
      open: "Open search",
      noResults: "No results found"
    };
const searchableItems = [
  {
    id: "dashboard",
    title: "Dashboard",
    titleHe: "דשבורד",
    route: "/dashboard.html",
    keywords: ["dashboard", "home", "overview", "main", "דשבורד", "בית", "ראשי", "סקירה"]
  },
  {
    id: "coach",
    title: "Coach",
    titleHe: "המאמן שלך",
    route: "/app.html",
    keywords: ["coach", "chat", "assistant", "ask coach", "personal coach", "מאמן", "צאט", "צ'אט", "שיחה", "שאל את המאמן"]
  },
  {
    id: "workout-builder",
    title: "Workout plan builder",
    titleHe: "בניית תוכנית אימון",
    route: "/workout-builder.html",
    keywords: ["workout builder", "workout plan", "program builder", "build workout", "training plan", "תוכנית אימון", "בניית תוכנית", "מחולל אימון", "מחולל תוכנית", "אימון"]
  },
  {
    id: "workout-tracker",
    title: "Workout Tracker",
    titleHe: "מעקב אימונים",
    route: "/workout-tracker.html",
    keywords: ["workout tracker", "workout track", "workout", "track workout", "training log", "workout log", "sets", "reps", "מעקב אימון", "מעקב אימונים", "מעקב אימ", "אימונים", "יומן אימונים", "רישום אימון", "סטים", "חזרות"]
  },
  {
    id: "manual-workout-builder",
    title: "Build a plan manually",
    titleHe: "בניית תוכנית בעצמך",
    route: "/manual-workout-builder.html",
    keywords: ["manual plan", "manual workout", "custom workout", "build manually", "create own program", "תוכנית עצמית", "בניית תוכנית בעצמך", "בנייה ידנית", "תוכנית ידנית", "תוכנית משלי"]
  },
  {
    id: "workout-history",
    title: "Workout history",
    titleHe: "היסטוריית אימונים",
    route: "/workout-history.html",
    keywords: ["history", "workout history", "logs", "past workouts", "יומן", "היסטוריה", "היסטוריית אימונים", "אימונים קודמים", "אימון קודם"]
  },
  {
    id: "missed-workout",
    title: "Missed a workout? Log it here",
    titleHe: "פספסת אימון? תעד אותו כאן",
    route: "/log-workout.html",
    keywords: ["missed workout", "missed a workout", "log it here", "missed tracking", "log workout", "past workout", "פספסת אימון", "החמצת אימון", "תעד אותו", "אימון שבוצע", "הזנת אימון"]
  },
  {
    id: "nutrition-builder",
    title: "Nutrition plan builder",
    titleHe: "בניית תפריט תזונה",
    route: "/nutrition-builder.html",
    keywords: ["nutrition builder", "meal plan", "diet plan", "food plan", "nutrition", "תפריט", "תזונה", "מחולל תפריט", "בניית תפריט", "דיאטה"]
  },
  {
    id: "nutrition-plans",
    title: "My nutrition plans",
    titleHe: "תוכניות התזונה שלי",
    route: "/my-nutrition-plans.html",
    keywords: ["nutrition plans", "saved meal plans", "my nutrition", "meal plans", "תוכניות תזונה", "תפריטים שמורים", "התפריטים שלי", "תזונה שמורה"]
  },
  {
    id: "workout-plans",
    title: "My workout plans",
    titleHe: "תוכניות האימון שלי",
    route: "/my-workout-plans.html",
    keywords: ["workout plans", "saved workouts", "my programs", "programs", "תוכניות אימון", "תוכניות שמורות", "התוכניות שלי", "אימונים שמורים"]
  },
  {
    id: "progress",
    title: "Progress",
    titleHe: "התקדמות",
    route: "/progress.html",
    keywords: ["progress", "analytics", "charts", "weight", "measurements", "graphs", "התקדמות", "גרפים", "מדדים", "משקל", "מדידות", "ניתוח"]
  },
  {
    id: "social",
    title: "Friends & Messages",
    titleHe: "חברים והודעות",
    route: "/social.html",
    keywords: ["friends", "messages", "social", "chat", "share plan", "חברים", "הודעות", "שיתוף", "צאט"]
  },
  {
    id: "settings",
    title: "Settings",
    titleHe: "הגדרות",
    route: "/app.html?settings=open",
    keywords: ["settings", "profile", "athlete core", "account", "preferences", "הגדרות", "פרופיל", "אטלט קור", "חשבון", "העדפות"]
  },
  {
    id: "pricing",
    title: "Plans",
    titleHe: "מסלולים",
    route: "/pricing.html",
    keywords: ["pricing", "plans", "pro", "upgrade", "subscription", "מחיר", "מסלולים", "פרו", "שדרוג", "מנוי"]
  }
];
const repairText = value => {
  if (typeof value !== "string" || !/[׳³׳’]/.test(value)) return value;
  try {
    return decodeURIComponent(escape(value));
  }
 catch {
    return value;
  }
}
;
const ui = new Proxy(rawUi, {
  get(target, property) {
    const value = target[property];
    if (typeof value === "function") {
      return (...args) => repairText(value(...args));
    }
    return repairText(value);
  }
}
);
const checkinUi = ui.checkin;
const esc = value => String(value ?? "").replace(/[&<>"\x27]/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#039;"
}[char]));

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function itemSearchHaystack(item) {
  return [
    item.title,
    item.titleHe,
    item.id,
    item.route,
    ...(item.keywords || [])
  ].map(normalizeSearchText);
}

function searchDashboardItems(query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];
  const queryParts = normalizedQuery.split(" ").filter(Boolean);

  return searchableItems
    .map(item => {
      const haystack = itemSearchHaystack(item);
      const exactish = haystack.some(text => text.includes(normalizedQuery));
      const allParts = queryParts.every(part => haystack.some(text => text.includes(part)));
      const startsWith = haystack.some(text => text.startsWith(normalizedQuery));
      const score = startsWith ? 3 : exactish ? 2 : allParts ? 1 : 0;
      return { item, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .map(result => result.item);
}

function debounce(callback, delay = 240) {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
}

function renderSearchResults(root, results, query) {
  const resultsBox = root.querySelector("[data-search-results]");
  if (!resultsBox) return;

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    resultsBox.hidden = true;
    resultsBox.innerHTML = "";
    return;
  }

  resultsBox.hidden = false;
  if (!results.length) {
    resultsBox.innerHTML = `<div class="dashboard-search-empty">${esc(drawerSearchCopy.noResults)}</div>`;
    return;
  }

  resultsBox.innerHTML = results.slice(0, 7).map(item => `
    <a class="dashboard-search-result" href="${esc(item.route)}" data-search-result-id="${esc(item.id)}">
      <span>${esc(he ? item.titleHe : item.title)}</span>
      ${he ? `<small>${esc(item.title)}</small>` : ''}
    </a>
  `).join("");
}

function closeSearchResults(exceptRoot = null) {
  document.querySelectorAll("[data-dashboard-search]").forEach(root => {
    if (root === exceptRoot) return;
    const resultsBox = root.querySelector("[data-search-results]");
    if (resultsBox) {
      resultsBox.hidden = true;
      resultsBox.innerHTML = "";
    }
  });
}

function initDashboardSearch() {
  const searchRoots = [...document.querySelectorAll("[data-dashboard-search]")];
  if (!searchRoots.length) return;

  searchRoots.forEach(root => {
    const input = root.querySelector("input[type='search']");
    if (!input) return;

    const runSearch = () => {
      const results = searchDashboardItems(input.value);
      renderSearchResults(root, results, input.value);
    };
    const debouncedSearch = debounce(runSearch);

    input.addEventListener("input", debouncedSearch);
    input.addEventListener("focus", runSearch);
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        input.value = "";
        closeSearchResults();
        input.blur();
      }
    });
    root.addEventListener("click", event => {
      const result = event.target.closest("[data-search-result-id]");
      if (result) {
        closeSearchResults();
      }
    });
  });

  document.addEventListener("click", event => {
    const activeRoot = event.target.closest("[data-dashboard-search]");
    if (!activeRoot) closeSearchResults();
  });
}

function localize() {
  document.documentElement.lang = he ? "he" : "en";
  document.documentElement.dir = he ? "rtl" : "ltr";
  const socialQuickAction = he ? "צ׳אט עם חברים" : "Chat with friends";
  const socialLink = $("#heroSocialLink");
  if (socialLink) {
    socialLink.textContent = socialQuickAction;
    socialLink.setAttribute("aria-label", socialQuickAction);
  }
  for (const [id, key] of [["todayLabel", "today"], ["welcomeText", "intro"], ["chatLink", "chat"], ["weekLabel", "week"], ["streakLabel", "streak"], ["weightLabel", "weight"], ["setsLabel", "sets"], ["weightLink", "update"], ["nextLabel", "next"], ["startWorkoutLink", "start"], ["nutritionLabel", "nutrition"], ["caloriesLabel", "calories"], ["proteinLabel", "protein"], ["nutritionLink", "manageNutrition"], ["recentLabel", "recent"], ["historyAction", "history"], ["missedLabel", "missedLabel"], ["missedTitle", "missedTitle"], ["missedText", "missedText"], ["missedAction", "missedAction"], ["progressLabel", "progress"], ["progressTitle", "momentum"], ["analyticsAction", "analytics"], ["scheduleLabel", "scheduleLabel"], ["scheduleTitle", "scheduleTitle"], ["scheduleHint", "scheduleHint"], ["shiftScheduleButton", "scheduleShift"], ["quickFoodLabel", "quickFoodLabel"], ["quickFoodTitle", "quickFoodTitle"], ["quickFoodText", "quickFoodText"], ["quickFoodEstimate", "quickFoodEstimate"], ["quickFoodClear", "quickFoodClear"], ["heroWorkoutBuilderLink", "buildWorkout"], ["heroNutritionBuilderLink", "buildNutrition"], ["heroProgressLink", "trackProgress"], ["heroHistoryLink", "heroHistory"], ["drawerCoachLink", "drawerCoach"], ["drawerPrimaryLabel", "drawerPrimary"], ["drawerTrainingLabel", "drawerTraining"], ["drawerSupportLabel", "drawerSupport"], ["manualLabel", "manualLabel"], ["manualTitle", "manualTitle"], ["manualText", "manualText"], ["manualAction", "manualAction"], ["drawerManualBuilderLink", "manualNav"], ["toolsKicker", "toolsKicker"], ["toolsSummary", "toolsSummary"], ["toolsText", "toolsText"], ["dashboardLogoutButton", "logout"]]) {
    const node = $("#" + id);
    if (node) node.textContent = ui[key];
  }
  $("#dashboardStatus").textContent = ui.loading;
  const input = $("#quickFoodInput");
  const result = $("#quickFoodResult");
  if (input) input.placeholder = ui.quickFoodPlaceholder;
  if (result) result.textContent = ui.quickFoodEmpty;
  document.querySelectorAll("[data-nav-key]").forEach(node => {
    const key = node.dataset.navKey;
    if (key && navLabels[key]) node.textContent = navLabels[key];
  });
  const menuOpenLabel = he ? "פתח תפריט" : "Open menu";
  const menuCloseLabel = he ? "סגור תפריט" : "Close menu";
  $("#mobileMenuButton")?.setAttribute("aria-label", menuOpenLabel);
  $("#sidebarClose")?.setAttribute("aria-label", menuCloseLabel);
  $("#mobileProfileButton")?.setAttribute("aria-label", he ? "פתח הגדרות" : "Open settings");
  $("#mobileSearchButton")?.setAttribute("aria-label", drawerSearchCopy.open);
  const searchLabel = $("#mobileSearchButton .mobile-search-label");
  if (searchLabel) searchLabel.textContent = drawerSearchCopy.topbar;
  const drawerSearch = $("#drawerSearchInput");
  if (drawerSearch) drawerSearch.placeholder = drawerSearchCopy.placeholder;
  const desktopSearch = $("#desktopSearchInput");
  if (desktopSearch) desktopSearch.placeholder = drawerSearchCopy.placeholder;
}

const DRAWER_MAX_WIDTH = 1100;

function initMobileDrawer() {
  const body = document.body;
  const menuButton = $("#mobileMenuButton");
  const searchButton = $("#mobileSearchButton");
  const closeButton = $("#sidebarClose");
  const backdrop = $("#mobileBackdrop");
  const sidebar = $("#mobileDrawerPanel");
  const searchInput = $("#drawerSearchInput");
  if (!menuButton || !closeButton || !backdrop || !sidebar) return;

  const setOpen = open => {
    body.classList.toggle("drawer-open", open);
    menuButton.setAttribute("aria-expanded", open ? "true" : "false");
    if (open && searchInput) {
      requestAnimationFrame(() => searchInput.focus());
    }
  };

  menuButton.addEventListener("click", () => {
    setOpen(!body.classList.contains("drawer-open"));
  });
  searchButton?.addEventListener("click", () => {
    setOpen(true);
  });
  closeButton.addEventListener("click", () => setOpen(false));
  backdrop.addEventListener("click", () => setOpen(false));
  sidebar.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => setOpen(false));
  });
  // Must match the drawer's CSS breakpoint in public/css/dashboard.css.
  // Above it the sidebar is a permanent sticky column, so a drawer left
  // "open" would keep body scroll locked with no visible way to close it.
  window.addEventListener("resize", () => {
    if (window.innerWidth > DRAWER_MAX_WIDTH) setOpen(false);
  });
}

function initLogout() {
  const button = $("#dashboardLogoutButton");
  if (!button) return;

  button.addEventListener("click", async () => {
    if (!window.confirm(ui.logoutConfirm)) return;

    button.disabled = true;
    button.textContent = ui.logoutWorking;

    try {
      sessionStorage.removeItem("fuelphysique-athlete-core-prompt-dismissed");
      await disassociateCurrentInstallation();
      await signOut(auth);
      window.location.replace("/");
    } catch (error) {
      console.error("Dashboard logout failed:", error);
      button.disabled = false;
      button.textContent = ui.logout;
      window.alert(ui.logoutError);
    }
  });
}

window.addEventListener("pageshow", event => {
  if (!event.persisted) return;
  let unsubscribe = () => {};
  unsubscribe = onAuthStateChanged(auth, user => {
    unsubscribe();
    if (!user) window.location.replace("/auth.html");
  });
});

function isAthleteCoreComplete(settings) {
  const core = settings?.athleteCore || {};
  const hasNumber = value => Number.isFinite(Number(value)) && Number(value) > 0;
  return (
    hasNumber(core.age) &&
    hasNumber(core.weight) &&
    hasNumber(core.height) &&
    Boolean(String(core.experience || "").trim()) &&
    Boolean(String(core.goal || "").trim())
  );
}

function showAthleteCorePromptIfNeeded(settings) {
  if (isAthleteCoreComplete(settings)) return;
  if (sessionStorage.getItem("fuelphysique-athlete-core-prompt-dismissed") === "true") return;

  const prompt = $("#athleteCorePrompt");
  if (!prompt) return;

  const title = $("#athleteCorePromptTitle");
  const text = $("#athleteCorePromptText");
  const action = $("#athleteCorePromptAction");
  const later = $("#athleteCorePromptLater");

  if (he) {
    if (title) title.textContent = "אנא מלא את ה־Athlete Core שלך";
    if (text) {
      text.textContent = "אנא מלא את האטלט קור שלך. חשוב לנו שתעשה את זה בשביל לשפר את היעילות שהאתר יכול להקנות לך.";
    }
    if (action) action.textContent = "מילוי Athlete Core";
    if (later) later.textContent = "מאוחר יותר";
  }

  prompt.classList.remove("hidden");
  later?.addEventListener("click", () => {
    sessionStorage.setItem("fuelphysique-athlete-core-prompt-dismissed", "true");
    prompt.classList.add("hidden");
  }, { once: true });
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
  }
))].sort((a, b) => b - a);
  if (!days.length) return 0;
  const oneDay = 86400000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today.getTime() - days[0] > oneDay) return 0;
  let streak = 1;
  for (let index = 1;
 index < days.length;
 index += 1) {
    const difference = Math.round((days[index - 1] - days[index]) / oneDay);
    if (difference === 1) streak += 1;
    else if (difference > 1) break;
  }
  return streak;
}
function dateText(value) {
  const date = timestampDate(value);
  return date ? new Intl.DateTimeFormat(he ? "he-IL" : "en-US", {
 dateStyle: "medium" }
).format(date) : "";
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
  const plan = planDoc.plan || {
}
;
  const sessions = Array.isArray(plan.sessions) ? plan.sessions : [];
  const latest = logs.find(log => log.workoutPlanId === planDoc.id);
  const index = sessions.length ? (latest ? ((Number(latest.sessionIndex) || 0) + 1) % sessions.length : 0) : 0;
  const session = sessions[index] || {
}
;
  $("#nextWorkoutName").textContent = session.name || plan.programName || planDoc.name || "Workout";
  $("#workoutPlanName").textContent = planDoc.name || plan.programName || "";
  const exercises = Array.isArray(session.exercises) ? session.exercises : [];
  $("#exercisePreview").innerHTML = exercises.slice(0, 5).map(item => `<span>${esc(item.name || "Exercise")}</span>`).join("") + (exercises.length > 5 ? `<span>+ ${ui.exerciseMore(exercises.length - 5)}</span>` : "");
}

function workoutCheckinDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "";
  return new Intl.DateTimeFormat(he ? "he-IL" : "en-US", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}

function workoutCheckinMuscles(checkin) {
  const muscles = Array.isArray(checkin.targetMuscles) ? checkin.targetMuscles.filter(Boolean) : [];
  if (!muscles.length) return "";
  const hebrew = { chest: "חזה", shoulders: "כתפיים", triceps: "יד אחורית", biceps: "יד קדמית", back: "גב", lats: "רחב גבי", legs: "רגליים", quads: "ארבע־ראשי", hamstrings: "המסטרינג", glutes: "ישבן", calves: "שוקיים", core: "ליבה", abs: "בטן" };
  return muscles.slice(0, 4).map(value => he ? (hebrew[String(value).toLowerCase()] || value) : value).join(" · ");
}

function workoutCheckinQuestion(checkin) {
  if (checkin.step === "completed_most") return checkinUi.most;
  if (checkin.step === "completed_difficulty") return checkinUi.difficulty;
  if (checkin.step === "completed_pain") return checkinUi.pain;
  if (checkin.step === "skipped_recovery") return checkinUi.recovery;
  if (checkin.step === "skipped_tomorrow") return checkinUi.tomorrow;
  const name = checkin.workoutName || (he ? "האימון" : "your workout");
  return checkin.isPrevious ? checkinUi.initialPrevious(name, workoutCheckinDate(checkin.scheduledDate)) : checkinUi.initial(name);
}

function workoutCheckinActions(checkin) {
  if (checkin.isMakeup || checkin.status === "completed" || checkin.status === "skipped" || !checkin.answerAvailable) return [];
  if (checkin.step === "initial") {
    const actions = [["completed", checkinUi.yes, "positive"], ["not_completed", checkinUi.no, "neutral"]];
    if (!checkin.isPrevious && Number(checkin.snoozeCount || 0) < 2) actions.push(["later", checkinUi.later, "quiet"]);
    return actions;
  }
  if (checkin.step === "completed_most") return [["most_yes", checkinUi.yes, "positive"], ["most_no", checkinUi.no, "neutral"]];
  if (checkin.step === "completed_difficulty") return [["difficulty_yes", checkinUi.yes, "positive"], ["difficulty_no", checkinUi.no, "neutral"]];
  if (checkin.step === "completed_pain") return [["pain_yes", checkinUi.yes, "positive"], ["pain_no", checkinUi.no, "neutral"]];
  if (checkin.step === "skipped_recovery") return [["recover_yes", checkinUi.yes, "positive"], ["recover_no", checkinUi.no, "neutral"]];
  if (checkin.step === "skipped_tomorrow") return [["tomorrow_yes", checkinUi.yes, "positive"], ["tomorrow_no", checkinUi.no, "neutral"]];
  return [];
}

function renderWorkoutCheckins(checkins, user) {
  const root = $("#workoutCheckins");
  if (!root) return;
  root.innerHTML = checkins.map(checkin => {
    const date = checkin.makeupScheduledDate && checkin.isMakeup ? checkin.makeupScheduledDate : checkin.scheduledDate;
    const muscles = workoutCheckinMuscles(checkin);
    const badges = [checkin.isPrevious ? checkinUi.previous : "", checkin.isMakeup ? checkinUi.makeup : ""].filter(Boolean);
    let state = "";
    let question = "";
    let buttons = workoutCheckinActions(checkin);
    if (checkin.status === "completed") {
      state = checkin.completionSource === "workout_tracker" ? checkinUi.trackerCompleted : checkinUi.completed;
      question = checkin.completionSource === "workout_tracker" ? "" : checkinUi.completedNote;
      buttons = [];
    } else if (checkin.status === "skipped" && !checkin.isMakeup) {
      state = checkinUi.skipped;
      question = checkin.moveToTomorrowRequested ? checkinUi.makeupReady : checkinUi.skippedNote;
      buttons = [];
    } else if (checkin.isMakeup) {
      state = checkinUi.makeupToday;
      question = "";
      buttons = [];
    } else if (!checkin.answerAvailable) {
      state = checkin.nextPromptAt ? `${checkinUi.snoozed}${new Intl.DateTimeFormat(he ? "he-IL" : "en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(checkin.nextPromptAt))}` : checkinUi.snoozedNoTime;
      buttons = [];
    } else {
      question = workoutCheckinQuestion(checkin);
    }
    const musclesLine = muscles ? `<span>${esc(muscles)}</span>` : "";
    const exerciseLine = Number(checkin.exerciseCount) > 0 ? `<span>${esc(checkinUi.exercises(Number(checkin.exerciseCount)))}</span>` : "";
    const actionMarkup = buttons.map(([action, label, kind]) => `<button type="button" class="workout-checkin-button is-${kind}" data-checkin-action="${action}">${esc(label)}</button>`).join("");
    const planId = encodeURIComponent(checkin.planId || "");
    const workoutId = encodeURIComponent(checkin.workoutId || checkin.sessionIndex || "");
    const makeupDate = encodeURIComponent(checkin.makeupScheduledDate || checkin.scheduledDate || "");
    const finalAction = checkin.isMakeup
      ? `<a class="workout-checkin-button is-positive" href="/workout-tracker.html?plan=${planId}&amp;session=${workoutId}&amp;date=${makeupDate}">${esc(checkinUi.startMakeup)}</a>`
      : checkin.status === "skipped" && !checkin.moveToTomorrowRequested
        ? `<a class="workout-checkin-button is-neutral" href="#weeklyScheduleBoard">${esc(checkinUi.reviewSchedule)}</a>` : "";
    return `<article class="workout-checkin-card${checkin.isPrevious ? " is-previous" : ""}" data-checkin-id="${esc(checkin.id)}" tabindex="-1">
      <div class="workout-checkin-heading"><span class="workout-checkin-icon" aria-hidden="true">✓</span><div><span class="workout-checkin-kicker">${esc(checkinUi.kicker)}</span><h3>${esc(checkin.workoutName || (he ? "אימון" : "Workout"))}</h3></div></div>
      ${badges.length ? `<div class="workout-checkin-badges">${badges.map(label => `<span>${esc(label)}</span>`).join("")}</div>` : ""}
      <div class="workout-checkin-meta">${musclesLine}${exerciseLine}<span>${esc(checkinUi.scheduled)}${esc(workoutCheckinDate(date))}</span></div>
      ${question ? `<p class="workout-checkin-question">${esc(question)}</p>` : ""}
      ${state ? `<p class="workout-checkin-state" role="status">${esc(state)}</p>` : ""}
      <div class="workout-checkin-feedback"${buttons.length || finalAction ? "" : " hidden"}>${actionMarkup}${finalAction}</div>
      <p class="workout-checkin-error" role="alert" hidden></p>
    </article>`;
  }).join("");

  root.onclick = async event => {
    const button = event.target.closest("[data-checkin-action]");
    if (!button || !root.contains(button)) return;
    const card = button.closest("[data-checkin-id]");
    const checkin = checkins.find(item => item.id === card?.dataset.checkinId);
    if (!checkin || button.disabled) return;
    if (!openedWorkoutCheckins.has(checkin.id)) {
      openedWorkoutCheckins.add(checkin.id);
      trackEvent("workout_checkin_opened", { workout_id: checkin.workoutId || checkin.sessionIndex, plan_id: checkin.planId, scheduled_date: checkin.scheduledDate, source: "dashboard" });
    }
    card.querySelectorAll("button[data-checkin-action]").forEach(item => { item.disabled = true; });
    const error = card.querySelector(".workout-checkin-error");
    try {
      const token = await getIdToken(user);
      const response = await fetch(`/api/workout-checkins/${encodeURIComponent(checkin.id)}/answer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: button.dataset.checkinAction })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save answer.");
      await loadWorkoutCheckins(user);
      document.querySelector(`[data-checkin-id="${CSS.escape(checkin.id)}"]`)?.focus({ preventScroll: true });
    } catch (requestError) {
      console.error("Workout check-in answer failed:", requestError);
      error.textContent = checkinUi.error;
      error.hidden = false;
      card.querySelectorAll("button[data-checkin-action]").forEach(item => { item.disabled = false; });
    }
  };
}

async function loadWorkoutCheckins(user) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const token = await getIdToken(user);
  const response = await fetch(`/api/workout-checkins?timezone=${encodeURIComponent(timezone)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Could not load workout check-ins.");
  const data = await response.json();
  const checkins = Array.isArray(data.checkins) ? data.checkins : [];
  renderWorkoutCheckins(checkins, user);
  clearTimeout(checkinRefreshTimer);
  const now = new Date();
  const nextPrompt = checkins.map(item => item.nextPromptAt ? Date.parse(item.nextPromptAt) : 0)
    .filter(value => value > now.getTime()).sort((a, b) => a - b)[0];
  const nextEvening = new Date(now);
  nextEvening.setHours(19, 0, 0, 0);
  if (nextEvening <= now) nextEvening.setDate(nextEvening.getDate() + 1);
  const refreshAt = Math.min(nextPrompt || Infinity, nextEvening.getTime());
  if (Number.isFinite(refreshAt)) checkinRefreshTimer = setTimeout(() => loadWorkoutCheckins(user).catch(() => {}), Math.max(1000, refreshAt - now.getTime() + 1000));
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("checkin");
  if (requestedId && checkins.some(item => item.id === requestedId)) {
    const target = document.querySelector(`[data-checkin-id="${CSS.escape(requestedId)}"]`);
    if (target) {
      if (params.get("source") === "notification" && !openedWorkoutCheckins.has(requestedId)) {
        trackEvent("workout_checkin_opened", { workout_id: checkins.find(item => item.id === requestedId)?.workoutId, plan_id: checkins.find(item => item.id === requestedId)?.planId, scheduled_date: checkins.find(item => item.id === requestedId)?.scheduledDate, source: "notification" });
        openedWorkoutCheckins.add(requestedId);
      }
      setTimeout(() => { target.scrollIntoView({ behavior: "smooth", block: "center" }); target.focus({ preventScroll: true }); }, 80);
      params.delete("checkin");
      params.delete("source");
      history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
    }
  }
}

function renderNutrition(saved) {
  const action = $("#nutritionLink");
  if (!saved) {
    activeNutritionPlanForQuickFood = null;
    $("#nutritionPlanName").textContent = ui.noneNutrition;
    $("#caloriesValue").textContent = "—";
    $("#proteinValue").textContent = "—";
    action.href = "/nutrition-builder.html";
    action.textContent = he ? "יצירת תוכנית תזונה" : "Create nutrition plan";
    return;
  }
  action.href = "/my-nutrition-plans.html";
  action.textContent = ui.manageNutrition;
  const plan = saved.plan || {
}
;
  activeNutritionPlanForQuickFood = {
    name: saved.name || plan.planName || "Nutrition Plan",    dailyCalories: Number(plan.dailyCalories) || null,    proteinGrams: Number(plan.proteinGrams) || null,    carbsGrams: Number(plan.carbsGrams) || null,    fatGrams: Number(plan.fatGrams) || null  }
;
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
  details.innerHTML = [    ["Date", dateText(log.completedAt)],    ["Duration", duration ? `${duration} ${ui.minutes}` : "—"],    ["Sets", sets || "—"],    ["Exercises", exerciseCount || "—"]  ].map(([label, val]) => `<div><span>${label}</span><strong>${val}</strong></div>`).join("");
}
const FOOD_RULES = [  {
 match: /(oats?|שיבולת שועל)/i, cal: 150, p: 5, c: 27, f: 3, unit: "serving" }
,  {
 match: /(milk|חלב)/i, cal: 50, p: 2.7, c: 4.0, f: 2.7, unit: "100ml" }
,  {
 match: /(egg|eggs|ביצה|ביצים)/i, cal: 72, p: 6, c: 0.4, f: 5, unit: "1" }
,  {
 match: /(chicken breast|chicken|חזה עוף|עוף)/i, cal: 165, p: 31, c: 0, f: 4, unit: "100g" }
,  {
 match: /(rice|אורז)/i, cal: 130, p: 2.5, c: 28, f: 0.3, unit: "100g cooked" }
,  {
 match: /(apple|תפוח)/i, cal: 95, p: 0.5, c: 25, f: 0.3, unit: "1 medium" }
,  {
 match: /(banana|בננה)/i, cal: 105, p: 1.3, c: 27, f: 0.4, unit: "1 medium" }
,  {
 match: /(salad|סלט|vegetable|ירקות)/i, cal: 35, p: 1.5, c: 7, f: 0.5, unit: "serving" }
,  {
 match: /(beer|בירה)/i, cal: 150, p: 1.5, c: 13, f: 0, unit: "330ml" }
,  {
 match: /(coffee|קפה)/i, cal: 20, p: 0.5, c: 3, f: 0.5, unit: "cup" }
,  {
 match: /(water|מים)/i, cal: 0, p: 0, c: 0, f: 0, unit: "glass" }
,  {
 match: /(cheese|גבינה)/i, cal: 110, p: 7, c: 1, f: 9, unit: "30g" }
,  {
 match: /(yogurt|יוגורט)/i, cal: 100, p: 9, c: 10, f: 3, unit: "cup" }
,  {
 match: /(protein powder|אבקת חלבון|whey)/i, cal: 120, p: 24, c: 3, f: 2, unit: "scoop" }
,  {
 match: /(peanut butter|חמאת בוטנים)/i, cal: 190, p: 8, c: 7, f: 16, unit: "2 tbsp" }
];
const NUMBER_WORDS = new Map([  ["zero", 0], ["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5], ["six", 6],  ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10], ["eleven", 11], ["twelve", 12]]);
function parseQuantity(raw) {
  const match = raw.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gram|grams|ml|milliliter|milliliters|cup|cups|tbsp|tablespoon|tablespoons|scoop|scoops|piece|pieces|slice|slices|egg|eggs|serving|servings)?/i);
  if (!match) return null;
  const n = Number(match[1].replace(",", "."));
  const unit = (match[2] || "").toLowerCase();
  if (!Number.isFinite(n)) return null;
  return {
 n, unit }
;
}
function estimateFood(text) {
  const items = text.split(/\n|,|\u2022|\|/).map(part => part.trim()).filter(Boolean);
  if (!items.length) return null;
  const total = {
 cal: 0, p: 0, c: 0, f: 0, count: 0 }
;
  for (const item of items) {
    const lower = item.toLowerCase();
    const rule = FOOD_RULES.find(entry => entry.match.test(item));
    if (!rule) continue;
    let factor = 1;
    const qty = parseQuantity(item);
    if (qty) {
      const {
 n, unit }
 = qty;
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
    }
 else if (/pizza/.test(lower) && /family size|large|xl/.test(lower)) {
      factor = /three|3/.test(lower) ? 3 : 1;
      total.cal += 1800 * factor;
      total.p += 72 * factor;
      total.c += 216 * factor;
      total.f += 72 * factor;
      total.count += 1;
      continue;
    }
 else if (/pizza/.test(lower)) {
      const wordCount = [...NUMBER_WORDS.entries()].find(([word]) => new RegExp(`\\b${word}\\b`).test(lower));
      factor = wordCount ? wordCount[1] : (/(\d+)/.test(lower) ? Number(lower.match(/(\d+)/)[1]) : 1);
      total.cal += 900 * factor;
      total.p += 36 * factor;
      total.c += 108 * factor;
      total.f += 36 * factor;
      total.count += 1;
      continue;
    }
 else {
      const wordCount = [...NUMBER_WORDS.entries()].find(([word]) => new RegExp(`\\b${word}\\b`).test(lower));
      if (wordCount && /egg|ביצה|ביצים/.test(lower)) factor = wordCount[1];
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
function quickFoodComparison(totals) {
  const plan = activeNutritionPlanForQuickFood;
  const calories = Math.round(Number(totals.calories) || 0);
  const protein = Math.round(Number(totals.proteinGrams) || 0);
  const carbs = Math.round(Number(totals.carbsGrams) || 0);
  const fat = Math.round(Number(totals.fatGrams) || 0);
  const macroLine = `${protein}g ${he ? "\u05d7\u05dc\u05d1\u05d5\u05df" : "protein"} · ${carbs}g ${he ? "\u05e4\u05d7\u05de\u05d9\u05de\u05d5\u05ea" : "carbs"} · ${fat}g ${he ? "\u05e9\u05d5\u05de\u05df" : "fat"}`;
  if (!plan?.dailyCalories) {
    return he      ? `\u05d0\u05d9\u05df \u05ea\u05e4\u05e8\u05d9\u05d8 \u05de\u05d5\u05d2\u05d3\u05e8 \u05dc\u05db\u05df \u05d0\u05e0\u05d9 \u05dc\u05d0 \u05d9\u05d5\u05d3\u05e2 \u05d0\u05dd \u05d7\u05e8\u05d2\u05ea \u05d0\u05d5 \u05dc\u05d0, \u05d0\u05d1\u05dc \u05d6\u05d4 \u05d4\u05de\u05e6\u05d1 \u05e9\u05dc\u05da: ${calories} \u05e7\u05dc\u05d5\u05e8\u05d9\u05d5\u05ea, ${macroLine}.`      : `No active nutrition plan is set, so I cannot tell whether you went over or not. Your estimated intake is: ${calories} calories, ${macroLine}.`;
  }
  const target = Number(plan.dailyCalories);
  const delta = calories - target;
  const absDelta = Math.abs(Math.round(delta));
  if (delta > 250) {
    return he      ? `\u05d1\u05d9\u05d7\u05e1 \u05dc\u05ea\u05e4\u05e8\u05d9\u05d8 \u05d4\u05e4\u05e2\u05d9\u05dc \u05e9\u05dc\u05da (${Math.round(target)} \u05e7\u05dc\u05d5\u05e8\u05d9\u05d5\u05ea), \u05d6\u05d4 \u05d1\u05e2\u05e8\u05da ${absDelta} \u05e7\u05dc\u05d5\u05e8\u05d9\u05d5\u05ea \u05de\u05e2\u05dc \u05d4\u05d9\u05e2\u05d3. \u05de\u05d5\u05de\u05dc\u05e5 \u05dc\u05e2\u05e9\u05d5\u05ea \u05d4\u05dc\u05d9\u05db\u05d4 \u05e7\u05dc\u05d4 \u05d0\u05dd \u05d6\u05d4 \u05de\u05ea\u05d0\u05d9\u05dd \u05dc\u05da, \u05d5\u05d1\u05e2\u05d9\u05e7\u05e8 \u05dc\u05d7\u05d6\u05d5\u05e8 \u05dc\u05e9\u05d2\u05e8\u05d4 \u05d1\u05d0\u05e8\u05d5\u05d7\u05d4 \u05d4\u05d1\u05d0\u05d4.`      : `Compared with your active plan (${Math.round(target)} calories), this is about ${absDelta} calories over target. A light walk can help if it fits your day, and the main move is getting back to the routine at the next meal.`;
  }
  if (delta < -250) {
    return he      ? `\u05d1\u05d9\u05d7\u05e1 \u05dc\u05ea\u05e4\u05e8\u05d9\u05d8 \u05d4\u05e4\u05e2\u05d9\u05dc \u05e9\u05dc\u05da, \u05d0\u05ea\u05d4 \u05d1\u05e2\u05e8\u05da ${absDelta} \u05e7\u05dc\u05d5\u05e8\u05d9\u05d5\u05ea \u05de\u05ea\u05d7\u05ea \u05dc\u05d9\u05e2\u05d3. \u05d0\u05dd \u05d4\u05d9\u05d5\u05dd \u05e2\u05d5\u05d3 \u05dc\u05d0 \u05e0\u05d2\u05de\u05e8, \u05db\u05d3\u05d0\u05d9 \u05dc\u05d4\u05e9\u05dc\u05d9\u05dd \u05d0\u05e8\u05d5\u05d7\u05d4 \u05de\u05d0\u05d5\u05d6\u05e0\u05ea \u05d1\u05de\u05e7\u05d5\u05dd \u05dc\u05e4\u05e6\u05d5\u05ea \u05d1\u05e6\u05d5\u05e8\u05d4 \u05e7\u05d9\u05e6\u05d5\u05e0\u05d9\u05ea.`      : `Compared with your active plan, you are about ${absDelta} calories under target. If the day is not over, complete it with a balanced meal instead of overcorrecting.`;
  }
  return he    ? "ביחס לתפריט הפעיל שלך, זה די קרוב ליעד. אין פה דרמה גדולה."    : "Compared with your active plan, this is fairly close to target. No major drama here.";
}
function renderWeeklyActivity(logs) {
  const chart = $("#weeklyActivityChart");
  if (!chart) return;
  const days = Array.from({
 length: 7 }
, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return date;
  }
);
  const counts = days.map(day => {
    const dayTime = day.getTime();
    const nextDayTime = dayTime + 86400000;
    return logs.filter(log => {
      const date = timestampDate(log.completedAt) || timestampDate(log.startedAt);
      if (!date) return false;
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      const time = normalized.getTime();
      return time >= dayTime && time < nextDayTime;
    }
).length;
  }
);
  const max = Math.max(1, ...counts);
  const dayLabel = new Intl.DateTimeFormat(he ? "he-IL" : "en-US", {
 weekday: "short" }
);
  chart.innerHTML = days.map((day, index) => {
    const value = counts[index];
    const height = Math.max(8, Math.round((value / max) * 100));
    return `      <div class="activity-bar">        <div class="activity-track">          <div class="activity-fill" style="height:${height}%"></div>        </div>        <div class="activity-value">${value}</div>        <div class="activity-label">${dayLabel.format(day)}</div>      </div>    `;
  }
).join("");
}
function getWeeklyScheduleDays(plan, sessionCount) {
  const source =    (Array.isArray(plan?.weeklyScheduleDays) && plan.weeklyScheduleDays) ||    (Array.isArray(plan?.trainingDaysOfWeek) && plan.trainingDaysOfWeek) ||    (Array.isArray(plan?.scheduleDays) && plan.scheduleDays) ||    [];
  if (source.length === sessionCount && source.every(day => Number.isFinite(Number(day)))) {
    return source.map(normalizeDayIndex);
  }
  return createWeeklyScheduleDays(sessionCount, Number(plan?.scheduleAnchorDay) || 0);
}
async function updateWeeklySchedule(planDoc, nextDays) {
  if (!planDoc?.id || !auth.currentUser) return;
  await updateDoc(doc(db, "users", auth.currentUser.uid, "workoutPlans", planDoc.id), {
    "plan.weeklyScheduleDays": nextDays,    "plan.scheduleAnchorDay": nextDays[0] ?? 0,    updatedAt: serverTimestamp()  }
);
}
function renderWeeklySchedule(planDoc) {
  const board = $("#weeklyScheduleBoard");
  const hint = $("#scheduleHint");
  const shiftButton = $("#shiftScheduleButton");
  const label = $("#scheduleLabel");
  const title = $("#scheduleTitle");
  if (!board) return;
  if (label) label.textContent = ui.scheduleLabel;
  if (title) title.textContent = ui.scheduleTitle;
  if (hint) hint.textContent = ui.scheduleHint;
  if (shiftButton) shiftButton.textContent = ui.scheduleShift;
  if (!planDoc) {
    board.innerHTML = `<div class="schedule-empty">${he ? "כדי להציג את לוח האימונים השבועי צריך ליצור או לבחור תוכנית פעילה." : "Create or activate a workout plan to populate the weekly schedule."}</div>`;
    if (shiftButton) shiftButton.disabled = true;
    if (shiftButton) shiftButton.onclick = null;
    return;
  }
  const plan = planDoc.plan || {
}
;
  const sessions = Array.isArray(plan.sessions) ? plan.sessions : [];
  const sessionCount = sessions.length;
  const scheduleDays = getWeeklyScheduleDays(plan, sessionCount);
  const labels = getWeekdayLabels(he);
  const today = new Date().getDay();
  if (shiftButton) {
    shiftButton.disabled = !sessionCount;
    shiftButton.onclick = async () => {
      if (!sessionCount) return;
      const nextDays = shiftWeeklyScheduleDays(scheduleDays, 1);
      try {
        await updateWeeklySchedule(planDoc, nextDays);
        planDoc.plan = {
          ...planDoc.plan,          weeklyScheduleDays: nextDays,          scheduleAnchorDay: nextDays[0] ?? 0        }
;
        renderWeeklySchedule(planDoc);
      }
 catch (error) {
        console.error("Could not shift the weekly schedule.", error);
        if (hint) {
          hint.textContent = he            ? "לא ניתן היה להזיז את השבוע. נסה שוב."            : "Could not shift the weekly schedule. Please try again.";
        }
      }
    }
;
  }
  const sessionByDay = new Map();
  scheduleDays.forEach((dayIndex, sessionIndex) => {
    sessionByDay.set(normalizeDayIndex(dayIndex), {
 sessionIndex, session: sessions[sessionIndex] }
);
  }
);
  board.innerHTML = labels.map((dayLabel, dayIndex) => {
    const entry = sessionByDay.get(dayIndex);
    const isToday = dayIndex === today;
    return `      <section class="schedule-day${isToday ? " is-today" : ""}" data-day-index="${dayIndex}">        <div class="schedule-day-label">          <span>${esc(dayLabel)}</span>          <span class="schedule-day-number">${dayIndex + 1}</span>        </div>        <div class="schedule-slot">          ${            entry              ? `<button type="button" class="schedule-workout" draggable="true" data-session-index="${entry.sessionIndex}" data-source-day="${dayIndex}">                  <span class="schedule-workout-name">${
esc(entry.session?.name || entry.session?.title || `Session ${entry.sessionIndex + 1}`)}
</span>                  <span class="schedule-workout-meta">${
esc(entry.session?.exercises?.length || 0)}
 ${
he ? "תרגילים" : "exercises"}
</span>                </button>`              : `<div class="schedule-rest"><span>☕</span>${
he ? "יום מנוחה" : "Rest day"}
</div>`          }        </div>      </section>    `;
  }
).join("");
  board.querySelectorAll(".schedule-workout").forEach(button => {
    button.addEventListener("dragstart", event => {
      const sessionIndex = Number(button.dataset.sessionIndex);
      const sourceDay = Number(button.dataset.sourceDay);
      button.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify({
 sessionIndex, sourceDay }
));
    }
);
    button.addEventListener("dragend", () => {
      button.classList.remove("is-dragging");
      board.querySelectorAll(".schedule-day").forEach(day => day.classList.remove("is-drop-target"));
    }
);
  }
);
  board.querySelectorAll(".schedule-day").forEach(day => {
    day.addEventListener("dragover", event => {
      event.preventDefault();
      day.classList.add("is-drop-target");
    }
);
    day.addEventListener("dragleave", () => day.classList.remove("is-drop-target"));
    day.addEventListener("drop", async event => {
      event.preventDefault();
      day.classList.remove("is-drop-target");
      let payload;
      try {
        payload = JSON.parse(event.dataTransfer.getData("text/plain"));
      }
 catch {
        return;
      }
      const sourceDay = normalizeDayIndex(payload?.sourceDay);
      const targetDay = normalizeDayIndex(day.dataset.dayIndex);
      const delta = ((targetDay - sourceDay) % 7 + 7) % 7;
      if (!delta && sourceDay === targetDay) return;
      const nextDays = shiftWeeklyScheduleDays(scheduleDays, delta);
      try {
        await updateWeeklySchedule(planDoc, nextDays);
        planDoc.plan = {
          ...planDoc.plan,          weeklyScheduleDays: nextDays,          scheduleAnchorDay: nextDays[0] ?? 0        }
;
        renderWeeklySchedule(planDoc);
      }
 catch (error) {
        console.error("Could not update the weekly schedule.", error);
        if (hint) {
          hint.textContent = he            ? "לא ניתן היה לעדכן את השבוע. נסה שוב."            : "Could not update the weekly schedule. Please try again.";
        }
      }
    }
);
  }
);
}
function initQuickFood() {
  const input = $("#quickFoodInput");
  const estimate = $("#quickFoodEstimate");
  const clear = $("#quickFoodClear");
  const result = $("#quickFoodResult");
  if (!input || !estimate || !clear || !result) return;
  const update = async () => {
    const value = input.value.trim();
    if (!value) {
      result.textContent = ui.quickFoodEmpty;
      result.classList.add("muted");
      return;
    }
    estimate.disabled = true;
    estimate.textContent = he ? "\u05de\u05d7\u05e9\u05d1..." : "Estimating...";
    result.textContent = he ? "\u05de\u05e2\u05e8\u05d9\u05da \u05e7\u05dc\u05d5\u05e8\u05d9\u05d5\u05ea \u05d5\u05de\u05d0\u05e7\u05e8\u05d5..." : "Estimating calories and macros...";
    result.classList.add("muted");
    try {
      const token = await getIdToken(auth.currentUser);
      const response = await fetch("/api/quick-food-estimate", {
        method: "POST",        headers: {
          "Content-Type": "application/json",          Authorization: `Bearer ${token}`        }
,        body: JSON.stringify({
          text: value,          language: he ? "he" : "en",          activeNutritionPlan: activeNutritionPlanForQuickFood        }
)      }
);
      const data = await response.json().catch(() => ({
}
));
      if (!response.ok) throw new Error(data.error || "Could not estimate food.");
      const totals = data.totals || {
}
;
      result.classList.remove("muted");
      result.innerHTML = `<strong>${Math.round(totals.calories || 0)} ${he ? "\u05e7\u05dc\u05d5\u05e8\u05d9\u05d5\u05ea" : "calories"}</strong><span>${Math.round(totals.proteinGrams || 0)}g ${he ? "\u05d7\u05dc\u05d1\u05d5\u05df" : "protein"} · ${Math.round(totals.carbsGrams || 0)}g ${he ? "\u05e4\u05d7\u05de\u05d9\u05de\u05d5\u05ea" : "carbs"} · ${Math.round(totals.fatGrams || 0)}g ${he ? "\u05e9\u05d5\u05de\u05df" : "fat"}</span><p>${quickFoodComparison(totals)}</p>`;
      return;
    }
 catch (error) {
      console.warn("Quick food estimate failed; using local fallback.", error.message);
    }
 finally {
      estimate.disabled = false;
      estimate.textContent = ui.quickFoodEstimate;
    }
    const totals = estimateFood(value);
    if (!totals) {
      result.textContent = he ? "לא הצלחתי לזהות כאן מאכלים מוכרים. נסה לכתוב קצת יותר פשוט או להפריד בפסיקים." : "I could not recognize common foods here. Try simpler items or separate them with commas.";
      result.classList.add("muted");
      return;
    }
    result.classList.remove("muted");
    result.innerHTML = `<strong>${Math.round(totals.cal)} ${he ? "קלוריות" : "calories"}</strong><span>${Math.round(totals.p)}g ${he ? "חלבון" : "protein"} · ${Math.round(totals.c)}g ${he ? "פחמימות" : "carbs"} · ${Math.round(totals.f)}g ${he ? "שומן" : "fat"}</span><p>${recommendation(totals.cal)}</p>`;
  }
;
  estimate.addEventListener("click", update);
  clear.addEventListener("click", () => {
    input.value = "";
    result.textContent = ui.quickFoodEmpty;
    result.classList.add("muted");
    input.focus();
  }
);
  input.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      update();
    }
  }
);
}
async function load(user) {
  const [userSnap, settingsSnap, logsSnap, weightSnap] = await Promise.all([    getDoc(doc(db, "users", user.uid)),    getDoc(doc(db, "users", user.uid, "settings", "main")),    getDocs(query(collection(db, "users", user.uid, "workoutLogs"), orderBy("completedAt", "desc"), limit(30))),    getDocs(query(collection(db, "users", user.uid, "weightEntries"), orderBy("date", "desc"), limit(1)))  ]);
  const root = userSnap.exists() ? userSnap.data() : {
}
;
  const settings = settingsSnap.exists() ? settingsSnap.data() : {
}
;
  const logs = logsSnap.docs.map(item => ({
 id: item.id, ...item.data() }
));
  const activeWorkoutId = root.activeWorkoutPlanId;
  const activeNutritionId = root.activeNutritionPlanId;
  const subscription = normalizeSubscription(root.subscription);
  $("#dashboardPlanBadge").textContent = subscription.plan.name;
  const [workoutSnap, nutritionSnap] = await Promise.all([    activeWorkoutId ? getDoc(doc(db, "users", user.uid, "workoutPlans", activeWorkoutId)) : null,    activeNutritionId ? getDoc(doc(db, "users", user.uid, "nutritionPlans", activeNutritionId)) : null  ]);
  const workout = workoutSnap?.exists() ? {
 id: workoutSnap.id, ...workoutSnap.data() }
 : null;
  const nutrition = nutritionSnap?.exists() ? {
 id: nutritionSnap.id, ...nutritionSnap.data() }
 : null;
  const name = (settings.displayName || user.displayName || "").trim().split(/\s+/)[0];
  $("#welcomeTitle").textContent = ui.welcome(name);
  const weekStart = startOfWeek();
  const weekly = logs.filter(log => {
    const date = timestampDate(log.completedAt) || timestampDate(log.startedAt);
    return date && date >= weekStart;
  }
).length;
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
  const progressMessage = $("#progressMessage");
  if (progressMessage) progressMessage.textContent = ui.progressMessage(logs.length);
  renderWeeklyActivity(logs);
  renderWorkout(workout, logs);
  renderWeeklySchedule(workout);
  renderNutrition(nutrition);
  renderRecent(logs[0]);
  $("#dashboardStatus").textContent = "";
  $("#dashboardContent").classList.remove("hidden");
  try {
    await loadWorkoutCheckins(user);
  } catch (checkinError) {
    console.warn("Workout check-in panel is temporarily unavailable:", checkinError);
  }
  showAthleteCorePromptIfNeeded(settings);
}
localize();
initMobileDrawer();
initDashboardSearch();
initQuickFood();
initLogout();
trackPageView({
 page: "dashboard" }
);
async function loadSocialUnread(user) {
  try {
    const response = await fetch("/api/social/conversations", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    if (!response.ok) return;
    const data = await response.json();
    const unread = (data.conversations || []).reduce((sum, item) => sum + Number(item.unreadCount || 0), 0);
    const badge = $("#socialUnreadBadge");
    if (!badge) return;
    badge.hidden = unread === 0;
    badge.textContent = String(Math.min(99, unread));
  } catch {
    // Social setup is isolated from the rest of the dashboard.
  }
}
// Product policy: the dashboard exposes saved plans and progress, so it's
// blocked until the signed-in user's email is verified. guardProtectedPage
// resolves auth state -> verifies sign-in -> verifies the email policy ->
// only then calls onAuthenticated to load private data (see
// verification-gate.js for the shared implementation, including the "I've
// verified my email" recovery flow that restores this exact page in place).
guardProtectedPage({
  onAuthenticated: async (user) => {
    try {
      await Promise.all([load(user), loadSocialUnread(user)]);
    } catch (error) {
      console.error(error);
      $("#dashboardStatus").textContent = ui.error;
      $("#dashboardStatus").classList.add("error");
    }
  }
});
