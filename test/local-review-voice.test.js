"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const {
  LocalReviewVoiceProvider,
  createLocalReviewVoiceProvider,
  localReviewVoiceEnabled
} = require("../lib/local-review-voice-provider");
const { VoiceMediaService } = require("../lib/voice-media-service");

const enabledEnvironment = Object.freeze({
  LOCAL_REVIEW_VOICE_ENABLED: "1",
  NODE_ENV: "development",
  FUELPHYSIQUE_LOCAL_DEMO: "1",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  LOCAL_REVIEW_BIND_HOST: "127.0.0.1"
});
const audio = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]);

test("local review voice requires every isolation guard and can never activate in production", () => {
  assert.equal(localReviewVoiceEnabled(enabledEnvironment), true);
  for (const unsafe of [
    { NODE_ENV: "production" },
    { LOCAL_REVIEW_VOICE_ENABLED: "0" },
    { FUELPHYSIQUE_LOCAL_DEMO: "0" },
    { FIREBASE_AUTH_EMULATOR_HOST: "identitytoolkit.googleapis.com" },
    { FIRESTORE_EMULATOR_HOST: "firestore.googleapis.com" },
    { LOCAL_REVIEW_BIND_HOST: "0.0.0.0" }
  ]) {
    assert.equal(localReviewVoiceEnabled({ ...enabledEnvironment, ...unsafe }), false, JSON.stringify(unsafe));
  }
  assert.equal(createLocalReviewVoiceProvider({ env: { ...enabledEnvironment, NODE_ENV: "production" }, rootDir: os.tmpdir() }), null);
});

test("guarded local review voice uploads privately, signs loopback playback, supports ranges, and deletes cleanly", async (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuelphysique-local-voice-"));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  let provider;
  const app = express();
  app.get("/api/local-review/voice/:assetId", (req, res) => provider.servePlayback(req, res));
  const server = await new Promise((resolve) => {
    const current = app.listen(0, "127.0.0.1", () => resolve(current));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  provider = new LocalReviewVoiceProvider({ rootDir, port, secret: Buffer.alloc(32, 7) });
  const service = new VoiceMediaService({
    provider,
    config: { maxBytes: 1024, maxDurationMs: 120_000, playbackTtlSeconds: 600 },
    randomUUID: () => "12345678-1234-1234-1234-123456789abc"
  });

  const voice = await service.upload({
    uid: "user-a",
    conversationId: "thread-a-b",
    messageId: "message-a",
    buffer: audio,
    mimeType: "audio/webm;codecs=opus",
    durationMs: 1400,
    clientId: "local_review_123"
  });
  assert.match(voice.assetId, /^local_[a-f0-9]{32}$/);
  assert.equal(fs.readdirSync(path.join(rootDir, "assets")).length, 1);
  assert.equal(fs.readdirSync(path.join(rootDir, "metadata")).length, 1);

  const playback = await service.playbackUrl({ uid: "user-a", conversationId: "thread-a-b", assetId: voice.assetId });
  assert.match(playback.url, new RegExp(`^http://127\\.0\\.0\\.1:${port}/api/local-review/voice/${voice.assetId}\\?`));
  const response = await fetch(playback.url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), audio);

  const ranged = await fetch(playback.url, { headers: { Range: "bytes=0-3" } });
  assert.equal(ranged.status, 206);
  assert.equal(ranged.headers.get("content-range"), `bytes 0-3/${audio.length}`);
  assert.deepEqual(Buffer.from(await ranged.arrayBuffer()), audio.subarray(0, 4));

  assert.deepEqual(await service.deleteOwnedAsset({ uid: "user-a", conversationId: "thread-a-b", assetId: voice.assetId }), { status: "deleted" });
  assert.equal(fs.readdirSync(path.join(rootDir, "assets")).length, 0);
  assert.equal(fs.readdirSync(path.join(rootDir, "metadata")).length, 0);
});

test("the production voice service still rejects arbitrary insecure playback URLs", async () => {
  const provider = {
    async getFileDetails(assetId) {
      return { fileId: assetId, filePath: "/fuelphysique/users/user-a/voice/thread-a-b/message.webm", isPrivateFile: true };
    },
    getSignedUrl() { return "http://example.com/private.webm"; }
  };
  const service = new VoiceMediaService({ provider });
  await assert.rejects(
    () => service.playbackUrl({ uid: "user-a", conversationId: "thread-a-b", assetId: "asset-a" }),
    (error) => error.code === "voice_playback_failed"
  );
});
