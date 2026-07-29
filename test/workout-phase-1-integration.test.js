// HTTP integration tests against the actual Express app in server.js.
//
// The server is spawned as a real child process (so these tests exercise the
// real request/response cycle, not an in-process mock of Express) with
// MOCK_EXTERNAL_SERVICES=true, which deterministically stubs both the OpenAI
// call (see createChatCompletion in server.js) and Firebase token
// verification (see requireFirebaseUser in server.js) — no network calls to
// OpenAI or Firebase happen during this suite. A bearer token is still
// required on every authenticated route; only the upstream verification
// call is skipped.

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { normalizeEquipment } = require("../lib/workout-validator");

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// The server enforces a per-uid AI rate limit (default 6/min — see
// rateLimiters.ai in server.js), and requireFirebaseUser's mock path derives
// the uid from the bearer token. Each test gets its OWN token/uid so tests
// never share a rate-limit bucket with each other.
let tokenCounter = 0;
function authHeaders() {
  tokenCounter += 1;
  return {
    Authorization: `Bearer mock-test-token-${tokenCounter}`,
    "Content-Type": "application/json"
  };
}

let serverProcess;

test.before(async () => {
  serverProcess = spawn(
    process.execPath,
    [path.join(__dirname, "..", "server.js")],
    {
      env: {
        ...process.env,
        PORT: String(PORT),
        MOCK_EXTERNAL_SERVICES: "true",
        OPENAI_API_KEY: "test-key-not-used-in-mock-mode"
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let stderrOutput = "";
  serverProcess.stderr.on("data", (chunk) => {
    stderrOutput += chunk.toString();
  });

  // Poll /health instead of a fixed sleep — deterministic and fast on a
  // warm machine, still correct on a slow one.
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Server did not become healthy in time. Last error: ${lastError}. Stderr: ${stderrOutput}`);
});

test.after(() => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});

function buildWorkoutPayload(overrides = {}) {
  return {
    goal: "Build muscle",
    experience: "intermediate",
    age: 28,
    daysPerWeek: 3,
    sessionDuration: 60,
    trainingStyle: "gym",
    equipment: ["bodyweight"],
    availableDays: ["monday", "wednesday", "friday"],
    priority: "Hypertrophy",
    limitations: "None",
    language: "en",
    ...overrides
  };
}

test("POST /api/workout-builder: age reaches the endpoint (accepted, no 400)", async () => {
  const res = await fetch(`${BASE_URL}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload({ age: 34 }))
  });
  const data = await res.json();

  // age is not itself echoed back in the response, but a request that
  // includes it must not be rejected as malformed — proves the field
  // reaches request handling rather than being dropped/validated away.
  assert.notEqual(res.status, 400, `age must not cause a 400. Body: ${JSON.stringify(data)}`);
});

test("POST /api/workout-builder: availableDays reaches the endpoint and Mon/Wed/Fri -> [1,3,5]", async () => {
  const res = await fetch(`${BASE_URL}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload({
      daysPerWeek: 3,
      availableDays: ["monday", "wednesday", "friday"]
    }))
  });
  const data = await res.json();

  assert.equal(res.status, 200, `Expected 200. Body: ${JSON.stringify(data)}`);
  assert.equal(data.success, true);
  assert.deepEqual(
    [...data.program.weeklyScheduleDays].sort((a, b) => a - b),
    [1, 3, 5],
    "Monday/Wednesday/Friday must normalize to day indexes [1, 3, 5]"
  );
});

test("POST /api/workout-builder: fewer available days than daysPerWeek returns 400", async () => {
  const res = await fetch(`${BASE_URL}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload({
      daysPerWeek: 4,
      availableDays: ["monday", "wednesday"] // only 2 days for 4 requested
    }))
  });
  const data = await res.json();

  assert.equal(res.status, 400, `Expected 400. Body: ${JSON.stringify(data)}`);
  assert.ok(data.error, "Should include an error message");
});

