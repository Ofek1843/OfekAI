import { auth, db } from "./firebase-config.js";
import { trackEvent, trackPageView } from "./analytics.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  linkWithCredential,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  TERMS_VERSION,
  REDIRECT_NEXT_STORAGE_KEY,
  GOOGLE_OAUTH_SCOPES,
  resolveNextPath,
  shouldUseRedirect,
  needsTermsAcceptance,
  buildUserDocumentMerge,
  getFriendlyAuthError,
  isUserCancelledAuth,
  getAuthStrings
} from "./auth-google-core.mjs";

import {
  buildActionCodeSettings,
  getVerificationStrings
} from "./email-verification-core.mjs";

const locale = (localStorage.getItem("ofek-ai-language") || "en") === "he" ? "he" : "en";
const strings = getAuthStrings(locale);
const verificationStrings = getVerificationStrings(locale);
const actionCodeSettings = buildActionCodeSettings(window.location.origin);

// Firebase's own emailed templates (verification, password reset) render in
// whatever language this is set to — must be set before either is
// triggered so the recipient gets a template matching the app's language,
// not always English.
auth.languageCode = locale;

// The requested destination survives a full-page signInWithRedirect round
// trip via sessionStorage — the ?next= query string is gone by the time the
// provider navigates back to this page.
const requestedNext = new URLSearchParams(window.location.search).get("next");
const storedNext = safeSessionGet(REDIRECT_NEXT_STORAGE_KEY);
const nextPath = resolveNextPath(requestedNext || storedNext);

const loginTab =
  document.getElementById("loginTab");

const signupTab =
  document.getElementById("signupTab");

const submitButton =
  document.getElementById("submitButton");

const passwordInput =
  document.getElementById("password");

const emailInput =
  document.getElementById("email");

const displayNameInput =
  document.getElementById("displayName");

const nameGroup =
  document.getElementById("nameGroup");

const authForm =
  document.getElementById("authForm");

const authMessage =
  document.getElementById("authMessage");
const termsGroup = document.getElementById("termsGroup");
const termsAccepted = document.getElementById("termsAccepted");
const rememberMeInput = document.getElementById("rememberMe");

const googleButton = document.getElementById("googleButton");
const googleButtonLabel = document.getElementById("googleButtonLabel");
const authSeparator = document.getElementById("authSeparator");

const termsGatePanel = document.getElementById("termsGatePanel");
const termsGateAccepted = document.getElementById("termsGateAccepted");
const termsGateSubmit = document.getElementById("termsGateSubmit");
const termsGateCancel = document.getElementById("termsGateCancel");
const termsGateMessage = document.getElementById("termsGateMessage");

const linkAccountPanel = document.getElementById("linkAccountPanel");
const linkEmail = document.getElementById("linkEmail");
const linkPassword = document.getElementById("linkPassword");
const linkSubmit = document.getElementById("linkSubmit");
const linkCancel = document.getElementById("linkCancel");
const linkMessage = document.getElementById("linkMessage");

const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const forgotPasswordPanel = document.getElementById("forgotPasswordPanel");
const forgotPasswordEmail = document.getElementById("forgotPasswordEmail");
const forgotPasswordSubmit = document.getElementById("forgotPasswordSubmit");
const forgotPasswordCancel = document.getElementById("forgotPasswordCancel");
const forgotPasswordMessage = document.getElementById("forgotPasswordMessage");

let currentMode = "login";
let authenticationCompleted = false;
// True from the moment a Google flow starts until it either redirects into
// the product or is fully cancelled. While it's set, the onAuthStateChanged
// guard must NOT redirect: a first-time Google user IS signed in but has not
// accepted the terms yet, and redirecting them would both bypass the gate and
// create an auth.html -> dashboard -> auth.html loop.
let googleFlowInProgress = false;
// Set once a popup has been blocked, so the next attempt goes straight to the
// redirect flow instead of silently failing the same way again.
let preferRedirectFallback = false;
// The Google credential recovered from an account-collision error, held only
// in memory for the duration of the linking flow.
let pendingGoogleCredential = null;
// The authenticated-but-not-yet-cleared user held between showing the terms
// gate and the user accepting it.
let pendingProfile = null;

