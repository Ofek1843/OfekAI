#!/usr/bin/env node
"use strict";

const APP_URL = "http://127.0.0.1:3304";
const AUTH_URL = "http://127.0.0.1:9099";
const PROJECT_ID = "demo-fuelphysique";
const USERS = [
  { email: "review-athlete-a@example.test", password: "FuelReview-2026-A!", locale: "en" },
  { email: "review-athlete-b@example.test", password: "FuelReview-2026-B!", locale: "he" },
];

async function jsonResponse(response, label) {
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(`${label} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

async function signIn(user) {
  return jsonResponse(await fetch(`${AUTH_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password: user.password, returnSecureToken: true }),
  }), `${user.email} local sign-in`);
}

async function verify() {
  if (process.env.FIREBASE_PROJECT_ID !== PROJECT_ID) throw new Error("Review verifier requires the demo-fuelphysique project.");
  const dashboard = await fetch(`${APP_URL}/dashboard.html`, { redirect: "manual" });
  const dashboardHtml = await dashboard.text();
  if (!dashboard.ok || !dashboardHtml.includes("/js/dashboard.js") || !dashboardHtml.includes("/js/redesign-shell.js")) {
    throw new Error("The redesigned Dashboard document did not load from the local app.");
  }

  const results = [];
  for (const user of USERS) {
    const credential = await signIn(user);
    if (!credential.idToken || credential.registered !== true) throw new Error(`${user.email} did not return a complete local credential.`);
    const conversations = await jsonResponse(await fetch(`${APP_URL}/api/social/conversations`, {
      headers: { Authorization: `Bearer ${credential.idToken}` },
    }), `${user.email} signed-in application bootstrap`);
    if (!Array.isArray(conversations.conversations) || conversations.conversations.length < 1) {
      throw new Error(`${user.email} signed in but seeded Social bootstrap did not complete.`);
    }
    results.push({ email: user.email, login: "PASS", protectedBootstrap: "PASS", conversations: conversations.conversations.length });
  }

  console.log(JSON.stringify({
    projectId: PROJECT_ID,
    appUrl: APP_URL,
    authEmulator: "127.0.0.1:9099",
    firestoreEmulator: "127.0.0.1:8080",
    productionFirebaseUsed: false,
    dashboardDocument: "PASS",
    users: results,
  }, null, 2));
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

