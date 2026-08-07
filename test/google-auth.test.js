// Google account authentication: the shared decision logic
// (public/js/auth-google-core.mjs) is exercised directly as real behavior,
// and the browser wiring (public/js/auth.js, public/auth.html) is asserted at
// source level — the established pattern in this suite for ES modules whose
// same-directory relative imports (./firebase-config.js, ./analytics.js)
// cannot resolve outside a browser.
//
// Covered per the feature spec: new Google account, returning Google user,
// existing email/password collision, provider linking, terms acceptance,
// cancelled popup, blocked popup, mobile redirect, English, Hebrew,
// next=workout-builder.html, next=nutrition-builder.html, standalone PWA,
// and logout-then-login-again.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  TERMS_VERSION,
  ALLOWED_NEXT_PATHS,
  DEFAULT_NEXT_PATH,
  GOOGLE_OAUTH_SCOPES,
  REDIRECT_NEXT_STORAGE_KEY,
  resolveNextPath,
  shouldUseRedirect,
  needsTermsAcceptance,
  mergeAuthProviders,
  buildUserDocumentMerge,
  getFriendlyAuthError,
  isUserCancelledAuth,
  getAuthStrings,
  AUTH_UI_STRINGS
} = require("../public/js/auth-google-core.mjs");

const ROOT = path.join(__dirname, "..");
const AUTH_JS = fs.readFileSync(path.join(ROOT, "public", "js", "auth.js"), "utf8");
const AUTH_HTML = fs.readFileSync(path.join(ROOT, "public", "auth.html"), "utf8");
const CORE_MJS = fs.readFileSync(path.join(ROOT, "public", "js", "auth-google-core.mjs"), "utf8");

// --- Email/password must survive untouched -------------------------------

test("email/password authentication is preserved, not replaced, by the Google path", () => {
  assert.match(AUTH_JS, /createUserWithEmailAndPassword/, "email/password signup must still exist");
  assert.match(AUTH_JS, /signInWithEmailAndPassword/, "email/password login must still exist");
  assert.match(AUTH_HTML, /id="authForm"/, "the email/password form must still exist");
  assert.match(AUTH_HTML, /id="password"/);
  assert.match(AUTH_HTML, /id="email"/);
  assert.match(AUTH_HTML, /id="rememberMe"/, "remember-me must be preserved");
});

// --- 1. Firebase provider ------------------------------------------------

test("the Google provider uses popup, redirect and getRedirectResult from Firebase Auth", () => {
  assert.match(AUTH_JS, /GoogleAuthProvider/);
  assert.match(AUTH_JS, /signInWithPopup/);
  assert.match(AUTH_JS, /signInWithRedirect/);
  assert.match(AUTH_JS, /getRedirectResult/);
  assert.match(AUTH_JS, /linkWithCredential/);
});

// Comments legitimately NAME the scopes we refuse to request, so the
// sensitive-scope scan must run against code only — otherwise the very
// comment documenting the policy trips the check enforcing it.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("no Google scope beyond basic authentication is ever requested", () => {
  assert.deepEqual(GOOGLE_OAUTH_SCOPES, [], "the product must not request extra OAuth scopes");

  // Belt and braces: even if someone later adds an addScope() call, it must
  // never reference a sensitive Google API.
  const forbidden = /gmail|contacts|drive|calendar|spreadsheets|youtube|photoslibrary/i;
  assert.doesNotMatch(stripComments(AUTH_JS), forbidden, "auth.js must not request Gmail/Contacts/Drive/Calendar scopes");
  assert.doesNotMatch(stripComments(CORE_MJS), forbidden, "the core module must not request a sensitive scope");
  assert.doesNotMatch(stripComments(AUTH_HTML), forbidden, "auth.html must not reference a sensitive scope");
});

// --- Popup vs redirect: mobile, desktop, standalone PWA ------------------

const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const MAC_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
const IPAD_UA = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("suitable desktop browsers use the popup flow", () => {
  assert.equal(shouldUseRedirect({ userAgent: DESKTOP_UA }), false);
  assert.equal(shouldUseRedirect({ userAgent: MAC_UA }), false);
});

