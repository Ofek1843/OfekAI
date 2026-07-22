const BRAND_NAME = "FuelPhysique";
const COACH_CREATOR_RESPONSE = `The platform was created as an independent fitness-tech project by the team behind ${BRAND_NAME}.`;
const COACH_CREATOR_FOLLOWUP = "We do not currently publish personal information about individual team members. For business or support inquiries, please use the official contact page.";

const PUBLIC_ANALYTICS_EVENTS = new Set([
  "landing_page_view",
  "pricing_page_view",
  "signup_started",
  "signup_completed",
  "onboarding_completed",
  "workout_generated",
  "workout_saved",
  "progress_chart_viewed",
  "upgrade_clicked",
  "checkout_started",
  "subscription_completed",
  "subscription_cancelled",
  "referral_link_opened",
  "page_view",
  "signup",
  "builder_open",
  "plan_saved",
  "pricing_click",
  "nutrition_shopping_list"
]);

function isRealRegisteredUser(doc = {}) {
  if (!doc || typeof doc !== "object") return false;
  if (doc.isDeleted || doc.deletedAt || doc.deleted || doc.banned || doc.blocked) return false;
  const status = String(doc.status || doc.accountStatus || "").toLowerCase();
  if (["deleted", "banned", "blocked", "test", "seed", "fake", "demo"].includes(status)) return false;
  const email = String(doc.email || "").toLowerCase().trim();
  if (!email) return true;
  if (/^(test|demo|seed|example)[^@]*@/i.test(email)) return false;
  if (email.includes("+test@") || email.includes("+seed@") || email.includes("+demo@")) return false;
  return true;
}

function normalizeAnalyticsValue(value, limit = 80) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function sanitizeAnalyticsPayload(payload = {}) {
  const event = normalizeAnalyticsValue(payload.event, 40);
  if (!PUBLIC_ANALYTICS_EVENTS.has(event)) return null;
  const safeProperties = {};
  for (const [key, value] of Object.entries(payload.properties || {})) {
    const cleanKey = normalizeAnalyticsValue(key, 40);
    if (!cleanKey) continue;
    if (/(email|name|phone|password|token|uid|photo|video|health|weight|height|age|goal|injury|medical|notes)/i.test(cleanKey)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safeProperties[cleanKey] = value;
    } else {
      safeProperties[cleanKey] = normalizeAnalyticsValue(JSON.stringify(value), 160);
    }
  }
  return {
    event,
    path: normalizeAnalyticsValue(payload.path, 120),
    title: normalizeAnalyticsValue(payload.title, 120),
    referrer: normalizeAnalyticsValue(payload.referrer, 180),
    properties: safeProperties
  };
}

function summarizePublicStats({
  users = [],
  workoutPlans = [],
  nutritionPlans = [],
  workoutLogs = []
} = {}) {
  const registeredUsers = users.filter(isRealRegisteredUser).length;
  const savedWorkoutPlans = workoutPlans.filter(plan => String(plan?.source || "").toLowerCase() !== "seed").length;
  const savedNutritionPlans = nutritionPlans.filter(plan => String(plan?.source || "").toLowerCase() !== "seed").length;
  const workoutProgramsGenerated = savedWorkoutPlans;
  const workoutsLogged = workoutLogs.filter(log => !log?.manuallyEntered || log?.createdAt).length;
  const exercisesTracked = workoutLogs.reduce((sum, log) => {
    const exercises = Array.isArray(log?.exerciseLogs) ? log.exerciseLogs : Array.isArray(log?.exercises) ? log.exercises : [];
    return sum + exercises.length;
  }, 0);

  return {
    registeredUsers,
    savedWorkoutPlans,
    savedNutritionPlans,
    savedPlansTotal: savedWorkoutPlans + savedNutritionPlans,
    workoutProgramsGenerated,
    workoutsLogged,
    exercisesTracked
  };
}

module.exports = {
  BRAND_NAME,
  COACH_CREATOR_RESPONSE,
  COACH_CREATOR_FOLLOWUP,
  PUBLIC_ANALYTICS_EVENTS,
  isRealRegisteredUser,
  sanitizeAnalyticsPayload,
  summarizePublicStats
};
