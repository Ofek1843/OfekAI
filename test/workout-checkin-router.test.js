const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createWorkoutCheckinRouter } = require("../lib/workout-checkin-router");

test("workout check-in routes authenticate, validate timezone and delegate scoped answers", async t => {
  const calls = [];
  const app = express();
  app.use(express.json());
  app.use("/api/workout-checkins", createWorkoutCheckinRouter({
    authenticate: async (req, res) => {
      if (req.headers.authorization !== "Bearer valid") {
        res.status(401).json({ error: "Sign in required." });
        return null;
      }
      return { uid: "alice" };
    },
    rateLimit: (_req, uid) => calls.push(["rate", uid]),
    service: {
      async dashboard(uid, timezone) { calls.push(["dashboard", uid, timezone]); return { checkins: [] }; },
      async answer(uid, id, action) { calls.push(["answer", uid, id, action]); return { id, status: "pending", step: "completed_most" }; },
      async markWorkoutCompleted(uid, input) { calls.push(["tracker", uid, input]); return { updated: true }; }
    }
  }));
  const server = app.listen(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const auth = { Authorization: "Bearer valid" };

  const unauthorized = await fetch(`${origin}/api/workout-checkins?timezone=UTC`);
  assert.equal(unauthorized.status, 401);
  const invalidZone = await fetch(`${origin}/api/workout-checkins?timezone=Not/AZone`, { headers: auth });
  assert.equal(invalidZone.status, 400);
  const dashboard = await fetch(`${origin}/api/workout-checkins?timezone=Asia%2FJerusalem`, { headers: auth });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.headers.get("cache-control"), "no-store");
  const dashboardBody = await dashboard.json();
  assert.deepEqual(dashboardBody, { checkins: [] });

  const id = "a".repeat(64);
  const answer = await fetch(`${origin}/api/workout-checkins/${id}/answer`, {
    method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ action: "completed" })
  });
  assert.equal(answer.status, 200);
  assert.equal((await answer.json()).checkin.id, id);
  const forgedId = await fetch(`${origin}/api/workout-checkins/not-a-checkin/answer`, {
    method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ action: "completed" })
  });
  assert.equal(forgedId.status, 400);
  assert.ok(calls.some(call => call[0] === "dashboard" && call[1] === "alice" && call[2] === "Asia/Jerusalem"));
  assert.ok(calls.some(call => call[0] === "answer" && call[1] === "alice" && call[3] === "completed"));
});
