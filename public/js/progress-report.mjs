// Builds a self-contained, human-readable progress report from the same
// account export payload the raw JSON download uses (GET /api/account/export).
// Pure: no DOM, no network, no imports -- so it is unit-testable and the
// output is a single .html file that opens offline, prints cleanly and
// contains no scripts or trackers.
//
// It never fabricates: a section that has no supporting data says so instead
// of showing a zero or an invented trend. Internal identifiers (Firebase
// UID, document ids, schemaVersion, provider fields, photo URLs) stay out of
// this report -- they remain in the raw JSON export.

const STRINGS = Object.freeze({
  en: {
    lang: "en", dir: "ltr", locale: "en-US",
    docTitle: "FuelPhysique — Personal Progress Report",
    brand: "FuelPhysique", heading: "Personal Progress Report",
    generated: "Generated", none: "Not enough data yet.",
    kg: "kg", cm: "cm", kcal: "kcal", g: "g", days: "days", perWeek: "/week",
    summary: "Summary",
    memberSince: "Member since", loggedWorkouts: "Logged workouts",
    activePlan: "Active plans", nutritionDays: "Nutrition logging days",
    weighIns: "Recorded weigh-ins", measurements: "Body-measurement records",
    planWorkout: "Workout plan", planNutrition: "Nutrition plan",
    planActive: "active", planNone: "none",
    bodyWeight: "Body weight",
    starting: "Starting", latest: "Latest", change: "Change", span: "Over",
    lowest: "Lowest", highest: "Highest", average: "Average",
    weightEmpty: "Not enough weight measurements yet to show a trend.",
    strength: "Strength progress",
    strengthEmpty: "No completed working sets logged yet, so there is no strength trend to show.",
    firstSet: "First logged working set", latestSet: "Latest working set",
    consistency: "Consistency",
    workoutsLast7: "Workouts in the last 7 days",
    workoutsLast30: "Workouts in the last 30 days",
    avgPerWeek: "Average workouts per week",
    streak: "Longest run of consecutive active days",
    consistencyEmpty: "No workouts logged yet.",
    nutrition: "Nutrition",
    nutritionEmpty: "No daily nutrition has been logged yet.",
    avgCalories: "Average calories", avgProtein: "Average protein",
    avgCarbs: "Average carbohydrates", avgFat: "Average fat",
    avgBalance: "Average energy balance",
    overLoggedDays: n => `Average over ${n} logged ${n === 1 ? "day" : "days"}`,
    proteinMet: (a, b) => `Protein target met on ${a} of ${b} logged days`,
    bodyMeasurements: "Body measurements",
    measurementsEmpty: "No body measurements have been recorded yet.",
    milestones: "Milestones",
    milestonesEmpty: "Milestones will appear here as you log workouts, nutrition and measurements.",
    mFirstWorkout: d => `Logged your first workout on ${d}.`,
    mWorkoutCount: n => `Completed ${n} recorded ${n === 1 ? "workout" : "workouts"}.`,
    mFirstWeight: d => `First weigh-in recorded on ${d}.`,
    mWeightChange: (dir, v) => `Body weight ${dir} by ${v} kg since your first recorded weigh-in.`,
    mNutritionDays: n => `Logged daily nutrition on ${n} ${n === 1 ? "day" : "days"}.`,
    mBest: (name, v) => `New recorded best on ${name}: ${v} kg.`,
    down: "down", up: "up",
    disclaimer: "This report is generated from your own logged data. It is informational, not medical advice.",
    rawNote: "Your full raw data is available separately as a JSON download in Account & Privacy."
  },
  he: {
    lang: "he", dir: "rtl", locale: "he-IL",
    docTitle: "FuelPhysique — דוח התקדמות אישי",
    brand: "FuelPhysique", heading: "דוח התקדמות אישי",
    generated: "הופק בתאריך", none: "אין עדיין מספיק נתונים.",
    kg: "ק\"ג", cm: "ס\"מ", kcal: "קק\"ל", g: "גרם", days: "ימים", perWeek: " לשבוע",
    summary: "סיכום",
    memberSince: "חבר/ה מאז", loggedWorkouts: "אימונים מתועדים",
    activePlan: "תוכניות פעילות", nutritionDays: "ימי תיעוד תזונה",
    weighIns: "שקילות שנרשמו", measurements: "רשומות מדידות גוף",
    planWorkout: "תוכנית אימון", planNutrition: "תוכנית תזונה",
    planActive: "פעילה", planNone: "אין",
    bodyWeight: "משקל גוף",
    starting: "התחלה", latest: "אחרון", change: "שינוי", span: "לאורך",
    lowest: "הנמוך ביותר", highest: "הגבוה ביותר", average: "ממוצע",
    weightEmpty: "אין עדיין מספיק מדידות משקל כדי להציג מגמה.",
    strength: "התקדמות בכוח",
    strengthEmpty: "לא תועדו עדיין סטים מלאים שהושלמו, ולכן אין מגמת כוח להצגה.",
    firstSet: "הסט המלא הראשון שתועד", latestSet: "הסט המלא האחרון",
    consistency: "עקביות",
    workoutsLast7: "אימונים ב-7 הימים האחרונים",
    workoutsLast30: "אימונים ב-30 הימים האחרונים",
    avgPerWeek: "ממוצע אימונים לשבוע",
    streak: "רצף הימים הפעילים הארוך ביותר",
    consistencyEmpty: "לא תועדו עדיין אימונים.",
    nutrition: "תזונה",
    nutritionEmpty: "לא תועדה עדיין תזונה יומית.",
    avgCalories: "קלוריות ממוצעות", avgProtein: "חלבון ממוצע",
    avgCarbs: "פחמימות ממוצעות", avgFat: "שומן ממוצע",
    avgBalance: "מאזן אנרגיה ממוצע",
    overLoggedDays: n => n === 1 ? "ממוצע על פני יום מתועד אחד" : `ממוצע על פני ${n} ימים מתועדים`,
    proteinMet: (a, b) => `יעד החלבון הושג ב-${a} מתוך ${b} ימים מתועדים`,
    bodyMeasurements: "מדידות גוף",
    measurementsEmpty: "לא נרשמו עדיין מדידות גוף.",
    milestones: "אבני דרך",
    milestonesEmpty: "אבני דרך יופיעו כאן ככל שתתעדו אימונים, תזונה ומדידות.",
    mFirstWorkout: d => `תיעדתם את האימון הראשון בתאריך ${d}.`,
    mWorkoutCount: n => `הושלמו ${n} אימונים מתועדים.`,
    mFirstWeight: d => `השקילה הראשונה נרשמה בתאריך ${d}.`,
    mWeightChange: (dir, v) => `משקל הגוף ${dir} ב-${v} ק"ג מאז השקילה הראשונה שנרשמה.`,
    mNutritionDays: n => `תיעדתם תזונה יומית ב-${n} ימים.`,
    mBest: (name, v) => `שיא חדש שנרשם ב-${name}: ${v} ק"ג.`,
    down: "ירד", up: "עלה",
    disclaimer: "הדוח מופק מהנתונים שתיעדתם בעצמכם. הוא מידע כללי ואינו ייעוץ רפואי.",
    rawNote: "הנתונים הגולמיים המלאים זמינים בנפרד להורדה כקובץ JSON תחת חשבון ופרטיות."
  }
});

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") { const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; }
  if (typeof value === "object" && typeof value.toDate === "function") return toDate(value.toDate());
  if (typeof value === "object" && Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function round(value, precision = 1) {
  const factor = 10 ** precision;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
}

function bidi(value) {
  return `<span dir="auto">${escapeHtml(value)}</span>`;
}

function daysBetween(a, b) {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86400000);
}

