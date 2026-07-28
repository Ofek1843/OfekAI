import { t, getLanguage, setLanguage } from "./i18n.js?v=20260722-3";
import { trackPageView, trackClick } from "./analytics.js";
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const LANDING_FALLBACKS = {
  en: {
    landingLogin: "Login",
    landingNavFeatures: "Features",
    landingNavResults: "Results",
    landingBadge: "EARLY ACCESS · FULL ACCESS FOR NOW",
    landingBetaNote: "Everything is currently unlocked during Early Access",
    landingEyebrow: "YOUR TRAINING, NUTRITION AND PROGRESS — CONNECTED",
    landingTitleFirst: "Build the body.",
    landingTitleSecond: "Keep the system.",
    landingDescriptionFirst:
      "FuelPhysique gives you personalized workout and nutrition plans, progress photos, body metrics, workout tracking and the ability to update your plan as your body and goals change.",
    landingDescriptionSecond:
      "Stop managing your fitness through scattered notes, screenshots and guesswork. Build a clear plan, follow it, measure what changes and adjust when needed.",
    landingDescriptionThird:
      "A practical fitness system that can reduce your dependence on scattered apps, generic plans and constant guesswork.",
    landingPreviewWorkoutLabel: "Workout plan",
    landingPreviewWorkoutTitle: "4-Day Muscle-Building Plan",
    landingPreviewWorkoutText: "Saved, editable and ready for the next session.",
    landingPreviewNutritionLabel: "Nutrition structure",
    landingPreviewNutritionTitle: "Calories, macros and preferences",
    landingPreviewNutritionText: "Built around your goal, schedule and food choices.",
    landingPreviewProgressLabel: "Progress loop",
    landingPreviewProgressTitle: "Photos · charts · workout history",
    landingPreviewProgressText: "Measure what changes and adjust the system.",
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
    landingNutritionChoice: "Nutrition plan",
    landingSystemKicker: "THE FULL PROCESS",
    landingSystemTitle: "One system for the full process",
    landingSystemDescription:
      "Every tool connects to the same goal: build a plan, follow it, save your history and make better adjustments over time.",
    landingCardProgramsTitle: "Personalized programs",
    landingCardProgramsText:
      "Build goal-based workout plans and replace or update them when your needs change.",
    landingCardNutritionTitle: "Nutrition with direction",
    landingCardNutritionText:
      "Create a nutrition structure that matches your target, preferences and training.",
    landingCardProgressTitle: "Track every change",
    landingCardProgressText:
      "Compare progress photos between dates and follow body measurements through clear charts.",
    landingCardHistoryTitle: "Learn what works",
    landingCardHistoryText:
      "Save plans, log workouts and use your history to make better adjustments.",
    landingResultsKicker: "REAL PROGRESS",
    landingResultsTitle: "Join users who are already building measurable progress",
    landingResultsDescription:
      "These transformations were documented while using FuelPhysique tools to manage workout plans, nutrition structure and progress tracking.",
    landingResultThreeMonths: "3 MONTHS",
    landingResultThreeTitle: "3-month transformation",
    landingResultTwoMonths: "2 MONTHS",
    landingResultTwoTitle: "2-month transformation",
    landingResultTracked: "Tracked while using FuelPhysique tools",
    landingBeforeLabel: "BEFORE",
    landingAfterLabel: "AFTER",
    landingCompareSliderLabel: "Compare before and after progress photos",
    landingCompareHint: "Drag to compare",
    landingResultsDisclaimer:
      "Individual results vary. Training consistency, nutrition, recovery and personal circumstances affect outcomes.",
    landingTransformationInviteKicker: "COMMUNITY RESULTS",
    landingTransformationInviteTitle:
      "Have you documented a body transformation while using FuelPhysique tools?",
    landingTransformationInviteText:
      "Want to be featured here? Submit your before-and-after photos and a few details about your process.",
    landingTransformationInviteButton: "Submit my transformation",
    landingTransformationInvitePrivacy:
      "Submissions stay private, pending manual review, and are never published automatically.",
    landingHowKicker: "HOW IT WORKS",
    landingHowTitle: "Build, follow, measure and adjust",
    landingStepBuild: "Build",
    landingStepBuildText: "Generate programs or create your own.",
    landingStepTrack: "Follow",
    landingStepTrackText: "Log workouts, nutrition and progress in one place.",
    landingStepImprove: "Measure and adjust",
    landingStepImproveText: "Use the data to refine the next session.",
    landingFinalTitle: "Build your plan. Track what changes.",
    landingFinalButton: "Start with FuelPhysique"
  },
  he: {
    landingLogin: "התחברות",
    landingNavFeatures: "יכולות",
    landingNavResults: "תוצאות",
    landingBadge: "גישה מוקדמת · כרגע הכל פתוח",
    landingBetaNote: "במהלך הגישה המוקדמת ניתן להשתמש כרגע בכל הכלים",
    landingEyebrow: "האימונים, התזונה וההתקדמות שלך — במערכת אחת",
    landingTitleFirst: "בונים את הגוף.",
    landingTitleSecond: "שומרים על השיטה.",
    landingDescriptionFirst:
      "FuelPhysique מרכז תוכניות אימון ותזונה מותאמות, תמונות התקדמות, מדדי גוף, מעקב אימונים ואפשרות לעדכן את התוכנית כשהמטרה והגוף משתנים.",
    landingDescriptionSecond:
      "במקום לנהל את התהליך דרך פתקים, צילומי מסך וניחושים — בונים תוכנית ברורה, מבצעים, מודדים ומשנים כשצריך.",
    landingDescriptionThird:
      "מערכת כושר פרקטית שיכולה לצמצם את התלות באפליקציות מפוזרות, תוכניות כלליות וניחושים.",
    landingPreviewWorkoutLabel: "תוכנית אימון",
    landingPreviewWorkoutTitle: "תוכנית לבניית שריר – 4 ימים בשבוע",
    landingPreviewWorkoutText: "שמורה, ניתנת לעריכה ומוכנה לאימון הבא.",
    landingPreviewNutritionLabel: "מסגרת תזונה",
    landingPreviewNutritionTitle: "קלוריות, מאקרו והעדפות",
    landingPreviewNutritionText: "בנויה סביב המטרה, הלו״ז והמאכלים שלך.",
    landingPreviewProgressLabel: "לולאת התקדמות",
    landingPreviewProgressTitle: "תמונות · גרפים · היסטוריית אימונים",
    landingPreviewProgressText: "מודדים מה משתנה ומשפרים את השיטה.",
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
    landingNutritionChoice: "תפריט תזונה",
    landingSystemKicker: "כל התהליך",
    landingSystemTitle: "מערכת אחת לכל התהליך",
    landingSystemDescription:
      "כל כלי מתחבר לאותה מטרה: לבנות תוכנית, לבצע אותה, לשמור היסטוריה ולבצע התאמות טובות יותר לאורך זמן.",
    landingCardProgramsTitle: "תוכניות מותאמות",
    landingCardProgramsText:
      "בנה תוכניות אימון לפי המטרה והחלף או עדכן אותן כשהצרכים משתנים.",
    landingCardNutritionTitle: "תזונה עם כיוון",
    landingCardNutritionText:
      "צור מסגרת תזונה שמתאימה למטרה, להעדפות ולאימונים שלך.",
    landingCardProgressTitle: "מעקב אחרי כל שינוי",
    landingCardProgressText:
      "השווה תמונות בין תאריכים ועקוב אחר מדדי הגוף באמצעות גרפים ברורים.",
    landingCardHistoryTitle: "להבין מה עובד",
    landingCardHistoryText:
      "שמור תוכניות, תעד אימונים והשתמש בהיסטוריה כדי לבצע התאמות טובות יותר.",
    landingResultsKicker: "התקדמות אמיתית",
    landingResultsTitle: "הצטרפו למשתמשים שכבר בונים התקדמות מדידה",
    landingResultsDescription:
      "השינויים תועדו במהלך שימוש בכלי FuelPhysique לניהול תוכניות אימון, מסגרת תזונה ומעקב התקדמות.",
    landingResultThreeMonths: "3 חודשים",
    landingResultThreeTitle: "שינוי במשך 3 חודשים",
    landingResultTwoMonths: "2 חודשים",
    landingResultTwoTitle: "שינוי במשך חודשיים",
    landingResultTracked: "תועד תוך שימוש בכלי FuelPhysique",
    landingBeforeLabel: "לפני",
    landingAfterLabel: "אחרי",
    landingCompareSliderLabel: "השוואה בין תמונת לפני ותמונת אחרי",
    landingCompareHint: "גררו להשוואה",
    landingResultsDisclaimer:
      "התוצאות משתנות מאדם לאדם ותלויות בעקביות, תזונה, התאוששות ונסיבות אישיות.",
    landingTransformationInviteKicker: "תוצאות מהקהילה",
    landingTransformationInviteTitle:
      "יש לכם שינוי בגוף שתיעדתם בעזרת כלי FuelPhysique?",
    landingTransformationInviteText:
      "רוצים שיופיע גם כאן? שלחו תמונות לפני ואחרי ופרטים קצרים על התהליך שעברתם.",
    landingTransformationInviteButton: "שליחת התהליך שלי",
    landingTransformationInvitePrivacy:
      "ההגשה נשארת פרטית, ממתינה לבדיקה ידנית, ולא מתפרסמת אוטומטית.",
    landingHowKicker: "איך זה עובד",
    landingHowTitle: "בונים, מבצעים, מודדים ומשפרים",
    landingStepBuild: "בונים",
    landingStepBuildText: "יוצרים תוכניות או בונים אותן בעצמכם.",
    landingStepTrack: "מבצעים",
    landingStepTrackText: "מתעדים אימונים, תזונה והתקדמות במקום אחד.",
    landingStepImprove: "מודדים ומשפרים",
    landingStepImproveText: "משתמשים בנתונים כדי לדייק את האימון הבא.",
    landingFinalTitle: "בנו תוכנית. עקבו אחרי מה שמשתנה.",
    landingFinalButton: "מתחילים עם FuelPhysique"
  }
};

