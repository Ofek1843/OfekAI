"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const TOKENS = read("public", "css", "redesign-v1.css");
const POLISH = read("public", "css", "product-polish-v3.css");
const DASHBOARD = read("public", "dashboard.html");
const WORKOUT = read("public", "js", "workout-builder.js");
const SOCIAL_HTML = read("public", "social.html");
const SOCIAL_JS = read("public", "js", "social.js");

test("Phase 3 uses the exact Ultramarine Spectrum palette", () => {
  const exact = {
    "fp-coach": "#18a979", "fp-ultramarine": "#304ffe", "fp-nutrition": "#e99a28",
    "fp-progress": "#7957e8", "fp-social": "#d54d79", "fp-ultramarine-strong": "#243be8",
    "fp-glacier": "#eef3fb", "fp-glacier-surface": "#f7f9fe", "fp-cool-blue": "#e8eefa",
    "fp-midnight": "#10182b", "fp-midnight-soft": "#172238", "fp-steel": "#73809a",
    "fp-border-light": "#d3dae8", "fp-ink": "#10131a"
  };
  for (const [name, value] of Object.entries(exact)) assert.match(TOKENS, new RegExp(`--${name}:\\s*${value}`, "i"), `${name} must remain ${value}`);
});

test("Phase 3 pages load the release stylesheet and service worker cache", () => {
  for (const page of ["index.html", "dashboard.html", "workout-builder.html", "social.html"]) {
    assert.match(read("public", page), /product-polish-v3\.css\?v=20260811-spectrum-v3/);
  }
  const sw = read("public", "sw.js");
  assert.match(sw, /fuelphysique-v31-deep-ocean-v44/);
  assert.match(sw, /product-polish-v3\.css\?v=20260811-spectrum-v3/);
});

test("dashboard restores five distinct domain actions with library icons", () => {
  for (const domain of ["coach", "workout", "nutrition", "progress", "social"]) {
    assert.match(DASHBOARD, new RegExp(`dashboard-action--${domain}`));
    assert.match(POLISH, new RegExp(`dashboard-action--${domain}\\s*\\{`));
  }
  assert.equal((DASHBOARD.match(/class="dashboard-action dashboard-action--/g) || []).length, 5);
  assert.equal((DASHBOARD.match(/\/icons\/tabler\//g) || []).length >= 5, true);
  assert.match(read("public", "icons", "tabler", "LICENSE"), /MIT License/);
});

test("landing rhythm uses flat Glacier, Cool Blue and Midnight surfaces without gradients or glow", () => {
  assert.match(POLISH, /\.fp-route-index \.feature-section \{ background: var\(--fp-glacier-surface\)/);
  assert.match(POLISH, /\.fp-route-index \.feature-section \.section-heading p,[\s\S]*?\.fp-route-index \.feature-section \.premium-card p \{ color: #52637a !important; \}/);
  assert.match(POLISH, /\.fp-route-index \.how-section \{ background: var\(--fp-cool-blue\)/);
  assert.match(POLISH, /\.fp-route-index \.final-cta[\s\S]*?background: var\(--fp-midnight\)/);
  assert.doesNotMatch(POLISH, /(?:linear|radial|conic)-gradient|\bglow\b/i);
});

test("workout results expose one URL-addressable active day with desktop rail, mobile selector and RTL rail placement", () => {
  assert.match(WORKOUT, /new URLSearchParams\(window\.location\.search\)\.get\("day"\)/);
  assert.match(WORKOUT, /data-program-day=/);
  assert.match(WORKOUT, /data-program-day-target=/);
  assert.match(WORKOUT, /history\.replaceState/);
  assert.match(WORKOUT, /planDaySelect/);
  assert.match(POLISH, /\.workout-day\[hidden\] \{ display: none !important; \}/);
  assert.match(POLISH, /html\[dir="rtl"\] \.fp-route-workout-builder \.plan-day-rail \{ grid-column: 1; \}/);
  assert.match(POLISH, /html\[dir="rtl"\] \.fp-route-workout-builder \.program-days \{ grid-column: 2; grid-row: 1; \}/);
  assert.match(WORKOUT, /isHebrew \? "ימי האימון" : "Workout days"/);
  assert.match(POLISH, /@media \(max-width: 960px\)[\s\S]*?\.plan-day-buttons \{ display: none; \}/);
  assert.match(WORKOUT, /<details class="plan-volume-disclosure" id="weekly-volume-container">/);
});

test("Social is mode-based and the focused composer keeps legacy shares grouped", () => {
  for (const mode of ["messages", "friends", "requests", "find"]) assert.match(SOCIAL_HTML, new RegExp(`data-view="${mode}"`));
  assert.match(SOCIAL_HTML, /class="social-sidebar"/);
  assert.match(SOCIAL_HTML, /class="social-workspace"/);
  assert.match(SOCIAL_HTML, /class="social-context-panel"/);
  assert.match(SOCIAL_HTML, /data-share-type="workout"/);
  assert.match(SOCIAL_HTML, /data-share-type="nutrition"/);
  assert.match(SOCIAL_HTML, /data-music-link/);
  assert.match(SOCIAL_HTML, /<details class="share-more">/);
  for (const legacy of ["personal_record", "completed_workout", "weight_progress", "progress_graph"]) assert.match(SOCIAL_HTML, new RegExp(`data-share-type="${legacy}"`));
  assert.match(SOCIAL_JS, /setView\("messages"\)/);
  assert.match(SOCIAL_JS, /fuelphysique:languagechange/);
  assert.match(read("public", "js", "redesign-shell.js"), /addEventListener\("fuelphysique:languagechange"/);
  assert.match(POLISH, /grid-template-columns: minmax\(250px, 300px\) minmax\(0, 1fr\) minmax\(220px, 270px\)/);
});

test("safe music cards open only normalized links in a protected new tab and never embed destinations", () => {
  assert.match(SOCIAL_JS, /target="_blank" rel="noopener noreferrer"/);
  assert.match(SOCIAL_JS, /JSON\.stringify\(\{ type: "music_link", url, title, clientId: safeClientId\(\) \}\)/);
  assert.match(SOCIAL_HTML, /FuelPhysique never downloads, embeds or proxies the destination/);
  assert.doesNotMatch(SOCIAL_HTML, /<iframe/i);
});

test("mobile Social switches between list and chat without stacking both canvases", () => {
  assert.match(POLISH, /@media \(max-width: 760px\)/);
  assert.match(POLISH, /\.social-app\.show-conversations \.social-workspace \{ display: none !important; \}/);
  assert.match(POLISH, /data-social-mode="messages"\]:not\(\.show-conversations\) \.conversation-rail \{ display: none !important; \}/);
  assert.match(SOCIAL_JS, /classList\.add\("show-conversations"\)/);
  assert.match(SOCIAL_JS, /classList\.remove\("show-conversations"\)/);
});

test("the review seed covers multiple conversations, both request directions and music", () => {
  const seed = read("scripts", "seed-redesign-review.js");
  assert.match(seed, /SOCIAL_CONTACTS/);
  assert.match(seed, /secondConversationId/);
  assert.match(seed, /receivedRequestId/);
  assert.match(seed, /sentRequestId/);
  assert.equal((seed.match(/type: "music_link"/g) || []).length, 5);
});
