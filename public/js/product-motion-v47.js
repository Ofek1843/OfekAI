(() => {
  "use strict";
  const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
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
    grid.className = "fp-v47-select-grid fp-v47-reveal";
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
      card.tabIndex = selected ? 0 : -1;
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
    grid.className = "fp-v47-gender-grid fp-v47-reveal";
    grid.setAttribute("role", "radiogroup");
    grid.setAttribute("aria-label", document.documentElement.lang === "he" ? "בחירת מין" : "Gender selection");
    const copy = document.documentElement.lang === "he"
      ? [["male", "זכר", "חיתוך חישוב לפי זכר"], ["female", "נקבה", "חיתוך חישוב לפי נקבה"]]
      : [["male", "Male", "Use the male calculation profile"], ["female", "Female", "Use the female calculation profile"]];
    grid.innerHTML = copy.map(([value, title, detail]) => `<label class="fp-v47-gender-card" data-gender="${value}" role="radio" aria-checked="${select.value === value}"><input type="radio" name="visualGender" value="${value}"${select.value === value ? " checked" : ""}><span><strong>${title}</strong><small>${detail}</small></span></label>`).join("");
    select.closest("label")?.append(grid) || select.parentElement?.append(grid);
    grid.querySelectorAll("input").forEach((input) => input.addEventListener("change", () => {
      select.value = input.value;
      grid.querySelectorAll(".fp-v47-gender-card").forEach((card) => card.setAttribute("aria-checked", String(card.dataset.gender === input.value)));
      grid.querySelectorAll(".fp-v47-gender-card").forEach((card) => card.classList.toggle("fp-v47-selected", card.dataset.gender === input.value));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }));
  }

  function start() {
    document.body.classList.add("fp-v47-motion-enabled");
    addGenderChoices();
    ["#activityLevel", "#dietaryPreference", "#prepTimePreference", "#foodStylePreference"].forEach(addSelectChoices);
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
    const rows = document.querySelector("#foodEntries");
    if (rows) {
      const rowObserver = new MutationObserver(() => rows.querySelectorAll("tr:not(.fp-v47-dynamic-row)").forEach((row, index) => { row.classList.add("fp-v47-dynamic-row"); row.style.setProperty("--fp-v47-delay", `${Math.min(index * 50, 250)}ms`); row.querySelector(".food-thumbnail")?.classList.add("fp-v47-food-thumb"); }));
      rowObserver.observe(rows, { childList: true, subtree: true });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
