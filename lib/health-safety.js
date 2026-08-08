"use strict";

const SAFETY_PATTERNS = Object.freeze([
  { code: "urgent_symptoms", pattern: /chest pain|faint(?:ed|ing)?|loss of consciousness|shortness of breath|trouble breathing|severe dizziness|suicid(?:e|al)|self[- ]?harm/i },
  { code: "severe_allergy", pattern: /anaphyla|severe allergic reaction|epipen/i },
  { code: "pregnancy", pattern: /pregnan(?:t|cy)|postpartum/i },
  { code: "eating_disorder", pattern: /anorexi|bulimi|binge.?purge|eating disorder/i },
  { code: "acute_injury", pattern: /fracture|torn (?:muscle|ligament|tendon)|acute injury|post[- ]?surgery/i }
]);

function cleanSafetyText(value) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
}

function safetyMessage(language = "en") {
  return language === "he"
    ? "אי אפשר ליצור תוכנית אוטומטית על סמך מידע זה. עצרו ופנו לשירותי חירום במקרה של תסמינים דחופים, או לאיש/ת מקצוע מוסמך/ת לפני אימון או שינוי תזונתי."
    : "We can’t safely generate an automated plan from this information. Stop and seek emergency care for urgent symptoms, or speak with a qualified clinician before exercising or changing your diet.";
}

function assessSafety({ text = "", language = "en" } = {}) {
  const normalized = cleanSafetyText(text);
  const finding = SAFETY_PATTERNS.find((item) => item.pattern.test(normalized));
  if (!finding) return { allowed: true };
  return { allowed: false, code: finding.code, message: safetyMessage(language) };
}

module.exports = { SAFETY_PATTERNS, assessSafety, cleanSafetyText, safetyMessage };
