"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  SocialError,
  assertArtifactSize,
  buildNutritionCopy,
  buildWorkoutCopy,
  normalizeUsername,
  pairKey,
  sanitizeCompletedWorkoutSnapshot,
  sanitizeGraphSnapshot,
  sanitizeMessage,
  sanitizeNutritionSnapshot,
  sanitizeRecordSnapshot,
  sanitizeWorkoutSnapshot,
  stableMessageId,
  validateUsername
} = require("../lib/social-domain");

const ROOT = path.join(__dirname, "..");
const SERVER = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
const ROUTER = fs.readFileSync(path.join(ROOT, "lib", "social-router.js"), "utf8");
const STORE = fs.readFileSync(path.join(ROOT, "lib", "social-store.js"), "utf8");

test("username normalization is case-insensitive and stable", () => {
  assert.equal(normalizeUsername("  Fuel.Friend_7  "), "fuel.friend_7");
});

test("username validation enforces length, character and period rules", () => {
  for (const valid of ["abc", "Ofek_7", "fuel.friend", "A1_b.c"]) assert.equal(validateUsername(valid).ok, true, valid);
  for (const invalid of ["ab", "a".repeat(21), ".ofek", "ofek.", "ofek..ai", "ofek-ai", "ofek ai"]) {
    assert.equal(validateUsername(invalid).ok, false, invalid);
  }
});

test("canonical pair keys prevent opposite duplicate relationships", () => {
  assert.equal(pairKey("user-b", "user-a"), pairKey("user-a", "user-b"));
  assert.throws(() => pairKey("same", "same"), (error) => error instanceof SocialError && error.code === "invalid_pair");
});

test("message length and idempotency keys are bounded", () => {
  assert.equal(sanitizeMessage(" hello "), "hello");
  assert.throws(() => sanitizeMessage("x".repeat(2001)), /up to 2000/);
  assert.equal(stableMessageId("u1", "client_key_123"), stableMessageId("u1", "client_key_123"));
  assert.notEqual(stableMessageId("u1", "client_key_123"), stableMessageId("u2", "client_key_123"));
});

test("workout snapshots keep useful fields and remove private inputs", () => {
  const snapshot = sanitizeWorkoutSnapshot({
    name: "Strength Builder",
    injuries: "shoulder",
    privatePrompt: "secret",
    plan: {
      goal: "Strength",
      medicalLimitations: ["private"],
      sessions: [{ name: "Day 1", exercises: [{ name: "Bench Press", sets: 3, reps: "5", restSeconds: 180, privateNote: "pain" }] }]
    }
  }, "Ofek");
  assert.equal(snapshot.title, "Strength Builder");
  assert.equal(snapshot.sessions[0].exercises[0].exerciseId, "bench-press");
  assert.equal(snapshot.creatorUsername, "Ofek");
  assert.doesNotMatch(JSON.stringify(snapshot), /injur|medical|private|secret|prompt|note/i);
  assert.ok(assertArtifactSize("workout", snapshot) > 0);
});

test("workout copy creates a recipient-owned shape and recalculates volume", () => {
  const snapshot = sanitizeWorkoutSnapshot({ plan: { sessions: [{ name: "A", exercises: [{ name: "Barbell Bench Press", sets: 3, reps: "5" }] }] } }, "Creator");
  assert.equal(snapshot.sessions[0].exercises[0].exerciseId, "barbell-bench-press");
  assert.equal(snapshot.weeklyVolume.perMuscle.chest, 3);
  snapshot.weeklyVolume.totalHardSets = 999;
  const copy = buildWorkoutCopy(snapshot, "Copied from @Creator", "artifact-1");
  assert.equal(copy.sourceType, "shared-copy");
  assert.equal(copy.sourceArtifactId, "artifact-1");
  assert.equal(copy.attribution, "Copied from @Creator");
  assert.notEqual(copy.plan.weeklyVolume.totalHardSets, 999);
  assert.equal(copy.plan.weeklyVolume.perMuscle.chest.total, 3);
});

test("nutrition snapshots exclude private dietary and body data and recompute visible totals", () => {
  const snapshot = sanitizeNutritionSnapshot({
    name: "Day plan",
    allergies: ["nuts"],
    weight: 82,
    privatePrompt: "secret",
    plan: { meals: [{ name: "Breakfast", options: [{ foods: [
      { name: "Oats", amount: "50 g", calories: 190, proteinGrams: 6, carbsGrams: 32, fatGrams: 4 },
      { name: "Milk", amount: "200 ml", calories: 100, proteinGrams: 7, carbsGrams: 10, fatGrams: 3 }
    ] }] }] }
  }, "Creator");
  assert.deepEqual(snapshot.totals, { calories: 290, proteinGrams: 13, carbsGrams: 42, fatGrams: 7 });
  assert.doesNotMatch(JSON.stringify(snapshot), /allerg|weight|private|secret|prompt/i);
  const copy = buildNutritionCopy(snapshot, "Copied from @Creator", "artifact-2");
  assert.deepEqual(copy.plan.actualTotals, snapshot.totals);
  assert.equal(copy.sourceType, "shared-copy");
});

