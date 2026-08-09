const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  getFrameAncestorsDirective,
  isFirebaseAuthHelperPath
} = require("../lib/security-headers");

const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

test("server sets baseline browser security headers and a restrictive CSP", () => {
  for (const value of ["Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "object-src 'none'"]) {
    assert.match(source, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.equal(getFrameAncestorsDirective("/auth.html"), "frame-ancestors 'none'");
  assert.match(source, /script-src 'self' 'unsafe-inline' https:\/\/www\.gstatic\.com https:\/\/apis\.google\.com/);
  assert.doesNotMatch(source, /script-src[^\n]*https:\/\/\*\.google\.com/);
  assert.match(source, /Strict-Transport-Security/);
});

test("only the exact Firebase Auth helper route can be framed by FuelPhysique itself", () => {
  for (const helperPath of ["/__/auth", "/__/auth/iframe", "/__/auth/handler", "/__/auth/iframe.js"]) {
    assert.equal(isFirebaseAuthHelperPath(helperPath), true, helperPath);
    assert.equal(getFrameAncestorsDirective(helperPath), "frame-ancestors 'self'", helperPath);
  }

  for (const applicationPath of ["/", "/auth.html", "/dashboard.html", "/api/account", "/__/authentication", "/__/auth-evil/iframe"]) {
    assert.equal(isFirebaseAuthHelperPath(applicationPath), false, applicationPath);
    assert.equal(getFrameAncestorsDirective(applicationPath), "frame-ancestors 'none'", applicationPath);
  }

  assert.match(source, /getFrameAncestorsDirective\(req\.path, AUTH_PROXY_PATH\)/);
});

test("the two Firebase emulator origins are available only in explicit local-demo mode", () => {
  assert.match(source, /localDemoMode \? \["http:\/\/127\.0\.0\.1:9099", "http:\/\/127\.0\.0\.1:8080"\] : \[\]/);
  assert.match(source, /connect-src \$\{cspConnectSources\}/);
});
