import { auth, db } from "./firebase-config.js";
import { setupExerciseDemos } from "./exercise-demos.js";
import { trackEvent, trackPageView } from "./analytics.js";
import { setupPlanSharing } from "./plan-sharing.js";
import { createWeeklyScheduleDays } from "./schedule-utils.js";

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
      trainingPriority: "דגש מרכזי באימון",
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
      equipmentFallback: "ציוד"
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
      trainingPriority: "Training priority",
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
      equipmentFallback: "Equipment"
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
  setText('label[for="priority"]', ui.trainingPriority);
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
  skills: "מיומנויות",

  bodyweight: "משקל גוף",
  "pull-up bar": "מתח",
  pullupbar: "מתח",
  dumbbells: "משקולות יד",
  dumbbell: "משקולות יד",
  "gymnastic rings": "טבעות",
  rings: "טבעות",
  machines: "מכונות",
  machine: "מכונות",
  barbell: "מוט ומשקולות",
  cable: "כבלים"
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

      const valueKey = normalizeOptionKey(input.value);

      const translation =
        hebrewOptionLabels[input.value] ||
        hebrewOptionLabels[valueKey];

      if (!translation) {
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
  if (key === "priority" && !document.querySelector("#priority")?.value) return isHebrew ? "בחר דגש מרכזי לאימון." : "Choose a training priority.";
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
  const equipment = formData.getAll("equipment").map(value => hebrewOptionLabels[normalizeOptionKey(value)] || value).join(", ");
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
    experience: formData.get("experience"),
    age: Number(formData.get("age")),
    daysPerWeek: Number(formData.get("daysPerWeek")),
    sessionDuration: Number(
      formData.get("sessionDuration")
    ),
    trainingStyle: formData.get("trainingStyle"),
    equipment: formData.getAll("equipment"),
    availableDays: formData.getAll("availableDays"),
    priority: formData.get("priority"),
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
      throw new Error(
        data.error ||
          (
            isHebrew
              ? "לא ניתן היה ליצור את תוכנית האימונים"
              : "Could not generate the workout program"
          )
      );
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

  trackEvent("workout_generated", {
    source: "ai_workout_builder"
  });

  renderProgram(data.program);
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

    setStatus(error.message, true);
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
function renderProgram(program) {
  const sessions = Array.isArray(program.sessions)
    ? program.sessions
    : [];

  const sessionsHtml = sessions
    .map((session, sessionIndex) => {
      const exercises = Array.isArray(session.exercises)
        ? session.exercises
        : [];

      const exerciseRows = exercises
        .map((exercise, exerciseIndex) => {
          return `
            <tr data-session="${sessionIndex}" data-exercise="${exerciseIndex}">
              <td class="exercise-number" data-label="#">
                ${exerciseIndex + 1}
              </td>

              <td class="exercise-name-cell" data-label="${ui.exercise}">
<strong>
  ${escapeHtml(translateWorkoutValue(exercise.name))}
</strong>
                <button type="button" class="exercise-demo-button" data-exercise-demo="${escapeHtml(exercise.demoName || exercise.name)}">▶ Demo</button>
                ${
                  exercise.notes
                    ? `
                      <span class="exercise-note">
                        ${escapeHtml(exercise.notes)}
                      </span>
                    `
                    : ""
                }
              </td>

              <td data-label="${ui.muscle}">
                <span class="muscle-badge">
                  ${escapeHtml(
  translateWorkoutValue(
    exercise.muscleGroup || ui.general
  )
)}
                </span>
              </td>

              <td data-label="${ui.equipment}">
                <span class="equipment-badge">
                  ${escapeHtml(
  translateWorkoutValue(
    exercise.equipment || ui.equipmentFallback
  )
)}
                </span>
              </td>

              <td class="workout-value" data-label="${ui.sets}">
                ${escapeHtml(String(exercise.sets))}
              </td>

              <td class="workout-value" data-label="${ui.reps}">
                ${escapeHtml(String(exercise.reps))}
              </td>

              <td class="workout-value" data-label="${ui.rest}">
                ${escapeHtml(String(exercise.restSeconds))}s
              </td>

<td
  class="workout-value"
  data-label="RIR"
  title="${isHebrew ? "RIR — כמה חזרות נוספות נשארו לך לפני כשל. לדוגמה, RIR 2 פירושו שיכולת לבצע עוד כשתי חזרות." : "RIR (Reps In Reserve) — how many more reps you could complete before failure. RIR 2 means about two reps remained."}"
>
  ${escapeHtml(String(exercise.rir || "—"))}
</td>

<td class="workout-value reroll-cell" data-label="${isHebrew ? "החלפה" : "Replace"}">
<button
  type="button"
  class="reroll-button"
  title="Replace exercise"
  data-session="${sessionIndex}"
  data-exercise="${exerciseIndex}"
>
  🔄
</button>
</td>
</tr>          `;
        })
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

          <div class="workout-table-wrapper">
            <table class="workout-table">
              <thead>
                <tr>
<th>#</th>
<th>${ui.exercise}</th>
<th>${ui.muscle}</th>
<th>${ui.equipment}</th>
<th>${ui.sets}</th>
<th>${ui.reps}</th>
<th>${ui.rest}</th>
<th>
  <span
    class="intensity-help"
    tabindex="0"
    title="${isHebrew ? "RIR — מספר החזרות שנותרו לפני כשל. RIR 0 = כשל; RIR 2 = נשארו בערך שתי חזרות." : "RIR (Reps In Reserve) — reps left before failure. RIR 0 = failure; RIR 2 = about two reps left."}"
  >RIR <span aria-hidden="true">ⓘ</span></span>
</th>
<th class="reroll-column"></th>
              </tr>
              </thead>

              <tbody>
                ${exerciseRows}
              </tbody>
            </table>
          </div>
        </section>
      `;
    })
    .join("");

  resultElement.innerHTML = `
    <section class="program-card">
      <header class="program-header">
        <div>
          <span class="program-eyebrow">
            FuelPhysique ${ui.personalizedPlan}
          </span>

          <h2>
  ${escapeHtml(
    translateWorkoutValue(program.programName)
  )}
</h2>

          <p class="program-description">
            ${ui.programDescription}
            around your goal, experience and available equipment.
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
  const response = await fetch(
    "/api/workout-builder/reroll-exercise",
    {
      method: "POST",
      headers: await authHeaders(),
body: JSON.stringify({
  sessionIndex,
  exerciseIndex,
program: window.currentWorkoutProgram
})
    }
  );

  const data = await response.json();

  if (data.exercise) {

    window.currentWorkoutProgram.sessions[sessionIndex].exercises[exerciseIndex] =
  data.exercise;

  const row = resultElement.querySelector(
    `tr[data-session="${sessionIndex}"][data-exercise="${exerciseIndex}"]`
  );

  if (row) {
    row.querySelector(".exercise-name-cell strong").textContent =
      translateWorkoutValue(data.exercise.name);

    const demoButton = row.querySelector("[data-exercise-demo]");
    if (demoButton) {
      demoButton.dataset.exerciseDemo = data.exercise.demoName || data.exercise.name;
    }

    const note = row.querySelector(".exercise-note");

    if (note) {
      note.textContent = data.exercise.notes || "";
    }
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

setupExerciseDemos(document);
