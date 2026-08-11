"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { normalizeMusicLink, providerForHostname } = require("../lib/music-link-domain");
const { minimalSnapshot } = require("../lib/social-report-domain");

const ROOT = path.join(__dirname, "..");

test("music links normalize supported providers without fetching or embedding content", () => {
  const cases = [
    ["https://open.spotify.com/track/abc?si=123#fragment", "spotify"],
    ["https://music.apple.com/us/album/example/123", "apple_music"],
    ["https://www.youtube.com/watch?v=abc", "youtube"],
    ["https://youtu.be/abc", "youtube"],
    ["https://music.youtube.com/watch?v=abc", "youtube_music"],
    ["https://soundcloud.com/artist/track", "soundcloud"],
    ["https://example.com/public-playlist", "link"]
  ];
  for (const [url, provider] of cases) {
    const result = normalizeMusicLink({ url, title: "  Workout <mix>  " });
    assert.equal(result.provider, provider);
    assert.equal(result.url.startsWith("https://"), true);
    assert.equal(result.url.includes("#"), false);
    assert.equal(result.title, "Workout mix");
  }
  assert.equal(providerForHostname("api.spotify.com"), "link");
});

test("music links reject active content, insecure URLs, credentials, local hosts and private networks", () => {
  const rejected = [
    "javascript:alert(1)", "data:text/html,hi", "file:///tmp/a", "blob:https://example.com/id",
    "http://open.spotify.com/track/abc", "https://user:pass@example.com/music", "https://localhost/music",
    "https://127.0.0.1/music", "https://10.0.0.2/music", "https://172.16.0.2/music", "https://192.168.1.4/music",
    "https://169.254.1.1/music", "https://[::1]/music", "https://example.com:8443/music", "https://not a host/music"
  ];
  for (const url of rejected) assert.throws(() => normalizeMusicLink({ url }), /HTTPS|allowed|valid|credentials|ports|private/i, url);
  assert.throws(() => normalizeMusicLink({ url: `https://example.com/${"a".repeat(2050)}` }), /valid HTTPS/i);
  assert.throws(() => normalizeMusicLink({ url: "https://example.com/music", title: "x".repeat(81) }), /up to 80/);
});

test("generic public HTTPS hosts remain available while reserved documentation ranges stay blocked", () => {
  assert.equal(normalizeMusicLink({ url: "https://203.0.114.1/music" }).url, "https://203.0.114.1/music");
  for (const host of ["192.0.2.1", "198.51.100.4", "203.0.113.9"]) {
    assert.throws(() => normalizeMusicLink({ url: `https://${host}/music` }), /private-network/i);
  }
});

test("music reports identify the message without duplicating its title or URL", () => {
  const snapshot = minimalSnapshot({
    targetType: "message",
    targetId: "conversation/message",
    value: { senderUid: "alice", type: "music_link", music: { title: "Private mix", url: "https://example.com/private" } }
  });
  assert.deepEqual(snapshot, { targetType: "message", targetId: "conversation/message", senderUid: "alice", type: "music_link" });
  assert.doesNotMatch(JSON.stringify(snapshot), /Private mix|example\.com/);
});

test("music messages reuse the authenticated friendship transaction and scrub destinations on deletion", () => {
  const store = fs.readFileSync(path.join(ROOT, "lib", "social-store.js"), "utf8");
  const router = fs.readFileSync(path.join(ROOT, "lib", "social-router.js"), "utf8");
  const music = fs.readFileSync(path.join(ROOT, "lib", "music-link-domain.js"), "utf8");
  assert.match(store, /async function sendMusicMessage[\s\S]*?writeMessageTransaction\(/);
  assert.match(store, /async function writeMessageTransaction[\s\S]*?assertAcceptedFriends\(/);
  assert.match(store, /message\.data\(\)\?\.type === "music_link"[\s\S]*?unavailable: true/);
  assert.match(router, /req\.socialUser\.uid[\s\S]*?social\.sendMusicMessage\(req\.socialUser\.uid/);
  assert.doesNotMatch(music, /\bfetch\s*\(|https?\.request\s*\(|iframe|embed/i);
});
