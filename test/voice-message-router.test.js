const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const social = require("../lib/social-store");
const { createSocialRouter } = require("../lib/social-router");
const { SocialError } = require("../lib/social-domain");

async function withServer(options, run) {
  const app = express();
  app.use(express.json());
  app.use("/api/social", createSocialRouter(options));
  const server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

const audio = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]);

test("voice route authorizes the conversation before reading/uploading bytes and commits identifiers-only push", async () => {
  const originals = { prepare: social.prepareVoiceMessage, send: social.sendVoiceMessage };
  const order = [];
  const pushes = [];
  social.prepareVoiceMessage = async (uid, conversationId, clientId) => { order.push(["authorize", uid, conversationId, clientId]); return { duplicate: false, messageId: "message-a" }; };
  social.sendVoiceMessage = async (_uid, _conversationId, input) => { order.push(["commit", input.voice.assetId]); return { duplicate: false, message: { id: "message-a", type: "voice", voice: input.voice } }; };
  const voiceMedia = {
    async upload(input) { order.push(["upload", input.buffer.length]); return { assetId: "asset-a", durationMs: 1000, mimeType: "audio/webm", sizeBytes: input.buffer.length }; },
    async deleteOwnedAsset() { throw new Error("not expected"); }
  };
  try {
    await withServer({
      authenticate: async () => ({ uid: "user-a" }), voiceMedia, voiceConfig: { maxBytes: 1024 },
      notifications: { async notifySocialMessage(value) { pushes.push(value); } }
    }, async (base) => {
      const response = await fetch(`${base}/api/social/conversations/thread-a-b/voice-messages`, {
        method: "POST",
        headers: { "Content-Type": "audio/webm", "X-Voice-Client-Id": "client_123", "X-Voice-Duration-Ms": "1000" },
        body: audio
      });
      assert.equal(response.status, 201);
      await new Promise((resolve) => setImmediate(resolve));
    });
    assert.deepEqual(order.map((entry) => entry[0]), ["authorize", "upload", "commit"]);
    assert.deepEqual(pushes, [{ senderUid: "user-a", conversationId: "thread-a-b", messageId: "message-a" }]);
    assert.equal(JSON.stringify(pushes).includes("asset-a"), false);
  } finally {
    social.prepareVoiceMessage = originals.prepare;
    social.sendVoiceMessage = originals.send;
  }
});

test("unauthorized voice send is rejected before upload and duplicate retry does not re-upload", async () => {
  const original = social.prepareVoiceMessage;
  let uploads = 0;
  const voiceMedia = { async upload() { uploads += 1; } };
  try {
    social.prepareVoiceMessage = async () => { throw new SocialError("conversation_not_found", "Conversation not found.", 404); };
    await withServer({ authenticate: async () => ({ uid: "intruder" }), voiceMedia, voiceConfig: { maxBytes: 1024 } }, async (base) => {
      const response = await fetch(`${base}/api/social/conversations/thread-a-b/voice-messages`, { method: "POST", headers: { "Content-Type": "audio/webm", "X-Voice-Client-Id": "client_123", "X-Voice-Duration-Ms": "1000" }, body: audio });
      assert.equal(response.status, 404);
    });
    social.prepareVoiceMessage = async () => ({ duplicate: true, messageId: "message-a", message: { id: "message-a", type: "voice" } });
    await withServer({ authenticate: async () => ({ uid: "user-a" }), voiceMedia, voiceConfig: { maxBytes: 1024 } }, async (base) => {
      const response = await fetch(`${base}/api/social/conversations/thread-a-b/voice-messages`, { method: "POST", headers: { "Content-Type": "audio/webm", "X-Voice-Client-Id": "client_123", "X-Voice-Duration-Ms": "1000" }, body: audio });
      assert.equal(response.status, 200);
    });
    assert.equal(uploads, 0);
  } finally { social.prepareVoiceMessage = original; }
});

test("unauthenticated upload is rejected before conversation or media processing", async () => {
  let uploads = 0;
  await withServer({
    authenticate: async (_req, res) => { res.status(401).json({ error: "Authentication is required." }); return null; },
    voiceMedia: { async upload() { uploads += 1; } },
    voiceConfig: { maxBytes: 1024 }
  }, async (base) => {
    const response = await fetch(`${base}/api/social/conversations/thread-a-b/voice-messages`, { method: "POST", headers: { "Content-Type": "audio/webm", "X-Voice-Client-Id": "client_123", "X-Voice-Duration-Ms": "1000" }, body: audio });
    assert.equal(response.status, 401);
  });
  assert.equal(uploads, 0);
});

test("oversize voice bodies are rejected before media upload", async () => {
  const original = social.prepareVoiceMessage;
  let uploads = 0;
  social.prepareVoiceMessage = async () => ({ duplicate: false, messageId: "message-a" });
  try {
    await withServer({
      authenticate: async () => ({ uid: "user-a" }),
      voiceMedia: { async upload() { uploads += 1; } },
      voiceConfig: { maxBytes: 4 }
    }, async (base) => {
      const response = await fetch(`${base}/api/social/conversations/thread-a-b/voice-messages`, {
        method: "POST",
        headers: { "Content-Type": "audio/webm", "X-Voice-Client-Id": "client_123", "X-Voice-Duration-Ms": "1000" },
        body: audio
      });
      assert.equal(response.status, 413);
    });
    assert.equal(uploads, 0);
  } finally { social.prepareVoiceMessage = original; }
});

