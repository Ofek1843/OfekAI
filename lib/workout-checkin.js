"use strict";

const { hashIdentifier, isValidTimezone, normalizeTimezone } = require("./push-domain");
const { readWeeklyScheduleDays, workoutAlreadyCompleted, zonedDateParts } = require("./workout-reminders");

const PROMPT_HOUR = 19;
const SNOOZE_MINUTES = 90;
const MAX_SNOOZES_PER_DAY = 2;

function checkinId(uid, planId, sessionIndex, scheduledDate) {
  return hashIdentifier(`${uid}|${planId}|${Number(sessionIndex)}|${scheduledDate}`);
}

function sessionsForWeekday(planDocument, weekday) {
  const plan = planDocument?.plan || planDocument || {};
  const sessions = Array.isArray(plan.sessions) ? plan.sessions : [];
  const days = readWeeklyScheduleDays(plan, sessions.length);
  return sessions.flatMap((session, sessionIndex) => days[sessionIndex] === Number(weekday) ? [{
    sessionIndex,
    sessionId: String(session?.id ?? sessionIndex),
    sessionName: String(session?.name || session?.title || `Session ${sessionIndex + 1}`).trim().slice(0, 80),
    exerciseCount: Array.isArray(session?.exercises) ? session.exercises.length : 0,
    targetMuscles: [...new Set((session?.exercises || []).flatMap((exercise) => {
      const values = exercise?.targetMuscles || exercise?.targetMuscle || exercise?.muscleGroups || exercise?.muscleGroup || exercise?.muscles || [];
      return (Array.isArray(values) ? values : [values]).map((value) => String(value || "").trim()).filter(Boolean);
    }))].slice(0, 6)
  }] : []);
}

