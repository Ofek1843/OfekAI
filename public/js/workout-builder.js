import { auth, db } from "./firebase-config.js";
import { trackEvent, trackPageView } from "./analytics.js";
import { setupPlanSharing } from "./plan-sharing.js";
import { createWeeklyScheduleDays } from "./schedule-utils.js";
import { getEquipmentLabel, buildEquipmentSummaryText } from "./equipment-i18n.mjs";
import { derivePriorityFromGoal } from "./workout-priority.js";
import { exerciseImageUrl, fallbackExerciseImageUrl } from "./exercise-image.js";
import { guardProtectedPage } from "./verification-gate.js";
import { builderErrorMessage } from "./builder-errors.mjs";

// This builder has no data to load on page open (generation is entirely
// user-interaction-driven via the Generate button, which reads
// auth.currentUser at click time) -- but it DOES call an authenticated
// product API and write a saved plan once generated. guardProtectedPage
// keeps the whole page hidden (and therefore un-clickable) until the
// signed-in user's email is verified, so there is no window where an
// unverified user could open this page directly and generate/save a plan.
guardProtectedPage({});

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
const form = document.querySelector("#workout-builder-form");
const button = document.querySelector("#generate-button");
const statusElement = document.querySelector("#builder-status");
const resultElement = document.querySelector("#program-result");
const currentLanguage =
  localStorage.getItem("ofek-ai-language") || "en";
trackPageView({ page: "workout-builder" });
trackEvent("builder_open", { builder: "workout" });
async function authHeaders(contentType = "application/json") {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required.");
  return {
    Authorization: `Bearer ${await user.getIdToken()}`,
    "Content-Type": contentType
  };
}

const isHebrew = currentLanguage === "he";
const ui = isHebrew
  ? {
      pageTitle: "בונה תוכניות אימון",
      pageDescription:
        "בנה תוכנית אימונים אישית לפי המטרה, הניסיון, לוח הזמנים, הציוד והמגבלות שלך.",

      primaryGoal: "מטרה עיקרית",
      trainingExperience: "ניסיון באימונים",
      trainingDays: "מספר אימונים בשבוע",
      sessionDuration: "משך האימון בדקות",
      trainingStyle: "סגנון האימון",
      availableEquipment: "ציוד זמין",
      limitations: "פציעות או מגבלות",
      limitationsPlaceholder:
        "תאר פציעות, כאבים או מגבלות תנועה.",

      generate: "צור את התוכנית שלי",
      generating: "יוצר תוכנית...",
      generatingStatus: "יוצר את תוכנית האימונים שלך...",

      day: "יום",
      exercises: "תרגילים",
      exercise: "תרגיל",
      muscle: "שריר",
      equipment: "ציוד",
      sets: "סטים",
      reps: "חזרות",
      rest: "מנוחה",
      print: "הדפס / שמור",

      personalizedPlan: "תוכנית אישית של FuelPhysique",
      programDescription:
        "תוכנית אימונים אישית ומבוססת מחקר שנבנתה לפי המטרה, הניסיון והציוד שלך.",

      frequency: "תדירות",
      duration: "משך התוכנית",
      goal: "מטרה",
      daysPerWeek: "ימים בשבוע",
      weeks: "שבועות",

      general: "כללי",
      equipmentFallback: "ציוד",

      weeklyVolumeTitle: "נפח אימון שבועי לפי קבוצת שריר",
      weeklyVolumeSubtitle:
        "טווח מומלץ שבועי לפי הפרופיל שלך — לא יעד רפואי מדויק ואוניברסלי.",
      weeklyVolumeSets: (count) => `${count} סטים שבועיים`,
      weeklyVolumeRecommendedRange: (min, max) => `טווח מומלץ: ${min}–${max}`,
      weeklyVolumeProgrammingRange: (min, max) => `טווח התכנון: ${min}–${max}`,
      weeklyVolumeTargetRange: (min, max) => `טווח היעד: ${min}–${max}`,
      weeklyVolumeBelow: "מתחת לטווח התכנון",
      weeklyVolumeValidBelowPreferred: "מתחת לטווח היעד",
      weeklyVolumeInPreferredZone: "בתוך טווח היעד",
      weeklyVolumeValidAbovePreferred: "מעל טווח היעד",
      weeklyVolumeAbove: "מעל טווח התכנון",
      weeklyVolumeSecondary: "נפח תומך",
      weeklyVolumeNotTargeted: "לא ממוקד בתוכנית זו",
      weeklyVolumeIncomplete: "החישוב לא הושלם",
      weeklyVolumeSecondaryNote: "קבוצת שריר משנית — מוצגת למידע בלבד ואינה קובעת אם התוכנית תקינה.",
      weeklyVolumeDetails: (direct, fractional) =>
        `${direct} ישירים + ${fractional} עקיפים`,
      weeklyVolumeUnmapped: "כמה תרגילים לא נכללו בחישוב (אין מיפוי שריר ידוע).",
      weeklyVolumeStartingWeek: "נפח תחילת התוכנית (לא כולל התקדמות)"
    }
  : {
      pageTitle: "Workout Builder",
      pageDescription:
        "Build a personalized workout plan based on your goals, experience, schedule, equipment, and limitations.",

      primaryGoal: "Primary goal",
      trainingExperience: "Training experience",
      trainingDays: "Training days per week",
      sessionDuration: "Session duration in minutes",
      trainingStyle: "Training style",
      availableEquipment: "Available equipment",
      limitations: "Injuries or limitations",
      limitationsPlaceholder:
        "Describe any injuries, pain, or movement limitations.",

      generate: "Generate My Program",
      generating: "Generating...",
      generatingStatus: "Generating your workout program...",

      day: "Day",
      exercises: "exercises",
      exercise: "Exercise",
      muscle: "Muscle",
      equipment: "Equipment",
      sets: "Sets",
      reps: "Reps",
      rest: "Rest",
      print: "Print / Save",

      personalizedPlan: "FuelPhysique Personalized Plan",
      programDescription:
        "A personalized evidence-based training program built around your goal, experience and available equipment.",

      frequency: "Frequency",
      duration: "Duration",
      goal: "Goal",
      daysPerWeek: "days/week",
      weeks: "weeks",

      general: "General",
      equipmentFallback: "Equipment",

      weeklyVolumeTitle: "Weekly Muscle Volume",
      weeklyVolumeSubtitle:
        "Recommended weekly range for your profile — not a universal or medically exact optimum.",
      weeklyVolumeSets: (count) => `${count} weekly sets`,
      weeklyVolumeRecommendedRange: (min, max) => `Recommended range: ${min}–${max}`,
      weeklyVolumeProgrammingRange: (min, max) => `Programming range: ${min}–${max}`,
      weeklyVolumeTargetRange: (min, max) => `Target range: ${min}–${max}`,
      weeklyVolumeBelow: "Below programming range",
      weeklyVolumeValidBelowPreferred: "Below target range",
      weeklyVolumeInPreferredZone: "Within target range",
      weeklyVolumeValidAbovePreferred: "Above target range",
      weeklyVolumeAbove: "Above programming range",
      weeklyVolumeSecondary: "Supporting volume",
      weeklyVolumeNotTargeted: "Not targeted in this plan",
      weeklyVolumeIncomplete: "Calculation incomplete",
      weeklyVolumeSecondaryNote: "A secondary muscle group — shown for visibility only, never counted against whether this plan is valid.",
      weeklyVolumeDetails: (direct, fractional) =>
        `${direct} direct + ${fractional} indirect`,
      weeklyVolumeUnmapped: "A few exercises were not included in this calculation (no known muscle mapping).",
      weeklyVolumeStartingWeek: "Starting-week volume (progression not shown)"
    };
    function setText(selector, text) {
  const element = document.querySelector(selector);

  if (element) {
    element.textContent = text;
  }
}

