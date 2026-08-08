const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanupAccountVoiceMessages } = require("../lib/voice-account-lifecycle");

function conversationWith(messages) {
  return {
    id: "thread-a-b",
    ref: {
      collection() {
        return {
          where() {
            return { async get() { return { docs: messages }; } };
          }
        };
      }
    }
  };
}

function message(id, data, write = async () => {}) {
  return { id, data: () => data, ref: { set: write } };
}

test("account voice cleanup deletes only provider-verified assets and leaves privacy-minimized unavailable tombstones", async () => {
  const writes = [];
  const deleted = [];
  const messages = [
    message("voice-a", { type: "voice", senderUid: "alice", voice: { assetId: "asset-a", durationMs: 2000, mimeType: "audio/webm", sizeBytes: 4000 } }, async (value) => writes.push(value)),
    message("voice-forged", { type: "voice", senderUid: "alice", voice: { assetId: "asset-b", durationMs: 3000, mimeType: "audio/mp4", sizeBytes: 5000 } }, async (value) => writes.push(value)),
    message("text", { type: "text", senderUid: "alice", text: "preserved" }, async () => { throw new Error("text must not change"); })
  ];
  const voiceMedia = {
    async deleteOwnedAsset({ assetId }) {
      if (assetId === "asset-b") return { status: "ownership_mismatch" };
      deleted.push(assetId);
      return { status: "deleted" };
    }
  };
  const result = await cleanupAccountVoiceMessages({ uid: "alice", conversations: [conversationWith(messages)], voiceMedia, serverTimestamp: () => "SERVER_TIME" });
  assert.deepEqual(result, { deleted: 1, unavailable: 2, ownershipMismatch: 1 });
  assert.deepEqual(deleted, ["asset-a"]);
  assert.equal(writes.length, 2);
  for (const write of writes) {
    assert.equal(write.voice.unavailable, true);
    assert.equal(write.voice.assetId, undefined);
    assert.equal(write.deletedAt, "SERVER_TIME");
    assert.doesNotMatch(JSON.stringify(write), /asset-a|asset-b/);
  }
});

test("provider failure stops cleanup before a tombstone can conceal an undeleted asset", async () => {
  let writes = 0;
  const current = message("voice-a", { type: "voice", senderUid: "alice", voice: { assetId: "asset-a" } }, async () => { writes += 1; });
  await assert.rejects(() => cleanupAccountVoiceMessages({
    uid: "alice",
    conversations: [conversationWith([current])],
    voiceMedia: { async deleteOwnedAsset() { throw Object.assign(new Error("provider down"), { code: "voice_delete_failed" }); } },
    serverTimestamp: () => "SERVER_TIME"
  }), error => error.code === "voice_delete_failed");
  assert.equal(writes, 0);
});

test("Firestore failure after provider deletion is retry-safe when the provider reports already absent", async () => {
  let attempts = 0;
  let providerCalls = 0;
  const current = message("voice-a", { type: "voice", senderUid: "alice", voice: { assetId: "asset-a", durationMs: 1000, mimeType: "audio/webm", sizeBytes: 100 } }, async () => {
    attempts += 1;
    if (attempts === 1) throw Object.assign(new Error("write failed"), { code: "firestore_unavailable" });
  });
  const voiceMedia = { async deleteOwnedAsset() { providerCalls += 1; return { status: providerCalls === 1 ? "deleted" : "already_absent" }; } };
  const input = { uid: "alice", conversations: [conversationWith([current])], voiceMedia, serverTimestamp: () => "SERVER_TIME" };
  await assert.rejects(() => cleanupAccountVoiceMessages(input), error => error.code === "firestore_unavailable");
  assert.deepEqual(await cleanupAccountVoiceMessages(input), { deleted: 1, unavailable: 1, ownershipMismatch: 0 });
  assert.equal(providerCalls, 2);
  assert.equal(attempts, 2);
});
