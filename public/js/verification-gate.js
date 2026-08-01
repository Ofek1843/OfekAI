// Shared "please verify your email" overlay, usable from any product page's
// own auth guard. Extracted out of app-auth.js so the same gate (and its
// resend cooldown/loading/success states) doesn't get re-implemented per
// page — each page's guard just calls shouldBlockUnverifiedAccess(user) and,
// if true, renderVerificationGate(user) instead of rendering its normal
// content.
//
// Product policy: an unverified email/password user finishes account
// creation and IS authenticated, but sensitive/saved product features are
// blocked until user.emailVerified is true. A Google account's
// emailVerified is always true, so shouldBlockUnverifiedAccess never blocks
// one — no Google-specific branching needed. Never auto-sends on load: the
// email already went out at signup (see auth.js); this screen only sends
// again on an explicit, cooldown-limited click.

import { auth } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  buildActionCodeSettings,
  computeResendState,
  resendCooldownStorageKey,
  shouldBlockUnverifiedAccess,
  getVerificationStrings
} from "./email-verification-core.mjs";
import { getFriendlyAuthError } from "./auth-google-core.mjs";

export { shouldBlockUnverifiedAccess };

const locale = (localStorage.getItem("ofek-ai-language") || "en") === "he" ? "he" : "en";
const verificationStrings = getVerificationStrings(locale);
const actionCodeSettings = buildActionCodeSettings(window.location.origin);

let verificationGateInterval = null;

// recheckListenersController lets removeVerificationGate() tear down the
// visibilitychange/focus auto-recheck listeners added by the last
// renderVerificationGate() call -- without this, navigating through several
// gated pages (or a resend-then-verified cycle) would stack up listeners.
let recheckListenersController = null;

export function removeVerificationGate() {
  if (verificationGateInterval) {
    clearInterval(verificationGateInterval);
    verificationGateInterval = null;
  }
  recheckListenersController?.abort();
  recheckListenersController = null;
  document.getElementById("verificationGate")?.remove();
}

