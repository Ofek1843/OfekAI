const isHebrew = (localStorage.getItem("ofek-ai-language") || "en") === "he";
document.documentElement.lang = isHebrew ? "he" : "en";
document.documentElement.dir = isHebrew ? "rtl" : "ltr";
document.querySelectorAll("[data-legal-language]").forEach((node) => {
  node.hidden = node.dataset.legalLanguage !== (isHebrew ? "he" : "en");
});
