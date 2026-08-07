const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createPushRouter } = require("../lib/push-router");

async function serverFixture(run) {
  const calls = [];
  const service = {
    transport: { configured: true },
    async registerInstallation(uid, body) { calls.push(["register", uid, body]); return { status: "active" }; },
    async removeInstallation(uid, id) { calls.push(["remove", uid, id]); return { removed: true }; },
    async removeAllForUser(uid) { calls.push(["account", uid]); return { removed: 2 }; },
    async getPreferences(uid) { calls.push(["read", uid]); return { newMessages: true }; },
    async updatePreferences(uid, body) { calls.push(["update", uid, body]); return body; },
    async sendOwnTest(uid, id) { calls.push(["test", uid, id]); }
  };
  const app = express();
  app.use(express.json());
  app.use("/api/notifications", createPushRouter({
    authenticate: async (req, res) => {
      if (req.headers.authorization !== "Bearer valid") { res.status(401).json({ error: "Authentication required." }); return null; }
      return { uid: "authenticated-user" };
    },
    service,
    vapidPublicKey: "public-vapid-key",
    testEnabled: true
  }));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try { await run(`http://127.0.0.1:${server.address().port}`, calls); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test("all notification subscription/preference endpoints require authentication", async () => {
  await serverFixture(async base => {
    for (const [path, method] of [["/config", "GET"], ["/installations", "POST"], ["/installations/current", "DELETE"], ["/preferences", "GET"], ["/preferences", "PUT"], ["/account", "DELETE"], ["/test", "POST"]]) {
      const response = await fetch(`${base}/api/notifications${path}`, { method, headers: method === "GET" ? {} : { "Content-Type": "application/json" }, body: method === "GET" ? undefined : "{}" });
      assert.equal(response.status, 401, `${method} ${path}`);
    }
  });
});

test("registration uid and test recipient always come from authenticated identity", async () => {
  await serverFixture(async (base, calls) => {
    const response = await fetch(`${base}/api/notifications/installations`, {
      method: "POST", headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ uid: "forged-user", installationId: "device", fcmToken: "token" })
    });
    assert.equal(response.status, 201);
    const testResponse = await fetch(`${base}/api/notifications/test`, {
      method: "POST", headers: { Authorization: "Bearer valid", "Content-Type": "application/json" }, body: JSON.stringify({ uid: "victim", installationId: "own-device" })
    });
    assert.equal(testResponse.status, 204);
    assert.deepEqual(calls[0].slice(0, 2), ["register", "authenticated-user"]);
    assert.deepEqual(calls[1].slice(0, 2), ["test", "authenticated-user"]);
  });
});

test("there is no generic arbitrary-recipient push endpoint", async () => {
  await serverFixture(async base => {
    const response = await fetch(`${base}/api/notifications/send`, {
      method: "POST", headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipientUid: "victim", title: "spoof", body: "spam" })
    });
    assert.equal(response.status, 404);
  });
});

test("account cleanup removes all registrations/preferences for only authenticated user", async () => {
  await serverFixture(async (base, calls) => {
    const response = await fetch(`${base}/api/notifications/account`, { method: "DELETE", headers: { Authorization: "Bearer valid" } });
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [["account", "authenticated-user"]]);
  });
});
