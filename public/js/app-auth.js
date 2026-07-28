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
  container.className = "user-controls-inline";

  const nameElement =
    document.createElement("span");

  nameElement.textContent = visibleName;
  nameElement.title = visibleName;
  nameElement.className = "user-controls-name";

  const logoutButton =
    document.createElement("button");

  logoutButton.type = "button";
  logoutButton.textContent = "Log out";
  logoutButton.className = "user-controls-logout";

  logoutButton.addEventListener(
    "click",
    async () => {
      logoutButton.disabled = true;
      logoutButton.textContent =
        "Logging out...";

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

  const topBar = document.querySelector(".top-bar");
  if (topBar) {
    topBar.appendChild(container);
  } else {
    document.body.appendChild(container);
  }
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