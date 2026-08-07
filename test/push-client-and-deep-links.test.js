const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  PUSH_PROMPT_COOLDOWN_MS,
  isIOSDevice,
  isStandaloneDisplay,
  pushCapability,
  shouldShowPrePermission
} = require("../public/js/push-client-core.mjs");
const { resolveNextPath } = require("../public/js/auth-google-core.mjs");

const ROOT = path.join(__dirname, "..");
const PUSH_SOURCE = fs.readFileSync(path.join(ROOT, "public/js/push-notifications.js"), "utf8");
const APP = fs.readFileSync(path.join(ROOT, "public/app.html"), "utf8");
const SOCIAL = fs.readFileSync(path.join(ROOT, "public/js/social.js"), "utf8");
const TRACKER = fs.readFileSync(path.join(ROOT, "public/js/workout-tracker.js"), "utf8");
const GATE = fs.readFileSync(path.join(ROOT, "public/js/verification-gate.js"), "utf8");

test("capability detection covers supported, unsupported, iOS and standalone modes", () => {
  assert.equal(pushCapability({ serviceWorker: true, pushManager: true, notifications: true, messagingSupported: true }), "supported");
  assert.equal(pushCapability({ serviceWorker: true, pushManager: false, notifications: true, messagingSupported: true }), "unsupported");
  assert.equal(isIOSDevice({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" }), true);
  assert.equal(isIOSDevice({ platform: "MacIntel", maxTouchPoints: 5 }), true);
  assert.equal(isStandaloneDisplay({ standaloneMedia: true }), true);
  assert.equal(isStandaloneDisplay({ navigatorStandalone: true }), true);
});

test("all browser Firebase imports use the audited FID-capable 12.17.1 SDK", () => {
  const publicRoot = path.join(ROOT, "public");
  const files = [];
  const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:js|mjs|html)$/.test(entry.name)) files.push(full);
  });
  walk(publicRoot);
  const firebaseImports = files.flatMap(file => [...fs.readFileSync(file, "utf8").matchAll(/firebasejs\/(\d+\.\d+\.\d+)/g)].map(match => ({ file, version: match[1] })));
  assert.ok(firebaseImports.length > 20);
  assert.deepEqual([...new Set(firebaseImports.map(item => item.version))], ["12.17.1"]);
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(packageJson.dependencies["firebase-admin"], "^14.2.0");
});

test("pre-permission prompt is restrained to authenticated installed dashboard/default state", () => {
  const base = { authenticated: true, page: "/dashboard.html", permission: "default", capability: "supported", standalone: true, isIOS: false, now: 100_000_000_000 };
  assert.equal(shouldShowPrePermission(base), true);
  assert.equal(shouldShowPrePermission({ ...base, authenticated: false }), false);
  assert.equal(shouldShowPrePermission({ ...base, page: "/social.html" }), false);
  assert.equal(shouldShowPrePermission({ ...base, permission: "granted" }), false);
  assert.equal(shouldShowPrePermission({ ...base, permission: "denied" }), false);
  assert.equal(shouldShowPrePermission({ ...base, standalone: false }), false);
  assert.equal(shouldShowPrePermission({ ...base, isIOS: true, standalone: false }), false);
  assert.equal(shouldShowPrePermission({ ...base, dismissedAt: base.now - PUSH_PROMPT_COOLDOWN_MS + 1 }), false);
  assert.equal(shouldShowPrePermission({ ...base, dismissedAt: base.now - PUSH_PROMPT_COOLDOWN_MS }), true);
});

test("system permission is called only inside the explicit enable function before its first await", () => {
  const functionStart = PUSH_SOURCE.indexOf("export async function enableNotificationsFromGesture()");
  const functionEnd = PUSH_SOURCE.indexOf("export async function disassociateCurrentInstallation", functionStart);
  const body = PUSH_SOURCE.slice(functionStart, functionEnd);
  assert.match(body, /Notification\.requestPermission\(\)/);
  assert.ok(body.indexOf("Notification.requestPermission()") < body.indexOf("await permissionPromise"));
  const outside = PUSH_SOURCE.slice(0, functionStart) + PUSH_SOURCE.slice(functionEnd);
  assert.doesNotMatch(outside, /Notification\.requestPermission\(\)/);
});

