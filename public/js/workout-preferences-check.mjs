// Browser-side mirror of lib/workout-preferences-validator.js's hard-block
// rule (calisthenics skill training needs a hanging apparatus) and soft
// 7-day warning — lets the wizard catch the incompatibility at the
// equipment step instead of waiting for the server's authoritative check
// (server.js calls the real lib/workout-preferences-validator.js before
// ever calling OpenAI; this client-side copy is purely for earlier, nicer
// UX and must never be treated as the source of truth). Uses ONLY the
// canonical form values passed in — no browser locale/geo/IP.

const CAPABILITY_BY_EQUIPMENT = {
  rings: ["vertical_hang"],
  pullupbar: ["vertical_hang"]
};

function hasHangingApparatus(selectedEquipment = []) {
  return selectedEquipment.some((id) => (CAPABILITY_BY_EQUIPMENT[id] || []).includes("vertical_hang"));
}

const MESSAGES = {
  en: {
    calisthenicsNeedsHangingApparatus:
      "Calisthenics skill training usually needs bodyweight plus a pull-up bar or gymnastic rings. Add one of these, or choose Floor Skills Only.",
    sevenDaysWarning:
      "Seven hard strength sessions leave no full recovery day. The program will use fewer hard sessions and include lighter skill, mobility or recovery work.",
    addPullupbar: "Add Pull-up Bar",
    addRings: "Add Gymnastic Rings",
    chooseFloorSkillsOnly: "Choose Floor Skills Only"
  },
  he: {
    calisthenicsNeedsHangingApparatus:
      "אימון מיומנויות קליסטניקס דורש בדרך כלל משקל גוף יחד עם מתח או טבעות. הוסף אחד מהם, או בחר 'מיומנויות קרקע בלבד'.",
    sevenDaysWarning:
      "שבעה אימוני כוח קשים אינם משאירים יום התאוששות מלא. התוכנית תכלול פחות ימים קשים וימים קלים יותר של מיומנות, תנועה או התאוששות.",
    addPullupbar: "הוסף מתח",
    addRings: "הוסף טבעות",
    chooseFloorSkillsOnly: "בחר מיומנויות קרקע בלבד"
  }
};

function isSkillsGoal(goal) {
  return String(goal || "").trim() === "improveSkills";
}

function isCalisthenicsStyle(trainingStyle) {
  return String(trainingStyle || "").trim().toLowerCase() === "calisthenics";
}

export function checkWorkoutPreferences({ goal, trainingStyle, equipment = [], daysPerWeek, floorSkillsOnly = false, language = "en" }) {
  const t = language === "he" ? MESSAGES.he : MESSAGES.en;
  const errors = [];
  const warnings = [];
  const suggestedChanges = [];

  const needsHangingSkillWork = isSkillsGoal(goal) || isCalisthenicsStyle(trainingStyle);
  if (needsHangingSkillWork && !floorSkillsOnly && !hasHangingApparatus(equipment)) {
    errors.push(t.calisthenicsNeedsHangingApparatus);
    suggestedChanges.push(
      { action: "add_equipment", value: "pullupbar", label: t.addPullupbar },
      { action: "add_equipment", value: "rings", label: t.addRings },
      { action: "set_field", field: "floorSkillsOnly", value: true, label: t.chooseFloorSkillsOnly }
    );
  }

  const parsedDays = Number(daysPerWeek);
  if (Number.isFinite(parsedDays) && parsedDays >= 7 && !isCalisthenicsStyle(trainingStyle)) {
    warnings.push(t.sevenDaysWarning);
  }

  return { valid: errors.length === 0, errors, warnings, suggestedChanges };
}
