// End-to-end HTTP regression test for the production 422 root cause:
// spawns the real server.js with MOCK_OPENAI_OMIT_EXERCISE_ID=true, which
// makes the mocked AI response omit exerciseId exactly like the real
// production AI response does (see createChatCompletion's mock branch in
// server.js — the prompt's JSON schema never asked for exerciseId). Proves
// the full repair-before-validate pipeline via real HTTP, not just the
// unit-level lib/workout-repair.js tests.

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
          OPENAI_API_KEY: "test-key-not-used-in-mock-mode",
          ...extraEnv
        },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    const baseUrl = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 15_000;

    (async () => {
      let lastError;
      while (Date.now() < deadline) {
        try {
          const res = await fetch(`${baseUrl}/health`);
          if (res.ok) { resolve({ child, baseUrl }); return; }
        } catch (error) {
          lastError = error;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      reject(new Error(`Server on port ${port} did not become healthy. Last error: ${lastError}. Stderr: ${stderr}`));
    })();
  });
}

function stopServer(server) {
  if (server?.child && !server.child.killed) server.child.kill();
}

let tokenCounter = 0;
function authHeaders() {
  tokenCounter += 1;
  return { Authorization: `Bearer mock-test-token-${tokenCounter}`, "Content-Type": "application/json" };
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

test("Production AI response shape (no exerciseId) is repaired and returns 200, not 422", async (t) => {
  const server = await startServer(4200, { MOCK_OPENAI_OMIT_EXERCISE_ID: "true" });
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload())
  });
  const data = await res.json();

  assert.equal(res.status, 200, `Expected 200 after repair. Body: ${JSON.stringify(data)}`);
  assert.equal(data.success, true);
  for (const session of data.program.sessions) {
    for (const exercise of session.exercises) {
      assert.equal(typeof exercise.exerciseId, "string");
      assert.ok(exercise.exerciseId.length > 0, "Every returned exercise must have a non-empty exerciseId");
    }
  }
});

test("Without the repair fix, the same AI response shape would fail validation (sanity check on the fixture)", async (t) => {
  // This test doesn't call repair — it directly proves the mock's
  // omit-exerciseId output really does violate the schema rule, so the
  // 200 in the previous test is attributable to the repair step and not to
  // the fixture accidentally already being valid.
  const { validateWorkoutProgram } = require("../lib/workout-validator");
  const program = {
    daysPerWeek: 1,
    weeklyScheduleDays: [1],
    sessions: [{
      name: "Mock Session 1",
      exercises: [
        { name: "Push-up", demoName: "Push-up", muscleGroup: "Chest", equipment: "Bodyweight", sets: 3, reps: "8-12", restSeconds: 90, rir: "1-3" }
      ]
    }]
  };
  const result = validateWorkoutProgram(program, { daysPerWeek: 1, sessionDuration: 60, equipment: ["bodyweight"], availableDayIndexes: [1] });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("missing exerciseId")));
});

test("English locale 422 (still-invalid-after-repair) returns a friendly English message, no raw validator lines", async (t) => {
  // MOCK_OPENAI_FORCE_DUPLICATE_EXERCISE_ID forces two exercises to share a
  // pre-set exerciseId. Repair only fills in a MISSING exerciseId — it
  // never rewrites one already provided — so this stays invalid (Rule 9)
  // even after repair, deterministically forcing this 422 path.
  //
  // Per the equipment/language hotfix: the 422 response deliberately no
  // longer includes a `details` array of raw validator lines — those are
  // internal diagnostics (still logged server-side), not something a user
  // can act on. Only a friendly, localized `error` message is returned.
  const server = await startServer(4201, { MOCK_OPENAI_FORCE_EMPTY_SESSION: "true" });
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload({ language: "en" }))
  });
  const data = await res.json();

  assert.equal(res.status, 422, `Expected 422. Body: ${JSON.stringify(data)}`);
  assert.equal(data.success, false);
  assert.equal(typeof data.error, "string");
  assert.ok(data.error.length > 0);
  assert.equal(data.details, undefined, "422 response must not expose raw validator lines");
  assert.ok(!/[֐-׿]/.test(data.error), `English error must not contain Hebrew: "${data.error}"`);
});

test("Hebrew locale 422 (still-invalid-after-repair) returns a friendly Hebrew message, no raw validator lines", async (t) => {
  const server = await startServer(4202, { MOCK_OPENAI_FORCE_EMPTY_SESSION: "true" });
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload({ language: "he" }))
  });
  const data = await res.json();

  assert.equal(res.status, 422, `Expected 422. Body: ${JSON.stringify(data)}`);
  assert.equal(data.success, false);
  assert.equal(typeof data.error, "string");
  assert.ok(/[֐-׿]/.test(data.error), `Hebrew error must contain Hebrew characters: "${data.error}"`);
  assert.equal(data.details, undefined, "422 response must not expose raw validator lines");
});

test("A valid mocked generation (exerciseId present) still returns 200 with no repairs needed", async (t) => {
  const server = await startServer(4203);
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload())
  });
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.success, true);
});

// --- Static regression check on the actual shipped frontend fix ---

test("workout-builder.js: displays the specific validation details, not only the generic message", () => {
  const fs = require("node:fs");
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "js", "workout-builder.js"), "utf8");

  assert.ok(
    /error\.details\s*=\s*Array\.isArray\(data\.details\)/.test(source),
    "The thrown error must carry the API's details array"
  );
  assert.ok(
    /error\.details\.map\(/.test(source) || /detailLines/.test(source),
    "The catch block must render the details array, not just error.message"
  );
});
