const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} = require("@firebase/rules-unit-testing");
const {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} = require("firebase/firestore");

const ROOT = path.join(__dirname, "..");
const RULES = fs.readFileSync(path.join(ROOT, "docs", "social", "firestore-rules-merged-candidate.txt"), "utf8");

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-fuelphysique",
    firestore: { rules: RULES }
  });
});

test.after(async () => {
  await testEnv?.cleanup();
});

function alice() {
  return testEnv.authenticatedContext("alice", { email: "alice@example.test" }).firestore();
}

function bob() {
  return testEnv.authenticatedContext("bob", { email: "bob@example.test" }).firestore();
}

function carol() {
  return testEnv.authenticatedContext("carol", { email: "carol@example.test" }).firestore();
}

function admin() {
  return testEnv.authenticatedContext("admin", { email: "ofek1845@gmail.com" }).firestore();
}

function unauthenticated() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, "users/alice"), { displayName: "Alice", activeWorkoutPlanId: "plan-a" });
    batch.set(doc(db, "users/alice/athleteCore/main"), { equipment: ["bodyweight"] });
    batch.set(doc(db, "users/alice/settings/main"), { language: "en" });
    batch.set(doc(db, "users/alice/workoutPlans/plan-a"), { name: "Alice plan", createdAt: 1 });
    batch.set(doc(db, "users/alice/nutritionPlans/nutrition-a"), { name: "Alice nutrition", createdAt: 1 });
    batch.set(doc(db, "users/alice/workoutLogs/log-a"), { completedAt: 1 });
    batch.set(doc(db, "users/alice/weightEntries/weight-a"), { date: "2026-01-01", weight: 70 });
    batch.set(doc(db, "users/alice/bodyMeasurements/measurement-a"), { date: "2026-01-01", waist: 80 });
    batch.set(doc(db, "users/alice/progressPhotos/photo-a"), { date: "2026-01-01", photos: {} });
    batch.set(doc(db, "users/alice/runs/run-a"), { createdAt: 1, distanceKm: 1 });
    batch.set(doc(db, "users/alice/conversations/coach-a"), { title: "Private coach" });
    batch.set(doc(db, "users/alice/conversations/coach-a/messages/message-a"), { text: "private" });
    batch.set(doc(db, "users/alice/leaderboardSubmissions/submission-a"), { status: "pending" });
    batch.set(doc(db, "users/alice/transformationSubmissions/transformation-a"), { status: "pending" });
    batch.set(doc(db, "users/alice/waitlists/pro"), { status: "interested" });

    batch.set(doc(db, "leaderboardEntries/entry-a"), { status: "approved", displayName: "Alice" });
    batch.set(doc(db, "shares/legacy-share"), { userId: "alice", planId: "plan-a" });

    batch.set(doc(db, "socialProfiles/alice"), { uid: "alice", username: "alice", discoverable: true });
    batch.set(doc(db, "socialProfiles/bob"), { uid: "bob", username: "bob", discoverable: true });
    batch.set(doc(db, "socialProfiles/carol"), { uid: "carol", username: "carol", discoverable: false });
    batch.set(doc(db, "usernames/alice"), { uid: "alice", usernameLower: "alice" });
    batch.set(doc(db, "friendRequests/alice_bob"), { fromUid: "alice", toUid: "bob", status: "pending" });
    batch.set(doc(db, "friendships/alice_bob"), { participants: ["alice", "bob"], status: "accepted" });
    batch.delete(doc(db, "users/alice/blocks/bob"));
    batch.set(doc(db, "users/alice/conversationSummaries/alice_bob"), { conversationId: "alice_bob", updatedAt: 1 });
    batch.set(doc(db, "users/alice/sharedImports/artifact-active"), { artifactId: "artifact-active", copyId: "copy-a" });
    batch.set(doc(db, "conversations/alice_bob"), {
      participants: ["alice", "bob"],
      participantKey: "alice_bob",
      status: "active"
    });
    batch.set(doc(db, "conversations/alice_bob/messages/message-a"), {
      type: "text",
      text: "hello",
      senderUid: "alice",
      schemaVersion: 1,
      createdAt: 1
    });
    batch.set(doc(db, "sharedArtifacts/artifact-active"), {
      ownerUid: "alice",
      recipientIds: ["bob"],
      conversationId: "alice_bob",
      type: "workout",
      schemaVersion: 1,
      snapshot: { title: "Shared plan" },
      revokedAt: null
    });
    batch.set(doc(db, "sharedArtifacts/artifact-revoked"), {
      ownerUid: "alice",
      recipientIds: ["bob"],
      conversationId: "alice_bob",
      type: "workout",
      schemaVersion: 1,
      snapshot: { title: "Revoked plan" },
      revokedAt: 1
    });
    await batch.commit();
  });
}

test("legacy owner access is preserved and cross-user access is denied", async () => {
  await seed();
  const owner = alice();
  const other = bob();
  const legacyPaths = [
    "athleteCore/main", "settings/main", "workoutPlans/plan-a", "nutritionPlans/nutrition-a",
    "workoutLogs/log-a", "weightEntries/weight-a", "bodyMeasurements/measurement-a",
    "progressPhotos/photo-a", "runs/run-a", "conversations/coach-a",
    "conversations/coach-a/messages/message-a", "leaderboardSubmissions/submission-a",
    "transformationSubmissions/transformation-a", "waitlists/pro"
  ];
  for (const relativePath of legacyPaths) {
    assertSucceeds(getDoc(doc(owner, `users/alice/${relativePath}`)), relativePath);
    assertFails(getDoc(doc(other, `users/alice/${relativePath}`)), relativePath);
  }
  await assertSucceeds(setDoc(doc(owner, "users/alice/workoutPlans/new-plan"), { name: "new" }));
  await assertFails(setDoc(doc(other, "users/alice/workoutPlans/forged"), { name: "forged" }));
  await assertSucceeds(updateDoc(doc(owner, "users/alice"), { displayName: "Alice updated" }));
  await assertFails(getDoc(doc(other, "users/alice")));
});

