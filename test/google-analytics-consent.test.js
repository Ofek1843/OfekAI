"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");

const ROOT = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(ROOT, "public/js/google-analytics-consent.js"), "utf8");

function runPage({ stored = null, pathname = "/", search = "", referrer = "", withAnalytics = false } = {}) {
  const { document, window: domWindow } = parseHTML("<html lang=\"en\"><head></head><body><main><section id=\"use\"></section></main></body></html>");
  const window = {
    Event: domWindow.Event,
    addEventListener: domWindow.addEventListener.bind(domWindow),
    dispatchEvent: domWindow.dispatchEvent.bind(domWindow)
  };
  Object.defineProperty(document, "referrer", { configurable: true, value: referrer });
  const memory = new Map(stored ? [["fp_analytics_consent_v1", stored]] : []);
  const localStorage = {
    getItem: key => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, value)
  };
  window.location = {
    origin: "https://fuelphysique.com",
    pathname,
    search,
    reload() { throw new Error("reload requested"); }
  };
  const scope = vm.createContext({ window, document, localStorage, URL, URLSearchParams,
    navigator: { sendBeacon: () => true }, Blob });
  if (withAnalytics) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, "public/js/analytics.js"), "utf8").replace(/^export /gm, ""), scope);
  }
  vm.runInContext(source, scope, { filename: "google-analytics-consent.js" });
  return { document, window, memory, scope };
}

for (const event of ["seo_landing_view", "landing_page_view"]) {
  for (const stored of [null, "granted", "denied"]) {
    test(`${event}: consent ${stored || "granted after load"} emits the current view once without replaying clicks`, () => {
      const page = runPage({ stored, withAnalytics: true });
      vm.runInContext(`trackEvent("${event}", {feature:"meal-plan-generator"});
        trackEvent("${event}", {feature:"meal-plan-generator"});
        trackEvent("seo_cta_click", {feature:"meal-plan-generator",placement:"hero"});`, page.scope);
      if (!stored) {
        assert.equal(page.window.dataLayer, undefined);
        page.document.querySelector(".fp-analytics-consent-actions button").click();
      }
      for (let i = 0; i < 3; i++) page.window.dispatchEvent(new page.window.Event("fp:analytics-ready"));
      const events = (page.window.dataLayer || []).filter(call => call[0] === "event");
      assert.equal(events.filter(call => call[1] === event).length, stored === "denied" ? 0 : 1);
      assert.equal(events.filter(call => call[1] === "seo_cta_click").length, stored === "granted" ? 1 : 0);
      assert.equal(events.filter(call => call[1] === "page_view").length, 0);
      assert.equal((page.window.dataLayer || []).filter(call => call[0] === "config").length, stored === "denied" ? 0 : 1);
    });
  }
}

test("late consent does not replay a landing view after the path changes", () => {
  const page = runPage({ withAnalytics: true });
  vm.runInContext('trackEvent("seo_landing_view", {feature:"meal-plan-generator"});', page.scope);
  page.window.location.pathname = "/auth.html";
  page.document.querySelector(".fp-analytics-consent-actions button").click();
  assert.equal(page.window.dataLayer.filter(call => call[0] === "event").length, 0);
});

test("Google tag is not loaded before consent or after refusal", () => {
  const page = runPage();
  assert.ok(page.document.getElementById("fp-analytics-consent"));
  assert.equal(page.document.querySelector('script[src*="googletagmanager.com"]'), null);
  page.document.querySelector(".fp-analytics-decline").click();
  assert.equal(page.memory.get("fp_analytics_consent_v1"), "denied");
  assert.equal(page.document.querySelector('script[src*="googletagmanager.com"]'), null);
  assert.equal(runPage({ stored: "denied" }).document.querySelector('script[src*="googletagmanager.com"]'), null);
});

