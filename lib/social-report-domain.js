"use strict";

const crypto = require("crypto");
const { cleanString, SocialError } = require("./social-domain");

const REPORT_REASONS = Object.freeze(["harassment", "hate", "sexual_content", "self_harm", "spam", "impersonation", "other"]);
const REPORT_TARGETS = Object.freeze(["user", "message", "artifact"]);

function normalizeReport(input = {}) {
  const targetType = cleanString(input.targetType, 20);
  const targetId = cleanString(input.targetId, 300);
  const reason = cleanString(input.reason, 40);
  if (!REPORT_TARGETS.includes(targetType) || !targetId || !REPORT_REASONS.includes(reason)) {
    throw new SocialError("invalid_report", "Choose a valid report target and reason.", 400);
  }
  return { targetType, targetId, reason, details: cleanString(input.details, 500) };
}

function reportId(uid, report) {
  return crypto.createHash("sha256").update(`${uid}|${report.targetType}|${report.targetId}`).digest("hex");
}

function minimalSnapshot({ targetType, targetId, value = {} } = {}) {
  const base = { targetType, targetId: cleanString(targetId, 300) };
  // A report must identify the immutable message without copying its private
  // body into a second collection. Authorized moderation tooling can resolve
  // the original only when it is genuinely needed.
  if (targetType === "message") return { ...base, senderUid: cleanString(value.senderUid, 128), type: cleanString(value.type, 30) };
  if (targetType === "artifact") return { ...base, ownerUid: cleanString(value.ownerUid, 128), type: cleanString(value.type, 40), title: cleanString(value.title, 100) };
  return { ...base, uid: cleanString(value.uid, 128), username: cleanString(value.username, 20), displayName: cleanString(value.displayName, 80) };
}

module.exports = { REPORT_REASONS, REPORT_TARGETS, minimalSnapshot, normalizeReport, reportId };
