(() => {
  "use strict";

  const MEASUREMENT_ID = "G-1HG905SBV4";
  const STORAGE_KEY = "fp_analytics_consent_v1";
  const SCRIPT_URL = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  const DENIED = {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied"
  };
  const COPY = {
    en: {
      title: "Optional website analytics",
      description: "Help us understand visits and improve FuelPhysique with Google Analytics. It stays off unless you accept.",
      accept: "Accept analytics",
      decline: "Decline",
      privacy: "Privacy policy",
      settings: "Analytics preferences",
      statusOn: "Analytics is on for this browser. You can change your choice at any time.",
      statusOff: "Analytics is off for this browser. You can change your choice at any time.",
      change: "Change choice"
    },
    he: {
      title: "ניתוח שימוש אופציונלי באתר",
      description: "אפשר לעזור לנו להבין ביקורים ולשפר את FuelPhysique באמצעות Google Analytics. המדידה כבויה עד לאישור שלך.",
      accept: "אישור מדידה",
      decline: "לא עכשיו",
      privacy: "מדיניות פרטיות",
      settings: "העדפות מדידה",
      statusOn: "המדידה פעילה בדפדפן הזה. אפשר לשנות את הבחירה בכל עת.",
      statusOff: "המדידה כבויה בדפדפן הזה. אפשר לשנות את הבחירה בכל עת.",
      change: "שינוי הבחירה"
    }
  };

  let choice = null;
  let tagLoaded = false;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "granted" || stored === "denied") choice = stored;
  } catch {
    // Private browsing may block storage; the visitor can still decide for this page.
  }

  function safePageLocation() {
    const url = new URL(window.location.pathname, window.location.origin);
    const incoming = new URLSearchParams(window.location.search);
    for (const name of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const value = incoming.get(name);
      if (value && /^[a-zA-Z0-9_.-]{1,80}$/.test(value)) url.searchParams.set(name, value);
    }
    return url.href;
  }

  function safeReferrer() {
    if (!document.referrer) return "";
    try {
      const url = new URL(document.referrer);
      // Referrer paths can contain account or campaign-specific values.
      return /^https?:$/.test(url.protocol) ? url.origin : "";
    } catch {
      return "";
    }
  }

  function startAnalytics() {
    if (tagLoaded || choice !== "granted") return;
    tagLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", DENIED);
    window.gtag("consent", "update", { ...DENIED, analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", MEASUREMENT_ID, {
      page_location: safePageLocation(),
      page_referrer: safeReferrer(),
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });

    const script = document.createElement("script");
    script.async = true;
    script.src = SCRIPT_URL;
    document.head.append(script);
  }

  function language() {
    if (document.documentElement.lang === "he") return COPY.he;
    try { return localStorage.getItem("ofek-ai-language") === "he" ? COPY.he : COPY.en; }
    catch { return COPY.en; }
  }

  function setChoice(nextChoice) {
    choice = nextChoice;
    try { localStorage.setItem(STORAGE_KEY, nextChoice); } catch { /* session-only consent */ }
    document.getElementById("fp-analytics-consent")?.remove();
    if (nextChoice === "granted") {
      startAnalytics();
    } else if (tagLoaded) {
      // A previously loaded tag cannot be unloaded safely. Reload with the
      // persisted refusal so the next document never loads it.
      window.location.reload();
      return;
    }
    renderSettings();
  }

  function renderBanner() {
    if (choice || document.getElementById("fp-analytics-consent")) return;
    const copy = language();
    const aside = document.createElement("aside");
    aside.id = "fp-analytics-consent";
    aside.className = "fp-analytics-consent";
    aside.setAttribute("aria-label", copy.title);
    const title = document.createElement("strong");
    title.textContent = copy.title;
    const description = document.createElement("p");
    description.textContent = copy.description;
    const actions = document.createElement("div");
    actions.className = "fp-analytics-consent-actions";
    const accept = document.createElement("button");
    accept.type = "button";
    accept.textContent = copy.accept;
    accept.addEventListener("click", () => setChoice("granted"));
    const decline = document.createElement("button");
    decline.type = "button";
    decline.className = "fp-analytics-decline";
    decline.textContent = copy.decline;
    decline.addEventListener("click", () => setChoice("denied"));
    const privacy = document.createElement("a");
    privacy.href = "/privacy.html#analytics-choices";
    privacy.textContent = copy.privacy;
    actions.append(accept, decline, privacy);
    aside.append(title, description, actions);
    document.body.append(aside);
  }

  function renderSettings() {
    if (window.location.pathname !== "/privacy.html") return;
    const section = document.getElementById("use");
    if (!section) return;
    let controls = document.getElementById("analytics-choices");
    if (!controls) {
      controls = document.createElement("div");
      controls.id = "analytics-choices";
      controls.className = "fp-analytics-settings";
      section.append(controls);
    }
    const copy = language();
    controls.replaceChildren();
    const heading = document.createElement("h4");
    heading.textContent = copy.settings;
    const status = document.createElement("p");
    status.textContent = choice === "granted" ? copy.statusOn : copy.statusOff;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = copy.change;
    button.addEventListener("click", () => {
      choice = null;
      renderBanner();
    });
    controls.append(heading, status, button);
  }

  function init() {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/css/google-analytics-consent.css?v=20261017-1";
    document.head.append(stylesheet);
    if (choice === "granted") startAnalytics();
    renderSettings();
    // The Hebrew legal-page translator replaces section contents after our
    // deferred script runs. Reinsert the controls once translations finish.
    if (window.location.pathname === "/privacy.html") {
      window.addEventListener("load", renderSettings, { once: true });
    }
    renderBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
