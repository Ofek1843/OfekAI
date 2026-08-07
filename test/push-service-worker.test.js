const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SW_PATH = path.join(__dirname, "..", "public", "sw.js");
const SOURCE = fs.readFileSync(SW_PATH, "utf8");

function harness(windows = []) {
  const handlers = {};
  const shown = [];
  const opened = [];
  const self = {
    location: { origin: "https://fuelphysique.test" },
    addEventListener(type, handler) { handlers[type] = handler; },
    skipWaiting() {},
    clients: {
      claim() {},
      async matchAll() { return windows; },
      async openWindow(url) { opened.push(url); return { url }; }
    },
    registration: { async showNotification(title, options) { shown.push({ title, options }); } }
  };
  const context = vm.createContext({ self, URL, Response, Headers, console, caches: { open: async () => ({ addAll: async () => {}, put: async () => {} }), keys: async () => [], delete: async () => true, match: async () => null }, fetch: async () => new Response("ok") });
  vm.runInContext(SOURCE, context, { filename: SW_PATH });
  return { handlers, shown, opened };
}

function eventWithWait(extra = {}) {
  let promise;
  return { ...extra, waitUntil(value) { promise = Promise.resolve(value); }, done: () => promise };
}

test("existing install/activate/fetch architecture remains and cache version advances", () => {
  assert.match(SOURCE, /CACHE_NAME = 'fuelphysique-v6'/);
  assert.match(SOURCE, /addEventListener\('install'/);
  assert.match(SOURCE, /addEventListener\('activate'/);
  assert.match(SOURCE, /addEventListener\('fetch'/);
  assert.match(SOURCE, /NETWORK_ONLY_PREFIXES/);
  assert.match(SOURCE, /cache\.addAll\(urlsToCache\)/);
  assert.match(SOURCE, /fetch\(event\.request\)/);
  assert.match(SOURCE, /caches\.match\(event\.request\)/);
  assert.doesNotMatch(SOURCE, /importScripts\([^)]*firebase-messaging-sw/);
});

test("foreground visible client suppresses system notification and receives in-app event", async () => {
  const messages = [];
  const currentWindow = { visibilityState: "visible", postMessage(value) { messages.push(value); } };
  const h = harness([currentWindow]);
  const event = eventWithWait({ data: { json: () => ({ data: { title: "Ofek", body: "Hello", url: "/social.html?conversation=thread" } }) } });
  h.handlers.push(event);
  await event.done();
  assert.equal(h.shown.length, 0);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "FUELPHYSIQUE_PUSH_FOREGROUND");
});

test("background push creates one compact notification with internal destination", async () => {
  const h = harness([]);
  const event = eventWithWait({ data: { json: () => ({ data: { title: "Ofek", body: "Hello", type: "message", eventId: "stable-event", url: "/social.html?conversation=thread" } }) } });
  h.handlers.push(event);
  await event.done();
  assert.equal(h.shown.length, 1);
  assert.equal(h.shown[0].title, "Ofek");
  assert.equal(h.shown[0].options.tag, "stable-event");
  assert.equal(h.shown[0].options.data.url, "https://fuelphysique.test/social.html?conversation=thread");
});

test("notification click closes and focuses/navigates an existing same-origin window", async () => {
  const calls = [];
  const currentWindow = {
    url: "https://fuelphysique.test/dashboard.html",
    async navigate(url) { calls.push(["navigate", url]); },
    async focus() { calls.push(["focus"]); }
  };
  const h = harness([currentWindow]);
  let closed = false;
  const event = eventWithWait({ notification: { data: { url: "https://fuelphysique.test/workout-tracker.html?plan=p&session=s" }, close() { closed = true; } } });
  h.handlers.notificationclick(event);
  await event.done();
  assert.equal(closed, true);
  assert.deepEqual(calls, [["navigate", "https://fuelphysique.test/workout-tracker.html?plan=p&session=s"], ["focus"]]);
  assert.equal(h.opened.length, 0);
});

test("notification click opens a new window only when no existing client exists", async () => {
  const h = harness([]);
  const event = eventWithWait({ notification: { data: { url: "/social.html?conversation=thread&artifact=a" }, close() {} } });
  h.handlers.notificationclick(event);
  await event.done();
  assert.deepEqual(h.opened, ["https://fuelphysique.test/social.html?conversation=thread&artifact=a"]);
});

test("external, javascript, data and protocol-relative click URLs fall back to dashboard", async () => {
  for (const url of ["https://evil.example", "javascript:alert(1)", "data:text/html,bad", "//evil.example/x"]) {
    const h = harness([]);
    const event = eventWithWait({ notification: { data: { url }, close() {} } });
    h.handlers.notificationclick(event);
    await event.done();
    assert.deepEqual(h.opened, ["https://fuelphysique.test/dashboard.html"]);
  }
});