trackPageView({ page: "auth" });

function safeSessionGet(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch (error) {
    // Private-mode Safari and some embedded webviews throw on storage access.
    return null;
  }
}

function safeSessionSet(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch (error) {
    /* Non-fatal: we fall back to the default destination after the redirect. */
  }
}

function safeSessionRemove(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch (error) {
    /* Non-fatal. */
  }
}

function showMessage(text, type) {
  authMessage.textContent = text;
  authMessage.className = `message ${type}`;
}

function clearMessage() {
  authMessage.textContent = "";
  authMessage.className = "message";
}

function showPanelMessage(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.className = `message ${type}`;
}

function revealPage() {
  document.body.classList.remove("auth-checking");
}

function changeMode(mode) {
  currentMode = mode;

  const isLogin = mode === "login";

  loginTab.classList.toggle(
    "active",
    isLogin
  );

  signupTab.classList.toggle(
    "active",
    !isLogin
  );

  nameGroup.classList.toggle(
    "hidden",
    isLogin
  );

  displayNameInput.required = !isLogin;
  termsGroup?.classList.toggle("hidden", isLogin);
  if (termsAccepted) {
    termsAccepted.required = !isLogin;
    if (isLogin) termsAccepted.checked = false;
  }

  submitButton.textContent = isLogin
    ? "Log in"
    : "Create account";

  passwordInput.autocomplete = isLogin
    ? "current-password"
    : "new-password";

  clearMessage();
}

function getFriendlyError(errorCode) {
  return getFriendlyAuthError(errorCode, locale);
}

// --- Localized labels for the Google/terms/linking UI ---------------------
// Applied at render time from the shared string table so English and Hebrew
// can never drift apart in the markup.
function applyLocalizedLabels() {
  if (googleButtonLabel) googleButtonLabel.textContent = strings.continueWithGoogle;
  if (authSeparator) authSeparator.textContent = strings.orSeparator;

  setTextById("termsGateTitle", strings.termsGateTitle);
  setTextById("termsGateBody", strings.termsGateBody);
  renderTermsGateConsent();
  if (termsGateSubmit) termsGateSubmit.textContent = strings.termsGateAccept;
  if (termsGateCancel) termsGateCancel.textContent = strings.termsGateDecline;

  setTextById("linkTitle", strings.linkTitle);
  setTextById("linkBody", strings.linkBody);
  setTextById("linkPasswordLabel", strings.linkPasswordLabel);
  if (linkSubmit) linkSubmit.textContent = strings.linkSubmit;
  if (linkCancel) linkCancel.textContent = strings.linkCancel;

  if (forgotPasswordLink) forgotPasswordLink.textContent = verificationStrings.forgotPasswordLink;
  setTextById("forgotPasswordTitle", verificationStrings.forgotPasswordTitle);
  setTextById("forgotPasswordBody", verificationStrings.forgotPasswordBody);
  setTextById("forgotPasswordEmailLabel", verificationStrings.forgotPasswordEmailLabel);
  if (forgotPasswordSubmit) forgotPasswordSubmit.textContent = verificationStrings.forgotPasswordSubmit;
  if (forgotPasswordCancel) forgotPasswordCancel.textContent = verificationStrings.forgotPasswordCancel;

  if (locale === "he") {
    // Scoped to the elements this feature introduced, NOT the whole document:
    // the email/password form on this page is still English, and flipping
    // <html dir> would right-align that pre-existing layout too.
    for (const element of [googleButton, termsGatePanel, linkAccountPanel, forgotPasswordLink, forgotPasswordPanel]) {
      element?.setAttribute("dir", "rtl");
      element?.setAttribute("lang", "he");
    }
  }
}

