"use strict";

async function cleanupAccountVoiceMessages({ uid, conversations = [], voiceMedia, serverTimestamp }) {
  if (!voiceMedia || typeof voiceMedia.deleteOwnedAsset !== "function") throw new TypeError("Voice cleanup requires the configured media service.");
  if (typeof serverTimestamp !== "function") throw new TypeError("Voice cleanup requires a server timestamp factory.");
  const summary = { deleted: 0, unavailable: 0, ownershipMismatch: 0 };
  for (const conversation of conversations) {
    const messages = await conversation.ref.collection("messages").where("senderUid", "==", uid).get();
    for (const message of messages.docs) {
      const data = message.data() || {};
      if (data.type !== "voice" || data.deletedAt || data.voice?.unavailable) continue;
      const assetId = String(data.voice?.assetId || "").trim();
      if (assetId) {
        const outcome = await voiceMedia.deleteOwnedAsset({ uid, conversationId: conversation.id, assetId });
        if (outcome.status === "deleted" || outcome.status === "already_absent") summary.deleted += 1;
        else if (outcome.status === "ownership_mismatch") summary.ownershipMismatch += 1;
      }
      await message.ref.set({
        voice: {
          durationMs: Number(data.voice?.durationMs || 0),
          mimeType: String(data.voice?.mimeType || "").slice(0, 120),
          sizeBytes: Number(data.voice?.sizeBytes || 0),
          unavailable: true
        },
        deletedAt: serverTimestamp(),
        deletedBy: uid
      }, { merge: true });
      summary.unavailable += 1;
    }
  }
  return summary;
}

module.exports = { cleanupAccountVoiceMessages };
