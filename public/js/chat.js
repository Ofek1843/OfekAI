import { t } from "./i18n.js";

const chat = document.getElementById("chat");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const subtitle = document.getElementById("subtitle");

const settingsBtn =
  document.getElementById("settingsBtn");

const settingsTitle =
  document.getElementById("settingsTitle");

const newSessionBtn =
  document.getElementById("newSessionBtn");

const conversationHistoryTitle =
  document.getElementById(
    "conversationHistoryTitle"
  );

const conversationHistoryDescription =
  document.getElementById(
    "conversationHistoryDescription"
  );

const profileTab =
  document.getElementById("profileTab");

const athleteCoreTab =
  document.getElementById("athleteCoreTab");

const aiPreferencesTab =
  document.getElementById("aiPreferencesTab");

const languageTab =
  document.getElementById("languageTab");

const appearanceTab =
  document.getElementById("appearanceTab");

const profileTitle =
  document.getElementById("profileTitle");

const athleteCoreTitle =
  document.getElementById("athleteCoreTitle");

const aiPreferencesTitle =
  document.getElementById("aiPreferencesTitle");

const languageTitle =
  document.getElementById("languageTitle");

const appearanceTitle =
  document.getElementById("appearanceTitle");

const cancelSettingsBtn =
  document.getElementById(
    "cancelSettingsBtn"
  );

const saveSettingsBtn =
  document.getElementById(
    "saveSettingsBtn"
  );

const messages = [];

let currentLang = "en";
let currentConversationId = null;
let isLoadingConversation = false;

const conversationsModulePromise =
  import("/js/conversations.js");

function isHebrew(text) {
  return /[\u0590-\u05FF]/.test(text);
}

function setElementText(element, value) {
  if (!element) {
    return;
  }

  element.textContent = value;
}

function updateWelcomeMessage() {
  const welcomeMessage =
    chat.querySelector(".welcome");

  if (!welcomeMessage) {
    return;
  }

  welcomeMessage.textContent =
    t(currentLang, "welcome");

  welcomeMessage.style.textAlign =
    ["he", "ar"].includes(currentLang)
      ? "right"
      : "left";
}

