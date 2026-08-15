"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const CSS = read("public", "css", "illustrated-v4.css");
const ILLUSTRATIONS = read("public", "js", "illustrated-v4.js");
const DASHBOARD = read("public", "dashboard.html");
const LANDING = read("public", "index.html");
const SOCIAL_HTML = read("public", "social.html");
const SOCIAL_JS = read("public", "js", "social.js");
const WORKOUT = read("public", "js", "workout-builder.js");
const DASHBOARD_JS = read("public", "js", "dashboard.js");
const SHELL = read("public", "js", "redesign-shell.js");
const THEME = read("public", "js", "theme-toggle.js");

test("Illustrated V4 uses the exact Athletic Spectrum tokens without gradients or glow", () => {
  for (const [name, value] of Object.entries({
    "v4-canvas-light": "#e9eef8", "v4-canvas-dark": "#151a29",
    "v4-training": "#315bff", "v4-nutrition": "#f0a326",
    "v4-progress": "#7957e8", "v4-coach": "#1fa978", "v4-social": "#d94f82"
  })) assert.match(CSS, new RegExp(`--${name}:\\s*${value}`, "i"));
  assert.doesNotMatch(CSS, /(?:linear|radial|conic)-gradient|\bglow\b/i);
});

test("the dashboard is a varied five-capability studio with compact context", () => {
  assert.match(DASHBOARD, /class="hero-row dashboard-compact-header"/);
  assert.match(DASHBOARD, /class="dashboard-primary-actions capability-studio"/);
  for (const domain of ["training", "nutrition", "progress", "coach", "social"]) {
    assert.match(DASHBOARD, new RegExp(`capability-card--${domain}`));
  }
  for (const scene of ["training", "nutrition", "benchPr", "coach", "social"]) {
    assert.match(DASHBOARD, new RegExp(`data-v4-illustration="${scene}"`));
  }
  assert.equal((DASHBOARD.match(/class="capability-card capability-card--/g) || []).length, 5);
  assert.match(CSS, /grid-template-columns:\s*repeat\(12,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(DASHBOARD, /🏋|🥗|📈|🧠/u);
});

test("landing uses one continuous canvas and five original illustrated journeys", () => {
  assert.match(LANDING, /data-v4-illustration="deadlift"/);
  for (const word of ["TRAIN", "FUEL", "TRACK", "CONNECT", "COACH"]) assert.match(LANDING, new RegExp(`>${word}<`));
  assert.equal((LANDING.match(/class="journey-illustration" data-v4-illustration=/g) || []).length, 5);
  assert.match(CSS, /\.fp-route-index \.feature-section,[\s\S]*?background:\s*var\(--v4-canvas-light\)/);
  assert.match(CSS, /\.fp-route-index \.final-cta \{[^}]*background:\s*#20283c/s);
});

test("illustrations have one-shot replayable motion and a complete reduced-motion state", () => {
  for (const duration of ["1800", "1800", "1700", "1400", "1600", "2400"]) assert.match(ILLUSTRATIONS, new RegExp(`${duration}`));
  assert.match(ILLUSTRATIONS, /IntersectionObserver/);
  assert.match(ILLUSTRATIONS, /pointerenter/);
  assert.match(ILLUSTRATIONS, /prefers-reduced-motion/);
  assert.match(CSS, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(ILLUSTRATIONS, /aria-hidden="true"/);
});

test("Social music cards use authoritative provider data and protected links", () => {
  for (const provider of ["youtube", "youtube_music", "spotify", "apple_music", "soundcloud", "link"]) {
    assert.match(CSS, new RegExp(`data-music-provider="${provider}"`));
  }
  assert.match(SOCIAL_JS, /data-music-provider="\$\{escapeHtml\(providerKey\)\}"/);
  assert.match(SOCIAL_JS, /target="_blank" rel="noopener noreferrer"/);
  assert.match(SOCIAL_HTML, /data-music-link/);
  assert.doesNotMatch(SOCIAL_HTML, /<iframe/i);
});

test("approved Workout Day navigation and Social workspace architecture remain intact", () => {
  assert.match(WORKOUT, /data-program-day=/);
  assert.match(WORKOUT, /planDaySelect/);
  for (const region of ["social-sidebar", "social-workspace", "social-context-panel"]) assert.match(SOCIAL_HTML, new RegExp(`class="${region}`));
  assert.match(CSS, /\.fp-route-workout-builder \.plan-day-rail/);
});

test("mobile and Hebrew polish keeps core controls visible and localized", () => {
  assert.match(CSS, /@media \(max-width:\s*820px\)[\s\S]*?site-feedback-widget \{ display:\s*none/);
  assert.match(CSS, /messages-view \{ height:\s*calc\(100dvh - 154px/);
  assert.match(CSS, /messages-view \.chat-panel \{ min-height:\s*0 !important; height:\s*100% !important/);
  for (const label of ["תאריך", "רצף", "משך", "תרגילים"]) assert.match(DASHBOARD_JS, new RegExp(label));
  for (const label of ["חדש", "חזרה", "עוד", "קול"]) assert.match(SHELL, new RegExp(label));
  assert.match(SOCIAL_JS, /language === "he" \? "דיווח" : "Report"/);
  assert.match(THEME, /מעבר למצב בהיר/);
  assert.match(THEME, /מעבר למצב כהה/);
});

test("the PWA cache is versioned with the Illustrated V4 assets and private voice remains network-only", () => {
  const sw = read("public", "sw.js");
  assert.match(sw, /fuelphysique-v27-real-athlete-v43-complete-3/);
  assert.match(sw, /illustrated-v4\.css\?v=20260815-real-athlete-v43-complete-3/);
  assert.match(sw, /illustrated-v4\.js\?v=20260815-real-athlete-v43-complete-3/);
  assert.match(sw, /const NETWORK_ONLY_PREFIXES = \['\/api\/'\]/);
  assert.match(sw, /event\.request\.destination === 'audio'/);
});
