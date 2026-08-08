const test = require("node:test");
const assert = require("node:assert/strict");
const { callbackEventId } = require("../lib/payplus-billing");

test("PayPlus callback id is stable for a provider transaction and does not retain the raw identifier", () => {
  const first = callbackEventId({ transaction_uid: "provider-transaction-1", nested: { amount: 10 } });
  const second = callbackEventId({ transaction_uid: "provider-transaction-1" });
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(first, /provider-transaction/);
  assert.notEqual(first, callbackEventId({ transaction_uid: "provider-transaction-2" }));
});
