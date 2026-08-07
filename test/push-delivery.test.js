const test = require("node:test");
const assert = require("node:assert/strict");
const { getApps } = require("firebase-admin/app");
const { PushNotificationService } = require("../lib/push-service");
const { FirestorePushStore } = require("../lib/push-store");
const { hashIdentifier } = require("../lib/push-domain");

class FakePushStore {
  constructor() {
    this.authoritative = null;
    this.preferences = new Map();
    this.installations = new Map();
    this.claimed = new Set();
    this.completed = [];
    this.deactivated = [];
    this.updatedPreferences = null;
    this.registrations = [];
  }
  async getAuthoritativeMessage() { return this.authoritative; }
  async getRecipientLocale(uid) { return this.preferences.get(uid) || { notificationsEnabled: true, newMessages: true, sharedPlans: true, showMessagePreviews: true, locale: "en" }; }
  async getSenderName() { return "User A"; }
  async listActiveInstallations(uid) { return this.installations.get(uid) || []; }
  async claimEvent(id) { if (this.claimed.has(id)) return false; this.claimed.add(id); return true; }
  async completeEvent(id, result) { this.completed.push({ id, result }); }
  async deactivateInstallation(id, code) { this.deactivated.push({ id, code }); }
  async upsertInstallation(value) { this.registrations.push(value); return { installationHash: value.installationHash, status: "active" }; }
  async getPreferences(uid) { return this.preferences.get(uid) || { timezone: "UTC" }; }
  async updatePreferences(uid, value) { this.updatedPreferences = { uid, value }; return value; }
  async removeInstallation(uid, hash) { return { uid, hash }; }
  async removeAllForUser(uid) { return { uid, removed: 2 }; }
}

class FakeTransport {
  constructor() { this.configured = true; this.sent = []; }
  async send(installation, payload) {
    if (installation.fid === "stale") throw Object.assign(new Error("gone"), { code: "messaging/installation-id-not-registered" });
    this.sent.push({ installation, payload });
    return "mock-message-id";
  }
}

test("constructing the push store does not initialize Firebase Admin before first use", () => {
  const before = getApps().length;
  const store = new FirestorePushStore();
  assert.equal(getApps().length, before);
  assert.equal(store._db, null);
});

test("disabled push does not initialize or read the notification store after Social commits", async () => {
  const store = { async getAuthoritativeMessage() { throw new Error("must stay lazy"); } };
  const service = new PushNotificationService({
    store,
    transport: { configured: false },
    logger: { info() {}, error() {} }
  });
  assert.deepEqual(
    await service.notifySocialMessage({ senderUid: "a", conversationId: "c", messageId: "m" }),
    { configured: false, sentCount: 0, staleCount: 0 }
  );
});

function fixture({ message = {}, preferences = {}, installs = 1 } = {}) {
  const store = new FakePushStore();
  const transport = new FakeTransport();
  store.authoritative = {
    conversation: { id: "thread-a-b", participants: ["user-a", "user-b"] },
    message: { id: "message-1", type: "text", senderUid: "user-a", text: "Are you training today?", ...message }
  };
  store.preferences.set("user-b", { notificationsEnabled: true, newMessages: true, sharedPlans: true, showMessagePreviews: true, locale: "en", ...preferences });
  store.installations.set("user-b", Array.from({ length: installs }, (_, index) => ({ installationHash: `device-${index}`, fid: `fid-${index}` })));
  return { store, transport, service: new PushNotificationService({ store, transport, logger: { info() {}, error() {} } }) };
}

