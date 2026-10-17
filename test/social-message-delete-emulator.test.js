"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
// Never point this fixture test at production or clear a shared test database.
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" || process.env.FIREBASE_PROJECT_ID !== "demo-fuelphysique") {
  throw new Error("Use the loopback demo-fuelphysique Firestore emulator for this test.");
}
const { getFuelPhysiqueFirestore } = require("../lib/firebase-admin");
const { Timestamp } = require("firebase-admin/firestore");
const social = require("../lib/social-store");
const db = getFuelPhysiqueFirestore();

test("deletion preserves ownership, updates latest previews, and supports legacy conversations", async () => {
  for (const legacy of [false, true]) {
    const id = `delete-regression-${process.pid}-${Date.now()}-${legacy}`;
    const participants = [`${id}-sender`, `${id}-friend`];
    const conversation = db.doc(`conversations/${id}`);
    const first = conversation.collection("messages").doc("older");
    const last = conversation.collection("messages").doc("latest");
    await conversation.set({ participants, ...(legacy ? {} : { lastMessageId: last.id }), lastMessagePreview: "Latest private text" });
    await first.set({ senderUid: participants[0], type: "artifact", artifactType: "workout", text: "", createdAt: Timestamp.fromMillis(1000) });
    await last.set({ senderUid: participants[0], type: "text", text: "Latest private text", createdAt: Timestamp.fromMillis(2000) });
    for (const uid of participants) await db.doc(`users/${uid}/conversationSummaries/${id}`).set({ lastMessagePreview: "Latest private text", unreadCount: 3 });
    await assert.rejects(social.deleteMessage(participants[1], id, last.id), { code: "forbidden" });
    await assert.rejects(social.deleteMessage("unrelated-user", id, last.id), { code: "conversation_not_found" });
    await social.deleteMessage(participants[0], id, first.id);
    assert.equal((await conversation.get()).data().lastMessagePreview, "Latest private text", "older deletion must not overwrite a newer preview");
    await social.deleteMessage(participants[0], id, last.id);
    assert.equal((await last.get()).data().text, "");
    assert.ok((await last.get()).data().deletedAt);
    assert.equal((await conversation.get()).data().lastMessagePreview, "Message deleted");
    for (const uid of participants) {
      const summary = (await db.doc(`users/${uid}/conversationSummaries/${id}`).get()).data();
      assert.equal(summary.lastMessagePreview, "Message deleted");
      assert.equal(summary.unreadCount, 3, "deletion must not corrupt unread counters");
    }
    await social.deleteMessage(participants[0], id, last.id);
    assert.equal((await conversation.get()).data().lastMessagePreview, "Message deleted");
  }
});

test.after(async () => { await db.terminate(); });
