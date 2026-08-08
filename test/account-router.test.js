const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createAccountRouter } = require("../lib/account-router");

async function fixture(run) {
  const calls = [];
  const service = {
    async exportAccount(uid) { calls.push(["export", uid]); return { uid, schemaVersion: 1 }; },
    async deleteAccount(uid, input) { calls.push(["delete", uid, input]); return { deleted: true }; }
  };
  const app = express();
  app.use(express.json());
  app.use("/api/account", createAccountRouter({
    authenticate: async (req, res) => {
      if (req.headers.authorization !== "Bearer valid") { res.status(401).json({ error: "Authentication required." }); return null; }
      return { uid: "authenticated-user", authTime: Number(req.headers["x-auth-time"] || Math.floor(Date.now() / 1000)) };
    }, service
  }));
  const server = await new Promise(resolve => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  try { await run(`http://127.0.0.1:${server.address().port}`, calls); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test("account export is authenticated and never accepts a forged uid", async () => {
  await fixture(async (base, calls) => {
    const denied = await fetch(`${base}/api/account/export`);
    assert.equal(denied.status, 401);
    const response = await fetch(`${base}/api/account/export?uid=victim`, { headers: { Authorization: "Bearer valid" } });
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [["export", "authenticated-user"]]);
    assert.match(response.headers.get("content-disposition"), /fuelphysique-account-export\.json/);
  });
});

test("account deletion requires a recent authentication and exact typed confirmation", async () => {
  await fixture(async (base, calls) => {
    const missing = await fetch(`${base}/api/account`, { method: "DELETE", headers: { Authorization: "Bearer valid", "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "no" }) });
    assert.equal(missing.status, 400);
    assert.equal(calls.length, 0);
    const old = await fetch(`${base}/api/account`, { method: "DELETE", headers: { Authorization: "Bearer valid", "x-auth-time": "1", "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE" }) });
    assert.equal(old.status, 401);
    const accepted = await fetch(`${base}/api/account`, { method: "DELETE", headers: { Authorization: "Bearer valid", "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE", uid: "victim" }) });
    assert.equal(accepted.status, 200);
    assert.equal(calls[0][0], "delete");
    assert.equal(calls[0][1], "authenticated-user");
    assert.equal(calls[0][2].confirmed, true);
  });
});
