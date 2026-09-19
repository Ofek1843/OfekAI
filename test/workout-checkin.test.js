const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_SNOOZES_PER_DAY,
  WorkoutCheckinService,
  checkinAvailable,
  checkinId,
  sessionsForWeekday,
  transitionCheckin
} = require("../lib/workout-checkin");

const UID = "member-1";
const PLAN_ID = "plan-1";
const DATE = "2026-09-19";
const TIMEZONE = "Asia/Jerusalem";
const SESSION = { id: "push-a", name: "Push A", exercises: [{ name: "Bench Press", targetMuscles: ["Chest"] }, { name: "Shoulder Press", targetMuscles: ["Shoulders"] }] };

function checkin(overrides = {}) {
  return {
    id: checkinId(UID, PLAN_ID, 0, DATE), uid: UID, planId: PLAN_ID, workoutId: "push-a", sessionIndex: 0,
    scheduledDate: DATE, workoutName: "Push A", targetMuscles: ["Chest", "Shoulders"], exerciseCount: 2,
    timezone: TIMEZONE, status: "pending", step: "initial", snoozeCount: 0, notificationCount: 0,
    createdAt: new Date("2026-09-19T16:00:00Z"), ...overrides
  };
}

function apply(current, action, now) {
  const result = transitionCheckin(current, action, now);
  return { ...current, ...result.patch };
}

function fakeStore({ schedule = [6], sessions = [SESSION], logs = [], activePlanId = PLAN_ID } = {}) {
  const records = new Map();
  return {
    records,
    context: { activePlanId, plan: activePlanId ? { id: activePlanId, plan: { weeklyScheduleDays: schedule, sessions } } : null, logs, timezone: TIMEZONE },
    async getWorkoutCheckinContext() { return this.context; },
    async ensureWorkoutCheckin(uid, id, data) {
      if (records.has(id)) return { created: false, checkin: records.get(id) };
      const value = { ...data, ownerUid: uid };
      records.set(id, value);
      return { created: true, checkin: value };
    },
    async listWorkoutCheckins() { return [...records.values()]; },
    async updateWorkoutCheckin(_uid, id, updater) {
      const before = records.get(id);
      if (!before) throw Object.assign(new Error("not found"), { status: 404, code: "checkin_not_found" });
      const after = updater({ ...before });
      records.set(id, after);
      return { before: { ...before }, after: { ...after } };
    },
    async touchWorkoutCheckin(uid, id, now) {
      return this.updateWorkoutCheckin(uid, id, current => ({ ...current, firstPromptedAt: current.firstPromptedAt || now, lastPromptedAt: now }));
    },
    async markTrackerCompletion(_uid, id, now) {
      const current = records.get(id);
      if (!current || !["pending", "snoozed"].includes(current.status)) return false;
      records.set(id, { ...current, status: "completed", step: "done", completionSource: "workout_tracker", completedAt: now });
      return true;
    }
  };
}

test("check-in identity is stable and scheduled sessions are exact, including multiple sessions on one day", () => {
  assert.equal(checkinId(UID, PLAN_ID, 0, DATE), checkinId(UID, PLAN_ID, 0, DATE));
  assert.notEqual(checkinId(UID, PLAN_ID, 0, DATE), checkinId(UID, PLAN_ID, 1, DATE));
  assert.deepEqual(sessionsForWeekday({ plan: { weeklyScheduleDays: [6, 6], sessions: [SESSION, { id: "legs-b", name: "Legs B" }] } }, 6).map(item => item.sessionId), ["push-a", "legs-b"]);
  assert.deepEqual(sessionsForWeekday({ plan: { weeklyScheduleDays: [2], sessions: [SESSION] } }, 6), []);
});

test("button-only completed flow records each signal and completes without a written note", () => {
  let value = checkin();
  value = apply(value, "completed", new Date("2026-09-19T16:00:00Z"));
  assert.equal(value.step, "completed_most");
  value = apply(value, "most_yes", new Date("2026-09-19T16:00:05Z"));
  value = apply(value, "difficulty_no", new Date("2026-09-19T16:00:08Z"));
  const finished = transitionCheckin(value, "pain_yes", new Date("2026-09-19T16:00:12Z"));
  assert.equal(finished.event, "workout_checkin_completed");
  assert.equal(finished.patch.status, "completed");
  assert.equal(finished.patch.completedAt.toISOString(), "2026-09-19T16:00:12.000Z");
  assert.equal(value.completedMostWorkout, true);
  assert.equal(value.feltUnusuallyDifficult, false);
  assert.equal(finished.patch.painOrDiscomfort, true);
});

