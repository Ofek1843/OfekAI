// HTTP-level reproduction of the reported production bug, over a real
// spawned server (MOCK_OPENAI_CHAT_RESPONSE_MODE=calisthenics-bad-equipment
// injects a fixture matching what a real model returned in production: a
// Pull-up exercise with no Pull-up Bar selected, and a Hebrew equipment
// label on an otherwise-permitted Machine exercise, requested in English).
// See test/workout-equipment-language-hotfix.test.js for the equivalent
// unit-level coverage of the repair/validate logic itself.

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { stopChildProcess } = require("./child-process-cleanup");

// Keep this integration server distinct from workout-tracker-exercise-images
// (4174) and pwa-installability (4175): node --test runs files concurrently.
const PORT = 4176;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let tokenCounter = 0;
function authHeaders() {
  tokenCounter += 1;
  return {
    Authorization: `Bearer mock-test-token-calisthenics-${tokenCounter}`,
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
        MOCK_OPENAI_CHAT_RESPONSE_MODE: "calisthenics-bad-equipment",
        OPENAI_API_KEY: "test-key-not-used-in-mock-mode"
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let stderrOutput = "";
  serverProcess.stderr.on("data", (chunk) => {
    stderrOutput += chunk.toString();
  });

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
  stopChildProcess(serverProcess);
});

function buildRepro(overrides = {}) {
  return {
    goal: "Improve calisthenics skills",
    experience: "beginner",
    daysPerWeek: 1,
    sessionDuration: 60,
    trainingStyle: "calisthenics",
    equipment: ["barbell", "machine"], // exact reported selection — no bodyweight, no pull-up bar
    availableDays: ["monday"],
    priority: "Skills",
    limitations: "None",
    language: "en",
    ...overrides
  };
}

test("POST /api/workout-builder: exact production repro (Calisthenics, Barbell+Machines) returns 200 with a fully valid program", async () => {
  const res = await fetch(`${BASE_URL}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildRepro())
  });
  const data = await res.json();

  assert.equal(res.status, 200, `Expected 200. Body: ${JSON.stringify(data)}`);
  assert.equal(data.success, true);
  assert.equal(data.validationSummary.passed, true, `Expected passed:true. Body: ${JSON.stringify(data)}`);
  assert.equal(data.validationSummary.errors.length, 0);

  const allExercises = data.program.sessions.flatMap((s) => s.exercises);
  assert.ok(allExercises.length > 0);
  for (const exercise of allExercises) {
    assert.ok(exercise.exerciseId, `Exercise "${exercise.name}" is missing exerciseId`);
    // No Hebrew character in any user-facing field.
    const hebrewRange = /[֐-׿]/;
    assert.equal(hebrewRange.test(exercise.name), false, `Exercise name "${exercise.name}" contains Hebrew`);
    assert.equal(hebrewRange.test(exercise.equipment), false, `Exercise equipment "${exercise.equipment}" contains Hebrew`);
    assert.equal(hebrewRange.test(exercise.muscleGroup || ""), false, `Exercise muscleGroup contains Hebrew`);
  }
});

test("POST /api/workout-builder: repeatable — 3 consecutive calls all pass validation with no invalid equipment", async () => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await fetch(`${BASE_URL}/api/workout-builder`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(buildRepro())
    });
    const data = await res.json();
    assert.equal(res.status, 200, `Attempt ${attempt}: expected 200. Body: ${JSON.stringify(data)}`);
    assert.equal(data.validationSummary.passed, true, `Attempt ${attempt}: expected passed:true`);
  }
});

test("POST /api/workout-builder: same repro in Hebrew keeps Hebrew equipment labels valid (language not forced to English)", async () => {
  const res = await fetch(`${BASE_URL}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildRepro({ language: "he" }))
  });
  const data = await res.json();

  assert.equal(res.status, 200, `Expected 200. Body: ${JSON.stringify(data)}`);
  assert.equal(data.validationSummary.passed, true, `Expected passed:true. Body: ${JSON.stringify(data)}`);
});
