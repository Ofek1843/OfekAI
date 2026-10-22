const GUEST_DRAFT_PREFIX = "fp-guest-trial-v1";

function draftKey(kind) {
  return `${GUEST_DRAFT_PREFIX}:${kind}`;
}

export function startGuestSignup(kind, nextPath, payload = null, provider = "", onHandoff = null) {
  try {
    if (payload) sessionStorage.setItem(draftKey(kind), JSON.stringify({ savedAt: Date.now(), payload }));
    sessionStorage.setItem(`${GUEST_DRAFT_PREFIX}:next`, nextPath);
  } catch {
    // Session storage is a convenience; never prevent the signup path.
  }
  const query = new URLSearchParams({ mode: "signup", next: nextPath });
  if (provider === "google") query.set("provider", "google");
  try { onHandoff?.(provider === "google" ? "google" : "email_password"); } catch { /* Analytics cannot block signup. */ }
  window.location.assign(`/auth.html?${query.toString()}`);
}

export function readGuestDraft(kind) {
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey(kind)) || "null");
    if (!draft?.payload || Date.now() - Number(draft.savedAt || 0) > 4 * 60 * 60 * 1000) return null;
    return draft.payload;
  } catch {
    return null;
  }
}

export function clearGuestDraft(kind) {
  try {
    sessionStorage.removeItem(draftKey(kind));
    sessionStorage.removeItem(`${GUEST_DRAFT_PREFIX}:next`);
  } catch {
    // Best-effort cleanup.
  }
}

export function serializeForm(form) {
  return [...form.elements].filter((element) => element.name).map((element) => ({
    name: element.name,
    type: element.type,
    value: element.value,
    checked: "checked" in element ? element.checked : undefined
  }));
}

export function restoreForm(form, fields) {
  if (!Array.isArray(fields)) return false;
  const elements = [...form.elements];
  for (const saved of fields) {
    // Match grouped inputs by their stable option value; for ordinary fields
    // match by name/type because their current value is expected to differ.
    const target = elements.find((candidate) => candidate.name === saved.name
      && candidate.type === saved.type
      && ((saved.type !== "checkbox" && saved.type !== "radio") || candidate.value === saved.value));
    if (!target) continue;
    if (saved.type === "checkbox" || saved.type === "radio") target.checked = Boolean(saved.checked);
    else target.value = saved.value;
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return true;
}

export function showSignupPrompt(element, kind, nextPath, isHebrew = false, onHandoff = null) {
  if (!element) return;
  element.replaceChildren();
  const message = document.createElement("span");
  message.textContent = kind === "diary"
    ? (isHebrew ? "רשומות המזון נשמרו זמנית במכשיר. התחברו בחינם כדי לשמור ולהמשיך להוסיף." : "Your food log is stored temporarily on this device. Sign in for free to save it and keep adding.")
    : (isHebrew ? "הפרטים נשמרו במכשיר הזה. התחברו בחינם כדי ליצור ולשמור את התוכנית." : "Your answers are saved on this device. Sign in for free to generate and save your plan.");
  const actions = document.createElement("div");
  actions.className = "guest-signup-actions";
  const googleButton = document.createElement("button");
  googleButton.type = "button";
  googleButton.className = "guest-signup-button";
  googleButton.textContent = isHebrew ? "המשך עם Google" : "Continue with Google";
  googleButton.addEventListener("click", () => startGuestSignup(kind, nextPath, null, "google", onHandoff));
  const button = document.createElement("button");
  button.type = "button";
  button.className = "guest-signup-button guest-signup-button--secondary";
  button.textContent = isHebrew ? "אימייל או כניסה לחשבון" : "Email or existing account";
  button.addEventListener("click", () => startGuestSignup(kind, nextPath, null, "", onHandoff));
  actions.append(googleButton, button);
  element.append(message, actions);
  element.classList.add("guest-signup-prompt");
}
