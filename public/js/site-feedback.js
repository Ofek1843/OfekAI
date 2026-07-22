const feedbackLanguage =
  (localStorage.getItem("ofek-ai-language") || "en") === "he" ? "he" : "en";

const feedbackCopy =
  feedbackLanguage === "he"
    ? {
        trigger: "מצאת באג?",
        triggerMobile: "🐞",
        title: "מצאת באג?",
        text: "נשמח לשמוע כדי לשפר ולקדם את האתר.",
        placeholder:
          "כתוב כאן מה קרה, באיזה עמוד היית, ומה ניסית לעשות...",
        send: "שלח דיווח",
        close: "סגור",
        empty: "כתוב בקצרה מה מצאת כדי שנוכל לטפל בזה.",
        sent: "הדיווח נשלח לצוות. תודה שעזרת לשפר את האתר."
      }
    : {
        trigger: "Found a bug?",
        triggerMobile: "🐞",
        title: "Found a bug?",
        text: "The team would love to hear so we can improve the site.",
        placeholder:
          "Tell us what happened, which page you were on, and what you tried to do...",
        send: "Send report",
        close: "Close",
        empty: "Briefly describe what you found so we can fix it.",
        sent: "Your report was sent to the team. Thanks for helping improve the site."
      };

function injectFeedbackStyles() {
  if (document.getElementById("siteFeedbackStyles")) return;
  const style = document.createElement("style");
  style.id = "siteFeedbackStyles";
  style.textContent = `
    .site-feedback-widget {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 9998;
      font-family: inherit;
      direction: ${feedbackLanguage === "he" ? "rtl" : "ltr"};
    }
    .site-feedback-trigger {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      padding: 10px 14px;
      border: 1px solid rgba(125, 211, 252, 0.32);
      border-radius: 999px;
      color: #e0f2fe;
      font-weight: 900;
      cursor: pointer;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(14, 116, 144, 0.86));
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.34), 0 0 24px rgba(56, 189, 248, 0.12);
      backdrop-filter: blur(12px);
    }
    .site-feedback-panel {
      position: absolute;
      right: 0;
      bottom: 58px;
      width: min(340px, calc(100vw - 32px));
      padding: 16px;
      border: 1px solid rgba(125, 211, 252, 0.22);
      border-radius: 20px;
      background: rgba(8, 18, 35, 0.96);
      color: #e5f2ff;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.42);
      transform-origin: bottom right;
    }
    .site-feedback-panel[hidden] { display: none; }
    .site-feedback-panel h2 { margin: 0 0 6px; font-size: 20px; }
    .site-feedback-panel p { margin: 0 0 12px; color: #a9bad3; line-height: 1.5; }
    .site-feedback-panel textarea {
      width: 100%;
      min-height: 112px;
      resize: vertical;
      padding: 12px;
      border-radius: 14px;
      color: #f8fafc;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.22);
      font: inherit;
      box-sizing: border-box;
    }
    .site-feedback-actions { display: flex; gap: 8px; margin-top: 10px; }
    .site-feedback-actions button {
      flex: 1;
      min-height: 40px;
      border-radius: 12px;
      border: 1px solid rgba(125, 211, 252, 0.24);
      font-weight: 900;
      cursor: pointer;
    }
    .site-feedback-send { color: #06211a; background: linear-gradient(135deg, #34d399, #38bdf8); }
    .site-feedback-close { color: #dbeafe; background: rgba(255, 255, 255, 0.06); }
    .site-feedback-error {
      min-height: 18px;
      margin-top: 8px;
      color: #fda4af;
      font-size: 13px;
      font-weight: 800;
    }
    @media (max-width: 620px) {
      .site-feedback-widget { right: 10px; bottom: 86px; }
      .site-feedback-trigger {
        width: 46px;
        min-width: 46px;
        height: 46px;
        min-height: 46px;
        padding: 0;
        gap: 0;
        justify-content: center;
        border-radius: 999px;
        font-size: 20px;
      }
      .site-feedback-trigger-label {
        display: none;
      }
      .site-feedback-panel {
        right: 0;
        bottom: 58px;
        width: min(320px, calc(100vw - 20px));
      }
    }
  `;
  document.head.append(style);
}

function initSiteFeedback() {
  if (document.querySelector(".site-feedback-widget")) return;
  injectFeedbackStyles();
  const widget = document.createElement("div");
  widget.className = "site-feedback-widget";
  widget.innerHTML = `
    <button class="site-feedback-trigger" type="button" aria-label="${feedbackCopy.trigger}">
      <span aria-hidden="true">${feedbackCopy.triggerMobile}</span>
      <span class="site-feedback-trigger-label">${feedbackCopy.trigger}</span>
    </button>
    <section class="site-feedback-panel" hidden>
      <h2>${feedbackCopy.title}</h2>
      <p>${feedbackCopy.text}</p>
      <textarea maxlength="1200" placeholder="${feedbackCopy.placeholder}"></textarea>
      <div class="site-feedback-actions">
        <button class="site-feedback-send" type="button">${feedbackCopy.send}</button>
        <button class="site-feedback-close" type="button">${feedbackCopy.close}</button>
      </div>
      <div class="site-feedback-error" role="status"></div>
    </section>
  `;
  document.body.append(widget);

  const trigger = widget.querySelector(".site-feedback-trigger");
  const panel = widget.querySelector(".site-feedback-panel");
  const textarea = widget.querySelector("textarea");
  const error = widget.querySelector(".site-feedback-error");

  trigger.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) textarea.focus();
  });

  widget.querySelector(".site-feedback-close").addEventListener("click", () => {
    panel.hidden = true;
    error.textContent = "";
  });

  widget.querySelector(".site-feedback-send").addEventListener("click", () => {
    const message = textarea.value.trim();
    if (!message) {
      error.textContent = feedbackCopy.empty;
      return;
    }
    error.textContent = "";
    const payload = {
      message,
      page: location.href,
      category: "bug"
    };
    fetch("/api/site-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin"
    })
      .then((response) => {
        if (!response.ok) throw new Error("feedback_failed");
        textarea.value = "";
        panel.hidden = true;
        error.textContent = feedbackCopy.sent;
      })
      .catch(() => {
        const subject = encodeURIComponent("FuelPhysique bug report");
        const body = encodeURIComponent(
          [
            message,
            "",
            `Page: ${location.href}`,
            `Browser: ${navigator.userAgent}`
          ].join("\n")
        );
        location.href = `mailto:ofek1843@gmail.com?subject=${subject}&body=${body}`;
      });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSiteFeedback, { once: true });
} else {
  initSiteFeedback();
}