// Rebuilds the consent sentence from localized text nodes with the terms
// link in the middle. Built from DOM nodes rather than an HTML string so no
// markup is ever injected, and so each locale can place the link where its
// own sentence structure needs it.
function renderTermsGateConsent() {
  const container = document.getElementById("termsGateCheckboxLabel");
  if (!container) return;

  const link = document.createElement("a");
  link.href = "/terms.html";
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = strings.termsGateCheckboxLink;

  container.replaceChildren(
    document.createTextNode(strings.termsGateCheckboxBefore),
    link,
    document.createTextNode(strings.termsGateCheckboxAfter)
  );
}

function setTextById(id, text) {
  const element = document.getElementById(id);
  if (element && text) element.textContent = text;
}

function setGoogleButtonBusy(isBusy) {
  if (!googleButton) return;
  googleButton.disabled = isBusy;
  if (googleButtonLabel) {
    googleButtonLabel.textContent = isBusy ? strings.googleLoading : strings.continueWithGoogle;
  }
}

const ALL_PANELS = [termsGatePanel, linkAccountPanel, forgotPasswordPanel];

function openPanel(panel) {
  document.body.classList.add("auth-panel-open");
  for (const element of ALL_PANELS) element?.classList.remove("visible");
  panel?.classList.add("visible");
  revealPage();
}

function closePanels() {
  document.body.classList.remove("auth-panel-open");
  for (const element of ALL_PANELS) element?.classList.remove("visible");
}

function redirectToProduct() {
  safeSessionRemove(REDIRECT_NEXT_STORAGE_KEY);
  window.location.replace(nextPath);
}

// --- Shared post-authentication path -------------------------------------
// Runs for every successful Google credential (popup, redirect return, and
// post-linking). Reads the existing profile first so a returning user is
// never re-prompted for terms they already accepted, and so the merge write
// can never blank out a value this provider didn't supply.
async function finalizeGoogleUser(user, { isNewLink = false } = {}) {
  const profileRef = doc(db, "users", user.uid);
  let existingProfile = null;

  try {
    const snapshot = await getDoc(profileRef);
    if (snapshot.exists()) existingProfile = snapshot.data();
  } catch (error) {
    console.error("Could not read the user profile:", error);
    // Fall through with existingProfile = null: the terms gate will be shown.
    // Prompting once more is the safe failure mode; silently granting access
    // without a recorded acceptance is not.
  }

  if (needsTermsAcceptance(existingProfile, TERMS_VERSION)) {
    pendingProfile = { user, existingProfile, isNewLink };
    openPanel(termsGatePanel);
    showPanelMessage(termsGateMessage, "", "");
    return;
  }

  await setDoc(profileRef, buildUserDocumentMerge({
    authUser: user,
    existingProfile,
    providerId: GoogleAuthProvider.PROVIDER_ID,
    acceptedTermsVersion: null,
    now: serverTimestamp()
  }), { merge: true });

  authenticationCompleted = true;
  trackEvent("login", { method: "google" });
  showMessage(strings.signingIn, "success");
  redirectToProduct();
}

// --- Google sign-in entry point ------------------------------------------
async function startGoogleSignIn() {
  clearMessage();
  googleFlowInProgress = true;
  setGoogleButtonBusy(true);

  const provider = new GoogleAuthProvider();
  // Authentication only. GOOGLE_OAUTH_SCOPES is deliberately empty: Firebase
  // already receives basic profile + email, and this product has no reason to
  // ask for Gmail, Contacts, Drive or Calendar access.
  for (const scope of GOOGLE_OAUTH_SCOPES) provider.addScope(scope);
  // Always let the user pick which Google account to use rather than silently
  // reusing whichever one the browser last signed into.
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await setPersistence(
      auth,
      rememberMeInput?.checked
        ? browserLocalPersistence
        : browserSessionPersistence
    );

    const useRedirect = preferRedirectFallback || shouldUseRedirect({
      userAgent: window.navigator.userAgent,
      isStandalone: isStandaloneDisplayMode()
    });

    if (useRedirect) {
      // Persist the destination before navigating away — the query string
      // does not survive the provider round trip.
      if (requestedNext) safeSessionSet(REDIRECT_NEXT_STORAGE_KEY, requestedNext);
      await signInWithRedirect(auth, provider);
      return; // The page navigates; getRedirectResult picks it up on return.
    }

    const result = await signInWithPopup(auth, provider);
    await finalizeGoogleUser(result.user);
  } catch (error) {
    handleGoogleError(error);
  } finally {
    setGoogleButtonBusy(false);
    // googleFlowInProgress stays set while a panel is open so the
    // onAuthStateChanged guard cannot redirect past the terms gate.
    if (!isPanelOpen()) googleFlowInProgress = false;
  }
}

