// The shared guard resolves authentication and current Terms before private
// data loads. Email verification is optional and must not gate app access.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const GATE_JS = fs.readFileSync(path.join(ROOT, "public", "js", "verification-gate.js"), "utf8");
const GUARDED_PAGES = [
  "public/js/app-auth.js", "public/js/dashboard.js", "public/js/workout-builder.js",
  "public/js/nutrition-builder.js", "public/js/workout-tracker.js", "public/js/my-workout-plans.js",
  "public/js/my-nutrition-plans.js", "public/js/progress.js", "public/js/exercise-progress.js",
  "public/js/workout-history.js", "public/js/log-workout.js", "public/js/manual-workout-builder.js",
  "public/js/running.js"
];
const PARALLEL_PAGES = ["public/js/settings.js", "public/js/user-profile.js"];
const read = relative => fs.readFileSync(path.join(ROOT, relative), "utf8");

test("protected pages share the auth guard instead of adding separate verification gates", () => {
  for (const file of GUARDED_PAGES) {
    const source = read(file);
    assert.match(source, /guardProtectedPage/, file);
    assert.match(source, /from\s*["'](?:\.\/|\/js\/)?verification-gate\.js["']/, file);
    assert.doesNotMatch(source, /function renderVerificationGate|function removeVerificationGate/, file);
  }
});

test("parallel settings and profile loaders do not add an email verification gate", () => {
  for (const file of PARALLEL_PAGES) assert.doesNotMatch(read(file), /shouldBlockUnverifiedAccess/, file);
});

test("authenticated unverified users can use the private transformation form", () => {
  const source = read("public/js/transformation-submit.js");
  assert.match(source, /const isUsable = Boolean\(user\)/);
  assert.doesNotMatch(source, /shouldBlockUnverifiedAccess/);
});

test("guard waits for auth and current Terms, but never checks email verification", () => {
  const fn = GATE_JS.match(/export function guardProtectedPage\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.ok(fn.indexOf('document.body.style.visibility = "hidden"') < fn.indexOf("onAuthStateChanged(auth,"));
  assert.ok(fn.indexOf("if (!user)") < fn.indexOf("requiresCurrentTerms(user)"));
  assert.ok(fn.indexOf("requiresCurrentTerms(user)") < fn.lastIndexOf("proceed(user)"));
  assert.doesNotMatch(fn, /shouldBlockUnverifiedAccess|emailVerified|renderVerificationGate/);
  assert.equal((fn.match(/document.body.style.visibility = "visible"/g) || []).length, 1);
});

test("guard initializes a page at most once and redirects signed-out users with a safe return path", () => {
  const fn = GATE_JS.match(/export function guardProtectedPage\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.match(fn, /let initialized = false;/);
  assert.match(fn, /if \(initialized\) return;/);
  assert.equal((fn.match(/onAuthenticated\?\.\(/g) || []).length, 1);
  const signedOut = fn.match(/if \(!user\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(signedOut);
  assert.match(signedOut, /window\.location\.replace\(destination\)/);
  assert.doesNotMatch(fn.replace(signedOut, ""), /location\.(replace|href|assign)/);
});

test("the optional verification email UI can resend only on an explicit click", () => {
  const renderFn = GATE_JS.match(/export function renderVerificationGate\([\s\S]*?\n\}/)?.[0];
  assert.ok(renderFn);
  const clickHandler = renderFn.match(/async function handleResendClick\([\s\S]*?\n  \}/)?.[0];
  assert.ok(clickHandler);
  assert.match(clickHandler, /sendEmailVerification/);
  assert.doesNotMatch(renderFn.replace(clickHandler, ""), /sendEmailVerification\(/);
});

test("Google and email/password use the same general app access policy", () => {
  const fn = GATE_JS.match(/export function guardProtectedPage\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.doesNotMatch(fn, /google\.com|providerId|GoogleAuthProvider|emailVerified|shouldBlockUnverifiedAccess/);
});
