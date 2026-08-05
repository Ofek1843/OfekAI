// Platform-aware PWA install promotion.
//
// Loading this script is not itself proof anything works: Android/Chromium
// is the only platform with a real `beforeinstallprompt` event, so this file
// must branch by platform rather than assume one banner fits everyone.
//
// localStorage dismissal keys (documented for QA / support -- each holds a
// ms timestamp the banner for that platform stays suppressed until):
//   fuelphysique-pwa-install-dismissed-until:android     Android Chrome/Chromium native-prompt banner
//   fuelphysique-pwa-install-dismissed-until:desktop     Desktop Chrome/Edge native-prompt banner
//   fuelphysique-pwa-install-dismissed-until:ios-safari  iOS Safari "Add to Home Screen" instructions
//   fuelphysique-pwa-install-dismissed-until:ios-other   iOS Chrome/Edge/Firefox "open in Safari" notice
// Keys are per-platform on purpose: a desktop user dismissing the banner
// must not suppress the iOS instructional prompt for a phone visit, and
// vice versa.
//
// Dev/QA reset (no 14-day wait): open the console and run
// `resetFuelPhysiquePwaInstallDismissal()`, or load any page with
// ?resetPwaInstall=1 in the URL.

const DISMISS_KEY_PREFIX = "fuelphysique-pwa-install-dismissed-until";
const DISMISS_DAYS = 14;

const isHebrew = (localStorage.getItem("ofek-ai-language") || "en") === "he";

function ua() {
  return navigator.userAgent || "";
}

