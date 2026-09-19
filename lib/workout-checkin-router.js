"use strict";

const express = require("express");
const { isValidTimezone } = require("./push-domain");

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createWorkoutCheckinRouter({ authenticate, service, rateLimit } = {}) {
  if (typeof authenticate !== "function" || !service) throw new TypeError("Workout check-in routes require authentication and a service.");
  const router = express.Router();
  router.use(asyncRoute(async (req, res, next) => {
    const user = await authenticate(req, res);
    if (!user) return;
    req.checkinUser = user;
    if (typeof rateLimit === "function") rateLimit(req, user.uid);
    next();
  }));

  router.get("/", asyncRoute(async (req, res) => {
    const timezone = String(req.query.timezone || "").trim();
    if (!isValidTimezone(timezone)) return res.status(400).json({ error: "A valid IANA timezone is required.", code: "invalid_timezone" });
    res.setHeader("Cache-Control", "no-store");
    res.json(await service.dashboard(req.checkinUser.uid, timezone));
  }));

  router.post("/:id/answer", asyncRoute(async (req, res) => {
    const id = String(req.params.id || "");
    if (!/^[a-f0-9]{64}$/.test(id)) return res.status(400).json({ error: "Invalid workout check-in.", code: "invalid_checkin_id" });
    const action = String(req.body?.action || "").trim();
    res.json({ checkin: await service.answer(req.checkinUser.uid, id, action) });
  }));

  router.post("/workout-completed", asyncRoute(async (req, res) => {
    const planId = String(req.body?.planId || "").trim().slice(0, 160);
    const workoutId = String(req.body?.workoutId || "").trim().slice(0, 160);
    const timezone = String(req.body?.timezone || "").trim();
    if (!planId || !workoutId || !isValidTimezone(timezone)) {
      return res.status(400).json({ error: "A plan, workout, and valid timezone are required.", code: "invalid_completion" });
    }
    res.json(await service.markWorkoutCompleted(req.checkinUser.uid, { planId, workoutId, timezone }));
  }));

  router.use((error, _req, res, _next) => {
    const status = Number(error.status || 500);
    if (status >= 500) console.error("Workout check-in route failed:", error.message);
    res.status(status).json({
      error: status >= 500 ? "Workout check-ins are temporarily unavailable." : error.message,
      code: error.code || "workout_checkin_failed"
    });
  });
  return router;
}

module.exports = { createWorkoutCheckinRouter };
