const test = require("node:test");
const assert = require("node:assert/strict");
const { toPublicSocialProof } = require("../lib/public-stats");

test("public social proof exposes only safe aggregate counters", () => {
  const result = toPublicSocialProof({
    registeredUsers: 15.8,
    savedWorkoutPlans: 8,
    activeProSubscribers: 4,
    estimatedMonthlyRevenueIls: 100,
    fallbackReason: "private diagnostic"
  });

  assert.deepEqual(result, { registeredUsers: 15, savedWorkoutPlans: 8 });
});

test("public social proof never renders a negative, fractional, or nonnumeric count", () => {
  assert.deepEqual(toPublicSocialProof({ registeredUsers: -4, savedWorkoutPlans: "not-a-number" }), {
    registeredUsers: 0,
    savedWorkoutPlans: 0
  });
});
