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
const net = require("node:net");
const path = require("node:path");
const { stopChildProcess } = require("./child-process-cleanup");

function getAvailablePort() {
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

async function startServer(port, extraEnv = {}) {
  const selectedPort = port === 0 ? await getAvailablePort() : port;
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(__dirname, "..", "server.js")],
      {
        env: {
          ...process.env,
          PORT: String(selectedPort),
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

    const baseUrl = `http://127.0.0.1:${selectedPort}`;
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
      reject(new Error(`Server on port ${selectedPort} did not become healthy in time. Last error: ${lastError}. Stderr: ${stderr}`));
    })();
  });
}

function stopServer(server) {
  stopChildProcess(server?.child);
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

test.describe("OpenAI upstream error mapping", { concurrency: false }, () => {
let upstreamFailureServer;

test.before(async () => {
  upstreamFailureServer = await startServer(0, { MOCK_OPENAI_UPSTREAM_FAILURE: "true" });
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
  normalServer = await startServer(0);
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
  // MOCK_OPENAI_FORCE_DUPLICATE_EXERCISE_ID forces two exercises to share a
  // pre-set exerciseId — the repair-before-validate pipeline (see
  // lib/workout-repair.js) only fills in a MISSING exerciseId, it never
  // silently rewrites one already provided, so this stays invalid (Rule 9)
  // even after repair, deterministically forcing this 422 path.
  const server = await startServer(0, { MOCK_OPENAI_FORCE_EMPTY_SESSION: "true" });
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload())
  });
  const data = await res.json();

  assert.equal(res.status, 422, `Expected 422. Body: ${JSON.stringify(data)}`);
  assert.equal(data.success, false);
});

test("Internal rate limit 429 remains 429 (not remapped to 502)", async (t) => {
  const server = await startServer(0, { AI_PER_UID_PER_MINUTE: "1" });
  t.after(() => stopServer(server));

  const headers = authHeaders(); // same token/uid for both requests, deliberately
  const payload = JSON.stringify(buildWorkoutPayload());

  const first = await fetch(`${server.baseUrl}/api/workout-builder`, { method: "POST", headers, body: payload });
  assert.equal(first.status, 200, "First request should succeed");

  const second = await fetch(`${server.baseUrl}/api/workout-builder`, { method: "POST", headers, body: payload });
  const secondData = await second.json();

  assert.equal(second.status, 429, `Expected 429. Body: ${JSON.stringify(secondData)}`);
});

test("Workout Builder uses the dedicated workout model fallback", async (t) => {
  const server = await startServer(0, {
    OPENAI_CHAT_MODEL: "",
    OPENAI_WORKOUT_MODEL: ""
  });
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload())
  });
  const data = await res.json();

  assert.equal(res.status, 200, `Expected 200. Body: ${JSON.stringify(data)}`);
  assert.equal(data.success, true);
  assert.ok(
    server.getStdout().includes("\"selectedWorkoutModel\":\"gpt-4.1-mini\""),
    "startup diagnostics should show the safe workout fallback without exposing secrets"
  );
});

test("GPT-5 empty visible content returns the local incomplete-response 502", async (t) => {
  const server = await startServer(0, {
    OPENAI_WORKOUT_MODEL: "gpt-5-mini",
    MOCK_OPENAI_CHAT_RESPONSE_MODE: "empty-content"
  });
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload({ language: "en" }))
  });
  const data = await res.json();

  assert.equal(res.status, 502, `Expected 502. Body: ${JSON.stringify(data)}`);
  assert.equal(data.error, "The workout service returned an incomplete response. Please try again.");
  assert.ok(server.getStderr().includes("openai_reasoning_exhausted"));
});

test("finish_reason length is treated as truncated output and returns 502 after one retry", async (t) => {
  const server = await startServer(0, { MOCK_OPENAI_CHAT_RESPONSE_MODE: "length" });
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload())
  });
  const data = await res.json();

  assert.equal(res.status, 502, `Expected 502. Body: ${JSON.stringify(data)}`);
  assert.equal(data.error, "The workout service returned an incomplete response. Please try again.");
  assert.ok(server.getStderr().includes("openai_truncated"));
});

test("model refusal is not retried and returns incomplete-response 502", async (t) => {
  const server = await startServer(0, { MOCK_OPENAI_CHAT_RESPONSE_MODE: "refusal" });
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload())
  });
  const data = await res.json();

  assert.equal(res.status, 502, `Expected 502. Body: ${JSON.stringify(data)}`);
  assert.equal(data.error, "The workout service returned an incomplete response. Please try again.");
  assert.ok(server.getStderr().includes("openai_refusal"));
  assert.ok(!server.getStderr().includes("retrying once"), "Refusals must not be retried");
});

test("malformed JSON after visible text returns invalid-format 502 without retry", async (t) => {
  const server = await startServer(0, { MOCK_OPENAI_CHAT_RESPONSE_MODE: "malformed-json" });
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload())
  });
  const data = await res.json();

  assert.equal(res.status, 502, `Expected 502. Body: ${JSON.stringify(data)}`);
  assert.equal(data.error, "The AI returned an invalid workout format");
  assert.ok(server.getStderr().includes("Workout JSON parsing failed"));
  assert.ok(!server.getStderr().includes("{ not valid json"), "Full raw model response should not be logged");
});

test("a transient empty response is retried once and then succeeds", async (t) => {
  const server = await startServer(0, { MOCK_OPENAI_CHAT_RESPONSE_MODE: "retry-success" });
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload())
  });
  const data = await res.json();

  assert.equal(res.status, 200, `Expected 200. Body: ${JSON.stringify(data)}`);
  assert.equal(data.success, true);
  assert.ok(server.getStderr().includes("retrying once"));
});

test("a repeated empty response fails with 502 after the single retry", async (t) => {
  const server = await startServer(0, { MOCK_OPENAI_CHAT_RESPONSE_MODE: "retry-fail" });
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload())
  });
  const data = await res.json();

  assert.equal(res.status, 502, `Expected 502. Body: ${JSON.stringify(data)}`);
  assert.equal(data.error, "The workout service returned an incomplete response. Please try again.");
  const stderr = server.getStderr();
  assert.equal((stderr.match(/retrying once/g) || []).length, 1, "Only one retry is allowed");
});
});
