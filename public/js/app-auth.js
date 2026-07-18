import { auth, db } from "./firebase-config.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

document.body.style.visibility = "hidden";

async function getVisibleUserName(user) {
  if (user.displayName?.trim()) {
    return user.displayName.trim();
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnapshot = await getDoc(userRef);

    if (userSnapshot.exists()) {
      const profile = userSnapshot.data();
      const firestoreName =
        typeof profile.displayName === "string"
          ? profile.displayName.trim()
          : "";

      if (firestoreName) {
        return firestoreName;
      }
    }
  } catch (error) {
    console.error(
      "Could not load the user display name:",
      error
    );
  }

  return user.email || "Signed-in user";
}

function createUserControls(user, visibleName) {
  const existingContainer =
    document.getElementById("userControls");

  if (existingContainer) {
    existingContainer.remove();
  }

  const container = document.createElement("div");

  container.id = "userControls";
  container.style.position = "fixed";
  container.style.top = "16px";
  container.style.right = "16px";
  container.style.zIndex = "9999";
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.gap = "10px";
  container.style.padding = "10px 12px";
  container.style.border =
    "1px solid rgba(255, 255, 255, 0.12)";
  container.style.borderRadius = "14px";
  container.style.background =
    "rgba(15, 23, 42, 0.94)";
  container.style.boxShadow =
    "0 10px 30px rgba(0, 0, 0, 0.3)";
  container.style.fontFamily =
    "Arial, Helvetica, sans-serif";

  const nameElement =
    document.createElement("span");

  nameElement.textContent = visibleName;
  nameElement.title = visibleName;
  nameElement.style.maxWidth = "220px";
  nameElement.style.overflow = "hidden";
  nameElement.style.textOverflow = "ellipsis";
  nameElement.style.whiteSpace = "nowrap";
  nameElement.style.color = "#dbeafe";
  nameElement.style.fontSize = "13px";
  nameElement.style.fontWeight = "700";

  const logoutButton =
    document.createElement("button");

  logoutButton.type = "button";
  logoutButton.textContent = "Log out";
  logoutButton.style.padding = "8px 12px";
  logoutButton.style.border = "0";
  logoutButton.style.borderRadius = "9px";
  logoutButton.style.color = "white";
  logoutButton.style.background = "#2563eb";
  logoutButton.style.fontSize = "13px";
  logoutButton.style.fontWeight = "700";
  logoutButton.style.cursor = "pointer";

  logoutButton.addEventListener(
    "mouseenter",
    () => {
      if (!logoutButton.disabled) {
        logoutButton.style.background =
          "#1d4ed8";
      }
    }
  );

  logoutButton.addEventListener(
    "mouseleave",
    () => {
      if (!logoutButton.disabled) {
        logoutButton.style.background =
          "#2563eb";
      }
    }
  );

  logoutButton.addEventListener(
    "click",
    async () => {
      logoutButton.disabled = true;
      logoutButton.textContent =
        "Logging out...";
      logoutButton.style.cursor =
        "not-allowed";
      logoutButton.style.opacity = "0.7";

      try {
        await signOut(auth);
        window.location.replace(
          "/auth.html"
        );
      } catch (error) {
        console.error(
          "Logout error:",
          error
        );

        logoutButton.disabled = false;
        logoutButton.textContent =
          "Log out";
        logoutButton.style.cursor =
          "pointer";
        logoutButton.style.opacity = "1";
        logoutButton.style.background =
          "#2563eb";

        alert(
          "Logout failed. Please try again."
        );
      }
    }
  );

  container.append(
    nameElement,
    logoutButton
  );

  document.body.appendChild(container);
}

onAuthStateChanged(
  auth,
  async (user) => {
    if (!user) {
      window.location.replace(
        "/auth.html"
      );

      return;
    }

    const visibleName =
      await getVisibleUserName(user);

    createUserControls(
      user,
      visibleName
    );

    document.body.style.visibility =
      "visible";
  }
);