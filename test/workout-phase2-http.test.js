// HTTP-level regression test proving the wizard compatibility preflight
// (lib/workout-preferences-validator.js) is actually wired into
// POST /api/workout-builder — spawns the real server and drives it over
// real HTTP, so this fails if the unit-tested validateWorkoutPreferences()
// were ever called but its result ignored, or not called at all.

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
      reject(new Error(`Server did not become healthy. Last error: ${lastError}. Stderr: ${stderr}`));
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

const HEBREW_RANGE = /[֐-׿]/;

test("CASE 3 (HTTP): calisthenics skills + unsuitable equipment is blocked with 400 before generation, English", async (t) => {
  const server = await startServer(4300);
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      goal: "improveSkills",
      experience: "intermediate",
      daysPerWeek: 4,
      sessionDuration: 45,
      trainingStyle: "calisthenics",
      equipment: ["dumbbell", "barbell", "machine"],
      availableDays: ["monday", "tuesday", "wednesday", "thursday"],
      priority: "Skills",
      language: "en"
    })
  });
  const data = await res.json();

  assert.equal(res.status, 400, `Expected 400. Body: ${JSON.stringify(data)}`);
  assert.equal(data.success, false);
  assert.equal(data.errorCode, "INCOMPATIBLE_EQUIPMENT_FOR_STYLE");
  assert.ok(Array.isArray(data.fieldErrors?.equipment) && data.fieldErrors.equipment.length > 0);
  assert.ok(Array.isArray(data.suggestedChanges) && data.suggestedChanges.length > 0);
  assert.equal(data.program, undefined, "A blocked request must never include a generated program");
  assert.ok(!HEBREW_RANGE.test(data.message), "English message must not contain Hebrew");
});

test("CASE 3 (HTTP): same block in Hebrew locale", async (t) => {
  const server = await startServer(4301);
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      goal: "improveSkills",
      experience: "intermediate",
      daysPerWeek: 4,
      sessionDuration: 45,
      trainingStyle: "calisthenics",
      equipment: ["dumbbell", "barbell", "machine"],
      availableDays: ["monday", "tuesday", "wednesday", "thursday"],
      priority: "Skills",
      language: "he"
    })
  });
  const data = await res.json();

  assert.equal(res.status, 400);
  assert.ok(HEBREW_RANGE.test(data.message), `Hebrew message must contain Hebrew: "${data.message}"`);
});

test("CASE 3 (HTTP): Floor Skills Only lets the same request proceed to generation", async (t) => {
  const server = await startServer(4302);
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      goal: "improveSkills",
      experience: "intermediate",
      daysPerWeek: 4,
      sessionDuration: 45,
      trainingStyle: "calisthenics",
      equipment: ["dumbbell", "barbell", "machine"],
      availableDays: ["monday", "tuesday", "wednesday", "thursday"],
      priority: "Skills",
      language: "en",
      floorSkillsOnly: true
    })
  });
  const data = await res.json();

  assert.notEqual(res.status, 400, `Floor Skills Only must not be blocked. Body: ${JSON.stringify(data)}`);
});

test("A compatible request (gym style, standard equipment) is never blocked by the preflight", async (t) => {
  const server = await startServer(4303);
  t.after(() => stopServer(server));

  const res = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      goal: "buildMuscle",
      experience: "beginner",
      daysPerWeek: 2,
      sessionDuration: 45,
      trainingStyle: "gym",
      equipment: ["bodyweight", "rings", "dumbbell", "machine"],
      availableDays: ["monday", "thursday"],
      priority: "Hypertrophy",
      language: "en"
    })
  });
  const data = await res.json();

  assert.equal(res.status, 200, `Body: ${JSON.stringify(data)}`);
  assert.equal(data.success, true);
});
