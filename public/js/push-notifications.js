import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getMessaging, isSupported, onRegistered, onUnregistered, register, unregister } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging.js";
import {
  PUSH_PROMPT_DISMISSED_KEY,
  installationPlatform,
  isIOSDevice,
  isStandaloneDisplay,
  pushCapability,
  shouldShowPrePermission
} from "./push-client-core.mjs";

const INSTALLATION_KEY = "fuelphysique-push-installation-id";
const he = (localStorage.getItem("ofek-ai-language") || "en") === "he";
const strings = he ? {
  promptTitle: "להישאר מעודכנים",
  promptBody: "קבלו הודעות על צ׳אט, תוכניות ששותפו ותזכורות לאימונים שבחרתם. בלי הודעות שיווקיות.",
  enable: "הפעלת התראות",
  later: "לא עכשיו",
  enabled: "ההתראות פעילות במכשיר הזה.",
  denied: "ההתראות חסומות בהגדרות הדפדפן. אפשר לאפשר אותן ידנית ולנסות שוב.",
  unsupported: "המכשיר או הדפדפן הזה אינם תומכים בהתראות אינטרנט.",
  unavailable: "ההתראות עדיין לא הוגדרו בסביבה הזו.",
  failed: "לא הצלחנו להפעיל התראות. אפשר לנסות שוב.",
  ios: "באייפון או אייפד: הוסיפו את FuelPhysique למסך הבית דרך שיתוף ← הוספה למסך הבית, פתחו את האפליקציה המותקנת ואז הפעילו התראות.",
  saved: "העדפות ההתראות נשמרו.",
  testSent: "התראת הבדיקה נשלחה למכשיר הזה.",
  foreground: "התראה חדשה"
} : {
  promptTitle: "Stay in the loop",
  promptBody: "Get chat, shared-plan, and workout reminders you choose. FuelPhysique never sends marketing push notifications.",
  enable: "Enable notifications",
  later: "Not now",
  enabled: "Notifications are active on this device.",
  denied: "Notifications are blocked in your browser settings. Allow them there, then try again.",
  unsupported: "This device or browser does not support web push notifications.",
  unavailable: "Notifications are not configured in this environment yet.",
  failed: "Notifications could not be enabled. Please try again.",
  ios: "On iPhone or iPad, add FuelPhysique to your Home Screen from Share → Add to Home Screen, open the installed app, then enable notifications.",
  saved: "Notification preferences saved.",
  testSent: "The test notification was sent to this device.",
  foreground: "New notification"
};

const settingsCopy = he ? {
  notificationsTab: "התראות", notificationsTitle: "התראות",
  notificationsDescription: "בחרו עדכונים שימושיים למכשיר הזה. FuelPhysique לא שולחת התראות שיווקיות.",
  pushEnabledLabel: "אפשר התראות", pushMessagesLabel: "הודעות צ׳אט חדשות",
  pushSharesLabel: "תוכניות אימון ותזונה ששותפו", pushFriendsLabel: "פעילות חברים", pushWorkoutsLabel: "תזכורות בימי אימון",
  pushPreviewsLabel: "הצגת תוכן ההודעה", pushReminderTimeLabel: "שעת התזכורת",
  pushSettingsHelp: "תזכורות אימון משתמשות בתוכנית הפעילה, בימי האימון ובאזור הזמן של המכשיר. אימונים שהושלמו וימי מנוחה אינם נשלחים.",
  pushEnableDevice: "הפעלה במכשיר הזה", pushSavePreferences: "שמירת העדפות התראות", pushTestDevice: "שליחת בדיקה למכשיר הזה"
} : {
  notificationsTab: "Notifications", notificationsTitle: "Notifications",
  notificationsDescription: "Choose useful updates for this device. FuelPhysique does not send marketing notifications.",
  pushEnabledLabel: "Allow notifications", pushMessagesLabel: "New chat messages",
  pushSharesLabel: "Shared workout and nutrition plans", pushFriendsLabel: "Friend activity", pushWorkoutsLabel: "Workout-day reminders",
  pushPreviewsLabel: "Show message previews", pushReminderTimeLabel: "Reminder time",
  pushSettingsHelp: "Workout reminders use your active plan, chosen training days and this device’s timezone. Completed sessions and rest days are skipped.",
  pushEnableDevice: "Enable on this device", pushSavePreferences: "Save notification preferences", pushTestDevice: "Send test to this device"
};

