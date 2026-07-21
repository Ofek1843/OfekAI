import { t } from "./i18n.js";
import { auth, db } from "./firebase-config.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const chat = document.getElementById("chat");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const voiceInputBtn = document.getElementById("voiceInputBtn");
const voiceStatus = document.getElementById("voiceStatus");
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
let currentUserSettings = {};

const conversationsModulePromise =
  import("/js/conversations.js");

async function authHeaders(contentType = "application/json") {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required.");
  return {
    Authorization: `Bearer ${await user.getIdToken()}`,
    "Content-Type": contentType
  };
}

async function getActiveWorkoutPlan() {
  const user = auth.currentUser;

  if (!user) {
    return null;
  }

  const userSnapshot = await getDoc(
    doc(db, "users", user.uid)
  );
  const activeWorkoutPlanId = userSnapshot.exists()
    ? userSnapshot.data().activeWorkoutPlanId
    : null;

  if (
    typeof activeWorkoutPlanId !== "string" ||
    !activeWorkoutPlanId.trim()
  ) {
    return null;
  }

  const planSnapshot = await getDoc(
    doc(
      db,
      "users",
      user.uid,
      "workoutPlans",
      activeWorkoutPlanId
    )
  );

  if (!planSnapshot.exists()) {
    return null;
  }

  const savedPlan = planSnapshot.data();

  return {
    id: planSnapshot.id,
    name: savedPlan.name || "Workout Plan",
    plan: savedPlan.plan || null
  };
}

