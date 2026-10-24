(() => {
  const storageKey = "ofek-ai-language";
  const routes = {
    en: "/people/ofek-zehavi.html",
    he: "/people/ofek-zehavi-he.html"
  };
  const current = document.documentElement.lang === "he" ? "he" : "en";

  // An explicit profile URL determines this page's language. Sync the site's
  // preference so the next FuelPhysique page uses the same selection.
  try { localStorage.setItem(storageKey, current); } catch {}

  document.querySelectorAll("[data-profile-language]").forEach((link) => {
    link.addEventListener("click", () => {
      const language = link.dataset.profileLanguage;
      if (routes[language]) {
        try { localStorage.setItem(storageKey, language); } catch {}
      }
    });
  });

  const showLanguage = (language) => {
    if (routes[language] && language !== current) window.location.assign(routes[language]);
  };
  window.addEventListener("fuelphysique:languagechange", (event) => showLanguage(event.detail?.language));
  window.addEventListener("ofekai:settings-saved", (event) => showLanguage(event.detail?.language));
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey) showLanguage(event.newValue);
  });
})();
