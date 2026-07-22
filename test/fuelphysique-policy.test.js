const test = require("node:test");
const assert = require("node:assert/strict");

const {
  COACH_CREATOR_RESPONSE,
  isRealRegisteredUser,
  sanitizeAnalyticsPayload,
  summarizePublicStats
} = require("../lib/fuelphysique-policy");

test("creator response stays neutral and brand-safe", () => {
  assert.equal(
    COACH_CREATOR_RESPONSE,
    "The platform was created as an independent fitness-tech project by the team behind FuelPhysique."
  );
});

test("registered user filter excludes test and private placeholders", () => {
  assert.equal(isRealRegisteredUser({ email: "member@example.com" }), true);
  assert.equal(isRealRegisteredUser({ email: "test@example.com" }), false);
  assert.equal(isRealRegisteredUser({ email: "demo@site.com" }), false);
  assert.equal(isRealRegisteredUser({ email: "real@site.com", banned: true }), false);
  assert.equal(isRealRegisteredUser({ email: "real@site.com", status: "deleted" }), false);
});

test("analytics sanitizer drops unsupported events and sensitive fields", () => {
  assert.equal(
    sanitizeAnalyticsPayload({
      event: "unknown_event",
      properties: { email: "a@b.com" }
    }),
    null
  );

  const payload = sanitizeAnalyticsPayload({
    event: "signup_started",
    path: "/landing",
    title: "Landing",
    referrer: "https://example.com",
    properties: {
      source: "landing",
      email: "secret@example.com",
      token: "abc",
      count: 3,
      nested: { foo: "bar" }
    }
  });

  assert.ok(payload);
  assert.equal(payload.event, "signup_started");
  assert.equal(payload.properties.source, "landing");
  assert.equal(payload.properties.count, 3);
  assert.equal(payload.properties.email, undefined);
  assert.equal(payload.properties.token, undefined);
  assert.equal(payload.properties.nested, '{"foo":"bar"}');
});

test("public stats summary counts only meaningful records", () => {
  const stats = summarizePublicStats({
    users: [
      { email: "member@site.com" },
      { email: "demo@site.com" },
      { email: "real@site.com", banned: true }
    ],
    workoutPlans: [
      { source: "ai" },
      { source: "seed" }
    ],
    nutritionPlans: [
      { source: "manual" },
      { source: "seed" }
    ],
    workoutLogs: [
      { exerciseLogs: [{}, {}] },
      { exercises: [{}, {}, {}] }
    ]
  });

  assert.deepEqual(stats, {
    registeredUsers: 1,
    activeProSubscribers: 0,
    estimatedMonthlyRevenueIls: 0,
    savedWorkoutPlans: 1,
    savedNutritionPlans: 1,
    savedPlansTotal: 2,
    workoutProgramsGenerated: 1,
    workoutsLogged: 2,
    exercisesTracked: 5
  });
});