function setLanguage(lang) {
  const supportedLanguages = [
    "en",
    "he",
    "es",
    "fr",
    "de",
    "ar",
    "zh"
  ];

  currentLang = supportedLanguages.includes(lang)
    ? lang
    : "en";

  const rtlLanguages = ["he", "ar"];

  document.documentElement.lang = currentLang;
  document.documentElement.dir = rtlLanguages.includes(currentLang)
    ? "rtl"
    : "ltr";

  setElementText(subtitle, t(currentLang, "subtitle"));
  setElementText(clearBtn, t(currentLang, "clearChat"));
  setElementText(sendBtn, t(currentLang, "send"));
  setElementText(settingsBtn, `⚙️ ${t(currentLang, "settings")}`);
  setElementText(settingsTitle, t(currentLang, "settings"));

  setElementText(newSessionBtn, t(currentLang, "newSession"));
  setElementText(
    conversationHistoryTitle,
    t(currentLang, "conversationHistory")
  );
  setElementText(
    conversationHistoryDescription,
    t(currentLang, "conversationHistoryDescription")
  );

  setElementText(profileTab, t(currentLang, "profile"));
  setElementText(athleteCoreTab, t(currentLang, "athleteCore"));
  setElementText(aiPreferencesTab, t(currentLang, "aiPreferences"));
  setElementText(languageTab, t(currentLang, "language"));
  setElementText(appearanceTab, t(currentLang, "appearance"));

  setElementText(profileTitle, t(currentLang, "profile"));
  setElementText(athleteCoreTitle, t(currentLang, "athleteCore"));
  setElementText(aiPreferencesTitle, t(currentLang, "aiPreferences"));
  setElementText(languageTitle, t(currentLang, "language"));
  setElementText(appearanceTitle, t(currentLang, "appearance"));

  setElementText(cancelSettingsBtn, t(currentLang, "cancel"));
  setElementText(saveSettingsBtn, t(currentLang, "saveChanges"));

  if (input) {
    input.placeholder = t(currentLang, "writeMessage");
  }

  // ===== Profile =====
  setElementText(
    document.getElementById("profileDescription"),
    t(currentLang, "profileDescription")
  );
  setElementText(
    document.getElementById("fullNameLabel"),
    t(currentLang, "fullName")
  );
  setElementText(
    document.getElementById("emailLabel"),
    t(currentLang, "email")
  );

  // ===== Athlete Core =====
  setElementText(
    document.getElementById("athleteCoreDescription"),
    t(currentLang, "athleteCoreDescription")
  );
  setElementText(
    document.getElementById("ageLabel"),
    t(currentLang, "age")
  );
  setElementText(
    document.getElementById("bodyWeightLabel"),
    t(currentLang, "bodyWeight")
  );
  setElementText(
    document.getElementById("heightLabel"),
    t(currentLang, "height")
  );
  setElementText(
    document.getElementById("trainingExperienceLabel"),
    t(currentLang, "trainingExperience")
  );

  setElementText(
    document.getElementById("experienceBeginnerOption"),
    t(currentLang, "beginner")
  );
  setElementText(
    document.getElementById("experienceIntermediateOption"),
    t(currentLang, "intermediate")
  );
  setElementText(
    document.getElementById("experienceAdvancedOption"),
    t(currentLang, "advanced")
  );

  setElementText(
    document.getElementById("primaryGoalLabel"),
    t(currentLang, "primaryGoal")
  );
  setElementText(
    document.getElementById("goalMuscleGainOption"),
    t(currentLang, "buildMuscle")
  );
  setElementText(
    document.getElementById("goalFatLossOption"),
    t(currentLang, "loseFat")
  );
  setElementText(
    document.getElementById("goalStrengthOption"),
    t(currentLang, "increaseStrength")
  );
  setElementText(
    document.getElementById("goalSkillsOption"),
    t(currentLang, "improveSkills")
  );
  setElementText(
    document.getElementById("goalMaintenanceOption"),
    t(currentLang, "maintainPerformance")
  );

  setElementText(
    document.getElementById("limitationsLabel"),
    t(currentLang, "limitations")
  );

  const limitations = document.getElementById("settingsLimitations");
  if (limitations) {
    limitations.placeholder = t(
      currentLang,
      "limitationsPlaceholder"
    );
  }

  // ===== AI Preferences =====
  setElementText(
    document.getElementById("aiPreferencesDescription"),
    t(currentLang, "aiPreferencesDescription")
  );

  setElementText(
    document.getElementById("responseDepthLabel"),
    t(currentLang, "responseDepth")
  );
  setElementText(
    document.getElementById("responseConciseOption"),
    t(currentLang, "concise")
  );
  setElementText(
    document.getElementById("responseBalancedOption"),
    t(currentLang, "balanced")
  );
  setElementText(
    document.getElementById("responseDetailedOption"),
    t(currentLang, "detailed")
  );

  setElementText(
    document.getElementById("coachingStyleLabel"),
    t(currentLang, "coachingStyle")
  );
  setElementText(
    document.getElementById("coachingDirectOption"),
    t(currentLang, "direct")
  );
  setElementText(
    document.getElementById("coachingSupportiveOption"),
    t(currentLang, "supportive")
  );
  setElementText(
    document.getElementById("coachingTechnicalOption"),
    t(currentLang, "technical")
  );

  setElementText(
    document.getElementById("useAthleteCoreLabel"),
    t(currentLang, "useAthleteCore")
  );
  setElementText(
    document.getElementById("evidenceBasedLabel"),
    t(currentLang, "evidenceBased")
  );

  // ===== Language =====
  setElementText(
    document.getElementById("languageDescription"),
    t(currentLang, "languageDescription")
  );
  setElementText(
    document.getElementById("defaultLanguageLabel"),
    t(currentLang, "defaultLanguage")
  );

  // ===== Appearance =====
  setElementText(
    document.getElementById("appearanceDescription"),
    t(currentLang, "appearanceDescription")
  );
  setElementText(
    document.getElementById("themeLabel"),
    t(currentLang, "theme")
  );

  setElementText(
    document.getElementById("themeSystemOption"),
    t(currentLang, "systemTheme")
  );
  setElementText(
    document.getElementById("themeDarkOption"),
    t(currentLang, "darkTheme")
  );
  setElementText(
    document.getElementById("themeLightOption"),
    t(currentLang, "lightTheme")
  );

  updateWelcomeMessage();

  localStorage.setItem(
    "ofek-ai-language",
    currentLang
  );
}
function addMessage(
  text,
  sender = "bot",
  extraClass = ""
) {
  const div =
    document.createElement("div");

  div.className =
    `msg ${sender} ${extraClass}`.trim();

  div.style.textAlign =
    ["he", "ar"].includes(currentLang)
      ? "right"
      : "left";

  div.textContent = text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;

  return div;
}

