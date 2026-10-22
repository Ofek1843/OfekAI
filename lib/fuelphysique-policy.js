const BRAND_NAME = "FuelPhysique";
const COACH_CREATOR_RESPONSE = `The platform was created as an independent fitness-tech project by the team behind ${BRAND_NAME}.`;
const COACH_CREATOR_FOLLOWUP = "We do not currently publish personal information about individual team members. For business or support inquiries, please use the official contact page.";

const PUBLIC_ANALYTICS_EVENTS = new Set([
  "landing_page_view",
  "pricing_page_view",
  "signup_started",
  "guest_started",
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
  "generate_clicked",
  "signup_handoff",
  "builder_validation_error",
  "generation_failed",
  "plan_saved",
  "pricing_click",
  "nutrition_shopping_list",
  "seo_landing_view",
  "seo_cta_click",
  "nutrition_generated"
]);
const SEO_ANALYTICS_EVENTS = new Set(["seo_landing_view", "seo_cta_click", "nutrition_generated"]);
const SEO_FEATURE_VALUES = new Set(["features", "workout-plan-generator", "meal-plan-generator", "nutrition-tracker", "workout-tracker", "training-volume", "progress-tracking"]);
const ACTIVATION_ANALYTICS_EVENTS = new Set(["generate_clicked", "signup_handoff", "builder_validation_error", "generation_failed"]);
const ACTIVATION_BUILDERS = new Set(["workout", "nutrition"]);
const ACTIVATION_FAILURE_REASONS = new Set(["request_rejected", "rate_limited", "server_error", "network_or_timeout", "empty_result"]);
const CATEGORY_ONLY_ANALYTICS_EVENTS = new Set(["nutrition_shopping_list", "referral_link_opened"]);

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

function safeAnalyticsCampaign(value) {
  const raw = String(value ?? "");
  if (raw.includes("@")) return "";
  return normalizeAnalyticsValue(raw, 60).toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function safeAnalyticsReferrer(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.origin : "";
  } catch {
    return "";
  }
}

function sanitizeAnalyticsPayload(payload = {}) {
  const event = normalizeAnalyticsValue(payload.event, 40);
  if (!PUBLIC_ANALYTICS_EVENTS.has(event)) return null;
  const safeProperties = {};
  if (ACTIVATION_ANALYTICS_EVENTS.has(event) || CATEGORY_ONLY_ANALYTICS_EVENTS.has(event)) {
    const input = payload.properties || {};
    if (ACTIVATION_ANALYTICS_EVENTS.has(event)) {
      if (!ACTIVATION_BUILDERS.has(input.builder)) return null;
      safeProperties.builder = input.builder;
    }
    if (event === "signup_handoff" && ["google", "email_password"].includes(input.method)) safeProperties.method = input.method;
    if (event === "generation_failed" && ACTIVATION_FAILURE_REASONS.has(input.reason)) safeProperties.reason = input.reason;
    for (const key of ["campaign_source", "campaign_medium", "campaign_name"]) {
      const value = safeAnalyticsCampaign(input[key]);
      if (value) safeProperties[key] = value;
    }
    if (SEO_FEATURE_VALUES.has(input.seo_feature)) safeProperties.seo_feature = input.seo_feature;
    return {
      event,
      path: normalizeAnalyticsValue(payload.path, 120),
      title: normalizeAnalyticsValue(payload.title, 120),
      referrer: safeAnalyticsReferrer(payload.referrer),
      properties: safeProperties
    };
  }
  for (const [key, value] of Object.entries(payload.properties || {})) {
    const cleanKey = normalizeAnalyticsValue(key, 40);
    if (!cleanKey) continue;
    if (SEO_ANALYTICS_EVENTS.has(event)) {
      if (["feature", "seo_feature"].includes(cleanKey)) {
        if (SEO_FEATURE_VALUES.has(value)) safeProperties[cleanKey] = value;
      } else if (cleanKey === "placement") {
        if (["hero", "footer"].includes(value)) safeProperties[cleanKey] = value;
      } else if (cleanKey === "builder" && event === "nutrition_generated" && value === "nutrition") {
        safeProperties.builder = "nutrition";
      } else if (["campaign_source", "campaign_medium", "campaign_name"].includes(cleanKey)) {
        const campaignValue = safeAnalyticsCampaign(value);
        if (campaignValue) safeProperties[cleanKey] = campaignValue;
      }
      continue;
    }
    if (["campaign_source", "campaign_medium", "campaign_name"].includes(cleanKey)) {
      const campaignValue = safeAnalyticsCampaign(value);
      if (campaignValue) safeProperties[cleanKey] = campaignValue;
      continue;
    }
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
    referrer: safeAnalyticsReferrer(payload.referrer),
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
  const activeProSubscribers = users.filter(user => String(user?.subscription?.planId || "").toLowerCase() === "pro" && String(user?.subscription?.status || "").toLowerCase() === "active").length;
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
    activeProSubscribers,
    estimatedMonthlyRevenueIls: activeProSubscribers * 25,
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
