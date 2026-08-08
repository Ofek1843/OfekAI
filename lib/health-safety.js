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
const PREGNANCY_MENTION = /\b(?:pregnant|pregnancy|postpartum)\b/i;
const PREGNANCY_REQUESTER = /\b(?:i am|i['’]m|currently)\s+(?:pregnant|postpartum)\b/i;
const THIRD_PERSON = /\b(?:my wife|my partner|someone else|she is|they are)\b/i;
const EATING_DISORDER = /\b(?:anorexi\w*|bulimi\w*|binge.?purge|eating disorder)\b/i;
const ACUTE_INJURY = /\b(?:fracture(?:d)?|tore|torn|rupture(?:d)?|acute injury|post[- ]?surgery|surgery yesterday|injured (?:today|yesterday))\b/i;
const ACUTE_TIME = /\b(?:today|yesterday|just|recent(?:ly)?|this week|right now)\b/i;

const COPY = Object.freeze({
  en: {
    urgent_symptoms: "This may need urgent in-person care. Please stop exercise and seek emergency help now if symptoms are severe, worsening, or include chest pain, trouble breathing, fainting, or a severe allergic reaction.",
    pregnancy: "Automated personalized exercise or nutrition plans are not available for a current pregnancy or postpartum situation. A qualified prenatal clinician can help tailor a safe plan.",
    eating_disorder: "We cannot provide an aggressive weight-loss or restrictive plan in this context. Please consider support from a qualified clinician or eating-disorder specialist.",
    acute_injury: "Automated loading advice is not available for a current acute injury or recent surgery. A qualified clinician can advise on safe return to activity.",
    caution: "This information can be discussed generally, but it is not medical advice. Consider a qualified professional for individualized guidance."
  },
  he: {
    urgent_symptoms: "ייתכן שנדרש טיפול רפואי דחוף. יש להפסיק פעילות ולפנות לעזרה דחופה אם התסמינים חמורים, מחמירים, או כוללים כאב בחזה, קוצר נשימה, עילפון או תגובה אלרגית חמורה.",
    pregnancy: "תוכנית אימון או תזונה אישית אוטומטית אינה זמינה בהיריון או לאחר לידה. איש או אשת מקצוע מוסמכים בתחום ההיריון יכולים להתאים תוכנית בטוחה.",
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

function assessSafety({ text = "", language = "en", route = "personalized" } = {}) {
  const normalized = cleanSafetyText(text);
  if (!normalized) return result({ language });
  const historical = HISTORICAL.test(normalized);
  const educational = EDUCATIONAL.test(normalized);
  const current = CURRENT.test(normalized);
  const personalized = route !== "education";

  if (URGENT_SYMPTOMS.test(normalized) && !historical) {
    return result({ category: "urgent_symptoms", status: "CURRENT_HIGH_RISK", context: "current", action: "URGENT_SAFETY_RESPONSE", language });
  }
  if (SEVERE_ALLERGY.test(normalized) && !historical) {
    return result({ category: "urgent_symptoms", status: "CURRENT_HIGH_RISK", context: "current", action: "URGENT_SAFETY_RESPONSE", language });
  }
  if (PREGNANCY_MENTION.test(normalized)) {
    if (THIRD_PERSON.test(normalized)) return result({ category: "pregnancy", status: "EDUCATIONAL", context: "third_party", action: "ALLOW_WITH_CAUTION", language });
    if (!PREGNANCY_REQUESTER.test(normalized) || educational || !personalized) return result({ category: "pregnancy", status: "EDUCATIONAL", context: "educational", action: "ALLOW_WITH_CAUTION", language });
    return result({ category: "pregnancy", status: "CURRENT_NON_EMERGENCY", context: "current", action: "RESTRICT_PERSONALIZED_PLAN", language });
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