function translateBuilderInterface() {
  setText("h1", ui.pageTitle);

  const description =
    document.querySelector(".builder-description") ||
    document.querySelector("header p");

  if (description) {
    description.textContent = ui.pageDescription;
  }

  setText('label[for="goal"]', ui.primaryGoal);
  setText('label[for="experience"]', ui.trainingExperience);
  setText('label[for="daysPerWeek"]', ui.trainingDays);
  setText('label[for="sessionDuration"]', ui.sessionDuration);
  setText('label[for="trainingStyle"]', ui.trainingStyle);
  setText('label[for="limitations"]', ui.limitations);

const equipmentHeading =
  document.querySelector(
    [
      ".equipment-section legend",
      ".equipment-section-title",
      "[data-equipment-title]",
      ".equipment-grid-title",
    ].join(",")
  );
  if (equipmentHeading) {
    equipmentHeading.textContent = ui.availableEquipment;
  }

  const limitationsInput =
    document.querySelector(
      '#limitations, [name="limitations"]'
    );

  if (limitationsInput) {
    limitationsInput.placeholder =
      ui.limitationsPlaceholder;
  }

  button.textContent = ui.generate;
}

translateBuilderInterface();
const hebrewOptionLabels = {
  buildMuscle: "בניית שריר",
  loseFat: "ירידה באחוזי שומן",
  increaseStrength: "שיפור כוח",
  improveSkills: "שיפור מיומנויות קליסטניקס",
  maintainPerformance: "שמירה על הביצועים",

  beginner: "מתחיל",
  intermediate: "בינוני",
  advanced: "מתקדם",

  gym: "חדר כושר",
  calisthenics: "קליסטניקס",
  hybrid: "משולב",

  hypertrophy: "בניית שריר",
  strength: "כוח",
  endurance: "סיבולת",
  skills: "מיומנויות"

  // Equipment labels are NOT listed here — they come exclusively from
  // equipment-i18n.mjs (getEquipmentLabel/buildEquipmentSummaryText), keyed
  // by canonical equipment id and gated on the active locale. That is the
  // only source of truth for equipment display text; duplicating it here
  // was the root cause of Hebrew equipment names leaking into English mode
  // (this dictionary was applied unconditionally, without checking isHebrew).
};

function normalizeOptionKey(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ");
}

function translateFormOptions() {
  if (!isHebrew) {
    return;
  }

  document.querySelectorAll("select option").forEach((option) => {
    const valueKey = normalizeOptionKey(option.value);
    const textKey = normalizeOptionKey(option.textContent);

    const translation =
      hebrewOptionLabels[option.value] ||
      hebrewOptionLabels[valueKey] ||
      hebrewOptionLabels[textKey];

    if (translation) {
      option.textContent = translation;
    }
  });

  document
    .querySelectorAll('input[type="checkbox"][name="equipment"]')
    .forEach((input) => {
      const label =
        input.closest("label") ||
        document.querySelector(`label[for="${input.id}"]`);

      if (!label) {
        return;
      }

      // Equipment checkbox values are canonical ids (bodyweight, pullupbar,
      // rings, dumbbell, barbell, machine, cable) — resolve display text
      // through the single equipment-i18n dictionary, not hebrewOptionLabels.
      const translation = getEquipmentLabel("he", input.value);

      if (!translation || translation === input.value) {
        return;
      }

      const textNode = [...label.childNodes].find(
        (node) =>
          node.nodeType === Node.TEXT_NODE &&
          node.textContent.trim()
      );

      if (textNode) {
        textNode.textContent = ` ${translation} `;
      } else {
        const textElement = label.querySelector(
          "span, strong, .equipment-name"
        );

        if (textElement) {
          textElement.textContent = translation;
        }
      }
    });
}

translateFormOptions();
document.documentElement.lang = isHebrew ? "he" : "en";
document.documentElement.dir = isHebrew ? "rtl" : "ltr";


const wizardSteps = [...document.querySelectorAll(".wizard-step")];
const wizardBackButton = document.querySelector("#wizardBackButton");
const wizardNextButton = document.querySelector("#wizardNextButton");
const wizardProgressBar = document.querySelector("#wizardProgressBar");
const wizardStepLabel = document.querySelector("#wizardStepLabel");
const wizardStepTitle = document.querySelector("#wizardStepTitle");
const wizardError = document.querySelector("#wizardError");
let wizardStepIndex = 0;

function applyBuilderLanguage() {
  document.querySelectorAll("[data-en][data-he]").forEach(element => {
    element.textContent = isHebrew ? element.dataset.he : element.dataset.en;
  });
  const limitations = document.querySelector("#limitations");
  if (limitations) limitations.placeholder = isHebrew
    ? "תאר פציעות, כאבים או מגבלות תנועה."
    : "Describe any injuries, pain, or movement limitations.";
}

