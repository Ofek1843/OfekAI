const ANALYTICS_ENDPOINT = "/api/analytics/event";
const ALLOWED_EVENTS = new Set([
  "page_view",
  "signup",
  "signup_started",
  "signup_completed",
  "onboarding_completed",
  "builder_open",
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
  "nutrition_shopping_list"
]);

function cleanText(value, limit = 80) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

const CAMPAIGN_STORAGE_KEY = "fp_campaign_attribution_session_v1";
const CAMPAIGN_ATTRIBUTION_TTL_MS = 24 * 60 * 60 * 1000;

function cleanCampaignValue(value) {
  return String(value ?? "")
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

export function trackEvent(name, properties = {}) {
  if (typeof window === "undefined") return;
  const eventName = cleanText(name, 40);
  if (!ALLOWED_EVENTS.has(eventName)) return;

  const attribution = campaignAttribution();
  const eventProperties = { ...(properties || {}) };
  if (attribution.source) eventProperties.campaign_source = attribution.source;
  if (attribution.medium) eventProperties.campaign_medium = attribution.medium;
  if (attribution.name) eventProperties.campaign_name = attribution.name;

  const payload = {
    event: eventName,
    path: cleanText(window.location.pathname, 120),
    referrer: cleanText(document.referrer || "", 180),
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
      navigator.sendBeacon(
        ANALYTICS_ENDPOINT,
        new Blob([body], { type: "application/json" })
      );
      return;
    }
  } catch {
    // Fall back to fetch below.
  }

  fetch(ANALYTICS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "omit"
  }).catch(() => {});
}

export function trackPageView(properties = {}) {
  trackEvent("page_view", properties);
}

export function trackClick(name, properties = {}) {
  trackEvent(name, properties);
}
