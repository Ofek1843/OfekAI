const ANALYTICS_ENDPOINT = "/api/analytics/event";
const ALLOWED_EVENTS = new Set([
  "page_view",
  "signup",
  "signup_started",
  "guest_started",
  "signup_completed",
  "onboarding_completed",
  "builder_open",
  "generate_clicked",
  "signup_handoff",
  "builder_validation_error",
  "generation_failed",
  "plan_saved",
  "pricing_click",
  "pricing_page_view",
  "landing_page_view",
  "workout_generated",
  "workout_saved",
  "progress_chart_viewed",
  "upgrade_clicked",
  "checkout_started",
  "subscription_completed",
  "subscription_cancelled",
  "referral_link_opened",
  "nutrition_shopping_list",
  "seo_landing_view",
  "seo_cta_click",
  "nutrition_generated"
]);

function cleanText(value, limit = 80) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

const CAMPAIGN_STORAGE_KEY = "fp_campaign_attribution_session_v1";
const CAMPAIGN_ATTRIBUTION_TTL_MS = 24 * 60 * 60 * 1000;
let signupConversionSent = false;
const SEO_FEATURES = new Set(["features", "workout-plan-generator", "meal-plan-generator", "nutrition-tracker", "workout-tracker", "training-volume", "progress-tracking"]);
const SEO_STORAGE_KEY = "fp_seo_feature_session_v1";
const SEO_FUNNEL_EVENTS = new Set(["seo_landing_view", "seo_cta_click", "signup_started", "workout_generated", "nutrition_generated"]);
const ACTIVATION_FUNNEL_EVENTS = new Set(["landing_page_view", "builder_open", "generate_clicked", "signup_handoff", "builder_validation_error", "generation_failed", "plan_saved"]);
const BUILDER_VALUES = new Set(["workout", "nutrition"]);
const FAILURE_REASONS = new Set(["request_rejected", "rate_limited", "server_error", "network_or_timeout", "empty_result"]);
const signupStartsSent = new Set();
const SIGNUP_START_STORAGE_KEY = "fp_signup_start_session_v1";
const SIGNUP_START_TTL_MS = 30 * 60 * 1000;

function safeReferrer() {
  try {
    const url = new URL(document.referrer);
    return /^https?:$/.test(url.protocol) ? url.origin : "";
  } catch {
    return "";
  }
}

function previouslyStartedSignup(method) {
  if (signupStartsSent.has(method)) return true;
  signupStartsSent.add(method);
  try {
    const prior = JSON.parse(window.sessionStorage.getItem(SIGNUP_START_STORAGE_KEY) || "null");
    const age = Date.now() - Number(prior?.capturedAt);
    window.sessionStorage.setItem(SIGNUP_START_STORAGE_KEY, JSON.stringify({ method, capturedAt: Date.now() }));
    return prior?.method === method && age >= 0 && age < SIGNUP_START_TTL_MS;
  } catch {
    return false;
  }
}

function seoAttribution(eventName, properties) {
  try {
    if (eventName === "seo_cta_click" && SEO_FEATURES.has(properties.feature)) {
      window.sessionStorage.setItem(SEO_STORAGE_KEY, JSON.stringify({ feature: properties.feature, capturedAt: Date.now() }));
    }
    const stored = JSON.parse(window.sessionStorage.getItem(SEO_STORAGE_KEY) || "null");
    const age = Date.now() - Number(stored?.capturedAt);
    if (SEO_FEATURES.has(stored?.feature) && age >= 0 && age <= CAMPAIGN_ATTRIBUTION_TTL_MS) return stored.feature;
  } catch {
    // Storage is optional. Navigation and generation must still succeed.
  }
  return null;
}

function cleanCampaignValue(value) {
  const raw = String(value ?? "");
  if (raw.includes("@")) return "";
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 60);
}

function campaignAttribution() {
  if (typeof window === "undefined") return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const incoming = {
      source: cleanCampaignValue(params.get("utm_source")),
      medium: cleanCampaignValue(params.get("utm_medium")),
      name: cleanCampaignValue(params.get("utm_campaign"))
    };
    const hasIncoming = Object.values(incoming).some(Boolean);
    const stored = JSON.parse(window.sessionStorage.getItem(CAMPAIGN_STORAGE_KEY) || "null");
    const storedIsFresh = stored?.capturedAt
      && Date.now() - Number(stored.capturedAt) <= CAMPAIGN_ATTRIBUTION_TTL_MS;

    if (hasIncoming) {
      window.sessionStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify({
        ...incoming,
        capturedAt: Date.now()
      }));
      return incoming;
    }
    if (storedIsFresh) {
      return {
        source: cleanCampaignValue(stored.source),
        medium: cleanCampaignValue(stored.medium),
        name: cleanCampaignValue(stored.name)
      };
    }
  } catch {
    // Attribution is optional; analytics must never block the app.
  }
  return {};
}

// Only the current landing view may be emitted on a late opt-in. Never queue
// interactions, signup events or builder answers from before consent.
let currentLandingView = null;
const sentLandingViews = new Set();
function sendGaEvent(name, properties) {
  const isLandingView = name === "seo_landing_view" || name === "landing_page_view";
  const key = `${window.location.pathname}:${name}`;
  if (isLandingView) {
    currentLandingView = { name, properties, path: window.location.pathname };
    if (sentLandingViews.has(key)) return;
  }
  if (window.fpAnalyticsConsent === "denied") return;
  if (typeof window.gtag !== "function") return;
  try {
    window.gtag("event", name, properties);
    if (isLandingView) sentLandingViews.add(key);
  } catch {
    // Analytics must never interrupt signup, navigation, or generation.
  }
}