// Calisthenics style implies bodyweight training is available even if the
// user never checked the Bodyweight box — the server applies the same rule
// independently (see server.js's equipmentForGeneration), so this is
// belt-and-suspenders: it keeps the payload/summary honest about what's
// actually being used, not the sole source of correctness.
//
// Deliberately NOT using the `disabled` attribute to lock the checkbox:
// disabled form controls are excluded from FormData entirely, which would
// drop "bodyweight" from the submitted equipment list and could even trip
// the wizard's own "choose at least one equipment option" check for a user
// who only wanted bodyweight training. Instead the box stays enabled and
// checked, and a "change" listener snaps it back to checked if the user
// tries to uncheck it while Calisthenics is selected.
function applyCalisthenicsImplicitBodyweight() {
  const style = document.querySelector("#trainingStyle")?.value;
  const isCalisthenics = style === "calisthenics";
  const bodyweightInput = document.querySelector('input[name="equipment"][value="bodyweight"]');
  const bodyweightCard = bodyweightInput?.closest(".visual-choice-card");
  const hint = document.querySelector("#calisthenicsBodyweightHint");

  hint?.classList.toggle("hidden", !isCalisthenics);
  bodyweightCard?.classList.toggle("is-implied", isCalisthenics);

  if (bodyweightInput && isCalisthenics) {
    bodyweightInput.checked = true;
  }
}

function preventUncheckingImpliedBodyweight() {
  const bodyweightInput = document.querySelector('input[name="equipment"][value="bodyweight"]');
  if (!bodyweightInput) return;
  bodyweightInput.addEventListener("change", () => {
    const isCalisthenics = document.querySelector("#trainingStyle")?.value === "calisthenics";
    if (isCalisthenics && !bodyweightInput.checked) {
      bodyweightInput.checked = true;
    }
  });
}

function setupVisualSelections() {
  document.querySelectorAll("[data-sync-select]").forEach(group => {
    const select = document.querySelector(`#${group.dataset.syncSelect}`);
    if (!select) return;
    group.querySelectorAll('input[type="radio"]').forEach(input => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        select.value = input.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        clearWizardError();
      });
    });
  });
  document.querySelectorAll('.visual-choice-card input[type="checkbox"]').forEach(input => {
    input.addEventListener("change", clearWizardError);
  });
  document.querySelector("#trainingStyle")?.addEventListener("change", applyCalisthenicsImplicitBodyweight);
  preventUncheckingImpliedBodyweight();
  applyCalisthenicsImplicitBodyweight();
}

function selectedAvailableDays() {
  return [...document.querySelectorAll('input[name="availableDays"]:checked')].map(input => input.value);
}

function updateAvailableDayLimit() {
  const limit = Number(document.querySelector("#daysPerWeek")?.value || 1);
  const boxes = [...document.querySelectorAll('input[name="availableDays"]')];
  while (boxes.filter(box => box.checked).length > limit) {
    boxes.filter(box => box.checked).at(-1).checked = false;
  }
  const selected = boxes.filter(box => box.checked).length;
  boxes.forEach(box => { box.disabled = !box.checked && selected >= limit; });
  const hint = document.querySelector("#availableDaysHint");
  if (hint) hint.textContent = isHebrew
    ? `בחר בדיוק ${limit} ${limit === 1 ? "יום" : "ימים"}. נבחרו ${selected}.`
    : `Choose exactly ${limit} day${limit === 1 ? "" : "s"}. ${selected} selected.`;
}

function clearWizardError() {
  if (!wizardError) return;
  wizardError.textContent = "";
  wizardError.classList.add("hidden");
}

function showWizardError(message) {
  if (!wizardError) return;
  wizardError.textContent = message;
  wizardError.classList.remove("hidden");
}

function validateWizardStep(index) {
  const key = wizardSteps[index]?.dataset.wizardStep;
  if (key === "goal" && !document.querySelector("#goal")?.value) return isHebrew ? "בחר מטרה עיקרית כדי להמשיך." : "Choose a primary goal to continue.";
  if (key === "experience" && !document.querySelector("#experience")?.value) return isHebrew ? "בחר את רמת הניסיון שלך." : "Choose your training experience.";
  if (key === "style" && !document.querySelector("#trainingStyle")?.value) return isHebrew ? "בחר סגנון אימון." : "Choose a training style.";
  if (key === "equipment" && !document.querySelector('input[name="equipment"]:checked')) return isHebrew ? "בחר לפחות אפשרות ציוד אחת." : "Choose at least one equipment option.";
  if (key === "schedule") {
    const age = Number(document.querySelector("#age")?.value);
    const duration = Number(document.querySelector("#sessionDuration")?.value);
    const days = Number(document.querySelector("#daysPerWeek")?.value);
    if (!Number.isFinite(age) || age < 10 || age > 100) return isHebrew ? "הזן גיל תקין בין 10 ל־100." : "Enter a valid age between 10 and 100.";
    if (!Number.isFinite(duration) || duration < 20 || duration > 180) return isHebrew ? "הזן משך אימון בין 20 ל־180 דקות." : "Enter a session duration between 20 and 180 minutes.";
    if (selectedAvailableDays().length !== days) return isHebrew ? `בחר בדיוק ${days} ימים זמינים.` : `Choose exactly ${days} available day${days === 1 ? "" : "s"}.`;
  }
  return "";
}

function renderWizardReview() {
  const review = document.querySelector("#wizardReview");
  if (!review) return;
  const formData = new FormData(form);
  const readable = value => document.querySelector(`option[value="${CSS.escape(String(value || ""))}"]`)?.textContent || value || "—";
  // Equipment values are canonical ids — resolve display text through the
  // active locale (currentLanguage), never unconditionally through Hebrew.
  const equipment = buildEquipmentSummaryText(currentLanguage, formData.getAll("equipment"));
  const days = formData.getAll("availableDays").join(", ");
  review.innerHTML = isHebrew
    ? `<strong>סיכום:</strong><br>מטרה: ${readable(formData.get("goal"))}<br>ניסיון: ${readable(formData.get("experience"))}<br>סגנון: ${readable(formData.get("trainingStyle"))}<br>ציוד: ${equipment}<br>אימונים: ${formData.get("daysPerWeek")} בשבוע, ${formData.get("sessionDuration")} דקות<br>ימים זמינים: ${days}`
    : `<strong>Summary:</strong><br>Goal: ${readable(formData.get("goal"))}<br>Experience: ${readable(formData.get("experience"))}<br>Style: ${readable(formData.get("trainingStyle"))}<br>Equipment: ${equipment}<br>Schedule: ${formData.get("daysPerWeek")} days/week, ${formData.get("sessionDuration")} minutes<br>Available days: ${days}`;
}