// renderVerificationGate(user, { onVerified }) -- onVerified(user) is called
// AT MOST ONCE, the moment this user is confirmed to have verified their
// email (via the "I've verified my email" button, or an automatic recheck
// when the tab regains focus/visibility after verifying in another tab).
// Section 5's recovery flow: call user.reload(), confirm emailVerified,
// then let the CALLER restore the already-open protected page in place --
// this never navigates or reloads the page itself, so there is nothing to
// "redirect back to" and therefore no redirect loop is possible.
export function renderVerificationGate(user, { onVerified } = {}) {
  removeVerificationGate();
  let verifiedHandled = false;

  const overlay = document.createElement("div");
  overlay.id = "verificationGate";
  overlay.setAttribute("role", "alertdialog");
  overlay.setAttribute("aria-modal", "true");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "10000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "var(--fp-overlay, rgba(3, 10, 22, 0.86))",
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
  });
  if (locale === "he") {
    overlay.setAttribute("dir", "rtl");
    overlay.setAttribute("lang", "he");
  }

  const card = document.createElement("div");
  Object.assign(card.style, {
    width: "100%",
    maxWidth: "440px",
    padding: "30px",
    border: "1px solid var(--fp-border, #285477)",
    borderRadius: "22px",
    background: "var(--fp-surface, #102743)",
    boxShadow: "var(--fp-shadow-raised, 0 18px 40px rgba(2,6,14,0.6))",
    color: "var(--fp-text-primary, #f4f8ff)",
    textAlign: "center"
  });

  const title = document.createElement("h2");
  title.textContent = verificationStrings.gateTitle;
  Object.assign(title.style, { margin: "0 0 12px", fontSize: "21px", fontWeight: "900" });

  const body = document.createElement("p");
  body.textContent = verificationStrings.gateBody;
  Object.assign(body.style, {
    margin: "0 0 22px",
    color: "var(--fp-text-muted, #8fa8c2)",
    fontSize: "14px",
    lineHeight: "1.65"
  });

  const resendButton = document.createElement("button");
  resendButton.type = "button";
  Object.assign(resendButton.style, {
    display: "block",
    width: "100%",
    padding: "14px",
    border: "0",
    borderRadius: "13px",
    color: "var(--fp-text-inverse, #06111f)",
    background: "linear-gradient(135deg, var(--fp-brand-primary, #2f9bff), var(--fp-brand-secondary, #35cfdf))",
    fontSize: "15px",
    fontWeight: "800",
    cursor: "pointer"
  });

  const resendMessage = document.createElement("p");
  Object.assign(resendMessage.style, { margin: "12px 0 0", fontSize: "13px", minHeight: "18px" });
  resendMessage.setAttribute("role", "status");
  resendMessage.setAttribute("aria-live", "polite");

  // "I've verified my email" -- section 5's recovery flow. Reloads the
  // Firebase user (the SDK mutates the same User object in place, it does
  // not reliably re-fire onAuthStateChanged on its own) and, if
  // emailVerified is now true, hands control back to the caller via
  // onVerified -- which restores the already-open protected page in place,
  // with no navigation and therefore no possibility of a redirect loop.
  const checkVerifiedButton = document.createElement("button");
  checkVerifiedButton.type = "button";
  checkVerifiedButton.textContent = verificationStrings.checkVerifiedButton;
  Object.assign(checkVerifiedButton.style, {
    display: "block",
    width: "100%",
    marginTop: "12px",
    padding: "12px",
    border: "1px solid var(--fp-border, #285477)",
    borderRadius: "13px",
    color: "var(--fp-text-primary, #f4f8ff)",
    background: "var(--fp-surface-raised, #173654)",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer"
  });

  const signOutButton = document.createElement("button");
  signOutButton.type = "button";
  signOutButton.textContent = verificationStrings.signOutButton;
  Object.assign(signOutButton.style, {
    display: "block",
    width: "100%",
    marginTop: "12px",
    padding: "12px",
    border: "1px solid var(--fp-border, #285477)",
    borderRadius: "13px",
    color: "var(--fp-text-secondary, #c5d5e8)",
    background: "transparent",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer"
  });

  const changeEmailHint = document.createElement("p");
  changeEmailHint.textContent = verificationStrings.changeEmailHint;
  Object.assign(changeEmailHint.style, {
    margin: "18px 0 0",
    color: "var(--fp-text-muted, #8fa8c2)",
    fontSize: "12px",
    lineHeight: "1.6"
  });

  const cooldownKey = resendCooldownStorageKey(user.uid);

  function readLastSentAt() {
    try {
      const raw = window.localStorage.getItem(cooldownKey);
      const parsed = raw ? Number(raw) : null;
      return Number.isFinite(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function writeLastSentAt(nowMs) {
    try {
      // Non-sensitive cooldown metadata only: a plain epoch-millisecond
      // number, never the email address, a token, or the oobCode.
      window.localStorage.setItem(cooldownKey, String(nowMs));
    } catch (error) {
      /* Non-fatal: the cooldown simply won't persist across a reload. */
    }
  }

  function refreshResendButtonState() {
    const { canResend, secondsRemaining } = computeResendState({
      lastSentAtMs: readLastSentAt(),
      nowMs: Date.now()
    });

    resendButton.disabled = !canResend;
    resendButton.style.cursor = canResend ? "pointer" : "not-allowed";
    resendButton.style.opacity = canResend ? "1" : "0.6";
    resendButton.textContent = canResend
      ? verificationStrings.resendButton
      : verificationStrings.resendCooldown(secondsRemaining);
  }

  async function handleResendClick() {
    // Belt and braces against a double-click racing the disabled state.
    if (resendButton.disabled) return;

    resendButton.disabled = true;
    resendButton.textContent = verificationStrings.resendLoading;
    resendMessage.textContent = "";
    resendMessage.style.color = "";

    try {
      await sendEmailVerification(user, actionCodeSettings);
      writeLastSentAt(Date.now());
      resendMessage.textContent = verificationStrings.resendSuccess;
      resendMessage.style.color = "var(--fp-success, #55c98a)";
    } catch (error) {
      console.error("Resend verification email error:", error?.code || "unknown");
      // auth/too-many-requests is Firebase's own real rate limit (distinct
      // from the client-side cooldown above) — handled with the same
      // friendly, non-leaking copy as everywhere else in this product.
      resendMessage.textContent = getFriendlyAuthError(error?.code, locale);
      resendMessage.style.color = "var(--fp-danger, #ef6f7f)";
    } finally {
      refreshResendButtonState();
    }
  }

  // Runs the reload-and-recheck. `silent` suppresses the "still not
  // verified" message for the automatic focus/visibility recheck -- a user
  // who merely switched tabs and switched back hasn't necessarily gone to
  // verify anything, so that path must not nag them with an error state.
  async function recheckVerification({ silent } = {}) {
    if (verifiedHandled) return;

    if (!silent) {
      checkVerifiedButton.disabled = true;
      checkVerifiedButton.textContent = verificationStrings.checkVerifiedLoading;
      resendMessage.textContent = "";
      resendMessage.style.color = "";
    }

    try {
      await user.reload();
    } catch (error) {
      // A reload can fail if the user was deleted/disabled elsewhere; fall
      // through to the still-verified check below, which will correctly
      // stay blocked rather than throwing past the caller.
      console.error("Reloading the user during verification recheck failed:", error?.code || "unknown");
    }

    if (!shouldBlockUnverifiedAccess(user)) {
      verifiedHandled = true;
      removeVerificationGate();
      onVerified?.(user);
      return;
    }

    if (!silent) {
      resendMessage.textContent = verificationStrings.stillNotVerified;
      resendMessage.style.color = "var(--fp-warning, #e1b75d)";
      checkVerifiedButton.disabled = false;
      checkVerifiedButton.textContent = verificationStrings.checkVerifiedButton;
    }
  }

  resendButton.addEventListener("click", handleResendClick);
  checkVerifiedButton.addEventListener("click", () => recheckVerification());
  signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;
    try {
      await signOut(auth);
      window.location.replace("/auth.html");
    } catch (error) {
      console.error("Sign-out from the verification gate failed:", error);
      signOutButton.disabled = false;
    }
  });

  card.append(title, body, resendButton, checkVerifiedButton, resendMessage, signOutButton, changeEmailHint);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  refreshResendButtonState();
  // Ticks the cooldown countdown text once a second — purely a display
  // refresh, never triggers a send on its own.
  verificationGateInterval = window.setInterval(refreshResendButtonState, 1000);

  // Auto-recheck when the tab regains focus/visibility -- the common case
  // is verifying in another tab and switching back, and requiring a manual
  // click every time would be needless friction. One AbortController tears
  // down both listeners together, and only ever one set is live at a time
  // (removeVerificationGate always aborts the previous controller first).
  recheckListenersController = new AbortController();
  const recheckOptions = { signal: recheckListenersController.signal };
  const silentRecheck = () => recheckVerification({ silent: true });
  window.addEventListener("focus", silentRecheck, recheckOptions);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") silentRecheck();
  }, recheckOptions);

  resendButton.focus();
}

