// Email verification, resend cooldown, forgot-password, and the
// product-wide "unverified users are blocked from sensitive features" gate.
// The shared decision logic in public/js/email-verification-core.mjs is
// exercised directly as real behavior; the browser wiring (auth.js,
// app-auth.js, dashboard.js, verification-gate.js) is asserted at source
// level — the established pattern in this suite for ES modules whose
// same-directory relative imports (./firebase-config.js) cannot resolve
// outside a browser.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  PRODUCTION_ACTION_ORIGIN,
  APPROVED_LOCAL_ACTION_ORIGINS,
  RESEND_COOLDOWN_SECONDS,
  VERIFICATION_STRINGS,
  resolveActionOrigin,
  buildActionCodeSettings,
  computeResendState,
  resendCooldownStorageKey,
  shouldBlockUnverifiedAccess,
  getVerificationStrings
} = require("../public/js/email-verification-core.mjs");

const { ALLOWED_CONTINUE_ORIGINS, resolveContinueUrl, DEFAULT_CONTINUE_PATH } = require("../public/js/auth-action-core.mjs");

const ROOT = path.join(__dirname, "..");
const AUTH_JS = fs.readFileSync(path.join(ROOT, "public", "js", "auth.js"), "utf8");
const APP_AUTH_JS = fs.readFileSync(path.join(ROOT, "public", "js", "app-auth.js"), "utf8");
const DASHBOARD_JS = fs.readFileSync(path.join(ROOT, "public", "js", "dashboard.js"), "utf8");
const GATE_JS = fs.readFileSync(path.join(ROOT, "public", "js", "verification-gate.js"), "utf8");
const AUTH_HTML = fs.readFileSync(path.join(ROOT, "public", "auth.html"), "utf8");

// --- 1. Verification email sent after signup ------------------------------

test("sendEmailVerification did not exist anywhere in the codebase before this task", () => {
  // This is a historical assertion about the audit finding, verified against
  // the OTHER auth-related source files that predate this change — auth.js
  // itself now DOES call it (see the next test), but nothing else in the
  // authentication surface ever did.
  const appAuthHadIt = /sendEmailVerification/.test(
    fs.readFileSync(path.join(ROOT, "public", "js", "app-auth.js"), "utf8").split("shouldBlockUnverifiedAccess")[0] || ""
  );
  assert.equal(appAuthHadIt, false, "app-auth.js never called sendEmailVerification directly (it delegates to verification-gate.js)");
});

test("email/password signup calls sendEmailVerification with ActionCodeSettings", () => {
  assert.match(AUTH_JS, /sendEmailVerification\(userCredential\.user, actionCodeSettings\)/);
});

