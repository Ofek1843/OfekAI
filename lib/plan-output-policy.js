"use strict";

function nutritionSafetyNotes({ language = "en", isYouth = false, safeConditions = [] } = {}) {
  const he = language === "he";
  const notes = he ? [
    "היעדים הם אומדני התחלה, לא צרכים שנמדדו ולא ייעוץ רפואי. יש לבחון מגמות משקל, צריכה וביצועים עם איש מקצוע.",
    "יש להשתמש במצב ההכנה המצוין בכל רכיב. אם לא צוין מצב שקילה, בדקו מול תווית או איש מקצוע ואל תחליפו בין נא למבושל. נוזלים נשקלים בגרמים, לא במ״ל.",
    "ערכי הקטלוג הם אומדנים כלליים, לא נתוני מותג מאומתים. יש לבדוק תוויות ואלרגנים; אין הבטחת היעדר זיהום צולב או מספיקות מיקרונוטריינטים."
  ] : [
    "Targets are starting estimates, not measured requirements or medical advice. Review intake, weight trends and performance with a qualified professional.",
    "Use the preparation state shown for each ingredient. If unspecified, verify against its label or a professional; do not interchange raw and cooked weights. Liquids are weighed in grams, not millilitres.",
    "Catalog values are generic estimates, not verified brand data. Check labels and allergens; cross-contact absence and micronutrient adequacy are not guaranteed."
  ];
  if (isYouth) notes.push(he ? "מצב נוער דורש אישור הורה וליווי דיאטן מוסמך; התוכנית אינה טיפול לירידה במשקל." : "Youth Mode requires guardian approval and qualified dietitian supervision; this is not a weight-loss treatment.");
  if (safeConditions.length) notes.push(he ? "מצב רפואי מאובחן דורש סקירה של איש מקצוע. מזון אינו תחליף לטיפול, ואין לשנות תרופות או תוספים בעקבות התפריט." : "A diagnosed condition requires qualified professional review. Food does not replace clinician-directed treatment; do not change medications or supplements based on this menu.");
  if (safeConditions.includes("b12Deficiency")) notes.push(he ? "חסר B12 מאובחן דורש טיפול ומעקב מקצועיים; התפריט אינו מבטיח תיקון החסר." : "Diagnosed vitamin B12 deficiency needs clinician-directed treatment and follow-up; this menu does not guarantee correction.");
  return notes;
}

function assertWorkoutAge(age) {
  if ((typeof age !== "number" && typeof age !== "string") || String(age).trim() === "" || !Number.isInteger(Number(age)) || Number(age) < 18 || Number(age) > 100) {
    throw Object.assign(new Error("Automated adult workout planning requires an explicit age between 18 and 100. Younger users need a qualified supervised pathway."), {status:400});
  }
}

function assertScreeningCompleted(profile = {}) {
  const he=profile.language==="he";
  if (profile.screeningStatus === "review") throw Object.assign(new Error(he?"במצב הזה נדרשת בדיקה אישית של איש מקצוע מוסמך במקום תוכנית אוטומטית.":"This situation needs individual professional review instead of an automated personalized plan."),{status:422});
  if (profile.screeningStatus !== "none") throw Object.assign(new Error(he?"יש לענות במפורש על שאלת ההתאמה לתכנון אוטומטי.":"Please complete the automated-planning suitability question explicitly."),{status:400});
}

function workoutLimitationIssues(program, limitations = "None", language = "en") {
  const text = String(limitations || "").trim();
  if (!text || /^(?:none|no (?:limitations|restrictions|injuries)|אין|אין מגבלות|ללא מגבלות)$/iu.test(text)) return [];
  // Free-text injury history is not a clinically validated movement filter.
  // Fail closed rather than letting a repair/volume pass silently ignore it.
  // A future supported pathway can consume professionally reviewed structured restrictions.
  return [language === "he" ? "מגבלות תנועה או מידע על פציעה דורשים בדיקה אישית. אין למערכת דרך מאומתת להתאים לכך תוכנית אוטומטית; יש לפנות לאיש מקצוע מוסמך." : "Movement limitations or injury information require individual review. Automated generation or modification cannot confirm these constraints; consult a qualified professional."];
}

function applyGeneratedWorkoutTextPolicy(program, language = "en") {
  // Only catalog identity and deterministic effort cues are authoritative.
  // Do not publish unconstrained model advice about loading, diet or medication.
  const {getCatalogExercise} = require("./workout-exercise-catalog");
  program.programName = language === "he" ? "תוכנית אימון אישית" : "Personal workout plan";
  for (const [i,session] of (program.sessions || []).entries()) {
    session.name = `${language === "he" ? "יום" : "Day"} ${i+1}`;
    for (const exercise of session.exercises || []) {
      const entry = getCatalogExercise(exercise.exerciseId);
      if (entry) { exercise.name=entry.title; exercise.demoName=entry.title; }
      exercise.notes = language === "he"
        ? "בחרו עומס שמאפשר תנועה מבוקרת ועמידה ביעד ה־RIR. אם מופיעים כאב או תסמינים חריגים, עצרו ופנו לייעוץ מתאים."
        : "Choose a load allowing controlled technique at the prescribed RIR. Stop and seek appropriate advice for pain or unusual symptoms.";
      for (const key of ["loadKg","weightKg","load","weight","coaching","instructions"]) delete exercise[key];
    }
    for (const key of ["notes","description","coaching","instructions"]) delete session[key];
  }
  for (const key of ["notes","description","coaching","instructions","progression","progressionNotes","deload"]) delete program[key];
  require("./workout-program-identity").applyProgramSplitIdentity(program,{language});
  return program;
}

module.exports = { nutritionSafetyNotes, assertWorkoutAge, assertScreeningCompleted, workoutLimitationIssues, applyGeneratedWorkoutTextPolicy };
