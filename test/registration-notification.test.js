"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_NEW_ACCOUNT_WINDOW_MS,
  isFreshAccount,
  registrationEventId,
  claimSignupNotification
} = require("../lib/registration-notification");

class MemoryFirestore {
  constructor() {
    this.documents = new Map();
    this.transactionQueue = Promise.resolve();
  }

  collection(name) {
    return { doc: id => ({ path: `${name}/${id}` }) };
  }

  runTransaction(callback) {
    const operation = this.transactionQueue.then(async () => {
      const writes = [];
      const transaction = {
        get: async ref => ({ exists: this.documents.has(ref.path) }),
        create: (ref, data) => writes.push([ref.path, data])
      };
      const result = await callback(transaction);
      for (const [path, data] of writes) this.documents.set(path, data);
      return result;
    });
    this.transactionQueue = operation.catch(() => {});
    return operation;
  }
}

test("new Firebase accounts are recognized from the server lookup creation timestamp", () => {
  const nowMs = 2_000_000;
  assert.equal(isFreshAccount(nowMs, { nowMs }), true);
  assert.equal(isFreshAccount(nowMs - DEFAULT_NEW_ACCOUNT_WINDOW_MS, { nowMs }), true);
  assert.equal(isFreshAccount(nowMs - DEFAULT_NEW_ACCOUNT_WINDOW_MS - 1, { nowMs }), false);
  assert.equal(isFreshAccount(nowMs + 30_000, { nowMs }), true, "small clock skew is tolerated");
  assert.equal(isFreshAccount(nowMs + 70_000, { nowMs }), false);
  assert.equal(isFreshAccount(undefined, { nowMs }), false);
});

test("concurrent and repeated signup events claim one persistent Telegram notification", async () => {
  const db = new MemoryFirestore();
  const args = {
    db,
    uid: "firebase-user-123",
    createdAt: 1_900_000,
    nowMs: 2_000_000,
    serverTimestamp: () => "server-time"
  };
  const results = await Promise.all(Array.from({ length: 8 }, () => claimSignupNotification(args)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(db.documents.size, 1);
  const [[path, event]] = [...db.documents.entries()];
  assert.match(path, /^signupNotificationEvents\/[a-f0-9]{64}$/);
  assert.equal(path.includes(args.uid), false);
  assert.deepEqual(event, { claimedAt: "server-time" });
  assert.equal(await claimSignupNotification(args), false, "a retry after process restart sees the persisted event");
});

test("existing accounts cannot claim a new-signup notification", async () => {
  const db = new MemoryFirestore();
  const claimed = await claimSignupNotification({
    db,
    uid: "existing-user",
    createdAt: 1,
    nowMs: 2_000_000,
    serverTimestamp: () => "server-time"
  });
  assert.equal(claimed, false);
  assert.equal(db.documents.size, 0);
});

test("no uid means no claim", async () => {
  const db = new MemoryFirestore();
  assert.equal(await claimSignupNotification({ db, uid: "", createdAt: Date.now(), serverTimestamp: () => "now" }), false);
  assert.equal(db.documents.size, 0);
});
