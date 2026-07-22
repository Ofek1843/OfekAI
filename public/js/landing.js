import { t, getLanguage, setLanguage } from "./i18n.js?v=20260722-3";
import { trackPageView, trackClick } from "./analytics.js";

const LANDING_FALLBACKS = {
  en: {
    landingLogin: "Login",
    landingBadge: "EARLY ACCESS · PUBLIC BETA",
    landingBetaNote: "Public beta · early access pricing",
    landingPrimaryCta: "Build my program",
    landingSecondaryCta: "Log in",
    landingFeatureWorkouts: "Workout plans",
    landingFeatureNutrition: "Nutrition",
    landingFeatureProgress: "Progress",
    landingFeatureCoach: "Coach",
    landingStatUsers: "Registered users",
    landingStatPlans: "Saved workout plans",
    landingChooserTitle: "What would you like to build?",
    landingWorkoutChoice: "Workout plan",
    landingNutritionChoice: "Nutrition plan"
  },
  he: {
    landingLogin: "התחברות",
    landingBadge: "גישה מוקדמת · בטא ציבורית",
    landingBetaNote: "בטא ציבורית · מחיר גישה מוקדמת",
    landingPrimaryCta: "בנו לי תוכנית",
    landingSecondaryCta: "כניסה",
    landingFeatureWorkouts: "תוכניות אימון",
    landingFeatureNutrition: "תזונה",
    landingFeatureProgress: "התקדמות",
    landingFeatureCoach: "מאמן",
    landingStatUsers: "משתמשים שנרשמו",
    landingStatPlans: "תוכניות אימון שנשמרו",
    landingChooserTitle: "מה תרצו לבנות?",
    landingWorkoutChoice: "תוכנית אימון",
    landingNutritionChoice: "תפריט תזונה"
  }
};

let statsPollHandle = null;

function formatCount(value, language) {
  return Number(value || 0).toLocaleString(language === "he" ? "he-IL" : "en-US");
}

function animateNumber(element, nextValue, language) {
  if (!element) return;
  const target = Math.max(0, Number(nextValue) || 0);
  const previous = Number(element.dataset.countValue || 0);
  if (previous === target) {
    element.textContent = formatCount(target, language);
    return;
  }

  const startedAt = performance.now();
  const duration = 900;

  element.dataset.countValue = String(target);
  element.closest(".landing-stat")?.classList.remove("count-bump");
  void element.offsetWidth;
  element.closest(".landing-stat")?.classList.add("count-bump");

  const tick = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(previous + ((target - previous) * eased));
    element.textContent = formatCount(current, language);
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
}

async function loadPublicStats() {
  try {
    const response = await fetch("/api/public-stats", {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) return;

    const stats = await response.json();
    const language = getLanguage();
    animateNumber(document.getElementById("publicRegisteredUsers"), stats.registeredUsers, language);
    animateNumber(document.getElementById("publicWorkoutPlans"), stats.savedWorkoutPlans, language);
  } catch {}
}

function translateLandingPage() {
  const language = setLanguage(getLanguage());

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    const translation = t(language, key);
    const fallback = LANDING_FALLBACKS[language]?.[key] || LANDING_FALLBACKS.en[key];
    element.textContent = translation === key ? (fallback || element.textContent) : translation;
  });

  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    const key = element.dataset.i18nTitle;
    const translation = t(language, key);
    if (translation) {
      element.title = translation;
    }
  });

  document.querySelector(".scroll")?.remove();
}

function wireBuilderChooser() {
  const chooser = document.getElementById("builderChooser");
  const trigger = document.getElementById("buildProgramCta");
  if (!chooser || !trigger) return;

  trigger.style.pointerEvents = "auto";
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    chooser.hidden = !chooser.hidden;
    trackClick("builder_open", { source: "landing" });
  });
}

function trackReferralParams() {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source");
  const utmMedium = params.get("utm_medium");
  const utmCampaign = params.get("utm_campaign");
  if (utmSource || utmMedium || utmCampaign) {
    trackClick("referral_link_opened", {
      source: utmSource || "unknown",
      medium: utmMedium || "unknown",
      campaign: utmCampaign || "unknown"
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  translateLandingPage();
  wireBuilderChooser();
  trackReferralParams();
  loadPublicStats();

  if (statsPollHandle) clearInterval(statsPollHandle);
  statsPollHandle = setInterval(loadPublicStats, 30000);

  trackPageView({ page: "landing" });
  trackClick("landing_page_view", { source: "landing" });

  document.querySelectorAll('a[href="auth.html"]').forEach((element) => {
    element.addEventListener("click", () => trackClick("signup", { source: "landing" }));
  });
});
