const WEEKDAY_LABELS = {
  he: ["יום א׳", "יום ב׳", "יום ג׳", "יום ד׳", "יום ה׳", "יום ו׳", "שבת"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
};

export function normalizeDayIndex(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return ((Math.round(number) % 7) + 7) % 7;
}

export function getWeekdayLabels(isHebrew) {
  return isHebrew ? WEEKDAY_LABELS.he : WEEKDAY_LABELS.en;
}

export function createWeeklyScheduleDays(sessionCount, anchorDay = 0) {
  const count = Math.max(0, Math.min(7, Number(sessionCount) || 0));
  if (!count) return [];
  if (count === 1) return [normalizeDayIndex(anchorDay)];

  const offset = normalizeDayIndex(anchorDay);
  const used = new Set();
  const days = [];
  const step = 7 / count;

  for (let index = 0; index < count; index += 1) {
    let day = normalizeDayIndex(Math.round(index * step) + offset);
    while (used.has(day)) {
      day = normalizeDayIndex(day + 1);
    }
    used.add(day);
    days.push(day);
  }

  return days;
}

export function shiftWeeklyScheduleDays(days, delta) {
  if (!Array.isArray(days)) return [];
  const shift = Number(delta) || 0;
  return days.map(day => normalizeDayIndex(Number(day) + shift));
}

export function readWeeklyScheduleDays(plan, sessionCount, anchorDay = 0) {
  const source =
    (Array.isArray(plan?.weeklyScheduleDays) && plan.weeklyScheduleDays) ||
    (Array.isArray(plan?.trainingDaysOfWeek) && plan.trainingDaysOfWeek) ||
    (Array.isArray(plan?.scheduleDays) && plan.scheduleDays) ||
    [];

  if (source.length === sessionCount && source.every(day => Number.isFinite(Number(day)))) {
    return source.map(normalizeDayIndex);
  }

  return createWeeklyScheduleDays(sessionCount, anchorDay);
}
