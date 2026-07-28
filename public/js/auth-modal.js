// Reusable in-page sign-in/sign-up modal.
//
// Lets a guest keep filling out a form (e.g. the workout builder wizard)
// without ever navigating away from the page. openAuthModal() opens a
// <dialog>, resolves with the signed-in Firebase user once login/signup
// succeeds, and rejects if the user closes the modal without signing in.
// This module never assigns window.location — the caller decides what to
// do next (e.g. resubmit the form data it already collected).

import { auth, db } from "./firebase-config.js";
import { trackEvent } from "./analytics.js";
import { doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const TEXT = {
  en: {
    loginTab: "Log in", signupTab: "Sign up",
    titleLogin: "Log in to continue", titleSignup: "Create your account",
    subtitle: "Your answers are saved — sign in and we'll generate your plan right away.",
    name: "Full name", namePlaceholder: "Enter your full name",
    email: "Email address", password: "Password",
    remember: "Remember me on this device",
    terms: 'I have read and agree to the <a href="/terms.html" target="_blank">Terms, Health Disclaimer and Privacy Notice</a>. If I am under 18, my parent or legal guardian has approved my use of FuelPhysique.',
    submitLogin: "Log in", submitSignup: "Create account",
    workingLogin: "Logging in...", workingSignup: "Creating account...",
    missingFields: "Please enter your email and password.",
    missingName: "Please enter your full name.",
    missingTerms: "You must accept the Terms and Health Disclaimer to create an account.",
    shortPassword: "The password must contain at least 6 characters.",
    note: 'Your account will be used to save your plans and personalize your experience. <a href="/terms.html" target="_blank">Terms &amp; Health Disclaimer</a>',
    close: "Close",
    errors: {
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/missing-password": "Please enter a password.",
      "auth/weak-password": "The password must contain at least 6 characters.",
      "auth/email-already-in-use": "An account already exists with this email address.",
      "auth/invalid-credential": "The email or password is incorrect.",
      "auth/too-many-requests": "Too many attempts. Please wait and try again.",
      "auth/network-request-failed": "Network error. Check your internet connection.",
      default: "Authentication failed. Please try again."
    }
  },
  he: {
    loginTab: "התחברות", signupTab: "הרשמה",
    titleLogin: "התחבר כדי להמשיך", titleSignup: "יצירת חשבון",
    subtitle: "התשובות שלך נשמרו — התחבר ואנחנו ניצור את התוכנית שלך מיד.",
    name: "שם מלא", namePlaceholder: "הזן את שמך המלא",
    email: "כתובת אימייל", password: "סיסמה",
    remember: "זכור אותי במכשיר זה",
    terms: 'קראתי ואני מסכים ל<a href="/terms.html" target="_blank">תנאי השימוש, גילוי הבריאות ומדיניות הפרטיות</a>. אם אני מתחת לגיל 18, ההורה או האפוטרופוס החוקי שלי אישרו את השימוש שלי ב-FuelPhysique.',
    submitLogin: "התחברות", submitSignup: "יצירת חשבון",
    workingLogin: "מתחבר...", workingSignup: "יוצר חשבון...",
    missingFields: "יש להזין אימייל וסיסמה.",
    missingName: "יש להזין שם מלא.",
    missingTerms: "עליך לאשר את תנאי השימוש וגילוי הבריאות כדי ליצור חשבון.",
    shortPassword: "הסיסמה חייבת להכיל לפחות 6 תווים.",
    note: 'החשבון שלך ישמש לשמירת התוכניות שלך ולהתאמה אישית של החוויה. <a href="/terms.html" target="_blank">תנאי שימוש וגילוי בריאות</a>',
    close: "סגירה",
    errors: {
      "auth/invalid-email": "יש להזין כתובת אימייל תקינה.",
      "auth/missing-password": "יש להזין סיסמה.",
      "auth/weak-password": "הסיסמה חייבת להכיל לפחות 6 תווים.",
      "auth/email-already-in-use": "כבר קיים חשבון עם כתובת אימייל זו.",
      "auth/invalid-credential": "האימייל או הסיסמה שגויים.",
      "auth/too-many-requests": "יותר מדי ניסיונות. נסה שוב בעוד כמה רגעים.",
      "auth/network-request-failed": "שגיאת רשת. בדוק את החיבור לאינטרנט.",
      default: "ההתחברות נכשלה. נסה שוב."
    }
  }
};

let dialog;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "auth-modal-dialog";
  document.body.append(dialog);
  return dialog;
}

