"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PushNotificationService } = require("../lib/push-service");
const { normalizePreferences, notificationCopy } = require("../lib/push-domain");

class FriendPushStore {
  constructor(request, preferences = {}, installs = 1) {
    this.request = request;
    this.preferences = { notificationsEnabled: true, friendActivity: true, locale: "en", ...preferences };
    this.installations = Array.from({ length: installs }, (_, index) => ({ installationHash: `device-${index}`, fid: `fid-${index}` }));
    this.claimed = new Set();
    this.sentEvents = [];
    this.deactivated = [];
  }
  async getAuthoritativeFriendRequest() { return this.request; }
  async getRecipientLocale() { return this.preferences; }
  async getSenderName() { return "Ofek"; }
  async listActiveInstallations() { return this.installations; }
  async claimEvent(id) { if (this.claimed.has(id)) return false; this.claimed.add(id); return true; }
  async completeEvent(id, result) { this.sentEvents.push({ id, result }); }
  async deactivateInstallation(id, code) { this.deactivated.push({ id, code }); }
}

class FriendTransport {
  constructor() { this.configured = true; this.sent = []; }
  async send(installation, payload) { this.sent.push({ installation, payload }); }
}

function serviceFor(request, preferences, installs) {
  const store = new FriendPushStore(request, preferences, installs);
  const transport = new FriendTransport();
  const service = new PushNotificationService({ store, transport, logger: { info() {}, error() {} } });
  return { store, transport, service };
}

test("friend request received push is authoritative, localized and idempotent", async () => {
  const current = serviceFor({ requestId: "alice__bob", fromUid: "alice", toUid: "bob", status: "pending" });
  const first = await current.service.notifyFriendRequestCreated({ actorUid: "alice", requestId: "alice__bob" });
  const retry = await current.service.notifyFriendRequestCreated({ actorUid: "alice", requestId: "alice__bob" });
  assert.equal(first.sentCount, 1);
  assert.equal(retry.duplicate, true);
  assert.equal(current.transport.sent.length, 1);
  assert.deepEqual(current.transport.sent[0].payload, {
    type: "friend_request",
    title: "Ofek",
    body: "Sent you a friend request",
    url: "/social.html?request=friends",
    eventId: current.transport.sent[0].payload.eventId,
    icon: "/favicon.svg",
    badge: "/favicon.svg"
  });
});

test("accepted friend request notifies the original requester on every active device", async () => {
  const current = serviceFor({ requestId: "alice__bob", fromUid: "alice", toUid: "bob", status: "accepted", respondedBy: "bob" }, { locale: "he" }, 2);
  const result = await current.service.notifyFriendRequestAccepted({ actorUid: "bob", requestId: "alice__bob" });
  assert.equal(result.sentCount, 2);
  assert.equal(current.transport.sent[0].payload.title, "Ofek");
  assert.equal(current.transport.sent[0].payload.body, "אישר/ה את בקשת החברות שלך");
  assert.equal(current.transport.sent[0].payload.url, "/social.html?request=friends");
});

test("friend activity preference suppresses friend request and acceptance pushes", async () => {
  const request = { requestId: "alice__bob", fromUid: "alice", toUid: "bob", status: "pending" };
  const current = serviceFor(request, { friendActivity: false });
  assert.equal((await current.service.notifyFriendRequestCreated({ actorUid: "alice", requestId: request.requestId })).skipped, "friend_activity_disabled");
  assert.equal(current.transport.sent.length, 0);
});

test("declined, cancelled, already-friends and forged friend events never send", async () => {
  for (const request of [
    { requestId: "a__b", fromUid: "a", toUid: "b", status: "declined" },
    { requestId: "a__b", fromUid: "a", toUid: "b", status: "cancelled" },
    { requestId: "a__b", fromUid: "a", toUid: "b", status: "accepted", respondedBy: "b" }
  ]) {
    const current = serviceFor(request);
    const result = request.status === "accepted"
      ? await current.service.notifyFriendRequestAccepted({ actorUid: "a", requestId: request.requestId })
      : await current.service.notifyFriendRequestCreated({ actorUid: "b", requestId: request.requestId });
    assert.equal(result.skipped, "authority_failed");
    assert.equal(current.transport.sent.length, 0);
  }
});

test("missing notification preference fields remain enabled for backward compatibility", () => {
  assert.equal(normalizePreferences({}).friendActivity, true);
  assert.deepEqual(notificationCopy({ type: "friend_request", locale: "en", senderName: "Ofek" }), { title: "Ofek", body: "Sent you a friend request" });
});

test("friend notification destination is an allowlisted logged-out deep link", () => {
  const resolver = fs.readFileSync(path.join(__dirname, "../public/js/auth-google-core.mjs"), "utf8");
  const service = fs.readFileSync(path.join(__dirname, "../lib/push-service.js"), "utf8");
  assert.match(resolver, /request !== "friends"/);
  assert.match(resolver, /return `\$\{url\.pathname\}\?request=friends`/);
  assert.match(service, /url: "\/social\.html\?request=friends"/);
});
