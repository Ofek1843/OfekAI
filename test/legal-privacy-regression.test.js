"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const page = name => fs.readFileSync(path.join(ROOT, "public", name), "utf8");
const privacy = page("privacy.html");
const terms = page("terms.html");
const subscriptionPolicy = page("subscription-policy.html");
const authCore = page("js/auth-google-core.mjs");
const legalPolicy = fs.readFileSync(path.join(ROOT, "lib", "legal-policy.js"), "utf8");

test("privacy disclosures name the implemented processors and privacy controls", () => {
  for (const marker of ["Firebase", "OpenAI", "ImageKit", "PayPlus", "Firebase Cloud Messaging", "structured account-data export", "account deletion request", "message previews"]) {
    assert.match(privacy, new RegExp(marker, "i"));
  }
  assert.doesNotMatch(privacy, /Stripe/i);
});

test("public legal pages and terms acceptance retain the required safety markers", () => {
  for (const file of ["community-guidelines.html", "copyright.html", "accessibility.html", "subprocessors.html"]) {
    const source = page(file);
    assert.match(source, /lang="en"/i);
    assert.match(source, /dir="rtl"/i);
    assert.match(source, /legal-page-language\.js/);
  }
  for (const marker of ["not medical", "AI", "community", "copyright"]) {
    assert.match(terms, new RegExp(marker, "i"));
  }
  assert.match(subscriptionPolicy, /PayPlus/i);
  assert.match(authCore, /termsVersion/);
  assert.match(legalPolicy, /MINIMUM_ACCOUNT_AGE/);
});
