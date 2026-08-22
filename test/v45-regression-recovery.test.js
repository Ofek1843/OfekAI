"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

test("critical regression gates cover every product system protected by V4.5", () => {
  const gates = read("docs", "CRITICAL-REGRESSION-GATES.md");
  for (const required of [
    "Workout Builder", "Nutrition Generator", "Athlete Core", "Dashboard and navigation",
    "Authentication", "V4 real-athlete scenes", "PWA", "Social, voice, music, and push",
  ]) assert.match(gates, new RegExp(required, "i"));
  assert.match(gates, /Every exercise exposes a discoverable `Replace` action/);
  assert.match(gates, /Every meal exposes a discoverable `Replace` action/);
});

test("the product hamburger is a modal side drawer with focus and dismissal controls", () => {
  const shell = read("public", "js", "redesign-shell.js");
  const css = read("public", "css", "redesign-v1.css");
  assert.match(shell, /fp-global-menu-backdrop/);
  assert.match(shell, /setAttribute\("role", "dialog"\)/);
  assert.match(shell, /setAttribute\("aria-modal", "true"\)/);
  assert.match(shell, /event\.key !== "Tab"/);
  assert.match(shell, /restoreFocus\.focus/);
  assert.match(css, /\.fp-global-menu\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*2202;[\s\S]*?height:\s*100dvh;/);
  assert.match(css, /\.fp-global-menu-backdrop\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*2201;/);
  assert.match(css, /body\.fp-global-menu-open\s*\{[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /html\[dir="rtl"\] \.fp-global-menu\s*\{[\s\S]*?inset-inline-end:\s*0;/);
  assert.match(css, /\.fp-global-menu-link\s*\{[\s\S]*?min-height:\s*52px;/);
  assert.match(shell, /ofekai:settings-saved/);
});

test("workout and meal replacement controls remain visible, stateful, and scoped", () => {
  const workout = read("public", "js", "workout-builder.js");
  const workoutCss = read("public", "css", "workout-builder.css");
  const nutrition = read("public", "js", "nutrition-builder.js");
  const server = read("server.js");
  assert.match(workout, /class="reroll-button"[\s\S]*?>\$\{isHebrew \? "החלפה" : "Replace"\}<\/button>/);
  assert.match(workout, /rerollButton\.setAttribute\("aria-busy", "true"\)/);
  assert.match(workout, /"\/api\/workout-builder\/reroll-exercise"/);
  assert.match(workoutCss, /\.reroll-button:focus-visible/);
  assert.match(nutrition, /class="nutrition-reroll-meal-button"/);
  assert.match(nutrition, /rerollButton\.setAttribute\("aria-busy", "true"\)/);
  assert.match(nutrition, /"\/api\/nutrition-builder\/reroll-meal"/);
  assert.match(server, /app\.post\("\/api\/workout-builder\/reroll-exercise"/);
  assert.match(server, /app\.post\("\/api\/nutrition-builder\/reroll-meal"/);
  assert.match(server, /reservedSiblingExerciseIds/);
  assert.match(server, /exclude:\s*\[\.\.\.usedMealIds\]/);
});

test("Save Workout has an explicit high-contrast and keyboard-visible state", () => {
  const css = read("public", "css", "workout-builder.css");
  assert.match(css, /\.save-program-button\s*\{[\s\S]*?background:\s*linear-gradient\(135deg, #52d9e6 0%, #64b5ff 100%\);[\s\S]*?color:\s*#04111f;/);
  assert.match(css, /\.save-program-button:focus-visible\s*\{[\s\S]*?outline:\s*3px solid #ffffff;/);
  assert.match(css, /\.save-program-button:disabled\s*\{[\s\S]*?background:\s*#8392a8;[\s\S]*?color:\s*#101827;/);
});

test("the regenerated FUEL athlete matte has alpha and no large neutral edge fringe", async () => {
  const manifest = JSON.parse(read("public", "assets", "athlete-motion", "v43", "manifest.json"));
  const frame = manifest.scenes.plate.frames[3];
  const imagePath = path.join(ROOT, "public", "assets", "athlete-motion", "v43", "plate", "normalized", frame.file);
  const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let neutralEdgePixels = 0;
  for (let y = 1; y < Math.min(600, info.height - 1); y += 1) {
    for (let x = 1; x < info.width - 1; x += 1) {
      const offset = (y * info.width + x) * 4;
      if (!data[offset + 3]) continue;
      let touchesTransparent = false;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (data[((y + dy) * info.width + x + dx) * 4 + 3] === 0) touchesTransparent = true;
        }
      }
      if (!touchesTransparent) continue;
      const channels = [data[offset], data[offset + 1], data[offset + 2]];
      if (Math.min(...channels) > 220 && Math.max(...channels) - Math.min(...channels) < 24) neutralEdgePixels += 1;
    }
  }
  assert.equal(info.channels, 4);
  assert.ok(neutralEdgePixels < 180, `expected fewer than 180 neutral edge pixels, saw ${neutralEdgePixels}`);
  assert.equal(frame.source, "frame-04-regenerated.png");
  assert.equal(frame.normalizedBytes, fs.statSync(imagePath).size);
});

test("athlete polish keeps the Deadlift floor stable and removes the Session studio separator", async () => {
  const manifest = JSON.parse(read("public", "assets", "athlete-motion", "v43", "manifest.json"));
  assert.deepEqual(manifest.scenes.deadlift.canvas, { width: 720, height: 720 });
  assert.ok(manifest.scenes.deadlift.frames.every((frame) => frame.placement.top + frame.placement.height === 700));
  assert.ok(manifest.scenes.deadlift.frames.every((frame) => frame.placement.width === 440));

  for (const frame of manifest.scenes.session.frames) {
    const imagePath = path.join(ROOT, "public", "assets", "athlete-motion", "v43", "session", "normalized", frame.file);
    const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let visibleSeparatorPixels = 0;
    for (let y = 18; y <= 710; y += 1) {
      for (let x = 198; x <= 562; x += 1) {
        const inFormerSeparator = y <= 46 || (y <= 220 && (x <= 222 || x >= 538));
        if (!inFormerSeparator) continue;
        const offset = (y * info.width + x) * 4;
        if (data[offset + 3] < 40) continue;
        const channels = [data[offset], data[offset + 1], data[offset + 2]];
        if (Math.min(...channels) >= 210 && Math.max(...channels) - Math.min(...channels) <= 52) visibleSeparatorPixels += 1;
      }
    }
    assert.ok(visibleSeparatorPixels < 80, `${frame.file} retains ${visibleSeparatorPixels} visible separator pixels`);
  }
});

test("the landing Login CTA remains a full-size colored control", () => {
  const css = read("public", "css", "v45-deep-ocean.css");
  assert.match(css, /\.hero-btn\.secondary\s*\{[\s\S]*?display:\s*inline-flex\s*!important;/);
  assert.match(css, /\.hero-btn\.secondary\s*\{[\s\S]*?min-width:\s*132px;/);
  assert.match(css, /\.hero-btn\.secondary\s*\{[\s\S]*?linear-gradient/);
});