function renderWizardStep() {
  wizardSteps.forEach((step, index) => step.classList.toggle("is-active", index === wizardStepIndex));
  const step = wizardSteps[wizardStepIndex];
  const total = wizardSteps.length;
  if (wizardProgressBar) wizardProgressBar.style.width = `${((wizardStepIndex + 1) / total) * 100}%`;
  if (wizardStepLabel) wizardStepLabel.textContent = isHebrew ? `שלב ${wizardStepIndex + 1} מתוך ${total}` : `Step ${wizardStepIndex + 1} of ${total}`;
  if (wizardStepTitle) wizardStepTitle.textContent = isHebrew ? step.dataset.stepTitleHe : step.dataset.stepTitleEn;
  if (wizardBackButton) wizardBackButton.disabled = wizardStepIndex === 0;
  const isLast = wizardStepIndex === total - 1;
  wizardNextButton?.classList.toggle("hidden", isLast);
  button?.classList.toggle("hidden", !isLast);
  if (isLast) renderWizardReview();
  clearWizardError();
  step?.scrollIntoView({ behavior: "smooth", block: "start" });
}

wizardNextButton?.addEventListener("click", () => {
  const error = validateWizardStep(wizardStepIndex);
  if (error) return showWizardError(error);
  wizardStepIndex = Math.min(wizardSteps.length - 1, wizardStepIndex + 1);
  renderWizardStep();
});

wizardBackButton?.addEventListener("click", () => {
  wizardStepIndex = Math.max(0, wizardStepIndex - 1);
  renderWizardStep();
});

document.querySelector("#daysPerWeek")?.addEventListener("change", updateAvailableDayLimit);
document.querySelectorAll('input[name="availableDays"]').forEach(input => input.addEventListener("change", updateAvailableDayLimit));

applyBuilderLanguage();
setupVisualSelections();
updateAvailableDayLimit();
renderWizardStep();


