"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createTelemetryAgent } = require("../lib/telemetry-agent");

test("only a verified registration sends an immediate private Telegram alert", async (t) => {
  const originalFetch = global.fetch;
  const sent = [];
  global.fetch = async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return { ok: true, text: async () => "" };
  };
  t.after(() => { global.fetch = originalFetch; });

  const agent = createTelemetryAgent({
    brandName: "FuelPhysique",
    telegramBotToken: "test-token",
    telegramChatId: "12345",
    enabled: true,
    logger: { log() {}, error() {} }
  });

  agent.recordAnalytics("signup_completed");
  assert.equal(agent.getSnapshot().registrationsToday, 0, "public analytics cannot count a verified signup");
  assert.equal(await agent.recordVerifiedRegistration({ uid: "user-123" }), true);
  assert.equal(await agent.recordVerifiedRegistration({ uid: "user-123" }), false, "same user is deduplicated");
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /משתמש חדש נרשם/);
  assert.match(sent[0].text, /נרשמים חדשים היום: 1/);
  assert.doesNotMatch(sent[0].text, /user-123/);
  assert.equal(agent.getSnapshot().registrationsToday, 1);
});

test("signup notification copy does not contain personal data fields", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "telemetry-agent.js"), "utf8");
  const registrationBlock = source.slice(source.indexOf("async function recordVerifiedRegistration"), source.indexOf("function maybeAlert"));
  assert.doesNotMatch(registrationBlock, /email|displayName|name:/i);
  assert.match(registrationBlock, /אינה כוללת שם, אימייל או מזהה משתמש/);
});