function collectionOf(exportData, name) {
  const fromCollections = exportData?.collections?.[name];
  if (Array.isArray(fromCollections)) return fromCollections;
  const fromRoot = exportData?.[name];
  return Array.isArray(fromRoot) ? fromRoot : [];
}

function formatDate(date, T) {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat(T.locale, { year: "numeric", month: "long", day: "numeric" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function num(value, T, precision = 0) {
  try {
    return new Intl.NumberFormat(T.locale, { maximumFractionDigits: precision }).format(Number(value) || 0);
  } catch {
    return String(round(value, precision));
  }
}

function signed(value, T, precision = 1) {
  const rounded = round(value, precision);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${num(Math.abs(rounded), T, precision)}`;
}

// --- section builders -------------------------------------------------------

function weightSection(exportData, T) {
  const entries = collectionOf(exportData, "weightEntries")
    .map((item) => ({ date: toDate(item.date || item.createdAt), weight: Number(item.weight) }))
    .filter((item) => item.date && Number.isFinite(item.weight) && item.weight > 0)
    .sort((a, b) => a.date - b.date);
  if (entries.length < 2) {
    return { rows: [], empty: T.weightEmpty, count: entries.length };
  }
  const first = entries[0];
  const last = entries[entries.length - 1];
  const weights = entries.map((item) => item.weight);
  const change = round(last.weight - first.weight, 1);
  return {
    count: entries.length,
    rows: [
      [T.starting, `${num(first.weight, T, 1)} ${T.kg}`, formatDate(first.date, T)],
      [T.latest, `${num(last.weight, T, 1)} ${T.kg}`, formatDate(last.date, T)],
      [T.change, `${signed(change, T)} ${T.kg}`, `${T.span} ${daysBetween(first.date, last.date)} ${T.days}`],
      [T.lowest, `${num(Math.min(...weights), T, 1)} ${T.kg}`, ""],
      [T.highest, `${num(Math.max(...weights), T, 1)} ${T.kg}`, ""],
      [T.average, `${num(weights.reduce((sum, value) => sum + value, 0) / weights.length, T, 1)} ${T.kg}`, ""]
    ]
  };
}

function workoutLogEntries(exportData) {
  return collectionOf(exportData, "workoutLogs")
    .map((log) => ({
      date: toDate(log.completedAt || log.createdAt || log.startedAt),
      exercises: Array.isArray(log.exercises) ? log.exercises : Array.isArray(log.exerciseLogs) ? log.exerciseLogs : []
    }))
    .filter((log) => log.date)
    .sort((a, b) => a.date - b.date);
}

function strengthSection(exportData, T) {
  const logs = workoutLogEntries(exportData);
  const byExercise = new Map();
  for (const log of logs) {
    for (const exercise of log.exercises) {
      const sets = (Array.isArray(exercise.sets) ? exercise.sets : [])
        .filter((set) => set.completed !== false && Number.isFinite(Number(set.weightKg)) && Number(set.weightKg) > 0);
      if (!sets.length) continue;
      const heaviest = Math.max(...sets.map((set) => Number(set.weightKg)));
      const topSet = sets.find((set) => Number(set.weightKg) === heaviest) || sets[0];
      const name = String(exercise.name || "").trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase();
      if (!byExercise.has(key)) byExercise.set(key, { name, sessions: [] });
      byExercise.get(key).sessions.push({ date: log.date, weight: heaviest, reps: Number(topSet.reps) || null });
    }
  }
  const progressed = [];
  for (const { name, sessions } of byExercise.values()) {
    if (sessions.length < 2) continue;
    const first = sessions[0];
    const last = sessions[sessions.length - 1];
    progressed.push({
      name,
      first,
      last,
      delta: round(last.weight - first.weight, 1),
      best: Math.max(...sessions.map((session) => session.weight))
    });
  }
  progressed.sort((a, b) => b.delta - a.delta);
  return { items: progressed.slice(0, 8), empty: progressed.length ? "" : T.strengthEmpty };
}

function consistencySection(exportData, T, now) {
  const logs = workoutLogEntries(exportData);
  if (!logs.length) return { rows: [], empty: T.consistencyEmpty };
  const dayKeys = [...new Set(logs.map((log) => log.date.toISOString().slice(0, 10)))].sort();
  const last7 = logs.filter((log) => daysBetween(log.date, now) <= 7 && log.date <= now).length;
  const last30 = logs.filter((log) => daysBetween(log.date, now) <= 30 && log.date <= now).length;
  const spanDays = Math.max(7, daysBetween(logs[0].date, logs[logs.length - 1].date) + 1);
  const perWeek = round((logs.length / spanDays) * 7, 1);
  let longestStreak = 1;
  let run = 1;
  for (let index = 1; index < dayKeys.length; index += 1) {
    const previous = new Date(dayKeys[index - 1]);
    const current = new Date(dayKeys[index]);
    if (daysBetween(previous, current) === 1) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 1;
    }
  }
  return {
    empty: "",
    rows: [
      [T.workoutsLast7, num(last7, T)],
      [T.workoutsLast30, num(last30, T)],
      [T.avgPerWeek, `${num(perWeek, T, 1)}${T.perWeek}`],
      [T.streak, `${num(longestStreak, T)} ${T.days}`]
    ]
  };
}

function nutritionSection(exportData, T) {
  const logs = collectionOf(exportData, "dailyNutritionLogs")
    .map((log) => ({
      totals: log.totals || {},
      entries: Array.isArray(log.entries) ? log.entries : [],
      maintenance: Number(log.maintenanceSnapshot || log.targetSnapshot?.maintenanceCalories || 0),
      proteinTarget: Number(log.targetSnapshot?.proteinGrams || 0)
    }))
    .filter((log) => log.entries.length > 0);
  if (!logs.length) return { rows: [], empty: T.nutritionEmpty, note: "", days: 0 };
  const sum = logs.reduce((accumulator, log) => ({
    calories: accumulator.calories + Number(log.totals.calories || 0),
    protein: accumulator.protein + Number(log.totals.proteinGrams || 0),
    carbs: accumulator.carbs + Number(log.totals.carbsGrams || 0),
    fat: accumulator.fat + Number(log.totals.fatGrams || 0)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const days = logs.length;
  const balanceDays = logs.filter((log) => log.maintenance > 0);
  const averageBalance = balanceDays.length
    ? balanceDays.reduce((total, log) => total + (Number(log.totals.calories || 0) - log.maintenance), 0) / balanceDays.length
    : null;
  const proteinDays = logs.filter((log) => log.proteinTarget > 0);
  const proteinMet = proteinDays.filter((log) => Number(log.totals.proteinGrams || 0) >= log.proteinTarget).length;
  const rows = [
    [T.avgCalories, `${num(sum.calories / days, T)} ${T.kcal}`],
    [T.avgProtein, `${num(sum.protein / days, T)} ${T.g}`],
    [T.avgCarbs, `${num(sum.carbs / days, T)} ${T.g}`],
    [T.avgFat, `${num(sum.fat / days, T)} ${T.g}`]
  ];
  if (averageBalance !== null) rows.push([T.avgBalance, `${signed(averageBalance, T, 0)} ${T.kcal}`]);
  return {
    days,
    rows,
    note: T.overLoggedDays(days) + (proteinDays.length ? ` · ${T.proteinMet(proteinMet, proteinDays.length)}` : "")
  };
}

function measurementsSection(exportData, T) {
  const labels = T.dir === "rtl"
    ? { waist: "מותניים", chest: "חזה", hips: "ירכיים", arm: "זרוע", thigh: "ירך" }
    : { waist: "Waist", chest: "Chest", hips: "Hips", arm: "Arm", thigh: "Thigh" };
  const entries = collectionOf(exportData, "bodyMeasurements")
    .map((item) => ({ date: toDate(item.date || item.createdAt), values: item }))
    .filter((item) => item.date)
    .sort((a, b) => a.date - b.date);
  if (!entries.length) return { rows: [], empty: T.measurementsEmpty };
  const first = entries[0].values;
  const last = entries[entries.length - 1].values;
  const rows = [];
  for (const field of Object.keys(labels)) {
    const start = Number(first[field]);
    const end = Number(last[field]);
    if (!Number.isFinite(end) || end <= 0) continue;
    const hasStart = Number.isFinite(start) && start > 0 && entries.length > 1;
    rows.push([
      labels[field],
      hasStart ? `${num(start, T, 1)} → ${num(end, T, 1)} ${T.cm}` : `${num(end, T, 1)} ${T.cm}`,
      hasStart ? `${signed(end - start, T)} ${T.cm}` : ""
    ]);
  }
  return { rows, empty: rows.length ? "" : T.measurementsEmpty };
}

function milestones(exportData, T, computed) {
  const list = [];
  const logs = workoutLogEntries(exportData);
  if (logs.length) {
    list.push(T.mFirstWorkout(formatDate(logs[0].date, T)));
    list.push(T.mWorkoutCount(logs.length));
  }
  const weights = collectionOf(exportData, "weightEntries")
    .map((item) => ({ date: toDate(item.date || item.createdAt), weight: Number(item.weight) }))
    .filter((item) => item.date && Number.isFinite(item.weight))
    .sort((a, b) => a.date - b.date);
  if (weights.length) {
    list.push(T.mFirstWeight(formatDate(weights[0].date, T)));
    if (weights.length > 1) {
      const delta = round(weights[weights.length - 1].weight - weights[0].weight, 1);
      if (delta !== 0) list.push(T.mWeightChange(delta < 0 ? T.down : T.up, num(Math.abs(delta), T, 1)));
    }
  }
  if (computed.nutritionDays) list.push(T.mNutritionDays(computed.nutritionDays));
  for (const item of computed.strengthItems.slice(0, 2)) {
    if (item.delta > 0) list.push(T.mBest(item.name, num(item.best, T, 1)));
  }
  return list;
}

// --- rendering -------------------------------------------------------------

function statTable(rows) {
  return `<table class="stat-table"><tbody>${rows.map((row) => (
    `<tr><th scope="row">${escapeHtml(row[0])}</th><td>${escapeHtml(row[1])}</td>${row[2] !== undefined ? `<td class="muted">${escapeHtml(row[2])}</td>` : ""}</tr>`
  )).join("")}</tbody></table>`;
}

function section(title, inner) {
  return `<section class="report-section"><h2>${escapeHtml(title)}</h2>${inner}</section>`;
}

function emptyNote(message) {
  return `<p class="empty-note">${escapeHtml(message)}</p>`;
}

export function buildProgressReport(exportData = {}, { locale = "en", now = new Date() } = {}) {
  const T = STRINGS[locale === "he" ? "he" : "en"];
  const generatedAt = toDate(exportData.generatedAt) || (now instanceof Date ? now : new Date());

  const account = (exportData.account && typeof exportData.account === "object") ? exportData.account : {};
  const weightEntries = collectionOf(exportData, "weightEntries");
  const workoutLogs = collectionOf(exportData, "workoutLogs");
  const nutritionLogs = collectionOf(exportData, "dailyNutritionLogs").filter((log) => Array.isArray(log.entries) && log.entries.length > 0);
  const measurements = collectionOf(exportData, "bodyMeasurements");
  const workoutPlans = collectionOf(exportData, "workoutPlans");
  const nutritionPlans = collectionOf(exportData, "nutritionPlans");

  const memberSinceCandidates = [
    toDate(account.createdAt),
    ...weightEntries.map((item) => toDate(item.createdAt || item.date)),
    ...workoutLogs.map((item) => toDate(item.completedAt || item.createdAt || item.startedAt)),
    ...nutritionLogs.map((item) => toDate(item.createdAt || item.updatedAt))
  ].filter(Boolean).sort((a, b) => a - b);
  const memberSince = memberSinceCandidates[0] || null;

  const activePlanWorkout = workoutPlans.some((plan) => plan.active === true);
  const activePlanNutrition = Boolean(account.activeNutritionPlanId) || nutritionPlans.some((plan) => plan.active === true);

  const strength = strengthSection(exportData, T);
  const nutrition = nutritionSection(exportData, T);
  const weight = weightSection(exportData, T);
  const consistency = consistencySection(exportData, T, generatedAt);
  const measurementsResult = measurementsSection(exportData, T);
  const milestoneList = milestones(exportData, T, {
    nutritionDays: nutrition.days,
    strengthItems: strength.items
  });

  const summaryRows = [
    [T.memberSince, memberSince ? formatDate(memberSince, T) : T.none],
    [T.loggedWorkouts, num(workoutLogs.length, T)],
    [T.planWorkout, activePlanWorkout ? T.planActive : T.planNone],
    [T.planNutrition, activePlanNutrition ? T.planActive : T.planNone],
    [T.nutritionDays, num(nutritionLogs.length, T)],
    [T.weighIns, num(weightEntries.length, T)],
    [T.measurements, num(measurements.length, T)]
  ];

  const strengthInner = strength.items.length
    ? `<div class="exercise-grid">${strength.items.map((item) => `
        <article class="exercise-card">
          <h3>${bidi(item.name)}</h3>
          <p><span class="label">${escapeHtml(T.firstSet)}</span> ${escapeHtml(num(item.first.weight, T, 1))} ${escapeHtml(T.kg)}${item.first.reps ? ` × ${escapeHtml(String(item.first.reps))}` : ""} <span class="muted">(${escapeHtml(formatDate(item.first.date, T))})</span></p>
          <p><span class="label">${escapeHtml(T.latestSet)}</span> ${escapeHtml(num(item.last.weight, T, 1))} ${escapeHtml(T.kg)}${item.last.reps ? ` × ${escapeHtml(String(item.last.reps))}` : ""} <span class="muted">(${escapeHtml(formatDate(item.last.date, T))})</span></p>
          <p class="delta ${item.delta > 0 ? "up" : item.delta < 0 ? "down" : ""}">${escapeHtml(T.change)}: ${escapeHtml(signed(item.delta, T))} ${escapeHtml(T.kg)}</p>
        </article>`).join("")}</div>`
    : emptyNote(strength.empty);

  const body = [
    section(T.summary, statTable(summaryRows)),
    section(T.bodyWeight, weight.rows.length ? statTable(weight.rows) : emptyNote(weight.empty)),
    section(T.strength, strengthInner),
    section(T.consistency, consistency.rows.length ? statTable(consistency.rows) : emptyNote(consistency.empty)),
    section(T.nutrition, nutrition.rows.length
      ? statTable(nutrition.rows) + `<p class="muted denominator">${escapeHtml(nutrition.note)}</p>`
      : emptyNote(nutrition.empty)),
    section(T.bodyMeasurements, measurementsResult.rows.length ? statTable(measurementsResult.rows) : emptyNote(measurementsResult.empty)),
    section(T.milestones, milestoneList.length
      ? `<ul class="milestones">${milestoneList.map((item) => `<li>${bidi(item)}</li>`).join("")}</ul>`
      : emptyNote(T.milestonesEmpty))
  ].join("");

  const html = `<!doctype html>
<html lang="${T.lang}" dir="${T.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(T.docTitle)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px 18px 64px;
    font-family: "Space Grotesk", Inter, system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
    color: #0d1b2a;
    background: #eef3f8;
    line-height: 1.55;
  }
  .report { max-width: 760px; margin: 0 auto; }
  .report-header {
    padding: 26px 26px 22px;
    border-radius: 20px;
    color: #eaf4ff;
    background: linear-gradient(150deg, #0a2540, #10314f 55%, #123a55);
    box-shadow: 0 18px 42px rgba(9, 24, 41, 0.18);
  }
  .report-header .brand { margin: 0; font-size: 13px; letter-spacing: 0.22em; text-transform: uppercase; color: #7fd3fc; }
  .report-header h1 { margin: 6px 0 8px; font-size: 26px; }
  .report-header p { margin: 0; color: #a9c6df; font-size: 13px; }
  .report-section {
    margin-top: 20px;
    padding: 20px 22px;
    border: 1px solid #d5e0ec;
    border-radius: 16px;
    background: #ffffff;
  }
  .report-section h2 { margin: 0 0 12px; font-size: 17px; color: #123a55; }
  .stat-table { width: 100%; border-collapse: collapse; }
  .stat-table th, .stat-table td { padding: 8px 4px; text-align: start; vertical-align: baseline; border-bottom: 1px solid #eef2f7; font-size: 14px; }
  .stat-table th { font-weight: 600; color: #33475b; width: 46%; }
  .stat-table tr:last-child th, .stat-table tr:last-child td { border-bottom: 0; }
  .muted { color: #6b7f92; font-size: 13px; }
  .denominator { margin: 10px 0 0; }
  .empty-note { margin: 0; color: #6b7f92; font-style: italic; font-size: 14px; }
  .exercise-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
  .exercise-card { padding: 13px 14px; border: 1px solid #e1e9f1; border-radius: 12px; background: #f7fafd; }
  .exercise-card h3 { margin: 0 0 6px; font-size: 15px; }
  .exercise-card p { margin: 3px 0; font-size: 13px; }
  .exercise-card .label { color: #55697b; font-weight: 600; }
  .delta { font-weight: 700; }
  .delta.up { color: #1f7a4d; }
  .delta.down { color: #b4453b; }
  .milestones { margin: 0; padding-inline-start: 20px; }
  .milestones li { margin: 5px 0; font-size: 14px; }
  .report-footer { margin-top: 22px; color: #6b7f92; font-size: 12px; }
  .report-footer p { margin: 4px 0; }
  @media (prefers-color-scheme: dark) {
    body { color: #e8eef6; background: #0c1622; }
    .report-section { background: #13202f; border-color: #24384c; }
    .report-section h2 { color: #9fd4f4; }
    .stat-table th, .stat-table td { border-color: #21323f; }
    .stat-table th { color: #b6c6d6; }
    .exercise-card { background: #16273a; border-color: #26394d; }
    .muted, .empty-note, .report-footer { color: #93a7ba; }
  }
  @media print {
    body { padding: 0; background: #ffffff; color: #101820; font-size: 12px; }
    .report { max-width: none; }
    .report-header { color: #101820; background: none; box-shadow: none; border: 1px solid #b9c6d2; }
    .report-header .brand { color: #14618f; }
    .report-header p { color: #44586b; }
    .report-section { break-inside: avoid; border-color: #c4d0dc; }
    .exercise-card { background: none; }
  }
</style>
</head>
<body>
<main class="report">
  <header class="report-header">
    <p class="brand">${escapeHtml(T.brand)}</p>
    <h1>${escapeHtml(T.heading)}</h1>
    <p>${escapeHtml(T.generated)}: ${escapeHtml(formatDate(generatedAt, T))}</p>
  </header>
  ${body}
  <footer class="report-footer">
    <p>${escapeHtml(T.disclaimer)}</p>
    <p>${escapeHtml(T.rawNote)}</p>
  </footer>
</main>
</body>
</html>`;

  const filename = `fuelphysique-progress-report-${generatedAt.toISOString().slice(0, 10)}.html`;
  return { filename, html };
}

export { STRINGS as PROGRESS_REPORT_STRINGS };