const goalCardCopy = isHebrew ? {
  buildMuscle: ["בניית שריר", "הגדלת מסת השריר ופיתוח מראה שרירי"],
  loseFat: ["ירידה באחוזי שומן", "שיפור החיטוב והרכב הגוף"],
  increaseStrength: ["שיפור כוח", "הרמת משקלים גבוהים יותר ושיפור ביצועים"],
  improveSkills: ["שיפור מיומנויות קליסטניקס", "פיתוח שליטה לתרגילים כמו פלאנץ'"],
  maintainPerformance: ["שמירה על הביצועים", "שמירה על עקביות, יכולת ואתלטיות"]
} : {
  buildMuscle: ["Build muscle", "Add size and muscular development"],
  loseFat: ["Lose fat", "Improve definition and body composition"],
  increaseStrength: ["Increase strength", "Lift more and improve performance"],
  improveSkills: ["Improve calisthenics skills", "Build control for skills such as planche"],
  maintainPerformance: ["Maintain performance", "Stay consistent, capable and athletic"]
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const currentError = validateWizardStep(wizardStepIndex);
  if (currentError) {
    showWizardError(currentError);
    return;
  }

  const goalSelect = document.querySelector("#goal");
  const goalError = document.querySelector("#goalChoiceError");
  if (!goalSelect?.value) {
    if (goalError) {
      goalError.textContent = isHebrew ? "בחר מטרה עיקרית כדי להמשיך." : "Choose a primary goal to continue.";
      goalError.classList.remove("hidden");
    }
    document.querySelector("#goalChoices")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  setLoading(true);

  setStatus(
    isHebrew
      ? "יוצר את תוכנית האימונים שלך..."
      : "Generating your workout program..."
  );

  hideResult();

  const formData = new FormData(form);

  const payload = {
    goal: formData.get("goal"),
    priority: derivePriorityFromGoal(formData.get("goal")),
    experience: formData.get("experience"),
    age: Number(formData.get("age")),
    daysPerWeek: Number(formData.get("daysPerWeek")),
    sessionDuration: Number(
      formData.get("sessionDuration")
    ),
    trainingStyle: formData.get("trainingStyle"),
    equipment: formData.getAll("equipment"),
    availableDays: formData.getAll("availableDays"),
    limitations:
      formData.get("limitations")?.trim() ||
      (isHebrew ? "ללא מגבלות" : "None"),
    language: currentLanguage
  };

  try {
    const response = await fetch("/api/workout-builder", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      const mappedMessage = builderErrorMessage({
        status: response.status,
        data,
        language: currentLanguage,
        fallback: isHebrew ? "לא ניתן היה ליצור את תוכנית האימון" : "Could not generate the workout program"
      });
      const error = new Error(
        mappedMessage || data.error ||
          (
            isHebrew
              ? "לא ניתן היה ליצור את תוכנית האימונים"
              : "Could not generate the workout program"
          )
      );
      // The API already returns validation "details" in the active
      // language (server.js translates them for language:"he" requests)
      // — surface them instead of only the generic top-level message.
      error.details = Array.isArray(data.details) ? data.details : [];
      throw error;
    }

    setStatus("");

if (data.program) {
  const sessionCount = Array.isArray(data.program.sessions)
    ? data.program.sessions.length
    : Number(data.program.daysPerWeek) || 0;
  window.currentWorkoutProgram = {
    ...data.program,
    weeklyScheduleDays:
      Array.isArray(data.program.weeklyScheduleDays) &&
      data.program.weeklyScheduleDays.length === sessionCount
        ? data.program.weeklyScheduleDays
        : createWeeklyScheduleDays(sessionCount)
  };

  window.currentWeeklyVolume = data.weeklyVolume || null;

  trackEvent("workout_generated", {
    source: "ai_workout_builder"
  });

  renderProgram(data.program, data.weeklyVolume);
  return;
}
    resultElement.innerHTML = `
      <h2>
        ${
          isHebrew
            ? "החיבור ל־Workout Builder הצליח"
            : "Workout Builder Connected"
        }
      </h2>

      <p>
        ${
          isHebrew
            ? "הטופס הגיע בהצלחה לשרת."
            : "The form successfully reached the backend."
        }
      </p>
    `;
    resultElement.classList.remove("hidden");
  } catch (error) {
    console.error(
      "Workout builder request failed:",
      error
    );

    const detailLines = Array.isArray(error.details) && error.details.length > 0
      ? error.details.map((detail) => `• ${detail}`).join("\n")
      : "";
    setStatus(detailLines ? `${error.message}\n${detailLines}` : error.message, true);
  } finally {
    setLoading(false);
  }
});
function setLoading(isLoading) {
  button.disabled = isLoading;
  button.textContent = isLoading
    ? ui.generating
    : ui.generate;
}
async function saveWorkoutPlan(plan) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User is not signed in.");
  }

  const workoutPlansRef = collection(
    db,
    "users",
    user.uid,
    "workoutPlans"
  );

  return addDoc(workoutPlansRef, {
    name: plan.programName || "Workout Plan",
    active: false,
    plan: {
      ...plan,
      weeklyScheduleDays:
        Array.isArray(plan.weeklyScheduleDays) &&
        plan.weeklyScheduleDays.length ===
          (Array.isArray(plan.sessions) ? plan.sessions.length : 0)
          ? plan.weeklyScheduleDays
          : createWeeklyScheduleDays(
              Array.isArray(plan.sessions) ? plan.sessions.length : 0
            )
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}
function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
}

function hideResult() {
  resultElement.classList.add("hidden");
  resultElement.innerHTML = "";
}
const hebrewWorkoutTerms = {
  "Hypertrophy Bulk Program": "תוכנית אימונים לבניית מסת שריר",
  "Upper Body Push": "פלג גוף עליון – דחיפה",
  "Upper Body Pull": "פלג גוף עליון – משיכה",
  "Upper Body Hypertrophy": "היפרטרופיה – פלג גוף עליון",
  "Lower Body Hypertrophy": "היפרטרופיה – פלג גוף תחתון",
  "Full Body Hypertrophy": "היפרטרופיה – פול באדי",
  "Full Body": "אימון פול באדי",
  "Push Day": "אימון פוש",
  "Pull Day": "אימון פול",
  "Leg Day": "אימון רגליים",

  "Dumbbell Bench Press": "לחיצת חזה עם משקולות יד",
  "Dumbbell Shoulder Press": "לחיצת כתפיים עם משקולות יד",
  "Cable Lateral Raise": "הרחקת כתפיים בכבל",
  "Tricep Dips": "מקבילים ליד אחורית",
  "Pull-up": "מתח",
  "Pull-ups": "מתח",
  "Bodyweight Row": "חתירה במשקל גוף",
  "Bodyweight Rows": "חתירה במשקל גוף",
  "Lat Pulldown": "משיכת פולי עליון",
  "Seated Row": "חתירה בישיבה",
  "Chest Press": "לחיצת חזה",
  "Incline Chest Press": "לחיצת חזה בשיפוע",
  "Shoulder Press": "לחיצת כתפיים",
  "Lateral Raise": "הרחקת כתפיים",
  "Biceps Curl": "כפיפת מרפק",
  "Triceps Pushdown": "פשיטת מרפק בפולי",
  "Leg Press": "לחיצת רגליים",
  "Leg Extension": "פשיטת ברך",
  "Leg Curl": "כפיפת ברך",
  "Calf Raise": "עליות תאומים",
  "Push-up": "שכיבות סמיכה",
  "Dips": "מקבילים",
  "Plank": "פלאנק",

  Chest: "חזה",
  Back: "גב",
  Shoulders: "כתפיים",
  "Rear Delts": "כתפיים אחוריות",
  Traps: "טרפז",
  Biceps: "יד קדמית",
  Triceps: "יד אחורית",
  Quads: "ארבע ראשי",
  Hamstrings: "המסטרינג",
  Glutes: "ישבן",
  Calves: "תאומים",
  Core: "שרירי ליבה",

  Dumbbell: "משקולות יד",
  Dumbbells: "משקולות יד",
  Machine: "מכונה",
  Machines: "מכונות",
  Cable: "כבלים",
  Barbell: "מוט ומשקולות",
  Bodyweight: "משקל גוף",
  "Pull-up Bar": "מתח",
  "Gymnastic Rings": "טבעות",

  buildMuscle: "בניית שריר",
  loseFat: "ירידה באחוזי שומן",
  increaseStrength: "שיפור כוח",
  improveSkills: "שיפור מיומנויות",
  maintainPerformance: "שמירה על הביצועים"
};

function translateWorkoutValue(value = "") {
  const text = String(value).trim();

  if (!isHebrew || !text) {
    return text;
  }

  if (hebrewWorkoutTerms[text]) {
    return hebrewWorkoutTerms[text];
  }

  let translated = text;

  Object.entries(hebrewWorkoutTerms)
    .sort(([first], [second]) => second.length - first.length)
    .forEach(([english, hebrew]) => {
      translated = translated.replaceAll(english, hebrew);
    });

  return translated;
}
// Maps the canonical setCredits muscle keys (lib/workout-setcredits-map.js)
// to the English display label translateWorkoutValue()/hebrewWorkoutTerms
// already know how to localize. Display-only: the muscle KEY used for
// calculation always stays the canonical lowercase key from the server.
const MUSCLE_DISPLAY_NAMES = {
  chest: "Chest",
  back: "Back",
  delts: "Shoulders",
  rear_delts: "Rear Delts",
  biceps: "Biceps",
  triceps: "Triceps",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core",
  traps: "Traps"
};

// Whole numbers render without a decimal; a value only carrying fractional
// (indirect) credit renders with exactly one decimal place, never more.
function formatVolumeNumber(value) {
  const rounded = Math.round((Number(value) || 0) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function renderWeeklyVolumeSummary(weeklyVolume) {
  const perMuscle = weeklyVolume?.perMuscle || {};
  const muscles = Object.keys(perMuscle).filter((key) => MUSCLE_DISPLAY_NAMES[key]);

  if (!muscles.length) return "";

  const rows = muscles
    .map((muscleKey) => {
      const entry = perMuscle[muscleKey];
      const range = entry.targetRange;
      const total = Number(entry.total) || 0;
      const direct = Number(entry.direct) || 0;
      const fractional = Number(entry.fractional) || 0;

      // "secondary" and "not-targeted" are never below/above/preferred --
      // they're a distinct, deliberately non-alarming status: a muscle the
      // server classified as never able to gate a successful plan (see
      // lib/workout-volume-targets.js's classifyMuscleRequirement) still
      // shows its real numbers, but must not display a red/amber "Below
      // minimum" verdict implying it's mandatory when it isn't. "incomplete"
      // means the server's mapping coverage wasn't 100% for this response
      // (should only appear on stale/legacy data -- a fresh generation is
      // gated on 100% coverage before it's ever returned as successful).
      //
      // For a REQUIRED muscle, "below"/"above" mean the hard gate actually
      // failed (should never reach a successful response) -- the two
      // statuses that matter day-to-day are "valid-below-preferred" and
      // "in-preferred-zone": both are fully valid plans, but sitting at the
      // bare minimum is NOT the same quality outcome as landing in the
      // preferred zone, and must never carry the same reassuring label (see
      // the engine-quality fix this UI implements).
      const statusLabel = {
        below: ui.weeklyVolumeBelow,
        "valid-below-preferred": ui.weeklyVolumeValidBelowPreferred,
        "in-preferred-zone": ui.weeklyVolumeInPreferredZone,
        "valid-above-preferred": ui.weeklyVolumeValidAbovePreferred,
        above: ui.weeklyVolumeAbove,
        secondary: ui.weeklyVolumeSecondary,
        "not-targeted": ui.weeklyVolumeNotTargeted,
        incomplete: ui.weeklyVolumeIncomplete
      }[entry.status] || "";
      const statusClass = entry.status || "unknown";
      const secondaryNote = entry.status === "secondary" ? ui.weeklyVolumeSecondaryNote : "";

      const hasPolicy = Number.isFinite(entry.minimumEffective) && Number.isFinite(entry.hardMaximum);
      // The range bar fills to `total`'s position between 0 and
      // max(hardMaximum, total) * 1.15 -- so an above-maximum value still
      // visibly overflows the marked band instead of clipping at 100%. The
      // shaded band itself now marks the PREFERRED zone, not the whole
      // valid min/max span -- the valid span is wider than what's actually
      // being called "well-targeted".
      const barCeiling = hasPolicy ? entry.hardMaximum : (range ? range.max : Math.max(total, 1));
      const barMax = Math.max(barCeiling, total) * 1.15;
      const fillPercent = Math.min(100, Math.round((total / barMax) * 100));
      const preferredStartPercent = hasPolicy ? Math.round((entry.preferredMin / barMax) * 100) : (range ? Math.round((range.min / barMax) * 100) : 0);
      const preferredEndPercent = hasPolicy ? Math.round((entry.preferredMax / barMax) * 100) : (range ? Math.round((range.max / barMax) * 100) : 100);

      // Presented as two plain ranges instead of "Minimum effective: N".
      // "Minimum effective" reads as a biological threshold -- below it, no
      // growth -- which is not what the number means: it is the bottom of the
      // range this planner programs within. The numbers themselves are
      // unchanged, only how they are described.
      const rangeText = hasPolicy
        ? `${ui.weeklyVolumeProgrammingRange(entry.minimumEffective, entry.hardMaximum)} · ${ui.weeklyVolumeTargetRange(entry.preferredMin, entry.preferredMax)}`
        : (range ? ui.weeklyVolumeRecommendedRange(range.min, range.max) : "");

      return `
        <div class="muscle-volume-row" data-status="${statusClass}">
          <div class="muscle-volume-row-header">
            <span class="muscle-volume-name">${escapeHtml(translateWorkoutValue(MUSCLE_DISPLAY_NAMES[muscleKey]))}</span>
            <span class="muscle-volume-status muscle-volume-status--${statusClass}"${secondaryNote ? ` title="${escapeHtml(secondaryNote)}"` : ""}>${escapeHtml(statusLabel)}</span>
          </div>
          <div class="muscle-volume-numbers">
            <strong>${escapeHtml(ui.weeklyVolumeSets(formatVolumeNumber(total)))}</strong>
            ${rangeText ? `<span class="muscle-volume-range">${escapeHtml(rangeText)}</span>` : ""}
          </div>
          <div class="muscle-volume-bar" title="${escapeHtml(ui.weeklyVolumeDetails(formatVolumeNumber(direct), formatVolumeNumber(fractional)))}">
            ${(hasPolicy || range) ? `<span class="muscle-volume-bar-target" style="left:${preferredStartPercent}%;width:${Math.max(0, preferredEndPercent - preferredStartPercent)}%"></span>` : ""}
            <span class="muscle-volume-bar-fill" style="width:${fillPercent}%"></span>
          </div>
          <details class="muscle-volume-detail">
            <summary>${escapeHtml(ui.weeklyVolumeDetails(formatVolumeNumber(direct), formatVolumeNumber(fractional)))}</summary>
          </details>
        </div>
      `;
    })
    .join("");

  const unmappedNotice = Number(weeklyVolume?.unknownExercises) > 0
    ? `<p class="muscle-volume-unmapped-notice">${escapeHtml(ui.weeklyVolumeUnmapped)}</p>`
    : "";

  // qualityScore stays a non-gating internal observability signal and is
  // still read from the response, still calculated server-side and still
  // asserted by the engine tests -- it is simply no longer RENDERED.
  // "Program quality score: 93/100" reads as a precise measurement of how
  // good someone's training will be, which the number cannot support: it is
  // an average of per-muscle distance from a programming band. A saved plan
  // that carries the field keeps loading exactly as before; the field is
  // read here and deliberately not shown.
  const qualityScore = Number.isFinite(weeklyVolume?.qualityScore) ? weeklyVolume.qualityScore : null;
  const qualityScoreLine = "";
  void qualityScore;
  const startingWeekNote = `<p class="muscle-volume-starting-week-note">${escapeHtml(ui.weeklyVolumeStartingWeek)}</p>`;

  return `
    <section class="weekly-volume-summary">
      <header class="weekly-volume-header">
        <h3>${escapeHtml(ui.weeklyVolumeTitle)}</h3>
        <p>${escapeHtml(ui.weeklyVolumeSubtitle)}</p>
        ${qualityScoreLine}
        ${startingWeekNote}
      </header>
      <div class="muscle-volume-grid">
        ${rows}
      </div>
      ${unmappedNotice}
    </section>
  `;
}

function renderProgram(program, weeklyVolume) {
  const sessions = Array.isArray(program.sessions)
    ? program.sessions
    : [];

  const sessionsHtml = sessions
    .map((session, sessionIndex) => {
      const exercises = Array.isArray(session.exercises)
        ? session.exercises
        : [];

      const exerciseGroups = new Map();

      exercises.forEach((exercise, exerciseIndex) => {
          const exerciseName = translateWorkoutValue(exercise.name);
          const muscleName = translateWorkoutValue(exercise.muscleGroup || ui.general);
          const rirTitle = isHebrew
            ? "RIR — כמה חזרות נוספות נשארו לך לפני כשל. לדוגמה, RIR 2 פירושו שיכולת לבצע עוד כשתי חזרות."
            : "RIR (Reps In Reserve) — how many more reps you could complete before failure. RIR 2 means about two reps remained.";

          const cardHtml = `
            <article class="exercise-card" data-session="${sessionIndex}" data-exercise="${exerciseIndex}">
              <div class="exercise-card-media">
                <img
                  class="exercise-card-image"
                  src="${escapeHtml(exerciseImageUrl(exercise))}"
                  data-fallback-src="${escapeHtml(fallbackExerciseImageUrl())}"
                  alt="${escapeHtml(exerciseName)}"
                  loading="lazy"
                >
                <span class="exercise-card-number">${exerciseIndex + 1}</span>
                <button
                  type="button"
                  class="reroll-button"
                  title="${isHebrew ? "החלף תרגיל" : "Replace exercise"}"
                  data-session="${sessionIndex}"
                  data-exercise="${exerciseIndex}"
                >🔄</button>
                <button type="button" class="exercise-demo-button" data-exercise-demo="${escapeHtml(exercise.demoName || exercise.name)}">▶ ${isHebrew ? "הדגמה" : "Demo"}</button>
              </div>

              <div class="exercise-card-body">
                <h4 class="exercise-card-name">${escapeHtml(exerciseName)}</h4>

                <div class="exercise-card-badges">
                  <span class="muscle-badge">${escapeHtml(muscleName)}</span>
                  <span class="equipment-badge">${escapeHtml(translateWorkoutValue(exercise.equipment || ui.equipmentFallback))}</span>
                </div>

                <div class="exercise-card-stats">
                  <div class="exercise-stat">
                    <span class="exercise-stat-label">${ui.sets}</span>
                    <span class="exercise-stat-value">${escapeHtml(String(exercise.sets))}</span>
                  </div>
                  <div class="exercise-stat">
                    <span class="exercise-stat-label">${ui.reps}</span>
                    <span class="exercise-stat-value">${escapeHtml(String(exercise.reps))}</span>
                  </div>
                  <div class="exercise-stat">
                    <span class="exercise-stat-label">${ui.rest}</span>
                    <span class="exercise-stat-value">${escapeHtml(String(exercise.restSeconds))}s</span>
                  </div>
                  <div class="exercise-stat" title="${rirTitle}">
                    <span class="exercise-stat-label">RIR</span>
                    <span class="exercise-stat-value">${escapeHtml(String(exercise.rir || "—"))}</span>
                  </div>
                </div>

                ${
                  exercise.notes
                    ? `<p class="exercise-note">${escapeHtml(exercise.notes)}</p>`
                    : ""
                }
              </div>
            </article>
          `;

          const groupKey = muscleName || ui.general;
          if (!exerciseGroups.has(groupKey)) {
            exerciseGroups.set(groupKey, []);
          }
          exerciseGroups.get(groupKey).push(cardHtml);
        });

      const exerciseCards = Array.from(exerciseGroups.entries())
        .map(([muscleName, cards]) => `
          <section class="muscle-exercise-group">
            <div class="muscle-exercise-group-header">
              <span>${escapeHtml(muscleName)}</span>
              <strong>${cards.length} ${ui.exercises}</strong>
            </div>
            <div class="muscle-exercise-group-grid">
              ${cards.join("")}
            </div>
          </section>
        `)
        .join("");

      return `
        <section
          class="workout-day workout-day-${(sessionIndex % 4) + 1}"
        >
          <div class="workout-day-header">
            <div>
              <span class="day-label">
                ${ui.day} ${escapeHtml(String(session.day))}
              </span>

              <h3>
  ${escapeHtml(translateWorkoutValue(session.name))}
</h3>
            </div>

            <span class="exercise-count">
              ${exercises.length} ${ui.exercises}
            </span>
          </div>

          <div class="exercise-cards">
            ${exerciseCards}
          </div>
        </section>
      `;
    })
    .join("");

  resultElement.innerHTML = `
    <section class="program-card">
      <header class="program-header">
        <div>
          <!--
            ui.personalizedPlan already contains the brand name in both
            locales ("FuelPhysique Personalized Plan" / "תוכנית אישית של
            FuelPhysique"), so prefixing it printed the brand twice -- the
            uppercase style rendered it as "FUELPHYSIQUE FUELPHYSIQUE
            PERSONALIZED PLAN".
          -->
          <span class="program-eyebrow">
            ${ui.personalizedPlan}
          </span>

          <h2>
  ${escapeHtml(
    translateWorkoutValue(program.programName)
  )}
</h2>

          <!--
            ui.programDescription is already a complete sentence in both
            locales. The trailing literal repeated the end of the English
            sentence ("... available equipment. around your goal, experience
            and available equipment.") and, in Hebrew mode, appended untranslated
            English to a Hebrew paragraph.
          -->
          <p class="program-description">
            ${ui.programDescription}
          </p>
        </div>

<div class="program-actions">
  <button type="button" class="share-program-button" id="share-workout-button">↗ ${isHebrew ? "שיתוף" : "Share"}</button>

  <button
    type="button"
    class="save-program-button"
    id="save-workout-button"
  >
    💾 ${isHebrew ? "שמירת תוכנית" : "Save Workout"}
  </button>
</div>
      </header>

      <div class="program-summary">
        <div class="summary-item">
          <span>${ui.frequency}</span>
          <strong>
            ${escapeHtml(String(program.daysPerWeek))} ${ui.daysPerWeek}
          </strong>
        </div>

        <div class="summary-item">
          <span>${ui.duration}</span>
          <strong>
            ${escapeHtml(String(program.durationWeeks))} ${ui.weeks}
          </strong>
        </div>

        <div class="summary-item">
          <span>${ui.goal}</span>
          <strong>
  ${escapeHtml(translateWorkoutValue(program.goal))}
</strong>
        </div>
      </div>

      <div class="program-days">
        ${sessionsHtml}
      </div>

      <div id="weekly-volume-container">
        ${renderWeeklyVolumeSummary(weeklyVolume)}
      </div>
    </section>
  `;

  const saveWorkoutButton = resultElement.querySelector(
    "#save-workout-button"
  );
  setupPlanSharing(resultElement.querySelector("#share-workout-button"), { type: "workout", getPlan: () => window.currentWorkoutProgram });

  saveWorkoutButton?.addEventListener("click", async () => {
    if (!window.currentWorkoutProgram) {
      setStatus(
        isHebrew
          ? "אין תוכנית אימון לשמירה."
          : "There is no workout plan to save.",
        true
      );
      return;
    }

    saveWorkoutButton.disabled = true;
    saveWorkoutButton.textContent = isHebrew ? "שומר..." : "Saving...";

    try {
      await saveWorkoutPlan(window.currentWorkoutProgram);
      trackEvent("plan_saved", { type: "workout" });
      trackEvent("workout_saved", { source: "workout_builder" });

      saveWorkoutButton.textContent = isHebrew
        ? "✓ התוכנית נשמרה"
        : "✓ Workout Saved";
      setStatus(
        isHebrew
          ? "תוכנית האימון נשמרה בהצלחה."
          : "Workout plan saved successfully."
      );
    } catch (error) {
      console.error("Could not save workout plan:", error);

      saveWorkoutButton.disabled = false;
      saveWorkoutButton.textContent = isHebrew
        ? "💾 שמירת תוכנית"
        : "💾 Save Workout";
      setStatus(
        isHebrew
          ? "לא ניתן היה לשמור את התוכנית. ודא שאתה מחובר."
          : "Could not save the plan. Make sure you are signed in.",
        true
      );
    }
  });

  resultElement.classList.remove("hidden");

  resultElement.querySelectorAll(".exercise-card-image").forEach((image) => {
    image.addEventListener("error", () => {
      image.onerror = null;
      image.src = image.dataset.fallbackSrc;
    }, { once: true });
  });

resultElement
  .querySelectorAll(".reroll-button")
  .forEach((rerollButton) => {
    rerollButton.addEventListener("click", async () => {
      const sessionIndex = Number(
        rerollButton.dataset.session
      );

      const exerciseIndex = Number(
        rerollButton.dataset.exercise
      );

rerollButton.classList.add("is-loading");
rerollButton.disabled = true;

try {
  // Capture current form state so the reroll respects the same
  // equipment/goal/experience constraints the program was generated with.
  const formData = new FormData(form);
  const rerollPayload = {
    sessionIndex,
    exerciseIndex,
    program: window.currentWorkoutProgram,
    goal: formData.get("goal"),
    priority: derivePriorityFromGoal(formData.get("goal")),
    experience: formData.get("experience"),
    trainingStyle: formData.get("trainingStyle"),
    equipment: formData.getAll("equipment"),
    limitations: formData.get("limitations")
  };

  const response = await fetch(
    "/api/workout-builder/reroll-exercise",
    {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(rerollPayload)
    }
  );

  const data = await response.json();

  if (data.exercise) {

    window.currentWorkoutProgram.sessions[sessionIndex].exercises[exerciseIndex] =
  data.exercise;

  const card = resultElement.querySelector(
    `.exercise-card[data-session="${sessionIndex}"][data-exercise="${exerciseIndex}"]`
  );

  if (card) {
    const exerciseName = translateWorkoutValue(data.exercise.name);

    card.querySelector(".exercise-card-name").textContent = exerciseName;

    const image = card.querySelector(".exercise-card-image");
    if (image) {
      image.onerror = null;
      image.src = exerciseImageUrl(data.exercise);
      image.alt = exerciseName;
      image.addEventListener("error", () => {
        image.onerror = null;
        image.src = image.dataset.fallbackSrc;
      }, { once: true });
    }

    const demoButton = card.querySelector("[data-exercise-demo]");
    if (demoButton) {
      demoButton.dataset.exerciseDemo = data.exercise.demoName || data.exercise.name;
    }

    const badges = card.querySelectorAll(".exercise-card-badges span");
    if (badges[0]) {
      badges[0].textContent = translateWorkoutValue(data.exercise.muscleGroup || ui.general);
    }
    if (badges[1]) {
      badges[1].textContent = translateWorkoutValue(data.exercise.equipment || ui.equipmentFallback);
    }

    const stats = card.querySelectorAll(".exercise-stat-value");
    if (stats[0]) stats[0].textContent = String(data.exercise.sets);
    if (stats[1]) stats[1].textContent = String(data.exercise.reps);
    if (stats[2]) stats[2].textContent = `${data.exercise.restSeconds}s`;
    if (stats[3]) stats[3].textContent = String(data.exercise.rir || "—");

    let note = card.querySelector(".exercise-note");
    if (data.exercise.notes) {
      if (!note) {
        note = document.createElement("p");
        note.className = "exercise-note";
        card.querySelector(".exercise-card-body").appendChild(note);
      }
      note.textContent = data.exercise.notes;
    } else if (note) {
      note.remove();
    }
  }

  // The reroll changed the program's exercise mix, so the previous Weekly
  // Muscle Volume numbers are now stale — never leave the pre-reroll
  // summary displayed next to a program that no longer matches it.
  window.currentWeeklyVolume = data.weeklyVolume || null;
  const volumeContainer = resultElement.querySelector("#weekly-volume-container");
  if (volumeContainer) {
    volumeContainer.innerHTML = renderWeeklyVolumeSummary(data.weeklyVolume);
  }
}
} finally {
  rerollButton.classList.remove("is-loading");
  rerollButton.disabled = false;
}
    });
  });
  resultElement.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function initializeExerciseDemosSafely() {
  try {
    const { setupExerciseDemos } = await import("./exercise-demos.js");
    setupExerciseDemos(document);
  } catch (error) {
    console.warn(
      "Exercise demos are unavailable; the workout builder remains usable.",
      error
    );
  }
}

initializeExerciseDemosSafely();
