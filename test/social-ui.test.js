"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "public", "social.html"), "utf8");
const JS = fs.readFileSync(path.join(ROOT, "public", "js", "social.js"), "utf8");
const CSS = fs.readFileSync(path.join(ROOT, "public", "css", "social.css"), "utf8");
const DASHBOARD = fs.readFileSync(path.join(ROOT, "public", "dashboard.html"), "utf8");
const WORKOUTS = fs.readFileSync(path.join(ROOT, "public", "js", "my-workout-plans.js"), "utf8");
const NUTRITION = fs.readFileSync(path.join(ROOT, "public", "js", "my-nutrition-plans.js"), "utf8");

test("social page exposes friends, requests, conversations and username onboarding", () => {
  for (const id of ["identityForm", "userSearchForm", "receivedRequests", "sentRequests", "friendList", "conversationList", "messageForm"]) {
    assert.match(HTML, new RegExp(`id="${id}"`));
  }
});

test("chat has bounded history, retry, tombstones and duplicate-send keys", () => {
  assert.match(JS, /nextCursor/);
  assert.match(JS, /loadOlderMessages/);
  assert.match(JS, /status = "failed"/);
  assert.match(JS, /retry-message/);
  assert.match(JS, /delete-message/);
  assert.match(JS, /safeClientId\(\)/);
  assert.match(HTML, /maxlength="2000"/);
});

test("only the active conversation receives a realtime listener", () => {
  assert.match(JS, /state\.unsubscribe\?\.\(\)/);
  assert.match(JS, /collection\(db, "conversations", conversationId, "messages"\)/);
  assert.match(JS, /limit\(25\)/);
  assert.doesNotMatch(JS, /collectionGroup\(/);
  assert.match(JS, /permission-denied/);
  assert.match(JS, /failed-precondition/);
});

test("artifact previews and copy actions are keyboard-accessible controls", () => {
  assert.match(HTML, /<dialog id="previewDialog"/);
  assert.match(HTML, /id="closePreviewButton"[\s\S]*type="button"/);
  assert.match(HTML, /id="copyArtifactButton"[\s\S]*type="button"/);
  assert.match(JS, /workoutPreview/);
  assert.match(JS, /nutritionPreview/);
  assert.match(JS, /graphPreview/);
  assert.match(JS, /window\.addEventListener\("popstate"/);
});

test("English and Hebrew social tables have matching keys", async () => {
  const { SOCIAL_STRINGS } = await import("../public/js/social-core.mjs");
  assert.deepEqual(Object.keys(SOCIAL_STRINGS.he).sort(), Object.keys(SOCIAL_STRINGS.en).sort());
  assert.match(SOCIAL_STRINGS.he.friends, /[\u0590-\u05ff]/);
});

test("RTL, mixed-direction text and accessible focus are explicit", () => {
  assert.match(JS, /document\.documentElement\.dir = language === "he" \? "rtl" : "ltr"/);
  assert.match(CSS, /unicode-bidi:\s*plaintext/);
  assert.match(CSS, /\[dir="rtl"\]/);
  assert.match(CSS, /:focus-visible/);
  assert.match(HTML, /aria-live="polite"/);
});

test("motion is restrained and reduced-motion is respected", () => {
  assert.match(CSS, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.equal((CSS.match(/\binfinite\b/g) || []).length, 2, "only the two loading skeleton rules may loop");
  assert.match(CSS, /animation:\s*shimmer[^;]*infinite/);
});

test("mobile chat has a responsive composer and no horizontal page overflow", () => {
  assert.match(CSS, /@media \(max-width:\s*680px\)/);
  assert.match(CSS, /\.composer\s*\{[^}]*grid-template-columns/s);
  assert.match(CSS, /overflow-x:\s*hidden/);
  assert.match(CSS, /env\(safe-area-inset-bottom\)/);
});

test("social navigation and plan share discovery are present", () => {
  assert.match(DASHBOARD, /href="\/social\.html"/);
  assert.match(DASHBOARD, /socialUnreadBadge/);
  assert.match(WORKOUTS, /share=workout/);
  assert.match(NUTRITION, /share=nutrition/);
});
