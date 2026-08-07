"use strict";

const { getFuelPhysiqueMessaging } = require("./firebase-admin");

function createFirebasePushTransport({ messaging = getFuelPhysiqueMessaging() } = {}) {
  return {
    configured: true,
    async send(installation, payload) {
      return messaging.send({
        fid: installation.fid,
        data: Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, String(value ?? "")])),
        webpush: { headers: { Urgency: payload.type === "message" ? "high" : "normal" } }
      });
    }
  };
}

function createDisabledPushTransport() {
  return {
    configured: false,
    async send() {
      const error = new Error("Push transport is not configured.");
      error.code = "push/not-configured";
      throw error;
    }
  };
}

module.exports = { createDisabledPushTransport, createFirebasePushTransport };
