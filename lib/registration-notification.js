"use strict";

const { createHash } = require("node:crypto");

const DEFAULT_NEW_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 60 * 1000;

function isFreshAccount(createdAt, { nowMs = Date.now(), windowMs = DEFAULT_NEW_ACCOUNT_WINDOW_MS } = {}) {
  const timestamp = Number(createdAt);
  const ageMs = nowMs - timestamp;
  return Number.isFinite(timestamp)
    && ageMs >= -MAX_CLOCK_SKEW_MS
    && ageMs <= windowMs;
}

function registrationEventId(uid) {
  return createHash("sha256").update(String(uid || "")).digest("hex");
}

// Persist an at-most-once claim before calling Telegram. A Firestore
// transaction makes concurrent/retried acceptance requests idempotent, and
// this server-only collection survives Render restarts. The event document
// is deliberately inaccessible to clients under the default-deny rules.
async function claimSignupNotification({ db, uid, createdAt, nowMs, windowMs, serverTimestamp }) {
  if (!db || !uid || !isFreshAccount(createdAt, { nowMs, windowMs })) return false;

  const eventRef = db.collection("signupNotificationEvents").doc(registrationEventId(uid));
  return db.runTransaction(async (transaction) => {
    const existing = await transaction.get(eventRef);
    if (existing.exists) return false;
    transaction.create(eventRef, {
      claimedAt: serverTimestamp()
    });
    return true;
  });
}

module.exports = {
  DEFAULT_NEW_ACCOUNT_WINDOW_MS,
  isFreshAccount,
  registrationEventId,
  claimSignupNotification
};
