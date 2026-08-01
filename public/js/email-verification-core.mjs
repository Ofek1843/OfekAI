// Shared, pure decision logic for email verification and password-reset
// requests. No Firebase imports, no DOM access, no network — every function
// is a deterministic pure function of its arguments, so the browser
// (public/js/auth.js, public/js/app-auth.js) and the Node test suite
// exercise the exact same code. Same .mjs pattern as auth-google-core.mjs
// and auth-action-core.mjs.

// --- ActionCodeSettings ----------------------------------------------------
// Every emailed action link (verification, password reset) must point at the
// dedicated handler (public/auth-action.html), never at auth.html. Firebase
// requires the destination origin to be an authorized domain; the production
// origin is used everywhere except when the app is actually running on an
// approved local development origin, so a developer testing signup locally
// still receives a link that opens on their own machine instead of bouncing
// to production.
export const PRODUCTION_ACTION_ORIGIN = "https://fuelphysique.com";

export const APPROVED_LOCAL_ACTION_ORIGINS = Object.freeze([
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

export function resolveActionOrigin(currentOrigin) {
  if (APPROVED_LOCAL_ACTION_ORIGINS.includes(currentOrigin)) return currentOrigin;
  return PRODUCTION_ACTION_ORIGIN;
}

// buildActionCodeSettings(currentOrigin) -> Firebase ActionCodeSettings
// handleCodeInApp is deliberately false: the code is handled by
// auth-action.html as a normal page load (mode/oobCode read from the query
// string), not via a custom app-link/deep-link continuation.
export function buildActionCodeSettings(currentOrigin) {
  return {
    url: `${resolveActionOrigin(currentOrigin)}/auth-action.html`,
    handleCodeInApp: false
  };
}

// --- Resend cooldown -------------------------------------------------------
// A fixed cooldown, enforced client-side, so a user cannot machine-gun the
// resend button (each click is a real Firebase email send). This is a UX
// throttle, not the security boundary — Firebase's own auth/too-many-requests
// is the real backstop and is handled as a friendly message wherever it
// surfaces.
export const RESEND_COOLDOWN_SECONDS = 60;

// computeResendState({ lastSentAtMs, nowMs }) -> { canResend, secondsRemaining }
// Pure function of two timestamps so it's trivially testable without a
// fake clock/timer harness. nowMs and lastSentAtMs are both required to be
// injected by the caller (never Date.now() inside this module).
export function computeResendState({ lastSentAtMs = null, nowMs } = {}) {
  if (!lastSentAtMs || !Number.isFinite(lastSentAtMs)) {
    return { canResend: true, secondsRemaining: 0 };
  }
  const elapsedSeconds = Math.floor((nowMs - lastSentAtMs) / 1000);
  const secondsRemaining = Math.max(0, RESEND_COOLDOWN_SECONDS - elapsedSeconds);
  return { canResend: secondsRemaining <= 0, secondsRemaining };
}

// The localStorage key used to persist the last-sent timestamp, scoped per
// uid so a shared/public device never lets one account's cooldown or (worse)
// identity bleed into another's. The VALUE stored behind this key is a plain
// epoch-millisecond number — non-sensitive cooldown metadata only, never an
// email address, token or oobCode.
export function resendCooldownStorageKey(uid) {
  return `fp-verify-resend-${uid || "anon"}`;
}

// --- Access policy -----------------------------------------------------
// True when this signed-in user must be blocked from sensitive/saved product
// features until they verify their email. A Google account's emailVerified
// is always true (Google itself verified the address), so this naturally
// never blocks a Google user without needing any provider-specific branching
// — simpler and more robust than checking providerData.
export function shouldBlockUnverifiedAccess(user) {
  if (!user) return false;
  return user.emailVerified !== true;
}

// --- Localized copy ---------------------------------------------------
// Every user-visible verification/resend/forgot-password string, in both
// supported locales. Kept here (not inline) so the test suite can assert
// English and Hebrew stay in lockstep.
export const VERIFICATION_STRINGS = {
  en: {
    checkEmailTitle: "Check your email",
    checkEmailBody: "We've sent a verification link to your email address. Your account is created — verifying your email unlocks your saved plans and progress.",

    gateTitle: "Please verify your email",
    gateBody: "We sent a verification link to your email address when you signed up. Verify it to unlock your workout plans, nutrition plans, AI Coach and progress tracking.",
    resendButton: "Resend verification email",
    resendLoading: "Sending...",
    resendSuccess: "Verification email sent. Please check your inbox.",
    resendCooldown: (seconds) => `You can request another email in ${seconds}s.`,
    checkVerifiedButton: "I've verified my email",
    checkVerifiedLoading: "Checking...",
    stillNotVerified: "Still not verified. Please open the link from the email first.",
    signOutButton: "Sign out",
    changeEmailHint: "Used the wrong email address? Sign out and create a new account with the correct one.",

    forgotPasswordLink: "Forgot password?",
    forgotPasswordTitle: "Reset your password",
    forgotPasswordBody: "Enter the email address on your account and we'll send you a link to reset your password.",
    forgotPasswordEmailLabel: "Email address",
    forgotPasswordSubmit: "Send reset link",
    forgotPasswordSubmitting: "Sending...",
    forgotPasswordCancel: "Cancel",
    // Deliberately identical whether or not the address is registered — see
    // shouldBlockUnverifiedAccess's neighbor, the privacy note on the reset
    // handler in auth.js: confirming/denying an email's existence is an
    // account-enumeration leak.
    forgotPasswordConfirmation: "If an account exists for that email address, we've sent a link to reset your password."
  },
  he: {
    checkEmailTitle: "יש לבדוק את תיבת הדואר",
    checkEmailBody: "שלחנו קישור לאימות לכתובת האימייל שלך. החשבון שלך נוצר — אימות האימייל פותח את התוכניות וההתקדמות השמורות שלך.",

    gateTitle: "יש לאמת את כתובת האימייל",
    gateBody: "שלחנו קישור לאימות לכתובת האימייל שלך בעת ההרשמה. יש לאמת אותה כדי לפתוח את תוכניות האימון, תוכניות התזונה, מאמן ה-AI ומעקב ההתקדמות.",
    resendButton: "שליחה חוזרת של אימייל האימות",
    resendLoading: "שולח...",
    resendSuccess: "אימייל האימות נשלח. יש לבדוק את תיבת הדואר.",
    resendCooldown: (seconds) => `ניתן לבקש אימייל נוסף בעוד ${seconds} שניות.`,
    checkVerifiedButton: "אימתתי את האימייל שלי",
    checkVerifiedLoading: "בודק...",
    stillNotVerified: "עדיין לא אומת. יש לפתוח קודם את הקישור מתוך האימייל.",
    signOutButton: "התנתקות",
    changeEmailHint: "השתמשת בכתובת אימייל שגויה? התנתק/י וצור/י חשבון חדש עם הכתובת הנכונה.",

    forgotPasswordLink: "שכחת סיסמה?",
    forgotPasswordTitle: "איפוס הסיסמה שלך",
    forgotPasswordBody: "יש להזין את כתובת האימייל של החשבון שלך ואנחנו נשלח קישור לאיפוס הסיסמה.",
    forgotPasswordEmailLabel: "כתובת אימייל",
    forgotPasswordSubmit: "שליחת קישור לאיפוס",
    forgotPasswordSubmitting: "שולח...",
    forgotPasswordCancel: "ביטול",
    forgotPasswordConfirmation: "אם קיים חשבון עבור כתובת האימייל הזו, שלחנו אליה קישור לאיפוס הסיסמה."
  }
};

export function getVerificationStrings(locale = "en") {
  return VERIFICATION_STRINGS[locale] || VERIFICATION_STRINGS.en;
}
