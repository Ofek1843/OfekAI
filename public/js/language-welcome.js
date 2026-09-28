(() => {
  const dialog = document.getElementById("languageWelcomeDialog");
  const select = document.getElementById("welcomeLanguageSelect");
  const continueButton = document.getElementById("welcomeLanguageContinue");
  const alternateButton = document.getElementById("welcomeLanguageEnglish");
  if (!(dialog instanceof HTMLDialogElement) || !select || !continueButton || !alternateButton) return;

  const completedKey = "ofek-ai-language-welcome-complete";
  const languageKey = "ofek-ai-language";
  const names = { en: "English", he: "עברית", es: "Español", fr: "Français", de: "Deutsch", ar: "العربية", zh: "中文" };
  const copy = {
    en: { title: "Choose your language", description: "English is selected by default. Choose another language before continuing if you prefer.", label: "Language", proceed: "Continue in {language}", alternate: "Continue in Hebrew" },
    he: { title: "באיזו שפה להשתמש?", description: "אנגלית נבחרה כברירת מחדל. אפשר לבחור שפה אחרת לפני שממשיכים.", label: "שפה", proceed: "המשך בעברית", alternate: "המשך באנגלית" },
    es: { title: "Elige tu idioma", description: "El inglés está seleccionado de forma predeterminada. Puedes elegir otro idioma antes de continuar.", label: "Idioma", proceed: "Continuar en {language}", alternate: "Continuar en hebreo" },
    fr: { title: "Choisissez votre langue", description: "L’anglais est sélectionné par défaut. Vous pouvez choisir une autre langue avant de continuer.", label: "Langue", proceed: "Continuer en {language}", alternate: "Continuer en hébreu" },
    de: { title: "Sprache auswählen", description: "Englisch ist standardmäßig ausgewählt. Wähle vor dem Fortfahren eine andere Sprache, wenn du möchtest.", label: "Sprache", proceed: "Weiter auf {language}", alternate: "Auf Hebräisch fortfahren" },
    ar: { title: "اختر لغتك", description: "الإنجليزية هي اللغة المحددة افتراضيًا. يمكنك اختيار لغة أخرى قبل المتابعة.", label: "اللغة", proceed: "المتابعة باللغة {language}", alternate: "المتابعة بالعبرية" },
    zh: { title: "选择语言", description: "默认选择英语。继续前也可以选择其他语言。", label: "语言", proceed: "使用{language}继续", alternate: "使用希伯来语继续" }
  };

  let completed = false;
  try { completed = localStorage.getItem(completedKey) === "1"; } catch {}
  if (completed) return;

  const updateCopy = () => {
    const selected = select.value in copy ? select.value : "en";
    const strings = copy[selected];
    document.getElementById("languageWelcomeTitle").textContent = strings.title;
    document.getElementById("languageWelcomeDescription").textContent = strings.description;
    document.querySelector('label[for="welcomeLanguageSelect"]').textContent = strings.label;
    continueButton.textContent = strings.proceed.replace("{language}", names[selected]);
    alternateButton.textContent = strings.alternate;
    dialog.lang = selected;
    dialog.dir = ["he", "ar"].includes(selected) ? "rtl" : "ltr";
  };
  const choose = (language) => {
    try {
      localStorage.setItem(languageKey, language);
      localStorage.setItem(completedKey, "1");
    } catch {}
    window.location.reload();
  };

  select.addEventListener("change", updateCopy);
  continueButton.addEventListener("click", () => choose(select.value in copy ? select.value : "en"));
  alternateButton.addEventListener("click", () => choose(select.value === "he" ? "en" : "he"));
  dialog.addEventListener("cancel", (event) => event.preventDefault());
  updateCopy();
  dialog.showModal();
})();
