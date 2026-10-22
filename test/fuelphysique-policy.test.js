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
      campaign_source: "TikTok!",
      campaign_medium: "organic social",
      campaign_name: "fall-launch-2026",
      email: "secret@example.com",
      token: "abc",
      count: 3,
      nested: { foo: "bar" }
    }
  });

  assert.ok(payload);
  assert.equal(payload.event, "signup_started");
  assert.equal(payload.properties.source, "landing");
  assert.equal(payload.properties.campaign_source, "tiktok");
  assert.equal(payload.properties.campaign_medium, "organicsocial");
  assert.equal(payload.properties.campaign_name, "fall-launch-2026");
  assert.equal(payload.properties.count, 3);
  assert.equal(payload.properties.email, undefined);
  assert.equal(payload.properties.token, undefined);
  assert.equal(payload.properties.nested, '{"foo":"bar"}');
});

test("guest entry is tracked separately from a real registration", () => {
  const event = sanitizeAnalyticsPayload({ event: "guest_started", path: "/dashboard.html", properties: { source: "dashboard", email: "private@example.com" } });
  assert.equal(event.event, "guest_started");
  assert.equal(event.properties.source, "dashboard");
  assert.equal(event.properties.email, undefined);
  assert.equal(summarizePublicStats({ users: [] }).registeredUsers, 0, "the guest event does not create a registered user");
});

test("activation events keep only fixed categories and campaign enums", () => {
  for (const event of ["generate_clicked", "signup_handoff", "builder_validation_error", "generation_failed"]) {
    const payload = sanitizeAnalyticsPayload({
      event,
      properties: {
        builder: "nutrition", method: "google", reason: "rate_limited",
        campaign_source: "Meta!", campaign_medium: "Paid Social", campaign_name: "Launch-26",
        email: "private@example.test", food: "private meal", error: "private error"
      }
    });
    assert.equal(payload.properties.builder, "nutrition");
    assert.equal(payload.properties.campaign_source, "meta");
    assert.equal(payload.properties.campaign_medium, "paidsocial");
    assert.equal(payload.properties.campaign_name, "launch-26");
    assert.equal(payload.properties.email, undefined);
    assert.equal(payload.properties.food, undefined);
    assert.equal(payload.properties.error, undefined);
    assert.equal(payload.properties.method, event === "signup_handoff" ? "google" : undefined);
    assert.equal(payload.properties.reason, event === "generation_failed" ? "rate_limited" : undefined);
  }
  assert.equal(sanitizeAnalyticsPayload({ event: "generate_clicked", properties: { builder: "unknown" } }), null);
  for (const event of ["nutrition_shopping_list", "referral_link_opened"]) {
    const safe = sanitizeAnalyticsPayload({ event, properties: { plan: "private meal", source: "private@example.test", campaign_source: "Meta" } });
    assert.deepEqual(safe.properties, { campaign_source: "meta" });
    assert.deepEqual(sanitizeAnalyticsPayload({ event, properties: { campaign_name: "private@example.test" } }).properties, {});
  }
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
