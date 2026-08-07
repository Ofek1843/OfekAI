"use strict";

require("dotenv").config();

const { FirestorePushStore } = require("../lib/push-store");
const { PushNotificationService } = require("../lib/push-service");
const { createFirebasePushTransport } = require("../lib/push-transport");
const { runWorkoutReminders } = require("../lib/workout-reminders");

async function main() {
  if (process.env.PUSH_NOTIFICATIONS_ENABLED !== "true") {
    console.log("[push-reminders] skipped: PUSH_NOTIFICATIONS_ENABLED is not true");
    return;
  }
  const store = new FirestorePushStore();
  const service = new PushNotificationService({ store, transport: createFirebasePushTransport() });
  const summary = await runWorkoutReminders({ store, service, now: new Date() });
  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error("[push-reminders] failed", { code: error?.code || error?.name || "unknown" });
  process.exitCode = 1;
});
