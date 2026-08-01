"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const RULES_PATH = path.join(ROOT, "docs", "social", "firestore-social-rules-draft.txt");
const RULES = fs.readFileSync(RULES_PATH, "utf8");

test("draft rules carry an unambiguous non-deployment warning", () => {
  assert.match(RULES.split(/\r?\n/).slice(0, 4).join("\n"), /DO NOT DEPLOY UNTIL MERGED WITH THE COMPLETE CURRENT PRODUCTION RULESET/);
  assert.doesNotMatch(path.basename(RULES_PATH), /^firestore\.rules$/);
});

test("username ownership is server-reserved and not client-writable", () => {
  assert.match(RULES, /match \/usernames\/\{usernameKey\}[\s\S]*?allow read, write: if false/);
  assert.match(RULES, /match \/socialProfiles\/\{uid\}[\s\S]*?resource\.data\.discoverable == true/);
});

test("friendship, request and block documents are participant-scoped", () => {
  assert.match(RULES, /match \/friendRequests\/\{requestId\}[\s\S]*?fromUid == request\.auth\.uid[\s\S]*?toUid == request\.auth\.uid/);
  assert.match(RULES, /match \/friendships\/\{friendshipId\}[\s\S]*?request\.auth\.uid in resource\.data\.participants/);
  assert.match(RULES, /match \/users\/\{uid\}\/blocks\/\{blockedUid\}[\s\S]*?isSelf\(uid\)/);
});

test("conversation reads require participants and messages require accepted, unblocked friends", () => {
  assert.match(RULES, /function isConversationParticipant/);
  assert.match(RULES, /function acceptedFriends/);
  assert.match(RULES, /function notBlocked/);
  assert.match(RULES, /allow get, list: if acceptedFriends\(conversationId\) && notBlocked\(conversationId\)/);
});

test("sender identity, participant immutability and message length are explicit", () => {
  assert.match(RULES, /senderUid == request\.auth\.uid/);
  assert.match(RULES, /participantsAreImmutable/);
  assert.match(RULES, /text\.size\(\) <= 2000/);
  assert.match(RULES, /keys\(\)\.hasOnly/);
});

test("artifacts are recipient-scoped, immutable and revocable", () => {
  assert.match(RULES, /match \/sharedArtifacts\/\{artifactId\}/);
  assert.match(RULES, /request\.auth\.uid in resource\.data\.recipientIds/);
  assert.match(RULES, /request\.resource\.data\.snapshot == resource\.data\.snapshot/);
  assert.match(RULES, /request\.resource\.data\.revokedAt != null/);
});

test("copied plans remain recipient-owned and byte limits stay server-enforced", () => {
  assert.match(RULES, /sharedImports/);
  assert.match(RULES, /require uid ownership/);
  assert.match(RULES, /64 KiB workout, 96 KiB nutrition/);
});
