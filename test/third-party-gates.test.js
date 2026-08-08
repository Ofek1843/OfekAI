const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

test("prototype third-party exercise media, food image fallback and image generation are opt-in", () => {
  assert.match(source, /THIRD_PARTY_EXERCISE_MEDIA_ENABLED !== "true"/);
  assert.match(source, /THIRD_PARTY_SPOONACULAR_ENABLED !== "true"/);
  assert.match(source, /THIRD_PARTY_IMAGE_GENERATION_ENABLED !== "true"/);
  assert.match(source, /Verified third-party exercise demonstrations are not enabled/);
});
