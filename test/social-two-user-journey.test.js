"use strict";

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
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  writeBatch
} = require("firebase/firestore");

const ROOT = path.join(__dirname, "..");
const RULES = fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8");
const HTML = fs.readFileSync(path.join(ROOT, "public", "social.html"), "utf8");
const SOCIAL = fs.readFileSync(path.join(ROOT, "public", "js", "social.js"), "utf8");
const ROUTER = fs.readFileSync(path.join(ROOT, "lib", "social-router.js"), "utf8");
const SERVER = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");

let testEnv;
const runId = `journey-${process.pid}-${Date.now()}`;
const userA = `${runId}-a`;
const userB = `${runId}-b`;
const outsider = `${runId}-outsider`;
const pair = `${userA}_${userB}`;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-fuelphysique",
    firestore: { rules: RULES }
  });
});

test.after(async () => {
  await testEnv?.clearFirestore();
  await testEnv?.cleanup();
});

function db(uid) {
  return testEnv.authenticatedContext(uid, {
    email: `${uid}@example.test`,
    email_verified: true
  }).firestore();
}

function profile(uid, username, displayName, bio) {
  return {
    uid,
    username,
    usernameLower: username.toLowerCase(),
    displayName,
    initials: displayName.slice(0, 1).toUpperCase(),
    bio,
    photoURL: "",
    publicRole: "athlete",
    badges: ["athlete"],
    discoverable: true,
    allowFriendRequests: true
  };
}

test("two verified synthetic users complete the social relationship, chat and sharing journey", async () => {
  const alice = db(userA);
  const bob = db(userB);
  const stranger = db(outsider);

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, `socialProfiles/${userA}`), profile(userA, "journey.alice", "Alice Journey", "Training with intention."));
    batch.set(doc(firestore, `socialProfiles/${userB}`), profile(userB, "journey.bob", "Bob Journey", "Building consistency."));
    batch.set(doc(firestore, `socialProfiles/${outsider}`), profile(outsider, "journey.outsider", "Outside Viewer", "Not part of the friendship."));
    batch.set(doc(firestore, `usernames/journey.alice`), { uid: userA, usernameLower: "journey.alice" });
    batch.set(doc(firestore, `usernames/journey.bob`), { uid: userB, usernameLower: "journey.bob" });
    batch.set(doc(firestore, `friendRequests/${pair}`), { fromUid: userA, toUid: userB, status: "pending" });
    await batch.commit();
  });

  assert.equal((await getDoc(doc(alice, `socialProfiles/${userA}`))).data().displayName, "Alice Journey");
  assert.equal((await getDoc(doc(bob, `socialProfiles/${userA}`))).data().bio, "Training with intention.");
  assert.equal((await getDoc(doc(bob, `friendRequests/${pair}`))).data().status, "pending");
  await assertFails(getDoc(doc(stranger, `friendRequests/${pair}`)));

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, `friendRequests/${pair}`), { status: "accepted" });
    batch.set(doc(firestore, `friendships/${pair}`), { participants: [userA, userB], status: "accepted" });
    batch.set(doc(firestore, `users/${userA}/conversationSummaries/${pair}`), { conversationId: pair, otherUid: userB, updatedAt: 2 });
    batch.set(doc(firestore, `users/${userB}/conversationSummaries/${pair}`), { conversationId: pair, otherUid: userA, updatedAt: 2 });
    batch.set(doc(firestore, `conversations/${pair}`), { participants: [userA, userB], participantKey: pair, status: "active" });
    batch.set(doc(firestore, `conversations/${pair}/messages/message-1`), { type: "text", text: "Hello from Alice", senderUid: userA, clientId: "client-1", schemaVersion: 1, createdAt: 1 });
    batch.set(doc(firestore, `conversations/${pair}/messages/message-2`), { type: "text", text: "Hello from Bob", senderUid: userB, clientId: "client-2", schemaVersion: 1, createdAt: 2 });
    batch.set(doc(firestore, "sharedArtifacts/workout-1"), { ownerUid: userA, recipientIds: [userB], conversationId: pair, type: "workout", schemaVersion: 1, snapshot: { title: "Shared strength plan", sessions: [{ name: "Upper", exercises: [{ name: "Bench Press", sets: 3 }] }] }, revokedAt: null });
    batch.set(doc(firestore, "sharedArtifacts/nutrition-1"), { ownerUid: userB, recipientIds: [userA], conversationId: pair, type: "nutrition", schemaVersion: 1, snapshot: { title: "Shared nutrition plan", totals: { calories: 2100, proteinGrams: 160 } }, revokedAt: null });
    batch.set(doc(firestore, `users/${userB}/sharedImports/workout-1`), { artifactId: "workout-1", copyId: "copy-1", sourceType: "shared-copy" });
    await batch.commit();
  });

  for (const context of [alice, bob]) {
    await assertSucceeds(getDoc(doc(context, `friendships/${pair}`)));
    await assertSucceeds(getDoc(doc(context, `conversations/${pair}`)));
    const messages = await getDocs(query(collection(context, `conversations/${pair}/messages`), orderBy("createdAt", "asc"), limit(25)));
    assert.deepEqual(messages.docs.map((item) => item.data().text), ["Hello from Alice", "Hello from Bob"]);
  }

  assert.deepEqual((await getDoc(doc(bob, "sharedArtifacts/workout-1"))).data().snapshot.title, "Shared strength plan");
  assert.deepEqual((await getDoc(doc(alice, "sharedArtifacts/nutrition-1"))).data().snapshot.totals, { calories: 2100, proteinGrams: 160 });
  assert.equal((await getDoc(doc(bob, `users/${userB}/sharedImports/workout-1`))).data().copyId, "copy-1");
  await assertFails(getDoc(doc(stranger, `conversations/${pair}`)));
  await assertFails(getDoc(doc(stranger, "sharedArtifacts/workout-1")));
});

test("social journey exposes the stable profile, request, chat, typing and sharing paths", () => {
  for (const id of ["identityForm", "userSearchForm", "receivedRequests", "sentRequests", "friendList", "conversationList", "messageForm", "previewDialog"]) {
    assert.match(HTML, new RegExp(`id="${id}"`), id);
  }
  for (const pathFragment of ["/identity", "/users/search", "/friend-requests", "/relationships", "/conversations", "/typing", "/messages", "/artifacts", "/copy"]) {
    assert.match(ROUTER, new RegExp(pathFragment.replaceAll("/", "\\/")));
  }
  assert.match(SERVER, /app\.use\("\/api\/social", createSocialRouter/);
  assert.match(SOCIAL, /onAuthStateChanged|guardProtectedPage/);
  assert.match(SOCIAL, /startTypingChannel/);
  assert.match(SOCIAL, /share-sources/);
  assert.match(SOCIAL, /copyArtifact/);
});

test("social localization and private sharing surfaces remain keyboard and RTL ready", async () => {
  const { SOCIAL_STRINGS } = await import("../public/js/social-core.mjs");
  assert.deepEqual(Object.keys(SOCIAL_STRINGS.en).sort(), Object.keys(SOCIAL_STRINGS.he).sort());
  assert.match(SOCIAL_STRINGS.he.friends, /[\u0590-\u05ff]/);
  assert.match(HTML, /<dialog id="previewDialog"/);
  assert.match(HTML, /id="copyArtifactButton"[^>]*type="button"/);
  assert.match(HTML, /aria-live="polite"/);
});