test("Ask later snoozes by 90 minutes, never marks skipped, and is capped at two", () => {
  const firstTime = new Date("2026-09-19T16:00:00Z");
  let value = apply(checkin(), "later", firstTime);
  assert.equal(value.status, "snoozed");
  assert.equal(value.step, "initial");
  assert.equal(value.snoozeCount, 1);
  assert.equal(value.nextPromptAt.toISOString(), "2026-09-19T17:30:00.000Z");
  assert.equal(checkinAvailable(value, new Date("2026-09-19T17:29:59Z")), false);
  assert.equal(checkinAvailable(value, new Date("2026-09-19T17:30:00Z")), true);
  value = apply(value, "later", new Date("2026-09-19T17:30:00Z"));
  assert.equal(value.snoozeCount, MAX_SNOOZES_PER_DAY);
  assert.throws(() => transitionCheckin(value, "later", new Date("2026-09-19T19:00:00Z")), error => error.code === "checkin_answer_conflict");
  assert.equal(value.status, "snoozed");
});

test("snooze crossing local midnight does not send a next-day prompt and is available as a previous check-in", () => {
  const late = apply(checkin({ snoozeCount: 1 }), "later", new Date("2026-09-19T20:45:00Z"));
  assert.equal(late.nextPromptAt, null);
  assert.equal(checkinAvailable(late, new Date("2026-09-19T20:45:01Z")), false);
  assert.equal(checkinAvailable(late, new Date("2026-09-19T21:05:00Z")), true);
});

test("skipped flow distinguishes recovery and offers a one-off workout tomorrow without editing the weekly plan", () => {
  let value = apply(checkin(), "not_completed", new Date("2026-09-19T16:00:00Z"));
  value = apply(value, "recover_yes", new Date("2026-09-19T16:00:04Z"));
  const result = transitionCheckin(value, "tomorrow_yes", new Date("2026-09-19T16:30:00Z"));
  assert.equal(result.event, "workout_checkin_skipped");
  assert.equal(result.patch.status, "skipped");
  assert.equal(value.skippedForRecovery, true);
  assert.equal(result.patch.moveToTomorrowRequested, true);
  assert.equal(result.patch.makeupScheduledDate, "2026-09-20");
});

test("dashboard creates one check-in per scheduled session only after 19:00 local and is idempotent", async () => {
  const store = fakeStore({ schedule: [6, 6], sessions: [SESSION, { id: "legs-b", name: "Legs B" }] });
  const service = new WorkoutCheckinService({ store, logger: { info() {} } });
  const before = await service.dashboard(UID, TIMEZONE, new Date("2026-09-19T15:59:00Z"));
  assert.equal(before.checkins.length, 0);
  const first = await service.dashboard(UID, TIMEZONE, new Date("2026-09-19T16:00:00Z"));
  const second = await service.dashboard(UID, TIMEZONE, new Date("2026-09-19T16:01:00Z"));
  assert.equal(first.checkins.length, 2);
  assert.equal(first.createdIds.length, 2);
  assert.equal(second.createdIds.length, 0);
  assert.equal(store.records.size, 2);
});

test("rest day and workouts already completed in tracker create no redundant check-in", async () => {
  const restStore = fakeStore({ schedule: [1] });
  const service = new WorkoutCheckinService({ store: restStore, logger: { info() {} } });
  assert.equal((await service.dashboard(UID, TIMEZONE, new Date("2026-09-19T16:00:00Z"))).checkins.length, 0);
  const log = { workoutPlanId: PLAN_ID, sessionIndex: 0, completedAt: new Date("2026-09-19T15:00:00Z") };
  const completedStore = fakeStore({ logs: [log] });
  const completedService = new WorkoutCheckinService({ store: completedStore, logger: { info() {} } });
  assert.equal((await completedService.dashboard(UID, TIMEZONE, new Date("2026-09-19T16:00:00Z"))).checkins.length, 0);
  assert.equal(completedStore.records.size, 0);
});

