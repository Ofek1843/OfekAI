const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

test("server sets baseline browser security headers and a restrictive CSP", () => {
  for (const value of ["Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "frame-ancestors 'none'", "object-src 'none'"]) {
    assert.match(source, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(source, /Strict-Transport-Security/);
});

test("the two Firebase emulator origins are available only in explicit local-demo mode", () => {
  assert.match(source, /localDemoMode \? \["http:\/\/127\.0\.0\.1:9099", "http:\/\/127\.0\.0\.1:8080"\] : \[\]/);
  assert.match(source, /connect-src \$\{cspConnectSources\}/);
});
