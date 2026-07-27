// Regression tests for Defect 2: OpenAI upstream failures (e.g. 403
// model_not_found) were forwarded to the browser as our own HTTP 403,
// which is indistinguishable from an auth failure on our API. These tests
// spawn the real server (server.js) as a child process and drive it over
// real HTTP, using MOCK_OPENAI_UPSTREAM_FAILURE=true (alongside the
// existing MOCK_EXTERNAL_SERVICES=true) to deterministically simulate a
// real upstream OpenAI failure without any network access — see the
// mockExternalServices branch in createChatCompletion (server.js).

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

function startServer(port, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(__dirname, "..", "server.js")],
      {
        env: {
          ...process.env,
          PORT: String(port),
          MOCK_EXTERNAL_SERVICES: "true",
          OPENAI_API_KEY: "sk-test-not-a-real-key-000000000000",
          ...extraEnv
        },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    const baseUrl = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 15_000;

    (async () => {
      let lastError;
      while (Date.now() < deadline) {
        try {
          const res = await fetch(`${baseUrl}/health`);
          if (res.ok) {
            resolve({ child, baseUrl, getStdout: () => stdout, getStderr: () => stderr });
            return;
          }
        } catch (error) {
          lastError = error;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      reject(new Error(`Server on port ${port} did not become healthy in time. Last error: ${lastError}. Stderr: ${stderr}`));
    })();
  });
}

function stopServer(server) {
  if (server?.child && !server.child.killed) server.child.kill();
}

let tokenCounter = 0;
function authHeaders() {
  tokenCounter += 1;
  return {
    Authorization: `Bearer mock-test-token-${tokenCounter}`,
    "Content-Type": "application/json"
  };
}

function buildWorkoutPayload(overrides = {}) {
  return {
    goal: "Build muscle",
    experience: "intermediate",
    age: 28,
    daysPerWeek: 1,
    sessionDuration: 60,
    trainingStyle: "gym",
    equipment: ["bodyweight"],
    availableDays: ["monday"],
    priority: "Hypertrophy",
    limitations: "None",
    language: "en",
    ...overrides
  };
}

// --- Server with upstream failure simulation active ---

let upstreamFailureServer;

test.before(async () => {
  upstreamFailureServer = await startServer(4180, { MOCK_OPENAI_UPSTREAM_FAILURE: "true" });
});

test.after(() => {
  stopServer(upstreamFailureServer);
});

test("OpenAI upstream 403 becomes local 502", async () => {
  const res = await fetch(`${upstreamFailureServer.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload({ language: "en" }))
  });
  const data = await res.json();

  assert.equal(res.status, 502, `Expected 502. Body: ${JSON.stringify(data)}`);
  assert.notEqual(res.status, 403, "Upstream 403 must never be forwarded verbatim");
});

test("English locale receives an English error message", async () => {
  const res = await fetch(`${upstreamFailureServer.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload({ language: "en" }))
  });
  const data = await res.json();

  assert.equal(res.status, 502);
  assert.equal(data.error, "Workout generation service is temporarily unavailable.");
});

test("Hebrew locale receives a Hebrew error message", async () => {
  const res = await fetch(`${upstreamFailureServer.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload({ language: "he" }))
  });
  const data = await res.json();

  assert.equal(res.status, 502);
  assert.equal(data.error, "שירות יצירת תוכנית האימונים אינו זמין כרגע.");
});

test("Reroll endpoint also maps upstream 403 to local 502", async () => {
  const program = {
    daysPerWeek: 1,
    sessionDuration: 60,
    sessions: [{ name: "Day 1", exercises: [{ exerciseId: "push-up", name: "Push-up", equipment: "bodyweight", sets: 3, reps: "8-12", restSeconds: 90, rir: "1-3" }] }]
  };
  const res = await fetch(`${upstreamFailureServer.baseUrl}/api/workout-builder/reroll-exercise`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ sessionIndex: 0, exerciseIndex: 0, program, equipment: ["bodyweight"], goal: "Build muscle", language: "en" })
  });
  const data = await res.json();

  assert.equal(res.status, 502, `Expected 502. Body: ${JSON.stringify(data)}`);
  assert.equal(data.error, "Workout generation service is temporarily unavailable.");
});

test("The upstream error body is logged safely (sanitized fields present in server logs)", async () => {
  const before = upstreamFailureServer.getStderr().length;
  await fetch(`${upstreamFailureServer.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload({ language: "en" }))
  });
  await new Promise((r) => setTimeout(r, 100));
  const logged = upstreamFailureServer.getStderr().slice(before);

  assert.ok(logged.includes("model_not_found"), "Sanitized upstream error code should be logged");
  assert.ok(logged.includes("invalid_request_error"), "Sanitized upstream error type should be logged");
});

test("The API key is never logged (startup diagnostics or error logs)", async () => {
  const fullKey = "sk-test-not-a-real-key-000000000000";
  const stdout = upstreamFailureServer.getStdout();
  const stderr = upstreamFailureServer.getStderr();

  assert.ok(!stdout.includes(fullKey), "Full API key must not appear in stdout");
  assert.ok(!stderr.includes(fullKey), "Full API key must not appear in stderr");
});

test("Startup diagnostics log key presence/length without the full key", async () => {
  const stdout = upstreamFailureServer.getStdout();
  assert.ok(stdout.includes("[openai-diagnostics] startup:"), "Startup diagnostic line should be present");
  assert.ok(stdout.includes("\"apiKeyPresent\":true"), "Should report key presence");
  assert.ok(stdout.includes("\"apiKeyFirst4\":\"sk-t\""), "Should report only first 4 characters");
  assert.ok(stdout.includes("\"apiKeyLast4\":\"0000\""), "Should report only last 4 characters");
});

// --- Server WITHOUT upstream failure simulation (normal mock success) ---

let normalServer;

test("A successful mocked OpenAI response still returns 200", async (t) => {
  normalServer = await startServer(4181);
  t.after(() => stopServer(normalServer));

  const res = await fetch(`${normalServer.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload())
  });
  const data = await res.json();

  assert.equal(res.status, 200, `Expected 200. Body: ${JSON.stringify(data)}`);
  assert.equal(data.success, true);
});

test("Internal validation 422 remains 422 (not remapped to 502)", async (t) => {
  const server = await startServer(4182);
  t.after(() => stopServer(server));

  // sessionDuration at the minimum (20) with the fixed 5-exercise mock
  // program deterministically exceeds the session-duration cap.
  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload({ sessionDuration: 20 }))
  });
  const data = await res.json();

  assert.equal(res.status, 422, `Expected 422. Body: ${JSON.stringify(data)}`);
  assert.equal(data.success, false);
});

test("Internal rate limit 429 remains 429 (not remapped to 502)", async (t) => {
  const server = await startServer(4183, { AI_PER_UID_PER_MINUTE: "1" });
  t.after(() => stopServer(server));

  const headers = authHeaders(); // same token/uid for both requests, deliberately
  const payload = JSON.stringify(buildWorkoutPayload());

  const first = await fetch(`${server.baseUrl}/api/workout-builder`, { method: "POST", headers, body: payload });
  assert.equal(first.status, 200, "First request should succeed");

  const second = await fetch(`${server.baseUrl}/api/workout-builder`, { method: "POST", headers, body: payload });
  const secondData = await second.json();

  assert.equal(second.status, 429, `Expected 429. Body: ${JSON.stringify(secondData)}`);
});
