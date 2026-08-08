"use strict";

const crypto = require("crypto");
const { FieldValue } = require("firebase-admin/firestore");
const { getFuelPhysiqueAuth, getFuelPhysiqueFirestore, getFuelPhysiqueStorage } = require("./firebase-admin");

const USER_SUBCOLLECTIONS = Object.freeze([
  "athleteCore", "settings", "workoutPlans", "nutritionPlans", "workoutLogs",
  "weightEntries", "bodyMeasurements", "progressPhotos", "runs", "conversations",
  "leaderboardSubmissions", "transformationSubmissions", "waitlists", "blocks",
  "conversationSummaries", "sharedImports"
]);

function uidHash(uid) {
  return crypto.createHash("sha256").update(String(uid)).digest("hex");
}

function accountError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function serializable(value) {
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializable);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializable(item)]));
}

class AccountService {
  constructor({ db = null, auth = null, storage = null, pushService = null, imageCleanup = null, now = () => new Date() } = {}) {
    this._db = db;
    this._auth = auth;
    this._storage = storage;
    this.pushService = pushService;
    this.imageCleanup = imageCleanup;
    this.now = now;
  }

  get db() { this._db ||= getFuelPhysiqueFirestore(); return this._db; }
  get auth() { this._auth ||= getFuelPhysiqueAuth(); return this._auth; }
  get storage() { this._storage ||= getFuelPhysiqueStorage(); return this._storage; }

  async exportAccount(uid) {
    const root = this.db.doc(`users/${uid}`);
    const profile = await root.get();
    const social = await this.db.doc(`socialProfiles/${uid}`).get();
    const collections = {};
    for (const name of USER_SUBCOLLECTIONS) {
      const snapshot = await root.collection(name).get();
      collections[name] = snapshot.docs.map((item) => ({ id: item.id, ...serializable(item.data()) }));
    }
    const ownArtifacts = await this.db.collection("sharedArtifacts").where("ownerUid", "==", uid).get();
    // The export intentionally excludes other members' conversations,
    // profiles, tokens, payment provider IDs and administrative reports.
    return {
      schemaVersion: 1,
      generatedAt: this.now().toISOString(),
      account: profile.exists ? serializable(profile.data()) : {},
      socialProfile: social.exists ? serializable(social.data()) : null,
      collections,
      sharedArtifacts: ownArtifacts.docs.map((item) => ({ id: item.id, ...serializable(item.data()) }))
    };
  }

  async deleteDocumentTree(ref) {
    const subcollections = await ref.listCollections();
    for (const collection of subcollections) {
      const snapshot = await collection.get();
      for (const document of snapshot.docs) await this.deleteDocumentTree(document.ref);
    }
    await ref.delete();
  }

  async deleteQuery(query) {
    const snapshot = await query.get();
    for (const item of snapshot.docs) await this.deleteDocumentTree(item.ref);
    return snapshot.size;
  }

  async cleanupImageReferences(uid) {
    const photoCollections = ["progressPhotos", "transformationSubmissions"];
    const fileIds = new Set();
    for (const name of photoCollections) {
      const snapshot = await this.db.collection(`users/${uid}/${name}`).get();
      for (const item of snapshot.docs) {
        const value = item.data() || {};
        for (const key of ["fileId", "beforeFileId", "afterFileId"]) if (value[key]) fileIds.add(String(value[key]));
        for (const key of ["storagePath", "filePath", "beforePath", "afterPath"]) {
          const storagePath = String(value[key] || "");
          if (storagePath.startsWith(`users/${uid}/`)) await this.storage.bucket().file(storagePath).delete({ ignoreNotFound: true });
        }
      }
    }
    if (fileIds.size && typeof this.imageCleanup !== "function") {
      throw accountError("media_cleanup_unavailable", "Account media cleanup is temporarily unavailable.", 503);
    }
    for (const fileId of fileIds) await this.imageCleanup(uid, fileId);
    return fileIds.size;
  }

  async deleteAccount(uid, { confirmed = false, reauthenticatedAt = 0 } = {}) {
    if (confirmed !== true) throw accountError("account_deletion_confirmation_required", "Type the confirmation phrase before deleting your account.");
    if (!Number.isFinite(reauthenticatedAt) || reauthenticatedAt <= 0) {
      throw accountError("reauthentication_required", "Reauthentication is required before account deletion.", 401);
    }
    const hash = uidHash(uid);
    const jobRef = this.db.doc(`accountDeletionJobs/${hash}`);
    const existing = await jobRef.get();
    if (existing.exists && existing.data()?.status === "completed") return { deleted: true, idempotent: true };
    await jobRef.set({ uidHash: hash, status: "in_progress", startedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    try {
      await this.cleanupImageReferences(uid);
      if (this.pushService?.removeAllForUser) await this.pushService.removeAllForUser(uid);
      const conversationSnapshot = await this.db.collection("conversations").where("participants", "array-contains", uid).get();
      for (const conversation of conversationSnapshot.docs) {
        for (const participant of conversation.data()?.participants || []) {
          await this.db.doc(`users/${participant}/conversationSummaries/${conversation.id}`).delete();
        }
        await this.deleteDocumentTree(conversation.ref);
      }
      const receivedArtifacts = await this.db.collection("sharedArtifacts").where("recipientIds", "array-contains", uid).get();
      for (const artifact of receivedArtifacts.docs) {
        if (artifact.data()?.ownerUid === uid) continue;
        await artifact.ref.update({ recipientIds: FieldValue.arrayRemove(uid), updatedAt: FieldValue.serverTimestamp() });
      }
      await Promise.all([
        this.deleteQuery(this.db.collection("friendRequests").where("fromUid", "==", uid)),
        this.deleteQuery(this.db.collection("friendRequests").where("toUid", "==", uid)),
        this.deleteQuery(this.db.collection("friendships").where("participants", "array-contains", uid)),
        this.deleteQuery(this.db.collection("sharedArtifacts").where("ownerUid", "==", uid)),
        this.deleteQuery(this.db.collection("usernames").where("uid", "==", uid))
      ]);
      await this.deleteDocumentTree(this.db.doc(`socialProfiles/${uid}`));
      await this.deleteDocumentTree(this.db.doc(`users/${uid}`));
      // Auth is intentionally last: a failure above leaves a signed-in user
      // able to retry rather than orphaning private data.
      await this.auth.deleteUser(uid);
      await jobRef.set({ status: "completed", completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await this.db.doc(`accountDeletionAudits/${hash}`).set({ uidHash: hash, completedAt: FieldValue.serverTimestamp(), outcome: "deleted" });
      return { deleted: true, idempotent: false };
    } catch (error) {
      await jobRef.set({ status: "failed", failureCode: String(error.code || "cleanup_failed").slice(0, 80), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      throw error;
    }
  }
}

module.exports = { AccountService, USER_SUBCOLLECTIONS, accountError, serializable, uidHash };
