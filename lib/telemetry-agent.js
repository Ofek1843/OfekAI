"use strict";

const crypto = require("crypto");

const TELEGRAM_API_BASE = "https://api.telegram.org";
const DEFAULT_ALERT_COOLDOWN_MS = 30 * 60 * 1000;
const DEFAULT_DAILY_REPORT_HOUR = 8;
const DEFAULT_HEALTH_INTERVAL_MS = 15 * 60 * 1000;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeText(value, limit = 160) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function shortHash(value) {
  return crypto.createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 12);
}

function formatIsoDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatClock(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function createTelemetryAgent({
  brandName = "FuelPhysique",
  getPublicStats,
  logger = console,
  telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId = process.env.TELEGRAM_CHAT_ID || "",
  enabled = String(process.env.TELEGRAM_MONITOR_ENABLED || "").toLowerCase() !== "false" && Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  alertCooldownMs = Number(process.env.TELEGRAM_ALERT_COOLDOWN_MS || DEFAULT_ALERT_COOLDOWN_MS),
  dailyReportHour = Number(process.env.TELEGRAM_DAILY_REPORT_HOUR || DEFAULT_DAILY_REPORT_HOUR),
  healthIntervalMs = Number(process.env.TELEGRAM_HEALTH_INTERVAL_MS || DEFAULT_HEALTH_INTERVAL_MS),
  reportIntervalMs = Number(process.env.TELEGRAM_REPORT_INTERVAL_MS || 24 * 60 * 60 * 1000)
} = {}) {
  const state = {
    startedAt: Date.now(),
    requestCount: 0,
    errorCount: 0,
    apiErrorCount: 0,
    analyticsEvents: new Map(),
    requestPaths: new Map(),
    uniqueVisitorsByDay: new Map(),
    registrationsByDay: new Map(),
    planSavedByDay: new Map(),
    feedbackByDay: new Map(),
    recentErrors: [],
    recentFeedback: [],
    lastSummarySignature: "",
    lastDigestAt: 0,
    lastStats: null,
    lastStatsAt: 0,
    timers: new Set(),
    alertSentAtByKey: new Map(),
    sentStartup: false
  };

  const resolvedReportIntervalMs = Math.max(
    5 * 60 * 1000,
    Number.isFinite(reportIntervalMs) ? Number(reportIntervalMs) : 24 * 60 * 60 * 1000
  );

  function incrementMap(map, key, amount = 1) {
    const current = Number(map.get(key) || 0);
    map.set(key, current + amount);
  }

  function pushLimited(list, item, limit = 12) {
    list.unshift(item);
    if (list.length > limit) list.length = limit;
  }

  function bumpDailyCounter(map, amount = 1) {
    incrementMap(map, formatIsoDate(), amount);
  }

  function shouldCooldown(key) {
    const now = Date.now();
    const lastSent = state.alertSentAtByKey.get(key) || 0;
    if (now - lastSent < alertCooldownMs) return true;
    state.alertSentAtByKey.set(key, now);
    return false;
  }

  async function sendTelegramMessage(text, { silent = false } = {}) {
    if (!enabled || !telegramBotToken || !telegramChatId) return false;
    const payload = {
      chat_id: telegramChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      disable_notification: silent
    };
    try {
      const response = await fetch(`${TELEGRAM_API_BASE}/bot${telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Telegram sendMessage failed: ${response.status} ${body.slice(0, 120)}`);
      }
      logger.log("[telemetry] Telegram message sent successfully.");
      return true;
    } catch (error) {
      logger.error("[telemetry] Telegram send failed:", error.message);
      return false;
    }
  }

  async function refreshPublicStats() {
    if (typeof getPublicStats !== "function") return null;
    try {
      const stats = await getPublicStats();
      state.lastStats = stats;
      state.lastStatsAt = Date.now();
      return stats;
    } catch (error) {
      state.errorCount += 1;
      state.apiErrorCount += 1;
      pushLimited(state.recentErrors, {
        key: "public-stats",
        message: error.message,
        at: new Date().toISOString()
      });
      logger.error("[telemetry] public stats refresh failed:", error.message);
      return null;
    }
  }

  function buildDailyDigest(stats) {
    const visitorsToday = Number(state.uniqueVisitorsByDay.get(formatIsoDate())?.size || 0);
    const registrationsToday = Number(state.registrationsByDay.get(formatIsoDate()) || 0);
    const workoutPlansSavedToday = Number(state.planSavedByDay.get(`${formatIsoDate()}:workout`) || 0);
    const nutritionPlansSavedToday = Number(state.planSavedByDay.get(`${formatIsoDate()}:nutrition`) || 0);
    const feedbackToday = Number(state.feedbackByDay.get(formatIsoDate()) || 0);
    const totalRequests = state.requestCount;
    const errorRequests = state.apiErrorCount;
    const activeProSubscribers = Number(stats?.activeProSubscribers || 0);
    const estimatedMonthlyRevenueIls = activeProSubscribers * 25;
    const revenueLine = activeProSubscribers
      ? `הכנסה חודשית חוזרת משוערת: ${estimatedMonthlyRevenueIls.toLocaleString("he-IL")} ש״ח לחודש (${activeProSubscribers.toLocaleString("he-IL")} מנויי פרו פעילים).`
      : "עדיין אין נתוני הכנסה, כי כרגע אין מנויי פרו פעילים.";

    const topEvents = [...state.analyticsEvents.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([event, count]) => `${escapeHtml(event)} (${count})`)
      .join(", ") || "אין כרגע";

    const recentErrors = state.recentErrors
      .slice(0, 4)
      .map(item => `• ${escapeHtml(item.key)} — ${escapeHtml(item.message)}`)
      .join("\n") || "• אין שגיאות חדשות";

    const feedbackLine = feedbackToday
      ? `התקבלו היום ${feedbackToday.toLocaleString("he-IL")} דיווחים על באגים.`
      : "לא התקבלו היום דיווחי באגים חדשים.";

    return [
      `🚨 <b>${escapeHtml(brandName)} — דוח תפעול יומי</b>`,
      `שעה: ${escapeHtml(formatClock())} (שעון ישראל)`,
      "",
      `<b>מצב האתר</b>: ${stats?.fallback ? "פועל במצב fallback לסטטיסטיקה הציבורית" : "פועל תקין עם מונים חיים"}`,
      `<b>מבקרים היום</b>: ${visitorsToday.toLocaleString("he-IL")}`,
      `<b>נרשמים חדשים היום</b>: ${registrationsToday.toLocaleString("he-IL")}`,
      `<b>תוכניות אימון שנשמרו היום</b>: ${workoutPlansSavedToday.toLocaleString("he-IL")}`,
      `<b>תפריטי תזונה שנשמרו היום</b>: ${nutritionPlansSavedToday.toLocaleString("he-IL")}`,
      `<b>סה״כ בקשות שנצפו</b>: ${totalRequests.toLocaleString("he-IL")}`,
      `<b>שגיאות API שנצפו</b>: ${errorRequests.toLocaleString("he-IL")}`,
      `<b>האירועים הבולטים</b>: ${topEvents}`,
      `<b>פידבק משתמשים</b>: ${feedbackLine}`,
      `<b>הכנסה</b>: ${revenueLine}`,
      "",
      "<b>שגיאות אחרונות</b>",
      recentErrors,
      "",
      "הפעולה עם ה-ROI הגבוה ביותר שכדאי לעשות עכשיו: לטפל קודם בתקלה החוזרת האחרונה או בירידה בהמרה, לפני שמוסיפים פיצ'רים חדשים."
    ].join("\n");
  }

  async function sendDailyDigest(reason = "scheduled") {
    const stats = await refreshPublicStats();
    const digest = buildDailyDigest(stats || state.lastStats || {});
    const signature = shortHash(digest);
    if (signature === state.lastSummarySignature && reason !== "startup") return false;
    state.lastSummarySignature = signature;
    state.lastDigestAt = Date.now();
    return sendTelegramMessage(digest);
  }

  function recordAnalytics(eventName, context = {}) {
    const event = safeText(eventName, 40);
    if (!event) return;
    incrementMap(state.analyticsEvents, event);

    const date = formatIsoDate();
    const path = safeText(context.path || "", 120);
    if (event === "signup_completed") incrementMap(state.registrationsByDay, date);
    if (event === "plan_saved" && String(context.type || "").toLowerCase() === "workout") incrementMap(state.planSavedByDay, `${date}:workout`);
    if (event === "plan_saved" && String(context.type || "").toLowerCase() === "nutrition") incrementMap(state.planSavedByDay, `${date}:nutrition`);
    if (event === "page_view" || event === "landing_page_view") {
      const fingerprint = shortHash([date, context.ip || "", context.userAgent || "", path].join("|"));
      state.uniqueVisitorsByDay.set(date, state.uniqueVisitorsByDay.get(date) || new Set());
      state.uniqueVisitorsByDay.get(date).add(fingerprint);
    }
  }

  async function maybeAlert(key, title, details, { silent = false } = {}) {
    if (!enabled) return false;
    const cooldownKey = safeText(key, 120);
    if (shouldCooldown(cooldownKey)) return false;
    const text = [
      `🚨 <b>${escapeHtml(title)}</b>`,
      escapeHtml(details),
      "",
      "למה זה חשוב: זה עלול לפגוע בהמרה, בשמירת תוכניות או באמון המשתמשים.",
      "פעולה מומלצת: לבדוק את ה-endpoint או את ה-flow שנכשלו, ואז להעלות תיקון."
    ].join("\n");
    return sendTelegramMessage(text, { silent });
  }

  function recordFeedback(entry = {}) {
    const message = safeText(entry.message, 500);
    if (!message) return;
    const date = formatIsoDate();
    incrementMap(state.feedbackByDay, date);
    pushLimited(state.recentFeedback, {
      message,
      page: safeText(entry.page || "", 160),
      category: safeText(entry.category || "bug", 40),
      at: new Date().toISOString()
    }, 20);
  }

  function recordRequest(entry = {}) {
    state.requestCount += 1;
    const path = safeText(entry.path || "", 120) || "/";
    const method = safeText(entry.method || "GET", 8);
    const status = Number(entry.status || 0);
    const durationMs = Number(entry.durationMs || 0);
    incrementMap(state.requestPaths, `${method} ${path}`);
    if (status >= 400) state.errorCount += 1;
    if (status >= 500) {
      state.apiErrorCount += 1;
      pushLimited(state.recentErrors, {
        key: `${method} ${path} ${status}`,
        message: `${status} response in ${Math.max(0, Math.round(durationMs))}ms`,
        at: new Date().toISOString()
      });
      maybeAlert(
        `${method} ${path} ${status}`,
        `${brandName} — שגיאת שרת`,
        `${method} ${path} החזיר ${status} בתוך ${Math.max(0, Math.round(durationMs))}ms.`
      );
    }
  }

  function getSnapshot() {
    const today = formatIsoDate();
    const uniqueVisitorsToday = state.uniqueVisitorsByDay.get(today)?.size || 0;
    const topRequests = [...state.requestPaths.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
    return {
      startedAt: state.startedAt,
      uptimeMs: Date.now() - state.startedAt,
      requestCount: state.requestCount,
      errorCount: state.errorCount,
      apiErrorCount: state.apiErrorCount,
      uniqueVisitorsToday,
      registrationsToday: Number(state.registrationsByDay.get(today) || 0),
      workoutPlansSavedToday: Number(state.planSavedByDay.get(`${today}:workout`) || 0),
      nutritionPlansSavedToday: Number(state.planSavedByDay.get(`${today}:nutrition`) || 0),
      feedbackToday: Number(state.feedbackByDay.get(today) || 0),
      topEvents: [...state.analyticsEvents.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      topRequests,
      recentErrors: state.recentErrors.slice(0, 8),
      recentFeedback: state.recentFeedback.slice(0, 8),
      lastStatsAt: state.lastStatsAt,
      lastStats: state.lastStats
    };
  }

  function scheduleNextDailyDigest() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(dailyReportHour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return Math.max(60_000, next.getTime() - now.getTime());
  }

  function start() {
    if (!enabled) {
      logger.log("[telemetry] Telegram monitor disabled or not configured.", {
        hasBotToken: Boolean(telegramBotToken),
        hasChatId: Boolean(telegramChatId),
        envDisabled: String(process.env.TELEGRAM_MONITOR_ENABLED || "").toLowerCase() === "false",
        visibleTelegramEnvKeys: Object.keys(process.env)
          .filter(key => key.startsWith("TELEGRAM_"))
          .sort()
      });
      return;
    }

    logger.log("[telemetry] Telegram monitor enabled.", {
      dailyReportHour,
      healthIntervalMs,
      reportIntervalMs: resolvedReportIntervalMs
    });

    if (!state.sentStartup) {
      state.sentStartup = true;
      const startupTimer = setTimeout(() => {
        state.timers.delete(startupTimer);
        sendTelegramMessage([
          `✅ <b>${escapeHtml(brandName)} — הסוכן הופעל</b>`,
          `שעה: ${escapeHtml(formatClock())} (שעון ישראל)`,
          "הסוכן עוקב עכשיו אחרי בריאות האתר, אנליטיקה ופידבק מהמשתמשים.",
          "הפעולה עם ה-ROI הגבוה ביותר שכדאי לעשות עכשיו: להמתין לדוח הראשון ולבדוק אם יש תקלות חוזרות או נזילות בהמרה."
        ].join("\n"), { silent: false });
      }, 5_000).unref?.();
      state.timers.add(startupTimer);

      const startupDigestTimer = setTimeout(() => {
        state.timers.delete(startupDigestTimer);
        sendDailyDigest("startup").catch(error => {
          logger.error("[telemetry] startup digest failed:", error.message);
        });
      }, 20_000);
      startupDigestTimer.unref?.();
      state.timers.add(startupDigestTimer);
    }

    const healthTimer = setInterval(async () => {
      await refreshPublicStats();
    }, healthIntervalMs);
    healthTimer.unref?.();
    state.timers.add(healthTimer);

    const scheduleDigest = (delay) => {
      const timer = setTimeout(async () => {
        state.timers.delete(timer);
        try {
          await sendDailyDigest("scheduled");
        } catch (error) {
          logger.error("[telemetry] scheduled digest failed:", error.message);
        }
        scheduleDigest(resolvedReportIntervalMs);
      }, delay);
      timer.unref?.();
      state.timers.add(timer);
    };

    scheduleDigest(Math.min(scheduleNextDailyDigest(), resolvedReportIntervalMs));
  }

  function stop() {
    for (const timer of state.timers) clearInterval(timer), clearTimeout(timer);
    state.timers.clear();
  }

  return {
    enabled,
    recordAnalytics,
    recordFeedback,
    recordRequest,
    getSnapshot,
    sendTelegramMessage,
    sendDailyDigest,
    maybeAlert,
    start,
    stop
  };
}

module.exports = {
  createTelemetryAgent
};
