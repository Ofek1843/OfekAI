// Shared, pure decision logic for FuelPhysique authentication (email/password
// AND Google). No Firebase imports, no DOM access, no network — every function
// here is a deterministic pure function of its arguments, so the browser
// (public/js/auth.js) and the Node test suite
// (test/google-auth.test.js) exercise the EXACT same code rather than a
// re-implementation that can silently drift.
//
// .mjs (not .js) so Node's module loader always treats this as ESM regardless
// of package.json "type" — the same pattern already used by
// public/js/equipment-i18n.mjs.

// The terms/health-disclaimer version a user must have accepted to get
// product access. Bumping this string re-prompts EVERY user (email/password
// and Google alike) on their next visit to the auth page — that is the
// intended behavior when the legal text materially changes.
//
// Kept identical to the value auth.js has always written for
// email/password signups so existing accepted users are not re-prompted by
// the introduction of Google sign-in.
export const TERMS_VERSION = "2026-08-08";

// Only these deep-link destinations may be requested via ?next=. Anything
// else (including absolute URLs, protocol-relative "//evil.com" and path
// traversal) falls back to the dashboard — an open redirect on a login page
// is a phishing vector, so this is an allowlist, never a sanitizer.
export const ALLOWED_NEXT_PATHS = [
  "dashboard.html",
  "app.html",
  "workout-builder.html",
  "nutrition-builder.html",
  "social.html",
  "workout-tracker.html"
];

export const DEFAULT_NEXT_PATH = "/dashboard.html";

export function resolveNextPath(requestedNext) {
  if (typeof requestedNext !== "string" || !requestedNext || requestedNext.includes("\\")) return DEFAULT_NEXT_PATH;
  let url;
  try {
    url = new URL(requestedNext.startsWith("/") ? requestedNext : `/${requestedNext}`, "https://fuelphysique.invalid");
  } catch {
    return DEFAULT_NEXT_PATH;
  }
  if (url.origin !== "https://fuelphysique.invalid" || url.username || url.password) return DEFAULT_NEXT_PATH;
  const filename = url.pathname.slice(1);
  if (!ALLOWED_NEXT_PATHS.includes(filename) || url.hash) return DEFAULT_NEXT_PATH;
  const keys = [...url.searchParams.keys()];

  if (["dashboard.html"].includes(filename)) {
    return url.search ? DEFAULT_NEXT_PATH : `/${filename}`;
  }
  if (filename === "app.html") {
    if (url.searchParams.get("settings") !== "open" || keys.some(key => !["settings", "section"].includes(key))) return DEFAULT_NEXT_PATH;
    const section = url.searchParams.get("section");
    if (section !== null && !/^(profile|athlete|preferences|language|notifications|account|appearance)$/.test(section)) return DEFAULT_NEXT_PATH;
    return `${url.pathname}${url.search}`;
  }
  if (["workout-builder.html", "nutrition-builder.html"].includes(filename)) {
    return url.search ? DEFAULT_NEXT_PATH : `/${filename}`;
  }

  const safeId = value => /^[A-Za-z0-9_-]{1,160}$/.test(value || "");
  if (filename === "social.html") {
    if (!keys.length) return url.pathname;
    const request = url.searchParams.get("request");
    const conversation = url.searchParams.get("conversation");
    if (request !== null) {
      if (request !== "friends" || conversation !== null || keys.some(key => key !== "request")) return DEFAULT_NEXT_PATH;
      return `${url.pathname}?request=friends`;
    }
    if (!safeId(conversation)) return DEFAULT_NEXT_PATH;
    if (keys.some(key => !["conversation", "artifact"].includes(key))) return DEFAULT_NEXT_PATH;
    const artifact = url.searchParams.get("artifact");
    if (artifact !== null && !safeId(artifact)) return DEFAULT_NEXT_PATH;
  } else {
    if (!keys.length) return url.pathname;
    if (!safeId(url.searchParams.get("plan")) || !safeId(url.searchParams.get("session"))) return DEFAULT_NEXT_PATH;
    if (keys.some(key => !["plan", "session", "date"].includes(key))) return DEFAULT_NEXT_PATH;
    const date = url.searchParams.get("date");
    if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return DEFAULT_NEXT_PATH;
  }
  return `${url.pathname}${url.search}`;
}

