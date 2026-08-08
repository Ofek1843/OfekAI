const test = require("node:test");
const assert = require("node:assert/strict");
const { REPORT_REASONS, minimalSnapshot, normalizeReport, reportId } = require("../lib/social-report-domain");

test("reports accept only bounded server-supported target/reason combinations", () => {
  assert.ok(REPORT_REASONS.includes("harassment"));
  assert.deepEqual(normalizeReport({ targetType: "message", targetId: "thread:message", reason: "harassment", details: "x".repeat(800) }), {
    targetType: "message", targetId: "thread:message", reason: "harassment", details: "x".repeat(500)
  });
  assert.throws(() => normalizeReport({ targetType: "admin", targetId: "x", reason: "harassment" }), error => error.code === "invalid_report");
  assert.throws(() => normalizeReport({ targetType: "user", targetId: "x", reason: "anything" }), error => error.code === "invalid_report");
});

test("report identifiers deduplicate one reporter/target pair and snapshots do not retain full artifacts", () => {
  const report = normalizeReport({ targetType: "artifact", targetId: "artifact-1", reason: "spam" });
  assert.equal(reportId("user-a", report), reportId("user-a", report));
  assert.notEqual(reportId("user-a", report), reportId("user-b", report));
  const snapshot = minimalSnapshot({ targetType: "artifact", targetId: "artifact-1", value: { ownerUid: "owner", type: "nutrition", title: "Plan", snapshot: { meals: ["private"] } } });
  assert.deepEqual(snapshot, { targetType: "artifact", targetId: "artifact-1", ownerUid: "owner", type: "nutrition", title: "Plan" });
});

test("message reports retain an immutable reference, never a private message body", () => {
  const snapshot = minimalSnapshot({
    targetType: "message",
    targetId: "conversation-1:message-1",
    value: { senderUid: "sender", type: "text", text: "private message", attachment: { url: "private" } }
  });
  assert.deepEqual(snapshot, {
    targetType: "message",
    targetId: "conversation-1:message-1",
    senderUid: "sender",
    type: "text"
  });
  assert.doesNotMatch(JSON.stringify(snapshot), /private message|attachment|url/);
});

test("voice-message reports retain no audio asset identifier, URL, or recording metadata", () => {
  const snapshot = minimalSnapshot({
    targetType: "message",
    targetId: "conversation-1:voice-1",
    value: { senderUid: "sender", type: "voice", voice: { assetId: "private-asset", durationMs: 9000, url: "https://signed" } }
  });
  assert.deepEqual(snapshot, { targetType: "message", targetId: "conversation-1:voice-1", senderUid: "sender", type: "voice" });
  assert.doesNotMatch(JSON.stringify(snapshot), /private-asset|durationMs|https/);
});
