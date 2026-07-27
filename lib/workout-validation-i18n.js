// Translates lib/workout-validator.js's (always-English) error/warning
// strings to Hebrew for API responses, without touching the validator
// itself. The validator's internal contract (English strings, used by its
// own tests) is left completely unchanged — this is a response-boundary
// concern only, applied in server.js right before a 422/warnings payload
// is sent to the client.
//
// Each entry pairs a regex matching one of the validator's fixed message
// templates with a Hebrew template using the same capture groups, so every
// interpolated value (session numbers, exercise names, counts) carries
// through untranslated (exercise names are already in the request's
// language — the AI was instructed to output them that way).

const TRANSLATIONS = [
  [/^Program has no sessions array\.$/, () => "לתוכנית האימונים אין מערך אימונים."],
  [/^Program contains (\d+) sessions, but user requested (\d+)\.$/,
    (m) => `התוכנית מכילה ${m[1]} אימונים, אך המשתמש ביקש ${m[2]}.`],
  [/^Program schedules (\d+) days, but user requested (\d+) training days\.$/,
    (m) => `התוכנית מתזמנת ${m[1]} ימים, אך המשתמש ביקש ${m[2]} ימי אימון.`],
  [/^Day (\d+) is scheduled more than once in weeklyScheduleDays\.$/,
    (m) => `יום ${m[1]} מתוזמן יותר מפעם אחת.`],
  [/^Session scheduled for day (\d+), which is not in the user's available days\.$/,
    (m) => `אימון מתוזמן ליום ${m[1]}, שאינו מבין הימים הזמינים של המשתמש.`],
  [/^(.+) \(Session (\d+)\) requires "(.+)", which is not selected\.$/,
    (m) => `${m[1]} (אימון ${m[2]}) דורש "${m[3]}", שלא נבחר.`],
  [/^(.+) \(Session (\d+)\) has no recognizable equipment value\.$/,
    (m) => `${m[1]} (אימון ${m[2]}) ללא ציוד מזוהה.`],
  [/^Session (\d+) has no exercises array\.$/,
    (m) => `לאימון ${m[1]} אין מערך תרגילים.`],
  [/^Session (\d+): unnamed exercise detected\.$/,
    (m) => `אימון ${m[1]}: זוהה תרגיל ללא שם.`],
  [/^Session (\d+) estimated at (\d+)min, exceeds (\d+)min limit by (\d+)min\.$/,
    (m) => `אימון ${m[1]} מוערך ב-${m[2]} דקות, חורג מהמגבלה של ${m[3]} דקות ב-${m[4]} דקות.`],
  [/^(.+) \(Session (\d+)\): (.+) reps requires ≥180s rest, has (\d+)s\.$/,
    (m) => `${m[1]} (אימון ${m[2]}): ${m[3]} חזרות דורשות מנוחה של 180 שניות לפחות, יש ${m[4]} שניות.`],
  [/^(.+) \(Session (\d+)\): RIR "(.+)" is not a valid number or range\.$/,
    (m) => `${m[1]} (אימון ${m[2]}): RIR "${m[3]}" אינו מספר או טווח תקין.`],
  [/^Session (\d+): "(.+)" appears more than once\.$/,
    (m) => `אימון ${m[1]}: "${m[2]}" מופיע יותר מפעם אחת.`],
  [/^Session (\d+): name must be a string\.$/,
    (m) => `אימון ${m[1]}: שם האימון חייב להיות טקסט.`],
  [/^Session (\d+): must have at least one exercise\.$/,
    (m) => `אימון ${m[1]}: חייב לכלול לפחות תרגיל אחד.`],
  [/^Session (\d+): exercise must have a non-empty name\.$/,
    (m) => `אימון ${m[1]}: לתרגיל חייב להיות שם.`],
  [/^Session (\d+): exercise "(.+)" is missing exerciseId\.$/,
    (m) => `אימון ${m[1]}: לתרגיל "${m[2]}" חסר מזהה תרגיל.`],
  [/^Session (\d+): sets must be 1-20\.$/,
    (m) => `אימון ${m[1]}: מספר הסטים חייב להיות בין 1 ל-20.`],
  [/^Session (\d+): rest must be ≥15 seconds\.$/,
    (m) => `אימון ${m[1]}: זמן המנוחה חייב להיות 15 שניות לפחות.`],
  [/^Session (\d+): (.+) receives (\d+) hard sets; consider distributing\.$/,
    (m) => `אימון ${m[1]}: ${m[2]} מקבל ${m[3]} סטים; מומלץ לפזר.`],
  [/^(.+) \(Session (\d+)\): (.+) reps is outside typical hypertrophy range \(5-30\)\.$/,
    (m) => `${m[1]} (אימון ${m[2]}): ${m[3]} חזרות מחוץ לטווח ההיפרטרופיה האופייני (5-30).`]
];

function translateValidationMessage(message, language) {
  if (language !== "he") return message;

  for (const [pattern, build] of TRANSLATIONS) {
    const match = message.match(pattern);
    if (match) return build(match);
  }

  // Unrecognized message shape (should not happen for a message actually
  // produced by validateWorkoutProgram) — return as-is rather than hide
  // the underlying problem.
  return message;
}

function translateValidationMessages(messages, language) {
  return (messages || []).map((message) => translateValidationMessage(message, language));
}

module.exports = { translateValidationMessage, translateValidationMessages };
