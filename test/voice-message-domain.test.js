const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateVoiceUpload,
  voiceAssetBelongsTo,
  voiceAssetFolder,
  voiceMessageConfig
} = require("../lib/voice-message-domain");

const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x86, 0x81, 0x01]);
const ogg = Buffer.from("OggSvoice", "ascii");
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypM4A ", "ascii"), Buffer.alloc(12)]);

test("voice upload validates real container signatures, bounded metadata, and browser MIME variants", () => {
  const config = voiceMessageConfig({ VOICE_MESSAGE_MAX_BYTES: "1024", VOICE_MESSAGE_MAX_SECONDS: "120" });
  assert.equal(validateVoiceUpload({ buffer: webm, mimeType: "audio/webm;codecs=opus", durationMs: 900, clientId: "voice_client_1" }, config).extension, "webm");
  assert.equal(validateVoiceUpload({ buffer: ogg, mimeType: "audio/ogg", durationMs: 900, clientId: "voice_client_2" }, config).extension, "ogg");
  assert.equal(validateVoiceUpload({ buffer: mp4, mimeType: "audio/mp4", durationMs: 900, clientId: "voice_client_3" }, config).extension, "m4a");
});

test("voice upload rejects spoofed MIME, unsupported files, oversize data, and invalid duration", () => {
  const config = { maxBytes: 16, maxDurationMs: 120_000, playbackTtlSeconds: 600 };
  assert.throws(() => validateVoiceUpload({ buffer: Buffer.from("<html>"), mimeType: "audio/webm", durationMs: 1000, clientId: "client_123" }, config), error => error.code === "voice_signature_invalid");
  assert.throws(() => validateVoiceUpload({ buffer: webm, mimeType: "audio/mpeg", durationMs: 1000, clientId: "client_123" }, config), error => error.code === "voice_format_unsupported");
  assert.throws(() => validateVoiceUpload({ buffer: Buffer.concat([webm, Buffer.alloc(20)]), mimeType: "audio/webm", durationMs: 1000, clientId: "client_123" }, config), error => error.code === "voice_file_too_large");
  assert.throws(() => validateVoiceUpload({ buffer: webm, mimeType: "audio/webm", durationMs: 200, clientId: "client_123" }, config), error => error.code === "voice_duration_invalid");
  assert.throws(() => validateVoiceUpload({ buffer: webm, mimeType: "audio/webm", durationMs: 120001, clientId: "client_123" }, config), error => error.code === "voice_duration_invalid");
});

test("voice ownership requires the exact sender namespace, conversation namespace, file id, and private flag", () => {
  const expected = `${voiceAssetFolder("user-a", "thread-a-b")}/message-nonce.webm`;
  const value = { fileId: "asset-a", filePath: expected, isPrivateFile: true };
  assert.equal(voiceAssetBelongsTo(value, { uid: "user-a", conversationId: "thread-a-b", assetId: "asset-a" }), true);
  assert.equal(voiceAssetBelongsTo(value, { uid: "user-b", conversationId: "thread-a-b", assetId: "asset-a" }), false);
  assert.equal(voiceAssetBelongsTo(value, { uid: "user-a", conversationId: "thread-other", assetId: "asset-a" }), false);
  assert.equal(voiceAssetBelongsTo({ ...value, isPrivateFile: false }, { uid: "user-a", conversationId: "thread-a-b", assetId: "asset-a" }), false);
});
