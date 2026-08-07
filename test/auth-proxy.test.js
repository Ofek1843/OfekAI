// Firebase Auth reverse proxy (lib/auth-proxy.js) and environment-aware
// authDomain resolution (public/js/firebase-environment.mjs).
//
// Root cause fixed: Google's OAuth consent screen shows "Continue to
// {authDomain}" verbatim, and authDomain was hardcoded to the internal
// Firebase project id (ofek-ai-55f1d.firebaseapp.com) regardless of
// environment. Production now uses fuelphysique.com, made real by a
// transparent reverse proxy at /__/auth/* (the app is hosted on Render, not
// Firebase Hosting, so this path must be proxied rather than natively
// served).
//
// Integration tests spin up a REAL local Express server using the real
// createAuthProxy(), pointed at a local mock "Firebase" server instead of
// the real internet -- following this codebase's existing convention
// (MOCK_EXTERNAL_SERVICES elsewhere) of never letting `npm test` depend on
// real outbound network access.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const express = require("express");

const {
  createAuthProxy,
  AUTH_PROXY_PATH,
  FIREBASE_PROJECT_AUTH_DOMAIN,
  FIREBASE_AUTH_UPSTREAM,
  rewriteUpstreamLocation
} = require("../lib/auth-proxy");

const {
  FIREBASE_PROJECT_AUTH_DOMAIN: CLIENT_FIREBASE_DOMAIN,
  PRODUCTION_AUTH_DOMAIN,
  PRODUCTION_HOSTNAMES,
  resolveAuthDomain,
  isProductionAuthHostname
} = require("../public/js/firebase-environment.mjs");

const ROOT = path.join(__dirname, "..");

// --- Starts a local mock "Firebase" upstream + our real proxy in front of it.
async function startMockUpstream() {
  const requestsSeen = [];
  const upstream = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      requestsSeen.push({
        method: req.method,
        url: req.url,
        headers: { ...req.headers },
        body
      });

      if (req.url.includes("mode=redirectTest")) {
        res.writeHead(302, { Location: `${FIREBASE_AUTH_UPSTREAM}/__/auth/handler?continued=1` });
        res.end();
        return;
      }
      if (req.url.includes("mode=slow")) {
        // Never responds -- exercised by the timeout test.
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, method: req.method, url: req.url, body }));
    });
  });

  await new Promise((resolve) => upstream.listen(0, resolve));
  const upstreamPort = upstream.address().port;
  const upstreamTarget = `http://127.0.0.1:${upstreamPort}`;

  const app = express();
  app.use(AUTH_PROXY_PATH, createAuthProxy({ target: upstreamTarget }));
  app.use((req, res) => res.status(404).json({ error: "not proxied" }));

  const proxyServer = await new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
  const proxyPort = proxyServer.address().port;

  async function close() {
    await new Promise((resolve) => proxyServer.close(resolve));
    await new Promise((resolve) => upstream.close(resolve));
  }

  return { proxyPort, requestsSeen, close };
}

// --- Root cause / authDomain resolution ------------------------------------

test("production hostnames resolve to the public fuelphysique.com authDomain", () => {
  assert.equal(PRODUCTION_AUTH_DOMAIN, "fuelphysique.com");
  for (const hostname of PRODUCTION_HOSTNAMES) {
    assert.equal(resolveAuthDomain(hostname), "fuelphysique.com");
    assert.equal(isProductionAuthHostname(hostname), true);
  }
});

test("every non-production hostname (localhost, a Render preview URL, a typo) falls back to the Firebase project domain, never fuelphysique.com", () => {
  for (const hostname of [
    "localhost", "127.0.0.1", "192.168.1.10",
    "ofek-ai-55f1d.onrender.com", "some-preview-abc123.onrender.com",
    "fuelphysique.co", "fuelphysique.com.evil.com", "evil.com",
    "", null, undefined
  ]) {
    assert.equal(resolveAuthDomain(hostname), CLIENT_FIREBASE_DOMAIN, `${String(hostname)} must not resolve to production`);
    assert.equal(isProductionAuthHostname(hostname), false);
  }
});

