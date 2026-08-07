"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { stopChildProcess } = require("./child-process-cleanup");
const { primaryMuscleForExerciseId } = require("../lib/workout-focus");

const FIXTURE = {
  programName: "Compound First Diagnostic",
  daysPerWeek: 2,
  durationWeeks: 8,
  goal: "Build muscle",
  sessions: [1, 2].map((day) => ({
    day,
    name: `Upper ${day}`,
    exercises: [
      {
        exerciseId: "barbell-bench-press", name: "Barbell Bench Press", demoName: "Barbell Bench Press",
        muscleGroup: "Chest", equipment: "Barbell", sets: 3, reps: "8-12", restSeconds: 90, rir: "1-3", notes: ""
      },
      {
        exerciseId: "cable-tricep-pushdown", name: "Cable Tricep Pushdown", demoName: "Cable Tricep Pushdown",
        muscleGroup: "Triceps", equipment: "Cable", sets: 6, reps: "10-15", restSeconds: 60, rir: "1-3", notes: ""
      }
    ]
  }))
};

function startServer(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
      env: {
        ...process.env,
        PORT: String(port),
        MOCK_EXTERNAL_SERVICES: "true",
        OPENAI_API_KEY: "test-key-not-used-in-mock-mode",
        MOCK_OPENAI_WORKOUT_RESPONSE_JSON: JSON.stringify(FIXTURE)
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    const baseUrl = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 15_000;
    (async () => {
      while (Date.now() < deadline) {
        try {
          const response = await fetch(`${baseUrl}/health`);
          if (response.ok) return resolve({ child, baseUrl });
        } catch {
          // Keep polling until the bounded startup deadline.
        }
        await new Promise((done) => setTimeout(done, 100));
      }
      reject(new Error(`Workout engine fixture server failed to start: ${stderr}`));
    })();
  });
}

function payload(overrides = {}) {
  return {
    goal: "Build muscle",
    experience: "beginner",
    daysPerWeek: 2,
    sessionDuration: 120,
    equipment: ["barbell", "cable"],
    trainingStyle: "gym",
    availableDays: ["monday", "thursday"],
    priority: "hypertrophy",
    limitations: "None",
    language: "en",
    muscleFocusMode: "selected_only",
    selectedMuscles: ["chest", "triceps"],
    ...overrides
  };
}

function headers(id) {
  return { Authorization: `Bearer mock-workout-v2-${id}`, "Content-Type": "application/json" };
}

test("production-path fixture uses authoritative repair and validates the muscle-focus contract", async (t) => {
  const server = await startServer(4280);
  t.after(() => stopChildProcess(server.child));

  const response = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: headers("valid"),
    body: JSON.stringify(payload())
  });
  const body = await response.json();

  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.success, true);
  assert.equal(body.program.muscleFocusMode, "selected_only");
  assert.deepEqual(body.program.selectedMuscles, ["chest", "triceps"]);
  assert.equal(body.validationSummary.passed, true);
  assert.equal(body.validationSummary.volumePassed, true);
  assert.ok(body.weeklyVolume.perMuscle.chest.total >= body.weeklyVolume.perMuscle.chest.preferredMin);
  assert.ok(body.weeklyVolume.perMuscle.chest.total <= body.weeklyVolume.perMuscle.chest.preferredMax);
  assert.ok(body.weeklyVolume.perMuscle.triceps.total >= body.weeklyVolume.perMuscle.triceps.preferredMin);
  assert.ok(body.weeklyVolume.perMuscle.triceps.total <= body.weeklyVolume.perMuscle.triceps.preferredMax);
  assert.equal(body.weeklyVolume.qualityBreakdown, undefined, "private diagnostic decomposition must not change the public API");
  assert.ok(body.program.sessions.flatMap((session) => session.exercises).some((item) => item.exerciseId === "barbell-bench-press"));

  const rerollResponse = await fetch(`${server.baseUrl}/api/workout-builder/reroll-exercise`, {
    method: "POST",
    headers: headers("reroll"),
    body: JSON.stringify({
      sessionIndex: 0,
      exerciseIndex: 0,
      program: body.program,
      equipment: ["barbell", "cable"],
      trainingStyle: "gym",
      goal: "Build muscle",
      experience: "beginner",
      priority: "hypertrophy",
      language: "en",
      muscleFocusMode: "selected_only",
      selectedMuscles: ["chest", "triceps"]
    })
  });
  const rerollBody = await rerollResponse.json();
  assert.equal(rerollResponse.status, 200, JSON.stringify(rerollBody));
  assert.ok(["chest", "triceps"].includes(primaryMuscleForExerciseId(rerollBody.exercise.exerciseId)));

  const invalidResponse = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: headers("invalid"),
    body: JSON.stringify(payload({ selectedMuscles: ["invented-muscle"] }))
  });
  const invalidBody = await invalidResponse.json();
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidBody.error, "Invalid muscle focus preferences");
});
