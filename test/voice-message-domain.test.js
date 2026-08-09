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

function mp4Ftyp(majorBrand, compatibleBrands = [], { extended = false } = {}) {
  const payload = Buffer.concat([
    Buffer.from(majorBrand, "ascii"),
    Buffer.alloc(4),
    ...compatibleBrands.map((brand) => Buffer.from(brand, "ascii"))
  ]);
  if (extended) {
    const header = Buffer.alloc(16);
    header.writeUInt32BE(1, 0);
    header.write("ftyp", 4, "ascii");
    header.writeBigUInt64BE(BigInt(header.length + payload.length), 8);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(8);
  header.writeUInt32BE(header.length + payload.length, 0);
  header.write("ftyp", 4, "ascii");
  return Buffer.concat([header, payload]);
}

test("voice upload validates real container signatures, bounded metadata, and browser MIME variants", () => {
  const config = voiceMessageConfig({ VOICE_MESSAGE_MAX_BYTES: "1024", VOICE_MESSAGE_MAX_SECONDS: "120" });
  assert.equal(validateVoiceUpload({ buffer: webm, mimeType: "audio/webm;codecs=opus", durationMs: 900, clientId: "voice_client_1" }, config).extension, "webm");
  assert.equal(validateVoiceUpload({ buffer: ogg, mimeType: "audio/ogg", durationMs: 900, clientId: "voice_client_2" }, config).extension, "ogg");
  assert.equal(validateVoiceUpload({ buffer: mp4, mimeType: "audio/mp4", durationMs: 900, clientId: "voice_client_3" }, config).extension, "m4a");
  for (const candidate of [
    mp4Ftyp("M4A ", ["isom", "mp42"]),
    mp4Ftyp("mp42", ["isom"]),
    mp4Ftyp("iso6", ["mp41"]),
    mp4Ftyp("M4A ", ["iso6"], { extended: true })
  ]) {
    assert.equal(validateVoiceUpload({ buffer: candidate, mimeType: "audio/mp4;codecs=mp4a.40.2", durationMs: 900, clientId: "voice_safari" }, config).extension, "m4a");
    assert.equal(validateVoiceUpload({ buffer: candidate, mimeType: "audio/x-m4a", durationMs: 900, clientId: "voice_safari_m4a" }, config).extension, "m4a");
  }
});

test("voice upload rejects spoofed MIME, unsupported files, oversize data, and invalid duration", () => {
  const config = { maxBytes: 16, maxDurationMs: 120_000, playbackTtlSeconds: 600 };
  assert.throws(() => validateVoiceUpload({ buffer: Buffer.from("<html>"), mimeType: "audio/webm", durationMs: 1000, clientId: "client_123" }, config), error => error.code === "voice_signature_invalid");
  assert.throws(() => validateVoiceUpload({ buffer: webm, mimeType: "audio/mpeg", durationMs: 1000, clientId: "client_123" }, config), error => error.code === "voice_format_unsupported");
  assert.throws(() => validateVoiceUpload({ buffer: Buffer.concat([webm, Buffer.alloc(20)]), mimeType: "audio/webm", durationMs: 1000, clientId: "client_123" }, config), error => error.code === "voice_file_too_large");
  assert.throws(() => validateVoiceUpload({ buffer: webm, mimeType: "audio/webm", durationMs: 200, clientId: "client_123" }, config), error => error.code === "voice_duration_invalid");
  assert.throws(() => validateVoiceUpload({ buffer: webm, mimeType: "audio/webm", durationMs: 120001, clientId: "client_123" }, config), error => error.code === "voice_duration_invalid");
});

test("voice signatures reject non-audio payloads and fake MP4 ftyp patterns", () => {
  const config = { maxBytes: 4096, maxDurationMs: 120_000, playbackTtlSeconds: 600 };
  const rejected = [
    [Buffer.from("<html><script>alert(1)</script>"), "audio/mp4"],
    [Buffer.from("console.log('audio')"), "audio/webm"],
    [Buffer.from("plain text"), "audio/ogg"],
    [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "audio/mp4"],
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3]), "audio/mp4"],
    [Buffer.from([9, 8, 7, 6, 5, 4, 3, 2, 1]), "audio/webm"],
    [mp4Ftyp("FAKE", ["EVIL"]), "audio/mp4"],
    [Buffer.concat([Buffer.from([0, 0, 1, 0]), Buffer.from("ftypM4A ", "ascii"), Buffer.alloc(8)]), "audio/mp4"]
  ];
  for (const [buffer, mimeType] of rejected) {
    assert.throws(
      () => validateVoiceUpload({ buffer, mimeType, durationMs: 1000, clientId: "client_rejected" }, config),
      (error) => error.code === "voice_signature_invalid"
    );
  }
});

test("voice ownership requires the exact sender namespace, conversation namespace, file id, and private flag", () => {
  const expected = `${voiceAssetFolder("user-a", "thread-a-b")}/message-nonce.webm`;
  const value = { fileId: "asset-a", filePath: expected, isPrivateFile: true };
  assert.equal(voiceAssetBelongsTo(value, { uid: "user-a", conversationId: "thread-a-b", assetId: "asset-a" }), true);
  assert.equal(voiceAssetBelongsTo(value, { uid: "user-b", conversationId: "thread-a-b", assetId: "asset-a" }), false);
  assert.equal(voiceAssetBelongsTo(value, { uid: "user-a", conversationId: "thread-other", assetId: "asset-a" }), false);
  assert.equal(voiceAssetBelongsTo({ ...value, isPrivateFile: false }, { uid: "user-a", conversationId: "thread-a-b", assetId: "asset-a" }), false);
});
