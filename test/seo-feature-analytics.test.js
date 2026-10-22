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

test("activation stages use the existing consent-controlled GA tag and keep UTM through guest signup", async () => {
  const memory = new Map();
  const landing = context({ consent: true, memory });
  landing.scope.window.location.search = "?utm_source=Meta&utm_medium=Paid_Social&utm_campaign=Fall26";
  vm.runInContext('trackEvent("landing_page_view", { source: "landing" });', landing.scope);
  const builder = context({ consent: true, memory });
  builder.scope.window.location.pathname = "/workout-builder.html";
  vm.runInContext(`
    trackEvent("builder_open", { builder: "workout" });
    trackEvent("generate_clicked", { builder: "workout", goal: "private" });
    trackEvent("builder_validation_error", { builder: "workout", message: "private" });
    trackEvent("signup_handoff", { builder: "workout", method: "google", email: "private@example.test" });
  `, builder.scope);
  const auth = context({ consent: true, memory });
  auth.scope.window.location.pathname = "/auth.html";
  vm.runInContext('trackEvent("signup_completed", { method: "google" });', auth.scope);
  const activated = context({ consent: true, memory });
  activated.scope.window.location.pathname = "/workout-builder.html";
  vm.runInContext('trackEvent("workout_generated", {}); trackEvent("plan_saved", { type: "workout" });', activated.scope);
  const names = [landing, builder, auth, activated].flatMap(page => page.gtag.map(call => call[1]));
  assert.deepEqual(names, ["landing_page_view", "builder_open", "generate_clicked", "builder_validation_error", "signup_handoff", "sign_up", "workout_generated", "plan_saved"]);
  assert.equal(activated.gtag.at(-1)[2].type, "workout");
  for (const page of [landing, builder, auth, activated]) {
    const payload = JSON.parse(await page.beacons[0].body.text());
    assert.equal(payload.properties.campaign_source, "meta");
    assert.equal(payload.properties.campaign_medium, "paid_social");
    assert.equal(payload.properties.campaign_name, "fall26");
  }
  assert.doesNotMatch(JSON.stringify(builder.gtag), /private|goal|email|message/);
});

test("failure events are enum-only, consent-gated for GA, and rejected without a known builder", async () => {
  const page = context({ consent: true });
  vm.runInContext(`
    trackEvent("generation_failed", { builder: "nutrition", reason: "server_error", food: "private meal", error: "private stack" });
    trackEvent("generation_failed", { builder: "nutrition", reason: "private stack" });
    trackEvent("generate_clicked", { builder: "private builder" });
  `, page.scope);
  assert.equal(page.gtag.length, 2);
  assert.equal(page.beacons.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(page.gtag[0][2])), { builder: "nutrition", reason: "server_error" });
  const payload = JSON.parse(await page.beacons[0].body.text());
  assert.deepEqual(sanitizeAnalyticsPayload(payload).properties, { builder: "nutrition", reason: "server_error" });
  assert.doesNotMatch(JSON.stringify(payload), /private meal|private stack/);
  const denied = context();
  vm.runInContext('trackEvent("plan_saved", { type: "nutrition" });', denied.scope);
  assert.equal(denied.gtag.length, 0);
  assert.equal(denied.beacons.length, 1);
  assert.equal(sanitizeAnalyticsPayload({ event: "generation_failed", properties: { builder: "other" } }), null);
  assert.deepEqual([0, 400, 429, 503].map(status => vm.runInContext(`generationFailureCategory(${status})`, page.scope)),
    ["network_or_timeout", "request_rejected", "rate_limited", "server_error"]);
});

test("legacy shopping-list and referral events do not carry meal names or raw UTM values", async () => {
  const page = context();
  page.scope.window.location.search = "?utm_source=Meta&utm_campaign=Launch26";
  vm.runInContext(`
    trackEvent("nutrition_shopping_list", { plan: "private meal plan" });
    trackEvent("referral_link_opened", { source: "private@example.test" });
  `, page.scope);
  assert.equal(page.beacons.length, 2);
  for (const beacon of page.beacons) {
    const payload = JSON.parse(await beacon.body.text());
    assert.equal(payload.properties.campaign_source, "meta");
    assert.equal(payload.properties.campaign_name, "launch26");
    assert.doesNotMatch(JSON.stringify(payload), /private meal plan|private@example.test/);
    assert.deepEqual(sanitizeAnalyticsPayload(payload).properties, {
      campaign_source: "meta", campaign_name: "launch26"
    });
  }
  const personalCampaign = context();
  personalCampaign.scope.window.location.search = "?utm_campaign=private%40example.test";
  vm.runInContext('trackEvent("landing_page_view");', personalCampaign.scope);
  const personalPayload = JSON.parse(await personalCampaign.beacons[0].body.text());
  assert.equal(personalPayload.properties.campaign_name, undefined);
});

test("builder chooser is not counted as a builder open in GA and transport failure cannot block the page", () => {
  const page = context({ consent: true, beaconAccepted: false });
  page.scope.fetch = () => { throw new Error("offline"); };
  assert.doesNotThrow(() => vm.runInContext('trackEvent("builder_open", { source: "landing" });', page.scope));
  assert.equal(page.gtag.length, 0);
});

test("a failing GA tag cannot interrupt signup or generation telemetry", () => {
  const page = context({ consent: true });
  page.scope.window.gtag = () => { throw new Error("tag unavailable"); };
  assert.doesNotThrow(() => vm.runInContext(`
    trackEvent("signup_completed", { method: "google" });
    trackEvent("generate_clicked", { builder: "workout" });
  `, page.scope));
  assert.equal(page.beacons.length, 2);
});

test("each builder wires one Generate click, guest handoff, success, save, and safe failure path", () => {
  for (const [kind, filename, successName] of [
    ["workout", "workout-builder.js", "workout_generated"],
    ["nutrition", "nutrition-builder.js", "nutrition_generated"]
  ]) {
    const source = fs.readFileSync(path.join(root, "public/js", filename), "utf8");
    assert.equal((source.match(/trackEvent\("generate_clicked"/g) || []).length, 1, filename);
    assert.ok(source.includes(`button?.addEventListener("click", () => trackEvent("generate_clicked", { builder: "${kind}" }));`), filename);
    assert.ok(source.includes(`trackEvent("signup_handoff", { builder: "${kind}", method })`), filename);
    assert.equal((source.match(new RegExp(`trackEvent\\("${successName}"`, "g")) || []).length, 1, filename);
    assert.equal((source.match(/trackEvent\("plan_saved"/g) || []).length, 1, filename);
    assert.match(source, /await save(?:Workout|Nutrition)Plan\([\s\S]*?trackEvent\("plan_saved"/);
    assert.match(source, /catch \(error\) \{\s*trackEvent\("generation_failed"/);
  }
  const nutritionHtml = fs.readFileSync(path.join(root, "public/nutrition-builder.html"), "utf8");
  assert.equal((nutritionHtml.match(/trackEvent\('builder_validation_error'/g) || []).length, 2);
});