let activeUser = null;
let messaging = null;
let config = null;
let registrationInFlight = null;
let settingsBound = false;
let lifecycleBound = false;

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSet(key, value) {
  try { localStorage.setItem(key, String(value)); } catch {}
}

function installationId() {
  let value = safeGet(INSTALLATION_KEY);
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `fp-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    safeSet(INSTALLATION_KEY, value);
  }
  return value;
}

function deviceFacts() {
  const ios = isIOSDevice({ userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints });
  const standalone = isStandaloneDisplay({ standaloneMedia: matchMedia("(display-mode: standalone)").matches, navigatorStandalone: navigator.standalone });
  return { ios, standalone, platform: installationPlatform({ isIOS: ios, userAgent: navigator.userAgent }) };
}

async function notificationApi(path, options = {}) {
  const user = activeUser || auth.currentUser;
  if (!user) throw new Error("Authentication is required.");
  const response = await fetch(`/api/notifications${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || strings.failed), { code: data.code, status: response.status });
  return data;
}

async function capability() {
  const native = pushCapability({
    serviceWorker: "serviceWorker" in navigator,
    pushManager: "PushManager" in window,
    notifications: "Notification" in window,
    messagingSupported: await isSupported().catch(() => false)
  });
  return native;
}

async function loadConfig() {
  if (!config) config = await notificationApi("/config");
  return config;
}

async function registerGrantedInstallation() {
  if (registrationInFlight) return registrationInFlight;
  registrationInFlight = (async () => {
    const currentConfig = await loadConfig();
    if (!currentConfig.configured || !currentConfig.vapidPublicKey) throw Object.assign(new Error(strings.unavailable), { code: "push_not_configured" });
    if (await capability() !== "supported") throw Object.assign(new Error(strings.unsupported), { code: "push_unsupported" });
    const serviceWorkerRegistration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    messaging ||= getMessaging(app);
    if (!lifecycleBound) {
      lifecycleBound = true;
      onUnregistered(messaging, () => {
        if (!auth.currentUser) return;
        notificationApi("/installations/current", { method: "DELETE", body: JSON.stringify({ installationId: installationId() }) }).catch(() => {});
      });
    }
    const fid = await new Promise((resolve, reject) => {
      let finished = false;
      let unsubscribe = () => {};
      const timeout = setTimeout(() => {
        if (finished) return;
        finished = true;
        unsubscribe();
        reject(Object.assign(new Error(strings.failed), { code: "push_registration_timeout" }));
      }, 20_000);
      unsubscribe = onRegistered(messaging, value => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        unsubscribe();
        resolve(value);
      });
      register(messaging, { vapidKey: currentConfig.vapidPublicKey, serviceWorkerRegistration }).catch(error => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        unsubscribe();
        reject(error);
      });
    });
    const facts = deviceFacts();
    return notificationApi("/installations", {
      method: "POST",
      body: JSON.stringify({
        installationId: installationId(),
        fid,
        locale: he ? "he" : "en",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        capability: "granted",
        platform: facts.platform,
        displayMode: facts.standalone ? "standalone" : "browser"
      })
    });
  })().finally(() => { registrationInFlight = null; });
  return registrationInFlight;
}

export async function enableNotificationsFromGesture() {
  if (!("Notification" in window)) throw Object.assign(new Error(strings.unsupported), { code: "push_unsupported" });
  // The native prompt call intentionally occurs before any await. Browsers
  // require this direct connection to the user's click/tap gesture.
  const permissionPromise = Notification.requestPermission();
  const permission = await permissionPromise;
  if (permission !== "granted") throw Object.assign(new Error(permission === "denied" ? strings.denied : strings.failed), { code: `permission_${permission}` });
  return registerGrantedInstallation();
}