function datePlusOne(localDate) {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function invalidAction() {
  const error = new Error("That answer is no longer available. Refresh the dashboard and try again.");
  error.status = 409;
  error.code = "checkin_answer_conflict";
  return error;
}

function transitionCheckin(checkin, action, now = new Date()) {
  const patch = { updatedAt: new Date(now) };
  let event = null;
  const yesNo = { yes: true, no: false };
  if (!checkin || !["pending", "snoozed"].includes(checkin.status)) throw invalidAction();

  if (action === "later" && checkin.step === "initial") {
    const localDate = zonedDateParts(now, checkin.timezone).localDate;
    const snoozeCount = Number(checkin.snoozeCount) || 0;
    if (localDate !== checkin.scheduledDate || snoozeCount >= MAX_SNOOZES_PER_DAY) throw invalidAction();
    const nextPromptAt = new Date(new Date(now).getTime() + SNOOZE_MINUTES * 60_000);
    patch.status = "snoozed";
    patch.step = "initial";
    patch.snoozeCount = snoozeCount + 1;
    patch.nextPromptAt = zonedDateParts(nextPromptAt, checkin.timezone).localDate === localDate ? nextPromptAt : null;
    patch.lastPromptedAt = new Date(now);
    event = "workout_checkin_snoozed";
  } else if (action === "completed" && checkin.step === "initial") {
    patch.step = "completed_most";
    patch.flowStartedAt = new Date(now);
  } else if (action === "not_completed" && checkin.step === "initial") {
    patch.step = "skipped_recovery";
    patch.flowStartedAt = new Date(now);
  } else if (action.startsWith("most_") && checkin.step === "completed_most" && yesNo[action.slice(5)] !== undefined) {
    patch.completedMostWorkout = yesNo[action.slice(5)];
    patch.step = "completed_difficulty";
  } else if (action.startsWith("difficulty_") && checkin.step === "completed_difficulty" && yesNo[action.slice(11)] !== undefined) {
    patch.feltUnusuallyDifficult = yesNo[action.slice(11)];
    patch.step = "completed_pain";
  } else if (action.startsWith("pain_") && checkin.step === "completed_pain" && yesNo[action.slice(5)] !== undefined) {
    patch.painOrDiscomfort = yesNo[action.slice(5)];
    patch.status = "completed";
    patch.step = "done";
    patch.completedAt = new Date(now);
    event = "workout_checkin_completed";
  } else if (action.startsWith("recover_") && checkin.step === "skipped_recovery" && yesNo[action.slice(8)] !== undefined) {
    patch.skippedForRecovery = yesNo[action.slice(8)];
    patch.step = "skipped_tomorrow";
  } else if (action.startsWith("tomorrow_") && checkin.step === "skipped_tomorrow" && yesNo[action.slice(9)] !== undefined) {
    patch.moveToTomorrowRequested = yesNo[action.slice(9)];
    patch.makeupScheduledDate = patch.moveToTomorrowRequested ? datePlusOne(zonedDateParts(now, checkin.timezone).localDate) : null;
    patch.status = "skipped";
    patch.step = "done";
    patch.completedAt = new Date(now);
    event = "workout_checkin_skipped";
  } else {
    throw invalidAction();
  }
  return { patch, event };
}

function checkinAvailable(checkin, now = new Date()) {
  if (checkin.status === "pending") return true;
  if (checkin.status !== "snoozed") return false;
  const localDate = zonedDateParts(now, checkin.timezone).localDate;
  if (localDate !== checkin.scheduledDate) return true;
  if (!checkin.nextPromptAt) return false;
  const next = checkin.nextPromptAt?.toDate ? checkin.nextPromptAt.toDate() : new Date(checkin.nextPromptAt);
  return Number.isFinite(next.getTime()) && next <= now;
}

function asDate(value) {
  if (value?.toDate) return value.toDate();
  const parsed = new Date(value || 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function serializeForClient(checkin) {
  const result = { ...checkin };
  delete result.ownerUid;
  for (const key of ["createdAt", "updatedAt", "firstPromptedAt", "inAppShownAt", "lastPromptedAt", "completedAt", "nextPromptAt", "expiredAt"]) {
    if (result[key] == null) continue;
    const date = asDate(result[key]);
    result[key] = date ? date.toISOString() : null;
  }
  return result;
}

class WorkoutCheckinService {
  constructor({ store, pushService = null, onAnalytics = () => {}, logger = console } = {}) {
    if (!store) throw new TypeError("Workout check-in service requires a store.");
    this.store = store;
    this.pushService = pushService;
    this.onAnalytics = onAnalytics;
    this.logger = logger;
  }

  async dashboard(uid, requestedTimezone, now = new Date(), { recordShown = true } = {}) {
    const context = await this.store.getWorkoutCheckinContext(uid);
    if (isValidTimezone(requestedTimezone)) await this.store.updateWorkoutCheckinTimezone?.(uid, requestedTimezone);
    const timezone = isValidTimezone(requestedTimezone)
      ? requestedTimezone
      : isValidTimezone(context?.timezone) ? context.timezone : normalizeTimezone("UTC");
    const local = zonedDateParts(now, timezone);
    const planId = context?.activePlanId || "";
    const scheduled = context?.plan ? sessionsForWeekday(context.plan, local.weekday) : [];
    const scheduledKeys = new Set(scheduled.map((session) => `${planId}:${session.sessionIndex}`));
    const createdIds = [];

    if (context?.plan && local.hour >= PROMPT_HOUR) {
      for (const session of scheduled) {
        const id = checkinId(uid, planId, session.sessionIndex, local.localDate);
        const alreadyDone = workoutAlreadyCompleted(context.logs, planId, session.sessionIndex, local.localDate, timezone);
        if (alreadyDone) {
          await this.store.markTrackerCompletion(uid, id, now);
          continue;
        }
        const result = await this.store.ensureWorkoutCheckin(uid, id, {
          id,
          planId,
          workoutId: session.sessionId,
          sessionIndex: session.sessionIndex,
          scheduledDate: local.localDate,
          workoutName: session.sessionName,
          targetMuscles: session.targetMuscles,
          exerciseCount: session.exerciseCount,
          timezone,
          status: "pending",
          step: "initial",
          snoozeCount: 0,
          notificationCount: 0,
          createdAt: new Date(now),
          updatedAt: new Date(now)
        });
        if (result.created) {
          createdIds.push(id);
          this.onAnalytics("workout_checkin_created", this.analyticsProperties(result.checkin, "dashboard"));
        }
      }
    }

    let checkins = await this.store.listWorkoutCheckins(uid);
    for (const item of checkins) {
      if (item.scheduledDate !== local.localDate || !["pending", "snoozed"].includes(item.status)) continue;
      if (item.planId !== planId || !scheduledKeys.has(`${item.planId}:${item.sessionIndex}`)) {
        await this.store.updateWorkoutCheckin(uid, item.id, (current) => ({
          ...current,
          status: "expired",
          step: "done",
          expiredAt: new Date(now),
          updatedAt: new Date(now)
        }));
        this.onAnalytics("workout_checkin_expired", this.analyticsProperties(item, "dashboard"));
        continue;
      }
      if (workoutAlreadyCompleted(context?.logs, item.planId, item.sessionIndex, local.localDate, timezone)) {
        await this.store.markTrackerCompletion(uid, item.id, now);
      }
    }

    checkins = await this.store.listWorkoutCheckins(uid);
    const visible = checkins.filter((item) => {
      if (item.status === "pending" || item.status === "snoozed") return true;
      return item.scheduledDate === local.localDate
        || (item.status === "skipped" && item.makeupScheduledDate === local.localDate);
    }).map((item) => ({
      ...item,
      isPrevious: item.scheduledDate !== local.localDate && item.makeupScheduledDate !== local.localDate,
      isMakeup: item.status === "skipped" && item.makeupScheduledDate === local.localDate,
      answerAvailable: checkinAvailable(item, now)
    })).sort((a, b) => Number(a.isPrevious) - Number(b.isPrevious)
      || String(b.scheduledDate).localeCompare(String(a.scheduledDate))
      || Number(a.sessionIndex) - Number(b.sessionIndex));

    for (const item of visible) {
      if (recordShown && (item.status === "pending" || item.status === "snoozed") && item.answerAvailable) {
        await this.store.touchWorkoutCheckin(uid, item.id, now);
        if (!item.inAppShownAt) this.onAnalytics("workout_checkin_shown", this.analyticsProperties(item, "dashboard"));
      }
    }
    return { checkins: visible.map(serializeForClient), createdIds, timezone, localDate: local.localDate };
  }

  async answer(uid, id, action, now = new Date()) {
    const result = await this.store.updateWorkoutCheckin(uid, id, (current) => {
      const transition = transitionCheckin(current, String(action || ""), now);
      return { ...current, ...transition.patch };
    });
    const transition = transitionCheckin(result.before, String(action || ""), now);
    if (transition.event) this.onAnalytics(transition.event, {
      ...this.analyticsProperties(result.after, "dashboard"),
      snooze_count: Number(result.after.snoozeCount) || 0,
      response_duration_seconds: transition.event && asDate(result.before.flowStartedAt)
        ? Math.max(0, Math.round((new Date(now).getTime() - asDate(result.before.flowStartedAt).getTime()) / 1000))
        : undefined,
      completed_most_workout: result.after.completedMostWorkout ?? undefined,
      felt_unusually_difficult: result.after.feltUnusuallyDifficult ?? undefined,
      pain_or_discomfort: result.after.painOrDiscomfort ?? undefined
    });
    return serializeForClient(result.after);
  }

  async markWorkoutCompleted(uid, { planId, workoutId, timezone }, now = new Date()) {
    const context = await this.store.getWorkoutCheckinContext(uid);
    if (!context?.activePlanId || context.activePlanId !== planId || !context.plan) return { updated: false };
    const sessions = context.plan.plan?.sessions || context.plan.sessions || [];
    const sessionIndex = sessions.findIndex((session, index) => String(session.id ?? index) === String(workoutId));
    if (sessionIndex < 0) return { updated: false };
    const zone = isValidTimezone(timezone) ? timezone : context.timezone || "UTC";
    const localDate = zonedDateParts(now, zone).localDate;
    const id = checkinId(uid, planId, sessionIndex, localDate);
    await this.store.markTrackerCompletion(uid, id, now);
    return { updated: true };
  }

  analyticsProperties(checkin, source) {
    return {
      workout_id: String(checkin.workoutId || checkin.sessionIndex || "").slice(0, 80),
      plan_id: String(checkin.planId || "").slice(0, 80),
      scheduled_date: String(checkin.scheduledDate || "").slice(0, 10),
      prompt_number: 1 + (Number(checkin.snoozeCount) || 0),
      source
    };
  }

  async sendDueNotifications({ preferences, now = new Date(), windowMinutes = 20 } = {}) {
    if (!this.pushService) return { considered: 0, due: 0, sent: 0, duplicates: 0, skipped: 0 };
    const summary = { considered: preferences.length, due: 0, sent: 0, duplicates: 0, skipped: 0 };
    for (const preference of preferences) {
      const context = await this.store.getWorkoutCheckinContext(preference.uid);
      if (!context?.plan) { summary.skipped += 1; continue; }
      const timezone = isValidTimezone(preference.timezone) ? preference.timezone : context.timezone || "UTC";
      const local = zonedDateParts(now, timezone);
      const localMinute = local.hour * 60 + local.minute;
      if (local.hour >= PROMPT_HOUR) await this.dashboard(preference.uid, timezone, now, { recordShown: false });
      const checkins = await this.store.listWorkoutCheckins(preference.uid);
      for (const item of checkins) {
        if (item.scheduledDate !== local.localDate || !["pending", "snoozed"].includes(item.status)) continue;
        const snoozeCount = Number(item.snoozeCount) || 0;
        const promptNumber = 1 + snoozeCount;
        const notified = Number(item.notificationCount) || 0;
        const initialDue = item.status === "pending" && localMinute >= PROMPT_HOUR * 60 && localMinute < PROMPT_HOUR * 60 + windowMinutes;
        const nextPromptAt = asDate(item.nextPromptAt);
        const snoozeDue = item.status === "snoozed" && snoozeCount <= MAX_SNOOZES_PER_DAY && nextPromptAt && nextPromptAt <= now;
        if (!(initialDue && notified < 1) && !(snoozeDue && notified < promptNumber)) continue;
        summary.due += 1;
        const result = await this.pushService.sendWorkoutCheckin({
          uid: preference.uid,
          checkinId: item.id,
          planId: item.planId,
          workoutId: item.workoutId,
          sessionName: item.workoutName,
          scheduledDate: item.scheduledDate,
          promptNumber,
          locale: preference.locale
        });
        if (result.duplicate) summary.duplicates += 1;
        else summary.sent += Number(result.sentCount || 0);
        await this.store.updateWorkoutCheckin(preference.uid, item.id, (current) => ({
          ...current,
          notificationCount: Math.max(Number(current.notificationCount) || 0, promptNumber),
          firstPromptedAt: current.firstPromptedAt || new Date(now),
          lastPromptedAt: new Date(now),
          updatedAt: new Date(now)
        }));
      }
    }
    this.logger.info?.("[workout-checkins] notifications completed", summary);
    return summary;
  }
}

module.exports = {
  MAX_SNOOZES_PER_DAY,
  PROMPT_HOUR,
  SNOOZE_MINUTES,
  WorkoutCheckinService,
  checkinAvailable,
  checkinId,
  sessionsForWeekday,
  serializeForClient,
  transitionCheckin
};