test("leaderboard and legacy share behavior matches the baseline", async () => {
  await assertSucceeds(getDoc(doc(alice(), "leaderboardEntries/entry-a")));
  await assertFails(getDoc(doc(unauthenticated(), "leaderboardEntries/entry-a")));
  await assertSucceeds(setDoc(doc(admin(), "leaderboardEntries/entry-admin"), { status: "approved" }));
  await assertFails(setDoc(doc(alice(), "leaderboardEntries/entry-forged"), { status: "approved" }));
  await assertSucceeds(getDoc(doc(admin(), "users/alice/leaderboardSubmissions/submission-a")));
  await assertSucceeds(updateDoc(doc(admin(), "users/alice/leaderboardSubmissions/submission-a"), { status: "approved" }));
  await assertFails(getDoc(doc(unauthenticated(), "shares/legacy-share")));
});

test("social reads are authenticated and participant/owner scoped", async () => {
  const a = alice();
  const b = bob();
  const c = carol();
  await assertFails(getDoc(doc(unauthenticated(), "usernames/alice")));
  await assertFails(getDoc(doc(a, "usernames/alice")));
  await assertFails(setDoc(doc(a, "usernames/alice"), { uid: "bob" }));
  await assertSucceeds(getDoc(doc(a, "socialProfiles/alice")));
  await assertSucceeds(getDoc(doc(b, "socialProfiles/alice")));
  await assertFails(getDoc(doc(b, "socialProfiles/carol")));
  await assertSucceeds(getDoc(doc(a, "friendRequests/alice_bob")));
  await assertSucceeds(getDoc(doc(b, "friendRequests/alice_bob")));
  await assertFails(getDoc(doc(c, "friendRequests/alice_bob")));
  await assertSucceeds(getDoc(doc(a, "friendships/alice_bob")));
  await assertSucceeds(getDoc(doc(b, "friendships/alice_bob")));
  await assertFails(getDoc(doc(c, "friendships/alice_bob")));
  await assertSucceeds(getDocs(query(collection(a, "friendships"), where("participants", "array-contains", "alice"))));
  await assertSucceeds(getDocs(query(collection(a, "users/alice/conversationSummaries"), orderBy("updatedAt", "desc"), limit(50))));
  await assertSucceeds(getDoc(doc(a, "users/alice/sharedImports/artifact-active")));
  await assertFails(getDoc(doc(b, "users/alice/sharedImports/artifact-active")));
  await assertSucceeds(getDoc(doc(b, "sharedArtifacts/artifact-active")));
  await assertSucceeds(getDoc(doc(a, "sharedArtifacts/artifact-active")));
  await assertFails(getDoc(doc(c, "sharedArtifacts/artifact-active")));
  await assertFails(getDoc(doc(b, "sharedArtifacts/artifact-revoked")));
});

test("social conversation reads require accepted friendship and reciprocal block state", async () => {
  const a = alice();
  const b = bob();
  const c = carol();
  await assertFails(getDoc(doc(unauthenticated(), "conversations/alice_bob")));
  await assertSucceeds(getDoc(doc(a, "conversations/alice_bob")));
  await assertSucceeds(getDoc(doc(b, "conversations/alice_bob")));
  await assertFails(getDoc(doc(c, "conversations/alice_bob")));
  await assertSucceeds(getDocs(query(collection(a, "conversations/alice_bob/messages"), orderBy("createdAt", "desc"), limit(25))));
  await assertFails(getDocs(query(collection(c, "conversations/alice_bob/messages"), orderBy("createdAt", "desc"), limit(25))));
  await assertFails(setDoc(doc(a, "conversations/alice_bob/messages/forged"), {
    type: "text", text: "forged", senderUid: "bob", schemaVersion: 1, createdAt: 1
  }));
  await assertFails(updateDoc(doc(a, "conversations/alice_bob"), { participants: ["alice", "carol"] }));
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users/alice/blocks/bob"), { blockedUid: "bob" });
  });
  await assertFails(getDoc(doc(a, "conversations/alice_bob")));
  await assertFails(getDoc(doc(b, "conversations/alice_bob")));
  await assertFails(setDoc(doc(a, "users/alice/blocks/carol"), { blockedUid: "carol" }));

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(doc(context.firestore(), "friendships/alice_bob"));
  });
  await assertFails(getDoc(doc(a, "conversations/alice_bob")));
  await assertFails(getDoc(doc(b, "conversations/alice_bob")));
});

test("social server-owned artifact/import mutations stay denied", async () => {
  const a = alice();
  const b = bob();
  const oversized = "x".repeat(3000);
  await assertFails(setDoc(doc(a, "sharedArtifacts/forged"), {
    ownerUid: "bob", recipientIds: ["alice"], snapshot: { text: oversized }, revokedAt: null
  }));
  await assertFails(updateDoc(doc(a, "sharedArtifacts/artifact-active"), {
    ownerUid: "bob", recipientIds: ["carol"], snapshot: { text: oversized }
  }));
  await assertFails(setDoc(doc(b, "users/bob/sharedImports/artifact-active"), { copyId: "forged" }));
  await assertFails(setDoc(doc(a, "users/alice/blocks/bob"), { blockedUid: "alice" }));
});
