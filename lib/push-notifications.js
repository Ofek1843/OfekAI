// Server-side FCM push notifications. Requires a Firebase service account
// (Firebase Console -> Project settings -> Service accounts -> Generate new
// private key) set as the FIREBASE_SERVICE_ACCOUNT_JSON env var (the raw
// JSON contents, as a single-line string). Until that env var is set, every
// export here safely no-ops instead of throwing, matching how the rest of
// this app treats optional integrations (see imagekit-not-configured checks
// in server.js).
const admin = require("firebase-admin");

let app = null;
let initAttempted = false;

function initAdmin() {
  if (initAttempted) return app;
  initAttempted = true;

  const rawCredential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawCredential) {
    console.warn("Push notifications are not configured: set FIREBASE_SERVICE_ACCOUNT_JSON to enable them.");
    return null;
  }

  try {
    const serviceAccount = JSON.parse(rawCredential);
    app = admin.initializeApp(
      { credential: admin.credential.cert(serviceAccount) },
      "push-notifications"
    );
    return app;
  } catch (error) {
    console.error("Could not initialize Firebase Admin for push notifications:", error.message);
    return null;
  }
}

function isConfigured() {
  return Boolean(initAdmin());
}

function firestore() {
  const initializedApp = initAdmin();
  return initializedApp ? initializedApp.firestore() : null;
}

async function sendToTokens(tokens, { title, body, data = {}, url } = {}) {
  const initializedApp = initAdmin();
  if (!initializedApp || !tokens?.length) {
    return { successCount: 0, invalidTokens: [] };
  }

  const messaging = initializedApp.messaging();
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { ...data, url: url || "/dashboard.html" }
  });

  const invalidTokens = [];
  response.responses.forEach((result, index) => {
    if (!result.success) {
      const code = result.error?.code || "";
      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-argument")
      ) {
        invalidTokens.push(tokens[index]);
      }
    }
  });

  return { successCount: response.successCount, invalidTokens };
}

async function sendToUser(uid, payload) {
  const db = firestore();
  if (!db) return { ok: false, reason: "not_configured" };

  const userRef = db.collection("users").doc(uid);
  const snapshot = await userRef.get();
  const tokens = snapshot.exists ? snapshot.data().fcmTokens || [] : [];
  if (!tokens.length) return { ok: false, reason: "no_tokens" };

  const { successCount, invalidTokens } = await sendToTokens(tokens, payload);

  if (invalidTokens.length) {
    await userRef
      .update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens) })
      .catch(() => {});
  }

  return { ok: successCount > 0, successCount, prunedTokens: invalidTokens.length };
}

// Compares each exercise's best completed working-set weight in this
// workout against the user's stored personalRecords map, updates the map,
// and pushes a single combined "new PR" notification if anything improved.
// A user's first-ever time doing an exercise just records the baseline
// silently — everything would be a "PR" otherwise, which isn't meaningful.
async function checkAndRecordPersonalRecords(uid, exercises = []) {
  const db = firestore();
  if (!db) return { prs: [] };

  const userRef = db.collection("users").doc(uid);
  const snapshot = await userRef.get();
  const userData = snapshot.exists ? snapshot.data() : {};
  const tokens = userData.fcmTokens || [];
  const records = { ...(userData.personalRecords || {}) };
  const newPrs = [];

  for (const exercise of exercises) {
    const name = String(exercise?.name || "").trim();
    if (!name) continue;

    const bestSetWeight = (exercise.sets || [])
      .filter(set => set.completed && !set.warmup)
      .reduce((max, set) => Math.max(max, Number(set.weightKg) || 0), 0);
    if (bestSetWeight <= 0) continue;

    const previousBest = Number(records[name]?.weightKg) || 0;
    if (previousBest > 0 && bestSetWeight > previousBest) {
      newPrs.push({ name, weightKg: bestSetWeight, previousBest });
    }
    if (bestSetWeight > previousBest) {
      records[name] = { weightKg: bestSetWeight, achievedAt: new Date().toISOString() };
    }
  }

  if (Object.keys(records).length) {
    await userRef.set({ personalRecords: records }, { merge: true }).catch(() => {});
  }

  if (newPrs.length && tokens.length) {
    const title = "New personal record! \u{1F3C6}";
    const body = newPrs.length === 1
      ? `${newPrs[0].name}: ${newPrs[0].weightKg}kg (previous best ${newPrs[0].previousBest}kg)`
      : `${newPrs.length} new PRs today: ${newPrs.map(pr => `${pr.name} ${pr.weightKg}kg`).join(", ")}`;

    const { invalidTokens } = await sendToTokens(tokens, { title, body, url: "/workout-history.html" });
    if (invalidTokens.length) {
      await userRef
        .update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens) })
        .catch(() => {});
    }
  }

  return { prs: newPrs };
}

module.exports = { isConfigured, firestore, sendToTokens, sendToUser, checkAndRecordPersonalRecords, admin };
