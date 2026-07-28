// Web push (FCM) enable/disable flow. Requires a one-time setup step before
// this can actually work: generate a Web Push certificate (VAPID key pair)
// in Firebase Console -> Project settings -> Cloud Messaging -> Web
// configuration, then paste the "Key pair" value into VAPID_KEY below. Until
// that's filled in, requestPushPermission() fails safely with reason
// "not_configured" instead of throwing — callers should show a friendly
// message rather than a broken button.
import { auth, db } from "./firebase-config.js";
import {
  doc,
  setDoc,
  arrayUnion,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging.js";

const VAPID_KEY = "BCa2CyP8oEcBIiOah3W6O5RoHUPnz9yY4DzFJPXzqHSky7JqZ2GdkmGy8gxyrT1ou3cWsLoXFchdppClTEhY1ps";

let messagingInstance = null;
let messagingInstancePromise = null;

async function getMessagingInstance() {
  if (messagingInstance) return messagingInstance;
  if (messagingInstancePromise) return messagingInstancePromise;

  messagingInstancePromise = (async () => {
    const supported = await isSupported().catch(() => false);
    if (!supported) return null;
    const registration = await navigator.serviceWorker?.ready?.catch(() => null);
    if (!registration) return null;
    messagingInstance = getMessaging();
    return messagingInstance;
  })();

  return messagingInstancePromise;
}

export function pushPermissionState() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestPushPermission() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return { ok: false, reason: "unsupported" };
  }
  if (!VAPID_KEY) {
    return { ok: false, reason: "not_configured" };
  }
  if (!auth.currentUser) {
    return { ok: false, reason: "signed_out" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "denied" };
  }

  const messaging = await getMessagingInstance();
  if (!messaging) return { ok: false, reason: "unsupported" };

  try {
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    if (!token) return { ok: false, reason: "no_token" };

    // Captured so the server's daily reminder sweep can fire around 8am the
    // user's own local time instead of one fixed hour for everyone — see
    // localReminderClock() in server.js.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";

    await setDoc(
      doc(db, "users", auth.currentUser.uid),
      {
        fcmTokens: arrayUnion(token),
        pushRemindersEnabled: true,
        pushTokenUpdatedAt: serverTimestamp(),
        timezone
      },
      { merge: true }
    );

    return { ok: true, token };
  } catch (error) {
    console.error("Could not enable push notifications:", error);
    return { ok: false, reason: "error", error };
  }
}

export async function disablePushReminders() {
  if (!auth.currentUser) return;
  // Clearing fcmTokens (not just flipping the flag) means every
  // server-side send path — the daily sweep, the PR check, the test
  // button — stops reaching this device immediately, since they all key
  // off whether tokens exist. A flag alone would leave a live token
  // sitting in Firestore that a future code path could accidentally use.
  await setDoc(
    doc(db, "users", auth.currentUser.uid),
    { pushRemindersEnabled: false, fcmTokens: [] },
    { merge: true }
  );
}

export async function listenForForegroundPush(onNotification) {
  const messaging = await getMessagingInstance();
  if (!messaging) return;
  onMessage(messaging, payload => {
    const title = payload.notification?.title || payload.data?.title || "";
    const body = payload.notification?.body || payload.data?.body || "";
    onNotification?.({ title, body, data: payload.data || {} });
  });
}
