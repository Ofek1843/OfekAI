"use strict";

const express = require("express");
const { cleanString } = require("./push-domain");

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createPushRouter({ authenticate, service, vapidPublicKey = "", testEnabled = false, rateLimit } = {}) {
  if (typeof authenticate !== "function" || !service) throw new TypeError("Push routes require authentication and a service.");
  const router = express.Router();
  router.use(asyncRoute(async (req, res, next) => {
    const user = await authenticate(req, res);
    if (!user) return;
    req.pushUser = user;
    if (typeof rateLimit === "function") rateLimit(req, user.uid);
    next();
  }));

  router.get("/config", (req, res) => {
    res.json({ configured: service.transport.configured && Boolean(vapidPublicKey), vapidPublicKey: cleanString(vapidPublicKey, 512), testEnabled: Boolean(testEnabled) });
  });
  router.post("/installations", asyncRoute(async (req, res) => {
    res.status(201).json(await service.registerInstallation(req.pushUser.uid, req.body));
  }));
  router.delete("/installations/current", asyncRoute(async (req, res) => {
    res.json(await service.removeInstallation(req.pushUser.uid, cleanString(req.body?.installationId, 160)));
  }));
  router.delete("/account", asyncRoute(async (req, res) => {
    res.json(await service.removeAllForUser(req.pushUser.uid));
  }));
  router.get("/preferences", asyncRoute(async (req, res) => {
    res.json({ preferences: await service.getPreferences(req.pushUser.uid) });
  }));
  router.put("/preferences", asyncRoute(async (req, res) => {
    res.json({ preferences: await service.updatePreferences(req.pushUser.uid, req.body || {}) });
  }));
  router.post("/test", asyncRoute(async (req, res) => {
    if (!testEnabled) return res.status(404).json({ error: "Test notifications are disabled." });
    await service.sendOwnTest(req.pushUser.uid, cleanString(req.body?.installationId, 160), cleanString(req.body?.locale, 2));
    res.status(204).end();
  }));

  router.use((error, _req, res, _next) => {
    const status = Number(error.status || 500);
    if (status >= 500) console.error("Push route failed:", error.message);
    res.status(status).json({ error: status >= 500 ? "Notifications are temporarily unavailable." : error.message, code: error.code || "push_request_failed" });
  });
  return router;
}

module.exports = { createPushRouter };
