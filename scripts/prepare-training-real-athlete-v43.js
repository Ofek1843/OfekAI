"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ASSET_ROOT = path.join(ROOT, "public", "assets", "athlete-motion", "v43");
const TRAINING_ROOT = path.join(ASSET_ROOT, "training");
const SOURCE_ROOT = path.join(TRAINING_ROOT, "final-source");
const NORMALIZED_ROOT = path.join(TRAINING_ROOT, "normalized");
const REVIEW_ROOT = path.join(ROOT, "docs", "illustration", "v43");
const MANIFEST_PATH = path.join(ASSET_ROOT, "manifest.json");
const VERSION = "20260815-real-athlete-v43-complete-1";
// The source panels are portrait-oriented. A narrower transparent canvas keeps
// the full athlete readable inside the card instead of wasting half the stage
// on empty horizontal padding.
const CANVAS = { width: 600, height: 720 };
const FRAME_COUNT = 5;
const SHEET = path.join(SOURCE_ROOT, "training-curl-motion-sheet-transparent.png");

async function splitSheet() {
  const meta = await sharp(SHEET).metadata();
  if (!meta.width || !meta.height) throw new Error("Training sheet dimensions unavailable");
  const frames = [];
  for (let index = 0; index < FRAME_COUNT; index += 1) {
    const left = Math.floor(index * meta.width / FRAME_COUNT);
    const right = Math.floor((index + 1) * meta.width / FRAME_COUNT);
    const file = `frame-${String(index + 1).padStart(2, "0")}.png`;
    const output = path.join(SOURCE_ROOT, file);
    await sharp(SHEET).extract({ left, top: 0, width: right - left, height: meta.height }).png().toFile(output);
    frames.push({ file, left, right, width: right - left, height: meta.height, bytes: fs.statSync(output).size });
  }
  return { width: meta.width, height: meta.height, bytes: fs.statSync(SHEET).size, frames };
}

async function normalizeFrame(file, index) {
  const source = path.join(SOURCE_ROOT, file);
  const output = path.join(NORMALIZED_ROOT, file.replace(/\.png$/i, ".webp"));
  const pipeline = sharp(source).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).resize({ height: 680, fit: "inside", withoutEnlargement: false });
  const image = await pipeline.toBuffer({ resolveWithObject: true });
  const left = Math.max(0, Math.round((CANVAS.width - image.info.width) / 2));
  const top = Math.max(0, CANVAS.height - image.info.height - 10);
  await sharp({
    create: { width: CANVAS.width, height: CANVAS.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).composite([{ input: image.data, left, top }]).webp({ quality: 88, alphaQuality: 95, effort: 6 }).toFile(output);
  return { file: output.split(path.sep).pop(), sourceBytes: fs.statSync(source).size, normalizedBytes: fs.statSync(output).size, index };
}

async function contactSheet() {
  const files = await Promise.all(Array.from({ length: FRAME_COUNT }, (_, index) => sharp(path.join(NORMALIZED_ROOT, `frame-${String(index + 1).padStart(2, "0")}.webp`)).resize(320, 240, { fit: "contain", background: { r: 49, g: 91, b: 255, alpha: 1 } }).png().toBuffer()));
  const composites = files.map((input, index) => ({ input, left: index * 320, top: 0 }));
  const output = path.join(REVIEW_ROOT, "training-final-contact-sheet.png");
  await sharp({ create: { width: FRAME_COUNT * 320, height: 240, channels: 4, background: "#315bff" } }).composite(composites).png().toFile(output);
  return path.relative(ROOT, output).replaceAll("\\", "/");
}

async function main() {
  fs.mkdirSync(NORMALIZED_ROOT, { recursive: true });
  fs.mkdirSync(REVIEW_ROOT, { recursive: true });
  const sheet = await splitSheet();
  const frames = [];
  for (let index = 0; index < FRAME_COUNT; index += 1) frames.push(await normalizeFrame(`frame-${String(index + 1).padStart(2, "0")}.png`, index));
  const contact = await contactSheet();
  const previous = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const manifest = {
    ...previous,
    version: VERSION,
    generatedAt: new Date().toISOString(),
    scenes: {
      ...previous.scenes,
      training: {
        frames,
        motionSheetSource: "training/final-source/training-curl-motion-sheet-transparent.png",
        motionSheetSourceDimensions: { width: sheet.width, height: sheet.height },
        motionSheetSourceBytes: sheet.bytes,
        splitFrames: sheet.frames,
        splitSourceBytes: sheet.frames.reduce((sum, frame) => sum + frame.bytes, 0),
        normalizedBytes: frames.reduce((sum, frame) => sum + frame.normalizedBytes, 0),
        contactSheet: contact
      }
    }
  };
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(manifest.scenes.training, null, 2)}\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