let statsPollHandle = null;
let authStatePromise = null;

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
    const fallback = LANDING_FALLBACKS[language]?.[key] || LANDING_FALLBACKS.en[key];
    if (translation || fallback) {
      element.title = translation === key ? fallback : translation;
      element.setAttribute("aria-label", translation === key ? fallback : translation);
    }
  });
}

function toggleBuilderChooser() {
  const chooser = document.getElementById("builderChooser");
  if (!chooser) return;
  chooser.hidden = !chooser.hidden;
  trackClick("builder_open", { source: "landing" });
}

function wireBuilderChooser() {
  document.getElementById("buildProgramCta")?.addEventListener("click", (event) => {
    event.preventDefault();
    toggleBuilderChooser();
  });

  document.getElementById("finalBuildProgramCta")?.addEventListener("click", (event) => {
    event.preventDefault();
    document.getElementById("buildProgramCta")?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(toggleBuilderChooser, 250);
  });
}

function waitForAuthState() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (!authStatePromise) {
    authStatePromise = new Promise(resolve => {
      const unsubscribe = onAuthStateChanged(auth, user => {
        unsubscribe();
        resolve(user);
      });
    });
  }
  return authStatePromise;
}

function destinationFromAuthHref(href) {
  const url = new URL(href, window.location.href);
  const next = url.searchParams.get("next");
  if (next === "workout-builder.html") return "/workout-builder.html";
  if (next === "nutrition-builder.html") return "/nutrition-builder.html";
  return "/dashboard.html";
}

