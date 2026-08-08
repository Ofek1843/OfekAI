"use strict";

const { applicationDefault, cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getStorage } = require("firebase-admin/storage");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "ofek-ai-55f1d";

function getFuelPhysiqueAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const options = { projectId: PROJECT_ID };
  const rawServiceAccount = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (rawServiceAccount) {
    options.credential = cert(JSON.parse(rawServiceAccount));
  } else if (!process.env.FIRESTORE_EMULATOR_HOST) {
    options.credential = applicationDefault();
  }
  return initializeApp(options, "fuelphysique-server");
}

function getFuelPhysiqueFirestore() {
  return getFirestore(getFuelPhysiqueAdminApp());
}

function getFuelPhysiqueMessaging() {
  return getMessaging(getFuelPhysiqueAdminApp());
}

function getFuelPhysiqueAuth() {
  return getAuth(getFuelPhysiqueAdminApp());
}

function getFuelPhysiqueStorage() {
  return getStorage(getFuelPhysiqueAdminApp());
}

module.exports = {
  getFuelPhysiqueAdminApp,
  getFuelPhysiqueAuth,
  getFuelPhysiqueFirestore,
  getFuelPhysiqueMessaging,
  getFuelPhysiqueStorage
};
