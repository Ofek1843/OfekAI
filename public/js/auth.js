import { auth, db } from "./firebase-config.js";
import { doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

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

let currentMode = "login";
let authenticationCompleted = false;

function showMessage(text, type) {
  authMessage.textContent = text;
  authMessage.className = `message ${type}`;
}

function clearMessage() {
  authMessage.textContent = "";
  authMessage.className = "message";
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
  switch (errorCode) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/missing-password":
      return "Please enter a password.";

    case "auth/weak-password":
      return "The password must contain at least 6 characters.";

    case "auth/email-already-in-use":
      return "An account already exists with this email address.";

    case "auth/invalid-credential":
      return "The email or password is incorrect.";

    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again.";

    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";

    default:
      return "Authentication failed. Please try again.";
  }
}

loginTab.addEventListener("click", () => {
  changeMode("login");
});
signupTab.addEventListener("click", () => {
  changeMode("signup");
});
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
          termsAccepted: true,
          termsVersion: "2026-07-21",
          termsAcceptedAt: serverTimestamp()
        }, { merge: true });

        authenticationCompleted = true;

        showMessage(
          "Account created successfully. Redirecting...",
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
  window.location.href = "/dashboard.html";
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

onAuthStateChanged(auth, (user) => {
  if (user && !authenticationCompleted) {
    window.location.href = "/dashboard.html";
  }
});
// Signed-in users enter the product through the dashboard.