test("playback requires participant authorization and never returns a permanent provider URL", async () => {
  const original = social.getMessageForParticipant;
  const calls = [];
  social.getMessageForParticipant = async (uid) => {
    calls.push(uid);
    if (uid === "intruder") throw new SocialError("conversation_not_found", "Conversation not found.", 404);
    return { id: "message-a", senderUid: "user-a", type: "voice", voice: { assetId: "asset-a" } };
  };
  const voiceMedia = { async playbackUrl() { return { url: "https://signed.example/voice?expires=soon", expiresInSeconds: 600 }; } };
  try {
    for (const [uid, status] of [["user-b", 200], ["intruder", 404]]) {
      await withServer({ authenticate: async () => ({ uid }), voiceMedia }, async (base) => {
        const response = await fetch(`${base}/api/social/conversations/thread-a-b/messages/message-a/voice/playback`);
        assert.equal(response.status, status);
        if (status === 200) assert.match(response.headers.get("cache-control") || "", /no-store/);
      });
    }
    assert.deepEqual(calls, ["user-b", "intruder"]);
  } finally { social.getMessageForParticipant = original; }
});

test("authenticated client receives only non-secret voice limits and feature availability", async () => {
  await withServer({
    authenticate: async () => ({ uid: "user-a" }),
    voiceMedia: { provider: {}, async upload() {} },
    voiceConfig: { maxBytes: 8_000_000, maxDurationMs: 90_000 }
  }, async (base) => {
    const response = await fetch(`${base}/api/social/voice-config`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { enabled: true, maxDurationMs: 90_000, maxBytes: 8_000_000 });
    assert.match(response.headers.get("cache-control") || "", /no-store/);
  });
});

test("sender deletion verifies and removes owned media before creating the existing message tombstone", async () => {
  const originals = { getOwned: social.getOwnedMessage, remove: social.deleteMessage };
  const calls = [];
  social.getOwnedMessage = async () => ({ id: "message-a", senderUid: "user-a", type: "voice", voice: { assetId: "asset-a" } });
  social.deleteMessage = async () => { calls.push("tombstone"); return { deleted: true }; };
  try {
    await withServer({
      authenticate: async () => ({ uid: "user-a" }),
      voiceMedia: { async deleteOwnedAsset(value) { calls.push(["asset", value]); return { status: "deleted" }; } }
    }, async (base) => {
      const response = await fetch(`${base}/api/social/conversations/thread-a-b/messages/message-a`, { method: "DELETE" });
      assert.equal(response.status, 200);
    });
    assert.equal(calls[0][0], "asset");
    assert.equal(calls[1], "tombstone");

    calls.length = 0;
    await withServer({
      authenticate: async () => ({ uid: "user-a" }),
      voiceMedia: { async deleteOwnedAsset() { return { status: "ownership_mismatch" }; } }
    }, async (base) => {
      const response = await fetch(`${base}/api/social/conversations/thread-a-b/messages/message-a`, { method: "DELETE" });
      assert.equal(response.status, 403);
    });
    assert.deepEqual(calls, []);
  } finally {
    social.getOwnedMessage = originals.getOwned;
    social.deleteMessage = originals.remove;
  }
});

test("message commit failure and concurrent duplicate both clean the newly uploaded orphan", async () => {
  const originals = { prepare: social.prepareVoiceMessage, send: social.sendVoiceMessage };
  social.prepareVoiceMessage = async () => ({ duplicate: false, messageId: "message-a" });
  const deleted = [];
  const voiceMedia = {
    async upload(input) { return { assetId: `uploaded-${input.clientId}`, durationMs: 1000, mimeType: "audio/webm", sizeBytes: input.buffer.length }; },
    async deleteOwnedAsset(input) { deleted.push(input.assetId); return { status: "deleted" }; }
  };
  try {
    social.sendVoiceMessage = async () => { throw new SocialError("commit_failed", "Commit failed.", 503); };
    await withServer({ authenticate: async () => ({ uid: "user-a" }), voiceMedia, voiceConfig: { maxBytes: 1024 } }, async (base) => {
      const response = await fetch(`${base}/api/social/conversations/thread-a-b/voice-messages`, { method: "POST", headers: { "Content-Type": "audio/webm", "X-Voice-Client-Id": "client_failure", "X-Voice-Duration-Ms": "1000" }, body: audio });
      assert.equal(response.status, 503);
    });
    social.sendVoiceMessage = async () => ({ duplicate: true, message: { id: "message-a", type: "voice", voice: { assetId: "already-committed" } } });
    await withServer({ authenticate: async () => ({ uid: "user-a" }), voiceMedia, voiceConfig: { maxBytes: 1024 } }, async (base) => {
      const response = await fetch(`${base}/api/social/conversations/thread-a-b/voice-messages`, { method: "POST", headers: { "Content-Type": "audio/webm", "X-Voice-Client-Id": "client_race", "X-Voice-Duration-Ms": "1000" }, body: audio });
      assert.equal(response.status, 200);
    });
    assert.deepEqual(deleted.sort(), ["uploaded-client_failure", "uploaded-client_race"]);
  } finally {
    social.prepareVoiceMessage = originals.prepare;
    social.sendVoiceMessage = originals.send;
  }
});
