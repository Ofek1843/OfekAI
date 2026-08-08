"use strict";

const crypto = require("crypto");
const { FieldValue } = require("firebase-admin/firestore");
const { getFuelPhysiqueAuth, getFuelPhysiqueFirestore, getFuelPhysiqueStorage } = require("./firebase-admin");
const { mediaReferencesFromDocuments } = require("./account-media");

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
  constructor({ db = null, auth = null, storage = null, pushService = null, imageCleanup = null, voiceCleanup = null, now = () => new Date() } = {}) {
    this._db = db;
    this._auth = auth;
    this._storage = storage;
    this.pushService = pushService;
    this.imageCleanup = imageCleanup;
    this.voiceCleanup = voiceCleanup;
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
    const conversationSnapshot = await this.db.collection("conversations").where("participants", "array-contains", uid).get();
    const voiceMessages = [];
    for (const conversation of conversationSnapshot.docs) {
      const messages = await conversation.ref.collection("messages").get();
      for (const item of messages.docs) {
        const message = item.data() || {};
        if (message.type !== "voice") continue;
        voiceMessages.push({
          id: item.id,
          conversationId: conversation.id,
          senderUid: message.senderUid,
          direction: message.senderUid === uid ? "sent" : "received",
          createdAt: serializable(message.createdAt),
          durationMs: Number(message.voice?.durationMs || 0),
          mimeType: String(message.voice?.mimeType || ""),
          sizeBytes: Number(message.voice?.sizeBytes || 0),
          available: !message.deletedAt && message.voice?.unavailable !== true
        });
      }
    }
    // The export intentionally excludes other members' conversations,
    // profiles, tokens, payment provider IDs and administrative reports.
    return {
      schemaVersion: 1,
      generatedAt: this.now().toISOString(),
      account: profile.exists ? serializable(profile.data()) : {},
      socialProfile: social.exists ? serializable(social.data()) : null,
      collections,
      sharedArtifacts: ownArtifacts.docs.map((item) => ({ id: item.id, ...serializable(item.data()) })),
      voiceMessages,
      voiceMedia: {
        rawAudioIncluded: false,
        access: "Available voice messages remain accessible through authenticated conversation playback; the structured export contains metadata only."
      }
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
    const records = [];
    for (const name of photoCollections) {
      const snapshot = await this.db.collection(`users/${uid}/${name}`).get();
      records.push(...snapshot.docs.map((item) => item.data() || {}));
    }
    const references = mediaReferencesFromDocuments(records);
    for (const storagePath of references.storagePaths) {
      // Firebase Storage legacy files are namespaced by UID. ImageKit files
      // are NEVER trusted from this document data; see imageCleanup below.
      if (storagePath.startsWith(`users/${uid}/`)) await this.storage.bucket().file(storagePath).delete({ ignoreNotFound: true });
    }
    if (references.imageKitFileIds.length && typeof this.imageCleanup !== "function") {
      throw accountError("media_cleanup_unavailable", "Account media cleanup is temporarily unavailable.", 503);
    }
    const summary = { deleted: 0, legacyUnverified: 0, storageDeleted: references.storagePaths.length };
    for (const fileId of references.imageKitFileIds) {
      const outcome = await this.imageCleanup(uid, fileId);
      if (outcome?.status === "deleted" || outcome?.status === "already_absent") summary.deleted += 1;
      else summary.legacyUnverified += 1;
    }
    return summary;
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
    let cleanupReady = existing.data()?.status === "ready_for_auth_delete";
    // Never downgrade a durable pre-Auth checkpoint.  If the Auth deletion
    // previously failed, a retry must be able to proceed without repeating
    // cleanup against data that is already gone.
    if (!cleanupReady) {
      await jobRef.set({ uidHash: hash, status: "in_progress", startedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    try {
      if (!cleanupReady) {
        const media = { images: await this.cleanupImageReferences(uid), voice: { deleted: 0, unavailable: 0, ownershipMismatch: 0 } };
        if (this.pushService?.removeAllForUser) await this.pushService.removeAllForUser(uid);
        const conversationSnapshot = await this.db.collection("conversations").where("participants", "array-contains", uid).get();
        if (typeof this.voiceCleanup === "function") media.voice = await this.voiceCleanup(uid, conversationSnapshot.docs);
        for (const conversation of conversationSnapshot.docs) {
          const participants = conversation.data()?.participants || [];
          // Preserve the survivor's historic messages. A tombstone removes
          // the deleted member's public identity and prevents new messages.
          await conversation.ref.set({
            status: "deleted_participant",
            deletedParticipantUids: FieldValue.arrayUnion(uid),
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
          for (const participant of participants.filter((participant) => participant !== uid)) {
            await this.db.doc(`users/${participant}/conversationSummaries/${conversation.id}`).set({
              conversationId: conversation.id,
              otherUid: uid,
              status: "deleted_participant",
              deletedParticipantUid: uid,
              updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
          }
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
          this.deleteQuery(this.db.collection("sharedArtifacts").where("ownerUid", "==", uid))
        ]);
        await this.deleteDocumentTree(this.db.doc(`socialProfiles/${uid}`));
        await this.deleteDocumentTree(this.db.doc(`users/${uid}`));
        await jobRef.set({ status: "ready_for_auth_delete", mediaCleanup: media, cleanupCompletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        cleanupReady = true;
      }

      // This is the final privacy/security operation. A failed Auth deletion
      // leaves the durable ready state in place, so the authenticated member
      // can retry without re-running destructive cleanup.
      try {
        await this.auth.deleteUser(uid);
      } catch (error) {
        if (error?.code !== "auth/user-not-found") {
          await jobRef.set({ status: "ready_for_auth_delete", failureCode: "auth_delete_failed", updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
          throw error;
        }
      }

      // Release the username only after the Auth identity is no longer active.
      const usernameReleasePending = await this.deleteQuery(this.db.collection("usernames").where("uid", "==", uid))
        .then(() => false)
        .catch(() => true);
      await jobRef.set({ status: "completed", completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
      await this.db.doc(`accountDeletionAudits/${hash}`).set({ uidHash: hash, completedAt: FieldValue.serverTimestamp(), outcome: usernameReleasePending ? "deleted_username_release_pending" : "deleted" }).catch(() => {});
      return { deleted: true, idempotent: false, usernameReleasePending };
    } catch (error) {
      if (!cleanupReady) {
        await jobRef.set({ status: "failed", failureCode: String(error.code || "cleanup_failed").slice(0, 80), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
      }
      throw error;
    }
  }
}

module.exports = { AccountService, USER_SUBCOLLECTIONS, accountError, serializable, uidHash };
