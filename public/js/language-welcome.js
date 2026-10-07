(() => {
  const dialog = document.getElementById("languageWelcomeDialog");
  const picker = document.getElementById("welcomeLanguagePicker");
  const selectedLabel = document.getElementById("welcomeLanguageSelected");
  const optionsList = document.getElementById("welcomeLanguageOptions");
  const options = [...(optionsList?.querySelectorAll('[role="option"][data-language]') || [])];
  const continueButton = document.getElementById("welcomeLanguageContinue");
  const alternateButton = document.getElementById("welcomeLanguageEnglish");
  const openButton = document.getElementById("openLanguageWelcome");
  if (!(dialog instanceof HTMLDialogElement) || !picker || !selectedLabel || !optionsList || !options.length || !continueButton || !alternateButton || !openButton) return;

  const completedKey = "ofek-ai-language-welcome-complete";
  const languageKey = "ofek-ai-language";
  const names = { en: "English", he: "עברית", es: "Español", fr: "Français", de: "Deutsch", ar: "العربية", zh: "中文" };
  const copy = {
    en: { title: "Choose your language", description: "English is selected by default. Choose another language before continuing if you prefer.", label: "Language", proceed: "Continue in {language}", alternate: "Choose a different language" },
    he: { title: "באיזו שפה להשתמש?", description: "אנגלית נבחרה כברירת מחדל. אפשר לבחור שפה אחרת לפני שממשיכים.", label: "שפה", proceed: "המשך בעברית", alternate: "המשך באנגלית" },
    es: { title: "Elige tu idioma", description: "El inglés está seleccionado de forma predeterminada. Puedes elegir otro idioma antes de continuar.", label: "Idioma", proceed: "Continuar en {language}", alternate: "Continuar en inglés" },
    fr: { title: "Choisissez votre langue", description: "L’anglais est sélectionné par défaut. Vous pouvez choisir une autre langue avant de continuer.", label: "Langue", proceed: "Continuer en {language}", alternate: "Continuer en anglais" },
    de: { title: "Sprache auswählen", description: "Englisch ist standardmäßig ausgewählt. Wähle vor dem Fortfahren eine andere Sprache, wenn du möchtest.", label: "Sprache", proceed: "Weiter auf {language}", alternate: "Auf Englisch fortfahren" },
    ar: { title: "اختر لغتك", description: "الإنجليزية هي اللغة المحددة افتراضيًا. يمكنك اختيار لغة أخرى قبل المتابعة.", label: "اللغة", proceed: "المتابعة باللغة {language}", alternate: "تابع بالإنجليزية" },
    zh: { title: "选择语言", description: "默认选择英语。继续前也可以选择其他语言。", label: "语言", proceed: "使用{language}继续", alternate: "使用英语继续" }
  };

  let completed = false;
  let savedLanguage = "en";
  try {
    completed = localStorage.getItem(completedKey) === "1";
    savedLanguage = localStorage.getItem(languageKey) || "en";
  } catch {}
  let selectedLanguage = savedLanguage in copy ? savedLanguage : "en";

  const closeOptions = ({ restoreFocus = false } = {}) => {
    optionsList.hidden = true;
    picker.setAttribute("aria-expanded", "false");
    if (restoreFocus) picker.focus();
  };

  const openOptions = (focusSelected = false) => {
    optionsList.hidden = false;
    picker.setAttribute("aria-expanded", "true");
    if (focusSelected) options.find((option) => option.dataset.language === selectedLanguage)?.focus();
  };

  const chooseLanguage = (language) => {
    if (!(language in copy)) return;
    selectedLanguage = language;
    selectedLabel.textContent = names[language];
    for (const option of options) option.setAttribute("aria-selected", String(option.dataset.language === language));
    closeOptions({ restoreFocus: true });
    updateCopy();
  };

  const updateCopy = () => {
    const selected = selectedLanguage in copy ? selectedLanguage : "en";
    const strings = copy[selected];
    document.getElementById("languageWelcomeTitle").textContent = strings.title;
    document.getElementById("languageWelcomeDescription").textContent = strings.description;
    document.getElementById("welcomeLanguageLabel").textContent = strings.label;
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

  picker.addEventListener("click", () => {
    if (optionsList.hidden) openOptions(true);
    else closeOptions();
  });
  options.forEach((option, index) => {
    option.addEventListener("click", () => chooseLanguage(option.dataset.language));
    option.addEventListener("keydown", (event) => {
      let nextIndex = index;
      if (event.key === "ArrowDown") nextIndex = (index + 1) % options.length;
      else if (event.key === "ArrowUp") nextIndex = (index - 1 + options.length) % options.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = options.length - 1;
      else if (event.key === "Escape") {
        event.preventDefault();
        closeOptions({ restoreFocus: true });
        return;
      } else return;
      event.preventDefault();
      options[nextIndex].focus();
    });
  });
  document.addEventListener("pointerdown", (event) => {
    if (!optionsList.hidden && event.target instanceof Element && !event.target.closest(".language-welcome__picker")) closeOptions();
  });
  openButton.addEventListener("click", () => {
    updateCopy();
    if (!dialog.open) dialog.showModal();
  });
  continueButton.addEventListener("click", () => choose(selectedLanguage));
  alternateButton.addEventListener("click", () => {
    if (selectedLanguage === "en") {
      openOptions(true);
      return;
    }
    choose("en");
  });
  dialog.addEventListener("cancel", (event) => event.preventDefault());
  updateCopy();
  if (!completed) dialog.showModal();
})();