if (typeof window !== "undefined") {
  window.addEventListener?.("fp:analytics-ready", () => {
    if (currentLandingView?.path === window.location.pathname) {
      sendGaEvent(currentLandingView.name, currentLandingView.properties);
    }
  });
}

export function trackEvent(name, properties = {}) {
  if (typeof window === "undefined") return;
  const eventName = cleanText(name, 40);
  if (!ALLOWED_EVENTS.has(eventName)) return;
  let eventProperties = { ...(properties || {}) };
  // Feature events use a fixed schema even for our first-party endpoint.
  // Future callers must not accidentally attach food, health or identity data.
  if (["seo_landing_view", "seo_cta_click", "nutrition_generated"].includes(eventName)) {
    eventProperties = {
      ...(SEO_FEATURES.has(eventProperties.feature) ? { feature: eventProperties.feature } : {}),
      ...(["hero", "footer"].includes(eventProperties.placement) ? { placement: eventProperties.placement } : {}),
      ...(eventName === "nutrition_generated" ? { builder: "nutrition" } : {})
    };
  }
  // New activation events have an enum-only contract. Never forward form
  // values, validation text, HTTP bodies, or account data to either sink.
  if (["generate_clicked", "signup_handoff", "builder_validation_error", "generation_failed"].includes(eventName)) {
    eventProperties = {
      ...(BUILDER_VALUES.has(eventProperties.builder) ? { builder: eventProperties.builder } : {}),
      ...(eventName === "signup_handoff" && ["google", "email_password"].includes(eventProperties.method) ? { method: eventProperties.method } : {}),
      ...(eventName === "generation_failed" && FAILURE_REASONS.has(eventProperties.reason) ? { reason: eventProperties.reason } : {})
    };
    if (!eventProperties.builder) return;
  }
  if (["nutrition_shopping_list", "referral_link_opened"].includes(eventName)) {
    eventProperties = {};
  }
  if (eventName === "signup_started") {
    const method = ["google", "email_password"].includes(eventProperties.method) ? eventProperties.method : "unknown";
    if (previouslyStartedSignup(method)) return;
  }
  const seoFeature = seoAttribution(eventName, eventProperties);
  if (seoFeature) eventProperties.seo_feature = seoFeature;
  if (eventName === "signup_completed") {
    if (signupConversionSent) return;
    signupConversionSent = true;
    // The consent loader defines gtag only after the visitor opts into GA.
    // Do not send email, UID, name, or any other account identifier.
    if (typeof window.gtag === "function") {
      const method = ["google", "email_password"].includes(eventProperties.method)
        ? eventProperties.method
        : "unknown";
      sendGaEvent("sign_up", { method, ...(seoFeature ? { seo_feature: seoFeature } : {}) });
    }
  }
  // Reuse the consent-controlled tag; never forward arbitrary event properties.
  // In particular, workout goals, food descriptions and body metrics stay out.
  if (SEO_FUNNEL_EVENTS.has(eventName)) {
    const safe = {};
    if (seoFeature) safe.seo_feature = seoFeature;
    if (SEO_FEATURES.has(eventProperties.feature)) safe.feature = eventProperties.feature;
    if (["hero", "footer"].includes(eventProperties.placement)) safe.placement = eventProperties.placement;
    if (["google", "email_password"].includes(eventProperties.method)) safe.method = eventProperties.method;
    sendGaEvent(eventName, safe);
  }
  if (ACTIVATION_FUNNEL_EVENTS.has(eventName)) {
    const builder = BUILDER_VALUES.has(eventProperties.builder) ? eventProperties.builder : null;
    const type = BUILDER_VALUES.has(eventProperties.type) ? eventProperties.type : null;
    // The landing's chooser also uses builder_open, but opening a chooser is
    // not the same stage as opening an actual workout or nutrition builder.
    if (eventName !== "builder_open" || builder) {
      const safe = {};
      if (builder) safe.builder = builder;
      if (type) safe.type = type;
      if (eventName === "signup_handoff" && ["google", "email_password"].includes(eventProperties.method)) safe.method = eventProperties.method;
      if (eventName === "generation_failed" && FAILURE_REASONS.has(eventProperties.reason)) safe.reason = eventProperties.reason;
      if (seoFeature) safe.seo_feature = seoFeature;
      sendGaEvent(eventName, safe);
    }
  }

  const attribution = campaignAttribution();
  if (attribution.source) eventProperties.campaign_source = attribution.source;
  if (attribution.medium) eventProperties.campaign_medium = attribution.medium;
  if (attribution.name) eventProperties.campaign_name = attribution.name;

  const payload = {
    event: eventName,
    path: cleanText(window.location.pathname, 120),
    referrer: safeReferrer(),
    title: cleanText(document.title || "", 120),
    ts: Date.now(),
    properties: Object.fromEntries(
      Object.entries(eventProperties).map(([key, value]) => [
        cleanText(key, 40),
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? value
          : cleanText(JSON.stringify(value), 160)
      ])
    )
  };

  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const queued = navigator.sendBeacon(
        ANALYTICS_ENDPOINT,
        new Blob([body], { type: "application/json" })
      );
      if (queued) return;
    }
  } catch {
    // Fall back to fetch below.
  }

  try {
    fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit"
    }).catch(() => {});
  } catch {
    // Synchronous transport failures must not affect a form submission.
  }
}

export function generationFailureCategory(status = 0) {
  if (status === 429) return "rate_limited";
  if (status >= 400 && status < 500) return "request_rejected";
  if (status >= 500) return "server_error";
  return "network_or_timeout";
}

export function trackPageView(properties = {}) {
  trackEvent("page_view", properties);
}

export function trackClick(name, properties = {}) {
  trackEvent(name, properties);
}
