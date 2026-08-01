// Centralized verification-gate coverage: every protected page must use the
// single shared verification-gate.js implementation (never a duplicated
// gate), must resolve auth state -> verify sign-in -> verify the email
// policy -> only THEN initialize private data loading, and a direct-URL
// visit while unverified must never briefly reveal protected content.
//
// Source-level assertions against the real files -- the established pattern
// in this suite for ES modules whose same-directory relative imports
// (./firebase-config.js) cannot resolve outside a browser. The live,
// interactive behavior (gate actually appearing, resend working, "I've
// verified my email" restoring the page in place) was verified against a
// real disposable Firebase test account in the Browser pane; see the
// release report.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const GATE_JS = fs.readFileSync(path.join(ROOT, "public", "js", "verification-gate.js"), "utf8");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

// Every page that loads, saves, or writes private user data. Each entry is
// the source file whose guard was centralized in this change.
const GUARD_PROTECTED_PAGE_FILES = [
  "public/js/app-auth.js",
  "public/js/dashboard.js",
  "public/js/workout-builder.js",
  "public/js/nutrition-builder.js",
  "public/js/workout-tracker.js",
  "public/js/my-workout-plans.js",
  "public/js/my-nutrition-plans.js",
  "public/js/progress.js",
  "public/js/exercise-progress.js",
  "public/js/workout-history.js",
  "public/js/log-workout.js",
  "public/js/manual-workout-builder.js",
  "public/js/running.js"
];

// transformation-submit.js keeps its own inline-warning pattern (the page
// is a public form, not a fully gated page) but must still block an
// unverified user via the same shouldBlockUnverifiedAccess check -- listed
// separately since it doesn't call guardProtectedPage.
const INLINE_GATE_FILE = "public/js/transformation-submit.js";

// Pages whose own onAuthStateChanged independently touches Firestore on the
// SAME page as app.html's app-auth.js gate -- app-auth.js hiding the body
// is not sufficient on its own for these, since they run in parallel via
// separate <script type="module"> tags.
const PARALLEL_SCRIPT_GATED_FILES = ["public/js/settings.js", "public/js/user-profile.js"];

