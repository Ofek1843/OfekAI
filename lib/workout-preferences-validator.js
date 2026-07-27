// Deterministic wizard preflight compatibility layer (Phase 2).
//
// Runs BEFORE calling OpenAI — catches genuinely incompatible combinations
// (e.g. calisthenics skill training with no hanging apparatus and no
// Floor-Skills-Only opt-out) as a 400, instead of spending an AI call only
// to fail validation afterward. Soft, non-blocking concerns (like 7
// training days/week) are surfaced as warnings, never a hard failure.
//
// Uses ONLY canonical form values (goal/trainingStyle enum values,
// canonical equipment ids) and the caller-supplied language — never
// browser locale, IP or geography.

const { hasCapability } = require("./workout-capabilities");

const MESSAGES = {
  en: {
    calisthenicsNeedsHangingApparatus:
      "Calisthenics skill training usually needs bodyweight plus a pull-up bar or gymnastic rings. Add one of these, or choose Floor Skills Only.",
    sevenDaysWarning:
      "Seven hard strength sessions leave no full recovery day. The program will use fewer hard sessions and include lighter skill, mobility or recovery work.",
    addPullupbar: "Add Pull-up Bar",
    addRings: "Add Gymnastic Rings",
    chooseFloorSkillsOnly: "Choose Floor Skills Only",
    changeTrainingStyle: "Change training style"
  },
  he: {
    calisthenicsNeedsHangingApparatus:
      "אימון מיומנויות קליסטניקס דורש בדרך כלל משקל גוף יחד עם מתח או טבעות. הוסף אחד מהם, או בחר 'מיומנויות קרקע בלבד'.",
    sevenDaysWarning:
      "שבעה אימוני כוח קשים אינם משאירים יום התאוששות מלא. התוכנית תכלול פחות ימים קשים וימים קלים יותר של מיומנות, תנועה או התאוששות.",
    addPullupbar: "הוסף מתח",
    addRings: "הוסף טבעות",
    chooseFloorSkillsOnly: "בחר מיומנויות קרקע בלבד",
    changeTrainingStyle: "שנה סגנון אימון"
  }
};

function messagesFor(language) {
  return language === "he" ? MESSAGES.he : MESSAGES.en;
}

// Skill-goal detection uses the canonical select value, never free text —
// "improveSkills" is the <option value> the wizard already emits.
function isSkillsGoal(goal) {
  return String(goal || "").trim() === "improveSkills";
}

function isCalisthenicsStyle(trainingStyle) {
  return String(trainingStyle || "").trim().toLowerCase() === "calisthenics";
}

function validateWorkoutPreferences(input = {}) {
  const {
    goal,
    trainingStyle,
    equipment = [],
    daysPerWeek,
    floorSkillsOnly = false,
    language = "en"
  } = input;

  const t = messagesFor(language);
  const errors = [];
  const warnings = [];
  const fieldErrors = { equipment: [] };
  const suggestedChanges = [];

  const needsHangingSkillWork = isSkillsGoal(goal) || isCalisthenicsStyle(trainingStyle);

  if (needsHangingSkillWork && !floorSkillsOnly) {
    const hasHangingApparatus = hasCapability(equipment, "vertical_hang");

    if (!hasHangingApparatus) {
      const message = t.calisthenicsNeedsHangingApparatus;
      errors.push(message);
      fieldErrors.equipment.push(message);
      suggestedChanges.push(
        { action: "add_equipment", value: "pullupbar", label: t.addPullupbar },
        { action: "add_equipment", value: "rings", label: t.addRings },
        { action: "set_field", field: "floorSkillsOnly", value: true, label: t.chooseFloorSkillsOnly },
        { action: "change_field", field: "trainingStyle", label: t.changeTrainingStyle }
      );
    }
  }

  const parsedDays = Number(daysPerWeek);
  if (Number.isFinite(parsedDays) && parsedDays >= 7 && !isCalisthenicsStyle(trainingStyle)) {
    warnings.push(t.sevenDaysWarning);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fieldErrors,
    suggestedChanges
  };
}

module.exports = { validateWorkoutPreferences, isSkillsGoal, isCalisthenicsStyle };
