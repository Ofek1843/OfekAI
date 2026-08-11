const test = require("node:test");
const assert = require("node:assert/strict");
const { AccountService, uidHash } = require("../lib/account-service");

function makeFixture({ readyForAuthDelete = false } = {}) {
  const state = new Map();
  const deleted = new Set();
  const calls = { image: [], storage: [], auth: [], push: 0, voice: [], musicWrites: [] };
  const ref = path => {
    if (!state.has(path)) state.set(path, {});
    return {
      path,
      async get() { return { exists: state.has(path), data: () => state.get(path) }; },
      async set(value, options = {}) { state.set(path, options.merge ? { ...state.get(path), ...value } : value); },
      async update(value) { state.set(path, { ...state.get(path), ...value }); },
      async delete() { deleted.add(path); },
      async listCollections() { return []; },
      collection(name) { return collection(`${path}/${name}`); }
    };
  };
  const emptyQuery = { async get() { return { docs: [], size: 0 }; } };
  const collection = path => ({
    async get() {
      if (path === "users/alice/progressPhotos") {
        return {
          docs: [{ data: () => ({ photos: { front: { fileId: "owned-image-id", path: "users/alice/progress/front.jpg" } } }) }],
          size: 1
        };
      }
      if (path === "conversations/alice_bob/messages") {
        const musicRef = ref(`${path}/music-from-alice`);
        musicRef.set = async (value, options = {}) => {
          calls.musicWrites.push(value);
          state.set(musicRef.path, options.merge ? { ...state.get(musicRef.path), ...value } : value);
        };
        return {
          docs: [
            { id: "music-from-alice", data: () => ({ type: "music_link", senderUid: "alice", music: { provider: "spotify", title: "Private training mix", url: "https://open.spotify.com/playlist/private" } }), ref: musicRef },
            { id: "music-from-bob", data: () => ({ type: "music_link", senderUid: "bob", music: { provider: "youtube", title: "Bob's mix", url: "https://youtube.com/watch?v=owned-by-bob" } }), ref: ref(`${path}/music-from-bob`) }
          ],
          size: 2
        };
      }
      return { docs: [], size: 0 };
    },
    where(field, _operator, value) {
      if (path === "conversations" && field === "participants" && value === "alice") {
        return {
          async get() {
            return {
              docs: [{
                id: "alice_bob",
                data: () => ({ participants: ["alice", "bob"] }),
                ref: ref("conversations/alice_bob")
              }],
              size: 1
            };
          }
        };
      }
      return emptyQuery;
    }
  });
  const jobPath = `accountDeletionJobs/${uidHash("alice")}`;
  if (readyForAuthDelete) state.set(jobPath, { status: "ready_for_auth_delete" });
  return {
    db: { doc: ref, collection },
    storage: { bucket: () => ({ file: path => ({ delete: async () => calls.storage.push(path) }) }) },
    auth: { deleteUser: async uid => calls.auth.push(uid) },
    pushService: { removeAllForUser: async () => { calls.push += 1; } },
    imageCleanup: async (uid, fileId) => { calls.image.push([uid, fileId]); return { status: "deleted" }; },
    voiceCleanup: async (uid, conversations) => { calls.voice.push([uid, conversations.map(item => item.id)]); return { deleted: 1, unavailable: 1, ownershipMismatch: 0 }; },
    calls,
    state,
    deleted,
    jobPath
  };
}

test("account deletion verifies nested media, preserves a survivor's history, then creates the durable Auth checkpoint", async () => {
  const fixture = makeFixture();
  const service = new AccountService(fixture);
  const result = await service.deleteAccount("alice", { confirmed: true, reauthenticatedAt: 1 });
  assert.equal(result.deleted, true);
  assert.deepEqual(fixture.calls.image, [["alice", "owned-image-id"]]);
  assert.deepEqual(fixture.calls.storage, ["users/alice/progress/front.jpg"]);
  assert.equal(fixture.calls.push, 1);
  assert.deepEqual(fixture.calls.voice, [["alice", ["alice_bob"]]]);
  assert.equal(fixture.calls.musicWrites.length, 1);
  assert.equal(fixture.calls.musicWrites[0].music.provider, "spotify");
  assert.equal(fixture.calls.musicWrites[0].music.title, "");
  assert.equal(fixture.calls.musicWrites[0].music.unavailable, true);
  assert.equal("url" in fixture.calls.musicWrites[0].music, false);
  assert.deepEqual(fixture.calls.auth, ["alice"]);
  assert.equal(fixture.state.get("conversations/alice_bob").status, "deleted_participant");
  assert.equal(fixture.state.get("users/bob/conversationSummaries/alice_bob").status, "deleted_participant");
  assert.equal(fixture.deleted.has("users/alice"), true);
  assert.equal(fixture.deleted.has("socialProfiles/alice"), true);
  assert.equal(fixture.state.get(fixture.jobPath).status, "completed");
});

test("a retry after the durable cleanup checkpoint does not repeat destructive cleanup", async () => {
  const fixture = makeFixture({ readyForAuthDelete: true });
  const service = new AccountService(fixture);
  const result = await service.deleteAccount("alice", { confirmed: true, reauthenticatedAt: 1 });
  assert.equal(result.deleted, true);
  assert.deepEqual(fixture.calls.image, []);
  assert.deepEqual(fixture.calls.storage, []);
  assert.equal(fixture.calls.push, 0);
  assert.deepEqual(fixture.calls.voice, []);
  assert.deepEqual(fixture.calls.musicWrites, []);
  assert.deepEqual(fixture.calls.auth, ["alice"]);
  assert.equal(fixture.state.get(fixture.jobPath).status, "completed");
});

test("voice cleanup failure stops deletion before Firestore identity or Auth removal", async () => {
  const fixture = makeFixture();
  fixture.voiceCleanup = async () => { throw Object.assign(new Error("provider unavailable"), { code: "voice_delete_failed" }); };
  const service = new AccountService(fixture);
  await assert.rejects(() => service.deleteAccount("alice", { confirmed: true, reauthenticatedAt: 1 }), error => error.code === "voice_delete_failed");
  assert.deepEqual(fixture.calls.auth, []);
  assert.equal(fixture.deleted.has("users/alice"), false);
  assert.equal(fixture.state.get(fixture.jobPath).status, "failed");
  assert.equal(fixture.state.get(fixture.jobPath).failureCode, "voice_delete_failed");
});