test("permission UI includes cooldown, denied state, iOS install guidance, labels and reachable controls", () => {
  assert.match(PUSH_SOURCE, /PUSH_PROMPT_DISMISSED_KEY/);
  assert.match(PUSH_SOURCE, /permission === "denied"/);
  assert.match(PUSH_SOURCE, /Add to Home Screen/);
  assert.match(PUSH_SOURCE, /הוספה למסך הבית/);
  assert.match(APP, /id="notificationsTab"/);
  for (const id of ["pushEnabled", "pushMessages", "pushShares", "pushWorkouts", "pushPreviews", "pushReminderTime", "pushEnableDevice", "pushSavePreferences"]) {
    assert.match(APP, new RegExp(`id="${id}"`));
  }
  assert.match(APP, /role="status" aria-live="polite"/);
  assert.match(APP, /type="time"/);
  assert.match(APP, /push-notifications\.css/);
  assert.match(PUSH_SOURCE, /שעת התזכורת/);
});

test("logout and account-switch lifecycle disassociates and unregisters the current FID", () => {
  assert.match(PUSH_SOURCE, /installations\/current[\s\S]*method: "DELETE"/);
  assert.match(PUSH_SOURCE, /unregister\(messaging\)/);
  assert.match(PUSH_SOURCE, /uid: "user-b"|activeUser/);
  for (const relative of ["public/js/app-auth.js", "public/js/dashboard.js", "public/js/verification-gate.js"]) {
    const source = fs.readFileSync(path.join(ROOT, relative), "utf8");
    assert.match(source, /await disassociateCurrentInstallation\(\)[\s\S]*await signOut\(auth\)/);
  }
});

test("safe auth return paths accept exact notification destinations", () => {
  assert.equal(resolveNextPath("/social.html?conversation=thread_1"), "/social.html?conversation=thread_1");
  assert.equal(resolveNextPath("/social.html?conversation=thread_1&artifact=artifact-2"), "/social.html?conversation=thread_1&artifact=artifact-2");
  assert.equal(resolveNextPath("/workout-tracker.html?plan=plan-1&session=push-day&date=2026-08-07"), "/workout-tracker.html?plan=plan-1&session=push-day&date=2026-08-07");
  assert.equal(resolveNextPath("workout-builder.html"), "/workout-builder.html");
});

test("external and malformed return paths are rejected", () => {
  for (const value of [
    "https://evil.example/social.html?conversation=x",
    "//evil.example/social.html?conversation=x",
    "javascript:alert(1)",
    "data:text/html,bad",
    "/social.html?conversation=x&next=https://evil.example",
    "/social.html?conversation=../../secret",
    "/workout-tracker.html?plan=p&session=s&date=not-a-date"
  ]) assert.equal(resolveNextPath(value), "/dashboard.html", value);
});

test("logged-out notification destination survives auth and exact content opens after authorization", () => {
  assert.match(GATE, /resolveNextPath\(`\$\{window\.location\.pathname\}\$\{window\.location\.search\}`\)/);
  assert.match(GATE, /auth\.html\?next=/);
  assert.match(SOCIAL, /params\.get\("conversation"\)/);
  assert.match(SOCIAL, /state\.messages\.some\(message => message\.artifactId === artifactId\)/);
  assert.match(TRACKER, /requestedPlan === activePlanId && requestedIndex >= 0/);
  assert.match(TRACKER, /\$\("#sessionSelect"\)\.value = String\(requestedIndex\)/);
});

test("client never exposes generic recipient/title/body push submission", () => {
  assert.doesNotMatch(PUSH_SOURCE, /recipientUid/);
  const router = fs.readFileSync(path.join(ROOT, "lib/push-router.js"), "utf8");
  assert.doesNotMatch(router, /req\.body\?\.(?:recipientUid|title|body)/);
  assert.match(router, /router\.post\("\/test"/);
  assert.match(router, /req\.pushUser\.uid/);
});