async function getActiveNutritionPlan() {
  const user = auth.currentUser;
  if (!user) return null;
  const userSnapshot = await getDoc(doc(db, "users", user.uid));
  const id = userSnapshot.exists() ? userSnapshot.data().activeNutritionPlanId : null;
  if (typeof id !== "string" || !id.trim()) return null;
  const planSnapshot = await getDoc(doc(db, "users", user.uid, "nutritionPlans", id));
  if (!planSnapshot.exists()) return null;
  const saved = planSnapshot.data();
  return { id: planSnapshot.id, name: saved.name || "Nutrition Plan", plan: saved.plan || null };
}

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

  if (voiceInputBtn && !isListening) {
    const voiceLabel = currentLang === "he" ? "הכתבה קולית" : "Voice input";
    voiceInputBtn.title = voiceLabel;
    voiceInputBtn.setAttribute("aria-label", voiceLabel);
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

  const memoryText = currentLang === "he" ? {
    trainingDays: "מספר אימונים בשבוע",
    trainingStyle: "סגנון אימון מועדף",
    none: "לא צוין",
    gym: "חדר כושר / משקולות",
    calisthenics: "סטריט וורקאוט",
    hybrid: "משולב",
    home: "אימונים בבית",
    sport: "ביצועים ספורטיביים",
    equipment: "ציוד זמין",
    favoriteFoods: "מאכלים אהובים",
    dislikedFoods: "מאכלים שלא אוהבים",
    diet: "אלרגיות או הגבלות תזונתיות",
    notes: "דברים נוספים שמאמן ה־AI צריך לזכור"
  } : {
    trainingDays: "Training days per week", trainingStyle: "Preferred training style",
    none: "Not specified", gym: "Gym / weights", calisthenics: "Calisthenics",
    hybrid: "Hybrid", home: "Home workouts", sport: "Sport performance",
    equipment: "Available equipment", favoriteFoods: "Favorite foods",
    dislikedFoods: "Foods you dislike", diet: "Allergies or dietary restrictions",
    notes: "Anything else your AI coach should remember"
  };
  [["memoryTrainingDaysLabel","trainingDays"],["memoryTrainingStyleLabel","trainingStyle"],
   ["styleNoneOption","none"],["styleGymOption","gym"],["styleCalisthenicsOption","calisthenics"],
   ["styleHybridOption","hybrid"],["styleHomeOption","home"],["styleSportOption","sport"],
   ["memoryEquipmentLabel","equipment"],["memoryFavoriteFoodsLabel","favoriteFoods"],
   ["memoryDislikedFoodsLabel","dislikedFoods"],["memoryDietLabel","diet"],["memoryNotesLabel","notes"]]
    .forEach(([id,key]) => setElementText(document.getElementById(id), memoryText[key]));

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
  const evidenceMatch = sender === "bot"
    ? String(text).match(/(?:^|\n)\s*(🟢 Strong Evidence|🟡 Moderate Evidence|🔴 Limited Evidence)\s*$/i)
    : null;
  const visibleText = evidenceMatch
    ? String(text).slice(0, evidenceMatch.index).trimEnd()
    : text;
  const div =
    document.createElement("div");

  div.className =
    `msg ${sender} ${extraClass}`.trim();

  div.style.textAlign =
    ["he", "ar"].includes(currentLang)
      ? "right"
      : "left";

  const textElement = document.createElement("div");
  textElement.className = "message-text";
  textElement.textContent = visibleText;
  div.appendChild(textElement);

  if (evidenceMatch) {
    const label = evidenceMatch[1];
    const level = label.includes("Strong")
      ? "strong"
      : label.includes("Moderate")
        ? "moderate"
        : "limited";
    const explanations = {
      strong: currentLang === "he"
        ? "ראיות חזקות: נתמכות בדרך כלל בסקירות שיטתיות, מטא־אנליזות או קונצנזוס מקצועי עקבי."
        : "Strong evidence: generally supported by systematic reviews, meta-analyses, or consistent professional consensus.",
      moderate: currentLang === "he"
        ? "ראיות בינוניות: קיימים מחקרים טובים, אך יש מגבלות או חוסר עקביות מסוים."
        : "Moderate evidence: good studies exist, with some limitations or inconsistency.",
      limited: currentLang === "he"
        ? "ראיות מוגבלות: המידע מצומצם, לא עקבי או נשען בעיקר על מחקרים מוקדמים."
        : "Limited evidence: findings are sparse, inconsistent, or mainly preliminary."
    };
    const badge = document.createElement("span");
    badge.className = `evidence-badge evidence-${level}`;
    badge.tabIndex = 0;
    badge.textContent = currentLang === "he"
      ? ({ strong: "ראיות חזקות", moderate: "ראיות בינוניות", limited: "ראיות מוגבלות" })[level]
      : label.replace(/^[^\s]+\s*/, "");
    badge.setAttribute("role", "note");
    badge.setAttribute("aria-label", explanations[level]);
    badge.dataset.tooltip = explanations[level];
    div.appendChild(badge);
  }

  if (!extraClass.includes("typing") && !extraClass.includes("welcome") && ["user", "bot"].includes(sender)) {
    const actions = document.createElement("div");
    actions.className = "message-actions";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "message-action";
    action.textContent = sender === "user"
      ? (currentLang === "he" ? "✏️ עריכה ושליחה מחדש" : "✏️ Edit & resend")
      : (currentLang === "he" ? "📋 העתקה" : "📋 Copy");
    action.addEventListener("click", async () => {
      if (sender === "user") {
        input.value = text;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        action.textContent = currentLang === "he" ? "✓ הועתק" : "✓ Copied";
        window.setTimeout(() => {
          action.textContent = currentLang === "he" ? "📋 העתקה" : "📋 Copy";
        }, 1600);
      } catch (error) {
        console.error("Could not copy message:", error);
      }
    });
    actions.appendChild(action);
    div.appendChild(actions);
  }

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
      headers: await authHeaders(),
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

    let activeWorkoutPlan = null;
    let activeNutritionPlan = null;

    try {
      activeWorkoutPlan = await getActiveWorkoutPlan();
      activeNutritionPlan = await getActiveNutritionPlan();
    } catch (activePlanError) {
      console.error(
        "Could not load the active workout plan:",
        activePlanError
      );
    }

    const response = await fetch(
      "/api/chat",
      {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          messages,
          language: currentLang,
          settings: currentUserSettings,
          activeWorkoutPlan,
          activeNutritionPlan
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

let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];
let recordingTimeout = null;
let isListening = false;
let isTranscribing = false;

function setVoiceStatus(message = "", isError = false) {
  if (!voiceStatus) return;
  voiceStatus.textContent = message;
  voiceStatus.classList.toggle("error", isError);
}

function audioToBase64(blob) {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return btoa(binary);
  });
}

