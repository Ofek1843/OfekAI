// Single handler for every Firebase Authentication email action.
//
// Firebase sends one Action URL for all email templates and distinguishes
// them with ?mode=. This page reads mode/oobCode/continueUrl/lang, runs the
// matching Firebase call, and paints exactly one of the states defined in
// auth-action.html — never a Firebase error, never the action code.
//
// All decision logic (mode allowlist, continueUrl origin allowlist, password
// policy, locale resolution, failure classification, copy) lives in
// ./auth-action-core.mjs as pure functions so it is unit-testable outside a
// browser. This file is only Firebase + DOM wiring.

import { auth } from "./firebase-config.js";

import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  isSupportedMode,
  validatePassword,
  passwordErrorMessage,
  resolveContinueUrl,
  resolveLocale,
  isRtlLocale,
  classifyActionFailure,
  failureCopy,
  getActionStrings,
  containsSensitiveDetail
} from "./auth-action-core.mjs";

const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") || "";
const oobCode = params.get("oobCode") || "";
const continueUrlParam = params.get("continueUrl") || "";
const langParam = params.get("lang") || "";

const locale = resolveLocale({
  langParam,
  storedLanguage: safeLocalGet("ofek-ai-language")
});
const strings = getActionStrings(locale);

// Validated to a same-origin PATH before it is ever used as a destination.
// An unrecognized or hostile origin silently becomes the dashboard.
const continuePath = resolveContinueUrl(continueUrlParam);

// The one-time action code must never reach the address bar of any page we
// navigate to, any log, or any rendered string. Strip it from this page's own
// URL as soon as it has been read, so a screenshot, a shoulder-surf or a
// shared link cannot replay it.
scrubUrl();

function scrubUrl() {
  try {
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (error) {
    /* Non-fatal: some embedded webviews disallow history manipulation. */
  }
}

function safeLocalGet(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch (error) {
    return "";
  }
}

// --- DOM -----------------------------------------------------------------
const panels = {
  loading: document.getElementById("loadingPanel"),
  verify: document.getElementById("verifyPanel"),
  reset: document.getElementById("resetPanel"),
  resetSuccess: document.getElementById("resetSuccessPanel"),
  recover: document.getElementById("recoverPanel"),
  failure: document.getElementById("failurePanel")
};

const resetForm = document.getElementById("resetForm");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");
const newPasswordError = document.getElementById("newPasswordError");
const confirmPasswordError = document.getElementById("confirmPasswordError");
const resetSubmit = document.getElementById("resetSubmit");
const resetMessage = document.getElementById("resetMessage");
const recoverPrimary = document.getElementById("recoverPrimary");
const recoverMessage = document.getElementById("recoverMessage");

// The email whose recovery this page just performed. Held in memory only for
// the duration of the "reset password too?" offer and never rendered.
let recoveredEmail = "";

function showPanel(name) {
  for (const [key, element] of Object.entries(panels)) {
    element?.classList.toggle("visible", key === name);
  }
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (!element || !text) return;

  // Final assertion before painting: nothing carrying a Firebase error code
  // or the action code may ever be rendered. If this ever trips it is a bug
  // in the copy pipeline, so fall back to the safe generic line.
  if (containsSensitiveDetail(text, { oobCode })) {
    element.textContent = strings.genericBody;
    return;
  }
  element.textContent = text;
}

function applyLocale() {
  document.documentElement.setAttribute("lang", locale);
  if (isRtlLocale(locale)) {
    document.documentElement.setAttribute("dir", "rtl");
  }
  document.title = `${strings.pageTitle} | FuelPhysique`;

  setText("loadingTitle", strings.loadingTitle);
  setText("loadingBody", strings.loadingBody);

  setText("verifyTitle", strings.verifySuccessTitle);
  setText("verifyLead", strings.verifySuccessLead);
  setText("verifyBody", strings.verifySuccessBody);
  setText("verifyPrimary", strings.verifyPrimary);
  setText("verifySecondary", strings.verifySecondary);

  setText("resetTitle", strings.resetTitle);
  setText("resetBody", strings.resetBody);
  setText("resetNewLabel", strings.resetNewLabel);
  setText("resetConfirmLabel", strings.resetConfirmLabel);
  setText("resetSubmit", strings.resetSubmit);
  if (newPassword) newPassword.placeholder = strings.resetPlaceholder;
  if (confirmPassword) confirmPassword.placeholder = strings.resetPlaceholder;

  setText("resetSuccessTitle", strings.resetSuccessTitle);
  setText("resetSuccessBody", strings.resetSuccessBody);
  setText("resetPrimary", strings.resetPrimary);

  setText("recoverTitle", strings.recoverTitle);
  setText("recoverLead", strings.recoverLead);
  setText("recoverBody", strings.recoverBody);
  setText("recoverPrimary", strings.recoverPrimary);
  setText("recoverSecondary", strings.recoverSecondary);

  setText("failurePrimary", strings.failurePrimary);
}

// The verified/updated user continues to the validated continueUrl path when
// the email template supplied a safe one, otherwise the dashboard.
function applyContinueDestination() {
  const verifyPrimary = document.getElementById("verifyPrimary");
  if (verifyPrimary) verifyPrimary.setAttribute("href", continuePath);
}

function showFailure(errorCode) {
  const kind = classifyActionFailure(errorCode);
  const copy = failureCopy(kind, locale);
  setText("failureTitle", copy.title);
  setText("failureBody", copy.body);
  showPanel("failure");
}

// --- Field-level inline validation ---------------------------------------
function clearFieldErrors() {
  for (const [input, errorElement] of [
    [newPassword, newPasswordError],
    [confirmPassword, confirmPasswordError]
  ]) {
    input?.classList.remove("invalid");
    input?.removeAttribute("aria-invalid");
    if (errorElement) {
      errorElement.textContent = "";
      errorElement.classList.remove("visible");
    }
  }
  if (resetMessage) {
    resetMessage.textContent = "";
    resetMessage.className = "message";
  }
}

function showFieldError(reason) {
  const message = passwordErrorMessage(reason, locale);
  // A mismatch or a missing confirmation belongs on the confirm field; a
  // missing/short password belongs on the first field.
  const onConfirmField = reason === "mismatch" || reason === "confirmRequired";
  const input = onConfirmField ? confirmPassword : newPassword;
  const errorElement = onConfirmField ? confirmPasswordError : newPasswordError;

  input?.classList.add("invalid");
  input?.setAttribute("aria-invalid", "true");
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add("visible");
  }
  input?.focus();
}