export async function disassociateCurrentInstallation() {
  const user = auth.currentUser;
  if (!user) return { removed: false };
  try {
    await notificationApi("/installations/current", { method: "DELETE", body: JSON.stringify({ installationId: installationId() }) });
  } catch (error) {
    console.warn("Notification installation disassociation failed:", error.code || "request_failed");
  }
  try {
    if (await isSupported()) {
      messaging ||= getMessaging(app);
      await unregister(messaging);
    }
  } catch (error) {
    console.warn("Notification token cleanup failed:", error.code || "token_cleanup_failed");
  }
  return { removed: true };
}

function statusNode(message, tone = "info") {
  const node = document.getElementById("pushSettingsStatus");
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone;
}

function showForegroundNotice(data = {}) {
  const toast = document.createElement("div");
  toast.className = "push-foreground-toast";
  toast.setAttribute("role", "status");
  toast.style.cssText = "position:fixed;z-index:13000;inset-block-start:16px;inset-inline-end:16px;max-width:min(360px,calc(100vw - 32px));padding:14px 16px;border-radius:14px;background:#102743;color:#f4f8ff;box-shadow:0 14px 40px rgba(0,0,0,.42);font:600 14px/1.45 Inter,Heebo,system-ui";
  const title = String(data.title || strings.foreground).slice(0, 100);
  const body = String(data.body || "").slice(0, 180);
  toast.textContent = body ? `${title} — ${body}` : title;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

function dismissPrompt() {
  safeSet(PUSH_PROMPT_DISMISSED_KEY, Date.now());
  document.getElementById("pushPrePermissionPrompt")?.remove();
}

function renderPrePermissionPrompt() {
  if (document.getElementById("pushPrePermissionPrompt")) return;
  const backdrop = document.createElement("div");
  backdrop.id = "pushPrePermissionPrompt";
  backdrop.className = "push-prompt-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-labelledby", "pushPromptTitle");
  backdrop.dir = he ? "rtl" : "ltr";
  backdrop.innerHTML = `<section class="push-prompt-card"><span class="push-prompt-icon" aria-hidden="true">🔔</span><h2 id="pushPromptTitle"></h2><p id="pushPromptBody"></p><div class="push-prompt-actions"><button class="push-prompt-enable" type="button"></button><button class="push-prompt-later" type="button"></button></div></section>`;
  backdrop.querySelector("h2").textContent = strings.promptTitle;
  backdrop.querySelector("p").textContent = strings.promptBody;
  const enable = backdrop.querySelector(".push-prompt-enable");
  const later = backdrop.querySelector(".push-prompt-later");
  enable.textContent = strings.enable;
  later.textContent = strings.later;
  later.addEventListener("click", dismissPrompt);
  enable.addEventListener("click", () => {
    enable.disabled = true;
    enableNotificationsFromGesture().then(() => {
      dismissPrompt();
      statusNode(strings.enabled, "success");
    }).catch(error => {
      dismissPrompt();
      statusNode(error.message || strings.failed, "error");
    });
  });
  document.body.appendChild(backdrop);
  enable.focus();
}

function readPreferenceForm() {
  const read = id => document.getElementById(id);
  return {
    notificationsEnabled: Boolean(read("pushEnabled")?.checked),
    newMessages: Boolean(read("pushMessages")?.checked),
    sharedPlans: Boolean(read("pushShares")?.checked),
    friendActivity: Boolean(read("pushFriends")?.checked),
    workoutReminders: Boolean(read("pushWorkouts")?.checked),
    showMessagePreviews: Boolean(read("pushPreviews")?.checked),
    reminderTime: read("pushReminderTime")?.value || "18:00",
    locale: he ? "he" : "en",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  };
}

function renderPreferences(preferences = {}) {
  const mapping = { pushEnabled: "notificationsEnabled", pushMessages: "newMessages", pushShares: "sharedPlans", pushFriends: "friendActivity", pushWorkouts: "workoutReminders", pushPreviews: "showMessagePreviews" };
  Object.entries(mapping).forEach(([id, key]) => {
    const input = document.getElementById(id);
    if (input) input.checked = preferences[key] !== false;
  });
  const time = document.getElementById("pushReminderTime");
  if (time) time.value = preferences.reminderTime || "18:00";
}

