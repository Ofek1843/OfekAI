// Firebase email action handler (public/auth-action.html): the shared
// decision logic in public/js/auth-action-core.mjs is exercised directly as
// real behavior, and the browser wiring is asserted at source level — the
// established pattern in this suite for ES modules whose same-directory
// relative imports (./firebase-config.js) cannot resolve outside a browser.
//
// Also covers the auth.html landing-copy update, which must not have
// disturbed any authentication logic, layout or styling.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  SUPPORTED_MODES,
  MIN_PASSWORD_LENGTH,
  ALLOWED_CONTINUE_ORIGINS,
  DEFAULT_CONTINUE_PATH,
  ACTION_STRINGS,
  isSupportedMode,
  validatePassword,
  resolveContinueUrl,
  resolveLocale,
  isRtlLocale,
  classifyActionFailure,
  containsSensitiveDetail,
  getActionStrings,
  passwordErrorMessage,
  failureCopy
} = require("../public/js/auth-action-core.mjs");

const ROOT = path.join(__dirname, "..");

// These tests assert on source TEXT, and several of their patterns anchor on
// "\n}" to find the end of a function. The repository has no .gitattributes,
// so on a Windows checkout with core.autocrlf=true every file arrives with
// CRLF terminators and those patterns silently stop matching -- a green suite
// on CI and a red one on a developer's machine, for a file nobody edited.
// Normalize on read so the assertions describe the code rather than the
// checkout's line-ending flavour.
const readSource = (...segments) =>
  fs.readFileSync(path.join(ROOT, ...segments), "utf8").replace(/\r\n/g, "\n");

const ACTION_HTML = readSource("public", "auth-action.html");
const ACTION_JS = readSource("public", "js", "auth-action.js");
const ACTION_CSS = readSource("public", "css", "auth-action.css");
const AUTH_HTML = readSource("public", "auth.html");

// --- Landing copy --------------------------------------------------------

