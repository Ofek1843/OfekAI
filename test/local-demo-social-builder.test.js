"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildLocalWorkoutProgram } = require("../lib/local-demo-generators");
const { repairWorkoutProgram } = require("../lib/workout-repair");
const { validateWorkoutProgram } = require("../lib/workout-validator");
const { builderErrorMessage } = require("../public/js/builder-errors.mjs");

const ROOT = path.join(__dirname, "..");
const SERVER = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
const SOCIAL = fs.readFileSync(path.join(ROOT, "public", "js", "social.js"), "utf8");
const SOCIAL_HTML = fs.readFileSync(path.join(ROOT, "public", "social.html"), "utf8");
const SOCIAL_ROUTER = fs.readFileSync(path.join(ROOT, "lib", "social-router.js"), "utf8");
const FIREBASE_CONFIG = fs.readFileSync(path.join(ROOT, "public", "js", "firebase-config.js"), "utf8");

test("local workout generation is server-controlled, canonical and strict", () => {
  const allowed = ["dumbbell", "cable", "machine"];
  const program = buildLocalWorkoutProgram({ goal: "buildMuscle", daysPerWeek: 3, sessionDuration: 60, equipment: allowed, trainingStyle: "gym" });
  program.weeklyScheduleDays = [1, 3, 5];
  repairWorkoutProgram(program, { sessionDuration: 60, equipment: allowed, experience: "intermediate", priority: "buildMuscle", daysPerWeek: 3, applyVolumeTargets: true });
  const result = validateWorkoutProgram(program, { daysPerWeek: 3, sessionDuration: 60, equipment: allowed, availableDayIndexes: [1, 3, 5], goalProfile: "hypertrophy" });
  assert.equal(result.ok, true);
  assert.equal(result.equipmentOk, true);
  assert.ok(program.sessions.flatMap((session) => session.exercises).every((exercise) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(exercise.exerciseId)));
  assert.ok(program.sessions.flatMap((session) => session.exercises).every((exercise) => allowed.includes(exercise.equipment.toLowerCase())));
});

test("local mode bypasses provider calls only behind the explicit server flag", () => {
  assert.match(SERVER, /process\.env\.FUELPHYSIQUE_LOCAL_DEMO === "1"/);
  assert.match(SERVER, /localDemoMode\s*\?\s*JSON\.stringify\(buildLocalWorkoutProgram/);
  assert.match(SERVER, /localDemoMode \? "" : await createChatCompletion/);
  assert.doesNotMatch(SERVER, /req\.query\.localDemo/);
});

test("builder status mapping does not label auth or rate failures as provider failures", () => {
  assert.match(builderErrorMessage({ status: 401, data: { error: "OpenAI API request failed" } }), /session expired/i);
  assert.match(builderErrorMessage({ status: 403, data: {} }), /verification|permission/i);
  assert.match(builderErrorMessage({ status: 429, data: {} }), /too many requests/i);
  assert.match(builderErrorMessage({ status: 502, data: {} }), /temporarily unavailable/i);
});

test("social page removes the header language switch and adds bounded realtime/typing paths", () => {
  assert.doesNotMatch(SOCIAL_HTML, /id="languageButton"/);
  assert.match(SOCIAL, /where\("toUid"/);
  assert.match(SOCIAL, /limit\(25\)/);
  assert.match(SOCIAL, /typing\/stream/);
  assert.match(SOCIAL, /stopTypingChannel/);
  assert.match(SOCIAL_ROUTER, /typing\.addStream/);
  assert.match(SOCIAL_ROUTER, /typing\.setTyping/);
  assert.doesNotMatch(SOCIAL, /collection\([^)]*typing/);
});

test("loopback Firebase client uses the same demo project as the local emulators", () => {
  assert.match(FIREBASE_CONFIG, /projectId: localEmulatorMode \? "demo-fuelphysique"/);
  assert.match(FIREBASE_CONFIG, /connectFirestoreEmulator\(db, "127\.0\.0\.1", 8080\)/);
  assert.match(FIREBASE_CONFIG, /connectAuthEmulator\(auth, "http:\/\/127\.0\.0\.1:9099"/);
});