test("the resolution is case-insensitive but exact-match only -- no subdomain wildcard, no substring match", () => {
  assert.equal(resolveAuthDomain("FUELPHYSIQUE.COM"), PRODUCTION_AUTH_DOMAIN, "case must not matter");
  assert.equal(resolveAuthDomain("app.fuelphysique.com"), CLIENT_FIREBASE_DOMAIN, "an arbitrary subdomain must not match");
  assert.equal(resolveAuthDomain("notfuelphysique.com"), CLIENT_FIREBASE_DOMAIN);
});

test("firebase-config.js resolves authDomain per-environment and uses the demo project only for loopback emulators", () => {
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "firebase-config.js"), "utf8");
  assert.match(source, /resolveAuthDomain\(window\.location\.hostname\)/);
  assert.match(source, /from\s*["']\.\/firebase-environment\.mjs["']/);
  // Production identifiers remain fixed; loopback pages use the matching demo
  // project so Firebase client listeners authenticate against local emulators.
  assert.match(source, /apiKey:\s*"AIzaSyB5EAK98RQP_LNd0fgj3UtCwE17lwXTADU"/);
  assert.match(source, /projectId:\s*localEmulatorMode\s*\?\s*"demo-fuelphysique"\s*:\s*"ofek-ai-55f1d"/);
  assert.match(source, /appId:\s*"1:644398760036:web:aa34bd6a283d686560df71"/);
  assert.match(source, /storageBucket:\s*"ofek-ai-55f1d\.firebasestorage\.app"/);
  assert.match(source, /messagingSenderId:\s*"644398760036"/);
});

