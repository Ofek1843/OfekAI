// Shared, pure decision logic for email verification and password-reset
// requests. No Firebase imports, no DOM access, no network — every function
// is a deterministic pure function of its arguments, so the browser
// (public/js/auth.js, public/js/app-auth.js) and the Node test suite
// exercise the exact same code. Same .mjs pattern as auth-google-core.mjs
// and auth-action-core.mjs.

// --- ActionCodeSettings ----------------------------------------------------
// Firebase's template controls the action handler. ActionCodeSettings.url
// controls where the user continues AFTER the code is applied. Use the
// canonical public origin, with local return links only for emulator sessions.
import { PUBLIC_APP_ORIGIN, LOCAL_APP_ORIGINS, resolvePublicAppOrigin } from "./firebase-environment.mjs";
export const PRODUCTION_ACTION_ORIGIN = PUBLIC_APP_ORIGIN;
export const APPROVED_LOCAL_ACTION_ORIGINS = LOCAL_APP_ORIGINS;
export const resolveActionOrigin = resolvePublicAppOrigin;

// handleCodeInApp=false uses the configured web handler, not an app deep link.
export function buildActionCodeSettings(currentOrigin, options) {
  return {
    // This is the post-action continuation, NOT Firebase's email handler.
    // The handler URL is configured separately in Firebase Templates.
    url: `${resolveActionOrigin(currentOrigin, options)}/auth.html`,
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

// --- Optional verification UI predicate --------------------------------
// This predicate is not used by the general app-access guard. Email
// verification can be requested by an individual sensitive workflow when
// required, but unverified users retain access to ordinary product features.
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
    checkEmailBody: "Your account is ready. Email verification is optional, and you can use the app now.",
    signupSuccess: "Account created. Redirecting to your dashboard…",

    gateTitle: "Please verify your email",
    gateBody: "Email verification is optional for using FuelPhysique. You can continue to your account now.",
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
    checkEmailBody: "החשבון שלך מוכן. אימות האימייל הוא אפשרות בלבד, ואפשר להשתמש באתר כבר עכשיו.",
    signupSuccess: "החשבון נוצר. מעבירים אותך ללוח הבקרה…",

    gateTitle: "יש לאמת את כתובת האימייל",
    gateBody: "אימות האימייל אינו נדרש לשימוש ב-FuelPhysique. אפשר להמשיך לחשבון שלך עכשיו.",
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