// Mobile browsers (and installed PWAs on any platform) handle
// signInWithPopup badly or not at all: iOS Safari blocks the popup outright,
// several Android in-app webviews silently return a closed popup, and a
// standalone PWA opens the popup in a detached browser context the app can
// never read a result from. Those cases use signInWithRedirect +
// getRedirectResult instead. Desktop browsers keep the popup, which is a
// materially better UX (no full page navigation, no lost form state).
export function shouldUseRedirect({ userAgent = "", isStandalone = false } = {}) {
  if (isStandalone) return true;
  const ua = String(userAgent);
  if (!ua) return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
}

// True when this user must be shown the terms/health-disclaimer gate before
// being allowed into the product. Applies to BOTH a brand-new Google user
// (no profile document at all) and an existing user whose accepted version
// predates the current one. A returning user whose accepted version is
// current is never re-prompted.
export function needsTermsAcceptance(profile, currentVersion = TERMS_VERSION) {
  if (!profile) return true;
  if (profile.termsAccepted !== true) return true;
  return profile.termsVersion !== currentVersion;
}

// Merges the provider ids already recorded on the profile with the one just
// used, preserving order of first use and never duplicating. An account that
// started as email/password and later linked Google ends up with
// ["password", "google.com"].
export function mergeAuthProviders(existingProviders, newProviderId) {
  const merged = Array.isArray(existingProviders)
    ? existingProviders.filter((id) => typeof id === "string" && id.trim())
    : [];
  if (newProviderId && !merged.includes(newProviderId)) merged.push(newProviderId);
  return merged;
}

// Builds the users/{uid} payload to write with { merge: true }.
//
// The critical rule (section 4 of the spec): never overwrite an existing
// profile value with an empty one. A Google account with no photoURL, or an
// email/password account whose displayName the user already customized, must
// not be blanked out just because THIS provider didn't supply the field. Any
// key whose resolved value is empty is omitted from the payload entirely, so
// a merge write leaves the stored value untouched rather than setting "".
//
// `now` is injected (not read from a clock) so this is deterministic and
// testable; auth.js passes Firestore's serverTimestamp() sentinel.
export function buildUserDocumentMerge({
  authUser = {},
  existingProfile = null,
  providerId = "",
  acceptedTermsVersion = null,
  now = null
} = {}) {
  const payload = {};

  const email = pickNonEmpty(authUser.email, existingProfile?.email);
  if (email) payload.email = email;

  // Prefer whatever the profile already stores over the provider's value:
  // a user who edited their display name in Settings must not have it
  // reverted to their Google account name on every subsequent sign-in.
  const displayName = pickNonEmpty(existingProfile?.displayName, authUser.displayName);
  if (displayName) payload.displayName = displayName;

  const photoURL = pickNonEmpty(authUser.photoURL, existingProfile?.photoURL);
  if (photoURL) payload.photoURL = photoURL;

  const authProviders = mergeAuthProviders(existingProfile?.authProviders, providerId);
  if (authProviders.length) payload.authProviders = authProviders;

  // createdAt is written only when the profile does not exist yet — a merge
  // write that always set it would keep resetting the real signup date.
  if (!existingProfile && now) payload.createdAt = now;
  if (now) payload.updatedAt = now;

  // Terms fields are written ONLY on an actual acceptance. Passing
  // acceptedTermsVersion: null (a returning user who already accepted the
  // current version) leaves the stored acceptance — including its original
  // termsAcceptedAt timestamp — exactly as it was.
  if (acceptedTermsVersion) {
    payload.termsAccepted = true;
    payload.termsVersion = acceptedTermsVersion;
    payload.privacyVersion = acceptedTermsVersion;
    if (now) payload.termsAcceptedAt = now;
    if (now) payload.privacyAcceptedAt = now;
  }

  return payload;
}

function pickNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

// Localized, friendly error copy. Every branch returns human text — never a
// raw Firebase error code, and never a stack/internal detail.
//
// The Google-specific codes matter most here: a user who simply closed the
// popup has not "failed to authenticate" and must not be shown an alarming
// error, and a blocked popup needs actionable advice (allow popups / we'll
// fall back to redirect) rather than a generic failure.
const ERROR_MESSAGES = {
  en: {
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/missing-password": "Please enter a password.",
    "auth/weak-password": "The password must contain at least 6 characters.",
    "auth/email-already-in-use": "An account already exists with this email address.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/popup-closed-by-user": "Sign-in was cancelled. You can try again whenever you're ready.",
    "auth/cancelled-popup-request": "Sign-in was cancelled. You can try again whenever you're ready.",
    "auth/user-cancelled": "Sign-in was cancelled. You can try again whenever you're ready.",
    "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow popups for this site, or try again to continue in the same tab.",
    "auth/account-exists-with-different-credential": "You already have a FuelPhysique account with this email address. Sign in with your password once and we'll connect Google to it.",
    "auth/credential-already-in-use": "This Google account is already connected to a different FuelPhysique account.",
    "auth/operation-not-allowed": "Google sign-in isn't enabled for this site yet. Please use your email and password for now.",
    "auth/unauthorized-domain": "Google sign-in isn't available on this address yet. Please use your email and password for now.",
    default: "Authentication failed. Please try again."
  },
  he: {
    "auth/invalid-email": "יש להזין כתובת אימייל תקינה.",
    "auth/missing-password": "יש להזין סיסמה.",
    "auth/weak-password": "הסיסמה חייבת להכיל לפחות 6 תווים.",
    "auth/email-already-in-use": "כבר קיים חשבון עם כתובת האימייל הזו.",
    "auth/invalid-credential": "האימייל או הסיסמה שגויים.",
    "auth/too-many-requests": "יותר מדי ניסיונות. יש להמתין ולנסות שוב.",
    "auth/network-request-failed": "שגיאת רשת. יש לבדוק את חיבור האינטרנט.",
    "auth/popup-closed-by-user": "ההתחברות בוטלה. אפשר לנסות שוב בכל רגע.",
    "auth/cancelled-popup-request": "ההתחברות בוטלה. אפשר לנסות שוב בכל רגע.",
    "auth/user-cancelled": "ההתחברות בוטלה. אפשר לנסות שוב בכל רגע.",
    "auth/popup-blocked": "הדפדפן חסם את חלון ההתחברות של Google. יש לאפשר חלונות קופצים באתר, או לנסות שוב כדי להמשיך באותה לשונית.",
    "auth/account-exists-with-different-credential": "כבר קיים לך חשבון FuelPhysique עם כתובת האימייל הזו. יש להתחבר פעם אחת עם הסיסמה ואנחנו נחבר אליו את Google.",
    "auth/credential-already-in-use": "חשבון ה-Google הזה כבר מחובר לחשבון FuelPhysique אחר.",
    "auth/operation-not-allowed": "התחברות עם Google עדיין לא מופעלת באתר. בינתיים יש להשתמש באימייל ובסיסמה.",
    "auth/unauthorized-domain": "התחברות עם Google עדיין לא זמינה בכתובת הזו. בינתיים יש להשתמש באימייל ובסיסמה.",
    default: "ההתחברות נכשלה. יש לנסות שוב."
  }
};

export function getFriendlyAuthError(errorCode, locale = "en") {
  const dict = ERROR_MESSAGES[locale] || ERROR_MESSAGES.en;
  return dict[errorCode] || dict.default;
}

// True for the error codes that mean "the user deliberately backed out",
// which the UI should treat as a neutral notice rather than a red error.
export function isUserCancelledAuth(errorCode) {
  return [
    "auth/popup-closed-by-user",
    "auth/cancelled-popup-request",
    "auth/user-cancelled"
  ].includes(errorCode);
}

