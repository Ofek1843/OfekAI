const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(
  path.join(__dirname, "..", "public", "pricing.html"),
  "utf8"
);

const visibleText = html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

test("Pricing does not promise free forever or unlimited access", () => {
  assert.doesNotMatch(visibleText, /free forever/i);
  assert.doesNotMatch(visibleText, /unlimited/i);
  assert.match(visibleText, /Early Access/i);
});

test("Pricing distinguishes planned Pro access from the current experience", () => {
  assert.match(visibleText, /Pro \(planned\)/i);
  assert.match(visibleText, /Pricing to be announced/i);
  assert.doesNotMatch(visibleText, /Most Popular/i);
  assert.doesNotMatch(visibleText, /\$8/);
  assert.doesNotMatch(visibleText, /\b(?:buy|purchase|subscribe|checkout)\b/i);
});

test("Pricing keeps the authenticated Pro wishlist action", () => {
  assert.match(html, /id="waitlistButton"/);
  assert.match(html, /Join the Pro wishlist/i);
  assert.match(html, /waitlists["'],\s*["']pro/);
});

test("Pricing remains public and indexable", () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/fuelphysique\.com\/pricing\.html">/);
  assert.doesNotMatch(html, /<meta[^>]+name="robots"[^>]+noindex/i);
});

test("Pricing metadata describes Early Access and future Pro options", () => {
  for (const key of ["description", "og:description", "twitter:description"]) {
    const tag = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]*>`, "i"));
    assert.ok(tag, `missing ${key}`);
    assert.match(tag[0], /Early Access/i, `${key} should describe current availability`);
    assert.match(tag[0], /Pro wishlist/i, `${key} should describe the actual action`);
    assert.doesNotMatch(tag[0], /Free and Pro plans|unlimited access/i);
  }
});
