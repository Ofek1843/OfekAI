// Shared, pure decision logic for the Firebase email action handler
// (public/auth-action.html). No Firebase imports, no DOM access, no network —
// every function is a deterministic pure function of its arguments, so the
// browser and the Node test suite (test/auth-action.test.js) exercise the
// exact same code rather than a re-implementation that can silently drift.
//
// .mjs so Node's module loader always treats this as ESM regardless of
// package.json "type" — the same pattern as equipment-i18n.mjs and
// auth-google-core.mjs.

// The three Firebase email action modes this handler supports. Anything else
// (including a missing or misspelled mode) is treated as an invalid link
// rather than being passed through to Firebase.
export const SUPPORTED_MODES = Object.freeze(["verifyEmail", "resetPassword", "recoverEmail"]);

export function isSupportedMode(mode) {
  return SUPPORTED_MODES.includes(mode);
}

// Password policy, reused verbatim from the existing signup form
// (public/auth.html's minlength="6" and auth.js's length check) so a password
// set here can never be one the signup form would have rejected.
export const MIN_PASSWORD_LENGTH = 6;

export function validatePassword(password, confirmPassword) {
  const value = typeof password === "string" ? password : "";
  const confirmValue = typeof confirmPassword === "string" ? confirmPassword : "";

  if (!value) return { valid: false, reason: "required" };
  if (value.length < MIN_PASSWORD_LENGTH) return { valid: false, reason: "tooShort" };
  if (!confirmValue) return { valid: false, reason: "confirmRequired" };
  if (value !== confirmValue) return { valid: false, reason: "mismatch" };
  return { valid: true, reason: null };
}

