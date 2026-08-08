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

// Keep the focused release regressions in the regular npm test graph as well.
require("./social-profile.test.js");
require("./manual-nutrition.test.js");
require("./nutrition-targets.test.js");

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
  assert.match(JS, /if \(state\.activeConversation\) startTypingChannel\(state\.activeConversation\.id\)/);
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

test("chat and artifact listeners clean up on logout, navigation and preview close", () => {
  assert.match(JS, /function cleanupSocial\(\)/);
  assert.match(JS, /onSignedOut:\s*cleanupSocial/);
  assert.match(JS, /function stopArtifactSubscription\(\)/);
  assert.match(JS, /stopArtifactSubscription\(\);[\s\S]*history\.back\(\)/);
  assert.match(JS, /beforeunload[\s\S]*cleanupSocial\(\)/);
});

test("artifact previews and copy actions are keyboard-accessible controls", () => {
  assert.match(HTML, /<dialog id="previewDialog"/);
  assert.match(HTML, /id="closePreviewButton"[\s\S]*type="button"/);
  assert.match(HTML, /id="copyArtifactButton"[\s\S]*type="button"/);
  assert.match(JS, /workoutPreview/);
  assert.match(JS, /nutritionPreview/);
  assert.match(JS, /graphPreview/);
  assert.match(JS, /window\.addEventListener\("popstate"/);
  assert.match(HTML, /id="reportArtifactButton"/);
  assert.match(JS, /reportSocialContent\("artifact", event\.currentTarget\.dataset\.artifactId\)/);
  assert.doesNotMatch(JS, /sent for review/i);
});

test("English and Hebrew social tables have matching keys", async () => {
  const { SOCIAL_STRINGS } = await import("../public/js/social-core.mjs");
  assert.deepEqual(Object.keys(SOCIAL_STRINGS.he).sort(), Object.keys(SOCIAL_STRINGS.en).sort());
  assert.match(SOCIAL_STRINGS.he.friends, /[\u0590-\u05ff]/);
});

test("locale switching preserves the messages unread badge", () => {
  assert.doesNotMatch(JS, /messagesTab:\s*"messages"/);
  assert.match(JS, /messagesTab\.firstChild\?\.nodeType === 3/);
  assert.match(HTML, /id="unreadBadge"/);
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

test("Social keeps an accessible Dashboard link in the mobile header", () => {
  assert.match(HTML, /<a[^>]+id="dashboardLink"[^>]*>/);
  assert.match(HTML, /id="dashboardLink"[^>]*href="\/dashboard\.html"/);
  assert.match(HTML, /id="dashboardLink"[^>]*>Dashboard<\/a>/);
  assert.match(HTML, /id="dashboardLink"[^>]+class="back-link"/);
});

test("Social mobile header keeps Dashboard visible and safe-area aware", () => {
  assert.match(CSS, /\.social-shell\s*\{[^}]*env\(safe-area-inset-top\)/s);
  assert.match(CSS, /\.social-shell\s*\{[^}]*env\(safe-area-inset-bottom\)/s);
  assert.match(CSS, /\.social-topbar\s*\{[^}]*position:\s*sticky/);
  assert.match(CSS, /button:focus-visible, a:focus-visible/);
  assert.match(CSS, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.back-link\s*\{[^}]*display:\s*inline-flex/);
  assert.doesNotMatch(CSS, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.back-link\s*\{[^}]*display:\s*none/);
  assert.match(CSS, /max-width:\s*42vw/);
});

test("social navigation and plan share discovery are present", () => {
  assert.match(DASHBOARD, /href="\/social\.html"/);
  assert.match(DASHBOARD, /socialUnreadBadge/);
  assert.match(WORKOUTS, /share=workout/);
  assert.match(NUTRITION, /share=nutrition/);
});