async function initializeSettings() {
  const panel = document.getElementById("notificationsSettings");
  if (!panel) return;
  const facts = deviceFacts();
  Object.entries(settingsCopy).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  });
  const guidance = document.getElementById("pushIosGuidance");
  if (guidance) {
    guidance.hidden = !(facts.ios && !facts.standalone);
    guidance.textContent = strings.ios;
  }
  try {
    const [currentConfig, preferenceData, support] = await Promise.all([loadConfig(), notificationApi("/preferences"), capability()]);
    renderPreferences(preferenceData.preferences);
    const enable = document.getElementById("pushEnableDevice");
    const test = document.getElementById("pushTestDevice");
    if (test) test.hidden = !currentConfig.testEnabled;
    const permission = "Notification" in window ? Notification.permission : "unsupported";
    const unavailable = !currentConfig.configured || support !== "supported" || (facts.ios && !facts.standalone);
    if (enable) enable.disabled = unavailable || permission === "granted";
    statusNode(!currentConfig.configured ? strings.unavailable
      : support !== "supported" ? strings.unsupported
        : facts.ios && !facts.standalone ? strings.ios
          : permission === "granted" ? strings.enabled
            : permission === "denied" ? strings.denied : strings.promptBody,
    permission === "granted" ? "success" : permission === "denied" ? "error" : "info");
  } catch (error) {
    statusNode(error.message || strings.failed, "error");
  }
}

function bindSettings() {
  if (settingsBound) return;
  settingsBound = true;
  document.getElementById("pushEnableDevice")?.addEventListener("click", event => {
    const button = event.currentTarget;
    button.disabled = true;
    enableNotificationsFromGesture().then(() => {
      statusNode(strings.enabled, "success");
    }).catch(error => {
      statusNode(error.message || strings.failed, "error");
      button.disabled = error.code === "permission_denied";
    });
  });
  document.getElementById("pushSavePreferences")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const data = await notificationApi("/preferences", { method: "PUT", body: JSON.stringify(readPreferenceForm()) });
      renderPreferences(data.preferences);
      statusNode(strings.saved, "success");
    } catch (error) {
      statusNode(error.message || strings.failed, "error");
    } finally { button.disabled = false; }
  });
  document.getElementById("pushTestDevice")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await registerGrantedInstallation();
      await notificationApi("/test", { method: "POST", body: JSON.stringify({ installationId: installationId(), locale: he ? "he" : "en" }) });
      statusNode(strings.testSent, "success");
    } catch (error) { statusNode(error.message || strings.failed, "error"); }
    finally { button.disabled = false; }
  });
}

async function initializeForUser(user) {
  activeUser = user;
  bindSettings();
  await initializeSettings();
  const support = await capability();
  const currentConfig = await loadConfig().catch(() => ({ configured: false }));
  if (currentConfig.configured && support === "supported" && Notification.permission === "granted") {
    registerGrantedInstallation().catch(error => console.warn("Notification token refresh failed:", error.code || "registration_failed"));
  }
  const facts = deviceFacts();
  if (currentConfig.configured && shouldShowPrePermission({
    authenticated: true,
    page: window.location.pathname,
    permission: "Notification" in window ? Notification.permission : "unsupported",
    capability: support,
    standalone: facts.standalone,
    isIOS: facts.ios,
    dismissedAt: Number(safeGet(PUSH_PROMPT_DISMISSED_KEY) || 0)
  })) renderPrePermissionPrompt();
}

navigator.serviceWorker?.addEventListener("message", event => {
  if (event.data?.type === "FUELPHYSIQUE_PUSH_FOREGROUND") showForegroundNotice(event.data.data);
});
window.addEventListener("ofekai:settings-saved", event => {
  if (!activeUser) return;
  notificationApi("/preferences", { method: "PUT", body: JSON.stringify({ locale: event.detail?.language === "he" ? "he" : "en" }) }).catch(() => {});
});
onAuthStateChanged(auth, user => {
  if (user) initializeForUser(user).catch(error => console.warn("Notification setup unavailable:", error.code || "initialization_failed"));
  else activeUser = null;
});

window.FuelPhysiquePush = { disassociateCurrentInstallation, enableNotificationsFromGesture };