test("A: committed text sends one authoritative push to the recipient, never sender", async () => {
  const { service, transport } = fixture();
  const result = await service.notifySocialMessage({ senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-1" });
  assert.equal(result.sentCount, 1);
  assert.equal(transport.sent[0].payload.title, "User A");
  assert.equal(transport.sent[0].payload.body, "Are you training today?");
  assert.equal(transport.sent[0].payload.url, "/social.html?conversation=thread-a-b");
});

test("B: retrying a stable message event creates zero duplicate pushes", async () => {
  const { service, transport } = fixture();
  await service.notifySocialMessage({ senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-1" });
  const retry = await service.notifySocialMessage({ senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-1" });
  assert.equal(retry.duplicate, true);
  assert.equal(transport.sent.length, 1);
});

test("C/D: preview preference controls sanitized lock-screen message content", async () => {
  const visible = fixture({ message: { text: "<b>Hello</b>\u0000 friend" } });
  await visible.service.notifySocialMessage({ senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-1" });
  assert.equal(visible.transport.sent[0].payload.body, "bHello/b friend");
  assert.doesNotMatch(visible.transport.sent[0].payload.body, /[<>\u0000]/);

  const privateFixture = fixture({ preferences: { showMessagePreviews: false } });
  await privateFixture.service.notifySocialMessage({ senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-1" });
  assert.equal(privateFixture.transport.sent[0].payload.body, "Sent you a new message");
});

test("extremely long text is compact and does not expose identifiers", async () => {
  const { service, transport } = fixture({ message: { text: `${"x".repeat(300)} secret-id-should-be-truncated` } });
  await service.notifySocialMessage({ senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-1" });
  assert.ok(transport.sent[0].payload.body.length <= 120);
  assert.doesNotMatch(transport.sent[0].payload.body, /secret-id/);
});

test("E/F: workout and nutrition shares reveal type only and deep-link exact artifact", async () => {
  for (const [artifactType, type, phrase] of [["workout", "workout_share", "sent you a workout plan"], ["nutrition", "nutrition_share", "sent you a nutrition plan"]]) {
    const current = fixture({ message: { type: "artifact", artifactType, artifactId: `artifact-${artifactType}`, text: "private contents" } });
    await current.service.notifySocialMessage({ senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-1" });
    const payload = current.transport.sent[0].payload;
    assert.equal(payload.type, type);
    assert.match(payload.title, new RegExp(phrase));
    assert.equal(payload.body, "Tap to view the plan");
    assert.equal(payload.url, `/social.html?conversation=thread-a-b&artifact=artifact-${artifactType}`);
    assert.doesNotMatch(`${payload.title} ${payload.body}`, /private contents/);
  }
});

test("G/H: all active installations receive while stale registrations are deactivated", async () => {
  const current = fixture({ installs: 2 });
  current.store.installations.get("user-b")[1].fid = "stale";
  const result = await current.service.notifySocialMessage({ senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-1" });
  assert.equal(result.sentCount, 1);
  assert.equal(result.staleCount, 1);
  assert.deepEqual(current.store.deactivated, [{ id: "device-1", code: "messaging/installation-id-not-registered" }]);

  const both = fixture({ installs: 2 });
  await both.service.notifySocialMessage({ senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-1" });
  assert.equal(both.transport.sent.length, 2);
});

test("I: invalid authority and self-recipient forms never send", async () => {
  const invalid = fixture({ message: { senderUid: "somebody-else" } });
  assert.equal((await invalid.service.notifySocialMessage({ senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-1" })).skipped, "authority_failed");
  assert.equal(invalid.transport.sent.length, 0);

  const self = fixture();
  self.store.authoritative.conversation.participants = ["user-a", "user-a"];
  assert.equal((await self.service.notifySocialMessage({ senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-1" })).skipped, "self");
  assert.equal(self.transport.sent.length, 0);
});

test("J: global and category preferences suppress delivery", async () => {
  for (const preferences of [{ notificationsEnabled: false }, { newMessages: false }]) {
    const current = fixture({ preferences });
    await current.service.notifySocialMessage({ senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-1" });
    assert.equal(current.transport.sent.length, 0);
  }
  const share = fixture({ preferences: { sharedPlans: false }, message: { type: "artifact", artifactType: "workout", artifactId: "artifact" } });
  await share.service.notifySocialMessage({ senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-1" });
  assert.equal(share.transport.sent.length, 0);
});

test("registration is bound to authenticated uid, hashes local identifier, and keeps FID server-side", async () => {
  const current = fixture();
  const rawInstallationId = "device-installation-123456";
  await current.service.registerInstallation("user-b", {
    installationId: rawInstallationId,
    fid: "firebase-installation-id",
    locale: "he",
    timezone: "Asia/Jerusalem",
    capability: "granted",
    platform: "ios",
    displayMode: "standalone"
  });
  const stored = current.store.registrations[0];
  assert.equal(stored.uid, "user-b");
  assert.equal(stored.installationHash, hashIdentifier(rawInstallationId));
  assert.equal(stored.installationId, undefined);
  assert.equal(stored.fid, "firebase-installation-id");
});

test("partial preference updates stay partial and invalid timezones/times are rejected", async () => {
  const current = fixture();
  await current.service.updatePreferences("user-b", { newMessages: false });
  assert.deepEqual(current.store.updatedPreferences, { uid: "user-b", value: { newMessages: false } });
  assert.throws(() => current.service.updatePreferences("user-b", { timezone: "Mars/Olympus" }), error => error.code === "invalid_timezone");
  assert.throws(() => current.service.updatePreferences("user-b", { reminderTime: "25:99" }), error => error.code === "invalid_reminder_time");
  assert.throws(() => current.service.updatePreferences("user-b", { newMessages: "false" }), error => error.code === "invalid_preferences");
  assert.throws(() => current.service.updatePreferences("user-b", { locale: "fr" }), error => error.code === "invalid_locale");
  assert.throws(() => current.service.updatePreferences("user-b", { recipientUid: "victim" }), error => error.code === "invalid_preferences");
});

test("own-device test cannot target another authenticated user's installation", async () => {
  const current = fixture();
  await assert.rejects(current.service.sendOwnTest("user-a", "device-0", "en"), error => error.code === "installation_not_found");
});

test("reasonable 30-message burst stays bounded and deduplicated", async () => {
  const current = fixture();
  for (let index = 0; index < 30; index += 1) {
    current.store.authoritative.message.id = `message-${index}`;
    await current.service.notifySocialMessage({ senderUid: "user-a", conversationId: "thread-a-b", messageId: `message-${index}` });
  }
  assert.equal(current.transport.sent.length, 30);
  assert.equal(current.store.completed.length, 30);
});
