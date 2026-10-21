import { trackEvent } from "./analytics.js";

const page = document.body.dataset.seoFeature;
const allowed = new Set(["features", "workout-plan-generator", "meal-plan-generator", "nutrition-tracker", "workout-tracker", "training-volume", "progress-tracking"]);
if (allowed.has(page)) {
  trackEvent("seo_landing_view", { feature: page });
  document.querySelectorAll("[data-seo-cta]").forEach(link => {
    link.addEventListener("click", () => {
      trackEvent("seo_cta_click", { feature: page, placement: link.dataset.seoCta });
    });
  });
}
