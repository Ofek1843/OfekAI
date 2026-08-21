"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "public", "assets", "athlete-motion", "v43", "plate", "final-source", "frame-04-regenerated.png");
const ORIGINAL = path.join(ROOT, "public", "assets", "athlete-motion", "v43", "plate", "final-source", "frame-04.png");
const OUTPUT = path.join(ROOT, "public", "assets", "athlete-motion", "v43", "plate", "normalized", "frame-04.webp");

function isNeutralBackdrop(data, offset) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  return Math.min(r, g, b) >= 180 && Math.max(r, g, b) - Math.min(r, g, b) <= 24;
}

async function removeCheckerboard(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const count = info.width * info.height;
  const background = new Uint8Array(count);
  const visited = new Uint8Array(count);
  const queue = new Uint32Array(count);
  const neighbors = [-1, 0, 1];
  const visitComponent = (start) => {
    if (visited[start] || !isNeutralBackdrop(data, start * 3)) return;
    visited[start] = 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    const members = [];
    let touchesEdge = false;
    while (head < tail) {
      const index = queue[head++];
      const x = index % info.width;
      const y = Math.floor(index / info.width);
      touchesEdge ||= x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1;
      members.push(index);
      for (const dy of neighbors) {
        for (const dx of neighbors) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height) continue;
          const next = ny * info.width + nx;
          if (visited[next] || !isNeutralBackdrop(data, next * 3)) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    // The generated source contains a baked checkerboard rather than real
    // transparency. The arm/bowl pose encloses a few background islands, so
    // sufficiently large neutral components are background even when they do
    // not touch the canvas edge. Small neutral subject details survive, while
    // shoes are restored from the known transparent source below.
    if (touchesEdge || members.length >= 24) {
      for (const index of members) background[index] = 1;
    }
  };
  for (let index = 0; index < count; index += 1) visitComponent(index);

  // The first version converted every surviving pixel to fully opaque. That
  // preserved the anti-aliased checkerboard mixed into the source edge and
  // produced a pale waist/hip flash on the amber card. Build a small feathered
  // matte from the actual background boundary and borrow colour from the
  // nearest interior pixel for the feather. This removes the baked neutral
  // fringe without globally keying white details out of the athlete.
  const distanceToBackground = new Uint8Array(count);
  const radius = 4;
  for (let index = 0; index < count; index += 1) {
    if (background[index]) continue;
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    let nearest = radius + 1;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height) continue;
        if (!background[ny * info.width + nx]) continue;
        nearest = Math.min(nearest, Math.max(Math.abs(dx), Math.abs(dy)));
      }
    }
    distanceToBackground[index] = nearest;
  }

  const nearestInterior = (x, y) => {
    for (let searchRadius = 1; searchRadius <= 5; searchRadius += 1) {
      for (let dy = -searchRadius; dy <= searchRadius; dy += 1) {
        for (let dx = -searchRadius; dx <= searchRadius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height) continue;
          const candidate = ny * info.width + nx;
          if (!background[candidate] && distanceToBackground[candidate] >= 4) return candidate;
        }
      }
    }
    return y * info.width + x;
  };

  const rgba = Buffer.alloc(count * 4);
  for (let i = 0; i < count; i += 1) {
    const source = i * 3;
    const target = i * 4;
    if (background[i]) {
      rgba[target + 3] = 0;
      continue;
    }
    const distance = distanceToBackground[i];
    const edgePixel = distance > 0 && distance < 4;
    const colourIndex = edgePixel
      ? nearestInterior(i % info.width, Math.floor(i / info.width)) * 3
      : source;
    rgba[target] = data[colourIndex];
    rgba[target + 1] = data[colourIndex + 1];
    rgba[target + 2] = data[colourIndex + 2];
    rgba[target + 3] = distance === 1 ? 32 : distance === 2 ? 112 : distance === 3 ? 204 : 255;
  }
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function main() {
  if (!fs.existsSync(SOURCE) || !fs.existsSync(ORIGINAL)) throw new Error("Nutrition hero source files are missing");
  const cleaned = await removeCheckerboard(SOURCE);
  const trimmed = await sharp(cleaned)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ height: 680, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });
  const shoeLeft = await sharp(ORIGINAL).extract({ left: 60, top: 790, width: 120, height: 80 }).resize({ width: 86, height: 72, fit: "inside" }).png().toBuffer();
  const shoeRight = await sharp(ORIGINAL).extract({ left: 245, top: 790, width: 120, height: 80 }).resize({ width: 86, height: 72, fit: "inside" }).png().toBuffer();
  const clearFoot = await sharp({ create: { width: 110, height: 120, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
  const canvasWidth = 600;
  const canvasHeight = 720;
  const left = Math.max(0, Math.round((canvasWidth - trimmed.info.width) / 2));
  const top = Math.max(0, canvasHeight - trimmed.info.height - 10);
  await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: trimmed.data, left, top },
      { input: clearFoot, left: 184, top: 608, blend: "dest-out" },
      { input: clearFoot, left: 340, top: 608, blend: "dest-out" },
      { input: shoeLeft, left: 196, top: 612 },
      { input: shoeRight, left: 350, top: 612 },
    ])
    .webp({ quality: 88, alphaQuality: 100, effort: 6 })
    .toFile(OUTPUT);
  const manifestPath = path.join(ROOT, "public", "assets", "athlete-motion", "v43", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.scenes.plate.frames[3].normalizedBytes = fs.statSync(OUTPUT).size;
  manifest.scenes.plate.normalizedBytes = manifest.scenes.plate.frames.reduce((sum, frame) => sum + frame.normalizedBytes, 0);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const sourceStat = fs.statSync(SOURCE);
  const outputStat = fs.statSync(OUTPUT);
  const metadata = await sharp(OUTPUT).metadata();
  console.log(JSON.stringify({ source: path.relative(ROOT, SOURCE), output: path.relative(ROOT, OUTPUT), sourceBytes: sourceStat.size, normalizedBytes: outputStat.size, width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
