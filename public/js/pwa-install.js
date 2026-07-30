const DISMISS_KEY = "ofek-ai-pwa-install-dismissed-until";
const DISMISS_DAYS = 14;

const isHebrew = (localStorage.getItem("ofek-ai-language") || "en") === "he";

const copy = isHebrew
  ? {
      title: "התקן את FuelPhysique",
      text: "הוסף למסך הבית לגישה מהירה ולחוויה במסך מלא, כמו אפליקציה.",
      install: "התקנה",
      dismiss: "לא עכשיו"
    }
  : {
      title: "Install FuelPhysique",
      text: "Add to your home screen for quick, full-screen access — just like an app.",
      install: "Install",
      dismiss: "Not now"
    };

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isDismissed() {
  const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return until > Date.now();
}

function setDismissed() {
  const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
  try {
    localStorage.setItem(DISMISS_KEY, String(until));
  } catch {}
}

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
      background: rgba(38, 51, 52, 0.96);
      border: 1px solid rgba(142, 157, 153, 0.18);
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
    .pwa-install-icon {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #6e9fc2, #65b89f);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 14px;
      color: #101516;
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
    .pwa-install-actions {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
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
      background: linear-gradient(135deg, #6e9fc2, #65b89f);
      color: #101516;
    }
    .pwa-install-btn.secondary {
      background: transparent;
      color: #bcc6c2;
    }
    @media (max-width: 480px) {
      .pwa-install-banner {
        flex-wrap: wrap;
      }
      .pwa-install-actions {
        flex-direction: row;
        width: 100%;
        justify-content: flex-end;
      }
    }
  `;
  document.head.appendChild(style);
}

function showBanner(onInstall, onDismiss) {
  injectStyles();

  const banner = document.createElement("div");
  banner.className = "pwa-install-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", copy.title);
  banner.innerHTML = `
    <span class="pwa-install-icon">FP</span>
    <div class="pwa-install-copy">
      <strong>${copy.title}</strong>
      <p>${copy.text}</p>
    </div>
    <div class="pwa-install-actions">
      <button type="button" class="pwa-install-btn primary" data-action="install">${copy.install}</button>
      <button type="button" class="pwa-install-btn secondary" data-action="dismiss">${copy.dismiss}</button>
    </div>
  `;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add("visible"));

  banner.querySelector('[data-action="install"]').addEventListener("click", () => {
    banner.remove();
    onInstall();
  });
  banner.querySelector('[data-action="dismiss"]').addEventListener("click", () => {
    banner.remove();
    onDismiss();
  });

  return banner;
}

function init() {
  if (isStandalone() || isDismissed()) return;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();

    showBanner(
      async () => {
        event.prompt();
        await event.userChoice;
      },
      setDismissed
    );
  });

  window.addEventListener("appinstalled", () => {
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {}
  });
}

init();