// guardProtectedPage({ onAuthenticated, onSignedOut }) -- the single ordering
// primitive every protected page should use: resolve Firebase auth state ->
// verify a user is signed in -> verify the email policy -> only THEN call
// onAuthenticated(user) to initialize the page's private data/features.
// Content stays hidden (body.style.visibility) for the entire time between
// "auth state unknown" and "cleared for access" -- there is no window where
// the protected feature initializes and then gets covered by an overlay.
//
// onAuthenticated is guaranteed to run AT MOST ONCE per page load, whether
// the user was verified from the start or became verified later via the
// gate's "I've verified my email" recovery (see renderVerificationGate's
// onVerified) -- guarding against both a redirect loop and a duplicate
// initialization.
//
// onSignedOut defaults to redirecting to /auth.html; pages that need a
// custom not-signed-in destination (e.g. preserving a return path) may pass
// their own.
export function guardProtectedPage({ onAuthenticated, onSignedOut } = {}) {
  document.body.style.visibility = "hidden";
  let initialized = false;

  function proceed(user) {
    if (initialized) return;
    initialized = true;
    removeVerificationGate();
    document.body.style.visibility = "visible";
    onAuthenticated?.(user);
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      removeVerificationGate();
      if (onSignedOut) onSignedOut();
      else window.location.replace("/auth.html");
      return;
    }

    if (shouldBlockUnverifiedAccess(user)) {
      renderVerificationGate(user, { onVerified: proceed });
      // The GATE must be visible even though the protected feature itself
      // stays uninitialized -- this reveals the gate overlay, not any
      // private content underneath it.
      document.body.style.visibility = "visible";
      return;
    }

    proceed(user);
  });
}