test("POST /api/workout-builder: an oversized program is repaired (accessory exercises trimmed) instead of rejected", async () => {
  // sessionDuration of 20 (the minimum accepted) combined with the mock
  // generator's 5 fixed exercises overruns the session-cap rule. Before
  // the repair-before-validate fix this was a deterministic 422; now
  // lib/workout-repair.js trims lowest-priority accessory exercises from
  // the end of the session until it fits (down to a floor of 3), so this
  // now succeeds. See test/workout-builder-422-repair.test.js and
  // test/workout-repair.test.js for the still-invalid-after-repair paths
  // (equipment/duplicate-exerciseId cases repair does not touch).
  const res = await fetch(`${BASE_URL}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload({
      daysPerWeek: 1,
      sessionDuration: 20,
      availableDays: ["monday"]
    }))
  });
  const data = await res.json();

  assert.equal(res.status, 200, `Expected 200 after repair. Body: ${JSON.stringify(data)}`);
  assert.equal(data.success, true);
  assert.ok(data.program.sessions[0].exercises.length <= 5, "Repair may have trimmed accessory exercises");
  assert.ok(data.program.sessions[0].exercises.length >= 3, "Repair must never trim below the minimum floor");
  assert.ok(data.sessionDurations[0].estimatedMinutes <= 25, "Repaired session must fit the duration budget (20min + 5min tolerance)");
});

test("POST /api/workout-builder: invalid programs are never returned with success:true", async () => {
  const res = await fetch(`${BASE_URL}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload({
      daysPerWeek: 1,
      sessionDuration: 20,
      availableDays: ["monday"]
    }))
  });
  const data = await res.json();

  // Whenever the response is a 422 (the only way validation failure is
  // reported), success must be false — never success:true alongside an
  // invalid program.
  if (res.status === 422) {
    assert.equal(data.success, false);
    assert.equal(data.program, undefined, "A failed-validation response must not also include a program");
  } else {
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
  }
});

test("POST /api/workout-builder/reroll-exercise: bodyweight-only reroll repairs a barbell replacement instead of returning it", async () => {
  // The mock AI reroll branch (see createChatCompletion in server.js)
  // deliberately echoes the CURRENT exercise's equipment rather than
  // honoring the "Selected equipment" constraint — simulating an AI
  // response that ignores instructions. Since the equipment hotfix
  // (lib/workout-repair.js's repairUnmatchedEquipmentViaCatalog), the
  // reroll endpoint's shared repair pass now deterministically substitutes
  // a same-muscle, permitted-equipment catalog exercise instead of
  // surfacing a 422 — equipment constraints are still fully honored, the
  // disallowed exercise is just repaired rather than rejected.
  const program = {
    daysPerWeek: 1,
    sessionDuration: 60,
    sessions: [
      {
        name: "Day 1",
        exercises: [
          {
            exerciseId: "barbell-bench-press",
            name: "Barbell Bench Press",
            equipment: "barbell",
            sets: 3,
            reps: "8-12",
            restSeconds: 90,
            rir: "2"
          }
        ]
      }
    ]
  };

  const res = await fetch(`${BASE_URL}/api/workout-builder/reroll-exercise`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      sessionIndex: 0,
      exerciseIndex: 0,
      program,
      equipment: ["bodyweight"],
      goal: "Build muscle"
    })
  });
  const data = await res.json();

  assert.equal(res.status, 200, `Expected the mismatch to be repaired, not rejected. Body: ${JSON.stringify(data)}`);
  assert.equal(data.success, true);
  assert.notEqual(
    data.exercise?.equipment?.toLowerCase(),
    "barbell",
    "Must never return the disallowed barbell exercise, repaired or not"
  );
  assert.equal(
    normalizeEquipment(data.exercise?.equipment),
    "bodyweight",
    "Repaired replacement must use the user's actual selected equipment"
  );
});

test("POST /api/workout-builder/reroll-exercise: a valid reroll returns 200", async () => {
  // Generate a real program first via the mocked generator (its exercises
  // are all bodyweight), then reroll one exercise with matching equipment
  // constraints — this exercises the full reroll path end-to-end.
  const genRes = await fetch(`${BASE_URL}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildWorkoutPayload({ daysPerWeek: 1, sessionDuration: 60, availableDays: ["monday"] }))
  });
  const genData = await genRes.json();
  assert.equal(genRes.status, 200, `Setup generation failed: ${JSON.stringify(genData)}`);

  const res = await fetch(`${BASE_URL}/api/workout-builder/reroll-exercise`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      sessionIndex: 0,
      exerciseIndex: 0,
      program: genData.program,
      equipment: ["bodyweight"],
      goal: "Build muscle"
    })
  });
  const data = await res.json();

  assert.equal(res.status, 200, `Expected 200. Body: ${JSON.stringify(data)}`);
  assert.equal(data.success, true);
  assert.ok(data.exercise, "Should return the replacement exercise");
  assert.ok(data.weeklyVolume, "Should return recalculated weeklyVolume");
  assert.ok(Array.isArray(data.sessionDurations), "Should return recalculated sessionDurations");
  assert.ok(data.validationSummary, "Should return a validationSummary");
});

test("POST /api/workout-builder: missing auth header returns 401", async () => {
  const res = await fetch(`${BASE_URL}/api/workout-builder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildWorkoutPayload())
  });

  assert.equal(res.status, 401);
});
