// Release regression tests for progress photo storage.
//
// Reported bug: the Progress page showed "The photo operation failed. Make sure
// ImageKit is fully configured." and users could not upload or compare photos.
//
// The upload pipeline itself is sound -- a real authenticated upload,
// reload-persistence, signed private delivery and comparison were all verified
// end to end locally. The defects fixed here are that the failure named the
// storage provider to end users, and that a deploy missing the credentials gave
// no signal anywhere except that user-facing error.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SERVER = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
const PROGRESS_JS = fs.readFileSync(path.join(ROOT, "public", "js", "progress.js"), "utf8");

test("no user-facing error names the storage provider", () => {
  const offenders = [...SERVER.matchAll(/error:\s*"([^"]*)"/g)]
    .map(m => m[1])
    .filter(message => /imagekit/i.test(message));
  assert.deepEqual(offenders, [], "users must not be shown provider or configuration details");
});

test("the Progress page's failure message is friendly and provider-free in both languages", () => {
  const messages = [...PROGRESS_JS.matchAll(/storageError:\s*"([^"]+)"/g)].map(m => m[1]);
  assert.equal(messages.length, 2, "expected an English and a Hebrew storage error message");
  for (const message of messages) {
    assert.doesNotMatch(message, /imagekit/i, `message names the provider: "${message}"`);
    assert.doesNotMatch(message, /configur/i, `message exposes configuration state: "${message}"`);
    assert.ok(message.length > 20, "message should be a helpful sentence, not a code");
  }
});

test("missing storage credentials are reported at startup, without logging values", () => {
  assert.match(SERVER, /function logPhotoStorageStartupDiagnostics/);
  assert.match(SERVER, /logPhotoStorageStartupDiagnostics\(\);/, "the diagnostic must actually run at startup");

  const fn = SERVER.slice(
    SERVER.indexOf("function logPhotoStorageStartupDiagnostics"),
    SERVER.indexOf("function imageKitClient")
  );
  for (const name of ["IMAGEKIT_PUBLIC_KEY", "IMAGEKIT_PRIVATE_KEY", "IMAGEKIT_URL_ENDPOINT"]) {
    assert.ok(fn.includes(name), `startup check must cover ${name}`);
  }
  // Only names may be logged, never the secret itself.
  assert.doesNotMatch(fn, /process\.env\[[^\]]+\]\s*\)?\s*\}?\`/, "must not interpolate a credential value into the log");
  assert.match(fn, /missing\.join/, "should report which names are missing");
});

test("photo storage endpoints require authentication", () => {
  // Every progress-photo route must resolve a Firebase user before doing work.
  const routes = [...SERVER.matchAll(/app\.(get|post|delete)\("(\/api\/(?:progress-photos|imagekit)[^"]*)"[\s\S]{0,400}?\n\}\)/g)];
  assert.ok(routes.length > 0, "expected progress-photo/imagekit routes");
  for (const [block, , routePath] of routes) {
    // Retired endpoints that only answer 410 Gone touch no stored data, so
    // they have nothing to authorize.
    if (/res\.status\(410\)/.test(block)) continue;
    assert.match(
      block,
      /requireFirebaseUser\(req, res\)/,
      `${routePath} must authenticate before touching stored photos`
    );
  }
});

test("uploads are scoped to the signed-in user's own folder", () => {
  // The upload prefix must be derived from the authenticated uid, never from
  // client-supplied input.
  assert.match(
    SERVER,
    /uploadPrefix:\s*`\/fuelphysique\/users\/\$\{user\.uid\}`/,
    "the upload prefix must come from the authenticated uid"
  );
});

test("the client uploads into a private, user-scoped path", () => {
  assert.match(PROGRESS_JS, /isPrivateFile:\s*true/, "progress photos must be private files");
  assert.match(
    PROGRESS_JS,
    /folder:\s*`\/fuelphysique\/users\/\$\{user\.uid\}\/progressPhotos\/\$\{photoDoc\.id\}`/,
    "photos must be stored under the user's own uid"
  );
});

test("client-side validation restricts type and size before upload", () => {
  assert.match(PROGRESS_JS, /image\/jpeg/);
  assert.match(PROGRESS_JS, /image\/png/);
  assert.match(PROGRESS_JS, /image\/webp/);
  assert.match(PROGRESS_JS, /5\s*\*\s*1024\s*\*\s*1024|5MB|5242880/i, "a maximum file size must be enforced");
});

test("progress photos are never written into the repository or public/", () => {
  const publicDir = path.join(ROOT, "public");
  const strayDirs = ["progressPhotos", "progress-photos", "uploads"];
  for (const name of strayDirs) {
    assert.equal(fs.existsSync(path.join(publicDir, name)), false, `${name} must not exist under public/`);
  }
  // And the storage path is remote, not a local filesystem write.
  assert.doesNotMatch(
    PROGRESS_JS,
    /fs\.writeFile|localStorage\.setItem\(["']progressPhoto/,
    "photos must go to remote private storage, not local/repo storage"
  );
});
