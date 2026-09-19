"use strict";

require("dotenv").config();

const { FirestorePushStore } = require("../lib/push-store");
const { PushNotificationService } = require("../lib/push-service");
const { createFirebasePushTransport } = require("../lib/push-transport");
const { runWorkoutReminders } = require("../lib/workout-reminders");
const { WorkoutCheckinService } = require("../lib/workout-checkin");

async function main() {
  if (process.env.PUSH_NOTIFICATIONS_ENABLED !== "true") {
    console.log("[push-reminders] skipped: PUSH_NOTIFICATIONS_ENABLED is not true");
    return;
  }
  const store = new FirestorePushStore();
  const service = new PushNotificationService({ store, transport: createFirebasePushTransport() });
  const now = new Date();
  const workoutReminders = await runWorkoutReminders({ store, service, now });
  const checkins = new WorkoutCheckinService({ store, pushService: service });
  const preferences = await store.listReminderPreferences();
  const workoutCheckins = await checkins.sendDueNotifications({ preferences, now });
  console.log(JSON.stringify({ workoutReminders, workoutCheckins }));
}

main().catch((error) => {
  console.error("[push-reminders] failed", { code: error?.code || error?.name || "unknown" });
  process.exitCode = 1;
});