// --- continueUrl validation ----------------------------------------------
// Firebase passes continueUrl straight through from the email template, and
// it ends up in a link the user clicks — so an unvalidated value is a
// textbook open-redirect / phishing vector. This is an ORIGIN ALLOWLIST, not
// a sanitizer: anything that is not exactly one of these origins is rejected
// and the caller falls back to the dashboard.
//
// Subdomain matching is deliberately NOT supported: "evil.fuelphysique.com"
// would pass a naive endsWith check, and a wildcard here would trust every
// current and future subdomain including any that gets taken over.
export const ALLOWED_CONTINUE_ORIGINS = Object.freeze([
  "https://fuelphysique.com",
  "https://www.fuelphysique.com",
  // Approved local development origins only.
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

export const DEFAULT_CONTINUE_PATH = "/dashboard.html";

// Returns a safe same-origin path to continue to, or DEFAULT_CONTINUE_PATH.
// Always returns a PATH (never a full URL) so the caller can only ever
// navigate within the app — even a perfectly valid allowlisted origin is
// reduced to its path rather than trusted as an absolute destination.
export function resolveContinueUrl(rawContinueUrl, { allowedOrigins = ALLOWED_CONTINUE_ORIGINS } = {}) {
  if (typeof rawContinueUrl !== "string" || !rawContinueUrl.trim()) {
    return DEFAULT_CONTINUE_PATH;
  }

  let parsed;
  try {
    // No base: a relative or protocol-relative value must not silently
    // inherit the current origin and pass as "safe".
    parsed = new URL(rawContinueUrl);
  } catch (error) {
    return DEFAULT_CONTINUE_PATH;
  }

  // Reject javascript:, data:, file: and every other non-HTTP scheme before
  // the origin is even considered.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return DEFAULT_CONTINUE_PATH;
  }

  if (!allowedOrigins.includes(parsed.origin)) {
    return DEFAULT_CONTINUE_PATH;
  }

  const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  // A bare allowlisted origin ("https://fuelphysique.com") has pathname "/",
  // which is a valid destination but not a useful one for a post-action
  // landing — send those to the dashboard instead.
  if (!path || path === "/") return DEFAULT_CONTINUE_PATH;

  // Guard against a parsed path that somehow isn't app-relative.
  if (!path.startsWith("/") || path.startsWith("//")) return DEFAULT_CONTINUE_PATH;

  return path;
}

// --- Locale --------------------------------------------------------------
// Firebase appends ?lang= to the action link based on the template language.
// It wins over the stored app preference, because the user is arriving from
// an email that was itself written in that language. Falls back to the
// app-wide key, then English.
export function resolveLocale({ langParam = "", storedLanguage = "" } = {}) {
  const normalize = (value) => String(value || "").trim().toLowerCase().split("-")[0];
  const fromParam = normalize(langParam);
  if (fromParam === "he" || fromParam === "iw") return "he";
  if (fromParam === "en") return "en";

  return normalize(storedLanguage) === "he" ? "he" : "en";
}

export function isRtlLocale(locale) {
  return locale === "he";
}

// --- Safe, non-leaking failure copy --------------------------------------
// Firebase's action-code errors (auth/invalid-action-code,
// auth/expired-action-code, ...) must never reach the user verbatim: they
// leak implementation detail and read as a system fault rather than a link
// that simply aged out. Every failure resolves to one of these three
// friendly, actionable states.
export const FAILURE_KINDS = Object.freeze(["expired", "invalid", "generic"]);

export function classifyActionFailure(errorCode) {
  const code = String(errorCode || "");
  if (code === "auth/expired-action-code") return "expired";
  if (code === "auth/invalid-action-code" || code === "auth/argument-error") return "invalid";
  if (code === "auth/user-disabled" || code === "auth/user-not-found") return "invalid";
  if (code === "auth/weak-password") return "weakPassword";
  if (code === "auth/network-request-failed") return "network";
  return "generic";
}

// True if a string looks like it contains something that must never be
// rendered to the user: a raw Firebase error code, or the one-time action
// code itself. Used by the UI as a final assertion before painting text, and
// by the test suite to prove no leak path exists.
export function containsSensitiveDetail(text, { oobCode = "" } = {}) {
  const value = String(text || "");
  if (/auth\/[a-z-]+/i.test(value)) return true;
  if (/\bFirebase\b/i.test(value)) return true;
  if (oobCode && value.includes(oobCode)) return true;
  return false;
}

// --- Localized copy ------------------------------------------------------
// Every user-visible string on the action page, in both supported locales.
// Kept here so the test suite can assert English and Hebrew stay in lockstep
// — a missing Hebrew key would otherwise surface only as an undefined label.
export const ACTION_STRINGS = {
  en: {
    pageTitle: "Account action",
    brand: "FuelPhysique",

    loadingTitle: "Just a moment",
    loadingBody: "Verifying your secure link...",

    verifySuccessTitle: "Email verified",
    verifySuccessLead: "Your account is now fully activated.",
    verifySuccessBody: "You can now access your workout plans, nutrition plans, AI Coach and progress tracking.",
    verifyPrimary: "Go to Dashboard",
    verifySecondary: "Back to Login",

    resetTitle: "Choose a new password",
    resetBody: "Set a new password for your FuelPhysique account.",
    resetNewLabel: "New password",
    resetConfirmLabel: "Confirm password",
    resetPlaceholder: "At least 6 characters",
    resetSubmit: "Update password",
    resetSubmitting: "Updating...",
    resetSuccessTitle: "Password updated successfully",
    resetSuccessBody: "You can now sign in with your new password.",
    resetPrimary: "Sign in",

    recoverTitle: "Email address restored",
    recoverLead: "Your sign-in email has been changed back.",
    recoverBody: "We received a request to change the email address on your account, so we've restored the previous one. If you didn't make that request, we recommend resetting your password now to secure your account.",
    recoverPrimary: "Reset password",
    recoverSecondary: "Back to Login",
    recoverResetSent: "Check your inbox — we've sent you a password reset link.",

    expiredTitle: "This link has expired",
    expiredBody: "For your security, account links stay valid for a limited time. Please request a new one and try again.",
    invalidTitle: "This link is no longer valid",
    invalidBody: "It may have already been used, or it was only partly copied. Please request a new one and try again.",
    genericTitle: "Something went wrong",
    genericBody: "We couldn't complete that action. Please request a new link and try again.",
    networkTitle: "Connection problem",
    networkBody: "We couldn't reach our servers. Please check your internet connection and try again.",
    failurePrimary: "Return to Login",

    errorRequired: "Please enter a new password.",
    errorTooShort: "The password must contain at least 6 characters.",
    errorConfirmRequired: "Please confirm your new password.",
    errorMismatch: "The two passwords don't match.",
    errorWeakPassword: "Please choose a stronger password with at least 6 characters."
  },
  he: {
    pageTitle: "פעולה בחשבון",
    brand: "FuelPhysique",

    loadingTitle: "רגע אחד",
    loadingBody: "מאמתים את הקישור המאובטח שלך...",

    verifySuccessTitle: "האימייל אומת",
    verifySuccessLead: "החשבון שלך פעיל במלואו.",
    verifySuccessBody: "מעכשיו יש לך גישה לתוכניות האימון, לתוכניות התזונה, למאמן ה-AI ולמעקב ההתקדמות.",
    verifyPrimary: "מעבר ללוח הבקרה",
    verifySecondary: "חזרה להתחברות",

    resetTitle: "בחירת סיסמה חדשה",
    resetBody: "יש להגדיר סיסמה חדשה לחשבון ה-FuelPhysique שלך.",
    resetNewLabel: "סיסמה חדשה",
    resetConfirmLabel: "אימות סיסמה",
    resetPlaceholder: "לפחות 6 תווים",
    resetSubmit: "עדכון סיסמה",
    resetSubmitting: "מעדכן...",
    resetSuccessTitle: "הסיסמה עודכנה בהצלחה",
    resetSuccessBody: "אפשר להתחבר עכשיו עם הסיסמה החדשה.",
    resetPrimary: "התחברות",

    recoverTitle: "כתובת האימייל שוחזרה",
    recoverLead: "כתובת האימייל להתחברות הוחזרה לקודמת.",
    recoverBody: "קיבלנו בקשה לשנות את כתובת האימייל בחשבון שלך, ולכן שחזרנו את הכתובת הקודמת. אם לא ביקשת זאת, מומלץ לאפס עכשיו את הסיסמה כדי לאבטח את החשבון.",
    recoverPrimary: "איפוס סיסמה",
    recoverSecondary: "חזרה להתחברות",
    recoverResetSent: "יש לבדוק את תיבת הדואר — שלחנו לך קישור לאיפוס הסיסמה.",

    expiredTitle: "תוקף הקישור פג",
    expiredBody: "מטעמי אבטחה, קישורים לחשבון תקפים לזמן מוגבל. יש לבקש קישור חדש ולנסות שוב.",
    invalidTitle: "הקישור כבר אינו תקף",
    invalidBody: "ייתכן שכבר נעשה בו שימוש, או שהועתק באופן חלקי. יש לבקש קישור חדש ולנסות שוב.",
    genericTitle: "משהו השתבש",
    genericBody: "לא הצלחנו להשלים את הפעולה. יש לבקש קישור חדש ולנסות שוב.",
    networkTitle: "בעיית תקשורת",
    networkBody: "לא הצלחנו להתחבר לשרתים שלנו. יש לבדוק את חיבור האינטרנט ולנסות שוב.",
    failurePrimary: "חזרה להתחברות",

    errorRequired: "יש להזין סיסמה חדשה.",
    errorTooShort: "הסיסמה חייבת להכיל לפחות 6 תווים.",
    errorConfirmRequired: "יש לאמת את הסיסמה החדשה.",
    errorMismatch: "שתי הסיסמאות אינן תואמות.",
    errorWeakPassword: "יש לבחור סיסמה חזקה יותר, באורך 6 תווים לפחות."
  }
};

export function getActionStrings(locale = "en") {
  return ACTION_STRINGS[locale] || ACTION_STRINGS.en;
}

// Maps a validatePassword() reason to its localized inline-validation message.
export function passwordErrorMessage(reason, locale = "en") {
  const strings = getActionStrings(locale);
  switch (reason) {
    case "required": return strings.errorRequired;
    case "tooShort": return strings.errorTooShort;
    case "confirmRequired": return strings.errorConfirmRequired;
    case "mismatch": return strings.errorMismatch;
    case "weakPassword": return strings.errorWeakPassword;
    default: return strings.genericBody;
  }
}

// Maps a classifyActionFailure() kind to its localized title/body pair.
export function failureCopy(kind, locale = "en") {
  const strings = getActionStrings(locale);
  switch (kind) {
    case "expired": return { title: strings.expiredTitle, body: strings.expiredBody };
    case "invalid": return { title: strings.invalidTitle, body: strings.invalidBody };
    case "network": return { title: strings.networkTitle, body: strings.networkBody };
    default: return { title: strings.genericTitle, body: strings.genericBody };
  }
}
