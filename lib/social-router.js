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

function createSocialRouter({ authenticate, rateLimiters = {}, authorizeAdmin = () => false }) {
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
    res.status(201).json(jsonSafe(await social.sendFriendRequest(req.socialUser.uid, req.body?.targetUid)));
  }));

  router.patch("/friend-requests/:requestId", limit("relationships"), asyncRoute(async (req, res) => {
    res.json(jsonSafe(await social.actOnFriendRequest(req.socialUser.uid, req.params.requestId, req.body?.action)));
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
    await social.getConversation(req.socialUser.uid, req.params.conversationId);
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
    await social.getConversation(req.socialUser.uid, req.params.conversationId);
    typing.setTyping(req.params.conversationId, req.socialUser.uid, req.body?.typing === true);
    res.status(204).end();
  }));

  router.get("/conversations/:conversationId", asyncRoute(async (req, res) => {
    res.json(jsonSafe({ conversation: await social.getConversation(req.socialUser.uid, req.params.conversationId) }));
  }));

  router.get("/conversations/:conversationId/messages", asyncRoute(async (req, res) => {
    res.json(jsonSafe(await social.listMessages(req.socialUser.uid, req.params.conversationId, req.query.before)));
  }));

  router.post("/conversations/:conversationId/messages", limit("messages"), asyncRoute(async (req, res) => {
    res.status(201).json(jsonSafe(await social.sendMessage(req.socialUser.uid, req.params.conversationId, req.body)));
  }));

  router.delete("/conversations/:conversationId/messages/:messageId", limit("messages"), asyncRoute(async (req, res) => {
    res.json(await social.deleteMessage(req.socialUser.uid, req.params.conversationId, req.params.messageId));
  }));

  router.post("/conversations/:conversationId/read", asyncRoute(async (req, res) => {
    res.json(await social.markConversationRead(req.socialUser.uid, req.params.conversationId));
  }));

  router.get("/share-sources", asyncRoute(async (req, res) => {
    res.json(jsonSafe({ sources: await social.listShareSources(req.socialUser.uid, req.query.type) }));
  }));

  router.post("/conversations/:conversationId/artifacts", limit("artifacts"), asyncRoute(async (req, res) => {
    res.status(201).json(jsonSafe(await social.shareArtifact(req.socialUser.uid, req.params.conversationId, req.body)));
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
