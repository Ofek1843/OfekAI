"use strict";

// This is intentionally a small deterministic classifier, not a diagnosis
// engine. It only decides whether an automated *personalized* plan should be
// withheld in a clearly current high-risk context. Historical and educational
// mentions remain available with appropriately cautious product copy.
const HISTORICAL = /\b(?:years? ago|months? ago|previously|used to|former(?:ly)?|history of|recovered|fully recovered|medically cleared|cleared|past)\b/i;
const EDUCATIONAL = /\b(?:explain|education(?:al)?|general(?:ly)?|considerations?|information|what (?:is|are)|my wife|partner|someone else)\b/i;
const CURRENT = /\b(?:i am|i['’]m|i have|i feel|currently|right now|today|yesterday|during exercise|when (?:i |training|working out))\b/i;
const AGGRESSIVE_RESTRICTION = /\b(?:aggressive|extreme|rapid|crash|starv(?:e|ing)|very low calorie|intense fat[- ]?loss|lose (?:a lot|weight fast))\b/i;
const URGENT_SYMPTOMS = /\b(?:severe chest pain|chest pain(?:\s+(?:right now|during exercise|when training))?|loss of consciousness|trouble breathing|shortness of breath|severe dizziness|almost faint|faint(?:ed|ing)?(?:\s+(?:right now|during exercise|when training))?|suicid(?:e|al)|self[- ]?harm)\b/i;
const SEVERE_ALLERGY = /\b(?:anaphyla\w*|severe allergic reaction|allergic reaction.*(?:trouble breathing|swelling|faint)|epipen.*(?:reaction|used|need))\b/i;
const PREGNANCY_MENTION = /\b(?:pregnant|pregnancy|postpartum|breastfeeding|breast-feeding|lactating)\b|בה[רי]יון|בהריון|היריון|הריון|מניקה|הנקה|אחרי לידה|לאחר לידה/i;
const PREGNANCY_REQUESTER = /\b(?:i am|i['’]m|currently)\b.{0,50}\b(?:pregnant|postpartum|breastfeeding|breast-feeding|lactating)\b|אני.{0,20}(?:בהריון|בהיריון|מניקה)|^(?:בהריון|בהיריון|מניקה)/i;
const THIRD_PERSON = /\b(?:my wife|my partner|someone else|she is|they are)\b/i;
const EATING_DISORDER = /\b(?:anorexi\w*|bulimi\w*|binge.?purge|eating disorder)\b/i;
const ACUTE_INJURY = /\b(?:fracture(?:d)?|tore|torn|rupture(?:d)?|acute injury|post[- ]?surgery|surgery yesterday|injured (?:today|yesterday))\b/i;
const ACUTE_TIME = /\b(?:today|yesterday|just|recent(?:ly)?|this week|right now)\b/i;

const COPY = Object.freeze({
  en: {
    urgent_symptoms: "This may need urgent in-person care. Please stop exercise and seek emergency help now if symptoms are severe, worsening, or include chest pain, trouble breathing, fainting, or a severe allergic reaction.",
    pregnancy: "Automated personalized plans are not available for pregnancy, postpartum or breastfeeding. Please consult an appropriately qualified clinician for an individual plan.",
    medical_review: "This situation needs individual professional review before an automated personalized plan can be provided.",
    eating_disorder: "We cannot provide an aggressive weight-loss or restrictive plan in this context. Please consider support from a qualified clinician or eating-disorder specialist.",
    acute_injury: "Automated loading advice is not available for a current acute injury or recent surgery. A qualified clinician can advise on safe return to activity.",
    caution: "This information can be discussed generally, but it is not medical advice. Consider a qualified professional for individualized guidance."
  },
  he: {
    urgent_symptoms: "ייתכן שנדרש טיפול רפואי דחוף. יש להפסיק פעילות ולפנות לעזרה דחופה אם התסמינים חמורים, מחמירים, או כוללים כאב בחזה, קוצר נשימה, עילפון או תגובה אלרגית חמורה.",
    pregnancy: "תוכנית אישית אוטומטית אינה זמינה בהיריון, לאחר לידה או בהנקה. יש לפנות לאיש או אשת מקצוע מוסמכים להתאמה אישית.",
    medical_review: "במצב הזה נדרשת בדיקה אישית של איש או אשת מקצוע מוסמכים לפני מתן תוכנית אוטומטית.",
    eating_disorder: "אין אפשרות לספק תוכנית אגרסיבית לירידה במשקל או הגבלה תזונתית בהקשר זה. מומלץ לפנות לאיש או אשת מקצוע מוסמכים או למומחה להפרעות אכילה.",
    acute_injury: "המלצת עומס אוטומטית אינה זמינה לפציעה חריפה או לאחר ניתוח. איש או אשת מקצוע מוסמכים יכולים להנחות חזרה בטוחה לפעילות.",
    caution: "אפשר לדון בנושא באופן כללי, אך זו אינה עצה רפואית. להכוונה אישית מומלץ לפנות לאיש או אשת מקצוע מוסמכים."
  }
});

function cleanSafetyText(value) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
}

function result({ category = null, status = "UNKNOWN", context = "none", action = "ALLOW", language = "en" } = {}) {
  const copy = COPY[language === "he" ? "he" : "en"];
  const restricted = action === "URGENT_SAFETY_RESPONSE" || action === "RESTRICT_PERSONALIZED_PLAN";
  return {
    allowed: !restricted,
    category,
    status,
    context,
    action,
    code: category || undefined,
    message: restricted ? copy[category] : action === "ALLOW_WITH_CAUTION" ? copy.caution : undefined
  };
}

function assessSafety({ text = "", language = "en", route = "personalized", profile = {} } = {}) {
  const normalized = cleanSafetyText(text);
  const personalized = route !== "education";
  const restrict = category => result({category,status:"CURRENT_NON_EMERGENCY",context:"current",action:"RESTRICT_PERSONALIZED_PLAN",language});
  // Historical/third-party wording only applies to its own assertion, never
  // globally to an unrelated current symptom later in the request.
  const clauses = normalized.split(/[.!?;\n]+|\bbut\b|\band (?=I (?:have|am|feel)\b)|אבל/iu).filter(Boolean);
  const activeClause = pattern => clauses.some(clause => pattern.test(clause) &&
    (!HISTORICAL.test(clause) || /\b(?:right now|today|currently)\b|עכשיו|כרגע|היום/iu.test(clause)) &&
    !/\b(?:no|not|never|without)\s+(?:any\s+)?(?:chest pain|trouble breathing|severe dizziness|fainting)\b|אין לי כאב בחזה/iu.test(clause));
  if (activeClause(URGENT_SYMPTOMS) || activeClause(SEVERE_ALLERGY) ||
      activeClause(/כאב(?:ים)? (?:חזק(?:ים)? )?בחזה|קוצר נשימה|מתעלף|התעלפתי|תגובה אלרגית חמורה/iu)) {
    return result({category:"urgent_symptoms",status:"CURRENT_HIGH_RISK",context:"current",action:"URGENT_SAFETY_RESPONSE",language});
  }
  if (personalized && String(text ?? "").length > 4000) return restrict("medical_review");
  // Urgent symptoms take priority over pregnancy or a routine review flag.
  if (personalized && ["pregnant", "pregnancy", "postpartum", "breastfeeding", "isPregnant", "isBreastfeeding"].some(key => profile[key] === true || profile[key] === "true")) return restrict("pregnancy");
  const supportedConditions = new Set(["ironDeficiencyAnemia", "b12Deficiency", "vitaminDDeficiency", "hypertension", "type2Diabetes"]);
  if (personalized && (profile.severeFoodAllergy === true || profile.eatingDisorder === true ||
      (profile.diagnosedConditions != null && !Array.isArray(profile.diagnosedConditions)) ||
      (Array.isArray(profile.diagnosedConditions) && profile.diagnosedConditions.some(c => !supportedConditions.has(c))) ||
      (profile.medications && !/^(?:none|אין|ללא)$/iu.test(String(profile.medications).trim())) ||
      activeClause(/\bsevere\b.{0,35}\ballerg(?:y|ies)\b|אלרגיה חמורה/iu))) return restrict("medical_review");
  if (!normalized) return result({ language });
  if (personalized && clauses.some(c => PREGNANCY_MENTION.test(c) &&
      !/\b(?:not pregnant|no pregnancy|not breastfeeding)\b|לא בהריון|לא בהיריון|אינני בהריון|לא מניקה/iu.test(c) &&
      (PREGNANCY_REQUESTER.test(c) || (!THIRD_PERSON.test(c) && !/^\s*(?:explain|what (?:is|are)|הסבר)/iu.test(c) && !HISTORICAL.test(c))))) return restrict("pregnancy");
  if (personalized && activeClause(/הפרעת אכילה|אנורקסיה|בולימיה|קרע|שבר|אחרי ניתוח|לאחר ניתוח/iu)) return restrict("medical_review");
  if (personalized && clauses.some(c => EATING_DISORDER.test(c) && !HISTORICAL.test(c) && (CURRENT.test(c) || AGGRESSIVE_RESTRICTION.test(c)))) return restrict("eating_disorder");
  if (personalized && clauses.some(c => ACUTE_INJURY.test(c) && !HISTORICAL.test(c) && (CURRENT.test(c) || ACUTE_TIME.test(c)))) return restrict("acute_injury");
  const historical = HISTORICAL.test(normalized);
  const educational = EDUCATIONAL.test(normalized);
  const current = CURRENT.test(normalized);

  if (PREGNANCY_MENTION.test(normalized)) {
    if (THIRD_PERSON.test(normalized)) return result({ category: "pregnancy", status: "EDUCATIONAL", context: "third_party", action: "ALLOW_WITH_CAUTION", language });
    return result({ category: "pregnancy", status: "EDUCATIONAL", context: "educational", action: "ALLOW_WITH_CAUTION", language });
  }
  if (EATING_DISORDER.test(normalized)) {
    if (historical) return result({ category: "eating_disorder", status: "HISTORICAL_RECOVERED", context: "historical", action: "ALLOW_WITH_CAUTION", language });
    if (personalized && (current || AGGRESSIVE_RESTRICTION.test(normalized))) {
      return result({ category: "eating_disorder", status: "CURRENT_NON_EMERGENCY", context: "current", action: "RESTRICT_PERSONALIZED_PLAN", language });
    }
    return result({ category: "eating_disorder", status: educational ? "EDUCATIONAL" : "UNKNOWN", context: educational ? "educational" : "unknown", action: "ALLOW_WITH_CAUTION", language });
  }
  if (ACUTE_INJURY.test(normalized)) {
    if (historical) return result({ category: "acute_injury", status: "HISTORICAL_RECOVERED", context: "historical", action: "ALLOW_WITH_CAUTION", language });
    if (personalized && (current || ACUTE_TIME.test(normalized))) {
      return result({ category: "acute_injury", status: "CURRENT_NON_EMERGENCY", context: "current", action: "RESTRICT_PERSONALIZED_PLAN", language });
    }
    return result({ category: "acute_injury", status: educational ? "EDUCATIONAL" : "UNKNOWN", context: educational ? "educational" : "unknown", action: "ALLOW_WITH_CAUTION", language });
  }
  if (/\b(?:dizz(?:y|iness)|allerg(?:y|ic)|peanut allergy)\b/i.test(normalized)) {
    return result({ status: historical ? "HISTORICAL_RECOVERED" : educational ? "EDUCATIONAL" : "CURRENT_NON_EMERGENCY", context: historical ? "historical" : educational ? "educational" : "current", action: "ALLOW_WITH_CAUTION", language });
  }
  return result({ language });
}

function safetyMessage(language = "en") {
  return COPY[language === "he" ? "he" : "en"].urgent_symptoms;
}

module.exports = { assessSafety, cleanSafetyText, safetyMessage };
