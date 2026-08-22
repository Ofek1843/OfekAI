"use strict";

// Rebuilds the two generated cutout sequences that had residual studio matte
// pixels. Source files stay untouched; only normalized WebP derivatives and
// their review manifest entries are refreshed.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { removeConnectedWhiteBackground, alphaBounds } = require("./prepare-real-athlete-v43");

const ROOT = path.resolve(__dirname, "..");
const ASSET_ROOT = path.join(ROOT, "public", "assets", "athlete-motion", "v43");
const REVIEW_ROOT = path.join(ROOT, "docs", "illustration", "v43");
const VERSION = "20260821-v45-rtl-athlete-fix-1";

const NUTRITION_FRAMES = [
  ["utensil-near-meal", "frame-01.jpg"],
  ["food-lifted", "frame-02.jpg"],
  ["food-to-mouth", "frame-03.jpg"],
  ["bite", "frame-04.jpg"],
  ["utensil-return", "frame-05.jpg"],
];

function zeroInvisiblePixels(data, info) {
  for (let index = 0; index < info.width * info.height; index += 1) {
    const offset = index * 4;
    if (data[offset + 3] >= 16) continue;
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 0;
  }
}

function removePaleFringe(data, info) {
  const alpha = new Uint8Array(info.width * info.height);
  for (let index = 0; index < alpha.length; index += 1) alpha[index] = data[index * 4 + 3];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = y * info.width + x;
      if (alpha[index] < 16) continue;
      const offset = index * 4;
      const minimum = Math.min(data[offset], data[offset + 1], data[offset + 2]);
      const chroma = Math.max(data[offset], data[offset + 1], data[offset + 2]) - minimum;
      if (minimum < 175 || chroma > 120) continue;
      let touchesTransparency = false;
      for (let dy = -2; dy <= 2 && !touchesTransparency; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height) continue;
          if (alpha[ny * info.width + nx] < 16) { touchesTransparency = true; break; }
        }
      }
      if (!touchesTransparency) continue;
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
  }
}

async function cleanKeyed(input) {
  const keyed = await removeConnectedWhiteBackground(input, {
    // The JPEG studio background is very close to white, but its compression
    // halo is not perfectly neutral. A wider connected-edge key removes that
    // matte while the foreground remains protected by connectivity.
    backgroundMinimum: 170,
    backgroundChromaLimit: 100,
  });
  const raw = await sharp(keyed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  removePaleFringe(raw.data, raw.info);
  zeroInvisiblePixels(raw.data, raw.info);
  return sharp(raw.data, { raw: { ...raw.info, channels: 4 } }).png().toBuffer();
}

async function normalizeNutritionFrame(index, semantic, sourceFile) {
  const source = path.join(ASSET_ROOT, "nutrition", "source", sourceFile);
  const keyed = await cleanKeyed(source);
  const bounds = await alphaBounds(keyed);
  const subject = await sharp(keyed).extract(bounds).resize({ width: 820, height: 700, fit: "inside" }).png().toBuffer({ resolveWithObject: true });
  const canvas = await sharp({
    create: { width: 960, height: 720, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{
    input: subject.data,
    left: Math.max(0, Math.min(960 - subject.info.width, 180)),
    top: Math.max(0, 712 - subject.info.height),
  }]).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toBuffer();
  const outputFile = `frame-${String(index + 1).padStart(2, "0")}.webp`;
  const output = path.join(ASSET_ROOT, "nutrition", "normalized", outputFile);
  fs.writeFileSync(output, canvas);
  return { file: outputFile, semantic, sourceBytes: fs.statSync(source).size, normalizedBytes: canvas.length };
}

async function cleanSessionFrame(file) {
  const input = path.join(ASSET_ROOT, "session", "normalized", file);
  const outputDirectory = path.join(ASSET_ROOT, "session", "normalized-clean");
  fs.mkdirSync(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, file);
  const raw = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  removePaleFringe(raw.data, raw.info);
  zeroInvisiblePixels(raw.data, raw.info);
  const output = await sharp(raw.data, { raw: { ...raw.info, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toBuffer();
  const temporary = `${outputPath}.tmp`;
  fs.writeFileSync(temporary, output);
  fs.copyFileSync(temporary, outputPath);
  fs.rmSync(temporary);
  return { file, normalizedBytes: output.length, outputPath };
}

async function contactSheet(scene, files, background, outputName, width = 320, height = 240, directory = "normalized") {
  const frames = await Promise.all(files.map(async (file) => sharp(path.join(ASSET_ROOT, scene, directory, file))
    .resize(width, height, { fit: "contain" })
    .png()
    .toBuffer()));
  await sharp({ create: { width: width * files.length, height, channels: 4, background } })
    .composite(frames.map((input, index) => ({ input, left: index * width, top: 0 })))
    .png()
    .toFile(path.join(REVIEW_ROOT, outputName));
}

async function main() {
  const target = process.argv[2] || "all";
  if (!["all", "nutrition", "session"].includes(target)) throw new Error(`Unknown target: ${target}`);
  const nutrition = [];
  if (target !== "session") {
    for (let index = 0; index < NUTRITION_FRAMES.length; index += 1) {
      nutrition.push(await normalizeNutritionFrame(index, NUTRITION_FRAMES[index][0], NUTRITION_FRAMES[index][1]));
    }
  }
  const session = [];
  if (target !== "nutrition") {
    for (let index = 1; index <= 4; index += 1) session.push(await cleanSessionFrame(`frame-${String(index).padStart(2, "0")}.webp`));
  }

  const manifestPath = path.join(ASSET_ROOT, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.version = VERSION;
  manifest.generatedAt = new Date().toISOString();
  if (nutrition.length) {
    manifest.scenes.nutrition.frames = manifest.scenes.nutrition.frames.map((frame, index) => ({ ...frame, normalizedBytes: nutrition[index].normalizedBytes }));
    manifest.scenes.nutrition.normalizedBytes = nutrition.reduce((sum, frame) => sum + frame.normalizedBytes, 0);
    manifest.scenes.nutrition.contactSheet = "docs/illustration/v43/nutrition-v45-clean-contact-sheet.png";
  }
  if (session.length) {
    manifest.scenes.session.frames = manifest.scenes.session.frames.map((frame, index) => ({ ...frame, normalizedBytes: session[index].normalizedBytes }));
    manifest.scenes.session.normalizedBytes = session.reduce((sum, frame) => sum + frame.normalizedBytes, 0);
    manifest.scenes.session.contactSheet = "docs/illustration/v43/build-session-v45-clean-contact-sheet.png";
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  if (nutrition.length) await contactSheet("nutrition", nutrition.map((frame) => frame.file), "#81510f", "nutrition-v45-clean-contact-sheet.png");
  if (session.length) await contactSheet("session", session.map((frame) => frame.file), "#2741aa", "build-session-v45-clean-contact-sheet.png", 320, 300, "normalized-clean");
  console.log(JSON.stringify({ version: VERSION, nutrition, session }, null, 2));
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