test("firebase config is defined in exactly one authoritative source -- no duplicated Firebase initialization elsewhere", () => {
  const jsDir = path.join(ROOT, "public", "js");
  const offenders = [];
  for (const file of fs.readdirSync(jsDir)) {
    if (!file.endsWith(".js") && !file.endsWith(".mjs")) continue;
    if (file === "firebase-config.js") continue;
    const source = fs.readFileSync(path.join(jsDir, file), "utf8");
    if (/apiKey:\s*["']AIzaSy/.test(source)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], "firebase-config.js must be the only file defining the Firebase config object");
});

// --- Proxy: fixed upstream, cannot become an open proxy ---------------------

test("the proxy's upstream is a fixed constant, matching the client's authDomain fallback exactly", () => {
  assert.equal(FIREBASE_PROJECT_AUTH_DOMAIN, "ofek-ai-55f1d.firebaseapp.com");
  assert.equal(FIREBASE_AUTH_UPSTREAM, "https://ofek-ai-55f1d.firebaseapp.com");
  // The two independent sources of this domain (server-side proxy target,
  // client-side dev-fallback authDomain) must never silently diverge.
  assert.equal(FIREBASE_PROJECT_AUTH_DOMAIN, CLIENT_FIREBASE_DOMAIN);
});

test("createAuthProxy's target cannot be influenced by any request-derived input -- source-level proof", () => {
  const source = fs.readFileSync(path.join(ROOT, "lib", "auth-proxy.js"), "utf8");
  // The only place "target" is assigned is the default parameter itself.
  assert.doesNotMatch(source, /target:\s*req\./);
  assert.doesNotMatch(source, /target:\s*.*headers/);
  assert.doesNotMatch(source, /target:\s*.*query/);
  assert.doesNotMatch(source, /target:\s*.*body/);
  assert.doesNotMatch(source, /target:\s*process\.env/);
});

test("server.js mounts the proxy at the fixed AUTH_PROXY_PATH with no arguments (the real fixed upstream), before the body parsers", () => {
  const source = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
  assert.match(source, /createAuthProxy\(\)/);
  assert.doesNotMatch(source, /createAuthProxy\(\s*\{\s*target/, "server.js must never override the fixed upstream");
  assert.match(source, /app\.use\(AUTH_PROXY_PATH, createAuthProxy\(\)\)/);

  const proxyIndex = source.indexOf("app.use(AUTH_PROXY_PATH, createAuthProxy())");
  const jsonParserIndex = source.indexOf("app.use(express.json(");
  const staticIndex = source.indexOf("app.use(express.static(");
  assert.ok(proxyIndex !== -1 && jsonParserIndex !== -1 && staticIndex !== -1);
  assert.ok(proxyIndex < jsonParserIndex, "the proxy must be registered before express.json() consumes the request body");
  assert.ok(proxyIndex < staticIndex, "the proxy must be registered before static file serving, or /__/auth/* would 404 first");
});

// --- Transparent proxying: path, query, method, headers ---------------------

test("GET requests are proxied transparently with the full path and query string preserved", async () => {
  const { proxyPort, requestsSeen, close } = await startMockUpstream();
  try {
    const res = await fetch(`http://127.0.0.1:${proxyPort}${AUTH_PROXY_PATH}/action?mode=verifyEmail&oobCode=ABC123&lang=en`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.method, "GET");
    assert.equal(body.url, "/__/auth/action?mode=verifyEmail&oobCode=ABC123&lang=en");
    assert.equal(requestsSeen.length, 1);
  } finally {
    await close();
  }
});

test("POST requests are proxied with the body preserved", async () => {
  const { proxyPort, requestsSeen, close } = await startMockUpstream();
  try {
    const res = await fetch(`http://127.0.0.1:${proxyPort}${AUTH_PROXY_PATH}/handler`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "code=xyz&state=abc"
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.method, "POST");
    assert.equal(requestsSeen[0].body, "code=xyz&state=abc");
  } finally {
    await close();
  }
});

test("the Host header sent upstream matches the target, not the original request's Host (changeOrigin)", async () => {
  const { proxyPort, requestsSeen, close } = await startMockUpstream();
  try {
    await fetch(`http://127.0.0.1:${proxyPort}${AUTH_PROXY_PATH}/handler?apiKey=x`);
    assert.match(requestsSeen[0].headers.host, /^127\.0\.0\.1:\d+$/, "Host must be rewritten to the proxy target, not left as the original request Host");
  } finally {
    await close();
  }
});

test("a nested/unrelated path outside AUTH_PROXY_PATH is never proxied", async () => {
  const { proxyPort, requestsSeen, close } = await startMockUpstream();
  try {
    const res = await fetch(`http://127.0.0.1:${proxyPort}/some-other-path`);
    assert.equal(res.status, 404);
    assert.equal(requestsSeen.length, 0, "the mock upstream must never have been reached");
  } finally {
    await close();
  }
});

test("an upstream error returns a generic authentication-unavailable message, never a raw proxy error", async () => {
  const app = express();
  // Target a port nothing is listening on to force a connection error.
  app.use(AUTH_PROXY_PATH, createAuthProxy({ target: "http://127.0.0.1:1" }));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  try {
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}${AUTH_PROXY_PATH}/handler`);
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.error, "Authentication is temporarily unavailable. Please try again.");
    assert.doesNotMatch(JSON.stringify(body), /ECONNREFUSED|errno|syscall/i, "no raw Node error detail may leak to the client");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// --- Location header rewrite ------------------------------------------------

test("rewriteUpstreamLocation replaces the Firebase project domain with the request's own host", () => {
  const proxyRes = { headers: { location: `${FIREBASE_AUTH_UPSTREAM}/__/auth/handler?continued=1` } };
  const req = { headers: { host: "fuelphysique.com" } };
  rewriteUpstreamLocation(proxyRes, req);
  assert.equal(proxyRes.headers.location, "https://fuelphysique.com/__/auth/handler?continued=1");
});

test("rewriteUpstreamLocation leaves an unrelated or missing Location header untouched", () => {
  const untouched = { headers: { location: "https://accounts.google.com/somewhere" } };
  rewriteUpstreamLocation(untouched, { headers: { host: "fuelphysique.com" } });
  assert.equal(untouched.headers.location, "https://accounts.google.com/somewhere");

  const noLocation = { headers: {} };
  assert.doesNotThrow(() => rewriteUpstreamLocation(noLocation, { headers: { host: "fuelphysique.com" } }));
});

test("a redirect produced mid-flow by the upstream is rewritten end-to-end through the real proxy", async () => {
  const { proxyPort, close } = await startMockUpstream();
  try {
    const res = await fetch(
      `http://127.0.0.1:${proxyPort}${AUTH_PROXY_PATH}/action?mode=redirectTest`,
      { redirect: "manual" }
    );
    assert.equal(res.status, 302);
    const location = res.headers.get("location");
    assert.ok(location, "expected a Location header");
    assert.doesNotMatch(location, /ofek-ai-55f1d\.firebaseapp\.com/, "the internal Firebase domain must never leak into a redirect Location");
    assert.match(location, new RegExp(`^https://127\\.0\\.0\\.1:${proxyPort}/__/auth/handler`));
  } finally {
    await close();
  }
});

// --- No token/OAuth code logging --------------------------------------------

test("the proxy's error handler logs only the error class/code, never the request URL (which may carry an OAuth code or state)", () => {
  const source = fs.readFileSync(path.join(ROOT, "lib", "auth-proxy.js"), "utf8");
  const errorHandler = source.match(/error:\s*\(err, req, res\) => \{[\s\S]*?\n      \}/);
  assert.ok(errorHandler, "expected an error handler");
  assert.doesNotMatch(errorHandler[0], /req\.url|req\.originalUrl|req\.query/, "the error handler must never log the request URL/query");
});

test("no proxyReq/proxyRes hook logs headers, query strings, or bodies", () => {
  const source = fs.readFileSync(path.join(ROOT, "lib", "auth-proxy.js"), "utf8");
  const consoleCalls = source.match(/console\.(log|error|warn|info)\([^)]*\)/g) || [];
  for (const call of consoleCalls) {
    assert.doesNotMatch(call, /req\.(url|query|headers|body)|proxyReq|oobCode|code=|state=/i, `logging call must not leak request detail: ${call}`);
  }
});

// --- Service worker exclusion -----------------------------------------------

test("the service worker never caches /__/auth/* -- OAuth helper responses always go to the network", () => {
  const sw = fs.readFileSync(path.join(ROOT, "public", "sw.js"), "utf8");
  assert.match(sw, /AUTH_PROXY_PREFIX\s*=\s*['"]\/__\/auth\/['"]/);
  assert.match(sw, /requestPath\.startsWith\(AUTH_PROXY_PREFIX\)/);

  // The exclusion check must appear before the code path that calls
  // caches.open(...).put(...) -- i.e. before any actual cache write.
  const exclusionIndex = sw.indexOf("requestPath.startsWith(AUTH_PROXY_PREFIX)");
  const cachePutIndex = sw.indexOf("cache.put(");
  assert.ok(exclusionIndex !== -1 && cachePutIndex !== -1);
  assert.ok(exclusionIndex < cachePutIndex, "the exclusion must be checked before any cache write is reachable");
});

test("the service worker's cache version was bumped so no stale pre-fix worker keeps caching auth traffic", () => {
  const sw = fs.readFileSync(path.join(ROOT, "public", "sw.js"), "utf8");
  assert.match(sw, /CACHE_NAME = 'fuelphysique-v6'/);
});

// --- Existing Google popup/redirect flow regression -------------------------

test("the Google popup and redirect flow logic in auth.js is unchanged by this proxy work", () => {
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "auth.js"), "utf8");
  assert.match(source, /signInWithPopup/);
  assert.match(source, /signInWithRedirect/);
  assert.match(source, /getRedirectResult/);
  assert.match(source, /shouldUseRedirect\(/);
});

test("getRedirectResult is still resolved before the auth-state guard is registered -- no redirect loop introduced", () => {
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "auth.js"), "utf8");
  const redirectResultIndex = source.indexOf("getRedirectResult(auth)");
  const guardIndex = source.indexOf("onAuthStateChanged(auth, (user)");
  assert.ok(redirectResultIndex !== -1 && guardIndex !== -1);
  assert.ok(redirectResultIndex < guardIndex);
});

test("the next destination allowlist used after a Google redirect is unchanged", () => {
  const { resolveNextPath, ALLOWED_NEXT_PATHS } = require("../public/js/auth-google-core.mjs");
  assert.deepEqual(ALLOWED_NEXT_PATHS, ["workout-builder.html", "nutrition-builder.html", "social.html", "workout-tracker.html"]);
  assert.equal(resolveNextPath("workout-builder.html"), "/workout-builder.html");
  assert.equal(resolveNextPath("https://evil.com"), "/dashboard.html");
});
