const ANALYTICS_ENDPOINT = "/api/analytics/event";
const ALLOWED_EVENTS = new Set([
  "page_view",
  "signup",
  "builder_open",
  "plan_saved",
  "pricing_click",
  "nutrition_shopping_list"
]);

function cleanText(value, limit = 80) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

export function trackEvent(name, properties = {}) {
  if (typeof window === "undefined") return;
  const eventName = cleanText(name, 40);
  if (!ALLOWED_EVENTS.has(eventName)) return;

  const payload = {
    event: eventName,
    path: cleanText(window.location.pathname, 120),
    referrer: cleanText(document.referrer || "", 180),
    title: cleanText(document.title || "", 120),
    ts: Date.now(),
    properties: Object.fromEntries(
      Object.entries(properties || {}).map(([key, value]) => [
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
