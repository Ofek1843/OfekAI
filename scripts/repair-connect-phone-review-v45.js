"use strict";

// Repairs the connect (Social) scene's opening/closing "phone-review" frame.
// The generated frame-01 renders the phone BACK-forward: the rear triple-camera
// module and glossy back panel are visible on the same face as the app UI, so
// the phone reads as reversed/backwards to the viewer.
//
// frame-03 ("phone-share") is the same athlete holding the same phone, screen
// correctly toward the viewer. This rebuilds normalized/frame-01.webp from
// frame-03's already-keyed source using the exact connect normalize geometry
// (see prepare-remaining-real-athlete-v43.js): trim -> resize to height 680 ->
// centre on a 760x720 canvas, bottom-aligned with a 10px margin.
//
// Only normalized/frame-01.webp and its manifest byte count change. Sources are
// untouched; the scene sequence and frame semantics are unchanged.

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ASSET_ROOT = path.join(ROOT, "public", "assets", "athlete-motion", "v43");
const CONNECT = path.join(ASSET_ROOT, "connect");
const SOURCE = path.join(CONNECT, "final-source", "frame-03.png");
const OUTPUT = path.join(CONNECT, "normalized", "frame-01.webp");
const MANIFEST_PATH = path.join(ASSET_ROOT, "manifest.json");
const REVIEW_ROOT = path.join(ROOT, "docs", "illustration", "v43");

const CANVAS = { width: 760, height: 720 };
const SUBJECT_HEIGHT = 680;
const BOTTOM_MARGIN = 10;
const VERSION = "20260907-v45-connect-phone-review-repair-1";

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`Missing connect source: ${SOURCE}`);

  const trimmed = await sharp(fs.readFileSync(SOURCE))
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ height: SUBJECT_HEIGHT, fit: "inside" })
    .toBuffer({ resolveWithObject: true });

  const leftPad = Math.max(0, Math.round((CANVAS.width - trimmed.info.width) / 2));
  const topPad = Math.max(0, CANVAS.height - trimmed.info.height - BOTTOM_MARGIN);

  const output = await sharp({
    create: { width: CANVAS.width, height: CANVAS.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: trimmed.data, left: leftPad, top: topPad }])
    .webp({ quality: 88, alphaQuality: 95, effort: 6 })
    .toBuffer();
  fs.writeFileSync(OUTPUT, output);

  // manifest.version is owned by the deliberate asset-cache token bump
  // (image-sequence-v43.js PLATE_ASSET_VERSION and its mirrors); this repair
  // only refreshes the frame's byte count.
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  manifest.generatedAt = new Date().toISOString();
  const connect = manifest.scenes.connect;
  connect.frames = connect.frames.map((frame) => (frame.index === 0
    ? { ...frame, normalizedBytes: output.length }
    : frame));
  connect.normalizedBytes = connect.frames.reduce((sum, frame) => sum + Number(frame.normalizedBytes || 0), 0);
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  const contactFrames = await Promise.all(connect.frames.map((frame) => sharp(path.join(CONNECT, "normalized", frame.file))
    .resize(320, 240, { fit: "contain", background: "#a9305d" })
    .png()
    .toBuffer()));
  await sharp({ create: { width: 320 * contactFrames.length, height: 240, channels: 4, background: "#a9305d" } })
    .composite(contactFrames.map((input, index) => ({ input, left: index * 320, top: 0 })))
    .png()
    .toFile(path.join(REVIEW_ROOT, "connect-final-contact-sheet.png"));

  process.stdout.write(`${JSON.stringify({
    version: VERSION,
    placement: { left: leftPad, top: topPad, width: trimmed.info.width, height: trimmed.info.height },
    normalizedBytes: output.length,
  }, null, 2)}\n`);
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