function addWelcomeMessage(
  lang = currentLang
) {
  addMessage(
    t(lang, "welcome"),
    "bot",
    "welcome"
  );
}

function resetChat({
  showWelcome = true
} = {}) {
  chat.innerHTML = "";
  messages.length = 0;
  currentConversationId = null;

  if (showWelcome) {
    addWelcomeMessage(currentLang);
  }

  input.value = "";
  input.focus();
}

function clearChat() {
  resetChat({
    showWelcome: true
  });

  document
    .querySelectorAll(
      ".session-trail-item"
    )
    .forEach((item) => {
      item.classList.remove("active");
    });
}

function normalizeStoredMessage(message) {
  return {
    role:
      message.role ||
      message.sender ||
      message.type ||
      "assistant",

    content:
      message.content ||
      message.text ||
      message.message ||
      ""
  };
}

function getMessageTimestamp(message) {
  const value =
    message.createdAt ||
    message.timestamp ||
    message.sentAt ||
    null;

  if (!value) {
    return 0;
  }

  if (
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  if (value.seconds) {
    return value.seconds * 1000;
  }

  const parsedDate =
    new Date(value).getTime();

  return Number.isNaN(parsedDate)
    ? 0
    : parsedDate;
}

function createFallbackTitle(text) {
  const cleanText =
    String(text || "")
      .replace(/\s+/g, " ")
      .trim();

  if (!cleanText) {
    return t(
      currentLang,
      "newConversation"
    );
  }

  return cleanText.length > 45
    ? `${cleanText.slice(0, 45)}...`
    : cleanText;
}

async function generateConversationTitle(
  message
) {
  const response = await fetch(
    "/api/generate-title",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        message
      })
    }
  );

  const data = await response.json();

if (!response.ok || !data.title) {
  throw new Error(
    data?.error?.message ||
      "Could not generate conversation title."
  );
}

return data.title;
}

