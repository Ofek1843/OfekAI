"use strict";

const crypto = require("crypto");

const DEFAULT_PREFERENCES = Object.freeze({
  notificationsEnabled: true,
  newMessages: true,
  sharedPlans: true,
  friendActivity: true,
  workoutReminders: true,
  reminderTime: "18:00",
  // New installations keep lock-screen message text private unless the
  // member explicitly opts in. Stored explicit `true` values remain true.
  showMessagePreviews: false,
  locale: "en",
  timezone: "UTC"
});

function cleanString(value, maxLength) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeLocale(value) {
  return value === "he" ? "he" : "en";
}

function isValidTimezone(value) {
  const timezone = cleanString(value, 100);
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function normalizeTimezone(value, fallback = "UTC") {
  return isValidTimezone(value) ? cleanString(value, 100) : fallback;
}

function normalizeReminderTime(value) {
  const time = cleanString(value, 5);
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : DEFAULT_PREFERENCES.reminderTime;
}

function normalizePreferences(input = {}, previous = {}) {
  const merged = { ...DEFAULT_PREFERENCES, ...previous, ...input };
  const bool = (name) => merged[name] !== false;
  return {
    notificationsEnabled: bool("notificationsEnabled"),
    newMessages: bool("newMessages"),
    sharedPlans: bool("sharedPlans"),
    friendActivity: bool("friendActivity"),
    workoutReminders: bool("workoutReminders"),
    reminderTime: normalizeReminderTime(merged.reminderTime),
    showMessagePreviews: bool("showMessagePreviews"),
    locale: normalizeLocale(merged.locale),
    timezone: normalizeTimezone(merged.timezone),
    eligibleForWorkoutReminders: bool("notificationsEnabled") && bool("workoutReminders")
  };
}

function normalizeRegistration(uid, input = {}) {
  const installationId = cleanString(input.installationId, 160);
  const fid = cleanString(input.fid, 256);
  if (!uid || installationId.length < 16 || fid.length < 8) {
    const error = new Error("A valid notification installation is required.");
    error.status = 400;
    error.code = "invalid_push_registration";
    throw error;
  }
  if (!isValidTimezone(input.timezone)) {
    const error = new Error("A valid IANA timezone is required.");
    error.status = 400;
    error.code = "invalid_timezone";
    throw error;
  }
  return {
    uid,
    installationHash: hashIdentifier(installationId),
    fid,
    locale: normalizeLocale(input.locale),
    timezone: cleanString(input.timezone, 100),
    capability: ["granted", "denied", "default", "unsupported"].includes(input.capability) ? input.capability : "granted",
    platform: cleanString(input.platform, 40) || "web",
    displayMode: cleanString(input.displayMode, 24) || "browser"
  };
}

function hashIdentifier(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function plainTextPreview(value, maxLength = 120) {
  const text = cleanString(value, maxLength + 1).replace(/[<>]/g, "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

function notificationCopy({ type, locale, senderName, text, sessionName, eventSeed }) {
  const he = normalizeLocale(locale) === "he";
  const sender = plainTextPreview(senderName || (he ? "חבר/ה ב-FuelPhysique" : "FuelPhysique member"), 60);
  if (type === "message") {
    return { title: sender, body: plainTextPreview(text, 120) || (he ? "נשלחה אליך הודעה חדשה" : "Sent you a new message") };
  }
  if (type === "voice_message") {
    return { title: sender, body: he ? "הודעה קולית חדשה" : "Sent you a voice message" };
  }
  if (type === "workout_share") {
    return { title: he ? `${sender} שלח/ה לך תוכנית אימון` : `${sender} sent you a workout plan`, body: he ? "לחצו לצפייה בתוכנית" : "Tap to view the plan" };
  }
  if (type === "nutrition_share") {
    return { title: he ? `${sender} שלח/ה לך תוכנית תזונה` : `${sender} sent you a nutrition plan`, body: he ? "לחצו לצפייה בתוכנית" : "Tap to view the plan" };
  }
  if (type === "friend_request") {
    return { title: sender, body: he ? "שלח/ה לך בקשת חברות" : "Sent you a friend request" };
  }
  if (type === "friend_accepted") {
    return { title: sender, body: he ? "אישר/ה את בקשת החברות שלך" : "Accepted your friend request" };
  }
  const en = [
    "Show up. The rest gets easier.",
    "Consistency beats perfect sessions.",
    "Today's work builds tomorrow's progress.",
    "One good session moves you forward.",
    "Your workout is ready. Let's get it done."
  ];
  const hebrew = [
    "פשוט מתחילים. משם זה נהיה קל יותר.",
    "עקביות חשובה יותר מאימון מושלם.",
    "העבודה של היום בונה את ההתקדמות של מחר.",
    "אימון טוב אחד מקדם אותך.",
    "האימון שלך מוכן. בואו נתחיל."
  ];
  const pool = he ? hebrew : en;
  const index = parseInt(hashIdentifier(eventSeed || sessionName).slice(0, 8), 16) % pool.length;
  const name = plainTextPreview(sessionName || (he ? "האימון" : "Workout"), 80);
  return { title: he ? `${name} היום` : `${name} today`, body: pool[index] };
}

function isStaleMessagingError(error) {
  return [
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token",
    "messaging/installation-id-not-registered",
    "messaging/invalid-installation-id",
    "messaging/invalid-argument"
  ].includes(error?.code);
}

module.exports = {
  DEFAULT_PREFERENCES,
  cleanString,
  hashIdentifier,
  isStaleMessagingError,
  isValidTimezone,
  normalizeLocale,
  normalizePreferences,
  normalizeRegistration,
  normalizeReminderTime,
  normalizeTimezone,
  notificationCopy,
  plainTextPreview
};
