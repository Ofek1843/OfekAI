const THEME_STORAGE_KEY = "ofek-ai-theme";
const THEME_CHANGED_EVENT = "ofekai:theme-changed";

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || "dark";
  } catch {
    return "dark";
  }
}

function getResolvedTheme(preference = getStoredTheme()) {
  if (preference === "dark" || preference === "light") {
    return preference;
  }

  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

function setThemePreference(preference, persist = true) {
  const normalized = ["dark", "light", "system"].includes(preference)
    ? preference
    : "system";
  const resolved = getResolvedTheme(normalized);
  const root = document.documentElement;

  root.dataset.themePreference = normalized;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;

  document.body?.classList.toggle("dark-theme", resolved === "dark");
  document.body?.classList.toggle("light-theme", resolved === "light");

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch {}
  }

  syncThemeButtons();

  window.dispatchEvent(
    new CustomEvent(THEME_CHANGED_EVENT, {
      detail: {
        preference: normalized,
        theme: resolved
      }
    })
  );

  return resolved;
}

function getCurrentResolvedTheme() {
  return document.documentElement.dataset.theme || getResolvedTheme();
}

function updateButtonState(button, resolvedTheme) {
  const icon = button.querySelector("[data-theme-toggle-icon]");
  const label = button.querySelector("[data-theme-toggle-label]");
  const short = button.querySelector("[data-theme-toggle-short]");
  const targetTheme = resolvedTheme === "dark" ? "light" : "dark";

  button.dataset.themeState = resolvedTheme;
  button.dataset.themeTarget = targetTheme;
  button.setAttribute(
    "aria-label",
    targetTheme === "light" ? "Switch to light mode" : "Switch to dark mode"
  );
  button.setAttribute("aria-pressed", String(resolvedTheme === "dark"));

  if (icon) {
    icon.textContent = resolvedTheme === "dark" ? "☀️" : "🌙";
  }

  if (label) {
    label.textContent = resolvedTheme === "dark" ? "Light mode" : "Dark mode";
  }

  if (short) {
    short.textContent = resolvedTheme === "dark" ? "Light" : "Dark";
  }
}

function syncThemeButtons() {
  const resolvedTheme = getCurrentResolvedTheme();

  document
    .querySelectorAll("[data-theme-toggle]")
    .forEach((button) => updateButtonState(button, resolvedTheme));
}

function bindThemeButtons() {
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    if (button.dataset.themeToggleBound === "true") {
      return;
    }

    button.dataset.themeToggleBound = "true";

    button.addEventListener("click", () => {
      const currentPreference = getStoredTheme();
      const resolved = getResolvedTheme(currentPreference);
      const nextPreference = resolved === "dark" ? "light" : "dark";

      setThemePreference(nextPreference);
    });
  });
}

function bindSystemThemeWatcher() {
  const media = window.matchMedia("(prefers-color-scheme: light)");

  const handleThemeChange = () => {
    if (getStoredTheme() === "system") {
      setThemePreference("system", false);
    } else {
      syncThemeButtons();
    }
  };

  media.addEventListener?.("change", handleThemeChange);
}

function initThemeToggle() {
  bindThemeButtons();
  syncThemeButtons();
  bindSystemThemeWatcher();

  window.addEventListener(THEME_CHANGED_EVENT, syncThemeButtons);
  window.addEventListener("storage", (event) => {
    if (event.key === THEME_STORAGE_KEY) {
      syncThemeButtons();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initThemeToggle, {
    once: true
  });
} else {
  initThemeToggle();
}

window.OfekThemeToggle = {
  setThemePreference,
  syncThemeButtons,
  getStoredTheme,
  getResolvedTheme
};
