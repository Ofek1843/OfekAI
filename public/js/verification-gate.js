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

export function removeVerificationGate() {
  if (verificationGateInterval) {
    clearInterval(verificationGateInterval);
    verificationGateInterval = null;
  }
  document.getElementById("verificationGate")?.remove();
}

export function renderVerificationGate(user) {
  removeVerificationGate();

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

  resendButton.addEventListener("click", handleResendClick);
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

  card.append(title, body, resendButton, resendMessage, signOutButton, changeEmailHint);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  refreshResendButtonState();
  // Ticks the cooldown countdown text once a second — purely a display
  // refresh, never triggers a send on its own.
  verificationGateInterval = window.setInterval(refreshResendButtonState, 1000);

  resendButton.focus();
}
