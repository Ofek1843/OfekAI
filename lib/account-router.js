"use strict";

const express = require("express");
const { REAUTHENTICATION_MAX_AGE_SECONDS } = require("./legal-policy");

function asyncRoute(handler) { return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next); }

function createAccountRouter({ authenticate, service, rateLimit } = {}) {
  if (typeof authenticate !== "function" || !service) throw new TypeError("Account routes require authentication and a service.");
  const router = express.Router();
  router.use(asyncRoute(async (req, res, next) => {
    const user = await authenticate(req, res, { skipTermsGate: true });
    if (!user) return;
    if (typeof rateLimit === "function") rateLimit(req, user.uid);
    req.accountUser = user;
    next();
  }));
  router.get("/export", asyncRoute(async (req, res) => {
    const payload = await service.exportAccount(req.accountUser.uid);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", 'attachment; filename="fuelphysique-account-export.json"');
    res.type("application/json").send(JSON.stringify(payload));
  }));
  router.delete("/", asyncRoute(async (req, res) => {
    const confirmation = String(req.body?.confirmation || "").trim();
    if (confirmation !== "DELETE") {
      return res.status(400).json({ error: "Type the confirmation phrase before deleting your account.", code: "account_deletion_confirmation_required" });
    }
    const authTime = Number(req.accountUser.authTime || 0);
    const isRecent = authTime > 0 && Math.floor(Date.now() / 1000) - authTime <= REAUTHENTICATION_MAX_AGE_SECONDS;
    if (!isRecent) return res.status(401).json({ error: "Reauthentication is required before account deletion.", code: "reauthentication_required" });
    const result = await service.deleteAccount(req.accountUser.uid, { confirmed: true, reauthenticatedAt: authTime });
    res.status(200).json(result);
  }));
  router.use((error, _req, res, _next) => {
    const status = Number(error.status || 500);
    if (status >= 500) console.error("Account route failed:", error.message);
    res.status(status).json({ error: status >= 500 ? "Your account request could not be completed. Please try again." : error.message, code: error.code || "account_request_failed" });
  });
  return router;
}

module.exports = { createAccountRouter };
