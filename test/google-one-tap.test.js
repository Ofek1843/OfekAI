const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const source = fs.readFileSync('public/js/auth.js', 'utf8');
  const block = source.slice(source.indexOf('let oneTapRequested = false;'), source.indexOf('function isStandaloneDisplayMode()'));
  const calls = [];
  let config;
  const auth = { currentUser: null };
  const script = {};
  const context = {
    auth, document: { createElement: () => script, head: { append: () => calls.push('load') } },
    window: { google: { accounts: { id: { initialize: (c) => { config = c; }, prompt: () => calls.push('prompt') } } } },
    googleFlowInProgress: false, isPanelOpen: () => false,
    setGoogleButtonBusy: () => {}, rememberMeInput: { checked: true },
    browserLocalPersistence: 'local', browserSessionPersistence: 'session',
    setPersistence: async (_, choice) => calls.push(choice),
    GoogleAuthProvider: { credential: (value) => value },
    signInWithCredential: async (_, token) => { calls.push(token); return { user: { uid: 'test' } }; },
    getAdditionalUserInfo: () => ({ isNewUser: true }),
    finalizeGoogleUser: async (_, opts) => calls.push(opts.isNewUser ? 'new' : 'existing'),
    handleGoogleError: () => calls.push('error')
  };
  vm.createContext(context);
  vm.runInContext(block, context);
  return { context, calls, script, getConfig: () => config };
}

test('One Tap loads once and routes credentials through normal Google account finalization', async () => {
  const x = setup();
  x.context.offerGoogleOneTap();
  x.context.offerGoogleOneTap();
  x.script.onload();
  await x.getConfig().callback({ credential: 'test-token' });
  assert.deepEqual(x.calls, ['load', 'prompt', 'local', 'test-token', 'new']);
});

test('One Tap does not start for an existing user or local emulator', () => {
  for (const condition of ['user', 'emulator']) {
    const x = setup();
    if (condition === 'user') x.context.auth.currentUser = { uid: 'existing' };
    else x.context.auth.emulatorConfig = {};
    x.context.offerGoogleOneTap();
    assert.deepEqual(x.calls, []);
  }
});
