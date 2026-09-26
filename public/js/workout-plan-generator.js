import { trackPageView, trackEvent } from "./analytics.js";

trackPageView({ page: "workout_plan_generator" });

document.querySelectorAll("[data-generator-cta]").forEach((link) => {
  link.addEventListener("click", () => {
    trackEvent("signup_started", { source: "workout_plan_generator" });
  });
});
