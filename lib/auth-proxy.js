// Transparent reverse proxy for Firebase Authentication's OAuth helper
// endpoints, so the Google account-selector consent screen shows
// "Continue to fuelphysique.com" instead of the internal Firebase project
// domain (ofek-ai-55f1d.firebaseapp.com). See public/js/firebase-environment.mjs
// for the client-side half of this fix (which authDomain gets initialized
// per environment) and the release report for the required Firebase/Google
// Console configuration (Authorized domains, OAuth redirect URI).
//
// Must be registered in server.js BEFORE any body-parsing middleware
// (express.json/express.urlencoded): a POST body already consumed by those
// would never reach the proxied upstream, since http-proxy-middleware
// forwards the original, unconsumed request stream.

const { createProxyMiddleware } = require("http-proxy-middleware");

// Fixed, hardcoded upstream -- deliberately never derived from a request
// header, query parameter, request body or environment variable an
// attacker could influence. This is the ONLY host this proxy is allowed to
// forward to. Must match FIREBASE_PROJECT_AUTH_DOMAIN in
// public/js/firebase-environment.mjs -- test/auth-proxy.test.js asserts
// the two stay identical so they can never silently diverge.
const FIREBASE_PROJECT_AUTH_DOMAIN = "ofek-ai-55f1d.firebaseapp.com";
const FIREBASE_AUTH_UPSTREAM = `https://${FIREBASE_PROJECT_AUTH_DOMAIN}`;

// Only Firebase's own OAuth helper paths are proxied -- never the whole
// site. Registered as the Express mount path in server.js
// (app.use(AUTH_PROXY_PATH, createAuthProxy())), so nothing outside this
// prefix ever reaches this proxy at all.
const AUTH_PROXY_PATH = "/__/auth";

// Rewrites a Location header that points back at the Firebase project
// domain to point at this request's own host instead -- so a redirect
// produced mid-flow by Firebase's own helper (e.g. handler -> handler hops)
// never leaks the internal project domain back into the browser's address
// bar or history.
function rewriteUpstreamLocation(proxyRes, req) {
  const location = proxyRes.headers?.location;
  if (typeof location !== "string" || !location.includes(FIREBASE_PROJECT_AUTH_DOMAIN)) return;
  proxyRes.headers.location = location.replace(FIREBASE_AUTH_UPSTREAM, `https://${req.headers.host}`);
}

// createAuthProxy({ target }) -> Express middleware. A fresh instance per
// call (no shared mutable state) so tests can construct isolated instances.
// `target` defaults to the fixed Firebase upstream and exists ONLY so the
// test suite can point this at a local mock server instead of the real
// internet (following this codebase's existing convention of never letting
// `npm test` depend on real outbound network access -- see
// MOCK_EXTERNAL_SERVICES elsewhere). server.js always calls this with no
// arguments; nothing about `target` is ever reachable from an incoming
// request (no header, query parameter, or body can influence it) --
// see test/auth-proxy.test.js's "cannot become an open proxy" coverage.
function createAuthProxy({ target = FIREBASE_AUTH_UPSTREAM } = {}) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    xfwd: true,
    // Express's app.use(AUTH_PROXY_PATH, ...) mounting strips the mount
    // path from req.url before this middleware ever sees it (req.url
    // becomes e.g. "/action?..." instead of "/__/auth/action?..."). Without
    // restoring the prefix here, every proxied request would silently hit
    // the wrong upstream path and Firebase's edge would return its generic
    // "Site Not Found" page instead of the real Auth helper response.
    pathRewrite: (path) => `${AUTH_PROXY_PATH}${path}`,
    // Generous but bounded -- an OAuth helper round trip should never
    // legitimately take this long; a hung upstream must fail, not wedge a
    // sign-in request open indefinitely.
    proxyTimeout: 15000,
    timeout: 15000,
    on: {
      proxyRes: (proxyRes, req) => {
        rewriteUpstreamLocation(proxyRes, req);
      },
      error: (err, req, res) => {
        // Logs only the error class/code -- never the request URL, which
        // for this path routinely carries an OAuth authorization code or
        // state value in its query string.
        console.error("Auth proxy upstream error:", err?.code || err?.message || "unknown");
        if (res.headersSent) {
          res.end();
          return;
        }
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Authentication is temporarily unavailable. Please try again." }));
      }
    }
  });
}

module.exports = {
  createAuthProxy,
  AUTH_PROXY_PATH,
  FIREBASE_PROJECT_AUTH_DOMAIN,
  FIREBASE_AUTH_UPSTREAM,
  rewriteUpstreamLocation
};
