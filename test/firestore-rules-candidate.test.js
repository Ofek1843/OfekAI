const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const BASELINE_PATH = path.join(ROOT, "docs", "social", "firestore-rules-production-baseline-2026-08-01.txt");
const RULES_PATH = path.join(ROOT, "docs", "social", "firestore-rules-merged-candidate.txt");
const INDEX_PATH = path.join(ROOT, "docs", "social", "firestore-indexes-merged-candidate.json");
const FINAL_RULES_PATH = path.join(ROOT, "firestore.rules");
const FINAL_INDEX_PATH = path.join(ROOT, "firestore.indexes.json");
const FIREBASE_CONFIG_PATH = path.join(ROOT, "firebase.json");

const BASELINE = fs.readFileSync(BASELINE_PATH, "utf8");
const RULES = fs.readFileSync(RULES_PATH, "utf8");
const INDEXES = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
const FINAL_RULES = fs.readFileSync(FINAL_RULES_PATH, "utf8");
const FINAL_INDEXES = JSON.parse(fs.readFileSync(FINAL_INDEX_PATH, "utf8"));
const FIREBASE_CONFIG = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_PATH, "utf8"));

function withoutComments(source) {
  return source.replace(/\/\/.*$/gm, "");
}

test("the preserved production baseline is complete and untouched in structure", () => {
  assert.match(BASELINE, /rules_version\s*=\s*'2'/);
  assert.match(BASELINE, /service\s+cloud\.firestore\s*\{/);
  assert.match(BASELINE, /match\s+\/databases\/\{database\}\/documents\s*\{/);
  assert.match(BASELINE, /match \/users\/\{userId\}/);
  assert.match(BASELINE, /match \/leaderboardEntries\/\{entryId\}/);
});

test("the merged candidate is marked non-deployable and structurally balanced", () => {
  assert.match(RULES, /NOT DEPLOYED/);
  assert.match(RULES, /rules_version\s*=\s*'2'/);
  assert.match(RULES, /service\s+cloud\.firestore\s*\{/);
  assert.match(RULES, /match\s+\/databases\/\{database\}\/documents\s*\{/);
  const code = withoutComments(RULES);
  assert.equal((code.match(/{/g) || []).length, (code.match(/}/g) || []).length);
  assert.doesNotMatch(RULES, /match \/users\/\{userId\}\/\{document=\*\*\}/);
  assert.doesNotMatch(RULES, /allow\s+read,\s*write:\s*if\s+signedIn\(\)/);
});

test("known legacy collections retain owner access without a social catch-all", () => {
  assert.match(RULES, /isLegacyUserCollection/);
  for (const collection of [
    "athleteCore", "settings", "workoutPlans", "nutritionPlans", "workoutLogs",
    "weightEntries", "bodyMeasurements", "progressPhotos", "runs", "conversations",
    "leaderboardSubmissions", "transformationSubmissions", "waitlists"
  ]) {
    assert.match(RULES, new RegExp(`['"]${collection}['"]`));
  }
  assert.match(RULES, /isSelf\(userId\)\s*&&\s*isLegacyUserCollection\(legacyCollection\)/);
  assert.match(RULES, /match \/users\/\{userId\}\/\{legacyCollection\}\/\{document=\*\*\}/);
  assert.match(RULES, /match \/leaderboardEntries\/\{entryId\}[\s\S]*?allow read: if signedIn\(\)/);
  assert.match(RULES, /isLeaderboardAdmin\(\)/);
});

test("social collection coverage denies unauthenticated and client-owned mutations", () => {
  for (const collection of [
    "usernames", "socialProfiles", "friendRequests", "friendships", "blocks",
    "conversationSummaries", "conversations", "sharedArtifacts", "sharedImports"
  ]) assert.match(RULES, new RegExp(`match \/(?:users\/\\{uid\\}\/)?${collection}`));
  assert.match(RULES, /match \/usernames\/\{usernameLower\}[\s\S]*?allow read, write: if false/);
  assert.match(RULES, /match \/friendRequests\/\{requestId\}[\s\S]*?allow create, update, delete: if false/);
  assert.match(RULES, /match \/friendships\/\{friendshipId\}[\s\S]*?allow create, update, delete: if false/);
  assert.match(RULES, /match \/users\/\{uid\}\/blocks\/\{blockedUid\}[\s\S]*?allow create, update, delete: if false/);
  assert.match(RULES, /match \/users\/\{uid\}\/sharedImports\/\{artifactId\}[\s\S]*?allow create, update, delete: if false/);
  assert.match(RULES, /match \/conversations\/\{conversationId\}[\s\S]*?allow list, create, update, delete: if false/);
  assert.match(RULES, /match \/messages\/\{messageId\}[\s\S]*?allow create, update, delete: if false/);
  assert.match(RULES, /match \/sharedArtifacts\/\{artifactId\}[\s\S]*?allow list, create, update, delete: if false/);
});

test("new push collections remain outside every client-readable legacy allowlist", () => {
  for (const collection of ["pushInstallations", "notificationPreferences", "pushEvents"]) {
    assert.doesNotMatch(RULES, new RegExp(`['"]${collection}['"]`));
  }
  assert.doesNotMatch(RULES, /match \/\{document=\*\*\}[\s\S]*allow read, write: if signedIn/);
});

test("social reads require participant, ownership, friendship, block and revocation checks", () => {
  assert.match(RULES, /socialProfiles\/\{uid\}[\s\S]*?resource\.data\.discoverable == true/);
  assert.match(RULES, /friendRequests\/\{requestId\}[\s\S]*?fromUid == request\.auth\.uid[\s\S]*?toUid == request\.auth\.uid/);
  assert.match(RULES, /friendships\/\{friendshipId\}[\s\S]*?request\.auth\.uid in resource\.data\.participants/);
  assert.match(RULES, /friendship\.data\.status == 'accepted'/);
  assert.match(RULES, /friendship\.data\.participants == participants/);
  assert.match(RULES, /users\/\$\(request\.auth\.uid\)\/blocks\/\$\(otherUid\)/);
  assert.match(RULES, /users\/\$\(otherUid\)\/blocks\/\$\(request\.auth\.uid\)/);
  assert.match(RULES, /sharedArtifacts\/\{artifactId\}[\s\S]*?resource\.data\.revokedAt == null/);
  assert.match(RULES, /resource\.data\.ownerUid == request\.auth\.uid[\s\S]*?request\.auth\.uid in resource\.data\.recipientIds/);
  assert.match(RULES, /users\/\{uid\}\/conversationSummaries\/\{conversationId\}[\s\S]*?allow get, list: if isSelf\(uid\)/);
});

test("the candidate indexes contain exactly the two required friend-request composites", () => {
  assert.equal(INDEXES.warning.startsWith("NOT DEPLOYED"), true);
  assert.deepEqual(INDEXES.fieldOverrides, []);
  assert.equal(INDEXES.indexes.length, 2);
  const indexes = INDEXES.indexes.map((index) => ({
    collectionGroup: index.collectionGroup,
    fields: index.fields.map(({ fieldPath, order }) => `${fieldPath}:${order}`)
  }));
  assert.deepEqual(indexes, [
    { collectionGroup: "friendRequests", fields: ["toUid:ASCENDING", "status:ASCENDING"] },
    { collectionGroup: "friendRequests", fields: ["fromUid:ASCENDING", "status:ASCENDING"] }
  ]);
  assert.match(INDEXES.review.composites[0].requirement, /strictly required/);
  assert.match(INDEXES.review.composites[1].requirement, /strictly required/);
});

test("the deployable Firestore files retain the reviewed social scope and lock server-owned root fields", () => {
  assert.match(FINAL_RULES, /function permittedUserRootKeys\(\)/);
  assert.match(FINAL_RULES, /request\.resource\.data\.keys\(\)\.hasOnly\(permittedUserRootKeys\(\)\)/);
  assert.match(FINAL_RULES, /affectedKeys\(\)\.hasOnly\(permittedUserRootKeys\(\)\)/);
  assert.match(FINAL_RULES, /match \/users\/\{userId\}[\s\S]*?allow delete: if false/);
  assert.match(FINAL_RULES, /match \/socialProfiles\/\{uid\}[\s\S]*?allow list, create, update, delete: if false/);
  assert.doesNotMatch(FINAL_RULES, /allow read, update, delete: if isSelf\(userId\)/);
  assert.deepEqual(FINAL_INDEXES, {
    indexes: INDEXES.indexes,
    fieldOverrides: []
  });
  assert.deepEqual(FIREBASE_CONFIG, {
    firestore: {
      rules: "firestore.rules",
      indexes: "firestore.indexes.json"
    }
  });
});