test("a workout logged elsewhere resolves an already-open check-in without requesting feedback twice", async () => {
  const log = { workoutPlanId: PLAN_ID, sessionIndex: 0, completedAt: new Date("2026-09-19T15:00:00Z") };
  const store = fakeStore({ logs: [log] });
  const existing = checkin();
  store.records.set(existing.id, existing);
  const service = new WorkoutCheckinService({ store, logger: { info() {} } });
  const result = await service.dashboard(UID, TIMEZONE, new Date("2026-09-19T16:00:00Z"));
  assert.equal(store.records.get(existing.id).status, "completed");
  assert.equal(store.records.get(existing.id).completionSource, "workout_tracker");
  assert.equal(result.checkins.length, 1);
  assert.equal(result.checkins[0].status, "completed");
  assert.equal(result.checkins[0].answerAvailable, false);
});

test("same-day schedule changes expire stale pending prompts while historic unanswered prompts remain", async () => {
  const store = fakeStore({ schedule: [6] });
  store.records.set("old-record", checkin({ id: "old-record", planId: "replaced-plan" }));
  store.records.set("yesterday-record", checkin({ id: "yesterday-record", scheduledDate: "2026-09-18" }));
  const service = new WorkoutCheckinService({ store, logger: { info() {} } });
  const result = await service.dashboard(UID, TIMEZONE, new Date("2026-09-19T16:00:00Z"));
  assert.equal(store.records.get("old-record").status, "expired");
  assert.ok(result.checkins.some(item => item.id === "yesterday-record" && item.isPrevious));
  assert.equal(result.checkins[0].scheduledDate, DATE, "today's exact session stays ahead of older unresolved sessions");
});

test("scheduler pushes only the exact due workout and does not duplicate a prompt", async () => {
  const store = fakeStore();
  const sent = [];
  const service = new WorkoutCheckinService({
    store,
    pushService: { async sendWorkoutCheckin(payload) { sent.push(payload); return { sentCount: 1 }; } },
    logger: { info() {} }
  });
  const preference = { uid: UID, timezone: TIMEZONE, locale: "en" };
  const now = new Date("2026-09-19T16:05:00Z");
  const first = await service.sendDueNotifications({ preferences: [preference], now });
  const second = await service.sendDueNotifications({ preferences: [preference], now });
  assert.equal(first.sent, 1);
  assert.equal(second.due, 0);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].sessionName, "Push A");
  assert.equal(sent[0].scheduledDate, DATE);
});

test("answer rejects a second terminal answer and dashboard output serializes timestamps", async () => {
  const store = fakeStore();
  const value = checkin();
  store.records.set(value.id, value);
  const service = new WorkoutCheckinService({ store, logger: { info() {} } });
  const saved = await service.answer(UID, value.id, "completed", new Date("2026-09-19T16:00:00Z"));
  assert.equal(saved.step, "completed_most");
  await service.answer(UID, value.id, "most_no", new Date("2026-09-19T16:00:05Z"));
  await service.answer(UID, value.id, "difficulty_yes", new Date("2026-09-19T16:00:09Z"));
  await service.answer(UID, value.id, "pain_no", new Date("2026-09-19T16:00:14Z"));
  await assert.rejects(() => service.answer(UID, value.id, "completed", new Date("2026-09-19T16:01:00Z")), error => error.code === "checkin_answer_conflict");
});

test("completion analytics include prompt count and active response duration for future adaptation analysis", async () => {
  const store = fakeStore();
  const value = checkin({ firstPromptedAt: new Date("2026-09-19T15:00:00Z"), snoozeCount: 1 });
  store.records.set(value.id, value);
  const events = [];
  const service = new WorkoutCheckinService({ store, onAnalytics: (event, properties) => events.push({ event, properties }) });
  await service.answer(UID, value.id, "completed", new Date("2026-09-19T16:00:00Z"));
  await service.answer(UID, value.id, "most_yes", new Date("2026-09-19T16:00:04Z"));
  await service.answer(UID, value.id, "difficulty_no", new Date("2026-09-19T16:00:09Z"));
  await service.answer(UID, value.id, "pain_no", new Date("2026-09-19T16:00:14Z"));
  const completion = events.find(item => item.event === "workout_checkin_completed");
  assert.equal(completion.properties.prompt_number, 2);
  assert.equal(completion.properties.response_duration_seconds, 14);
  assert.equal(completion.properties.workout_id, "push-a");
});
