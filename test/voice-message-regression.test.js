const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("voice UI is integrated beside the existing composer with preview, retry, accessibility, mobile, and Hebrew copy", () => {
  const html = read("public/social.html");
  const js = read("public/js/social.js");
  const core = read("public/js/social-core.mjs");
  const css = read("public/css/social.css");
  for (const marker of ["voiceRecordButton", "voiceRecordingTimer", "voicePreviewAudio", "voiceSendButton", "voiceRecordAgainButton", "voiceDeletePreviewButton"]) assert.match(html, new RegExp(marker));
  for (const marker of ["VoiceRecorderController", "VoicePlaybackManager", "uploadVoiceMessage", "retry-message", "visibilitychange", "voicePlayback.stop", "voiceRecorder.dispose"]) assert.match(js, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const marker of ["הקלטת הודעה קולית", "שליחת הודעה קולית", "ההודעה הקולית אינה זמינה", "Microphone access was not granted"]) assert.match(core, new RegExp(marker));
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*voice-message/);
  assert.match(css, /\.voice-record-button\s*\{\s*width:\s*44px;\s*height:\s*44px;/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.site-feedback-widget\s*\{\s*bottom:\s*88px !important;/);
  assert.match(css, /grid-column: 1 \/ -1/);
});

test("voice implementation has no transcription, AI, analytics, persistent draft storage, or audio logging path", () => {
  const files = ["lib/voice-message-domain.js", "lib/voice-media-service.js", "public/js/voice-message-client.mjs"];
  const source = files.map(read).join("\n");
  assert.doesNotMatch(source, /OpenAI|\/api\/transcribe|transcrib|analytics|trackEvent|localStorage|indexedDB|console\.(log|info).*audio/i);
});

test("private playback is network-only, CSP permits only the configured media origin, and the cache version includes the new client module", () => {
  const sw = read("public/sw.js");
  const server = read("server.js");
  const router = read("lib/social-router.js");
  assert.match(sw, /event\.request\.destination === 'audio'/);
  assert.match(sw, /imagekit\.io/);
  assert.match(sw, /voice-message-client\.mjs/);
  assert.match(sw, /fuelphysique-v7/);
  assert.match(server, /media-src 'self'/);
  assert.match(server, /configuredImageKitOrigin/);
  assert.match(router, /Cache-Control", "private, no-store/);
});

test("voice lifecycle is documented in privacy, subprocessors, retention, export, and moderation surfaces", () => {
  const combined = ["public/privacy.html", "public/terms.html", "public/subprocessors.html", "docs/data-inventory.md", "docs/data-retention.md", "docs/moderation-operations.md"].map(read).join("\n");
  for (const marker of ["voice-message", "short-lived signed", "not sent to OpenAI", "voice-message metadata", "unavailable tombstone", "does not copy"] ) assert.match(combined, new RegExp(marker, "i"));
});

test("voice metadata remains server-written under existing message rules without a new client storage permission", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/conversations\/\{conversationId\}[\s\S]*match \/messages\/\{messageId\}[\s\S]*allow create, update, delete: if false/);
  assert.doesNotMatch(rules, /voiceMessages|voiceAssets/);
});
