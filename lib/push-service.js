"use strict";

const {
  hashIdentifier,
  isStaleMessagingError,
  normalizeRegistration,
  notificationCopy,
  isValidTimezone
} = require("./push-domain");

class PushNotificationService {
  constructor({ store, transport, logger = console } = {}) {
    if (!store || !transport) throw new TypeError("Push service requires a store and transport.");
    this.store = store;
    this.transport = transport;
    this.logger = logger;
  }

  async registerInstallation(uid, input) {
    const registration = normalizeRegistration(uid, input);
    const result = await this.store.upsertInstallation(registration);
    await this.store.updatePreferences(uid, { locale: registration.locale, timezone: registration.timezone });
    return result;
  }

  async removeInstallation(uid, installationId) {
    if (String(installationId || "").trim().length < 16) {
      const error = new Error("A valid installation identifier is required.");
      error.status = 400;
      error.code = "invalid_installation_id";
      throw error;
    }
    return this.store.removeInstallation(uid, hashIdentifier(installationId));
  }

  async removeAllForUser(uid) {
    return this.store.removeAllForUser(uid);
  }

  getPreferences(uid) {
    return this.store.getPreferences(uid);
  }

  updatePreferences(uid, input) {
    const allowed = new Set(["notificationsEnabled", "newMessages", "sharedPlans", "friendActivity", "workoutReminders", "reminderTime", "showMessagePreviews", "locale", "timezone"]);
    const unknown = Object.keys(input || {}).filter((key) => !allowed.has(key));
    if (!input || typeof input !== "object" || Array.isArray(input) || unknown.length) {
      const error = new Error("Notification preferences contain unsupported fields.");
      error.status = 400;
      error.code = "invalid_preferences";
      throw error;
    }
    for (const key of ["notificationsEnabled", "newMessages", "sharedPlans", "friendActivity", "workoutReminders", "showMessagePreviews"]) {
      if (input[key] !== undefined && typeof input[key] !== "boolean") {
        const error = new Error(`${key} must be true or false.`);
        error.status = 400;
        error.code = "invalid_preferences";
        throw error;
      }
    }
    if (input.locale !== undefined && !["en", "he"].includes(input.locale)) {
      const error = new Error("Notification locale must be en or he.");
      error.status = 400;
      error.code = "invalid_locale";
      throw error;
    }
    if (input?.timezone !== undefined && !isValidTimezone(input.timezone)) {
      const error = new Error("A valid IANA timezone is required.");
      error.status = 400;
      error.code = "invalid_timezone";
      throw error;
    }
    if (input?.reminderTime !== undefined && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(input.reminderTime))) {
      const error = new Error("Reminder time must use HH:mm.");
      error.status = 400;
      error.code = "invalid_reminder_time";
      throw error;
    }
    return this.store.updatePreferences(uid, input);
  }

  async sendEvent({ eventId, recipientUid, type, title, body, url }) {
    if (!this.transport.configured) return { configured: false, sentCount: 0, staleCount: 0 };
    const claimed = await this.store.claimEvent(eventId, { type, recipientUid });
    if (!claimed) return { duplicate: true, sentCount: 0, staleCount: 0 };

    const installations = await this.store.listActiveInstallations(recipientUid);
    let sentCount = 0;
    let staleCount = 0;
    const payload = {
      type,
      title,
      body,
      url,
      eventId: hashIdentifier(eventId).slice(0, 32),
      icon: "/favicon.svg",
      badge: "/favicon.svg"
    };

    await Promise.all(installations.map(async (installation) => {
      try {
        await this.transport.send(installation, payload);
        sentCount += 1;
      } catch (error) {
        if (isStaleMessagingError(error)) {
          staleCount += 1;
          await this.store.deactivateInstallation(installation.installationHash || installation.id, error.code);
          return;
        }
        this.logger.error("[push] delivery failed", {
          type,
          event: hashIdentifier(eventId).slice(0, 12),
          providerCode: String(error?.code || "unknown").slice(0, 100)
        });
      }
    }));

    const result = { duplicate: false, sentCount, staleCount };
    await this.store.completeEvent(eventId, result);
    this.logger.info?.("[push] delivery", { type, event: hashIdentifier(eventId).slice(0, 12), targets: installations.length, sentCount, staleCount });
    return result;
  }

  async notifySocialMessage({ senderUid, conversationId, messageId }) {
    // Feature-off environments must not initialize Firebase Admin or perform
    // extra Social reads merely because a message was committed.
    if (!this.transport.configured) return { configured: false, sentCount: 0, staleCount: 0 };
    const authoritative = await this.store.getAuthoritativeMessage(conversationId, messageId);
    if (!authoritative) return { skipped: "message_missing" };
    const { conversation, message } = authoritative;
    const participants = Array.isArray(conversation.participants) ? conversation.participants : [];
    if (participants.length !== 2 || message.senderUid !== senderUid || !participants.includes(senderUid)) return { skipped: "authority_failed" };
    const recipientUid = participants.find((uid) => uid !== senderUid);
    if (!recipientUid || recipientUid === senderUid) return { skipped: "self" };

    const preferences = await this.store.getRecipientLocale(recipientUid);
    if (preferences.notificationsEnabled === false) return { skipped: "disabled" };
    const senderName = await this.store.getSenderName(senderUid);
    let type;
    let text = "";
    let url = `/social.html?conversation=${encodeURIComponent(conversationId)}`;
    if (message.type === "text") {
      if (preferences.newMessages === false) return { skipped: "messages_disabled" };
      type = "message";
      text = preferences.showMessagePreviews === false ? "" : message.text;
    } else if (message.type === "voice") {
      if (preferences.newMessages === false) return { skipped: "messages_disabled" };
      // Never place audio data, provider identifiers, URLs, or recording
      // metadata in a push payload. The authenticated Social screen resolves
      // the message only after the member opens the conversation.
      type = "voice_message";
    } else if (message.type === "artifact" && message.artifactType === "workout") {
      if (preferences.sharedPlans === false) return { skipped: "shares_disabled" };
      type = "workout_share";
      url += `&artifact=${encodeURIComponent(message.artifactId)}`;
    } else if (message.type === "artifact" && message.artifactType === "nutrition") {
      if (preferences.sharedPlans === false) return { skipped: "shares_disabled" };
      type = "nutrition_share";
      url += `&artifact=${encodeURIComponent(message.artifactId)}`;
    } else {
      return { skipped: "unsupported_type" };
    }

    const copy = notificationCopy({ type, locale: preferences.locale, senderName, text });
    return this.sendEvent({
      eventId: `social:${conversationId}:${messageId}`,
      recipientUid,
      type,
      title: copy.title,
      body: copy.body,
      url
    });
  }

  async notifyFriendRequestCreated({ actorUid, requestId }) {
    if (!this.transport.configured) return { configured: false, sentCount: 0, staleCount: 0 };
    const request = await this.store.getAuthoritativeFriendRequest(requestId);
    if (!request || request.status !== "pending" || request.fromUid !== actorUid) return { skipped: "authority_failed" };
    const recipientUid = request.toUid;
    const preferences = await this.store.getRecipientLocale(recipientUid);
    if (preferences.notificationsEnabled === false || preferences.friendActivity === false) return { skipped: "friend_activity_disabled" };
    const senderName = await this.store.getSenderName(actorUid);
    const copy = notificationCopy({ type: "friend_request", locale: preferences.locale, senderName });
    return this.sendEvent({
      eventId: `friend-request:received:${request.requestId || requestId}`,
      recipientUid,
      type: "friend_request",
      title: copy.title,
      body: copy.body,
      url: "/social.html?request=friends"
    });
  }

  async notifyFriendRequestAccepted({ actorUid, requestId }) {
    if (!this.transport.configured) return { configured: false, sentCount: 0, staleCount: 0 };
    const request = await this.store.getAuthoritativeFriendRequest(requestId);
    if (!request || request.status !== "accepted" || request.toUid !== actorUid || request.respondedBy !== actorUid) return { skipped: "authority_failed" };
    const recipientUid = request.fromUid;
    const preferences = await this.store.getRecipientLocale(recipientUid);
    if (preferences.notificationsEnabled === false || preferences.friendActivity === false) return { skipped: "friend_activity_disabled" };
    const senderName = await this.store.getSenderName(actorUid);
    const copy = notificationCopy({ type: "friend_accepted", locale: preferences.locale, senderName });
    return this.sendEvent({
      eventId: `friend-request:accepted:${request.requestId || requestId}`,
      recipientUid,
      type: "friend_accepted",
      title: copy.title,
      body: copy.body,
      url: "/social.html?request=friends"
    });
  }

  async sendWorkoutReminder({ uid, activePlanId, sessionId, sessionName, localDate, locale }) {
    const type = "workout_reminder";
    const eventId = `workout:${uid}:${activePlanId}:${sessionId}:${localDate}`;
    const copy = notificationCopy({ type, locale, sessionName, eventSeed: eventId });
    return this.sendEvent({
      eventId,
      recipientUid: uid,
      type,
      title: copy.title,
      body: copy.body,
      url: `/workout-tracker.html?plan=${encodeURIComponent(activePlanId)}&session=${encodeURIComponent(sessionId)}&date=${encodeURIComponent(localDate)}`
    });
  }

  async sendOwnTest(uid, installationId, locale) {
    const installations = await this.store.listActiveInstallations(uid);
    const hash = hashIdentifier(installationId);
    const installation = installations.find((item) => (item.installationHash || item.id) === hash);
    if (!installation) {
      const error = new Error("This installation is not registered to the signed-in account.");
      error.status = 404;
      error.code = "installation_not_found";
      throw error;
    }
    const copy = locale === "he"
      ? { title: "ההתראות פועלות", body: "זו התראת בדיקה שנשלחה רק למכשיר הזה." }
      : { title: "Notifications are working", body: "This test was sent only to this installation." };
    return this.transport.send(installation, {
      type: "test",
      ...copy,
      url: "/dashboard.html",
      eventId: hashIdentifier(`test:${uid}:${installationId}:${Date.now()}`).slice(0, 32),
      icon: "/favicon.svg",
      badge: "/favicon.svg"
    });
  }
}

module.exports = { PushNotificationService };