function isIOS() {
  // iPadOS 13+ identifies as "MacIntel" but is touch-only, unlike a real Mac.
  return /iPad|iPhone|iPod/.test(ua()) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isAndroid() {
  return /Android/.test(ua());
}

function isIOSSafari() {
  if (!isIOS()) return false;
  // Every iOS browser embeds WebKit and matches /safari/i in its UA string,
  // so the other browsers' own tokens must be excluded explicitly, or
  // Chrome/Firefox/Edge/Opera on iOS would be misidentified as Safari.
  return /safari/i.test(ua()) &&
    !/crios|fxios|edgios|opios|opt\/|duckduckgo|mercury|brave/i.test(ua());
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function platformKey() {
  if (isIOS()) return isIOSSafari() ? "ios-safari" : "ios-other";
  return isAndroid() ? "android" : "desktop";
}

function dismissKey(key) {
  return `${DISMISS_KEY_PREFIX}:${key}`;
}

function isDismissed(key) {
  const until = Number(localStorage.getItem(dismissKey(key)) || 0);
  return until > Date.now();
}

function setDismissed(key) {
  const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
  try {
    localStorage.setItem(dismissKey(key), String(until));
  } catch {}
}

function clearAllDismissals() {
  try {
    ["android", "desktop", "ios-safari", "ios-other"].forEach((key) =>
      localStorage.removeItem(dismissKey(key))
    );
  } catch {}
}

// Dev/QA escape hatch so nobody has to wait DISMISS_DAYS to re-test.
window.resetFuelPhysiquePwaInstallDismissal = clearAllDismissals;
if (new URLSearchParams(window.location.search).has("resetPwaInstall")) {
  clearAllDismissals();
}

const SHARE_ICON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M7.5 7.5L12 3l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M5 12v6a2 2 0 002 2h10a2 2 0 002-2v-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function injectStyles() {
  if (document.getElementById("pwaInstallStyles")) return;
  const style = document.createElement("style");
  style.id = "pwaInstallStyles";
  style.textContent = `
    .pwa-install-banner {
      position: fixed;
      left: 18px;
      right: 18px;
      bottom: 18px;
      z-index: 9997;
      margin: 0 auto;
      max-width: 480px;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 14px;
      background: rgba(10, 22, 38, 0.96);
      border: 1px solid rgba(53, 207, 223, 0.22);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(10px);
      color: #f3f0e8;
      font-family: inherit;
      transform: translateY(120%);
      opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
    }
    .pwa-install-banner.visible {
      transform: translateY(0);
      opacity: 1;
    }
    .pwa-install-banner.instructional {
      flex-direction: column;
      align-items: stretch;
    }
    .pwa-install-icon {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #2f9bff, #35cfdf);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 14px;
      color: #0a0e1a;
    }
    .pwa-install-row {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .pwa-install-copy {
      flex: 1;
      min-width: 0;
    }
    .pwa-install-copy strong {
      display: block;
      font-size: 14px;
      margin-bottom: 2px;
    }
    .pwa-install-copy p {
      margin: 0;
      font-size: 12.5px;
      color: #bcc6c2;
      line-height: 1.4;
    }
    .pwa-install-steps {
      list-style: none;
      margin: 12px 0 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    .pwa-install-steps li {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      color: #dbe9ee;
    }
    .pwa-install-steps .pwa-step-index {
      flex-shrink: 0;
      display: grid;
      place-items: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: rgba(53, 207, 223, 0.16);
      color: #7fe0ec;
      font-size: 11px;
      font-weight: 800;
    }
    .pwa-install-steps .pwa-step-icon {
      display: inline-flex;
      color: #7fe0ec;
    }
    .pwa-install-actions {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .pwa-install-banner.instructional .pwa-install-actions {
      flex-direction: row;
      justify-content: flex-end;
      margin-top: 14px;
    }
    .pwa-install-btn {
      border: none;
      border-radius: 8px;
      padding: 7px 14px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .pwa-install-btn.primary {
      background: linear-gradient(135deg, #2f9bff, #35cfdf);
      color: #0a0e1a;
    }
    .pwa-install-btn.secondary {
      background: transparent;
      color: #bcc6c2;
    }
    @media (max-width: 480px) {
      .pwa-install-banner:not(.instructional) {
        flex-wrap: wrap;
      }
      .pwa-install-banner:not(.instructional) .pwa-install-actions {
        flex-direction: row;
        width: 100%;
        justify-content: flex-end;
      }
    }
  `;
  document.head.appendChild(style);
}

let activeBanner = null;

function removeActiveBanner() {
  if (activeBanner) {
    activeBanner.remove();
    activeBanner = null;
  }
}

// Renders one of two shapes: a two-button actionable banner (install/dismiss,
// used for the real beforeinstallprompt flow), or an instructional banner
// with a numbered steps list and a single acknowledgement button (iOS, which
// has no scriptable install flow).
function renderBanner({ instructional, title, text, steps, primaryLabel, secondaryLabel, onPrimary, onSecondary }) {
  injectStyles();
  removeActiveBanner();

  const banner = document.createElement("div");
  banner.className = `pwa-install-banner${instructional ? " instructional" : ""}`;
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", title);

  const stepsHtml = Array.isArray(steps) && steps.length
    ? `<ol class="pwa-install-steps">${steps.map((step, index) => `
        <li><span class="pwa-step-index">${index + 1}</span>${step.icon ? `<span class="pwa-step-icon">${step.icon}</span>` : ""}<span>${step.text}</span></li>
      `).join("")}</ol>`
    : "";

  const actionsHtml = instructional
    ? `<div class="pwa-install-actions"><button type="button" class="pwa-install-btn primary" data-action="ack">${primaryLabel}</button></div>`
    : `<div class="pwa-install-actions">
        <button type="button" class="pwa-install-btn primary" data-action="install">${primaryLabel}</button>
        <button type="button" class="pwa-install-btn secondary" data-action="dismiss">${secondaryLabel}</button>
      </div>`;

  banner.innerHTML = `
    <div class="pwa-install-row">
      <span class="pwa-install-icon">FP</span>
      <div class="pwa-install-copy">
        <strong>${title}</strong>
        <p>${text}</p>
      </div>
      ${instructional ? "" : actionsHtml}
    </div>
    ${stepsHtml}
    ${instructional ? actionsHtml : ""}
  `;

  document.body.appendChild(banner);
  activeBanner = banner;
  requestAnimationFrame(() => banner.classList.add("visible"));

  const primaryButton = banner.querySelector('[data-action="install"], [data-action="ack"]');
  const secondaryButton = banner.querySelector('[data-action="dismiss"]');

  primaryButton?.addEventListener("click", () => {
    removeActiveBanner();
    onPrimary?.();
  });
  secondaryButton?.addEventListener("click", () => {
    removeActiveBanner();
    onSecondary?.();
  });

  return banner;
}

// --- A. Android Chrome / supported Chromium browsers, and desktop Chrome/Edge ---
// Both rely on the real `beforeinstallprompt` event; only the dismissal key
// differs so they don't share a suppression window with iOS or each other.
function initNativePromptFlow(platformSlug) {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    if (isDismissed(platformSlug)) return;

    const copy = isHebrew
      ? { title: "התקן את FuelPhysique", text: "הוסף למסך הבית לגישה מהירה ולחוויה במסך מלא, כמו אפליקציה.", install: "התקנה", dismiss: "לא עכשיו" }
      : { title: "Install FuelPhysique", text: "Add to your home screen for quick, full-screen access — just like an app.", install: "Install", dismiss: "Not now" };

    renderBanner({
      instructional: false,
      title: copy.title,
      text: copy.text,
      primaryLabel: copy.install,
      secondaryLabel: copy.dismiss,
      onPrimary: async () => {
        event.prompt();
        const choice = await event.userChoice;
        // A user who explicitly declines the native dialog should not be
        // re-prompted immediately on the next page load either.
        if (choice?.outcome !== "accepted") setDismissed(platformSlug);
      },
      onSecondary: () => setDismissed(platformSlug)
    });
  });

  window.addEventListener("appinstalled", () => {
    try {
      localStorage.removeItem(dismissKey(platformSlug));
    } catch {}
  });
}

