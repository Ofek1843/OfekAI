const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const social = require("../lib/social-store");
const { createSocialRouter } = require("../lib/social-router");

async function withRouter(run, notifications) {
  const app = express();
  app.use(express.json());
  app.use("/api/social", createSocialRouter({ authenticate: async () => ({ uid: "user-a" }), notifications }));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test("committed Social text and artifact routes dispatch identifiers only", async () => {
  const originalSend = social.sendMessage;
  const originalShare = social.shareArtifact;
  const calls = [];
  social.sendMessage = async () => ({ duplicate: false, message: { id: "message-text", type: "text", text: "private body" } });
  social.shareArtifact = async () => ({ duplicate: false, message: { id: "message-share", type: "artifact", artifactId: "private-artifact" } });
  try {
    await withRouter(async base => {
      const textResponse = await fetch(`${base}/api/social/conversations/thread-a-b/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "private body", recipientUid: "forged" }) });
      assert.equal(textResponse.status, 201);
      const shareResponse = await fetch(`${base}/api/social/conversations/thread-a-b/artifacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "workout", sourceId: "plan", title: "forged title" }) });
      assert.equal(shareResponse.status, 201);
      await new Promise(resolve => setImmediate(resolve));
    }, { async notifySocialMessage(value) { calls.push(value); } });
    assert.deepEqual(calls, [
      { senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-text" },
      { senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-share" }
    ]);
    assert.equal(calls.some(call => "recipientUid" in call || "title" in call || "body" in call), false);
  } finally {
    social.sendMessage = originalSend;
    social.shareArtifact = originalShare;
  }
});

test("duplicate Social commits do not dispatch another push event", async () => {
  const originalSend = social.sendMessage;
  let calls = 0;
  social.sendMessage = async () => ({ duplicate: true, message: { id: "message-text" } });
  try {
    await withRouter(async base => {
      const response = await fetch(`${base}/api/social/conversations/thread-a-b/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "retry" }) });
      assert.equal(response.status, 201);
      await new Promise(resolve => setImmediate(resolve));
    }, { async notifySocialMessage() { calls += 1; } });
    assert.equal(calls, 0);
  } finally {
    social.sendMessage = originalSend;
  }
});
