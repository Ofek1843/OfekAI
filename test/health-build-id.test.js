const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.join(__dirname, "..");

test("/health exposes the Render commit as a non-secret build identifier", async () => {
  const port = 4191;
  const expected = "0123456789abcdef0123456789abcdef01234567";
  const server = spawn(process.execPath, [path.join(ROOT, "server.js")], {
    env: {
      ...process.env,
      PORT: String(port),
      RENDER_GIT_COMMIT: expected,
      MOCK_EXTERNAL_SERVICES: "true"
    },
    stdio: ["ignore", "ignore", "ignore"]
  });

  try {
    const deadline = Date.now() + 15_000;
    let response;
    while (Date.now() < deadline) {
      try {
        response = await fetch(`http://127.0.0.1:${port}/health`);
        if (response.ok) break;
      } catch {
        // The server is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(response?.ok, "health endpoint did not become ready");
    const body = await response.json();
    assert.deepEqual(body.ok, true);
    assert.equal(body.buildId, expected);
    assert.equal(typeof body.uptime, "number");
    assert.equal(typeof body.now, "string");
  } finally {
    server.kill();
  }
});
