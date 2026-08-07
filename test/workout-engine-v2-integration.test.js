"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { stopChildProcess } = require("./child-process-cleanup");
const { primaryMuscleForExerciseId } = require("../lib/workout-focus");
const { getCatalogExercise } = require("../lib/workout-exercise-catalog");

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

function fixtureExercise(exerciseId, sets) {
  const catalog = getCatalogExercise(exerciseId);
  assert.ok(catalog, `missing fixture exercise: ${exerciseId}`);
  const name = exerciseId.split("-").map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
  return {
    exerciseId,
    name,
    demoName: name,
    muscleGroup: primaryMuscleForExerciseId(exerciseId),
    equipment: catalog.equipment,
    sets,
    reps: "6-15",
    restSeconds: 90,
    rir: "1-3",
    notes: ""
  };
}

const RELEASE_TEMPLATE = [
  ["barbell-bench-press", 3],
  ["barbell-row", 3],
  ["barbell-squat", 3],
  ["romanian-deadlift", 2],
  ["barbell-shoulder-press", 2],
  ["standing-calf-raise-machine", 2],
  ["plank", 2],
  ["cable-tricep-pushdown", 2]
];

const INTEGRATED_RELEASE_FIXTURE = {
  programName: "Integrated Workout V2 Release Fixture",
  daysPerWeek: 4,
  durationWeeks: 8,
  goal: "Build muscle",
  sessions: [1, 2, 3, 4].map((day) => ({
    day,
    name: `Day ${day}`,
    exercises: RELEASE_TEMPLATE.map(([exerciseId, sets]) => fixtureExercise(exerciseId, sets))
  }))
};

