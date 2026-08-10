const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const vm = require("node:vm");
const { spawn } = require("node:child_process");
const { stopChildProcess } = require("./child-process-cleanup");
const { getFrameAncestorsDirective } = require("../lib/security-headers");

const ROOT = path.join(__dirname, "..");
const SW_PATH = path.join(ROOT, "public", "sw.js");
const SW_SOURCE = fs.readFileSync(SW_PATH, "utf8");

function directive(csp, name) {
  return String(csp || "").split(";").map(value => value.trim()).find(value => value.startsWith(`${name} `)) || "";
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startServer(t) {
  const port = await availablePort();
  const child = spawn(process.execPath, [path.join(ROOT, "server.js")], {
    env: {
      ...process.env,
      PORT: String(port),
      MOCK_EXTERNAL_SERVICES: "true",
      OPENAI_API_KEY: "sk-test-not-a-real-key-000000000000"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk.toString(); });
  t.after(() => stopChildProcess(child));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited before becoming healthy: ${stderr}`);
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return base;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become healthy: ${stderr}`);
}

function serviceWorkerHarness() {
  const handlers = {};
  const calls = { fetch: 0, cacheOpen: 0, cacheMatch: 0, cachePut: 0 };
  const self = {
    location: { origin: "https://fuelphysique.com" },
    addEventListener(type, handler) { handlers[type] = handler; },
    skipWaiting() {},
    clients: { claim() {}, async matchAll() { return []; } },
    registration: { async showNotification() {} }
  };
  const caches = {
    async open() {
      calls.cacheOpen += 1;
      return {
        async addAll() {},
        async put() { calls.cachePut += 1; }
      };
    },
    async keys() { return []; },
    async delete() { return true; },
    async match() { calls.cacheMatch += 1; return new Response("app fallback"); }
  };
  const context = vm.createContext({
    self,
    URL,
    Response,
    Headers,
    console,
    caches,
    async fetch() { calls.fetch += 1; throw new Error("network unavailable"); }
  });
  vm.runInContext(SW_SOURCE, context, { filename: SW_PATH });
  return { handlers, calls };
}

async function dispatchFetch(url, destination = "script") {
  const harness = serviceWorkerHarness();
  let responsePromise;
  let respondWithCalls = 0;
  harness.handlers.fetch({
    request: { method: "GET", url, destination },
    respondWith(value) {
      respondWithCalls += 1;
      responsePromise = Promise.resolve(value);
    }
  });
  const response = responsePromise ? await responsePromise : null;
  return { ...harness, respondWithCalls, response };
}

test("production-equivalent response allows the exact Google resolver origin without broadening CSP", async t => {
  const base = await startServer(t);
  const response = await fetch(`${base}/auth.html`);
  assert.equal(response.status, 200);
  const csp = response.headers.get("content-security-policy");
  const script = directive(csp, "script-src");
  const connect = directive(csp, "connect-src");

  assert.match(script, /(?:^| )https:\/\/apis\.google\.com(?: |$)/);
  assert.match(connect, /(?:^| )https:\/\/apis\.google\.com(?: |$)/);
  for (const required of ["https://*.googleapis.com", "https://*.firebaseio.com", "https://*.imagekit.io", "https://upload.imagekit.io"]) {
    assert.ok(connect.split(/\s+/).includes(required), `connect-src must preserve ${required}`);
  }
  for (const forbidden of ["*", "https:", "https://*.google.com", "https://google.com"]) {
    assert.equal(connect.split(/\s+/).includes(forbidden), false, `connect-src must not contain ${forbidden}`);
  }
  assert.equal(directive(csp, "frame-ancestors"), "frame-ancestors 'none'");
  assert.equal(getFrameAncestorsDirective("/__/auth/iframe"), "frame-ancestors 'self'");
  assert.equal(getFrameAncestorsDirective("/__/auth/handler"), "frame-ancestors 'self'");
});

test("Google and Firebase authentication infrastructure stays outside Service Worker fetch/cache/fallback handling", async () => {
  const urls = [
    "https://apis.google.com/js/api.js?onload=resolver",
    "https://accounts.google.com/gsi/fedcm.json",
    "https://ofek-ai-55f1d.firebaseapp.com/__/auth/iframe",
    "https://fuelphysique.com/__/auth/iframe",
    "https://fuelphysique.com/__/auth/handler?state=private"
  ];

  for (const url of urls) {
    const result = await dispatchFetch(url);
    assert.equal(result.respondWithCalls, 0, `${url} must use browser-default network handling`);
    assert.deepEqual(result.calls, { fetch: 0, cacheOpen: 0, cacheMatch: 0, cachePut: 0 }, url);
    assert.equal(result.response, null, `${url} must receive no app fallback or synthetic 503`);
  }
});

test("existing private API, voice, Firebase API and gstatic bypasses remain network/default-only", async () => {
  const cases = [
    ["https://fuelphysique.com/api/social/conversations/thread/messages", ""],
    ["https://fuelphysique.com/api/social/conversations/thread/messages/message/voice/playback", "audio"],
    ["https://ik.imagekit.io/fuelphysique/private-voice.mp4?token=secret", "audio"],
    ["https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp", ""],
    ["https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js", "script"]
  ];
  for (const [url, destination] of cases) {
    const result = await dispatchFetch(url, destination);
    assert.equal(result.respondWithCalls, 0, url);
    assert.deepEqual(result.calls, { fetch: 0, cacheOpen: 0, cacheMatch: 0, cachePut: 0 }, url);
  }
});

test("ordinary application resources retain network-first PWA fallback behavior", async () => {
  const result = await dispatchFetch("https://fuelphysique.com/css/dashboard.css", "style");
  assert.equal(result.respondWithCalls, 1);
  assert.equal(result.calls.fetch, 1);
  assert.equal(result.calls.cacheMatch, 1);
  assert.equal(await result.response.text(), "app fallback");
});