test("mobile browsers use the redirect flow", () => {
  assert.equal(shouldUseRedirect({ userAgent: IPHONE_UA }), true, "iOS Safari blocks the popup outright");
  assert.equal(shouldUseRedirect({ userAgent: ANDROID_UA }), true);
  assert.equal(shouldUseRedirect({ userAgent: IPAD_UA }), true);
});

test("a standalone/installed PWA always uses the redirect flow, even on desktop", () => {
  assert.equal(
    shouldUseRedirect({ userAgent: DESKTOP_UA, isStandalone: true }),
    true,
    "a popup opened from a standalone PWA lands in a detached context whose result can never be read"
  );
  assert.equal(shouldUseRedirect({ userAgent: IPHONE_UA, isStandalone: true }), true);
});

test("an unknown/empty user agent falls back to the popup rather than an unnecessary full-page redirect", () => {
  assert.equal(shouldUseRedirect({}), false);
  assert.equal(shouldUseRedirect({ userAgent: "" }), false);
});

test("auth.js chooses popup vs redirect from the shared helper and detects standalone display mode", () => {
  assert.match(AUTH_JS, /shouldUseRedirect\(\s*\{[\s\S]*?userAgent:\s*window\.navigator\.userAgent/);
  assert.match(AUTH_JS, /display-mode:\s*standalone/);
  assert.match(AUTH_JS, /navigator\.standalone/, "iOS Safari's legacy standalone flag must also be honored");
});

// --- 2. UI ---------------------------------------------------------------

test("auth.html has a Google button on the card with the official multi-color Google mark", () => {
  assert.match(AUTH_HTML, /id="googleButton"/);
  assert.match(AUTH_HTML, /Continue with Google/);

  // The official four brand colors must all be present and must not have been
  // recolored to match the theme.
  for (const brandColor of ["#EA4335", "#4285F4", "#FBBC05", "#34A853"]) {
    assert.ok(AUTH_HTML.includes(brandColor), `the Google mark must keep its official ${brandColor} path`);
  }
  assert.match(AUTH_HTML, /<svg viewBox="0 0 48 48"/, "the icon must be inlined SVG, not a remote image");
});

test("an 'or' separator sits between the Google button and the email/password form", () => {
  const separatorIndex = AUTH_HTML.indexOf('id="authSeparator"');
  const googleIndex = AUTH_HTML.indexOf('id="googleButton"');
  const formIndex = AUTH_HTML.indexOf('id="authForm"');

  assert.ok(separatorIndex !== -1, "expected an auth separator element");
  assert.ok(googleIndex < separatorIndex, "the separator must come after the Google button");
  assert.ok(separatorIndex < formIndex, "the separator must come before the email/password form");
  assert.match(AUTH_HTML, /class="auth-separator"/);
});

test("the Google button exposes loading and disabled states", () => {
  assert.match(AUTH_JS, /function setGoogleButtonBusy/);
  assert.match(AUTH_JS, /googleButton\.disabled = isBusy/);
  assert.match(AUTH_JS, /strings\.googleLoading/);
  assert.match(AUTH_HTML, /\.google-button:disabled/, "a disabled visual state must exist");
});

test("the Blue Abyss theme and existing layout are preserved", () => {
  assert.match(AUTH_HTML, /theme\.css/, "the shared theme stylesheet must still be linked");
  assert.match(AUTH_HTML, /ocean-depth-layer/, "the Blue Abyss backdrop must be preserved");
  assert.match(AUTH_HTML, /class="auth-card"/);
  assert.match(AUTH_HTML, /class="auth-tabs"/, "the login/signup tabs must be preserved");
  // The Google button follows the card's radius/weight language.
  assert.match(AUTH_HTML, /\.google-button\s*\{[^}]*border-radius:\s*13px/);
});

// --- English / Hebrew ----------------------------------------------------

test("every user-visible Google/terms/linking string exists in both English and Hebrew", () => {
  const englishKeys = Object.keys(AUTH_UI_STRINGS.en).sort();
  const hebrewKeys = Object.keys(AUTH_UI_STRINGS.he).sort();
  assert.deepEqual(hebrewKeys, englishKeys, "the Hebrew string table must define exactly the same keys as English");

  for (const key of englishKeys) {
    assert.ok(AUTH_UI_STRINGS.en[key].trim(), `English "${key}" must not be empty`);
    assert.ok(AUTH_UI_STRINGS.he[key].trim(), `Hebrew "${key}" must not be empty`);
  }
});

test("the Hebrew equivalent of 'Continue with Google' is real Hebrew, not the English string", () => {
  const hebrew = getAuthStrings("he").continueWithGoogle;
  assert.notEqual(hebrew, getAuthStrings("en").continueWithGoogle);
  assert.match(hebrew, /[֐-׿]/, "the Hebrew label must contain Hebrew characters");
  assert.match(hebrew, /Google/, "the Google brand name stays untranslated per Google's brand guidance");
});

test("an unknown locale falls back to English rather than returning undefined labels", () => {
  assert.deepEqual(getAuthStrings("fr"), AUTH_UI_STRINGS.en);
  assert.deepEqual(getAuthStrings(), AUTH_UI_STRINGS.en);
});

test("auth.js resolves the locale from the app-wide language key and applies labels at render time", () => {
  assert.match(AUTH_JS, /localStorage\.getItem\("ofek-ai-language"\)/, "must reuse the app-wide language key");
  assert.match(AUTH_JS, /getAuthStrings\(/);
  assert.match(AUTH_JS, /function applyLocalizedLabels/);
});

test("Hebrew RTL is scoped to the new elements, never applied to the whole document", () => {
  const apply = AUTH_JS.match(/function applyLocalizedLabels\([\s\S]*?\n\}/);
  assert.ok(apply, "expected an applyLocalizedLabels function");
  assert.match(apply[0], /"rtl"/, "Hebrew must still set RTL on the localized elements");
  assert.doesNotMatch(
    apply[0],
    /documentElement\.setAttribute\(\s*"dir"/,
    "flipping <html dir> would right-align the pre-existing English email/password form"
  );
  // The scoped element list may grow as new feature panels are added (e.g.
  // the forgot-password panel) — what must hold is that it's a specific,
  // named list of elements, not the whole document.
  const scopedListMatch = apply[0].match(/for \(const element of \[([^\]]+)\]\)/);
  assert.ok(scopedListMatch, "expected a scoped element list, not a document-wide RTL flip");
  const scopedElements = scopedListMatch[1].split(",").map((s) => s.trim());
  for (const required of ["googleButton", "termsGatePanel", "linkAccountPanel"]) {
    assert.ok(scopedElements.includes(required), `${required} must remain in the RTL-scoped element list`);
  }
});

test("the terms-gate consent sentence is localized and keeps a real link to the terms", () => {
  // Regression: the consent copy was previously left as hardcoded English
  // markup, so a Hebrew user saw an otherwise-Hebrew gate with an English
  // consent sentence.
  const render = AUTH_JS.match(/function renderTermsGateConsent\([\s\S]*?\n\}/);
  assert.ok(render, "expected a renderTermsGateConsent function");
  assert.match(render[0], /strings\.termsGateCheckboxBefore/);
  assert.match(render[0], /strings\.termsGateCheckboxLink/);
  assert.match(render[0], /strings\.termsGateCheckboxAfter/);
  assert.match(render[0], /link\.href = "\/terms\.html"/, "the consent sentence must still link to the terms");
  assert.match(render[0], /rel = "noopener"/);

  // Built from DOM nodes, never an HTML string.
  assert.doesNotMatch(render[0], /innerHTML/, "the consent sentence must not be assembled via innerHTML");
  assert.match(render[0], /createTextNode/);

  assert.match(AUTH_JS, /applyLocalizedLabels[\s\S]*?renderTermsGateConsent\(\)/, "the consent sentence must be rendered during label application");

  // Both locales must supply all three parts, and Hebrew must be real Hebrew.
  for (const part of ["termsGateCheckboxBefore", "termsGateCheckboxLink", "termsGateCheckboxAfter"]) {
    assert.ok(AUTH_UI_STRINGS.en[part]?.trim(), `English ${part} must exist`);
    assert.ok(AUTH_UI_STRINGS.he[part]?.trim(), `Hebrew ${part} must exist`);
  }
  assert.match(AUTH_UI_STRINGS.he.termsGateCheckboxLink, /[֐-׿]/);
});

// --- Friendly errors: cancelled popup, blocked popup ---------------------

test("a cancelled popup is a neutral notice, never an alarming failure", () => {
  for (const code of ["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"]) {
    assert.equal(isUserCancelledAuth(code), true, `${code} must be treated as a deliberate cancellation`);

    const english = getFriendlyAuthError(code, "en");
    assert.match(english, /cancelled/i);
    assert.doesNotMatch(english, /failed|error/i, "cancelling is not a failure and must not be worded as one");

    assert.match(getFriendlyAuthError(code, "he"), /[֐-׿]/);
  }

  assert.equal(isUserCancelledAuth("auth/popup-blocked"), false, "a blocked popup is not a user cancellation");
  assert.equal(isUserCancelledAuth("auth/network-request-failed"), false);
});

test("auth.js renders a cancelled sign-in as a neutral message, not a red error", () => {
  assert.match(
    AUTH_JS,
    /isUserCancelledAuth\(error\?\.code\)\s*\?\s*"success"\s*:\s*"error"/,
    "cancellation must not be styled as an error"
  );
});

test("a blocked popup gives actionable advice and falls back to redirect on the next attempt", () => {
  const english = getFriendlyAuthError("auth/popup-blocked", "en");
  assert.match(english, /blocked/i);
  assert.match(english, /popup|pop-up/i);
  assert.match(getFriendlyAuthError("auth/popup-blocked", "he"), /[֐-׿]/);

  assert.match(AUTH_JS, /auth\/popup-blocked/);
  assert.match(AUTH_JS, /preferRedirectFallback = true/, "a blocked popup must switch the next attempt to redirect");
  assert.match(AUTH_JS, /preferRedirectFallback \|\| shouldUseRedirect/);
});

test("every friendly error is human copy in both locales — never a raw Firebase code", () => {
  const codes = [
    "auth/invalid-email", "auth/missing-password", "auth/weak-password",
    "auth/email-already-in-use", "auth/invalid-credential", "auth/too-many-requests",
    "auth/network-request-failed", "auth/popup-closed-by-user", "auth/popup-blocked",
    "auth/account-exists-with-different-credential", "auth/credential-already-in-use",
    "auth/operation-not-allowed", "auth/unauthorized-domain", "auth/some-code-we-never-mapped"
  ];

  for (const code of codes) {
    for (const lang of ["en", "he"]) {
      const message = getFriendlyAuthError(code, lang);
      assert.ok(message && message.trim(), `${lang}/${code} must produce a message`);
      assert.doesNotMatch(message, /auth\//, `${lang}/${code} must not leak the raw error code`);
    }
  }
});

// --- 3. Terms and health disclaimer --------------------------------------

test("a brand-new Google user (no profile document) must accept the terms before product access", () => {
  assert.equal(needsTermsAcceptance(null), true);
  assert.equal(needsTermsAcceptance(undefined), true);
  assert.equal(needsTermsAcceptance({}), true, "a profile with no acceptance recorded must be gated");
});

test("a returning Google user on the current terms version is never re-prompted", () => {
  const profile = { termsAccepted: true, termsVersion: TERMS_VERSION };
  assert.equal(needsTermsAcceptance(profile), false);
});

test("an outdated or falsified acceptance is re-prompted", () => {
  assert.equal(needsTermsAcceptance({ termsAccepted: true, termsVersion: "2020-01-01" }), true, "an older version must re-prompt");
  assert.equal(needsTermsAcceptance({ termsAccepted: false, termsVersion: TERMS_VERSION }), true);
  assert.equal(needsTermsAcceptance({ termsAccepted: "yes", termsVersion: TERMS_VERSION }), true, "only a strict boolean true counts as acceptance");
  assert.equal(needsTermsAcceptance({ termsVersion: TERMS_VERSION }), true);
});

test("Google sign-up cannot bypass the terms gate: the gate is shown INSTEAD of redirecting", () => {
  assert.match(AUTH_HTML, /id="termsGatePanel"/);
  assert.match(AUTH_HTML, /id="termsGateAccepted"/);
  assert.match(AUTH_HTML, /href="\/terms\.html"/, "the gate must link to the actual terms");

  // finalizeGoogleUser must return early (open the gate) before it can write
  // a non-accepting profile or redirect.
  const finalize = AUTH_JS.match(/async function finalizeGoogleUser\([\s\S]*?\n\}/);
  assert.ok(finalize, "expected a finalizeGoogleUser function");
  const gateIndex = finalize[0].indexOf("needsTermsAcceptance");
  const redirectIndex = finalize[0].indexOf("redirectToProduct");
  assert.ok(gateIndex !== -1 && redirectIndex !== -1);
  assert.ok(gateIndex < redirectIndex, "the terms check must run before any redirect into the product");
  assert.match(finalize[0], /openPanel\(termsGatePanel\)[\s\S]*?return;/, "the gate must short-circuit the flow");
});

test("declining the terms signs the user back out instead of leaving an un-accepted session", () => {
  const cancel = AUTH_JS.match(/async function cancelTermsAcceptance\([\s\S]*?\n\}/);
  assert.ok(cancel, "expected a cancelTermsAcceptance function");
  assert.match(cancel[0], /signOut\(auth\)/);
});

test("accepting the terms records acceptance, version and timestamp together", () => {
  const payload = buildUserDocumentMerge({
    authUser: { email: "new@example.com", displayName: "New User" },
    existingProfile: null,
    providerId: "google.com",
    acceptedTermsVersion: TERMS_VERSION,
    now: "SERVER_TIMESTAMP"
  });

  assert.equal(payload.termsAccepted, true);
  assert.equal(payload.termsVersion, TERMS_VERSION);
  assert.equal(payload.termsAcceptedAt, "SERVER_TIMESTAMP");
});

test("a returning user's existing acceptance timestamp is never rewritten on subsequent sign-ins", () => {
  const payload = buildUserDocumentMerge({
    authUser: { email: "returning@example.com" },
    existingProfile: { termsAccepted: true, termsVersion: TERMS_VERSION, termsAcceptedAt: "ORIGINAL" },
    providerId: "google.com",
    acceptedTermsVersion: null, // no fresh acceptance happened
    now: "SERVER_TIMESTAMP"
  });

  assert.ok(!("termsAccepted" in payload), "an unchanged acceptance must not be rewritten");
  assert.ok(!("termsVersion" in payload), "an unchanged acceptance must not be rewritten");
  assert.ok(!("termsAcceptedAt" in payload), "the original acceptance timestamp must be preserved");
});

test("the email/password signup path still writes the same terms fields and shares one version constant", () => {
  assert.match(AUTH_JS, /termsVersion:\s*TERMS_VERSION/, "email signup must use the shared constant, not a hardcoded date");
  assert.doesNotMatch(AUTH_JS, /termsVersion:\s*"2026-/, "no hardcoded terms version may remain in auth.js");
  assert.match(AUTH_JS, /You must accept the Terms and Health Disclaimer/, "the email signup terms check must be preserved");
});

// --- 4. User document ----------------------------------------------------

test("first Google authentication creates the full user document", () => {
  const payload = buildUserDocumentMerge({
    authUser: {
      email: "first@example.com",
      displayName: "First User",
      photoURL: "https://lh3.googleusercontent.com/a/photo"
    },
    existingProfile: null,
    providerId: "google.com",
    acceptedTermsVersion: TERMS_VERSION,
    now: "NOW"
  });

  assert.equal(payload.email, "first@example.com");
  assert.equal(payload.displayName, "First User");
  assert.equal(payload.photoURL, "https://lh3.googleusercontent.com/a/photo");
  assert.deepEqual(payload.authProviders, ["google.com"]);
  assert.equal(payload.createdAt, "NOW");
  assert.equal(payload.updatedAt, "NOW");
  assert.equal(payload.termsAccepted, true);
});

test("an existing profile is never overwritten with empty provider values", () => {
  const existingProfile = {
    email: "kept@example.com",
    displayName: "Name The User Chose",
    photoURL: "https://example.com/existing.png",
    authProviders: ["password"],
    createdAt: "ORIGINAL_CREATED_AT"
  };

  const payload = buildUserDocumentMerge({
    // A Google account that supplies no displayName and no photoURL.
    authUser: { email: "", displayName: "", photoURL: "" },
    existingProfile,
    providerId: "google.com",
    acceptedTermsVersion: null,
    now: "NOW"
  });

  assert.equal(payload.email, "kept@example.com", "an empty provider email must not blank the stored one");
  assert.equal(payload.displayName, "Name The User Chose", "an empty provider name must not blank the stored one");
  assert.equal(payload.photoURL, "https://example.com/existing.png", "an empty provider photo must not blank the stored one");
  assert.ok(!("createdAt" in payload), "createdAt must not be reset on an existing profile");
});

test("a display name the user customized wins over the Google account name", () => {
  const payload = buildUserDocumentMerge({
    authUser: { email: "u@example.com", displayName: "Google Account Name" },
    existingProfile: { displayName: "Custom Name From Settings" },
    providerId: "google.com",
    now: "NOW"
  });

  assert.equal(
    payload.displayName,
    "Custom Name From Settings",
    "signing in with Google must not revert a name the user edited in Settings"
  );
});

test("whitespace-only provider values count as empty and never overwrite stored values", () => {
  const payload = buildUserDocumentMerge({
    authUser: { email: "   ", displayName: "  ", photoURL: "\t" },
    existingProfile: { email: "real@example.com", displayName: "Real Name", photoURL: "https://example.com/p.png" },
    providerId: "google.com",
    now: "NOW"
  });

  assert.equal(payload.email, "real@example.com");
  assert.equal(payload.displayName, "Real Name");
  assert.equal(payload.photoURL, "https://example.com/p.png");
});

test("a profile with no stored value at all simply omits the key rather than writing an empty string", () => {
  const payload = buildUserDocumentMerge({
    authUser: { email: "only@example.com" },
    existingProfile: null,
    providerId: "google.com",
    now: "NOW"
  });

  assert.equal(payload.email, "only@example.com");
  assert.ok(!("displayName" in payload), "an absent display name must be omitted, never written as \"\"");
  assert.ok(!("photoURL" in payload), "an absent photo must be omitted, never written as \"\"");
});

test("auth.js writes the user document with merge:true, never a destructive overwrite", () => {
  const setDocCalls = AUTH_JS.match(/setDoc\(/g) || [];
  const mergeCalls = AUTH_JS.match(/\{\s*merge:\s*true\s*\}/g) || [];
  assert.ok(setDocCalls.length >= 3, "expected the email-signup, terms-gate and returning-user writes");
  assert.equal(mergeCalls.length, setDocCalls.length, "every setDoc must pass { merge: true }");
});

// --- 5. Existing email account collisions / provider linking -------------

test("provider lists merge without duplicates and preserve first-use order", () => {
  assert.deepEqual(mergeAuthProviders(["password"], "google.com"), ["password", "google.com"]);
  assert.deepEqual(mergeAuthProviders(["google.com"], "google.com"), ["google.com"], "no duplicate on repeat sign-in");
  assert.deepEqual(mergeAuthProviders(null, "google.com"), ["google.com"]);
  assert.deepEqual(mergeAuthProviders(undefined, "password"), ["password"]);
  assert.deepEqual(mergeAuthProviders(["password", "google.com"], "password"), ["password", "google.com"]);
});

test("malformed stored provider values are discarded rather than propagated", () => {
  assert.deepEqual(mergeAuthProviders(["password", "", null, 42, "  "], "google.com"), ["password", "google.com"]);
  assert.deepEqual(mergeAuthProviders("not-an-array", "google.com"), ["google.com"]);
});

test("linking a Google credential to an existing password account records both providers and keeps the original uid's data", () => {
  const existingProfile = {
    email: "collides@example.com",
    displayName: "Existing User",
    authProviders: ["password"],
    createdAt: "ORIGINAL_CREATED_AT",
    termsAccepted: true,
    termsVersion: TERMS_VERSION
  };

  const payload = buildUserDocumentMerge({
    authUser: { email: "collides@example.com", displayName: "Existing User", photoURL: "https://lh3.googleusercontent.com/a/x" },
    existingProfile,
    providerId: "google.com",
    acceptedTermsVersion: null,
    now: "NOW"
  });

  assert.deepEqual(payload.authProviders, ["password", "google.com"], "both providers must be recorded");
  assert.ok(!("createdAt" in payload), "the original signup date must be preserved");
  assert.ok(!("termsAccepted" in payload), "the existing acceptance must be preserved untouched");
  assert.equal(payload.photoURL, "https://lh3.googleusercontent.com/a/x", "a newly available photo may still be added");
});

test("the collision error is handled with a safe linking flow, never a silent duplicate identity", () => {
  assert.match(AUTH_JS, /auth\/account-exists-with-different-credential/);
  assert.match(AUTH_JS, /GoogleAuthProvider\.credentialFromError/, "the pending Google credential must be recovered from the error");
  assert.match(AUTH_JS, /function startAccountLinking/);
  assert.match(AUTH_HTML, /id="linkAccountPanel"/);
  assert.match(AUTH_HTML, /id="linkPassword"/, "the user must prove ownership with the existing password");

  // The order that makes linking safe: authenticate with the EXISTING method
  // first, then attach the Google credential to that same user.
  const submit = AUTH_JS.match(/async function submitAccountLinking\([\s\S]*?\n\}/);
  assert.ok(submit, "expected a submitAccountLinking function");
  const signInIndex = submit[0].indexOf("signInWithEmailAndPassword");
  const linkIndex = submit[0].indexOf("linkWithCredential");
  assert.ok(signInIndex !== -1 && linkIndex !== -1);
  assert.ok(signInIndex < linkIndex, "the existing account must be authenticated BEFORE the Google credential is linked");
});

test("the collision message explains the situation instead of showing a generic failure", () => {
  const english = getFriendlyAuthError("auth/account-exists-with-different-credential", "en");
  assert.match(english, /already have/i);
  assert.match(english, /password/i, "the copy must tell the user which method to use");
  assert.doesNotMatch(english, /^Authentication failed/, "this must not fall through to the generic default");

  const hebrew = getFriendlyAuthError("auth/account-exists-with-different-credential", "he");
  assert.match(hebrew, /[֐-׿]/);
  assert.notEqual(hebrew, getFriendlyAuthError("default", "he"));
});

test("cancelling the linking flow clears the pending credential and signs out", () => {
  const cancel = AUTH_JS.match(/async function cancelAccountLinking\([\s\S]*?\n\}/);
  assert.ok(cancel, "expected a cancelAccountLinking function");
  assert.match(cancel[0], /pendingGoogleCredential = null/, "the held credential must not outlive the flow");
  assert.match(cancel[0], /signOut\(auth\)/);
});

// --- 6. Redirect, persistence, next destination --------------------------

test("next=workout-builder.html and next=nutrition-builder.html are preserved", () => {
  assert.equal(resolveNextPath("workout-builder.html"), "/workout-builder.html");
  assert.equal(resolveNextPath("nutrition-builder.html"), "/nutrition-builder.html");
  assert.deepEqual(ALLOWED_NEXT_PATHS, ["workout-builder.html", "nutrition-builder.html", "social.html", "workout-tracker.html"]);
});

test("any other next value falls back to the dashboard — the login page is not an open redirect", () => {
  assert.equal(resolveNextPath(null), DEFAULT_NEXT_PATH);
  assert.equal(resolveNextPath(""), DEFAULT_NEXT_PATH);
  assert.equal(resolveNextPath("dashboard.html"), DEFAULT_NEXT_PATH);
  assert.equal(resolveNextPath("//evil.example.com"), DEFAULT_NEXT_PATH, "protocol-relative URLs must not be honored");
  assert.equal(resolveNextPath("https://evil.example.com"), DEFAULT_NEXT_PATH);
  assert.equal(resolveNextPath("../../etc/passwd"), DEFAULT_NEXT_PATH);
  assert.equal(resolveNextPath("/workout-builder.html"), "/workout-builder.html", "protected-page login recovery accepts the same internal path with a leading slash");
});

test("the requested destination survives a mobile redirect round trip via session storage", () => {
  assert.ok(REDIRECT_NEXT_STORAGE_KEY, "a storage key must be defined");
  assert.match(AUTH_JS, /safeSessionSet\(REDIRECT_NEXT_STORAGE_KEY, requestedNext\)/, "next must be stored before redirecting away");
  assert.match(AUTH_JS, /storedNext = safeSessionGet\(REDIRECT_NEXT_STORAGE_KEY\)/, "next must be restored on return");
  assert.match(AUTH_JS, /resolveNextPath\(requestedNext \|\| storedNext\)/, "the restored value must still go through the allowlist");
  assert.match(AUTH_JS, /safeSessionRemove\(REDIRECT_NEXT_STORAGE_KEY\)/, "the stored value must be cleared after use");
});

test("session storage access is guarded — private-mode browsers must not break sign-in", () => {
  for (const fn of ["safeSessionGet", "safeSessionSet", "safeSessionRemove"]) {
    const match = AUTH_JS.match(new RegExp(`function ${fn}\\([\\s\\S]*?\\n\\}`));
    assert.ok(match, `expected a ${fn} helper`);
    assert.match(match[0], /try\s*\{/, `${fn} must tolerate a throwing storage API`);
  }
});

test("remember-me persistence is applied to the Google flow, not just email/password", () => {
  const googleFlow = AUTH_JS.match(/async function startGoogleSignIn\([\s\S]*?\n\}/);
  assert.ok(googleFlow, "expected a startGoogleSignIn function");
  assert.match(googleFlow[0], /setPersistence/);
  assert.match(googleFlow[0], /rememberMeInput\?\.checked/);
  assert.match(googleFlow[0], /browserLocalPersistence/);
  assert.match(googleFlow[0], /browserSessionPersistence/);
});

test("redirect loops are prevented: the auth-state guard cannot bounce a user out of an open gate", () => {
  const guard = AUTH_JS.match(/onAuthStateChanged\(auth, \(user\) => \{[\s\S]*?\n  \}\);/);
  assert.ok(guard, "expected an onAuthStateChanged guard");
  assert.match(
    guard[0],
    /if \(googleFlowInProgress \|\| isPanelOpen\(\)\)/,
    "the guard must stand down while a terms gate or linking panel is open"
  );

  // The guard is registered only AFTER getRedirectResult resolves, otherwise
  // it races the redirect return and redirects before the gate can run.
  const redirectResultIndex = AUTH_JS.indexOf("getRedirectResult(auth)");
  const guardIndex = AUTH_JS.indexOf("onAuthStateChanged(auth, (user)");
  assert.ok(redirectResultIndex !== -1 && guardIndex !== -1);
  assert.ok(
    redirectResultIndex < guardIndex,
    "the redirect result must be resolved before the auth-state guard is registered"
  );
});

test("logging out and back in works: sign-out is available and a signed-out visitor sees the form", () => {
  const appAuth = fs.readFileSync(path.join(ROOT, "public", "js", "app-auth.js"), "utf8");
  assert.match(appAuth, /signOut\(auth\)/, "the product pages must still offer logout");
  assert.match(appAuth, /window\.location\.replace\(\s*"\/auth\.html"\s*\)/, "logout must return to the auth page");

  // Back on auth.html, a signed-out visitor must have the page revealed
  // rather than being left on the hidden 'auth-checking' screen.
  const guard = AUTH_JS.match(/onAuthStateChanged\(auth, \(user\) => \{[\s\S]*?\n  \}\);/);
  assert.match(guard[0], /revealPage\(\)/);
  assert.match(AUTH_JS, /function revealPage\(\)[\s\S]*?auth-checking/);
});

test("the terms gate and linking panel hide the form instead of stacking a modal over it", () => {
  assert.match(AUTH_HTML, /body\.auth-panel-open #authForm[\s\S]*?display:\s*none/);
  assert.match(AUTH_HTML, /\.auth-panel\s*\{\s*display:\s*none/);
  assert.match(AUTH_HTML, /\.auth-panel\.visible\s*\{\s*display:\s*block/);
});

// --- Console handoff -----------------------------------------------------

test("no private key or secret is introduced by the Google integration", () => {
  const secretish = /(-----BEGIN|private_key|client_secret|serviceAccount)/i;
  assert.doesNotMatch(AUTH_JS, secretish);
  assert.doesNotMatch(CORE_MJS, secretish);
  assert.doesNotMatch(AUTH_HTML, secretish);
});

test("an unconfigured Google provider degrades gracefully instead of dead-ending the user", () => {
  // Until Google is enabled in the Firebase Console, Firebase returns
  // auth/operation-not-allowed (and auth/unauthorized-domain on a domain
  // that isn't authorized). Both must point the user at email/password
  // rather than showing a generic failure.
  for (const code of ["auth/operation-not-allowed", "auth/unauthorized-domain"]) {
    const english = getFriendlyAuthError(code, "en");
    assert.match(english, /email and password/i, `${code} must fall back to the email/password path`);
    assert.match(getFriendlyAuthError(code, "he"), /[֐-׿]/);
  }
});
