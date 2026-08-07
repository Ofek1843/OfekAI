export const PUSH_PROMPT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
export const PUSH_PROMPT_DISMISSED_KEY = "fuelphysique-push-prompt-dismissed-at";

export function isStandaloneDisplay({ standaloneMedia = false, navigatorStandalone = false } = {}) {
  return Boolean(standaloneMedia || navigatorStandalone);
}

export function isIOSDevice({ userAgent = "", platform = "", maxTouchPoints = 0 } = {}) {
  return /iPad|iPhone|iPod/i.test(userAgent)
    || (platform === "MacIntel" && Number(maxTouchPoints) > 1);
}

export function pushCapability({ serviceWorker = false, pushManager = false, notifications = false, messagingSupported = false } = {}) {
  return serviceWorker && pushManager && notifications && messagingSupported ? "supported" : "unsupported";
}

export function shouldShowPrePermission({ authenticated = false, page = "", permission = "default", capability = "unsupported", standalone = false, isIOS = false, dismissedAt = 0, now = Date.now() } = {}) {
  if (!authenticated || page !== "/dashboard.html" || permission !== "default" || capability !== "supported") return false;
  if (!standalone) return false;
  if (isIOS && !standalone) return false;
  return !dismissedAt || now - Number(dismissedAt) >= PUSH_PROMPT_COOLDOWN_MS;
}

export function installationPlatform({ isIOS = false, userAgent = "" } = {}) {
  if (isIOS) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop-web";
}
