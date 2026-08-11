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
  const lightCompositionRoutes = new Set([
    "index.html",
    "auth.html",
    "auth-action.html",
    "billing-result.html",
    "contact.html",
    "faq.html",
    "nutrition-builder.html",
    "manual-nutrition-builder.html",
    "my-nutrition-plans.html",
    "pricing.html",
    "social.html",
    "app.html",
    ...legalRoutes,
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

  const updateProductLanguage = (language) => {
    const safeLanguage = language === "he" ? "he" : "en";
    const copy = translations[safeLanguage];
    const skipLink = document.querySelector(".fp-skip-link");
    if (skipLink) skipLink.textContent = copy.skip;
    const nav = document.querySelector(".fp-global-nav");
    if (!nav) return;
    nav.setAttribute("aria-label", copy.navigation);
    nav.dir = safeLanguage === "he" ? "rtl" : "ltr";
    const brand = nav.querySelector(".fp-global-brand");
    if (brand) brand.textContent = copy.brand;
    for (const key of ["dashboard", "workouts", "nutrition", "progress", "messages"]) {
      const link = nav.querySelector(`[data-destination="${key}"]`);
      if (link) link.textContent = copy[key];
    }
  };

  window.addEventListener("fuelphysique:languagechange", (event) => {
    updateProductLanguage(event.detail?.language);
  });

  const exposeIconActions = () => {
    const labels = {
      "Start conversation": "New",
      "Back to conversations": "Back",
      "Friend options": "More",
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

  const setupPerformanceMotion = () => {
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = reducedQuery.matches;
    document.documentElement.classList.toggle("fp-reduced-motion", reduced);

    const mark = (element, kind = "content", delay = 0) => {
      if (!element || element.classList.contains("fp-motion-target")) return;
      element.classList.add("fp-motion-target");
      element.dataset.fpMotion = kind;
      element.style.setProperty("--fp-motion-delay", `${Math.min(delay, 320)}ms`);
    };

    const markSequence = (selector, kind, step = 55, offset = 0) => {
      document.querySelectorAll(selector).forEach((element, index) => mark(element, kind, offset + index * step));
    };

    if (route === "index.html") {
      markSequence(".premium-card--programs", "train");
      markSequence(".premium-card--nutrition", "fuel");
      markSequence(".premium-card--progress, .results-grid", "track");
      markSequence(".premium-card--learning, .transformation-invite", "connect");
      markSequence(".platform-step", "content", 55);
    } else if (route === "dashboard.html") {
      markSequence(".next-workout-card, .schedule-card", "train", 60);
      markSequence(".nutrition-card", "fuel", 60, 60);
      markSequence(".stats-grid .card, .chart-card", "track", 45, 100);
      markSequence(".recent-card, .missed-card, .tools-accordion", "connect", 45, 150);
    } else if (/workout|exercise|running|log-workout/.test(route)) {
      markSequence(".builder-card, .wizard-step:not([hidden]), .panel, .focus-panel, .workout-card", "train", 55);
      markSequence(".chart, .muscle-volume-grid", "track", 55, 80);
    } else if (/nutrition/.test(route)) {
      markSequence(".builder-card, .target-section, .nutrition-summary", "fuel", 55);
      markSequence(".meal-card, .meal-section", "content", 45, 80);
    } else if (/progress|transformation/.test(route)) {
      markSequence(".stats-grid > *, .metric-card", "content", 45);
      markSequence(".chart-card, .chart, .progress-card", "track", 55, 60);
    } else if (/social|leaderboard/.test(route)) {
      markSequence(".conversation-rail", "connect");
      markSequence(".view-hero, .requests-grid, .social-section", "content", 45, 55);
    } else if (route === "auth.html" || route === "auth-action.html") {
      markSequence(".brand", "train");
      markSequence(".auth-panel, .auth-card, .action-container", "content", 45, 80);
    }

    const targets = [...document.querySelectorAll(".fp-motion-target")];
    if (reduced || !("IntersectionObserver" in window)) {
      targets.forEach((element) => element.classList.add("fp-motion-in"));
      return;
    }

    document.documentElement.classList.add("fp-motion-enabled");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("fp-motion-in");
        const chart = entry.target.matches(".chart, .activity-chart")
          ? entry.target
          : entry.target.querySelector(".chart, .activity-chart");
        chart?.classList.add("fp-chart-reveal");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.14, rootMargin: "0px 0px -4% 0px" });
    targets.forEach((element) => observer.observe(element));

    // A slow observer or restored background tab must never leave content
    // hidden. This is a visibility safety net, not a second animation.
    window.setTimeout(() => targets.forEach((element) => element.classList.add("fp-motion-in")), 1600);

    const metricSelector = [
      ".stats-grid strong",
      ".landing-stat strong",
      ".macro-grid strong",
      "[data-count-value]",
      ".metric-value",
      ".stat-value",
    ].join(",");
    const metricValues = new WeakMap();
    const animatingMetrics = new WeakSet();
    const animateMetric = (element) => {
      if (!element || reduced || element.children.length || animatingMetrics.has(element)) return;
      const finalText = element.textContent.trim();
      const match = finalText.match(/^([^0-9-]*)(-?\d+)([^0-9]*)$/);
      if (!match) return;
      const finalValue = Number(match[2]);
      if (!Number.isSafeInteger(finalValue)) return;
      const previous = metricValues.get(element);
      if (previous === finalValue) return;
      metricValues.set(element, finalValue);
      animatingMetrics.add(element);
      element.setAttribute("aria-label", finalText);
      const startValue = Number.isSafeInteger(previous) ? previous : 0;
      const started = performance.now();
      const duration = 460;
      const formatter = new Intl.NumberFormat(document.documentElement.lang || "en", { maximumFractionDigits: 0 });
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(startValue + (finalValue - startValue) * eased);
        element.textContent = `${match[1]}${formatter.format(current)}${match[3]}`;
        if (progress < 1) requestAnimationFrame(tick);
        else {
          element.textContent = finalText;
          animatingMetrics.delete(element);
          element.classList.add("fp-metric-updated");
          window.setTimeout(() => element.classList.remove("fp-metric-updated"), 320);
        }
      };
      requestAnimationFrame(tick);
    };

    const metricObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) animateMetric(entry.target);
      });
    }, { threshold: 0.6 });
    document.querySelectorAll(metricSelector).forEach((element) => metricObserver.observe(element));

    const enterDynamic = (element) => {
      if (!(element instanceof Element)) return;
      const candidates = element.matches(".exercise-row, .workout-card, .meal-card, .message-row, .history-card, .plan-card")
        ? [element]
        : [...element.querySelectorAll(".exercise-row, .workout-card, .meal-card, .message-row, .history-card, .plan-card")];
      candidates.forEach((candidate, index) => {
        candidate.classList.remove("fp-dynamic-entry");
        candidate.style.setProperty("--fp-motion-delay", `${Math.min(index * 45, 270)}ms`);
        requestAnimationFrame(() => candidate.classList.add("fp-dynamic-entry"));
      });
    };

    const mutationObserver = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "childList") {
          record.addedNodes.forEach(enterDynamic);
          const metric = record.target instanceof Element ? record.target.closest(metricSelector) : null;
          if (metric) animateMetric(metric);
        }
      }
    });
    const motionRoot = document.querySelector("main") || document.body;
    mutationObserver.observe(motionRoot, { childList: true, subtree: true, characterData: true });

    document.addEventListener("change", (event) => {
      const selected = event.target.closest(".visual-choice-card, .focus-mode-card, .muscle-chip, .set-row");
      if (selected) {
        selected.classList.remove("fp-motion-selected");
        requestAnimationFrame(() => selected.classList.add("fp-motion-selected"));
      }
      if (event.target.matches(".set-complete") && event.target.checked) {
        const row = event.target.closest(".set-row");
        row?.classList.add("fp-set-complete");
        window.setTimeout(() => row?.classList.remove("fp-set-complete"), 420);
      }
    });

    document.addEventListener("click", (event) => {
      const muscle = event.target.closest(".muscle-chip, [data-muscle-region]");
      if (!muscle) return;
      muscle.classList.remove("fp-muscle-active");
      requestAnimationFrame(() => muscle.classList.add("fp-muscle-active"));
      window.setTimeout(() => muscle.classList.remove("fp-muscle-active"), 520);
    });
  };

  const boot = () => {
    const language = localStorage.getItem("ofek-ai-language") === "he" ? "he" : "en";
    const copy = translations[language];
    document.body.classList.add("fp-redesign", `fp-route-${route.replace(/\.html$/, "").replace(/[^a-z0-9]+/g, "-")}`);
    document.body.classList.add(lightCompositionRoutes.has(route) ? "fp-composition-light" : "fp-composition-dark");
    if (legalRoutes.has(route)) document.body.classList.add("fp-legal-route");
    if (!protectedRoutes.has(route)) document.body.classList.add("fp-public-route");
    addSkipLink(copy);
    addProductNavigation(copy, language);
    exposeIconActions();
    window.setTimeout(exposeIconActions, 500);
    window.setTimeout(exposeIconActions, 1500);
    prepareTables();
    setupPerformanceMotion();
    requestAnimationFrame(() => document.documentElement.classList.add("fp-redesign-ready"));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
