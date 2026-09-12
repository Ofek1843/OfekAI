(() => {
  "use strict";
  const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const raf = (callback) => window.requestAnimationFrame ? window.requestAnimationFrame(callback) : window.setTimeout(() => callback(performance.now()), 16);

  function animateNumber(element, value, { duration = 480, format = null } = {}) {
    if (!element) return;
    const target = Number(value);
    if (!Number.isFinite(target)) return;
    const previous = Number(element.dataset.fpV47Number);
    const start = Number.isFinite(previous) ? previous : target;
    element.dataset.fpV47Number = String(target);
    const render = (current) => { element.textContent = format ? format(current) : String(Math.round(current)); };
    if (reduced() || start === target) { render(target); return; }
    const started = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      render(start + ((target - start) * eased));
      if (progress < 1) raf(tick);
    };
    raf(tick);
  }

  function animateMacroRing(element, macro) {
    if (!element) return;
    const target = [Number(macro?.protein) || 0, Number(macro?.carbs) || 0, Number(macro?.fat) || 0];
    const previous = (element.dataset.fpV47Macro || "").split(",").map(Number);
    const start = previous.length === 3 && previous.every(Number.isFinite) ? previous : target;
    element.dataset.fpV47Macro = target.join(",");
    const paint = (values) => {
      const proteinEnd = values[0];
      const carbEnd = values[0] + values[1];
      element.style.background = values.some(Boolean)
        ? `conic-gradient(var(--daily-blue) 0 ${proteinEnd}%, var(--daily-amber) ${proteinEnd}% ${carbEnd}%, var(--daily-purple) ${carbEnd}% 100%)`
        : "conic-gradient(rgba(131, 194, 239, 0.14) 0 100%)";
    };
    if (reduced()) { paint(target); return; }
    const started = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / 420);
      const eased = 1 - Math.pow(1 - progress, 3);
      paint(start.map((value, index) => value + ((target[index] - value) * eased)));
      if (progress < 1) raf(tick);
    };
    raf(tick);
  }

  function success(element) {
    if (!element) return;
    element.classList.remove("fp-v47-success");
    void element.offsetWidth;
    element.classList.add("fp-v47-success");
    if (!reduced()) window.setTimeout(() => element.classList.remove("fp-v47-success"), 950);
  }
  const revealTargets = () => [...document.querySelectorAll(
    ".dashboard-shell > *, .capability-card, .dashboard-card, .stats-grid > *, .visual-choice-card, .product-loop-section > *, #foodEntries tr, .exercise-row, .meal-card"
  )];

  function markChoices() {
    document.querySelectorAll("[data-sync-select], .visual-choice-grid").forEach((group) => {
      const cards = [...group.querySelectorAll(":scope > .visual-choice-card")];
      if (!cards.length) return;
      cards.forEach((card, index) => {
        card.classList.add("fp-v47-choice", "fp-v47-reveal");
        card.style.setProperty("--fp-v47-delay", `${Math.min(index * 55, 330)}ms`);
        const input = card.querySelector("input");
        card.setAttribute("aria-checked", String(Boolean(input?.checked)));
        card.setAttribute("role", input?.type === "checkbox" ? "checkbox" : "radio");
        card.tabIndex = input?.checked ? 0 : -1;
        card.addEventListener("keydown", (event) => {
          if (event.key !== " " && event.key !== "Enter") return;
          event.preventDefault();
          input?.click();
        });
      });
    });
  }

  function addSelectChoices(selectId) {
    const select = document.querySelector(selectId);
    if (!select || select.dataset.fpV47Choices === "true") return;
    const options = [...select.options].filter((option) => option.value);
    if (!options.length) return;
    select.dataset.fpV47Choices = "true";
    select.classList.add("visually-hidden-select");
    const grid = document.createElement("div");
    grid.className = "fp-v47-select-grid";
    grid.setAttribute("role", "radiogroup");
    grid.setAttribute("aria-label", select.closest("label")?.querySelector("span")?.textContent?.trim() || "Choose an option");
    grid.innerHTML = options.map((option, index) => {
      const label = option.dataset[document.documentElement.lang === "he" ? "he" : "en"] || option.textContent.trim();
      return `<button class="fp-v47-select-card" type="button" role="radio" aria-checked="${select.value === option.value}" data-value="${option.value}" style="--fp-v47-delay:${Math.min(index * 45, 270)}ms"><strong>${label}</strong></button>`;
    }).join("");
    select.closest("label")?.append(grid) || select.parentElement?.append(grid);
    const sync = () => grid.querySelectorAll("[data-value]").forEach((card) => {
      const selected = card.dataset.value === select.value;
      card.setAttribute("aria-checked", String(selected));
      card.classList.toggle("fp-v47-selected", selected);
      card.tabIndex = 0;
    });
    grid.addEventListener("click", (event) => {
      const card = event.target.closest("[data-value]");
      if (!card) return;
      select.value = card.dataset.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
    });
    select.addEventListener("change", sync);
    sync();
  }

  function addGenderChoices() {
    const select = document.querySelector("#gender");
    if (!select || document.querySelector(".fp-v47-gender-grid")) return;
    select.classList.add("visually-hidden-select");
    const grid = document.createElement("div");
    // Essential form controls must not depend on an entrance observer.
    grid.className = "fp-v47-gender-grid";
    grid.setAttribute("role", "radiogroup");
    grid.setAttribute("aria-label", document.documentElement.lang === "he" ? "בחירת מין" : "Gender selection");
    const isTrainingContext = select.dataset?.genderContext === "training";
    const copy = document.documentElement.lang === "he"
      ? (isTrainingContext
        ? [["male", "זכר", "הקשר אופציונלי לתוכנית"], ["female", "נקבה", "הקשר אופציונלי לתוכנית"]]
        : [["male", "זכר", "לחישוב הצרכים התזונתיים"], ["female", "נקבה", "לחישוב הצרכים התזונתיים"]])
      : (isTrainingContext
        ? [["male", "Male", "Optional plan context"], ["female", "Female", "Optional plan context"]]
        : [["male", "Male", "Use the male calculation profile"], ["female", "Female", "Use the female calculation profile"]]);
    grid.innerHTML = copy.map(([value, title, detail], index) => `<label class="fp-v47-gender-card" data-gender="${value}" aria-checked="${select.value === value}"><input type="radio" name="visualGender" value="${value}"${select.value === value ? " checked" : ""}><img class="fp-v47-gender-image" src="/assets/athlete-motion/v43/plate/normalized/frame-0${index + 1}.webp" alt="" width="96" height="120"><span><strong>${title}</strong><small>${detail}</small></span></label>`).join("");
    // Avoid nested labels: each radio owns its own visible label.
    const host = select.closest("label") || select;
    host.after(grid);
    grid.querySelectorAll("img").forEach((img) => img.addEventListener("error", () => {
      if (img.dataset.fallback) { img.hidden = true; return; }
      img.dataset.fallback = "true";
      img.src = "/images/common/athlete-profile.svg";
    }));
    grid.querySelectorAll("input").forEach((input) => input.addEventListener("change", () => {
      select.value = input.value;
      grid.querySelectorAll(".fp-v47-gender-card").forEach((card) => card.setAttribute("aria-checked", String(card.dataset.gender === input.value)));
      grid.querySelectorAll(".fp-v47-gender-card").forEach((card) => card.classList.toggle("fp-v47-selected", card.dataset.gender === input.value));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }));
    select.addEventListener("change", () => {
      grid.querySelectorAll("input").forEach((input) => {
        input.checked = input.value === select.value;
        input.closest("label").setAttribute("aria-checked", String(input.checked));
      });
    });
  }

  function start() {
    document.body.classList.add("fp-v47-motion-enabled");
    addGenderChoices();
    ["#activityLevel", "#dietaryPreference"].forEach(addSelectChoices);
    markChoices();
    const targets = revealTargets();
    targets.forEach((target, index) => {
      target.classList.add("fp-v47-reveal");
      target.style.setProperty("--fp-v47-delay", `${Math.min(index * 60, 420)}ms`);
    });
    const show = (target) => target.classList.add("fp-v47-visible");
    if (reduced() || !("IntersectionObserver" in window)) targets.forEach(show);
    else {
      const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { show(entry.target); observer.unobserve(entry.target); } }), { threshold: .12, rootMargin: "0px 0px -5% 0px" });
      targets.forEach((target) => observer.observe(target));
      window.setTimeout(() => targets.forEach(show), 1600);
    }
    document.addEventListener("change", (event) => {
      const card = event.target.closest(".visual-choice-card");
      if (card) {
        const group = card.parentElement;
        group?.querySelectorAll(":scope > .visual-choice-card").forEach((item) => { const input = item.querySelector("input"); item.setAttribute("aria-checked", String(Boolean(input?.checked))); item.tabIndex = input?.checked ? 0 : -1; });
        card.classList.remove("fp-v47-selected"); requestAnimationFrame(() => card.classList.add("fp-v47-selected"));
      }
    });
    window.fpV47AnimateNumber = animateNumber;
    window.fpV47AnimateMacroRing = animateMacroRing;
    window.fpV47Success = success;
    const rows = document.querySelector("#foodEntries");
    if (rows) {
      const rowObserver = new MutationObserver(() => rows.querySelectorAll("tr:not(.fp-v47-dynamic-row)").forEach((row, index) => { row.classList.add("fp-v47-dynamic-row"); row.style.setProperty("--fp-v47-delay", `${Math.min(index * 50, 250)}ms`); row.querySelector(".food-thumbnail")?.classList.add("fp-v47-food-thumb"); }));
      rowObserver.observe(rows, { childList: true, subtree: true });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