test("the auth landing subtitle describes the real product without chat/conversation language", () => {
  const brand = AUTH_HTML.match(/<header class="brand">[\s\S]*?<\/header>/);
  assert.ok(brand, "expected the brand header");
  const subtitle = brand[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  assert.doesNotMatch(subtitle, /conversation/i, "the subtitle must not mention conversations");
  assert.doesNotMatch(subtitle, /\bchat\b/i, "the subtitle must not mention chat");
  assert.doesNotMatch(subtitle, /fitness assistant/i, "the old copy must be gone");

  for (const pillar of [/workout/i, /nutrition/i, /progress/i, /AI/]) {
    assert.match(subtitle, pillar, `the subtitle must cover ${pillar}`);
  }

  // "Do not mention AI first": the sentence must lead with something else.
  const withoutBrand = subtitle.replace(/^FuelPhysique\s*/, "");
  assert.doesNotMatch(withoutBrand, /^AI\b/i, "the copy must not open with AI");
  assert.ok(withoutBrand.indexOf("AI") > 20, "AI must not be the first thing mentioned");

  // English only.
  assert.doesNotMatch(subtitle, /[֐-׿]/, "the subtitle is English only");
});

test("the landing copy change did not disturb authentication markup", () => {
  // Every element the auth logic binds to must still be present.
  for (const id of ["authForm", "email", "password", "rememberMe", "googleButton", "termsGatePanel", "linkAccountPanel", "loginTab", "signupTab", "submitButton"]) {
    assert.match(AUTH_HTML, new RegExp(`id="${id}"`), `#${id} must still exist after the copy change`);
  }
  assert.match(AUTH_HTML, /src="\/js\/auth\.js"/, "the auth script must still be wired");
});

// --- Supported modes -----------------------------------------------------

test("exactly the three specified Firebase email action modes are supported", () => {
  assert.deepEqual(SUPPORTED_MODES, ["verifyEmail", "resetPassword", "recoverEmail"]);
  for (const mode of SUPPORTED_MODES) assert.equal(isSupportedMode(mode), true);
});

test("any other mode is rejected rather than passed through to Firebase", () => {
  for (const mode of ["signIn", "revertSecondFactorAddition", "", null, undefined, "VERIFYEMAIL", "verifyemail", "../verifyEmail"]) {
    assert.equal(isSupportedMode(mode), false, `${String(mode)} must not be treated as supported`);
  }
});

test("the handler reads mode, oobCode, continueUrl and lang, and refuses an unsupported mode or missing code", () => {
  for (const param of ["mode", "oobCode", "continueUrl", "lang"]) {
    assert.match(ACTION_JS, new RegExp(`params\\.get\\("${param}"\\)`), `must read ${param}`);
  }
  assert.match(
    ACTION_JS,
    /if \(!isSupportedMode\(mode\) \|\| !oobCode\)/,
    "an unsupported mode or missing code must short-circuit to the failure state"
  );
});

test("each supported mode maps to the correct Firebase call", () => {
  assert.match(ACTION_JS, /applyActionCode\(auth, oobCode\)/, "verifyEmail/recoverEmail apply the code");
  assert.match(ACTION_JS, /verifyPasswordResetCode\(auth, oobCode\)/, "the reset code is validated before the form is shown");
  assert.match(ACTION_JS, /confirmPasswordReset\(auth, oobCode, newPassword\.value\)/);
  assert.match(ACTION_JS, /checkActionCode\(auth, oobCode\)/, "recoverEmail must read the address before applying");

  // The reset code must be verified BEFORE the user is asked for a secret.
  const handler = ACTION_JS.match(/async function handleResetPassword\([\s\S]*?\n\}/);
  assert.ok(handler);
  assert.ok(
    handler[0].indexOf("verifyPasswordResetCode") < handler[0].indexOf('showPanel("reset")'),
    "the code must be validated before the password form is shown"
  );
});

// --- continueUrl validation (security) -----------------------------------

test("only fuelphysique.com and approved localhost origins are allowed", () => {
  assert.deepEqual(ALLOWED_CONTINUE_ORIGINS, [
    "https://fuelphysique.com",
    "https://www.fuelphysique.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]);
});

test("an allowlisted continueUrl is reduced to its same-origin path, never trusted as an absolute URL", () => {
  assert.equal(resolveContinueUrl("https://fuelphysique.com/workout-builder.html"), "/workout-builder.html");
  assert.equal(resolveContinueUrl("https://www.fuelphysique.com/nutrition-builder.html?x=1"), "/nutrition-builder.html?x=1");
  assert.equal(resolveContinueUrl("http://localhost:3000/dashboard.html"), "/dashboard.html");

  // The result must always be a path, so navigation can only stay in-app.
  const resolved = resolveContinueUrl("https://fuelphysique.com/progress.html");
  assert.ok(resolved.startsWith("/"), "the result must be an app-relative path");
  assert.doesNotMatch(resolved, /^https?:/, "the result must never be an absolute URL");
});

test("every non-allowlisted origin is rejected — this is not an open redirect", () => {
  const hostile = [
    "https://evil.com/steal",
    "https://evil.com",
    // Subdomain of the real domain: must NOT pass, a wildcard here would
    // trust every current and future subdomain including a taken-over one.
    "https://evil.fuelphysique.com/x",
    "https://fuelphysique.com.evil.com/x",
    // Lookalike suffix that a naive endsWith check would accept.
    "https://notfuelphysique.com/x",
    // Wrong scheme for the real domain.
    "http://fuelphysique.com/x",
    // Wrong port for localhost.
    "http://localhost:9999/x",
    "http://localhost/x"
  ];

  for (const url of hostile) {
    assert.equal(resolveContinueUrl(url), DEFAULT_CONTINUE_PATH, `${url} must be rejected`);
  }
});

test("non-HTTP schemes are rejected before the origin is even considered", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "vbscript:msgbox(1)"
  ]) {
    assert.equal(resolveContinueUrl(url), DEFAULT_CONTINUE_PATH, `${url} must be rejected`);
  }
});

test("relative, protocol-relative, malformed and empty values all fall back to the dashboard", () => {
  for (const url of ["", "   ", null, undefined, 42, {}, "/workout-builder.html", "//evil.com/x", "not a url", "://"]) {
    assert.equal(resolveContinueUrl(url), DEFAULT_CONTINUE_PATH, `${String(url)} must fall back`);
  }
});