function startServer(port, fixture = FIXTURE) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
      env: {
        ...process.env,
        PORT: String(port),
        MOCK_EXTERNAL_SERVICES: "true",
        OPENAI_API_KEY: "test-key-not-used-in-mock-mode",
        MOCK_OPENAI_WORKOUT_RESPONSE_JSON: JSON.stringify(fixture)
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

function integratedFrontendPayload(overrides = {}) {
  return {
    goal: "Build muscle",
    priority: "hypertrophy",
    experience: "intermediate",
    age: 32,
    daysPerWeek: 4,
    sessionDuration: 150,
    trainingStyle: "gym",
    equipment: ["barbell", "cable", "machines", "bodyweight", "dumbbells"],
    availableDays: ["monday", "tuesday", "thursday", "saturday"],
    limitations: "None",
    language: "en",
    muscleFocusMode: "balanced",
    selectedMuscles: [],
    ...overrides
  };
}

async function postWorkout(server, id, requestPayload) {
  const response = await fetch(`${server.baseUrl}/api/workout-builder`, {
    method: "POST",
    headers: headers(id),
    body: JSON.stringify(requestPayload)
  });
  const body = await response.json();
  return { response, body };
}

function assertRequiredHardRanges(body, label) {
  for (const [muscle, entry] of Object.entries(body.weeklyVolume.perMuscle)) {
    if (entry.classification !== "required") continue;
    assert.ok(entry.total >= entry.minimumEffective, `${label}/${muscle} below hard minimum`);
    assert.ok(entry.total <= entry.hardMaximum, `${label}/${muscle} above hard maximum`);
  }
}

function primaryMuscles(program) {
  return program.sessions
    .flatMap((session) => session.exercises)
    .map((exercise) => primaryMuscleForExerciseId(exercise.exerciseId));
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

test("real frontend payload contract survives every integrated focus mode through the production route", async (t) => {
  const server = await startServer(4281, INTEGRATED_RELEASE_FIXTURE);
  t.after(() => stopChildProcess(server.child));

  const legacyPayload = integratedFrontendPayload();
  delete legacyPayload.muscleFocusMode;
  delete legacyPayload.selectedMuscles;
  const legacy = await postWorkout(server, "legacy", legacyPayload);
  assert.equal(legacy.response.status, 200, JSON.stringify(legacy.body));
  assert.equal(legacy.body.program.muscleFocusMode, "balanced");
  assert.deepEqual(legacy.body.program.selectedMuscles, []);
  assertRequiredHardRanges(legacy.body, "legacy");

  const balanced = await postWorkout(server, "balanced", integratedFrontendPayload());
  assert.equal(balanced.response.status, 200, JSON.stringify(balanced.body));
  assert.equal(balanced.body.program.muscleFocusMode, "balanced");
  assert.deepEqual(balanced.body.program.selectedMuscles, []);
  assert.ok(Number.isFinite(balanced.body.weeklyVolume.qualityScore), "quality score remains API-compatible");
  assertRequiredHardRanges(balanced.body, "balanced");

  const prioritize = await postWorkout(server, "prioritize-glutes-core", integratedFrontendPayload({
    muscleFocusMode: "prioritize",
    selectedMuscles: ["glutes", "core"]
  }));
  assert.equal(prioritize.response.status, 200, JSON.stringify(prioritize.body));
  assert.deepEqual(prioritize.body.program.selectedMuscles, ["glutes", "core"]);
  assertRequiredHardRanges(prioritize.body, "prioritize-glutes-core");
  for (const muscle of ["glutes", "core"]) {
    const entry = prioritize.body.weeklyVolume.perMuscle[muscle];
    assert.ok(entry.total >= entry.preferredMin, `${muscle} did not receive preferred-zone priority`);
    assert.ok(entry.total <= entry.preferredMax, `${muscle} exceeded its preferred zone`);
  }

  const selectedGlutesCore = await postWorkout(server, "selected-glutes-core", integratedFrontendPayload({
    muscleFocusMode: "selected_only",
    selectedMuscles: ["glutes", "core"]
  }));
  assert.equal(selectedGlutesCore.response.status, 200, JSON.stringify(selectedGlutesCore.body));
  const glutesCorePrimaries = primaryMuscles(selectedGlutesCore.body.program);
  assert.ok(glutesCorePrimaries.length > 0);
  assert.ok(glutesCorePrimaries.every((muscle) => ["glutes", "core"].includes(muscle)), JSON.stringify(glutesCorePrimaries));
  assert.ok(glutesCorePrimaries.includes("glutes"));
  assert.ok(glutesCorePrimaries.includes("core"));
  assert.ok(selectedGlutesCore.body.weeklyVolume.perMuscle.hamstrings.total > 0, "natural secondary involvement remains allowed");

  const selectedArms = await postWorkout(server, "selected-arms", integratedFrontendPayload({
    muscleFocusMode: "selected_only",
    selectedMuscles: ["biceps", "triceps"]
  }));
  assert.equal(selectedArms.response.status, 200, JSON.stringify(selectedArms.body));
  const armPrimaries = primaryMuscles(selectedArms.body.program);
  assert.ok(armPrimaries.length > 0);
  assert.ok(armPrimaries.every((muscle) => ["biceps", "triceps"].includes(muscle)), JSON.stringify(armPrimaries));
  assert.ok(armPrimaries.includes("biceps"));
  assert.ok(armPrimaries.includes("triceps"));

  const prioritizeChest = await postWorkout(server, "prioritize-chest", integratedFrontendPayload({
    muscleFocusMode: "prioritize",
    selectedMuscles: ["chest"]
  }));
  assert.equal(prioritizeChest.response.status, 200, JSON.stringify(prioritizeChest.body));
  assertRequiredHardRanges(prioritizeChest.body, "prioritize-chest");
  assert.ok(prioritizeChest.body.weeklyVolume.perMuscle.chest.total >= prioritizeChest.body.weeklyVolume.perMuscle.chest.preferredMin);
  assert.ok(prioritizeChest.body.weeklyVolume.perMuscle.triceps.total <= prioritizeChest.body.weeklyVolume.perMuscle.triceps.preferredMax);

  const prioritizeBack = await postWorkout(server, "prioritize-back", integratedFrontendPayload({
    muscleFocusMode: "prioritize",
    selectedMuscles: ["back"]
  }));
  assert.equal(prioritizeBack.response.status, 200, JSON.stringify(prioritizeBack.body));
  assertRequiredHardRanges(prioritizeBack.body, "prioritize-back");
  assert.ok(prioritizeBack.body.weeklyVolume.perMuscle.back.total >= prioritizeBack.body.weeklyVolume.perMuscle.back.minimumEffective);
  assert.ok(prioritizeBack.body.weeklyVolume.perMuscle.biceps.total <= prioritizeBack.body.weeklyVolume.perMuscle.biceps.preferredMax);

  for (const [id, focus] of [
    ["invalid-prioritize", { muscleFocusMode: "prioritize", selectedMuscles: [] }],
    ["invalid-selected", { muscleFocusMode: "selected_only", selectedMuscles: [] }],
    ["invalid-muscle", { muscleFocusMode: "prioritize", selectedMuscles: ["translated-or-unknown"] }]
  ]) {
    const invalid = await postWorkout(server, id, integratedFrontendPayload(focus));
    assert.equal(invalid.response.status, 400, `${id}: ${JSON.stringify(invalid.body)}`);
    assert.equal(invalid.body.error, "Invalid muscle focus preferences");
  }
});
