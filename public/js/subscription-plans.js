export const SUBSCRIPTION_PLANS = Object.freeze({
  free: Object.freeze({
    id: "free",
    name: "Free",
    monthlyPriceIls: 0,
    limits: Object.freeze({ workoutPlans: 1, nutritionPlans: 1, aiGenerationsMonthly: 5 }),
    features: Object.freeze([
      "One saved workout plan",
      "One saved nutrition plan",
      "Basic workout tracking",
      "Five AI generations each month"
    ])
  }),
  pro: Object.freeze({
    id: "pro",
    name: "FuelPhysique Pro",
    monthlyPriceIls: 25,
    limits: Object.freeze({ workoutPlans: 5, nutritionPlans: 5, aiGenerationsMonthly: 100 }),
    features: Object.freeze([
      "Up to five workout plans",
      "Up to five nutrition plans",
      "Full progress charts and analytics",
      "Advanced workout tracking",
      "AI coach memory and expanded usage",
      "Plan sharing and export",
      "Pro leaderboard badge"
    ])
  })
});

export function normalizeSubscription(data = {}) {
  const status = String(data.status || "free").toLowerCase();
  const isPaidStatus = ["active", "trialing"].includes(status);
  const planId = data.planId === "pro" && isPaidStatus ? "pro" : "free";
  return {
    planId,
    status: planId === "free" ? "free" : status,
    currentPeriodEnd: data.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
    plan: SUBSCRIPTION_PLANS[planId]
  };
}

export function hasEntitlement(subscription, entitlement) {
  return subscription?.planId === "pro" || entitlement === "core";
}
