"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  cleanBio,
  derivePublicBadges,
  publicRoleForBadges,
  sanitizeProfilePhotoURL,
  sanitizePublicBadges
} = require("../lib/social-domain");

const ROOT = path.join(__dirname, "..");
const SOCIAL = fs.readFileSync(path.join(ROOT, "public", "js", "social.js"), "utf8");
const SETTINGS = fs.readFileSync(path.join(ROOT, "public", "js", "settings.js"), "utf8");
const ROUTER = fs.readFileSync(path.join(ROOT, "lib", "social-router.js"), "utf8");
const STORE = fs.readFileSync(path.join(ROOT, "lib", "social-store.js"), "utf8");
const RULES = fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8");

test("bio is plain text, bounded and preserves safe line wrapping", () => {
  const bio = cleanBio("  <b>Lift</b>\n\n\nHebrew שלום <script>alert(1)</script>  ");
  assert.equal(bio, "Lift\n\nHebrew שלום alert(1)");
  assert.ok(cleanBio("x".repeat(200)).length <= 160);
});

test("profile photo validation accepts Google and ImageKit photos but rejects arbitrary URLs", () => {
  assert.equal(sanitizeProfilePhotoURL("https://lh3.googleusercontent.com/a/photo"), "https://lh3.googleusercontent.com/a/photo");
  assert.equal(sanitizeProfilePhotoURL("https://cdn.example.test/photo", { imageKitEndpoint: "https://cdn.example.test" }), "https://cdn.example.test/photo");
  assert.throws(() => sanitizeProfilePhotoURL("http://lh3.googleusercontent.com/a/photo"), /HTTPS/);
  assert.throws(() => sanitizeProfilePhotoURL("https://evil.example/photo"), /FuelPhysique/);
});

test("Athlete is the default and privileged badges require trusted inputs", () => {
  assert.deepEqual(derivePublicBadges(), ["athlete"]);
  assert.deepEqual(derivePublicBadges({ storedBadges: ["pro", "coach"], subscription: {} }), ["athlete", "coach"]);
  assert.deepEqual(derivePublicBadges({ storedBadges: ["coach"], subscription: { planId: "pro", status: "active" } }), ["athlete", "coach", "pro"]);
  assert.equal(publicRoleForBadges(["athlete", "developer"]), "developer");
  assert.deepEqual(sanitizePublicBadges(["athlete", "nonsense", "developer"]), ["athlete", "developer"]);
});

test("Social profile responses and settings expose only public profile fields", () => {
  assert.match(SOCIAL, /profile\.photoURL/);
  assert.match(SOCIAL, /profilePreviewBio/);
  assert.match(SETTINGS, /settingsSocialPhoto/);
  assert.match(SETTINGS, /image\/jpeg.*image\/png.*image\/webp/);
  assert.match(ROUTER, /router\.put\("\/profile"/);
  assert.match(ROUTER, /allowed = \{[\s\S]*username:[\s\S]*photoURL/);
  assert.match(STORE, /function profileProjection[\s\S]*photoURL[\s\S]*bio[\s\S]*badges/);
  assert.doesNotMatch(SOCIAL, /profile\.email|profile\.weight|profile\.nutrition/);
});

test("profile rules reserve every social-profile mutation for the trusted server", () => {
  assert.match(RULES, /match \/socialProfiles\/\{uid\}[\s\S]*?allow list, create, update, delete: if false/);
  assert.doesNotMatch(RULES, /allow update: if isSelf\(uid\)/);
  assert.match(ROUTER, /router\.put\("\/profile"/);
  assert.match(STORE, /async function updatePublicProfile/);
});
