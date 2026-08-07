const test = require("node:test");
const assert = require("node:assert/strict");
const { createFirebasePushTransport } = require("../lib/push-transport");

test("Firebase Admin transport targets current FIDs with compact data-only payloads", async () => {
  const calls = [];
  const transport = createFirebasePushTransport({ messaging: { async send(message) { calls.push(message); return "mock-id"; } } });
  await transport.send({ fid: "firebase-installation-id" }, { type: "message", title: "Ofek", body: "Hello", url: "/social.html?conversation=thread", eventId: "event" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].fid, "firebase-installation-id");
  assert.equal(calls[0].token, undefined);
  assert.equal(calls[0].notification, undefined);
  assert.equal(calls[0].data.type, "message");
  assert.equal(calls[0].webpush.headers.Urgency, "high");
  assert.ok(JSON.stringify(calls[0]).length < 4096);
});