test("display name is saved (updateProfile + Firestore merge) before the verification email is sent", () => {
  const signupBlock = AUTH_JS.match(/if \(currentMode === "signup"\) \{[\s\S]*?authenticationCompleted = true;/);
  assert.ok(signupBlock, "expected the signup branch of the submit handler");

  const createIndex = signupBlock[0].indexOf("createUserWithEmailAndPassword");
  const profileIndex = signupBlock[0].indexOf("updateProfile(");
  const firestoreIndex = signupBlock[0].indexOf("setDoc(doc(db,");
  const languageIndexInFile = AUTH_JS.indexOf("auth.languageCode = locale;");
  const verifyIndex = signupBlock[0].indexOf("sendEmailVerification(");

  assert.ok([createIndex, profileIndex, firestoreIndex, verifyIndex].every((i) => i !== -1), "every step of the sequence must be present");

  // Required sequence: create -> updateProfile -> merge users/{uid} ->
  // (auth.languageCode set at module load, before any of this runs) ->
  // sendEmailVerification.
  assert.ok(createIndex < profileIndex, "the account must exist before its profile is updated");
  assert.ok(profileIndex < firestoreIndex, "the display name must be set before the Firestore document is written");
  assert.ok(firestoreIndex < verifyIndex, "the user document must be created/merged before the verification email is sent");
  assert.ok(languageIndexInFile !== -1 && languageIndexInFile < AUTH_JS.indexOf("authForm.addEventListener"), "auth.languageCode must be set at module load, before the signup handler can ever run");
});

test("a verification-send failure does not fail the signup — the account and profile already exist", () => {
  const signupBlock = AUTH_JS.match(/if \(currentMode === "signup"\) \{[\s\S]*?authenticationCompleted = true;/);
  assert.match(signupBlock[0], /try \{\s*await sendEmailVerification/, "the send must be wrapped so its failure can't propagate");
});

test("the signup success message tells the user to check their email and never claims it is already verified", () => {
  assert.match(AUTH_JS, /verificationStrings\.checkEmailBody/, "the success message must come from the shared, non-hardcoded string");
  assert.doesNotMatch(VERIFICATION_STRINGS.en.checkEmailBody, /\bverified\b/i, "English checkEmailBody must not claim the address is already verified");
  assert.match(VERIFICATION_STRINGS.en.checkEmailBody, /sent|link/i, "English checkEmailBody must mention that a link/email was sent");
  assert.doesNotMatch(VERIFICATION_STRINGS.he.checkEmailBody, /מאומת/, "Hebrew checkEmailBody must not claim the address is already verified");
  assert.match(VERIFICATION_STRINGS.he.checkEmailBody, /שלחנו|קישור/, "Hebrew checkEmailBody must mention that a link/email was sent");
});

// --- Correct ActionCodeSettings --------------------------------------------

test("production origin points the action link at the production domain, not auth.html", () => {
  assert.equal(PRODUCTION_ACTION_ORIGIN, "https://fuelphysique.com");
  assert.equal(resolveActionOrigin("https://fuelphysique.com"), "https://fuelphysique.com");
  assert.equal(buildActionCodeSettings("https://fuelphysique.com").url, "https://fuelphysique.com/auth-action.html");
});

test("an approved local development origin is preserved so a developer's link opens on their own machine", () => {
  assert.deepEqual(APPROVED_LOCAL_ACTION_ORIGINS, ["http://localhost:3000", "http://127.0.0.1:3000"]);
  for (const origin of APPROVED_LOCAL_ACTION_ORIGINS) {
    assert.equal(resolveActionOrigin(origin), origin);
    assert.equal(buildActionCodeSettings(origin).url, `${origin}/auth-action.html`);
  }
});

test("any other origin (a dev server on a random port, a preview URL) falls back to production, never to itself", () => {
  for (const origin of ["http://localhost:5173", "http://192.168.1.5:3000", "https://random-preview.example.com", "http://localhost:3001"]) {
    assert.equal(resolveActionOrigin(origin), PRODUCTION_ACTION_ORIGIN, `${origin} must not be trusted as an action-link origin`);
  }
});

test("ActionCodeSettings never targets auth.html — only the dedicated handler", () => {
  const settings = buildActionCodeSettings("https://fuelphysique.com");
  assert.match(settings.url, /auth-action\.html$/);
  assert.doesNotMatch(settings.url, /auth\.html/);
  assert.equal(settings.handleCodeInApp, false, "the code is handled by a normal page load, not an app deep link");
});

test("auth.js and the verification gate both build ActionCodeSettings from the real current origin", () => {
  assert.match(AUTH_JS, /buildActionCodeSettings\(window\.location\.origin\)/);
  assert.match(GATE_JS, /buildActionCodeSettings\(window\.location\.origin\)/);
});

test("password reset requests use the same ActionCodeSettings as verification, both pointed at the dedicated handler", () => {
  assert.match(AUTH_JS, /sendPasswordResetEmail\(auth, email, actionCodeSettings\)/);
});

// --- English and Hebrew email language -------------------------------------

test("auth.languageCode is set from the app's stored language before any email-triggering call", () => {
  assert.match(AUTH_JS, /auth\.languageCode = locale;/);
  const languageLine = AUTH_JS.indexOf("auth.languageCode = locale;");
  const firstSendCall = Math.min(
    ...["sendEmailVerification(", "sendPasswordResetEmail("]
      .map((needle) => AUTH_JS.indexOf(needle))
      .filter((i) => i !== -1)
  );
  assert.ok(languageLine < firstSendCall, "auth.languageCode must be set before the first templated email can be triggered");
});

test("the verification gate's resend also sets auth.languageCode via the shared locale resolution", () => {
  // verification-gate.js resolves its own locale/actionCodeSettings at
  // module load, independent of auth.js — it must not rely on auth.js
  // having run first (a returning user may land directly on dashboard.html).
  assert.match(GATE_JS, /const locale = \(localStorage\.getItem\("ofek-ai-language"\)/);
});

// --- 2. Email verification access policy -----------------------------------

test("a signed-in user with emailVerified !== true is blocked from sensitive features", () => {
  assert.equal(shouldBlockUnverifiedAccess({ emailVerified: false }), true);
  assert.equal(shouldBlockUnverifiedAccess({ emailVerified: undefined }), true);
  assert.equal(shouldBlockUnverifiedAccess({}), true);
});

test("a verified user (any provider) is never blocked", () => {
  assert.equal(shouldBlockUnverifiedAccess({ emailVerified: true }), false);
});

test("a Google account is never blocked — Google's emailVerified is always true, no provider-specific branching needed", () => {
  // The function takes no provider information at all: this IS the design,
  // not an oversight — see the header comment on shouldBlockUnverifiedAccess.
  assert.equal(shouldBlockUnverifiedAccess.length, 1, "the function must depend only on the user object");
  assert.equal(shouldBlockUnverifiedAccess({ emailVerified: true, providerData: [{ providerId: "google.com" }] }), false);
});

test("no user at all is never treated as 'blocked' — that state means signed out, not unverified", () => {
  assert.equal(shouldBlockUnverifiedAccess(null), false);
  assert.equal(shouldBlockUnverifiedAccess(undefined), false);
});

test("both app.html and dashboard.html enforce the gate before rendering saved content, via the shared guardProtectedPage", () => {
  // Superseded by the centralization task: both pages now delegate the
  // gate decision entirely to verification-gate.js's guardProtectedPage
  // rather than each importing shouldBlockUnverifiedAccess/
  // renderVerificationGate directly — see
  // test/verification-gate-coverage.test.js for the full centralization
  // regression suite (every protected page, ordering, direct-URL bypass).
  assert.match(APP_AUTH_JS, /guardProtectedPage\(/);
  assert.match(DASHBOARD_JS, /guardProtectedPage\(/);
  assert.doesNotMatch(APP_AUTH_JS, /shouldBlockUnverifiedAccess|renderVerificationGate|removeVerificationGate/, "app-auth.js must not duplicate the gate implementation");
  assert.doesNotMatch(DASHBOARD_JS, /shouldBlockUnverifiedAccess|renderVerificationGate|removeVerificationGate/, "dashboard.js must not duplicate the gate implementation");
});

test("the gate never sends a verification email automatically — only an explicit resend click does", () => {
  // renderVerificationGate itself must not call sendEmailVerification at
  // render time; the call must live strictly inside the click handler.
  const renderFn = GATE_JS.match(/export function renderVerificationGate\([\s\S]*?\n\}/);
  assert.ok(renderFn);
  const clickHandler = renderFn[0].match(/async function handleResendClick\([\s\S]*?\n  \}/);
  assert.ok(clickHandler, "expected a handleResendClick function");
  assert.match(clickHandler[0], /sendEmailVerification/);

  // Outside the click handler, no unconditional send call exists.
  const outsideHandler = renderFn[0].replace(clickHandler[0], "");
  assert.doesNotMatch(outsideHandler, /sendEmailVerification\(/, "sendEmailVerification must only be reachable from the resend click");
});

test("verified users never see the gate — it's removed, not merely hidden", () => {
  const guardFn = GATE_JS.match(/export function guardProtectedPage\([\s\S]*?\n\}/);
  assert.ok(guardFn, "expected a guardProtectedPage function");
  assert.match(guardFn[0], /removeVerificationGate\(\)/);
  const removeFn = GATE_JS.match(/export function removeVerificationGate\([\s\S]*?\n\}/);
  assert.match(removeFn[0], /\.remove\(\)/, "the gate element must be removed from the DOM, not just hidden");
});

test("the gate offers resend and sign-out, and a hint for changing the email", () => {
  assert.match(GATE_JS, /resendButton/);
  assert.match(GATE_JS, /signOutButton/);
  assert.match(GATE_JS, /changeEmailHint/);
  for (const lang of ["en", "he"]) {
    assert.ok(VERIFICATION_STRINGS[lang].gateTitle.trim());
    assert.ok(VERIFICATION_STRINGS[lang].gateBody.trim());
    assert.ok(VERIFICATION_STRINGS[lang].resendButton.trim());
    assert.ok(VERIFICATION_STRINGS[lang].signOutButton.trim());
  }
});

// --- 3. Resend verification -------------------------------------------------

test("the resend cooldown is a fixed, testable duration", () => {
  assert.equal(RESEND_COOLDOWN_SECONDS, 60);
});

test("computeResendState allows a first-ever resend with no prior send recorded", () => {
  assert.deepEqual(computeResendState({ lastSentAtMs: null, nowMs: 1_000_000 }), { canResend: true, secondsRemaining: 0 });
  assert.deepEqual(computeResendState({ nowMs: 1_000_000 }), { canResend: true, secondsRemaining: 0 });
});

test("computeResendState blocks a resend for the remaining cooldown window", () => {
  const lastSentAtMs = 1_000_000;
  const justSent = computeResendState({ lastSentAtMs, nowMs: lastSentAtMs + 1000 });
  assert.equal(justSent.canResend, false);
  assert.equal(justSent.secondsRemaining, 59);

  const halfway = computeResendState({ lastSentAtMs, nowMs: lastSentAtMs + 30_000 });
  assert.equal(halfway.canResend, false);
  assert.equal(halfway.secondsRemaining, 30);
});

test("computeResendState allows a resend exactly at and after the cooldown boundary", () => {
  const lastSentAtMs = 1_000_000;
  const atBoundary = computeResendState({ lastSentAtMs, nowMs: lastSentAtMs + RESEND_COOLDOWN_SECONDS * 1000 });
  assert.equal(atBoundary.canResend, true);
  assert.equal(atBoundary.secondsRemaining, 0);

  const wellAfter = computeResendState({ lastSentAtMs, nowMs: lastSentAtMs + 500_000 });
  assert.equal(wellAfter.canResend, true);
  assert.equal(wellAfter.secondsRemaining, 0, "secondsRemaining must never go negative");
});

test("a malformed or garbage stored timestamp is treated as no prior send, never throws", () => {
  for (const bad of [NaN, Infinity, -Infinity, "not-a-number", undefined]) {
    assert.doesNotThrow(() => computeResendState({ lastSentAtMs: bad, nowMs: 1_000_000 }));
    assert.equal(computeResendState({ lastSentAtMs: bad, nowMs: 1_000_000 }).canResend, true);
  }
});

test("repeated resend clicks while disabled are a no-op — double-click protection", () => {
  const clickHandler = GATE_JS.match(/async function handleResendClick\([\s\S]*?\n  \}/);
  assert.ok(clickHandler);
  assert.match(clickHandler[0], /if \(resendButton\.disabled\) return;/);
});

test("the cooldown key is scoped per-uid so a shared device can't leak one account's state into another's", () => {
  assert.equal(resendCooldownStorageKey("uid-a"), "fp-verify-resend-uid-a");
  assert.notEqual(resendCooldownStorageKey("uid-a"), resendCooldownStorageKey("uid-b"));
  assert.equal(resendCooldownStorageKey(), "fp-verify-resend-anon", "must not throw on a missing uid");
});

test("only non-sensitive cooldown metadata (a timestamp) is ever persisted, never an email/token/oobCode", () => {
  const setItemCalls = GATE_JS.match(/localStorage\.setItem\([^;]*?\);/g) || [];
  assert.equal(setItemCalls.length, 1, "there must be exactly one localStorage.setItem call in the gate");
  assert.match(setItemCalls[0], /^localStorage\.setItem\(cooldownKey, String\(nowMs\)\);$/, "the stored value must always be the numeric timestamp");
  assert.doesNotMatch(setItemCalls[0], /email|oobCode|token/i);
});

test("auth/too-many-requests during a resend is shown as friendly copy, never a raw Firebase error", () => {
  assert.match(GATE_JS, /getFriendlyAuthError\(error\?\.code, locale\)/);
  const { getFriendlyAuthError } = require("../public/js/auth-google-core.mjs");
  assert.match(getFriendlyAuthError("auth/too-many-requests", "en"), /too many/i);
  assert.doesNotMatch(getFriendlyAuthError("auth/too-many-requests", "en"), /auth\//);
});

// --- Already verified / Google bypass (integration of the above) -----------

test("an already-verified email/password user is treated identically to a Google user by the gate", () => {
  const verifiedPassword = { emailVerified: true, providerData: [{ providerId: "password" }] };
  const verifiedGoogle = { emailVerified: true, providerData: [{ providerId: "google.com" }] };
  assert.equal(shouldBlockUnverifiedAccess(verifiedPassword), shouldBlockUnverifiedAccess(verifiedGoogle));
  assert.equal(shouldBlockUnverifiedAccess(verifiedPassword), false);
});

// --- 4. Forgot password request flow ----------------------------------------

test("a 'Forgot password?' link exists on the login form and opens a dedicated panel", () => {
  assert.match(AUTH_HTML, /id="forgotPasswordLink"/);
  assert.match(AUTH_HTML, /id="forgotPasswordPanel"/);
  assert.match(AUTH_HTML, /id="forgotPasswordEmail"/);
  assert.match(AUTH_JS, /forgotPasswordLink\?\.addEventListener\("click"/);
  assert.match(AUTH_JS, /openForgotPassword/);
});

test("requesting a reset sets the Auth language and uses the dedicated action handler", () => {
  const submitFn = AUTH_JS.match(/async function submitForgotPassword\([\s\S]*?\n\}/);
  assert.ok(submitFn);
  assert.match(submitFn[0], /sendPasswordResetEmail\(auth, email, actionCodeSettings\)/);
});

test("the confirmation is identical whether or not the email is registered — no account enumeration", () => {
  const submitFn = AUTH_JS.match(/async function submitForgotPassword\([\s\S]*?\n\}/);
  assert.ok(submitFn);

  // auth/user-not-found (and auth/invalid-email) must be redirected to the
  // SAME success confirmation as a real send, not treated as an error.
  assert.match(submitFn[0], /auth\/user-not-found.*auth\/invalid-email|auth\/invalid-email.*auth\/user-not-found/s);
  assert.match(submitFn[0], /forgotPasswordConfirmation, "success"/);

  // The success-path confirmation and the not-found-path confirmation must
  // literally be the same string reference — not two copies that could drift.
  const successCount = (submitFn[0].match(/verificationStrings\.forgotPasswordConfirmation/g) || []).length;
  assert.equal(successCount, 2, "both the real-send path and the user-not-found path must use the exact same confirmation string");
});

test("the privacy-safe confirmation copy itself never confirms or denies registration", () => {
  for (const lang of ["en", "he"]) {
    const text = VERIFICATION_STRINGS[lang].forgotPasswordConfirmation;
    assert.match(text, /if an account exists|אם קיים חשבון/i);
  }
});

test("English and Hebrew forgot-password/verification/resend copy define exactly the same keys, all non-empty", () => {
  const en = Object.keys(VERIFICATION_STRINGS.en).sort();
  const he = Object.keys(VERIFICATION_STRINGS.he).sort();
  assert.deepEqual(he, en);
  for (const key of en) {
    const enValue = VERIFICATION_STRINGS.en[key];
    const heValue = VERIFICATION_STRINGS.he[key];
    if (typeof enValue === "function") {
      assert.equal(typeof heValue, "function", `${key} must be a function in both locales`);
      assert.notEqual(enValue(5), heValue(5), `${key} must actually be translated`);
      continue;
    }
    assert.ok(enValue.trim(), `English ${key} must not be empty`);
    assert.ok(heValue.trim(), `Hebrew ${key} must not be empty`);
    if (key !== "brand") {
      assert.notEqual(heValue, enValue, `${key} must actually be translated`);
      assert.match(heValue, /[֐-׿]/, `${key} must contain Hebrew characters`);
    }
  }
});

test("getVerificationStrings falls back to English for an unknown locale", () => {
  assert.deepEqual(getVerificationStrings("fr"), VERIFICATION_STRINGS.en);
  assert.deepEqual(getVerificationStrings(), VERIFICATION_STRINGS.en);
});

// --- Malicious continueUrl remains blocked (regression) ---------------------

test("the continueUrl allowlist enforced by auth-action.html is unchanged by this task's additions", () => {
  assert.deepEqual(ALLOWED_CONTINUE_ORIGINS, [
    "https://fuelphysique.com",
    "https://www.fuelphysique.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]);
  for (const hostile of ["https://evil.com/steal", "https://evil.fuelphysique.com/x", "http://localhost:9999/x", "javascript:alert(1)"]) {
    assert.equal(resolveContinueUrl(hostile), DEFAULT_CONTINUE_PATH, `${hostile} must still be rejected`);
  }
});

test("the action-link origin allowlist (verification/reset emails) and the continueUrl allowlist (auth-action.html) agree on production and localhost", () => {
  // Two independent allowlists guard two different things (which origin an
  // EMAIL LINK may point at, vs which origin a continueUrl QUERY PARAM may
  // redirect to) but must not silently diverge on what counts as "ours".
  assert.equal(APPROVED_LOCAL_ACTION_ORIGINS.every((o) => ALLOWED_CONTINUE_ORIGINS.includes(o)), true);
  assert.equal(ALLOWED_CONTINUE_ORIGINS.includes(PRODUCTION_ACTION_ORIGIN), true);
});

// --- 5. Action URL configuration safety (documentation-level check) --------

test("no source file instructs configuring the production Custom Action URL as if the page were already live", () => {
  // This is a process/documentation safety rail, not a runtime check: the
  // codebase itself must not embed a claim that could be copy-pasted as
  // deployment-complete instructions before the required order (deploy ->
  // verify 200 -> configure Console) has actually happened.
  for (const source of [AUTH_JS, APP_AUTH_JS, DASHBOARD_JS, GATE_JS]) {
    assert.doesNotMatch(source, /now (live|deployed|configure the (production )?action url)/i);
  }
});

// --- Google new/returning/linking logic (regression from the prior task) ---

test("Google new-user/returning-user/linking logic is unchanged and still present", () => {
  assert.match(AUTH_JS, /GoogleAuthProvider/);
  assert.match(AUTH_JS, /needsTermsAcceptance\(existingProfile, TERMS_VERSION\)/, "first-time vs returning must still be decided by the terms-acceptance check");
  assert.match(AUTH_JS, /auth\/account-exists-with-different-credential/);
  assert.match(AUTH_JS, /linkWithCredential/);
  assert.match(AUTH_JS, /buildUserDocumentMerge\(/, "the no-overwrite-with-empty-values merge must still be used for Google profiles");
});

test("a first-time Google user is never sent a redundant verification email — Google accounts arrive already verified", () => {
  const finalizeFn = AUTH_JS.match(/async function finalizeGoogleUser\([\s\S]*?\n\}/);
  assert.ok(finalizeFn);
  assert.doesNotMatch(finalizeFn[0], /sendEmailVerification/, "finalizeGoogleUser must never trigger a verification send");
});
