// Notification preferences panel (Settings -> Notifications). Reads/writes
// straight to users/{uid} (not the users/{uid}/settings/main doc the rest
// of the settings form uses) because that's where fcmTokens,
// pushRemindersEnabled and timezone already live — see
// public/js/push-notifications.js and server.js's daily reminder sweep.
import { auth, db } from "./firebase-config.js";
import { t } from "./i18n.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  pushPermissionState,
  requestPushPermission,
  disablePushReminders
} from "./push-notifications.js";

const currentLang = () => localStorage.getItem("ofek-ai-language") || "en";

const masterCheckbox = document.getElementById("settingsPushMaster");
const scheduledCheckbox = document.getElementById("settingsPushScheduled");
const comebackCheckbox = document.getElementById("settingsPushComeback");
const masterHint = document.getElementById("pushMasterHint");
const testButton = document.getElementById("sendTestNotificationBtn");
const testStatus = document.getElementById("testNotificationStatus");

if (masterCheckbox && scheduledCheckbox && comebackCheckbox) {
  function setMasterHint(key, isError = false) {
    if (!masterHint) return;
    masterHint.textContent = t(currentLang(), key);
    masterHint.classList.toggle("error", isError);
  }

  function refreshMasterHint(enabled) {
    if (!("Notification" in window)) {
      setMasterHint("pushMasterHintUnsupported");
      return;
    }
    setMasterHint(enabled ? "pushMasterHintOn" : "pushMasterHintOff");
  }

  async function loadState(user) {
    scheduledCheckbox.disabled = true;
    comebackCheckbox.disabled = true;

    let enabled = false;
    try {
      const snapshot = await getDoc(doc(db, "users", user.uid));
      const data = snapshot.exists() ? snapshot.data() : {};
      enabled = Boolean(data.pushRemindersEnabled) && pushPermissionState() === "granted";
      scheduledCheckbox.checked = data.pushRemindersScheduledEnabled !== false;
      comebackCheckbox.checked = data.pushRemindersComebackEnabled !== false;
    } catch (error) {
      console.error("Could not load notification preferences:", error);
    }

    masterCheckbox.checked = enabled;
    scheduledCheckbox.disabled = !enabled;
    comebackCheckbox.disabled = !enabled;
    refreshMasterHint(enabled);
  }

  masterCheckbox.addEventListener("change", async () => {
    const turningOn = masterCheckbox.checked;
    masterCheckbox.disabled = true;

    if (turningOn) {
      const result = await requestPushPermission();
      masterCheckbox.disabled = false;

      if (!result.ok) {
        masterCheckbox.checked = false;
        const reasonKey = {
          denied: "pushMasterHintUnsupported",
          unsupported: "pushMasterHintUnsupported"
        }[result.reason];
        setMasterHint(reasonKey || "pushMasterHintOff", true);
        return;
      }

      scheduledCheckbox.disabled = false;
      comebackCheckbox.disabled = false;
      refreshMasterHint(true);
      return;
    }

    try {
      await disablePushReminders();
    } catch (error) {
      console.error("Could not disable push reminders:", error);
    }
    masterCheckbox.disabled = false;
    scheduledCheckbox.disabled = true;
    comebackCheckbox.disabled = true;
    refreshMasterHint(false);
  });

  scheduledCheckbox.addEventListener("change", async () => {
    if (!auth.currentUser) return;
    try {
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { pushRemindersScheduledEnabled: scheduledCheckbox.checked },
        { merge: true }
      );
    } catch (error) {
      console.error("Could not save workout-day reminder preference:", error);
    }
  });

  comebackCheckbox.addEventListener("change", async () => {
    if (!auth.currentUser) return;
    try {
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { pushRemindersComebackEnabled: comebackCheckbox.checked },
        { merge: true }
      );
    } catch (error) {
      console.error("Could not save come-back reminder preference:", error);
    }
  });

  onAuthStateChanged(auth, user => {
    if (user) loadState(user);
  });
}

if (testButton) {
  testButton.addEventListener("click", async () => {
    if (!auth.currentUser) return;

    testButton.disabled = true;
    testButton.textContent = t(currentLang(), "testNotificationSending");
    if (testStatus) testStatus.classList.remove("error");

    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` }
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || "Request failed");

      if (testStatus) testStatus.textContent = t(currentLang(), "testNotificationSent");
    } catch (error) {
      console.error("Test notification failed:", error);
      if (testStatus) {
        testStatus.textContent = t(currentLang(), "testNotificationError");
        testStatus.classList.add("error");
      }
    } finally {
      testButton.disabled = false;
      testButton.textContent = t(currentLang(), "sendTestNotification");
    }
  });
}
