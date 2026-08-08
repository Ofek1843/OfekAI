const test = require("node:test");
const assert = require("node:assert/strict");
const { AccountService } = require("../lib/account-service");

function snapshot(data, exists = true) { return { exists, data: () => data }; }
function document(id, data) { return { id, data: () => data }; }

test("account export includes bounded voice metadata for participant conversations but no audio capability or raw bytes", async () => {
  const messages = [
    document("sent-voice", { type: "voice", senderUid: "alice", createdAt: new Date("2026-08-08T10:00:00Z"), voice: { assetId: "secret-a", durationMs: 2000, mimeType: "audio/webm", sizeBytes: 5000 } }),
    document("received-voice", { type: "voice", senderUid: "bob", createdAt: new Date("2026-08-08T10:01:00Z"), voice: { assetId: "secret-b", durationMs: 3000, mimeType: "audio/mp4", sizeBytes: 6000, unavailable: true } }),
    document("text", { type: "text", senderUid: "bob", text: "not part of the voice export" })
  ];
  const conversation = {
    id: "alice_bob",
    ref: { collection: () => ({ async get() { return { docs: messages }; } }) }
  };
  const empty = { docs: [], size: 0 };
  const root = { async get() { return snapshot({ email: "alice@example.test" }); }, collection: () => ({ async get() { return empty; } }) };
  const db = {
    doc(path) {
      if (path === "users/alice") return root;
      if (path === "socialProfiles/alice") return { async get() { return snapshot({ username: "alice" }); } };
      throw new Error(`unexpected doc ${path}`);
    },
    collection(path) {
      return {
        where() {
          return { async get() { return path === "conversations" ? { docs: [conversation], size: 1 } : empty; } };
        }
      };
    }
  };
  const result = await new AccountService({ db, now: () => new Date("2026-08-08T11:00:00Z") }).exportAccount("alice");
  assert.deepEqual(result.voiceMessages, [
    { id: "sent-voice", conversationId: "alice_bob", senderUid: "alice", direction: "sent", createdAt: "2026-08-08T10:00:00.000Z", durationMs: 2000, mimeType: "audio/webm", sizeBytes: 5000, available: true },
    { id: "received-voice", conversationId: "alice_bob", senderUid: "bob", direction: "received", createdAt: "2026-08-08T10:01:00.000Z", durationMs: 3000, mimeType: "audio/mp4", sizeBytes: 6000, available: false }
  ]);
  assert.doesNotMatch(JSON.stringify(result.voiceMessages), /secret-a|secret-b|signed|not part of the voice export/);
  assert.equal(result.voiceMedia.rawAudioIncluded, false);
  assert.match(result.voiceMedia.access, /authenticated conversation playback/);
});