test("record and completed-workout snapshots omit notes and unfinished details", () => {
  const record = sanitizeRecordSnapshot({ exerciseName: "Pull-up", value: 25, repetitions: 3, note: "Short public note" }, "Creator");
  assert.equal(record.exerciseId, "pull-up");
  const completed = sanitizeCompletedWorkoutSnapshot({
    workoutPlanName: "Upper",
    notes: "private workout note",
    pain: "private",
    exercises: [{ name: "Pull-up", hiddenComment: "private", sets: [{ completed: true }, { completed: false }] }]
  }, "Creator");
  assert.equal(completed.exercises[0].completedSets, 1);
  assert.doesNotMatch(JSON.stringify(completed), /pain|private|hiddenComment|notes/);
});

test("graph privacy modes reveal only the selected level of detail", () => {
  const base = { graphType: "body_weight", points: [{ date: "2026-01-01", value: 90 }, { date: "2026-02-01", value: 85 }] };
  const exact = sanitizeGraphSnapshot({ ...base, privacyMode: "exact_values", unit: "kg" }, "Creator");
  const total = sanitizeGraphSnapshot({ ...base, privacyMode: "total_change", unit: "kg" }, "Creator");
  const percent = sanitizeGraphSnapshot({ ...base, privacyMode: "percentage_change", unit: "kg" }, "Creator");
  const trend = sanitizeGraphSnapshot({ ...base, privacyMode: "trend_only", unit: "kg" }, "Creator");
  assert.deepEqual(exact.points.map((point) => point.value), [90, 85]);
  assert.equal(total.summary.totalChange, -5);
  assert.equal("value" in total.points[0], false);
  assert.equal(percent.summary.totalChange, null);
  assert.ok(percent.summary.percentageChange < 0);
  assert.deepEqual(trend.trend.map((point) => point.value), [1, 0]);
  assert.equal(trend.unit, "");
});

test("server mounts authenticated, rate-limited social routes", () => {
  assert.match(SERVER, /app\.use\("\/api\/social", createSocialRouter/);
  assert.match(SERVER, /authenticate:\s*requireFirebaseUser/);
  assert.match(SERVER, /socialMessages/);
  assert.match(ROUTER, /req\.socialUser = user/);
  assert.match(ROUTER, /router\.post\("\/conversations\/:conversationId\/messages"/);
});

test("friend and chat mutations are guarded against self, duplicates, blocks and forged senders", () => {
  assert.match(STORE, /uid === targetUid[\s\S]*self_request/);
  assert.match(STORE, /opposite_request_exists[\s\S]*duplicate_request/);
  assert.match(STORE, /assertNotBlocked/);
  assert.match(STORE, /senderUid:\s*uid/);
  assert.doesNotMatch(ROUTER, /senderUid:\s*req\.body/);
  assert.match(STORE, /stableMessageId\(uid, input\.clientId\)/);
});

test("conversation pagination is bounded to the latest 25 messages", () => {
  assert.match(STORE, /orderBy\("createdAt", "desc"\)/);
  assert.match(STORE, /query\.startAfter\(Timestamp\.fromMillis\(cursorMs\)\)/);
  assert.match(STORE, /query\.limit\(25\)/);
});

test("artifact copy is recipient-only, immutable and duplicate-safe", () => {
  assert.match(STORE, /recipientIds[\s\S]*includes\(uid\)/);
  assert.match(STORE, /if \(previousImport\.exists\) return \{ duplicate: true/);
  assert.match(STORE, /transaction\.create\(copyRef/);
  assert.match(STORE, /artifact\.data\(\)\?\.ownerUid !== uid/);
});

test("stale conversations and revoked artifacts cannot be read through social paths", () => {
  assert.match(STORE, /assertAcceptedFriendsRead\(db, uid, otherUid\)/);
  assert.match(STORE, /assertAcceptedFriendsRead\(db, uid, conversation\.data\(\)\.participants\.find/);
  assert.match(STORE, /const visibleDocs = \[\];[\s\S]*visibleDocs\.push\(item\)/);
  assert.match(STORE, /artifact\.revokedAt\) \{[\s\S]*snapshot: null/);
  assert.match(STORE, /if \(result\.duplicate\) \{[\s\S]*artifactId: result\.message\?\.artifactId/);
});
