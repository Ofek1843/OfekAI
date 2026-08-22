"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "public", "assets", "athlete-motion", "v43", "plate", "final-source", "frame-04-regenerated.png");
const OUTPUT = path.join(ROOT, "public", "assets", "athlete-motion", "v43", "plate", "normalized", "frame-04.webp");

function isBakedCheckerPixel(r, g, b) {
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  return maximum - minimum <= 12 && maximum >= 226 && minimum >= 218;
}

function isNeutralMatte(data, offset) {
  const maximum = Math.max(data[offset], data[offset + 1], data[offset + 2]);
  const minimum = Math.min(data[offset], data[offset + 1], data[offset + 2]);
  return minimum > 220 && maximum - minimum < 24;
}

function touchesTransparent(data, info, x, y, radius = 1) {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height) continue;
      if (data[(ny * info.width + nx) * 4 + 3] === 0) return true;
    }
  }
  return false;
}

function clearNeutralEdgeMatte(data, info) {
  for (let pass = 0; pass < 4; pass += 1) {
    const toClear = [];
    for (let y = 1; y < info.height - 1; y += 1) {
      for (let x = 1; x < info.width - 1; x += 1) {
        const offset = (y * info.width + x) * 4;
        if (data[offset + 3] === 0 || !isNeutralMatte(data, offset)) continue;
        const inShoeArea = y > 590 && ((x > 100 && x < 285) || (x > 315 && x < 525));
        if (inShoeArea) continue;
        if (!touchesTransparent(data, info, x, y, 2)) continue;
        toClear.push(offset);
      }
    }
    for (const offset of toClear) data[offset + 3] = 0;
    if (!toClear.length) break;
  }
}

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error("Nutrition hero source file is missing");

  const source = await sharp(SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sourceRgba = Buffer.alloc(source.info.width * source.info.height * 4);
  for (let y = 0; y < source.info.height; y += 1) {
    for (let x = 0; x < source.info.width; x += 1) {
      const sourceOffset = (y * source.info.width + x) * 3;
      const targetOffset = (y * source.info.width + x) * 4;
      const r = source.data[sourceOffset];
      const g = source.data[sourceOffset + 1];
      const b = source.data[sourceOffset + 2];
      sourceRgba[targetOffset] = r;
      sourceRgba[targetOffset + 1] = g;
      sourceRgba[targetOffset + 2] = b;
      sourceRgba[targetOffset + 3] = isBakedCheckerPixel(r, g, b) ? 0 : 255;
    }
  }

  const resized = await sharp(sourceRgba, { raw: { ...source.info, channels: 4 } })
    .resize({ width: 560, height: 688, fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const canvasWidth = 600;
  const canvasHeight = 720;
  const left = Math.max(0, Math.round((canvasWidth - resized.info.width) / 2));
  const top = Math.max(0, canvasHeight - resized.info.height - 10);
  const finalImage = await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(resized.data, { raw: { ...resized.info, channels: 4 } }).png().toBuffer(), left, top }])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let y = 1; y < finalImage.info.height - 1; y += 1) {
    for (let x = 1; x < finalImage.info.width - 1; x += 1) {
      const rightPanel = x > 405;
      const topPanel = x > 360 && y < 180;
      const betweenLegs = x > 245 && x < 350 && y > 485;
      if (!rightPanel && !topPanel && !betweenLegs) continue;
      finalImage.data[(y * finalImage.info.width + x) * 4 + 3] = 0;
    }
  }
  clearNeutralEdgeMatte(finalImage.data, finalImage.info);
  await sharp(finalImage.data, { raw: { ...finalImage.info, channels: 4 } })
    .webp({ lossless: true, alphaQuality: 100, effort: 6 })
    .toFile(OUTPUT);

  const manifestPath = path.join(ROOT, "public", "assets", "athlete-motion", "v43", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.scenes.plate.frames[3].normalizedBytes = fs.statSync(OUTPUT).size;
  manifest.scenes.plate.normalizedBytes = manifest.scenes.plate.frames.reduce((sum, frame) => sum + frame.normalizedBytes, 0);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const sourceStat = fs.statSync(SOURCE);
  const outputStat = fs.statSync(OUTPUT);
  const metadata = await sharp(OUTPUT).metadata();
  console.log(JSON.stringify({
    source: path.relative(ROOT, SOURCE),
    output: path.relative(ROOT, OUTPUT),
    sourceBytes: sourceStat.size,
    normalizedBytes: outputStat.size,
    width: metadata.width,
    height: metadata.height,
    hasAlpha: metadata.hasAlpha,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
