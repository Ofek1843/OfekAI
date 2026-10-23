"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { getCatalogExercise } = require("../lib/workout-exercise-catalog");

const ROOT = path.join(__dirname, "..");

test("workout builder labels the optional profile field professionally in English and Hebrew", () => {
  const html = fs.readFileSync(path.join(ROOT, "public", "workout-builder.html"), "utf8");
  assert.match(html, /data-en="Gender \(optional\)" data-he="מגדר \(אופציונלי\)"/);
  assert.match(html, /<select id="gender" name="gender"/);
});

test("plank catalog image is a real wide image with a matching WebP delivery sibling", async () => {
  const exercise = getCatalogExercise("plank");
  assert.equal(exercise.image, "plank.png");

  const sourcePath = path.join(ROOT, "public", "images", "exercises", exercise.image);
  const webpPath = sourcePath.replace(/\.png$/i, ".webp");
  assert.ok(fs.existsSync(sourcePath), "PNG fallback must exist");
  assert.ok(fs.existsSync(webpPath), "optimized WebP must exist");

  const [source, webp] = await Promise.all([
    sharp(sourcePath).metadata(),
    sharp(webpPath).metadata()
  ]);
  assert.equal(source.format, "png");
  assert.equal(webp.format, "webp");
  assert.ok(source.width >= 960 && source.height >= 500, "catalog source should have enough detail for the exercise card");
  assert.ok(webp.width >= 960 && webp.height >= 500, "WebP should retain useful detail for the exercise card");
});
