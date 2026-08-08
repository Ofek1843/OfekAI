const test = require("node:test");
const assert = require("node:assert/strict");
const { VoiceMediaService } = require("../lib/voice-media-service");

const buffer = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]);

function fixture(overrides = {}) {
  const calls = { upload: [], details: [], deleted: [], signed: [] };
  const provider = {
    async upload(input) {
      calls.upload.push(input);
      return { fileId: "asset-a", filePath: `${input.folder}/${input.fileName}`, url: `https://ik.imagekit.io/demo${input.folder}/${input.fileName}`, isPrivateFile: true };
    },
    async getFileDetails(fileId) {
      calls.details.push(fileId);
      return { fileId, filePath: "/fuelphysique/users/user-a/voice/thread-a-b/message.webm", url: "https://ik.imagekit.io/demo/fuelphysique/users/user-a/voice/thread-a-b/message.webm", isPrivateFile: true };
    },
    async deleteFile(fileId) { calls.deleted.push(fileId); },
    getSignedUrl(source, ttl) { calls.signed.push([source, ttl]); return "https://ik.imagekit.io/demo/private.webm?ik-t=1&ik-s=signed"; },
    ...overrides
  };
  return {
    calls,
    service: new VoiceMediaService({ provider, config: { maxBytes: 1024, maxDurationMs: 120_000, playbackTtlSeconds: 600 }, randomUUID: () => "12345678-1234-1234-1234-123456789abc" })
  };
}

test("server upload uses a private sender/conversation namespace and returns metadata without a permanent URL", async () => {
  const { service, calls } = fixture();
  const result = await service.upload({ uid: "user-a", conversationId: "thread-a-b", messageId: "message-a", buffer, mimeType: "audio/webm;codecs=opus", durationMs: 1500, clientId: "client_123" });
  assert.deepEqual(result, { assetId: "asset-a", durationMs: 1500, mimeType: "audio/webm", sizeBytes: buffer.length });
  assert.equal(calls.upload[0].folder, "/fuelphysique/users/user-a/voice/thread-a-b");
  assert.equal(calls.upload[0].isPrivateFile, true);
  assert.equal(calls.upload[0].useUniqueFileName, false);
  assert.equal("url" in result || "path" in result, false);
});

test("playback verifies provider ownership before issuing a short-lived signed URL", async () => {
  const { service, calls } = fixture();
  const result = await service.playbackUrl({ uid: "user-a", conversationId: "thread-a-b", assetId: "asset-a" });
  assert.match(result.url, /ik-s=signed/);
  assert.equal(result.expiresInSeconds, 600);
  assert.equal(calls.signed[0][1], 600);
});

test("cross-user provider references cannot be played or deleted", async () => {
  const { service, calls } = fixture({
    async getFileDetails(fileId) { return { fileId, filePath: "/fuelphysique/users/user-b/voice/thread-a-b/stolen.webm", isPrivateFile: true }; }
  });
  await assert.rejects(() => service.playbackUrl({ uid: "user-a", conversationId: "thread-a-b", assetId: "asset-b" }), error => error.code === "voice_asset_forbidden");
  assert.deepEqual(await service.deleteOwnedAsset({ uid: "user-a", conversationId: "thread-a-b", assetId: "asset-b" }), { status: "ownership_mismatch" });
  assert.deepEqual(calls.deleted, []);
});

test("provider configuration is feature-gated and deletion is idempotent for an absent asset", async () => {
  const disabled = new VoiceMediaService({ provider: null });
  await assert.rejects(() => disabled.upload({}), error => error.code === "voice_storage_unavailable");
  const current = fixture({ async getFileDetails() { throw Object.assign(new Error("missing"), { statusCode: 404 }); } });
  assert.deepEqual(await current.service.deleteOwnedAsset({ uid: "user-a", conversationId: "thread-a-b", assetId: "missing" }), { status: "already_absent" });
});
