(() => {
  const route = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const protectedRoutes = new Set([
    "app.html",
    "dashboard.html",
    "exercise-progress.html",
    "leaderboard.html",
    "leaderboard-admin.html",
    "log-workout.html",
    "manual-nutrition-builder.html",
    "manual-workout-builder.html",
    "my-nutrition-plans.html",
    "my-workout-plans.html",
    "nutrition-builder.html",
    "progress.html",
    "running.html",
    "social.html",
    "transformation-submit.html",
    "workout-builder.html",
    "workout-history.html",
    "workout-tracker.html",
  ]);
  const legalRoutes = new Set([
    "accessibility.html",
    "community-guidelines.html",
    "copyright.html",
    "privacy.html",
    "refund-policy.html",
    "subprocessors.html",
    "subscription-policy.html",
    "terms.html",
  ]);

  const routeGroup = (name) => {
    if (name === "dashboard.html" || name === "app.html") return "dashboard";
    if (/workout|exercise|running|log-workout/.test(name)) return "workouts";
    if (/nutrition/.test(name)) return "nutrition";
    if (/progress|transformation/.test(name)) return "progress";
    if (/social|leaderboard/.test(name)) return "messages";
    return "dashboard";
  };

  const translations = {
    en: {
      skip: "Skip to main content",
      navigation: "Primary product navigation",
      brand: "Fuel / Physique",
      dashboard: "Dashboard",
      workouts: "Workout Plans",
      nutrition: "Nutrition",
      progress: "Progress",
      messages: "Messages",
    },
    he: {
      skip: "דילוג לתוכן הראשי",
      navigation: "ניווט ראשי במוצר",
      brand: "Fuel / Physique",
      dashboard: "לוח בקרה",
      workouts: "תוכניות אימון",
      nutrition: "תזונה",
      progress: "התקדמות",
      messages: "הודעות",
    },
  };

  const addSkipLink = (copy) => {
    if (document.querySelector(".fp-skip-link")) return;
    const target = document.querySelector("main");
    if (!target) return;
    if (!target.id) target.id = "main-content";
    const link = document.createElement("a");
    link.className = "fp-skip-link";
    link.href = `#${target.id}`;
    link.textContent = copy.skip;
    document.body.prepend(link);
  };

  const addProductNavigation = (copy, language) => {
    if (!protectedRoutes.has(route) || document.querySelector(".fp-global-nav")) return;
    const active = routeGroup(route);
    const items = [
      ["dashboard", "/dashboard.html", copy.dashboard],
      ["workouts", "/my-workout-plans.html", copy.workouts],
      ["nutrition", "/my-nutrition-plans.html", copy.nutrition],
      ["progress", "/progress.html", copy.progress],
      ["messages", "/social.html", copy.messages],
    ];
    const nav = document.createElement("nav");
    nav.className = "fp-global-nav";
    nav.setAttribute("aria-label", copy.navigation);
    nav.dir = language === "he" ? "rtl" : "ltr";

    const brand = document.createElement("a");
    brand.className = "fp-global-brand";
    brand.href = "/dashboard.html";
    brand.textContent = copy.brand;
    nav.append(brand);

    const list = document.createElement("div");
    list.className = "fp-global-links";
    for (const [key, href, label] of items) {
      const link = document.createElement("a");
      link.className = "fp-global-link";
      link.dataset.destination = key;
      link.href = href;
      link.textContent = label;
      if (key === active) link.setAttribute("aria-current", "page");
      list.append(link);
    }
    nav.append(list);
    document.body.insertBefore(nav, document.body.firstChild);
    document.body.classList.add("fp-product-shell-active");
  };

  const exposeIconActions = () => {
    const labels = {
      "Start conversation": "New",
      "Back to conversations": "Back",
      "Friend options": "More",
      "Share with friend": "Share",
      "Record voice message": "Record",
      "Send message": "Send",
      "Voice input": "Voice",
      "Switch to light mode": "Light mode",
      "Switch to dark mode": "Dark mode",
      "Toggle theme": "Theme",
      "Close": "Close",
      "Close profile preview": "Close",
      "Close preview": "Close",
    };
    document.querySelectorAll(".icon-button[aria-label], .composer-tool[aria-label], .send-button[aria-label], #voiceInputBtn[aria-label], [data-theme-toggle][aria-label]").forEach((button) => {
      const replacement = labels[button.getAttribute("aria-label")];
      if (!replacement) return;
      button.textContent = replacement;
      button.classList.add("fp-text-action");
    });
    document.querySelectorAll(".dashboard-action, .builder-navigation a, .page-nav a, .top-nav a, .back-link, #mobileHistoryToggle").forEach((action) => {
      const walker = document.createTreeWalker(action, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        node.textContent = node.textContent.replace(/[\p{Extended_Pictographic}\uFE0F☰✦]/gu, "").replace(/\s{2,}/g, " ");
        node = walker.nextNode();
      }
    });
  };

  const prepareTables = () => {
    document.querySelectorAll("table").forEach((table) => {
      if (table.parentElement?.classList.contains("fp-table-scroll")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "fp-table-scroll";
      table.parentNode.insertBefore(wrapper, table);
      wrapper.append(table);
    });
  };

  const boot = () => {
    const language = localStorage.getItem("ofek-ai-language") === "he" ? "he" : "en";
    const copy = translations[language];
    document.body.classList.add("fp-redesign", `fp-route-${route.replace(/\.html$/, "").replace(/[^a-z0-9]+/g, "-")}`);
    if (legalRoutes.has(route)) document.body.classList.add("fp-legal-route");
    if (!protectedRoutes.has(route)) document.body.classList.add("fp-public-route");
    addSkipLink(copy);
    addProductNavigation(copy, language);
    exposeIconActions();
    window.setTimeout(exposeIconActions, 500);
    window.setTimeout(exposeIconActions, 1500);
    prepareTables();
    requestAnimationFrame(() => document.documentElement.classList.add("fp-redesign-ready"));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