export function openAuthModal({ isHebrew = false, mode = "signup" } = {}) {
  const t = isHebrew ? TEXT.he : TEXT.en;
  const modal = ensureDialog();
  let currentMode = mode;

  return new Promise((resolve, reject) => {
    let settled = false;

    // dismissModal() is called directly from the close button and the
    // backdrop click, not only via the native "close" event — some
    // embedding/automation environments do not reliably dispatch that
    // event for a programmatic .close() call, which would otherwise leave
    // this promise pending forever and the caller's UI stuck.
    function dismissModal() {
      modal.close();
      if (!settled) {
        settled = true;
        reject(new Error("auth_modal_dismissed"));
      }
    }

    function render() {
      const isLogin = currentMode === "login";
      modal.innerHTML = `
        <div class="auth-modal-shell">
          <button type="button" class="auth-modal-close" aria-label="${t.close}">×</button>
          <h2 class="auth-modal-title">${isLogin ? t.titleLogin : t.titleSignup}</h2>
          <p class="auth-modal-subtitle">${t.subtitle}</p>
          <div class="auth-modal-tabs">
            <button type="button" class="auth-modal-tab${isLogin ? " active" : ""}" data-mode="login">${t.loginTab}</button>
            <button type="button" class="auth-modal-tab${!isLogin ? " active" : ""}" data-mode="signup">${t.signupTab}</button>
          </div>
          <form id="authModalForm">
            <div class="auth-modal-field" ${isLogin ? "hidden" : ""}>
              <label for="authModalName">${t.name}</label>
              <input id="authModalName" type="text" placeholder="${t.namePlaceholder}" autocomplete="name" minlength="2" maxlength="60" ${isLogin ? "" : "required"}>
            </div>
            <label class="auth-modal-terms" ${isLogin ? "hidden" : ""}>
              <input id="authModalTerms" type="checkbox">
              <span>${t.terms}</span>
            </label>
            <div class="auth-modal-field">
              <label for="authModalEmail">${t.email}</label>
              <input id="authModalEmail" type="email" autocomplete="email" required>
            </div>
            <div class="auth-modal-field">
              <label for="authModalPassword">${t.password}</label>
              <input id="authModalPassword" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" minlength="6" required>
            </div>
            <label class="auth-modal-terms">
              <input id="authModalRemember" type="checkbox" checked>
              <span>${t.remember}</span>
            </label>
            <button type="submit" class="auth-modal-submit" id="authModalSubmit">${isLogin ? t.submitLogin : t.submitSignup}</button>
            <div class="auth-modal-message" id="authModalMessage" role="status" aria-live="polite"></div>
          </form>
          <p class="auth-modal-note">${t.note}</p>
        </div>
      `;

      modal.querySelector(".auth-modal-close").addEventListener("click", dismissModal);
      modal.querySelectorAll(".auth-modal-tab").forEach(tab => {
        tab.addEventListener("click", () => {
          currentMode = tab.dataset.mode;
          render();
        });
      });

      const form = modal.querySelector("#authModalForm");
      const submitButton = modal.querySelector("#authModalSubmit");
      const message = modal.querySelector("#authModalMessage");

      function showMessage(text, type) {
        message.textContent = text;
        message.className = `auth-modal-message ${type}`;
      }

      form.addEventListener("submit", async event => {
        event.preventDefault();
        showMessage("", "");
        message.className = "auth-modal-message";

        const email = modal.querySelector("#authModalEmail").value.trim();
        const password = modal.querySelector("#authModalPassword").value;
        const displayName = modal.querySelector("#authModalName")?.value.replace(/\s+/g, " ").trim() || "";
        const remember = modal.querySelector("#authModalRemember").checked;
        const termsAccepted = modal.querySelector("#authModalTerms")?.checked;

        if (!email || !password) return showMessage(t.missingFields, "error");
        if (!isLogin && displayName.length < 2) return showMessage(t.missingName, "error");
        if (!isLogin && !termsAccepted) return showMessage(t.missingTerms, "error");
        if (password.length < 6) return showMessage(t.shortPassword, "error");

        submitButton.disabled = true;
        submitButton.textContent = isLogin ? t.workingLogin : t.workingSignup;

        try {
          await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);

          let userCredential;
          if (isLogin) {
            userCredential = await signInWithEmailAndPassword(auth, email, password);
          } else {
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName });
            await setDoc(doc(db, "users", userCredential.user.uid), {
              email: userCredential.user.email || email,
              displayName,
              termsAccepted: true,
              termsVersion: "2026-07-21",
              termsAcceptedAt: serverTimestamp()
            }, { merge: true });
            trackEvent("signup", { method: "email_password", source: "inline_modal" });
          }

          settled = true;
          modal.close();
          resolve(userCredential.user);
        } catch (error) {
          console.error("Inline auth modal error:", error);
          showMessage(t.errors[error.code] || t.errors.default, "error");
          submitButton.disabled = false;
          submitButton.textContent = isLogin ? t.submitLogin : t.submitSignup;
        }
      });
    }

    render();

    // Backup path for Escape-key closes (and any other native close the
    // browser triggers on its own) — the real-browser case where the
    // native event does fire reliably.
    const onClose = () => {
      modal.removeEventListener("close", onClose);
      if (!settled) {
        settled = true;
        reject(new Error("auth_modal_dismissed"));
      }
    };
    modal.addEventListener("close", onClose);
    modal.addEventListener("click", event => { if (event.target === modal) dismissModal(); });

    modal.showModal();
  });
}