// --- Action handlers ------------------------------------------------------
async function handleVerifyEmail() {
  await applyActionCode(auth, oobCode);
  applyContinueDestination();
  showPanel("verify");
}

async function handleResetPassword() {
  // Validate the code BEFORE showing the form: asking the user to choose a
  // password and only then telling them the link was dead is a poor
  // experience, and it also confirms the code is real before we collect a
  // secret against it.
  await verifyPasswordResetCode(auth, oobCode);
  showPanel("reset");
  newPassword?.focus();
}

async function submitNewPassword(event) {
  event.preventDefault();
  clearFieldErrors();

  const result = validatePassword(newPassword?.value, confirmPassword?.value);
  if (!result.valid) {
    showFieldError(result.reason);
    return;
  }

  resetSubmit.disabled = true;
  setText("resetSubmit", strings.resetSubmitting);

  try {
    await confirmPasswordReset(auth, oobCode, newPassword.value);
    showPanel("resetSuccess");
  } catch (error) {
    const kind = classifyActionFailure(error?.code);

    // A weak password is a correctable field problem, not a dead link — keep
    // the user on the form instead of dropping them onto a failure page.
    if (kind === "weakPassword") {
      showFieldError("weakPassword");
      return;
    }

    if (kind === "network") {
      const copy = failureCopy("network", locale);
      if (resetMessage) {
        resetMessage.textContent = copy.body;
        resetMessage.className = "message error";
      }
      return;
    }

    showFailure(error?.code);
  } finally {
    resetSubmit.disabled = false;
    setText("resetSubmit", strings.resetSubmit);
  }
}

async function handleRecoverEmail() {
  // checkActionCode tells us which address is being restored BEFORE the
  // change is applied, so the follow-up password reset can target it.
  const info = await checkActionCode(auth, oobCode);
  recoveredEmail = info?.data?.email || "";

  await applyActionCode(auth, oobCode);
  showPanel("recover");
}

// Offering a password reset is the standard follow-up: an unexpected email
// change usually means the account is compromised, and restoring the address
// alone does not lock the attacker out.
async function sendRecoveryPasswordReset() {
  if (!recoveredEmail) {
    // Without a known address we cannot send anything — send them to the
    // login page, which has its own reset entry point.
    window.location.href = "/auth.html";
    return;
  }

  recoverPrimary.disabled = true;

  try {
    await sendPasswordResetEmail(auth, recoveredEmail);
    if (recoverMessage) {
      // Deliberately does NOT echo the address back: the page should not
      // render an email that the person reading it may not own.
      recoverMessage.textContent = strings.recoverResetSent;
      recoverMessage.className = "message success";
    }
  } catch (error) {
    const copy = failureCopy(classifyActionFailure(error?.code), locale);
    if (recoverMessage) {
      recoverMessage.textContent = copy.body;
      recoverMessage.className = "message error";
    }
    recoverPrimary.disabled = false;
  }
}

// --- Bootstrap ------------------------------------------------------------
async function run() {
  applyLocale();

  // An unsupported mode or a missing code is an invalid link, full stop — we
  // never hand an unvalidated mode to Firebase.
  if (!isSupportedMode(mode) || !oobCode) {
    showFailure("auth/invalid-action-code");
    return;
  }

  try {
    if (mode === "verifyEmail") {
      await handleVerifyEmail();
    } else if (mode === "resetPassword") {
      await handleResetPassword();
    } else if (mode === "recoverEmail") {
      await handleRecoverEmail();
    }
  } catch (error) {
    // The raw error is useful to us but must never reach the user; log it for
    // diagnostics and paint a classified, friendly state instead.
    console.error("Email action failed:", error?.code || "unknown");
    showFailure(error?.code);
  }
}

resetForm?.addEventListener("submit", submitNewPassword);
newPassword?.addEventListener("input", clearFieldErrors);
confirmPassword?.addEventListener("input", clearFieldErrors);
recoverPrimary?.addEventListener("click", sendRecoveryPasswordReset);

run();
