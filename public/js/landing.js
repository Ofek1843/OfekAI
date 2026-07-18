import {
  t,
  getLanguage,
  setLanguage
} from "./i18n.js";

function translateLandingPage() {
  const language = setLanguage(getLanguage());

  document
    .querySelectorAll("[data-i18n]")
    .forEach((element) => {
      const key = element.dataset.i18n;

      element.textContent = t(language, key);
    });
}

document.addEventListener(
  "DOMContentLoaded",
  translateLandingPage
);