test("every protected page imports guardProtectedPage from the single shared module, never a duplicated implementation", () => {
  for (const file of GUARD_PROTECTED_PAGE_FILES) {
    const source = read(file);
    assert.match(source, /guardProtectedPage/, `${file} must call guardProtectedPage`);
    assert.match(
      source,
      /from\s*["'](?:\.\/|\/js\/)?verification-gate\.js["']/,
      `${file} must import from verification-gate.js`
    );
    // Never a second copy of the gate's own decision logic.
    assert.doesNotMatch(source, /function renderVerificationGate/, `${file} must not duplicate renderVerificationGate`);
    assert.doesNotMatch(source, /function removeVerificationGate/, `${file} must not duplicate removeVerificationGate`);
  }
});

test("the inline-warning page (transformation-submit.js) still blocks unverified users via the shared policy function", () => {
  const source = read(INLINE_GATE_FILE);
  assert.match(source, /shouldBlockUnverifiedAccess/);
  assert.match(source, /from\s+["']\.\/verification-gate\.js["']/);
});

test("parallel same-page scripts (settings.js, user-profile.js) each check the email policy independently", () => {
  // app.html loads app-auth.js AND these two as separate <script
  // type="module"> tags that each run their own onAuthStateChanged --
  // app-auth.js hiding the body does not stop these from independently
  // reading/writing Firestore, so each must check for itself.
  for (const file of PARALLEL_SCRIPT_GATED_FILES) {
    const source = read(file);
    assert.match(source, /shouldBlockUnverifiedAccess/, `${file} must check the email policy independently`);
    assert.match(source, /from\s+["']\.\/verification-gate\.js["']/, `${file} must import from the shared module`);
  }
});

test("guardProtectedPage keeps the page hidden until the email policy is resolved -- never reveals then covers", () => {
  const fn = GATE_JS.match(/export function guardProtectedPage\([\s\S]*?\n\}/);
  assert.ok(fn, "expected a guardProtectedPage function");

  const hideIndex = fn[0].indexOf('document.body.style.visibility = "hidden"');
  const authStateIndex = fn[0].indexOf("onAuthStateChanged(auth,");
  assert.ok(hideIndex !== -1 && authStateIndex !== -1);
  assert.ok(hideIndex < authStateIndex, "the page must be hidden before auth state is even subscribed to");

  // The ONLY two places that reveal the page: the blocked branch (revealing
  // the GATE, not the feature) and proceed() (after verification clears).
  const revealCount = (fn[0].match(/document\.body\.style\.visibility = "visible"/g) || []).length;
  assert.equal(revealCount, 2, "expected exactly two reveal points: the gate itself, and after verification clears");
});

test("guardProtectedPage's ordering is: resolve auth -> verify signed in -> verify email policy -> only then initialize", () => {
  const fn = GATE_JS.match(/export function guardProtectedPage\([\s\S]*?\n\}/);
  assert.ok(fn);

  const notSignedInIndex = fn[0].indexOf("if (!user)");
  const policyCheckIndex = fn[0].indexOf("shouldBlockUnverifiedAccess(user)");
  const proceedCallIndex = fn[0].lastIndexOf("proceed(user)");

  assert.ok(notSignedInIndex !== -1 && policyCheckIndex !== -1 && proceedCallIndex !== -1);
  assert.ok(notSignedInIndex < policyCheckIndex, "sign-in must be verified before the email policy is even checked");
  assert.ok(policyCheckIndex < proceedCallIndex, "the email policy must be verified before onAuthenticated ever runs");
});

test("onAuthenticated runs at most once per page load -- guarded against duplicate initialization", () => {
  const fn = GATE_JS.match(/export function guardProtectedPage\([\s\S]*?\n\}/);
  assert.ok(fn);
  assert.match(fn[0], /let initialized = false;/);
  assert.match(fn[0], /if \(initialized\) return;/);
  assert.match(fn[0], /initialized = true;/);
  // onAuthenticated must be reachable only through the single proceed()
  // function that enforces this guard -- never called directly elsewhere.
  const onAuthenticatedCalls = (fn[0].match(/onAuthenticated\?\.\(/g) || []).length;
  assert.equal(onAuthenticatedCalls, 1, "onAuthenticated must be invoked from exactly one call site (inside proceed)");
});

test("a signed-out user is redirected (default /auth.html, or a caller-supplied destination) without ever calling onAuthenticated", () => {
  const fn = GATE_JS.match(/export function guardProtectedPage\([\s\S]*?\n\}/);
  assert.ok(fn);
  const notSignedInBlock = fn[0].match(/if \(!user\) \{[\s\S]*?\n    \}/);
  assert.ok(notSignedInBlock);
  assert.doesNotMatch(notSignedInBlock[0], /onAuthenticated/, "the not-signed-in branch must never call onAuthenticated");
  assert.match(notSignedInBlock[0], /onSignedOut/);
  assert.match(notSignedInBlock[0], /window\.location\.replace\("\/auth\.html"\)/);
});

test("no redirect loop: guardProtectedPage never navigates once a user is signed in, verified or not", () => {
  const fn = GATE_JS.match(/export function guardProtectedPage\([\s\S]*?\n\}/);
  assert.ok(fn);
  // Every navigation call must be inside the `if (!user)` branch -- once a
  // user object exists (verified or blocked-pending-verification), the
  // function must only toggle DOM state in place, never navigate away.
  const withoutSignedOutBranch = fn[0].replace(/if \(!user\) \{[\s\S]*?\n    \}/, "");
  assert.doesNotMatch(withoutSignedOutBranch, /location\.(replace|href|assign)/, "no navigation may happen outside the signed-out branch");
});

test("the recovery flow (verify in another tab, click 'I've verified my email') restores the SAME page in place -- no navigation", () => {
  const recheckFn = GATE_JS.match(/async function recheckVerification\([\s\S]*?\n  \}/);
  assert.ok(recheckFn, "expected a recheckVerification function");
  assert.match(recheckFn[0], /await user\.reload\(\)/);
  assert.match(recheckFn[0], /if \(!shouldBlockUnverifiedAccess\(user\)\)/);
  assert.match(recheckFn[0], /onVerified\?\.\(user\)/);
  assert.doesNotMatch(recheckFn[0], /location\.(replace|href|assign)|window\.location/, "recovery must never navigate/reload the page");
});

test("recovery also happens automatically on tab focus/visibility, silently (no error nag for a user who merely switched tabs)", () => {
  const renderFn = GATE_JS.match(/export function renderVerificationGate\([\s\S]*?\n\}/);
  assert.ok(renderFn);
  assert.match(renderFn[0], /window\.addEventListener\("focus", silentRecheck/);
  assert.match(renderFn[0], /visibilitychange/);
  assert.match(renderFn[0], /recheckVerification\(\{ silent: true \}\)/);
});

test("auto-recheck listeners are torn down on gate removal -- no listener leak across a resend/verify cycle", () => {
  const removeFn = GATE_JS.match(/export function removeVerificationGate\([\s\S]*?\n\}/);
  assert.ok(removeFn);
  assert.match(removeFn[0], /recheckListenersController\?\.abort\(\)/);
  assert.match(GATE_JS, /new AbortController\(\)/);
});

test("Google (always-verified) users bypass every one of these guards identically to a verified password user", () => {
  // shouldBlockUnverifiedAccess itself is provider-agnostic (see
  // email-verification.test.js for the direct behavioral proof); this
  // confirms guardProtectedPage doesn't add any Google-specific branch that
  // could diverge from that.
  const fn = GATE_JS.match(/export function guardProtectedPage\([\s\S]*?\n\}/);
  assert.ok(fn);
  assert.doesNotMatch(fn[0], /google\.com|providerId|GoogleAuthProvider/i, "no provider-specific branching may exist in the page guard");
});