// --- B. iPhone/iPad Safari: no beforeinstallprompt exists on this platform. ---
function showIOSSafariInstructions() {
  if (isDismissed("ios-safari")) return;

  const copy = isHebrew
    ? {
        title: "התקן את FuelPhysique",
        text: "הוסף למסך הבית לגישה מהירה, במסך מלא, כמו אפליקציה.",
        steps: [
          `הקש על כפתור השיתוף ${SHARE_ICON_SVG}`,
          'בחר "הוסף למסך הבית"',
          'אם מוצג, הפעל "פתח כאפליקציית אינטרנט"',
          'הקש "הוסף"'
        ],
        ack: "הבנתי"
      }
    : {
        title: "Install FuelPhysique",
        text: "Add to your home screen for quick, full-screen access — just like an app.",
        steps: [
          `Tap the Share button ${SHARE_ICON_SVG}`,
          'Tap "Add to Home Screen"',
          'Enable "Open as Web App" where shown',
          'Tap "Add"'
        ],
        ack: "Got it"
      };

  renderBanner({
    instructional: true,
    title: copy.title,
    text: copy.text,
    steps: copy.steps.map((text) => ({ text })),
    primaryLabel: copy.ack,
    onPrimary: () => setDismissed("ios-safari")
  });
}

// --- C. Chrome/Edge/Firefox/other browsers on iPhone/iPad: no install flow ---
// is reachable from these browsers at all -- iOS only exposes "Add to Home
// Screen" from Safari's own Share sheet, regardless of which rendering
// engine the other browser uses under the hood.
function showIOSOtherBrowserNotice() {
  if (isDismissed("ios-other")) return;

  const copy = isHebrew
    ? {
        title: "התקנה זמינה ב-Safari",
        text: "פתח את FuelPhysique ב-Safari, ואז השתמש בשיתוף ← הוספה למסך הבית.",
        ack: "הבנתי"
      }
    : {
        title: "Install from Safari",
        text: "Open FuelPhysique in Safari, then use Share → Add to Home Screen.",
        ack: "Got it"
      };

  renderBanner({
    instructional: true,
    title: copy.title,
    text: copy.text,
    primaryLabel: copy.ack,
    onPrimary: () => setDismissed("ios-other")
  });
}

function init() {
  // D. Never promote installation once already running as an installed app.
  if (isStandalone()) return;

  if (isIOS()) {
    if (isIOSSafari()) {
      showIOSSafariInstructions();
    } else {
      showIOSOtherBrowserNotice();
    }
    return;
  }

  // Android Chrome/Chromium and desktop Chrome/Edge both use the real
  // event; the dismissal key is the only thing that differs between them.
  initNativePromptFlow(isAndroid() ? "android" : "desktop");
}

init();
