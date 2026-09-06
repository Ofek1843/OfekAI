const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { buildActionCodeSettings } = require("../public/js/email-verification-core.mjs");
const { resolveContinueUrl } = require("../public/js/auth-action-core.mjs");

test("production email continuations remain canonical even with a loopback or hostile origin", () => {
  for (const origin of ["https://fuelphysique.com", "https://www.fuelphysique.com", "http://localhost:3000", "http://127.0.0.1:3304", "https://evil.test", undefined]) {
    assert.deepEqual(buildActionCodeSettings(origin), { url: "https://fuelphysique.com/auth.html", handleCodeInApp: false });
  }
});

test("emulator mode accepts only the explicit local review origins", () => {
  assert.equal(buildActionCodeSettings("http://127.0.0.1:3304", { localDevelopment: true }).url, "http://127.0.0.1:3304/auth.html");
  for (const origin of ["http://localhost.evil.test:3304", "http://192.168.1.1:3304", "http://localhost:9999"]) {
    assert.equal(buildActionCodeSettings(origin, { localDevelopment: true }).url, "https://fuelphysique.com/auth.html");
  }
});

test("legacy handler continuations and credential-bearing URLs fall back safely", () => {
  for (const url of ["https://fuelphysique.com/auth-action.html", "http://localhost:3000/auth-action.html", "https://user:password@fuelphysique.com/progress.html", "https://fuelphysique.com//evil.test/"]) {
    assert.equal(resolveContinueUrl(url), "/dashboard.html");
  }
  assert.equal(resolveContinueUrl("https://fuelphysique.com/auth.html"), "/auth.html");
  // Local URLs are reduced to paths: a production action page cannot
  // navigate to localhost even when an old email contains that origin.
  assert.equal(new URL(resolveContinueUrl("http://localhost:3000/progress.html"), "https://fuelphysique.com").origin, "https://fuelphysique.com");
});

test("service worker bypasses auth pages/modules and purges existing auth cache entries", async () => {
  const handlers = {};
  const deleted = [];
  const fetched = [];
  const requests = ["/auth-action.html?oobCode=TEST_ONLY", "/js/firebase-environment.mjs", "/dashboard.html"].map(p => ({url: `https://fuelphysique.com${p}`}));
  const cache = { keys: async () => requests, delete: async r => deleted.push(r.url) };
  const source = fs.readFileSync(path.join(__dirname, "../public/sw.js"), "utf8");
  const current = source.match(/const CACHE_NAME = '([^']+)'/)[1];
  vm.runInNewContext(source, {
    URL, console,
    fetch: async (request, options) => { fetched.push([request.url, options.cache]); return {status: 200}; },
    self: { addEventListener: (n, fn) => { handlers[n] = fn; }, clients: {claim() {}}, location: {origin: "https://fuelphysique.com"} },
    caches: {keys: async () => [current], open: async () => cache}
  });
  for (const pathname of ["/auth.html", "/auth-action.html?oobCode=TEST_ONLY", "/js/auth.js", "/js/email-verification-core.mjs", "/js/firebase-environment.mjs"]) {
    let response;
    handlers.fetch({request: {method: "GET", url: `https://fuelphysique.com${pathname}`}, respondWith(promise) { response = promise; }});
    assert.equal((await response).status, 200);
    assert.deepEqual(fetched.at(-1), [`https://fuelphysique.com${pathname}`, "no-store"]);
  }
  let activation;
  handlers.activate({waitUntil(promise) { activation = promise; }});
  await activation;
  assert.deepEqual(deleted.sort(), requests.slice(0, 2).map(r => r.url).sort());
});
