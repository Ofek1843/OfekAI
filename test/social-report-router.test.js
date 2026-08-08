const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const social = require("../lib/social-store");
const { createSocialRouter } = require("../lib/social-router");

async function withRouter(run, reportAlert) {
  const app = express();
  app.use(express.json());
  app.use("/api/social", createSocialRouter({
    authenticate: async () => ({ uid: "reporter" }),
    reportAlert
  }));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test("a report succeeds even when its optional alert fails, and the alert receives only bounded metadata", async () => {
  const original = social.reportContent;
  let alertPayload;
  social.reportContent = async () => ({ reportId: "opaque-report-id", duplicate: false, targetType: "message", reason: "harassment" });
  try {
    await withRouter(async base => {
      const response = await fetch(`${base}/api/social/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "message", targetId: "conversation:message", reason: "harassment", details: "private details" })
      });
      assert.equal(response.status, 201);
      assert.deepEqual(await response.json(), { reportId: "opaque-report-id", duplicate: false, targetType: "message", reason: "harassment" });
      await new Promise(resolve => setImmediate(resolve));
    }, async value => {
      alertPayload = value;
      throw new Error("alert endpoint unavailable");
    });
    assert.deepEqual(alertPayload, { reportId: "opaque-report-id", duplicate: false, targetType: "message", reason: "harassment" });
    assert.doesNotMatch(JSON.stringify(alertPayload), /reporter|conversation:message|private details/);
  } finally {
    social.reportContent = original;
  }
});

test("a duplicate report does not create another operational alert", async () => {
  const original = social.reportContent;
  let alerts = 0;
  social.reportContent = async () => ({ reportId: "opaque-report-id", duplicate: true, targetType: "artifact", reason: "spam" });
  try {
    await withRouter(async base => {
      const response = await fetch(`${base}/api/social/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "artifact", targetId: "artifact", reason: "spam" })
      });
      assert.equal(response.status, 201);
      await new Promise(resolve => setImmediate(resolve));
    }, async () => { alerts += 1; });
    assert.equal(alerts, 0);
  } finally {
    social.reportContent = original;
  }
});
