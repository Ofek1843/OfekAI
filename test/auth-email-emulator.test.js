const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase/app");
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, sendEmailVerification, applyActionCode, reload, signOut, signInWithEmailAndPassword, deleteUser } = require("firebase/auth");
const { buildActionCodeSettings } = require("../public/js/email-verification-core.mjs");
const { resolveContinueUrl } = require("../public/js/auth-action-core.mjs");

test("disposable emulator account verifies, continues to production login, signs out and signs back in", async () => {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9100";
  assert.match(host, /^127\.0\.0\.1:\d+$/);
  const projectId = "demo-fuelphysique";
  const app = initializeApp({ projectId, apiKey: "demo-key" }, `email-action-${Date.now()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${host}`, { disableWarnings: true });
  const email = `auth-domain-${Date.now()}@example.test`;
  const password = "Emulator-only-test-349!";
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(user, buildActionCodeSettings("https://fuelphysique.com"));
    const response = await fetch(`http://${host}/emulator/v1/projects/${projectId}/oobCodes`);
    assert.equal(response.status, 200);
    const { oobCodes } = await response.json();
    const action = oobCodes.find(item => item.email === email && item.requestType === "VERIFY_EMAIL");
    assert.ok(action, "verification action was generated");
    const link = new URL(action.oobLink);
    const continuation = link.searchParams.get("continueUrl");
    assert.equal(continuation, "https://fuelphysique.com/auth.html");
    await applyActionCode(auth, action.oobCode);
    await reload(user);
    assert.equal(user.emailVerified, true);
    assert.equal(new URL(resolveContinueUrl(continuation), "https://fuelphysique.com").href, "https://fuelphysique.com/auth.html");
    await signOut(auth);
    assert.equal(auth.currentUser, null);
    const result = await signInWithEmailAndPassword(auth, email, password);
    assert.equal(result.user.emailVerified, true);
  } finally {
    if (auth.currentUser) await deleteUser(auth.currentUser);
    await deleteApp(app);
  }
});
