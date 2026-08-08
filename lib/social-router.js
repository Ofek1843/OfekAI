"use strict";

const express = require("express");
const social = require("./social-store");
const typing = require("./social-typing");
const { SocialError } = require("./social-domain");

function jsonSafe(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  return value;
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createSocialRouter({ authenticate, rateLimiters = {}, authorizeAdmin = () => false, notifications = null, reportAlert = null, voiceMedia = null, voiceConfig = null }) {
  if (typeof authenticate !== "function") throw new TypeError("Social routes require an authentication function.");
  const router = express.Router();

  router.use(asyncRoute(async (req, res, next) => {
    const user = await authenticate(req, res);
    if (!user) return;
    req.socialUser = user;
    next();
  }));

  function limit(scope) {
    return (req, _res, next) => {
      if (typeof rateLimiters[scope] === "function") rateLimiters[scope](req, req.socialUser.uid);
      next();
    };
  }

  function notifyCommittedMessage(uid, conversationId, result) {
    if (!notifications || result?.duplicate || !result?.message?.id) return;
    // The push service receives identifiers only. It re-reads the committed
    // message and derives sender, recipient and display copy authoritatively.
    void notifications.notifySocialMessage({
      senderUid: uid,
      conversationId,
      messageId: result.message.id
    }).catch((error) => console.error("Social push dispatch failed:", error?.code || error?.name || "unknown"));
  }

  function notifyFriendRequestCreated(uid, result) {
    if (!notifications || !result?.requestId) return;
    void notifications.notifyFriendRequestCreated({ actorUid: uid, requestId: result.requestId })
      .catch((error) => console.error("Friend-request push dispatch failed:", error?.code || error?.name || "unknown"));
  }

  function notifyFriendRequestAccepted(uid, result) {
    if (!notifications || result?.status !== "accepted" || !result?.requestId) return;
    void notifications.notifyFriendRequestAccepted({ actorUid: uid, requestId: result.requestId })
      .catch((error) => console.error("Friend-accepted push dispatch failed:", error?.code || error?.name || "unknown"));
  }

  router.get("/identity", asyncRoute(async (req, res) => {
    res.json(jsonSafe({ profile: await social.getIdentity(req.socialUser.uid) }));
  }));

  router.put("/identity/username", limit("relationships"), asyncRoute(async (req, res) => {
    res.json(jsonSafe({ profile: await social.reserveUsername(req.socialUser.uid, req.body) }));
  }));

  router.get("/profiles/:uid", asyncRoute(async (req, res) => {
    res.json(jsonSafe({ profile: await social.getPublicProfile(req.socialUser.uid, req.params.uid) }));
  }));

  router.put("/profile", limit("relationships"), asyncRoute(async (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const allowed = {
      username: body.username,
      displayName: body.displayName,
      bio: body.bio,
      photoURL: body.photoURL,
      discoverable: body.discoverable,
      allowFriendRequests: body.allowFriendRequests
    };
    res.json(jsonSafe({ profile: await social.updatePublicProfile(req.socialUser.uid, allowed) }));
  }));

  router.put("/admin/badges", limit("relationships"), asyncRoute(async (req, res) => {
    if (!authorizeAdmin(req.socialUser)) return res.status(403).json({ error: "Admin access is required.", code: "admin_required" });
    const targetUid = String(req.body?.targetUid || "").trim();
    res.json(jsonSafe({ profile: await social.setTrustedBadges(targetUid, req.body?.badges) }));
  }));

  router.get("/users/search", limit("search"), asyncRoute(async (req, res) => {
    const mode = req.query.mode === "exact" ? "exact" : "prefix";
    res.json(jsonSafe({ users: await social.searchUsers(req.socialUser.uid, req.query.q, mode) }));
  }));

  router.get("/relationships", asyncRoute(async (req, res) => {
    res.json(jsonSafe(await social.listRelationships(req.socialUser.uid)));
  }));

  router.post("/friend-requests", limit("relationships"), asyncRoute(async (req, res) => {
    const result = await social.sendFriendRequest(req.socialUser.uid, req.body?.targetUid);
    res.status(201).json(jsonSafe(result));
    notifyFriendRequestCreated(req.socialUser.uid, result);
  }));

  router.patch("/friend-requests/:requestId", limit("relationships"), asyncRoute(async (req, res) => {
    const result = await social.actOnFriendRequest(req.socialUser.uid, req.params.requestId, req.body?.action);
    res.json(jsonSafe(result));
    notifyFriendRequestAccepted(req.socialUser.uid, result);
  }));

  router.delete("/friends/:friendUid", limit("relationships"), asyncRoute(async (req, res) => {
    const result = await social.removeFriend(req.socialUser.uid, req.params.friendUid);
    typing.stopForUser(req.socialUser.uid);
    typing.stopForUser(req.params.friendUid);
    res.json(result);
  }));

  router.post("/blocks", limit("relationships"), asyncRoute(async (req, res) => {
    const targetUid = req.body?.targetUid;
    const result = await social.blockUser(req.socialUser.uid, targetUid);
    typing.stopForUser(req.socialUser.uid);
    typing.stopForUser(targetUid);
    res.status(201).json(result);
  }));

  router.delete("/blocks/:targetUid", limit("relationships"), asyncRoute(async (req, res) => {
    res.json(await social.unblockUser(req.socialUser.uid, req.params.targetUid));
  }));

  router.get("/conversations", asyncRoute(async (req, res) => {
    res.json(jsonSafe({ conversations: await social.listConversations(req.socialUser.uid) }));
  }));

  router.post("/conversations", limit("relationships"), asyncRoute(async (req, res) => {
    res.status(201).json(jsonSafe({ conversation: await social.openConversation(req.socialUser.uid, req.body?.friendUid) }));
  }));

  router.get("/conversations/:conversationId/typing/stream", asyncRoute(async (req, res) => {
    const conversation = await social.getConversation(req.socialUser.uid, req.params.conversationId);
    if (conversation.status !== "active") throw new SocialError("conversation_inactive", "This conversation is read-only.", 403);
    res.status(200);
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders?.();
    res.write("data: {\"type\":\"ready\"}\n\n");
    const remove = typing.addStream(req.params.conversationId, req.socialUser.uid, res);
    const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 25000);
    req.on("close", () => {
      clearInterval(keepAlive);
      remove();
    });
  }));

  router.post("/conversations/:conversationId/typing", asyncRoute(async (req, res) => {
    const conversation = await social.getConversation(req.socialUser.uid, req.params.conversationId);
    if (conversation.status !== "active") throw new SocialError("conversation_inactive", "This conversation is read-only.", 403);
    typing.setTyping(req.params.conversationId, req.socialUser.uid, req.body?.typing === true);
    res.status(204).end();
  }));

  router.get("/conversations/:conversationId", asyncRoute(async (req, res) => {
    res.json(jsonSafe({ conversation: await social.getConversation(req.socialUser.uid, req.params.conversationId) }));
  }));

  router.get("/conversations/:conversationId/messages", asyncRoute(async (req, res) => {
    res.json(jsonSafe(await social.listMessages(req.socialUser.uid, req.params.conversationId, req.query.before)));
  }));

  router.get("/voice-config", (_req, res) => {
    res.set("Cache-Control", "private, no-store, max-age=0");
    res.json({
      enabled: Boolean(voiceMedia?.provider),
      maxDurationMs: Number(voiceConfig?.maxDurationMs || 120_000),
      maxBytes: Number(voiceConfig?.maxBytes || 10 * 1024 * 1024)
    });
  });

  router.post("/conversations/:conversationId/messages", limit("messages"), asyncRoute(async (req, res) => {
    const result = await social.sendMessage(req.socialUser.uid, req.params.conversationId, req.body);
    res.status(201).json(jsonSafe(result));
    notifyCommittedMessage(req.socialUser.uid, req.params.conversationId, result);
  }));

  router.post(
    "/conversations/:conversationId/voice-messages",
    limit("voiceMessages"),
    asyncRoute(async (req, res, next) => {
      if (!voiceMedia) throw new SocialError("voice_storage_unavailable", "Voice messages are temporarily unavailable.", 503);
      const clientId = req.get("X-Voice-Client-Id");
      const prepared = await social.prepareVoiceMessage(req.socialUser.uid, req.params.conversationId, clientId);
      if (prepared.duplicate) return res.status(200).json(jsonSafe(prepared));
      req.voicePrepared = prepared;
      next();
    }),
    express.raw({ type: () => true, limit: voiceConfig?.maxBytes || "10mb" }),
    asyncRoute(async (req, res) => {
      const uid = req.socialUser.uid;
      const conversationId = req.params.conversationId;
      const clientId = req.get("X-Voice-Client-Id");
      const voice = await voiceMedia.upload({
        uid,
        conversationId,
        messageId: req.voicePrepared.messageId,
        buffer: req.body,
        mimeType: req.get("Content-Type"),
        durationMs: req.get("X-Voice-Duration-Ms"),
        clientId
      });
      try {
        const result = await social.sendVoiceMessage(uid, conversationId, { clientId, voice });
        if (result.duplicate && result.message?.voice?.assetId !== voice.assetId) {
          await voiceMedia.deleteOwnedAsset({ uid, conversationId, assetId: voice.assetId }).catch(() => {});
        }
        res.status(result.duplicate ? 200 : 201).json(jsonSafe(result));
        notifyCommittedMessage(uid, conversationId, result);
      } catch (error) {
        await voiceMedia.deleteOwnedAsset({ uid, conversationId, assetId: voice.assetId }).catch(() => {});
        throw error;
      }
    })
  );

  router.get("/conversations/:conversationId/messages/:messageId/voice/playback", asyncRoute(async (req, res) => {
    if (!voiceMedia) throw new SocialError("voice_storage_unavailable", "Voice messages are temporarily unavailable.", 503);
    const message = await social.getMessageForParticipant(req.socialUser.uid, req.params.conversationId, req.params.messageId);
    if (message.type !== "voice" || message.deletedAt || message.voice?.unavailable || !message.voice?.assetId) {
      throw new SocialError("voice_unavailable", "This voice message is no longer available.", 410);
    }
    const playback = await voiceMedia.playbackUrl({
      uid: message.senderUid,
      conversationId: req.params.conversationId,
      assetId: message.voice.assetId
    });
    res.set("Cache-Control", "private, no-store, max-age=0");
    res.set("Pragma", "no-cache");
    res.json(playback);
  }));

  router.delete("/conversations/:conversationId/messages/:messageId", limit("messages"), asyncRoute(async (req, res) => {
    const message = await social.getOwnedMessage(req.socialUser.uid, req.params.conversationId, req.params.messageId);
    if (message.type === "voice" && !message.deletedAt && message.voice?.assetId) {
      if (!voiceMedia) throw new SocialError("voice_storage_unavailable", "Voice messages are temporarily unavailable.", 503);
      const outcome = await voiceMedia.deleteOwnedAsset({
        uid: req.socialUser.uid,
        conversationId: req.params.conversationId,
        assetId: message.voice.assetId
      });
      if (outcome.status === "ownership_mismatch") throw new SocialError("voice_asset_forbidden", "Voice-message ownership could not be verified.", 403);
    }
    res.json(await social.deleteMessage(req.socialUser.uid, req.params.conversationId, req.params.messageId));
  }));

  router.post("/conversations/:conversationId/read", asyncRoute(async (req, res) => {
    res.json(await social.markConversationRead(req.socialUser.uid, req.params.conversationId));
  }));

  router.get("/share-sources", asyncRoute(async (req, res) => {
    res.json(jsonSafe({ sources: await social.listShareSources(req.socialUser.uid, req.query.type) }));
  }));

  router.post("/conversations/:conversationId/artifacts", limit("artifacts"), asyncRoute(async (req, res) => {
    const result = await social.shareArtifact(req.socialUser.uid, req.params.conversationId, req.body);
    res.status(201).json(jsonSafe(result));
    notifyCommittedMessage(req.socialUser.uid, req.params.conversationId, result);
  }));

  router.get("/artifacts/:artifactId", asyncRoute(async (req, res) => {
    res.json(jsonSafe({ artifact: await social.getArtifact(req.socialUser.uid, req.params.artifactId) }));
  }));

  router.post("/artifacts/:artifactId/copy", limit("artifacts"), asyncRoute(async (req, res) => {
    res.status(201).json(jsonSafe(await social.copyArtifact(req.socialUser.uid, req.params.artifactId)));
  }));

  router.delete("/artifacts/:artifactId", limit("artifacts"), asyncRoute(async (req, res) => {
    res.json(await social.revokeArtifact(req.socialUser.uid, req.params.artifactId));
  }));

  router.post("/reports", limit("reports"), asyncRoute(async (req, res) => {
    const result = await social.reportContent(req.socialUser.uid, req.body || {});
    res.status(201).json(result);
    if (!result.duplicate && typeof reportAlert === "function") {
      // Only opaque report metadata leaves the request path; never message
      // text, reporter identity, profile data, or artifact snapshots.
      void reportAlert(result).catch((error) => console.error("Social report alert failed:", error?.code || error?.name || "unknown"));
    }
  }));

  router.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error instanceof SocialError ? error.status : Number(error.status || 500);
    if (status >= 500) console.error("Social route failed:", error.message);
    res.status(status).json({
      error: status >= 500 ? "The social experience is temporarily unavailable." : error.message,
      code: error.code || "social_request_failed",
      ...(error.details ? { details: error.details } : {})
    });
  });

  return router;
}

module.exports = { createSocialRouter, jsonSafe };