// All user-visible Google/terms/linking copy, in both supported locales.
// Kept here (not inline in auth.js) so the test suite can assert English and
// Hebrew stay in lockstep — a missing Hebrew key would otherwise only surface
// as an undefined label in production.
export const AUTH_UI_STRINGS = {
  en: {
    continueWithGoogle: "Continue with Google",
    googleLoading: "Connecting to Google...",
    orSeparator: "or",
    termsGateTitle: "One last step",
    termsGateBody: "Before you start, please review and accept our Terms, Health Disclaimer and Privacy Notice.",
    // Split into three parts so the consent sentence can be rebuilt from DOM
    // text nodes with the terms link in the middle — assembling it as an
    // HTML string would mean injecting markup, and a single flat string
    // cannot place the link correctly in both sentence structures.
    termsGateCheckboxBefore: "I have read and agree to the ",
    termsGateCheckboxLink: "Terms, Health Disclaimer and Privacy Notice",
    termsGateCheckboxAfter: ". If I am under 18, my parent or legal guardian has approved my use of FuelPhysique.",
    termsGateAccept: "Accept and continue",
    termsGateDecline: "Cancel",
    termsGateRequired: "You must accept the Terms and Health Disclaimer to continue.",
    linkTitle: "Connect Google to your account",
    linkBody: "You already have a FuelPhysique account with this email address. Enter your existing password once and we'll connect Google to it — all your plans and history stay exactly as they are.",
    linkPasswordLabel: "Your existing password",
    linkSubmit: "Connect and continue",
    linkCancel: "Cancel",
    linkLoading: "Connecting...",
    linkSuccess: "Google connected. Redirecting...",
    signingIn: "Signing you in..."
  },
  he: {
    continueWithGoogle: "המשך עם Google",
    googleLoading: "מתחבר ל-Google...",
    orSeparator: "או",
    termsGateTitle: "שלב אחרון",
    termsGateBody: "לפני שמתחילים, יש לקרוא ולאשר את התנאים, הצהרת הבריאות והודעת הפרטיות שלנו.",
    termsGateCheckboxBefore: "קראתי ואני מאשר/ת את ",
    termsGateCheckboxLink: "התנאים, הצהרת הבריאות והודעת הפרטיות",
    termsGateCheckboxAfter: ". אם אני מתחת לגיל 18, הורה או אפוטרופוס אישר/ה את השימוש שלי ב-FuelPhysique.",
    termsGateAccept: "אישור והמשך",
    termsGateDecline: "ביטול",
    termsGateRequired: "יש לאשר את התנאים והצהרת הבריאות כדי להמשיך.",
    linkTitle: "חיבור Google לחשבון שלך",
    linkBody: "כבר קיים לך חשבון FuelPhysique עם כתובת האימייל הזו. יש להזין את הסיסמה הקיימת פעם אחת ואנחנו נחבר אליה את Google — כל התוכניות וההיסטוריה שלך יישארו בדיוק כפי שהן.",
    linkPasswordLabel: "הסיסמה הקיימת שלך",
    linkSubmit: "חיבור והמשך",
    linkCancel: "ביטול",
    linkLoading: "מחבר...",
    linkSuccess: "Google חובר בהצלחה. מעביר אותך...",
    signingIn: "מתחבר..."
  }
};

export function getAuthStrings(locale = "en") {
  return AUTH_UI_STRINGS[locale] || AUTH_UI_STRINGS.en;
}

// The ONLY OAuth scopes this product requests. Firebase's GoogleAuthProvider
// already implies basic profile+email; this list exists so the test suite can
// assert we never add a Gmail/Drive/Calendar/Contacts scope, which would turn
// a simple sign-in into an invasive consent screen (and a Google verification
// requirement) for no product reason.
export const GOOGLE_OAUTH_SCOPES = Object.freeze([]);

// Session-storage key used to carry the requested ?next= destination across a
// full-page signInWithRedirect round trip (the query string is lost when the
// provider navigates back).
export const REDIRECT_NEXT_STORAGE_KEY = "fp-auth-redirect-next";