function isStandaloneDisplayMode() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.navigator.standalone === true
  );
}

function isPanelOpen() {
  return document.body.classList.contains("auth-panel-open");
}

function handleGoogleError(error) {
  console.error("Google authentication error:", error);

  if (error?.code === "auth/account-exists-with-different-credential") {
    startAccountLinking(error);
    return;
  }

  if (error?.code === "auth/popup-blocked") {
    // Next attempt uses the redirect flow, which no popup blocker can stop.
    preferRedirectFallback = true;
  }

  // A user who closed the popup did not fail — show it as a neutral notice,
  // not a red error.
  showMessage(
    getFriendlyError(error?.code),
    isUserCancelledAuth(error?.code) ? "success" : "error"
  );
}

// --- Existing-account collision -> safe linking flow ----------------------
// Firebase refuses to silently create a second identity for an email that
// already has a password account. We recover the Google credential from the
// error, prove ownership via the existing password, then LINK — the uid, and
// therefore every plan, workout and nutrition document, is preserved.
function startAccountLinking(error) {
  pendingGoogleCredential = GoogleAuthProvider.credentialFromError(error);
  const collidingEmail = error?.customData?.email || "";

  if (!pendingGoogleCredential) {
    showMessage(getFriendlyError(error?.code), "error");
    return;
  }

  if (linkEmail) linkEmail.value = collidingEmail;
  if (linkPassword) linkPassword.value = "";
  showPanelMessage(linkMessage, getFriendlyError(error?.code), "error");
  googleFlowInProgress = true;
  openPanel(linkAccountPanel);
  linkPassword?.focus();
  trackEvent("google_link_prompted", { method: "google" });
}

async function submitAccountLinking() {
  const email = linkEmail?.value?.trim();
  const password = linkPassword?.value || "";

  if (!email || password.length < 6) {
    showPanelMessage(linkMessage, getFriendlyAuthError("auth/missing-password", locale), "error");
    return;
  }

  if (!pendingGoogleCredential) {
    showPanelMessage(linkMessage, getFriendlyError("default"), "error");
    return;
  }

  linkSubmit.disabled = true;
  linkSubmit.textContent = strings.linkLoading;

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await linkWithCredential(credential.user, pendingGoogleCredential);
    pendingGoogleCredential = null;

    showPanelMessage(linkMessage, strings.linkSuccess, "success");
    trackEvent("google_link_completed", { method: "google" });

    closePanels();
    await finalizeGoogleUser(credential.user, { isNewLink: true });
  } catch (error) {
    console.error("Google account linking error:", error);
    showPanelMessage(linkMessage, getFriendlyError(error?.code), "error");
  } finally {
    linkSubmit.disabled = false;
    linkSubmit.textContent = strings.linkSubmit;
  }
}

async function cancelAccountLinking() {
  pendingGoogleCredential = null;
  closePanels();
  googleFlowInProgress = false;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign-out after cancelled linking failed:", error);
  }
  clearMessage();
}