test("consent loads one GA4 tag with sanitized location and no advertising consent", () => {
  const page = runPage({
    pathname: "/auth.html",
    search: "?utm_source=tiktok&utm_campaign=launch&token=secret&email=user%40example.com",
    referrer: "https://example.test/private-user?email=user%40example.com"
  });
  page.document.querySelector(".fp-analytics-consent-actions button").click();
  assert.equal(page.memory.get("fp_analytics_consent_v1"), "granted");
  const scripts = page.document.querySelectorAll('script[src*="googletagmanager.com"]');
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=G-1HG905SBV4");
  const commands = page.window.dataLayer;
  assert.deepEqual([...commands[0]].slice(0, 2), ["consent", "default"]);
  assert.equal(commands[0][2].analytics_storage, "denied");
  assert.equal(commands[1][2].analytics_storage, "granted");
  assert.equal(commands[1][2].ad_storage, "denied");
  const config = commands.find(command => command[0] === "config");
  assert.equal(config[1], "G-1HG905SBV4");
  assert.equal(config[2].page_location, "https://fuelphysique.com/auth.html?utm_source=tiktok&utm_campaign=launch");
  assert.equal(config[2].page_referrer, "https://example.test");
  assert.equal(config[2].allow_google_signals, false);
});

test("previously granted consent loads without a duplicate banner", () => {
  const page = runPage({ stored: "granted" });
  assert.equal(page.document.getElementById("fp-analytics-consent"), null);
  assert.equal(page.document.querySelectorAll('script[src*="googletagmanager.com"]').length, 1);
});

test("successful signup sends exactly one PII-free GA4 conversion only after consent", () => {
  const analyticsSource = fs.readFileSync(path.join(ROOT, "public/js/analytics.js"), "utf8")
    .replace(/^export /gm, "");
  function runAnalytics(withConsent) {
    const gtagCalls = [];
    const context = {
      window: {
        location: { pathname: "/auth.html", search: "" },
        sessionStorage: { getItem: () => null, setItem() {} },
        ...(withConsent ? { gtag: (...args) => gtagCalls.push(args) } : {})
      },
      document: { referrer: "", title: "Login" },
      navigator: { sendBeacon: () => true },
      URLSearchParams,
      Date,
      Blob,
      JSON,
      Object,
      String,
      Set
    };
    vm.runInNewContext(`${analyticsSource}\ntrackEvent("signup_completed", { method: "google", email: "private@example.test", uid: "private-uid" });\ntrackEvent("signup_completed", { method: "google" });`, context);
    return gtagCalls;
  }

  const calls = runAnalytics(true);
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ["event", "sign_up", { method: "google" }]);
  assert.deepEqual(runAnalytics(false), []);
});

test("privacy page exposes a way to reverse an accepted choice", () => {
  const page = runPage({ stored: "granted", pathname: "/privacy.html" });
  assert.ok(page.document.getElementById("analytics-choices"));
  page.document.querySelector(".fp-analytics-settings button").click();
  assert.ok(page.document.getElementById("fp-analytics-consent"));
  assert.throws(() => page.document.querySelector(".fp-analytics-decline").click(), /reload requested/);
  assert.equal(page.memory.get("fp_analytics_consent_v1"), "denied");
});

test("all ordinary HTML pages install the consent loader, and policy discloses the choice", () => {
  const excluded = new Set(["auth-action.html", "billing-result.html", "dashboard-preview.html"]);
  for (const filename of fs.readdirSync(path.join(ROOT, "public")).filter(file => file.endsWith(".html") && !excluded.has(file))) {
    const html = fs.readFileSync(path.join(ROOT, "public", filename), "utf8");
    assert.match(html, /<script defer src="\/js\/google-analytics-consent\.js\?v=20261017-1"><\/script>/, filename);
  }
  const server = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
  assert.match(server, /Exercise Library:[\s\S]*?google-analytics-consent\.js/);
  const privacy = fs.readFileSync(path.join(ROOT, "public/privacy.html"), "utf8");
  assert.match(privacy, /Google Analytics is optional and does not load until you accept it/);
});