test("a bare allowlisted origin falls back to the dashboard rather than landing on '/'", () => {
  assert.equal(resolveContinueUrl("https://fuelphysique.com"), DEFAULT_CONTINUE_PATH);
  assert.equal(resolveContinueUrl("https://fuelphysique.com/"), DEFAULT_CONTINUE_PATH);
});

test("auth-action.js validates continueUrl through the allowlist before using it as a destination", () => {
  assert.match(ACTION_JS, /const continuePath = resolveContinueUrl\(continueUrlParam\)/);
  assert.match(ACTION_JS, /setAttribute\("href", continuePath\)/, "the destination must be the validated path");
  assert.doesNotMatch(ACTION_JS, /href", continueUrlParam/, "the raw parameter must never be used as a destination");
});

// --- Secrets never leak --------------------------------------------------

test("the action code is stripped from the URL as soon as it has been read", () => {
  assert.match(ACTION_JS, /history\.replaceState\(\{\}, document\.title, window\.location\.pathname\)/);
  assert.match(ACTION_JS, /scrubUrl\(\)/);
});

test("the page is marked noindex and sends no referrer, so the code cannot leak via crawlers or headers", () => {
  assert.match(ACTION_HTML, /<meta name="robots" content="noindex, nofollow"/);
  assert.match(ACTION_HTML, /<meta name="referrer" content="no-referrer"/);
});

test("no rendered string may carry a Firebase error code or the action code", () => {
  assert.equal(containsSensitiveDetail("auth/invalid-action-code"), true);
  assert.equal(containsSensitiveDetail("Firebase: something failed"), true);
  assert.equal(containsSensitiveDetail("Your link expired", { oobCode: "ABC123" }), false);
  assert.equal(containsSensitiveDetail("code ABC123 failed", { oobCode: "ABC123" }), true);

  // Every piece of shipped copy must pass its own check.
  for (const lang of ["en", "he"]) {
    for (const [key, value] of Object.entries(ACTION_STRINGS[lang])) {
      assert.equal(
        containsSensitiveDetail(value),
        false,
        `${lang}.${key} must not contain a Firebase reference or error code`
      );
    }
  }
});

test("setText refuses to paint anything sensitive, as a last line of defense", () => {
  const setTextFn = ACTION_JS.match(/function setText\([\s\S]*?\n\}/);
  assert.ok(setTextFn, "expected a setText helper");
  assert.match(setTextFn[0], /containsSensitiveDetail\(text, \{ oobCode \}\)/);
  assert.match(setTextFn[0], /strings\.genericBody/, "a sensitive string must degrade to safe generic copy");
});

test("no Firebase error object is ever rendered — only a classified friendly state", () => {
  assert.match(ACTION_JS, /showFailure\(error\?\.code\)/, "the raw error must go through classification");
  assert.doesNotMatch(ACTION_JS, /textContent\s*=\s*error/, "an error object must never be painted directly");
  assert.doesNotMatch(ACTION_JS, /error\.message/, "a Firebase message must never be surfaced");

  // The visible copy must never name Firebase.
  const visibleHtml = ACTION_HTML.replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(visibleHtml, /Firebase/i, "no Firebase branding may appear on the page");
});

test("the recovered email address is held in memory only and never rendered", () => {
  assert.match(ACTION_JS, /let recoveredEmail = ""/);
  // It may be passed to sendPasswordResetEmail, but never painted.
  assert.doesNotMatch(ACTION_JS, /textContent\s*=\s*recoveredEmail/);
  assert.doesNotMatch(ACTION_JS, /\$\{recoveredEmail\}/, "the address must not be interpolated into any copy");
  assert.match(ACTION_JS, /sendPasswordResetEmail\(auth, recoveredEmail\)/);
});

// --- Failure classification ----------------------------------------------

test("expired, invalid and generic failures are distinguished for friendlier copy", () => {
  assert.equal(classifyActionFailure("auth/expired-action-code"), "expired");
  assert.equal(classifyActionFailure("auth/invalid-action-code"), "invalid");
  assert.equal(classifyActionFailure("auth/argument-error"), "invalid");
  assert.equal(classifyActionFailure("auth/user-not-found"), "invalid");
  assert.equal(classifyActionFailure("auth/user-disabled"), "invalid");
  assert.equal(classifyActionFailure("auth/weak-password"), "weakPassword");
  assert.equal(classifyActionFailure("auth/network-request-failed"), "network");
  assert.equal(classifyActionFailure("auth/something-brand-new"), "generic");
  assert.equal(classifyActionFailure(undefined), "generic");
});

test("failure copy is friendly, actionable and never blames the user in either language", () => {
  for (const kind of ["expired", "invalid", "network", "generic"]) {
    for (const lang of ["en", "he"]) {
      const copy = failureCopy(kind, lang);
      assert.ok(copy.title?.trim(), `${lang}/${kind} needs a title`);
      assert.ok(copy.body?.trim(), `${lang}/${kind} needs a body`);
      assert.equal(containsSensitiveDetail(copy.title), false);
      assert.equal(containsSensitiveDetail(copy.body), false);
    }
    assert.match(failureCopy(kind, "he").body, /[֐-׿]/, `${kind} must have real Hebrew copy`);
  }

  // The expired case must explain and offer a way forward.
  assert.match(failureCopy("expired", "en").body, /new one/i);
});

test("a weak password keeps the user on the form instead of dropping them on a failure page", () => {
  const submit = ACTION_JS.match(/async function submitNewPassword\([\s\S]*?\n\}\n/);
  assert.ok(submit, "expected a submitNewPassword function");
  assert.match(submit[0], /if \(kind === "weakPassword"\)[\s\S]*?showFieldError\("weakPassword"\)/);
});

test("the source-text assertions survive a CRLF checkout", () => {
  // Regression cover for the root cause above: with core.autocrlf=true and no
  // .gitattributes, auth-action.js arrives with CRLF terminators, and a
  // pattern anchored on "\n}" cannot match "\r\n}\r\n". The test above then
  // failed claiming submitNewPassword did not exist, on a file nobody had
  // touched. Feed the same pattern a deliberately CRLF-terminated copy and
  // require it to still match, so the normalization in readSource() cannot be
  // dropped without something going red.
  const crlf = ACTION_JS.replace(/\n/g, "\r\n");
  assert.match(crlf, /\r\n/, "the fixture must actually be CRLF-terminated");

  const normalized = crlf.replace(/\r\n/g, "\n");
  const submit = normalized.match(/async function submitNewPassword\([\s\S]*?\n\}\n/);
  assert.ok(submit, "the function must still be found after CRLF normalization");
  assert.match(submit[0], /if \(kind === "weakPassword"\)[\s\S]*?showFieldError\("weakPassword"\)/);

  // And prove the hazard is real rather than hypothetical: the un-normalized
  // CRLF text must NOT match, which is exactly what broke.
  assert.doesNotMatch(
    crlf,
    /async function submitNewPassword\([\s\S]*?\n\}\n/,
    "if raw CRLF text matches, this guard is no longer testing anything"
  );
});

// --- Password policy -----------------------------------------------------

test("the reset form reuses the existing 6-character password policy", () => {
  assert.equal(MIN_PASSWORD_LENGTH, 6, "must match the signup form's minlength");
  assert.match(AUTH_HTML, /id="password"[\s\S]*?minlength="6"/, "the signup form policy this mirrors");
  assert.match(ACTION_HTML, /id="newPassword"[\s\S]*?minlength="6"/);
  assert.match(ACTION_HTML, /id="confirmPassword"[\s\S]*?minlength="6"/);
});

test("password validation covers empty, too-short, unconfirmed and mismatched input", () => {
  assert.deepEqual(validatePassword("", ""), { valid: false, reason: "required" });
  assert.deepEqual(validatePassword("abc", "abc"), { valid: false, reason: "tooShort" });
  assert.deepEqual(validatePassword("abcdef", ""), { valid: false, reason: "confirmRequired" });
  assert.deepEqual(validatePassword("abcdef", "abcdeg"), { valid: false, reason: "mismatch" });
  assert.deepEqual(validatePassword("abcdef", "abcdef"), { valid: true, reason: null });

  // Exactly at the boundary.
  assert.equal(validatePassword("12345", "12345").valid, false, "5 characters must be rejected");
  assert.equal(validatePassword("123456", "123456").valid, true, "6 characters must be accepted");

  // Non-string input must not throw.
  assert.equal(validatePassword(null, undefined).valid, false);
  assert.equal(validatePassword(123456, 123456).valid, false);
});

test("every validation failure has localized inline copy in both languages", () => {
  for (const reason of ["required", "tooShort", "confirmRequired", "mismatch", "weakPassword"]) {
    for (const lang of ["en", "he"]) {
      const message = passwordErrorMessage(reason, lang);
      assert.ok(message?.trim(), `${lang}/${reason} needs a message`);
      assert.equal(containsSensitiveDetail(message), false);
    }
    assert.match(passwordErrorMessage(reason, "he"), /[֐-׿]/);
  }
});

test("inline validation marks the offending field accessibly, not by color alone", () => {
  assert.match(ACTION_JS, /setAttribute\("aria-invalid", "true"\)/);
  assert.match(ACTION_HTML, /aria-describedby="newPasswordError"/);
  assert.match(ACTION_HTML, /aria-describedby="confirmPasswordError"/);
  assert.match(ACTION_HTML, /id="newPasswordError"[^>]*role="alert"/);
  assert.match(ACTION_CSS, /input\[type="password"\]\.invalid/);

  // A mismatch belongs on the confirm field, not the first one.
  assert.match(ACTION_JS, /reason === "mismatch" \|\| reason === "confirmRequired"/);
});

// --- Localization --------------------------------------------------------

test("English and Hebrew string tables define exactly the same keys", () => {
  const en = Object.keys(ACTION_STRINGS.en).sort();
  const he = Object.keys(ACTION_STRINGS.he).sort();
  assert.deepEqual(he, en, "the Hebrew table must define exactly the same keys as English");

  for (const key of en) {
    assert.ok(ACTION_STRINGS.en[key].trim(), `English ${key} must not be empty`);
    assert.ok(ACTION_STRINGS.he[key].trim(), `Hebrew ${key} must not be empty`);
  }
});

test("all Hebrew copy is genuinely translated, not copied English", () => {
  for (const [key, englishValue] of Object.entries(ACTION_STRINGS.en)) {
    const hebrewValue = ACTION_STRINGS.he[key];
    // "FuelPhysique" is a brand name and stays untranslated by design.
    if (key === "brand") continue;
    assert.notEqual(hebrewValue, englishValue, `${key} must actually be translated`);
    assert.match(hebrewValue, /[֐-׿]/, `${key} must contain Hebrew characters`);
  }
});

test("the lang parameter from the email template wins over the stored app preference", () => {
  assert.equal(resolveLocale({ langParam: "he", storedLanguage: "en" }), "he");
  assert.equal(resolveLocale({ langParam: "en", storedLanguage: "he" }), "en");
  // Firebase may send a regional or legacy Hebrew tag.
  assert.equal(resolveLocale({ langParam: "he-IL" }), "he");
  assert.equal(resolveLocale({ langParam: "iw" }), "he", "the legacy Hebrew code must still resolve");
});

test("with no lang parameter the stored app language is used, defaulting to English", () => {
  assert.equal(resolveLocale({ storedLanguage: "he" }), "he");
  assert.equal(resolveLocale({ storedLanguage: "en" }), "en");
  assert.equal(resolveLocale({}), "en");
  assert.equal(resolveLocale({ langParam: "fr", storedLanguage: "" }), "en", "an unsupported language falls back to English");
});

test("Hebrew switches the document to RTL", () => {
  assert.equal(isRtlLocale("he"), true);
  assert.equal(isRtlLocale("en"), false);
  assert.match(ACTION_JS, /setAttribute\("dir", "rtl"\)/);
  assert.match(ACTION_CSS, /\[dir="rtl"\]/, "RTL styles must exist");
});

test("an unknown locale returns the English table rather than undefined labels", () => {
  assert.deepEqual(getActionStrings("fr"), ACTION_STRINGS.en);
  assert.deepEqual(getActionStrings(), ACTION_STRINGS.en);
});

// --- Required content and states -----------------------------------------

test("the verify-email success state shows the specified content and both buttons", () => {
  const en = ACTION_STRINGS.en;
  assert.match(en.verifySuccessTitle, /Email verified/);
  assert.match(en.verifySuccessLead, /fully activated/);
  for (const pillar of [/workout plans/i, /nutrition plans/i, /AI Coach/, /progress tracking/i]) {
    assert.match(en.verifySuccessBody, pillar, `the success body must mention ${pillar}`);
  }
  assert.equal(en.verifyPrimary, "Go to Dashboard");
  assert.equal(en.verifySecondary, "Back to Login");

  assert.match(ACTION_HTML, /id="verifyPrimary"[^>]*href="\/dashboard\.html"/);
  assert.match(ACTION_HTML, /id="verifySecondary"[^>]*href="\/auth\.html"/);
});

test("the reset-password state shows both fields and the specified success copy and button", () => {
  assert.match(ACTION_STRINGS.en.resetNewLabel, /New password/);
  assert.match(ACTION_STRINGS.en.resetConfirmLabel, /Confirm password/);
  assert.match(ACTION_STRINGS.en.resetSuccessTitle, /Password updated successfully/);
  assert.equal(ACTION_STRINGS.en.resetPrimary, "Sign in");
  assert.match(ACTION_HTML, /id="resetPrimary"[^>]*href="\/auth\.html"/);
});

test("the recover-email state explains what happened and offers a password reset", () => {
  const body = ACTION_STRINGS.en.recoverBody;
  assert.match(body, /request to change the email/i, "must explain what happened");
  assert.match(body, /restored the previous one/i);
  assert.match(body, /didn't make that request/i, "must tell the user what to do if it wasn't them");
  assert.equal(ACTION_STRINGS.en.recoverPrimary, "Reset password");
  assert.match(ACTION_HTML, /id="recoverPrimary"/);
});

test("the invalid/expired state offers a return to login and never exposes the cause", () => {
  assert.equal(ACTION_STRINGS.en.failurePrimary, "Return to Login");
  assert.match(ACTION_HTML, /id="failurePrimary"[^>]*href="\/auth\.html"/);
  assert.doesNotMatch(ACTION_STRINGS.en.invalidBody, /code|token|Firebase/i);
  assert.doesNotMatch(ACTION_STRINGS.en.expiredBody, /code|token|Firebase/i);
});

test("all five visual states exist and only one is shown at a time", () => {
  for (const id of ["loadingPanel", "verifyPanel", "resetPanel", "resetSuccessPanel", "recoverPanel", "failurePanel"]) {
    assert.match(ACTION_HTML, new RegExp(`id="${id}"`), `${id} must exist`);
  }
  assert.match(ACTION_CSS, /\.state-panel\s*\{\s*display:\s*none/);
  assert.match(ACTION_CSS, /\.state-panel\.visible\s*\{\s*display:\s*block/);

  // showPanel must switch exclusively.
  const showPanel = ACTION_JS.match(/function showPanel\([\s\S]*?\n\}/);
  assert.ok(showPanel);
  assert.match(showPanel[0], /classList\.toggle\("visible", key === name\)/);

  // Loading is the initial state so the user never sees a blank card.
  assert.match(ACTION_HTML, /id="loadingPanel" class="state-panel visible"/);
});

// --- Design --------------------------------------------------------------

test("the page uses the shared Blue Ocean theme tokens, not a private palette", () => {
  assert.match(ACTION_HTML, /href="\/css\/theme\.css"/, "the shared theme must be linked first");
  assert.match(ACTION_HTML, /ocean-depth-layer/, "the shared Blue Ocean backdrop must be used");

  for (const token of ["--fp-bg-page", "--fp-surface", "--fp-border", "--fp-text-primary", "--fp-brand-primary", "--fp-success", "--fp-danger"]) {
    assert.ok(ACTION_CSS.includes(token), `the stylesheet must build on ${token}`);
  }
});

test("FuelPhysique branding is present and the page is responsive", () => {
  assert.match(ACTION_HTML, /<h1>FuelPhysique<\/h1>/);
  assert.match(ACTION_HTML, /<meta name="viewport"/);
  assert.match(ACTION_CSS, /@media \(max-width: 520px\)/);
});

test("the spinner respects prefers-reduced-motion", () => {
  assert.match(ACTION_CSS, /@media \(prefers-reduced-motion: reduce\)/);
});