// --- Terms gate ----------------------------------------------------------
async function submitTermsAcceptance() {
  if (!termsGateAccepted?.checked) {
    showPanelMessage(termsGateMessage, strings.termsGateRequired, "error");
    return;
  }

  if (!pendingProfile?.user) {
    showPanelMessage(termsGateMessage, getFriendlyError("default"), "error");
    return;
  }

  termsGateSubmit.disabled = true;

  try {
    const { user, existingProfile } = pendingProfile;

    await setDoc(doc(db, "users", user.uid), buildUserDocumentMerge({
      authUser: user,
      existingProfile,
      providerId: GoogleAuthProvider.PROVIDER_ID,
      acceptedTermsVersion: TERMS_VERSION,
      now: serverTimestamp()
    }), { merge: true });

    authenticationCompleted = true;
    pendingProfile = null;

    if (!existingProfile) {
      trackEvent("signup", { method: "google" });
      trackEvent("signup_completed", { method: "google" });
    }

    closePanels();
    redirectToProduct();
  } catch (error) {
    console.error("Could not record the terms acceptance:", error);
    showPanelMessage(termsGateMessage, getFriendlyError(error?.code), "error");
    termsGateSubmit.disabled = false;
  }
}

// Declining the terms must not leave a signed-in-but-unaccepted session
// sitting there: sign the user back out and return them to the form.
async function cancelTermsAcceptance() {
  pendingProfile = null;
  closePanels();
  googleFlowInProgress = false;

  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign-out after declined terms failed:", error);
  }

  clearMessage();
}

// --- Forgot password -------------------------------------------------------
// Requesting a reset link must never reveal whether an email address is
// actually registered — that is an account-enumeration leak. Firebase's
// sendPasswordResetEmail already rejects unregistered addresses with
// auth/user-not-found; that specific code is deliberately treated as SUCCESS
// here so the confirmation shown is identical either way.
function openForgotPassword() {
  clearMessage();
  if (forgotPasswordEmail) forgotPasswordEmail.value = emailInput.value.trim();
  showPanelMessage(forgotPasswordMessage, "", "");
  openPanel(forgotPasswordPanel);
  forgotPasswordEmail?.focus();
  trackEvent("password_reset_requested");
}

async function submitForgotPassword() {
  const email = forgotPasswordEmail?.value?.trim();

  if (!email) {
    showPanelMessage(forgotPasswordMessage, getFriendlyAuthError("auth/invalid-email", locale), "error");
    return;
  }

  forgotPasswordSubmit.disabled = true;
  forgotPasswordSubmit.textContent = verificationStrings.forgotPasswordSubmitting;

  try {
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
    showPanelMessage(forgotPasswordMessage, verificationStrings.forgotPasswordConfirmation, "success");
  } catch (error) {
    console.error("Password reset request error:", error?.code || "unknown");

    // Privacy-safe by design: an unregistered address is not distinguishable
    // from a registered one that was just emailed.
    if (error?.code === "auth/user-not-found" || error?.code === "auth/invalid-email") {
      showPanelMessage(forgotPasswordMessage, verificationStrings.forgotPasswordConfirmation, "success");
      return;
    }

    showPanelMessage(forgotPasswordMessage, getFriendlyError(error?.code), "error");
  } finally {
    forgotPasswordSubmit.disabled = false;
    forgotPasswordSubmit.textContent = verificationStrings.forgotPasswordSubmit;
  }
}

function cancelForgotPassword() {
  closePanels();
  clearMessage();
}

// --- Wiring --------------------------------------------------------------
loginTab.addEventListener("click", () => {
  changeMode("login");
});
signupTab.addEventListener("click", () => {
  changeMode("signup");
  trackEvent("signup_started", { method: "email_password" });
});

googleButton?.addEventListener("click", () => {
  trackEvent("signup_started", { method: "google" });
  startGoogleSignIn();
});

termsGateSubmit?.addEventListener("click", submitTermsAcceptance);
termsGateCancel?.addEventListener("click", cancelTermsAcceptance);
linkSubmit?.addEventListener("click", submitAccountLinking);
linkCancel?.addEventListener("click", cancelAccountLinking);

forgotPasswordLink?.addEventListener("click", (event) => {
  event.preventDefault();
  openForgotPassword();
});
forgotPasswordSubmit?.addEventListener("click", submitForgotPassword);
forgotPasswordCancel?.addEventListener("click", cancelForgotPassword);

authForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();
    clearMessage();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const displayName =
      displayNameInput.value
        .replace(/\s+/g, " ")
        .trim();

    if (!email || !password) {
      showMessage(
        "Please enter your email and password.",
        "error"
      );

      return;
    }

    if (
      currentMode === "signup" &&
      displayName.length < 2
    ) {
      showMessage(
        "Please enter your full name.",
        "error"
      );

      return;
    }

    if (currentMode === "signup" && !termsAccepted?.checked) {
      showMessage("You must accept the Terms and Health Disclaimer to create an account.", "error");
      return;
    }

    if (password.length < 6) {
      showMessage(
        "The password must contain at least 6 characters.",
        "error"
      );

      return;
    }

    submitButton.disabled = true;

    submitButton.textContent =
      currentMode === "login"
        ? "Logging in..."
        : "Creating account...";

    try {
      await setPersistence(
        auth,
        rememberMeInput?.checked
          ? browserLocalPersistence
          : browserSessionPersistence
      );

      if (currentMode === "signup") {
        const userCredential =
          await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );

        await updateProfile(
          userCredential.user,
          {
            displayName
          }
        );

        await setDoc(doc(db, "users", userCredential.user.uid), {
          email: userCredential.user.email || email,
          displayName,
          authProviders: ["password"],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          termsAccepted: true,
          termsVersion: TERMS_VERSION,
          termsAcceptedAt: serverTimestamp()
        }, { merge: true });

        // auth.languageCode was already set at module load, before this call,
        // so the emailed template renders in the visitor's language.
        try {
          await sendEmailVerification(userCredential.user, actionCodeSettings);
        } catch (verificationError) {
          // The account and profile document both already exist at this
          // point — a verification-send failure (e.g. a transient
          // auth/too-many-requests from rapid test signups) must not be
          // treated as signup failing outright. The user can resend from the
          // verification gate once they reach the product.
          console.error("Could not send the verification email:", verificationError?.code || "unknown");
        }

        authenticationCompleted = true;
        trackEvent("signup", { method: "email_password" });
        trackEvent("signup_completed", { method: "email_password" });

        // Never claims the address is already verified — the account is
        // created, but verifying the emailed link is a separate step.
        showMessage(
          verificationStrings.checkEmailBody,
          "success"
        );
      } else {
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        authenticationCompleted = true;

        showMessage(
          "Logged in successfully. Redirecting...",
          "success"
        );
      }

window.setTimeout(() => {
  redirectToProduct();
}, 800);
    } catch (error) {
      console.error(
        "Firebase authentication error:",
        error
      );

      showMessage(
        getFriendlyError(error.code),
        "error"
      );
    } finally {
      submitButton.disabled = false;

      submitButton.textContent =
        currentMode === "login"
          ? "Log in"
          : "Create account";
    }
  }
);

// --- Bootstrap -----------------------------------------------------------
// The redirect result is resolved BEFORE the onAuthStateChanged guard is
// registered. Doing it the other way round races: the guard would see the
// signed-in user from the redirect and bounce them into the product before
// the terms gate ever had a chance to run.
async function bootstrap() {
  applyLocalizedLabels();

  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      googleFlowInProgress = true;
      await finalizeGoogleUser(result.user);
      // finalizeGoogleUser either redirected or opened the terms gate; in
      // both cases the auth-state guard must not also act.
      if (isPanelOpen()) {
        revealPage();
        return;
      }
      return;
    }
  } catch (error) {
    handleGoogleError(error);
    if (isPanelOpen()) {
      revealPage();
      return;
    }
  } finally {
    safeSessionRemove(REDIRECT_NEXT_STORAGE_KEY);
  }

  onAuthStateChanged(auth, (user) => {
    // Never redirect while a Google flow is mid-way (terms gate or account
    // linking open): the user is authenticated but not yet cleared for
    // product access, and redirecting would both bypass the gate and bounce
    // them straight back here.
    if (googleFlowInProgress || isPanelOpen()) {
      revealPage();
      return;
    }

    if (user && !authenticationCompleted) {
      redirectToProduct();
      return;
    }

    revealPage();
  });
}

bootstrap();
// Signed-in users enter the product through the dashboard.
