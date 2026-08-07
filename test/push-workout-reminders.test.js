const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  createWeeklyScheduleDays,
  isReminderDue,
  runWorkoutReminders,
  scheduledSession,
  workoutAlreadyCompleted,
  zonedDateParts
} = require("../lib/workout-reminders");

const PUSH_STORE_SOURCE = fs.readFileSync(path.join(__dirname, "../lib/push-store.js"), "utf8");

test("eligible reminder users are paginated so accounts beyond the first 500 are not starved", () => {
  assert.match(PUSH_STORE_SOURCE, /orderBy\(FieldPath\.documentId\(\)\)/);
  assert.match(PUSH_STORE_SOURCE, /query = query\.startAfter\(cursor\)/);
  assert.match(PUSH_STORE_SOURCE, /while \(true\)/);
});

function reminderFixture({
  now = new Date("2026-08-07T15:05:00Z"),
  timezone = "Asia/Jerusalem",
  reminderTime = "18:00",
  weeklyScheduleDays = [5],
  logs = [],
  context = true,
  locale = "en"
} = {}) {
  const preferences = [{ uid: "alice", notificationsEnabled: true, workoutReminders: true, eligibleForWorkoutReminders: true, reminderTime, timezone, locale }];
  const reminderContext = context ? {
    activePlanId: "plan-current",
    plan: { plan: { weeklyScheduleDays, sessions: [{ id: "full-body", name: locale === "he" ? "אימון גוף מלא" : "Full Body", exercises: [] }] } },
    logs
  } : null;
  const events = new Set();
  const sent = [];
  return {
    now,
    sent,
    logger: { info() {} },
    store: {
      async listReminderPreferences() { return preferences; },
      async getWorkoutReminderContext() { return reminderContext; }
    },
    service: {
      async sendWorkoutReminder(payload) {
        const key = `${payload.uid}:${payload.activePlanId}:${payload.sessionId}:${payload.localDate}`;
        if (events.has(key)) return { duplicate: true, sentCount: 0 };
        events.add(key);
        sent.push(payload);
        return { duplicate: false, sentCount: 1 };
      }
    }
  };
}

test("weekly schedule logic reuses spaced workout-day allocation", () => {
  assert.deepEqual(createWeeklyScheduleDays(3), [0, 2, 5]);
  assert.deepEqual(createWeeklyScheduleDays(1, 2), [2]);
  assert.deepEqual(createWeeklyScheduleDays(0), []);
});

test("scheduled workout today sends the actual active-plan session", async () => {
  const current = reminderFixture();
  const result = await runWorkoutReminders(current);
  assert.equal(result.sent, 1);
  assert.deepEqual(current.sent[0], {
    uid: "alice", activePlanId: "plan-current", sessionId: "full-body",
    sessionName: "Full Body", localDate: "2026-08-07", locale: "en"
  });
});

test("rest day and missing/deleted plan send nothing", async () => {
  const rest = reminderFixture({ weeklyScheduleDays: [1] });
  assert.equal((await runWorkoutReminders(rest)).sent, 0);
  const missing = reminderFixture({ context: false });
  assert.equal((await runWorkoutReminders(missing)).sent, 0);
});

test("already-completed current-plan session is suppressed", async () => {
  const current = reminderFixture({ logs: [{ workoutPlanId: "plan-current", sessionIndex: 0, completedAt: new Date("2026-08-07T07:00:00Z") }] });
  assert.equal((await runWorkoutReminders(current)).sent, 0);
  assert.equal(workoutAlreadyCompleted([{ workoutPlanId: "plan-current", sessionIndex: 0, completedAt: new Date("2026-08-07T07:00:00Z") }], "plan-current", 0, "2026-08-07", "Asia/Jerusalem"), true);
});

test("completion for an old active plan does not suppress the new active plan", async () => {
  const current = reminderFixture({ logs: [{ workoutPlanId: "plan-old", sessionIndex: 0, completedAt: new Date("2026-08-07T07:00:00Z") }] });
  assert.equal((await runWorkoutReminders(current)).sent, 1);
});

test("reminder before its time or outside the bounded due window is skipped", async () => {
  const before = reminderFixture({ now: new Date("2026-08-07T14:59:00Z") });
  assert.equal((await runWorkoutReminders(before)).sent, 0);
  const late = reminderFixture({ now: new Date("2026-08-07T15:21:00Z") });
  assert.equal((await runWorkoutReminders(late)).sent, 0);
  assert.equal(isReminderDue(new Date("2026-08-07T15:10:00Z"), "18:00", "Asia/Jerusalem", 20).due, true);
});

test("scheduler invoked twice sends at most one reminder for date/session", async () => {
  const current = reminderFixture();
  const first = await runWorkoutReminders(current);
  const second = await runWorkoutReminders(current);
  assert.equal(first.sent, 1);
  assert.equal(second.duplicates, 1);
  assert.equal(current.sent.length, 1);
});

test("Asia/Jerusalem and America/New_York resolve the user's 18:00 wall clock", () => {
  assert.equal(isReminderDue(new Date("2026-08-07T15:05:00Z"), "18:00", "Asia/Jerusalem").due, true);
  assert.equal(isReminderDue(new Date("2026-08-07T22:05:00Z"), "18:00", "America/New_York").due, true);
  assert.equal(zonedDateParts(new Date("2026-08-07T22:05:00Z"), "America/New_York").localDate, "2026-08-07");
});

test("DST boundaries preserve local time rather than a fixed UTC offset", () => {
  // New York changes from UTC-5 to UTC-4 on 2026-03-08.
  assert.equal(isReminderDue(new Date("2026-03-07T23:05:00Z"), "18:00", "America/New_York").due, true);
  assert.equal(isReminderDue(new Date("2026-03-08T22:05:00Z"), "18:00", "America/New_York").due, true);
  assert.equal(isReminderDue(new Date("2026-03-08T23:05:00Z"), "18:00", "America/New_York").due, false);
});

test("Hebrew and English locale/session names pass through without sender-language coupling", async () => {
  const hebrew = reminderFixture({ locale: "he" });
  await runWorkoutReminders(hebrew);
  assert.equal(hebrew.sent[0].locale, "he");
  assert.equal(hebrew.sent[0].sessionName, "אימון גוף מלא");
  const english = reminderFixture({ locale: "en" });
  await runWorkoutReminders(english);
  assert.equal(english.sent[0].locale, "en");
});

test("invalid persisted timezone falls back safely to UTC and is observable", async () => {
  const current = reminderFixture({ now: new Date("2026-08-07T18:05:00Z"), timezone: "Invalid/Zone" });
  const result = await runWorkoutReminders(current);
  assert.equal(result.timezoneFallbacks, 1);
  assert.equal(result.sent, 1);
  assert.equal(current.sent[0].localDate, "2026-08-07");
});

test("disabled reminders are excluded by the eligible preference query", async () => {
  const current = reminderFixture();
  current.store.listReminderPreferences = async () => [];
  const result = await runWorkoutReminders(current);
  assert.equal(result.considered, 0);
  assert.equal(result.sent, 0);
});

test("schedule resolver accepts canonical persisted session ids and indexes", () => {
  assert.deepEqual(scheduledSession({ plan: { weeklyScheduleDays: [5], sessions: [{ id: "push", name: "Push Day" }] } }, 5), { sessionIndex: 0, sessionId: "push", sessionName: "Push Day" });
  assert.equal(scheduledSession({ plan: { weeklyScheduleDays: [1], sessions: [{}] } }, 5), null);
});
