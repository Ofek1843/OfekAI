"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validateUsername } = require("../lib/social-domain");

const ROOT = path.join(__dirname, "..");
const SETTINGS = fs.readFileSync(path.join(ROOT, "public/js/settings.js"), "utf8");
const APP = fs.readFileSync(path.join(ROOT, "public/app.html"), "utf8");
const CSS = fs.readFileSync(path.join(ROOT, "public/css/settings.css"), "utf8");
const STORE = fs.readFileSync(path.join(ROOT, "lib/social-store.js"), "utf8");

test("username ownership remains an atomic server transaction with stable conflict code", () => {
  assert.match(STORE, /db\.runTransaction\(async \(transaction\)/);
  assert.match(STORE, /new SocialError\("username_taken"/);
  assert.equal(validateUsername("Ofek").usernameLower, "ofek");
  assert.equal(validateUsername("ofek").usernameLower, "ofek");
});

test("username conflict has precise English and Hebrew inline copy", () => {
  assert.match(SETTINGS, /error\.code === "username_taken"/);
  assert.match(SETTINGS, /Username is already taken/);
  assert.match(SETTINGS, /Choose another username/);
  assert.match(SETTINGS, /שם המשתמש כבר תפוס/);
  assert.match(SETTINGS, /בחרו שם משתמש אחר/);
  assert.match(SETTINGS, /\["username_taken", "invalid_username", "username_required", "username_state_conflict"\]/);
});

test("username field exposes accessible error state and clears it on edit or success", () => {
  assert.match(APP, /id="settingsSocialUsernameError" class="settings-field-error" role="alert"/);
  assert.match(SETTINGS, /setAttribute\("aria-invalid", "true"\)/);
  assert.match(SETTINGS, /setAttribute\("aria-describedby", elements\.socialUsernameError\.id\)/);
  assert.match(SETTINGS, /addEventListener\("input", clearUsernameError\)/);
  assert.match(SETTINGS, /loadedSocialProfile = data\.profile \|\| loadedSocialProfile;\s*clearUsernameError\(\)/);
  assert.match(CSS, /settings-field input\[aria-invalid="true"\]/);
  assert.match(CSS, /var\(--fp-danger\)/);
});

test("username normalization and format semantics are unchanged", () => {
  assert.equal(validateUsername("valid_name").ok, true);
  assert.equal(validateUsername("ab").ok, false);
  assert.equal(validateUsername(".invalid").ok, false);
  assert.equal(validateUsername("invalid..name").ok, false);
  assert.equal(validateUsername("a".repeat(21)).ok, false);
});
