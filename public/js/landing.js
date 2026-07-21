import {
  t,
  getLanguage,
  setLanguage
} from "./i18n.js";

function translateLandingPage() {
  const language = setLanguage(getLanguage());

  document
    .querySelectorAll("[data-i18n]")
    .forEach((element) => {
      const key = element.dataset.i18n;

      element.textContent = t(language, key);
    });

  const marketingCopy = {
    en: {
      landingBadge: "YOUR AI-POWERED FITNESS SYSTEM",
      landingTitleFirst: "Your Fitness.",
      landingTitleSecond: "One Powerful Home.",
      landingDescriptionFirst: "Build workout and nutrition plans around your goals.",
      landingDescriptionSecond: "Track every workout, outdoor run, body metric and personal record.",
      landingDescriptionThird: "See your progress in clear charts and stay motivated with challenges and leaderboards.",
      landingDescriptionFourth: "Get evidence-based guidance from an AI coach that understands your journey."
    },
    he: {
      landingBadge: "מערכת הכושר האישית שלך, מבוססת AI",
      landingTitleFirst: "כל הכושר שלך.",
      landingTitleSecond: "במקום אחד.",
      landingDescriptionFirst: "בנה תוכניות אימון ותזונה שמתאימות בדיוק למטרות שלך.",
      landingDescriptionSecond: "עקוב אחרי כל אימון, ריצת GPS, מדד גוף ושיא אישי.",
      landingDescriptionThird: "ראה את ההתקדמות בגרפים ברורים ושמור על מוטיבציה עם אתגרים ולידרבורד.",
      landingDescriptionFourth: "קבל הכוונה מבוססת ראיות ממאמן AI שמכיר את הדרך שלך."
    }
  };

  const copy = marketingCopy[language];
  if (copy) {
    Object.entries(copy).forEach(([key, value]) => {
      const element = document.querySelector(`[data-i18n="${key}"]`);
      if (element) element.textContent = value;
    });
  }

  document.querySelector(".scroll")?.remove();
}

document.addEventListener(
  "DOMContentLoaded",
  translateLandingPage
);
