"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");
const source = fs.readFileSync(require.resolve("../public/js/social.js"), "utf8");

async function fixture(messages, { confirm = true, failure = false } = {}) {
  const { document } = parseHTML('<div id="messageScroller"></div><ul id="messageList"></ul><button id="loadOlderButton"></button>');
  const core = await import("../public/js/social-core.mjs");
  const calls = [];
  const state = { user: { uid: "sender" }, messages, activeConversation: { id: "test-thread" }, copiedArtifacts: new Map() };
  const context = vm.createContext({ document, state, language: "en", ui: core.socialStrings("en"), escapeHtml: core.escapeHtml, formatMessageTime: () => "12:00", requestAnimationFrame: (fn) => fn(), $: (selector) => document.querySelector(selector), confirmMessageDeletion: async () => confirm, api: async (...args) => { calls.push(args); if (failure) throw new Error("Offline"); return { deleted: true }; }, voicePlayback: { stop() {} }, toast: (...args) => calls.push(["toast", ...args]) });
  for (const [start, end] of [["function artifactCard(", "function voiceMessageBubble("], ["function renderMessages(", "function setTypingIndicator("], ["async function messageListAction(", "async function saveIdentity("]]) {
    vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end)), context);
  }
  return { document, context, state, calls };
}

for (const type of ["text", "artifact", "voice", "music_link"]) {
  test(`deleted ${type} renders a tombstone, never its old content or actions`, async () => {
    const f = await fixture([{ id: "m1", senderUid: "sender", type, deletedAt: "2026-10-16", text: "secret", artifactTitle: "old plan", artifactType: "workout", artifactId: "old-artifact" }]);
    f.context.renderMessages();
    assert.match(f.document.querySelector("#messageList").textContent, /Message deleted/);
    assert.doesNotMatch(f.document.querySelector("#messageList").innerHTML, /secret|old plan|old-artifact|data-action/);
  });
}

test("text and shared-plan messages expose sender-only, explicit deletion", async () => {
  const f = await fixture([
    { id: "text", senderUid: "sender", type: "text", text: "test" },
    { id: "plan", senderUid: "sender", type: "artifact", artifactType: "workout", artifactId: "plan-a", artifactTitle: "Plan" },
    { id: "received", senderUid: "friend", type: "text", text: "hello" },
    { id: "pending", senderUid: "sender", type: "text", status: "sending" }
  ]);
  f.context.renderMessages();
  assert.equal(f.document.querySelectorAll('[data-action="delete-message"]').length, 2);
  assert.equal(f.document.querySelector('[data-action="delete-message"]').textContent, "Delete message");
  assert.ok(f.document.querySelector('[data-message-id="received"] [data-action="report-message"]'));
  assert.equal(f.document.querySelector('[data-message-id="pending"] [data-action="delete-message"]'), null);
  await f.context.messageListAction(f.document.querySelector('[data-message-id="plan"] [data-action="delete-message"]'));
  assert.equal(f.calls[0][0], "/conversations/test-thread/messages/plan");
  assert.equal(f.calls[0][1].method, "DELETE");
  assert.equal(f.document.querySelector('[data-message-id="plan"] .artifact-card'), null);
  assert.match(f.document.querySelector('[data-message-id="plan"]').textContent, /Message deleted/);
});

test("cancel and API failure preserve the message and allow retry", async () => {
  for (const options of [{ confirm: false }, { failure: true }]) {
    const f = await fixture([{ id: "m1", senderUid: "sender", type: "text", text: "Keep me" }], options);
    f.context.renderMessages();
    const button = f.document.querySelector('[data-action="delete-message"]');
    await f.context.messageListAction(button);
    assert.equal(f.state.messages[0].deletedAt, undefined);
    assert.match(f.document.querySelector("#messageList").textContent, /Keep me/);
    assert.ok(!button.disabled);
    if (options.confirm === false) assert.equal(f.calls.length, 0);
  }
});

test("a forged recipient delete action is ignored before any API call", async () => {
  const f = await fixture([{ id: "received", senderUid: "friend", type: "text", text: "Keep me" }]);
  await f.context.messageListAction({ dataset: { action: "delete-message", messageId: "received" } });
  assert.equal(f.calls.length, 0);
});

test("all settings tabs share the scoped light action row and dashboard links to Messages", async () => {
  const css = fs.readFileSync(require.resolve("../public/css/product-paper-routes.css"), "utf8");
  assert.match(css, /body\.fp-route-app \.settings-footer\s*\{[^}]*background:\s*#fff !important/);
  const html = fs.readFileSync(require.resolve("../public/app.html"), "utf8");
  assert.equal((html.match(/class="settings-footer"/g) || []).length, 1);
  const { document } = await require("./helpers/current-product.cjs").dashboard();
  assert.equal(document.querySelector('.sidebar a[href="/social.html"]').textContent, "Messages");
});