function wireSmartLoginLinks() {
  document.querySelectorAll('a[href^="auth.html"]').forEach((element) => {
    element.addEventListener("click", async (event) => {
      event.preventDefault();
      trackClick("signup", { source: "landing" });
      const user = await waitForAuthState();
      window.location.href = user
        ? destinationFromAuthHref(element.getAttribute("href"))
        : element.getAttribute("href");
    });
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

function wireRevealAnimations() {
  const targets = document.querySelectorAll(".reveal-on-scroll");
  if (!targets.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    targets.forEach((target) => target.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });

  targets.forEach((target) => observer.observe(target));
}

function wireComparisonSliders() {
  document.querySelectorAll("[data-comparison-slider]").forEach((slider) => {
    const range = slider.querySelector(".comparison-range");
    const after = slider.querySelector(".comparison-after");
    const handle = slider.querySelector(".comparison-handle");
    if (!range || !after || !handle) return;

    const update = () => {
      const value = `${range.value}%`;
      slider.style.setProperty("--comparison-position", value);
      after.style.setProperty("--comparison-position", value);
      handle.style.left = value;
    };

    const markInteracted = () => slider.classList.add("comparison-interacted");

    range.addEventListener("input", () => {
      markInteracted();
      update();
    });
    range.addEventListener("pointerdown", markInteracted);
    range.addEventListener("keydown", markInteracted);
    range.addEventListener("touchstart", markInteracted, { passive: true });
    update();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  translateLandingPage();
  wireBuilderChooser();
  wireSmartLoginLinks();
  trackReferralParams();
  wireRevealAnimations();
  wireComparisonSliders();
  loadPublicStats();

  if (statsPollHandle) clearInterval(statsPollHandle);
  statsPollHandle = setInterval(loadPublicStats, 8000);

  trackPageView({ page: "landing" });
  trackClick("landing_page_view", { source: "landing" });
});