async function loadConversation(
  conversationId
) {
  if (
    !conversationId ||
    isLoadingConversation
  ) {
    return;
  }

  isLoadingConversation = true;
  sendBtn.disabled = true;
  input.disabled = true;

  chat.innerHTML = "";

  const loadingMessage = addMessage(
    t(
      currentLang,
      "loadingConversation"
    ),
    "bot",
    "typing"
  );

  try {
    const {
      getConversationMessages
    } = await conversationsModulePromise;

    const storedMessages =
      await getConversationMessages(
        conversationId
      );

    loadingMessage.remove();
    chat.innerHTML = "";
    messages.length = 0;

    const sortedMessages = [
      ...storedMessages
    ].sort(
      (a, b) =>
        getMessageTimestamp(a) -
        getMessageTimestamp(b)
    );

    if (!sortedMessages.length) {
      addWelcomeMessage(currentLang);
    }

    sortedMessages.forEach(
      (storedMessage) => {
        const normalizedMessage =
          normalizeStoredMessage(
            storedMessage
          );

        if (
          !normalizedMessage.content
        ) {
          return;
        }

        const role =
          normalizedMessage.role ===
          "user"
            ? "user"
            : "assistant";

        messages.push({
          role,
          content:
            normalizedMessage.content
        });

        addMessage(
          normalizedMessage.content,
          role === "user"
            ? "user"
            : "bot"
        );
      }
    );

    currentConversationId =
      conversationId;
  } catch (error) {
    if (
      loadingMessage.isConnected
    ) {
      loadingMessage.remove();
    }

    console.error(
      "Failed to load conversation:",
      error
    );

    chat.innerHTML = "";

    addMessage(
      currentLang === "he"
        ? `לא ניתן היה לטעון את השיחה.\n\n${error.message}`
        : `Could not load the conversation.\n\n${error.message}`,
      "system"
    );
  } finally {
    isLoadingConversation = false;
    sendBtn.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

async function sendMessage() {
  const text = input.value.trim();

  if (
    !text ||
    sendBtn.disabled ||
    isLoadingConversation
  ) {
    return;
  }

  addMessage(text, "user");

  messages.push({
    role: "user",
    content: text
  });

  input.value = "";
  sendBtn.disabled = true;

  const loadingMessage = addMessage(
    t(currentLang, "thinking"),
    "bot",
    "typing"
  );

  try {
    const {
      createConversation,
      saveMessage,
      updateConversationTitle
    } = await conversationsModulePromise;

    const isNewConversation =
      !currentConversationId;

    if (isNewConversation) {
      currentConversationId =
        await createConversation({
          title: t(
            currentLang,
            "newConversation"
          ),
          category: "general"
        });
    }

    await saveMessage({
      conversationId:
        currentConversationId,
      role: "user",
      content: text
    });

    if (isNewConversation) {
      try {
        const generatedTitle =
          await generateConversationTitle(
            text
          );

        await updateConversationTitle({
          conversationId:
            currentConversationId,
          title: generatedTitle
        });

        window.dispatchEvent(
          new Event(
            "conversation-updated"
          )
        );
      } catch (titleError) {
        console.error(
          "Title generation failed:",
          titleError
        );

        try {
          await updateConversationTitle({
            conversationId:
              currentConversationId,
            title:
              createFallbackTitle(text)
          });

          window.dispatchEvent(
            new Event(
              "conversation-updated"
            )
          );
        } catch (fallbackError) {
          console.error(
            "Fallback title update failed:",
            fallbackError
          );
        }
      }
    }

    const response = await fetch(
      "/api/chat",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          messages,
          language: currentLang
        })
      }
    );

    const data =
      await response.json();

    if (
      loadingMessage.isConnected
    ) {
      loadingMessage.remove();
    }

    const reply =
      data.reply ||
      (
        currentLang === "he"
          ? "לא התקבלה תשובה."
          : "No response received."
      );

    if (!response.ok) {
      const details = data?.error
        ? `\n\n${
            currentLang === "he"
              ? "פרטי שגיאה:\n"
              : "Error details:\n"
          }${JSON.stringify(
            data.error,
            null,
            2
          )}`
        : "";

      addMessage(
        reply + details,
        "system"
      );
      return;
    }

    addMessage(reply, "bot");

    messages.push({
      role: "assistant",
      content: reply
    });

    await saveMessage({
      conversationId: currentConversationId,
      role: "assistant",
      content: reply
    });

          window.dispatchEvent(
        new Event("conversation-updated")
      );
  } catch (error) {
    if (loadingMessage.isConnected) {
      loadingMessage.remove();
    }

    console.error(
      "Chat or Firestore error:",
      error
    );

    addMessage(
      currentLang === "he"
        ? `אירעה שגיאה בשליחת או בשמירת ההודעה.\n\n${error.message}`
        : `An error occurred while sending or saving the message.\n\n${error.message}`,
      "system"
    );
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

sendBtn.addEventListener(
  "click",
  sendMessage
);

clearBtn.addEventListener(
  "click",
  clearChat
);

input.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  }
);

window.addEventListener(
  "conversation-selected",
  (event) => {
    loadConversation(
      event.detail?.conversationId
    );
  }
);

window.addEventListener(
  "new-session-requested",
  () => {
    resetChat({
      showWelcome: true
    });
  }
);

window.addEventListener(
  "ofekai:settings-saved",
  (event) => {
    const language =
      event.detail?.language;

    if (language) {
      setLanguage(language);
    }
  }
);

const savedLanguage =
  localStorage.getItem(
    "ofek-ai-language"
  ) || "en";

setLanguage(savedLanguage);
addWelcomeMessage(savedLanguage);