async function transcribeRecording(blob) {
  isTranscribing = true;
  voiceInputBtn.disabled = true;
  setVoiceStatus(currentLang === "he" ? "מתמלל את ההקלטה..." : "Transcribing recording...");
  try {
    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        audioBase64: await audioToBase64(blob),
        mimeType: blob.type || "audio/webm",
        language: currentLang
      })
    });
    const data = await response.json();
    if (!response.ok || !data.text) throw new Error(data.error || "Transcription failed");
    input.value = [input.value.trim(), data.text.trim()].filter(Boolean).join(" ");
    setVoiceStatus(currentLang === "he" ? "התמלול נוסף להודעה." : "Transcript added to your message.");
    input.focus();
  } catch (error) {
    console.error("Audio transcription failed:", error);
    setVoiceStatus(
      currentLang === "he"
        ? "לא ניתן היה לתמלל את ההקלטה. ודא שהשרת הופעל מחדש ונסה שוב."
        : "Could not transcribe the recording. Restart the server and try again.",
      true
    );
  } finally {
    isTranscribing = false;
    voiceInputBtn.disabled = false;
  }
}

function stopRecording() {
  if (mediaRecorder?.state === "recording") mediaRecorder.stop();
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setVoiceStatus(currentLang === "he" ? "הדפדפן אינו תומך בהקלטת שמע." : "Audio recording is not supported.", true);
    return;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
    audioChunks = [];
    mediaRecorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) audioChunks.push(event.data);
    });
    mediaRecorder.addEventListener("stop", async () => {
      clearTimeout(recordingTimeout);
      isListening = false;
      voiceInputBtn.classList.remove("listening");
      voiceInputBtn.textContent = "🎤";
      mediaStream?.getTracks().forEach((track) => track.stop());
      const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      audioChunks = [];
      if (blob.size < 1000) {
        setVoiceStatus(currentLang === "he" ? "ההקלטה הייתה קצרה מדי." : "The recording was too short.", true);
        return;
      }
      await transcribeRecording(blob);
    }, { once: true });
    mediaRecorder.start(250);
    isListening = true;
    voiceInputBtn.classList.add("listening");
    voiceInputBtn.textContent = "⏹️";
    setVoiceStatus(currentLang === "he" ? "מקליט — לחץ על עצירה כשתסיים לדבר." : "Recording — click stop when you finish speaking.");
    recordingTimeout = window.setTimeout(stopRecording, 90000);
  } catch (error) {
    console.error("Microphone recording failed:", error);
    mediaStream?.getTracks().forEach((track) => track.stop());
    setVoiceStatus(
      currentLang === "he" ? "לא ניתן לגשת למיקרופון. בדוק את ההרשאה לאתר." : "Could not access the microphone. Check site permission.",
      true
    );
  }
}

voiceInputBtn?.addEventListener("click", () => {
  if (isTranscribing) return;
  if (isListening) stopRecording();
  else startRecording();
});

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

window.addEventListener("conversation-deleted", (event) => {
  if (event.detail?.conversationId === currentConversationId) resetChat({ showWelcome: true });
});

window.addEventListener("all-conversations-deleted", () => {
  resetChat({ showWelcome: true });
});

window.addEventListener(
  "ofekai:settings-loaded",
  (event) => {
      currentUserSettings = {
          ...currentUserSettings,
          ...(event.detail || {})
      };
  }
);

window.addEventListener(
  "ofekai:settings-saved",
  (event) => {
      currentUserSettings = {
          ...currentUserSettings,
          ...(event.detail || {})
      };

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
