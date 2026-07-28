// "Add to home screen" prompt shown once, right after a fresh signup/login
// lands on the dashboard (see the sessionStorage flag set in auth.js just
// before its redirect). Not shown on every visit — only that first arrival.
//
// Android/Chrome can be prompted programmatically via beforeinstallprompt.
// iOS Safari never fires that event at all (Apple restriction), so iOS gets
// static instructions ("tap Share, then Add to Home Screen") instead of a
// button — there is no API to trigger the iOS install flow from JS.
const he = (localStorage.getItem("ofek-ai-language") || "en") === "he";

const TEXT = he
  ? {
      title: "התקן את FuelPhysique",
      body: "הוסף את FuelPhysique למסך הבית כדי לפתוח אותו כמו אפליקציה — מהיר יותר, ועם התראות.",
      install: "התקנה",
      iosBody: "כדי להתקין: הקש על כפתור השיתוף ⬆ בסרגל הכלים של הדפדפן, ואז 'הוספה למסך הבית'.",
      dismiss: "לא עכשיו"
    }
  : {
      title: "Install FuelPhysique",
      body: "Add FuelPhysique to your home screen to open it like an app — faster, and with notifications.",
      install: "Install",
      iosBody: "To install: tap the Share button ⬆ in your browser toolbar, then \"Add to Home Screen\".",
      dismiss: "Not now"
    };

let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredPrompt = event;
});

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

function buildDialog(showInstallButton) {
  const dialog = document.createElement("dialog");
  dialog.className = "pwa-install-dialog";
  dialog.innerHTML = `
    <div class="pwa-install-shell">
      <button type="button" class="pwa-install-close" aria-label="${TEXT.dismiss}">×</button>
      <div class="pwa-install-icon" aria-hidden="true">📲</div>
      <h3>${TEXT.title}</h3>
      <p>${showInstallButton ? TEXT.body : TEXT.iosBody}</p>
      <div class="pwa-install-actions">
        ${showInstallButton ? `<button type="button" class="pwa-install-button">${TEXT.install}</button>` : ""}
        <button type="button" class="pwa-install-dismiss">${TEXT.dismiss}</button>
      </div>
    </div>
  `;
  document.body.append(dialog);
  return dialog;
}

function showDialog(showInstallButton) {
  const dialog = buildDialog(showInstallButton);

  function closeAndRemove() {
    dialog.close();
    dialog.remove();
  }

  // Direct handlers rather than relying solely on the dialog "close" event —
  // some environments don't fire it reliably for programmatic .close() (see
  // the same pattern/comment in auth-modal.js).
  dialog.querySelector(".pwa-install-close").addEventListener("click", closeAndRemove);
  dialog.querySelector(".pwa-install-dismiss").addEventListener("click", closeAndRemove);
  dialog.addEventListener("click", event => {
    if (event.target === dialog) closeAndRemove();
  });

  const installButton = dialog.querySelector(".pwa-install-button");
  if (installButton) {
    installButton.addEventListener("click", async () => {
      installButton.disabled = true;
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      closeAndRemove();
      if (promptEvent) {
        promptEvent.prompt();
        await promptEvent.userChoice.catch(() => {});
      }
    });
  }

  dialog.showModal();
}

export function maybeShowInstallPrompt() {
  if (!sessionStorage.getItem("fuelphysique-just-authenticated")) return;
  sessionStorage.removeItem("fuelphysique-just-authenticated");

  if (isStandalone()) return;

  if (isIos()) {
    showDialog(false);
    return;
  }

  // beforeinstallprompt may not have fired yet on this very fresh page
  // load — give it a short window, then give up silently if the browser
  // never considered the app installable (e.g. criteria not met, or the
  // user already dismissed it enough times recently per Chrome's own
  // cooldown heuristics).
  window.setTimeout(() => {
    if (deferredPrompt) showDialog(true);
  }, 1200);
}
