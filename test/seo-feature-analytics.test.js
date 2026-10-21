"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");
const { sanitizeAnalyticsPayload } = require("../lib/fuelphysique-policy");
const root = path.join(__dirname, "..");
const analytics = fs.readFileSync(path.join(root, "public/js/analytics.js"), "utf8").replace(/^export /gm, "");
function context({ consent = false, memory = new Map(), blockedStorage = false, referrer = "", beaconAccepted = true } = {}) {
  const gtag = [], beacons = [], fetches = [];
  const window = {
    location: { pathname: "/features/meal-plan-generator", search: "" },
    sessionStorage: {
      getItem(key) { if (blockedStorage) throw new Error("blocked"); return memory.get(key) || null; },
      setItem(key, value) { if (blockedStorage) throw new Error("blocked"); memory.set(key, value); }
    },
    ...(consent ? { gtag: (...args) => gtag.push(args) } : {})
  };
  const scope = vm.createContext({
    window, document: { referrer, title: "Meal planning" },
    navigator: { sendBeacon: (url, body) => { beacons.push({ url, body }); return beaconAccepted; } },
    fetch: (url, options) => { fetches.push({ url, options }); return Promise.resolve({ ok: true }); },
    URL, URLSearchParams, Blob
  });
  vm.runInContext(analytics, scope);
  return { scope, gtag, beacons, fetches, memory };
}

test("SEO funnel reuses consent-only GA, sends safe enums, and attributes later conversion", async () => {
  const page = context({ consent: true });
  vm.runInContext(`
    trackEvent("seo_landing_view", {feature:"meal-plan-generator"});
    trackEvent("seo_cta_click", {feature:"meal-plan-generator", placement:"hero", email:"private@example.test"});
    trackEvent("nutrition_generated", {weight:70, food:"personal food", calories:2300});
    trackEvent("signup_started", {method:"google"});
    trackEvent("signup_started", {method:"google"});
    trackEvent("signup_completed", {method:"google", uid:"private"});
    trackEvent("signup_completed", {method:"google"});
  `, page.scope);
  assert.equal(page.gtag.length, 5);
  assert.doesNotMatch(JSON.stringify(page.gtag), /private|weight|food|calories/);
  assert.equal(page.gtag[4][1], "sign_up");
  assert.equal(page.gtag[4][2].seo_feature, "meal-plan-generator");
  assert.equal(page.gtag.filter(call => call[1] === "signup_started").length, 1);
  const nextPage = context({ consent: true, memory: page.memory });
  vm.runInContext('trackEvent("workout_generated", {goal:"private"});', nextPage.scope);
  assert.equal(nextPage.gtag[0][2].seo_feature, "meal-plan-generator");
  const payload = JSON.parse(await nextPage.beacons[0].body.text());
  assert.equal(sanitizeAnalyticsPayload(payload).properties.seo_feature, "meal-plan-generator");
});

test("signup start is counted once across the landing-to-auth navigation", () => {
  const memory = new Map();
  const landing = context({ consent: true, memory });
  vm.runInContext('trackEvent("signup_started", {method:"email_password"});', landing.scope);
  const authPage = context({ consent: true, memory });
  vm.runInContext('trackEvent("signup_started", {method:"email_password"});', authPage.scope);
  assert.equal(landing.gtag.filter(call => call[1] === "signup_started").length, 1);
  assert.equal(authPage.gtag.length, 0);
  assert.equal(authPage.beacons.length, 0);
});

test("feature telemetry strips private fields and referrer queries before the first-party endpoint", async () => {
  const page = context({ referrer: "https://example.test/path?email=private@example.test" });
  vm.runInContext('trackEvent("nutrition_generated", {food:"personal meal", calories:700, email:"private@example.test"});', page.scope);
  const payload = JSON.parse(await page.beacons[0].body.text());
  assert.equal(payload.referrer, "https://example.test");
  assert.deepEqual(JSON.parse(JSON.stringify(payload.properties)), { builder: "nutrition" });
  const rejected = sanitizeAnalyticsPayload({
    event: "seo_cta_click", referrer: "https://example.test/path?token=private",
    properties: { feature: "meal-plan-generator", placement: "hero", food: "personal meal", calories: 700 }
  });
  assert.equal(rejected.referrer, "https://example.test");
  assert.deepEqual(rejected.properties, { feature: "meal-plan-generator", placement: "hero" });
});

test("a rejected analytics beacon falls back to fetch instead of dropping the event", () => {
  const page = context({ beaconAccepted: false });
  vm.runInContext('trackEvent("seo_cta_click", {feature:"nutrition-tracker", placement:"hero"});', page.scope);
  assert.equal(page.beacons.length, 1);
  assert.equal(page.fetches.length, 1);
  assert.equal(page.fetches[0].url, "/api/analytics/event");
});

test("no consent, blocked storage, expired and forged attribution do not leak to GA or block events", () => {
  const refused = context({ blockedStorage: true });
  vm.runInContext('trackEvent("seo_cta_click",{feature:"meal-plan-generator",placement:"hero"});', refused.scope);
  assert.equal(refused.gtag.length, 0);
  assert.equal(refused.beacons.length, 1);
  for (const saved of [
    { feature: "private@example.test", capturedAt: Date.now() },
    { feature: "nutrition-tracker", capturedAt: Date.now() - 25 * 60 * 60 * 1000 }
  ]) {
    const page = context({ consent: true, memory: new Map([["fp_seo_feature_session_v1", JSON.stringify(saved)]]) });
    vm.runInContext('trackEvent("nutrition_generated",{food:"private"});', page.scope);
    assert.deepEqual(JSON.parse(JSON.stringify(page.gtag[0][2])), {});
  }
});

test("landing controller sends one view and one event per CTA click, without claiming a signup", () => {
  const full = parseHTML('<html><body data-seo-feature="nutrition-tracker"><a href="/daily-nutrition.html?guest=1" data-seo-cta="hero">Try diary</a></body></html>').document;
  const calls = [];
  const source = fs.readFileSync(path.join(root, "public/js/seo-features.js"), "utf8").replace(/^import .*;\r?\n/, "");
  vm.runInNewContext(source, { document: full, trackEvent: (...args) => calls.push(args) });
  assert.equal(calls.length, 1);
  full.querySelector("a").click();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(call => call[0]), ["seo_landing_view", "seo_cta_click"]);
});

test("server accepts new events and meal success instrumentation has one call after rendering", () => {
  for (const event of ["seo_landing_view", "seo_cta_click", "nutrition_generated"]) {
    assert.ok(sanitizeAnalyticsPayload({ event, properties: { feature: "nutrition-tracker" } }));
  }
  const source = fs.readFileSync(path.join(root, "public/js/nutrition-builder.js"), "utf8");
  assert.equal((source.match(/trackEvent\("nutrition_generated"/g) || []).length, 1);
  assert.match(source, /if \(data\.plan\) \{[\s\S]*?renderNutritionPlan\(data\.plan\);\s*trackEvent\("nutrition_generated"/);
});
