"use strict";

const { FieldPath, FieldValue } = require("firebase-admin/firestore");
const { getFuelPhysiqueFirestore } = require("./firebase-admin");
const { hashIdentifier, normalizePreferences } = require("./push-domain");

function serverTimestamp() {
  return FieldValue.serverTimestamp();
}

class FirestorePushStore {
  constructor(db = null) {
    // Keep Firebase Admin lazy. Push can be disabled in local/test processes,
    // and eagerly resolving application-default credentials here delays the
    // server health endpoint even though no notification operation is used.
    this._db = db;
  }

  get db() {
    this._db ||= getFuelPhysiqueFirestore();
    return this._db;
  }

  async upsertInstallation(registration) {
    const ref = this.db.doc(`pushInstallations/${registration.installationHash}`);
    const current = await ref.get();
    await ref.set({
      ...registration,
      fcmToken: FieldValue.delete(),
      status: registration.capability === "granted" ? "active" : "inactive",
      createdAt: current.exists ? current.data().createdAt || serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp()
    }, { merge: true });
    return { installationHash: registration.installationHash, status: registration.capability === "granted" ? "active" : "inactive" };
  }

  async removeInstallation(uid, installationHash) {
    const ref = this.db.doc(`pushInstallations/${installationHash}`);
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists && snapshot.data().uid === uid) transaction.delete(ref);
    });
    return { removed: true };
  }

  async removeAllForUser(uid) {
    let removed = 0;
    while (true) {
      const snapshot = await this.db.collection("pushInstallations").where("uid", "==", uid).limit(499).get();
      const batch = this.db.batch();
      snapshot.docs.forEach((item) => batch.delete(item.ref));
      if (removed === 0) batch.delete(this.db.doc(`notificationPreferences/${uid}`));
      await batch.commit();
      removed += snapshot.size;
      if (snapshot.size < 499) break;
    }
    return { removed };
  }

  async getPreferences(uid) {
    const snapshot = await this.db.doc(`notificationPreferences/${uid}`).get();
    return normalizePreferences(snapshot.exists ? snapshot.data() : {});
  }

  async updatePreferences(uid, input) {
    const ref = this.db.doc(`notificationPreferences/${uid}`);
    const current = await ref.get();
    const preferences = normalizePreferences(input, current.exists ? current.data() : {});
    await ref.set({
      uid,
      ...preferences,
      createdAt: current.exists ? current.data().createdAt || serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    return preferences;
  }

  async listActiveInstallations(uid) {
    const snapshot = await this.db.collection("pushInstallations").where("uid", "==", uid).limit(20).get();
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.status === "active" && item.capability === "granted" && item.fid).slice(0, 10);
  }

  async deactivateInstallation(installationHash, providerCode) {
    await this.db.doc(`pushInstallations/${installationHash}`).set({
      status: "stale",
      fid: FieldValue.delete(),
      fcmToken: FieldValue.delete(),
      providerCode: String(providerCode || "stale").slice(0, 100),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  async claimEvent(eventId, data = {}) {
    const ref = this.db.doc(`pushEvents/${hashIdentifier(eventId)}`);
    try {
      await ref.create({
        eventHash: hashIdentifier(eventId),
        type: String(data.type || "unknown").slice(0, 40),
        recipientUid: String(data.recipientUid || "").slice(0, 128),
        status: "claimed",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      if (error?.code === 6 || error?.code === "already-exists") return false;
      throw error;
    }
  }

  async completeEvent(eventId, result) {
    await this.db.doc(`pushEvents/${hashIdentifier(eventId)}`).set({
      status: "completed",
      sentCount: Number(result.sentCount || 0),
      staleCount: Number(result.staleCount || 0),
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  async getAuthoritativeMessage(conversationId, messageId) {
    const [conversation, message] = await Promise.all([
      this.db.doc(`conversations/${conversationId}`).get(),
      this.db.doc(`conversations/${conversationId}/messages/${messageId}`).get()
    ]);
    if (!conversation.exists || !message.exists) return null;
    return { conversation: { id: conversation.id, ...conversation.data() }, message: { id: message.id, ...message.data() } };
  }

  async getAuthoritativeFriendRequest(requestId) {
    const snapshot = await this.db.doc(`friendRequests/${String(requestId || "").slice(0, 300)}`).get();
    return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
  }

  async getSenderName(uid) {
    const [profile, user] = await Promise.all([
      this.db.doc(`socialProfiles/${uid}`).get(),
      this.db.doc(`users/${uid}`).get()
    ]);
    return profile.data()?.displayName || profile.data()?.username || user.data()?.displayName || "FuelPhysique member";
  }

  async getRecipientLocale(uid) {
    const [preferencesSnapshot, settings] = await Promise.all([
      this.db.doc(`notificationPreferences/${uid}`).get(),
      this.db.doc(`users/${uid}/settings/main`).get()
    ]);
    const storedPreferences = preferencesSnapshot.exists ? preferencesSnapshot.data() : {};
    return normalizePreferences({
      ...storedPreferences,
      locale: storedPreferences.locale || settings.data()?.language || "en"
    });
  }

  async listReminderPreferences(pageSize = 500) {
    const boundedPageSize = Math.max(1, Math.min(500, Number(pageSize) || 500));
    const preferences = [];
    let cursor = null;
    while (true) {
      let query = this.db.collection("notificationPreferences")
        .where("eligibleForWorkoutReminders", "==", true)
        .orderBy(FieldPath.documentId())
        .limit(boundedPageSize);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      preferences.push(...snapshot.docs.map((item) => ({ uid: item.id, ...normalizePreferences(item.data()) })));
      if (snapshot.size < boundedPageSize) break;
      cursor = snapshot.docs[snapshot.docs.length - 1];
    }
    return preferences;
  }

  async getWorkoutReminderContext(uid) {
    const user = await this.db.doc(`users/${uid}`).get();
    const activePlanId = user.data()?.activeWorkoutPlanId;
    if (!user.exists || !activePlanId) return null;
    const [plan, logs] = await Promise.all([
      this.db.doc(`users/${uid}/workoutPlans/${activePlanId}`).get(),
      this.db.collection(`users/${uid}/workoutLogs`).orderBy("completedAt", "desc").limit(20).get()
    ]);
    if (!plan.exists) return null;
    return {
      activePlanId,
      plan: { id: plan.id, ...plan.data() },
      logs: logs.docs.map((item) => ({ id: item.id, ...item.data() }))
    };
  }

  async getWorkoutCheckinContext(uid) {
    const userRef = this.db.doc(`users/${uid}`);
    const settingsRef = this.db.doc(`users/${uid}/settings/main`);
    const preferencesRef = this.db.doc(`notificationPreferences/${uid}`);
    const [user, settings, preferences] = await Promise.all([userRef.get(), settingsRef.get(), preferencesRef.get()]);
    if (!user.exists) return null;
    const activePlanId = user.data()?.activeWorkoutPlanId || "";
    const [plan, logs] = await Promise.all([
      activePlanId ? this.db.doc(`users/${uid}/workoutPlans/${activePlanId}`).get() : Promise.resolve(null),
      this.db.collection(`users/${uid}/workoutLogs`).orderBy("completedAt", "desc").limit(100).get()
    ]);
    return {
      activePlanId,
      plan: plan?.exists ? { id: plan.id, ...plan.data() } : null,
      logs: logs.docs.map((item) => ({ id: item.id, ...item.data() })),
      timezone: preferences.data()?.timezone || settings.data()?.timezone || settings.data()?.timeZone || "UTC",
      locale: preferences.data()?.locale || settings.data()?.language || "en"
    };
  }

  async updateWorkoutCheckinTimezone(uid, timezone) {
    const settingsRef = this.db.doc(`users/${uid}/settings/main`);
    const preferencesRef = this.db.doc(`notificationPreferences/${uid}`);
    const [settings, preferences] = await Promise.all([settingsRef.get(), preferencesRef.get()]);
    if (settings.data()?.timezone === timezone && (!preferences.exists || preferences.data()?.timezone === timezone)) return;
    const batch = this.db.batch();
    batch.set(settingsRef, { timezone, updatedAt: serverTimestamp() }, { merge: true });
    if (preferences.exists) batch.set(preferencesRef, { timezone, updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
  }

  async ensureWorkoutCheckin(uid, id, data) {
    const ref = this.db.doc(`users/${uid}/workoutCheckins/${id}`);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) return { created: false, checkin: { id: snapshot.id, ...snapshot.data() } };
      transaction.create(ref, { ...data, ownerUid: uid });
      return { created: true, checkin: { id, ...data } };
    });
  }

  async listWorkoutCheckins(uid) {
    const collection = this.db.collection(`users/${uid}/workoutCheckins`);
    const [unresolved, recent] = await Promise.all([
      collection.where("status", "in", ["pending", "snoozed"]).limit(100).get(),
      collection.orderBy("scheduledDate", "desc").limit(30).get()
    ]);
    const documents = new Map();
    for (const snapshot of [...unresolved.docs, ...recent.docs]) {
      documents.set(snapshot.id, { id: snapshot.id, ...snapshot.data() });
    }
    return [...documents.values()];
  }

  async updateWorkoutCheckin(uid, id, updater) {
    const ref = this.db.doc(`users/${uid}/workoutCheckins/${String(id || "").slice(0, 128)}`);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists || snapshot.data()?.ownerUid !== uid) {
        const error = new Error("Workout check-in not found.");
        error.status = 404;
        error.code = "checkin_not_found";
        throw error;
      }
      const before = { id: snapshot.id, ...snapshot.data() };
      const after = updater(before);
      transaction.set(ref, { ...after, ownerUid: uid });
      return { before, after: { id: snapshot.id, ...after, ownerUid: uid } };
    });
  }

  async touchWorkoutCheckin(uid, id, now = new Date()) {
    return this.updateWorkoutCheckin(uid, id, (current) => ({
      ...current,
      firstPromptedAt: current.firstPromptedAt || now,
      inAppShownAt: current.inAppShownAt || now,
      lastPromptedAt: now,
      updatedAt: now
    }));
  }

  async markTrackerCompletion(uid, id, now = new Date()) {
    const ref = this.db.doc(`users/${uid}/workoutCheckins/${String(id || "").slice(0, 128)}`);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists || snapshot.data()?.ownerUid !== uid) return false;
      const current = snapshot.data();
      if (!["pending", "snoozed"].includes(current.status)) return false;
      transaction.set(ref, {
        status: "completed",
        step: "done",
        completionSource: "workout_tracker",
        completedAt: now,
        updatedAt: now
      }, { merge: true });
      return true;
    });
  }
}

module.exports = { FirestorePushStore };
