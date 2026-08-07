"use strict";

const { normalizeTimezone } = require("./push-domain");

const WEEKDAY_INDEX = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });

function timestampDate(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value || 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function zonedDateParts(value, requestedTimezone) {
  const date = timestampDate(value) || new Date();
  const timezone = normalizeTimezone(requestedTimezone);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).filter((item) => item.type !== "literal").map((item) => [item.type, item.value]));
  return {
    timezone,
    timezoneFallback: timezone !== requestedTimezone,
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday]
  };
}

function reminderMinutes(value) {
  const [hour, minute] = String(value || "18:00").split(":").map(Number);
  return hour * 60 + minute;
}

function isReminderDue(now, reminderTime, timezone, windowMinutes = 20) {
  const parts = zonedDateParts(now, timezone);
  const delta = parts.hour * 60 + parts.minute - reminderMinutes(reminderTime);
  return { ...parts, due: delta >= 0 && delta < windowMinutes, deltaMinutes: delta };
}

function normalizeDayIndex(value) {
  const number = Number(value);
  return Number.isFinite(number) ? ((Math.round(number) % 7) + 7) % 7 : 0;
}

function createWeeklyScheduleDays(sessionCount, anchorDay = 0) {
  const count = Math.max(0, Math.min(7, Number(sessionCount) || 0));
  if (!count) return [];
  if (count === 1) return [normalizeDayIndex(anchorDay)];
  const days = [];
  const used = new Set();
  for (let index = 0; index < count; index += 1) {
    let day = normalizeDayIndex(Math.round(index * (7 / count)) + normalizeDayIndex(anchorDay));
    while (used.has(day)) day = normalizeDayIndex(day + 1);
    used.add(day);
    days.push(day);
  }
  return days;
}

function readWeeklyScheduleDays(plan, sessionCount) {
  const source = plan?.weeklyScheduleDays || plan?.trainingDaysOfWeek || plan?.scheduleDays || [];
  if (Array.isArray(source) && source.length === sessionCount && source.every((day) => Number.isFinite(Number(day)))) {
    return source.map(normalizeDayIndex);
  }
  return createWeeklyScheduleDays(sessionCount, Number(plan?.scheduleAnchorDay) || 0);
}

function scheduledSession(planDocument, weekday) {
  const plan = planDocument?.plan || planDocument || {};
  const sessions = Array.isArray(plan.sessions) ? plan.sessions : [];
  const schedule = readWeeklyScheduleDays(plan, sessions.length);
  const sessionIndex = schedule.findIndex((day) => day === weekday);
  if (sessionIndex < 0 || !sessions[sessionIndex]) return null;
  const session = sessions[sessionIndex];
  return {
    sessionIndex,
    sessionId: String(session.id ?? sessionIndex),
    sessionName: String(session.name || session.title || `Session ${sessionIndex + 1}`).trim().slice(0, 80)
  };
}

function workoutAlreadyCompleted(logs, activePlanId, sessionIndex, localDate, timezone) {
  return (Array.isArray(logs) ? logs : []).some((log) => {
    const completedAt = timestampDate(log.completedAt);
    return completedAt
      && String(log.workoutPlanId || "") === String(activePlanId)
      && Number(log.sessionIndex) === Number(sessionIndex)
      && zonedDateParts(completedAt, timezone).localDate === localDate;
  });
}

async function runWorkoutReminders({ store, service, now = new Date(), limit = 500, windowMinutes = 20, logger = console } = {}) {
  const preferences = await store.listReminderPreferences(limit);
  const summary = { considered: preferences.length, due: 0, sent: 0, skipped: 0, duplicates: 0, timezoneFallbacks: 0 };
  for (const preference of preferences) {
    const due = isReminderDue(now, preference.reminderTime, preference.timezone, windowMinutes);
    if (due.timezoneFallback) summary.timezoneFallbacks += 1;
    if (!due.due) { summary.skipped += 1; continue; }
    summary.due += 1;
    const context = await store.getWorkoutReminderContext(preference.uid);
    if (!context) { summary.skipped += 1; continue; }
    const session = scheduledSession(context.plan, due.weekday);
    if (!session) { summary.skipped += 1; continue; }
    if (workoutAlreadyCompleted(context.logs, context.activePlanId, session.sessionIndex, due.localDate, due.timezone)) {
      summary.skipped += 1;
      continue;
    }
    const result = await service.sendWorkoutReminder({
      uid: preference.uid,
      activePlanId: context.activePlanId,
      sessionId: session.sessionId,
      sessionName: session.sessionName,
      localDate: due.localDate,
      locale: preference.locale
    });
    if (result.duplicate) summary.duplicates += 1;
    else summary.sent += Number(result.sentCount || 0);
  }
  logger.info?.("[push-reminders] completed", summary);
  return summary;
}

module.exports = {
  createWeeklyScheduleDays,
  isReminderDue,
  readWeeklyScheduleDays,
  runWorkoutReminders,
  scheduledSession,
  workoutAlreadyCompleted,
  zonedDateParts
};
