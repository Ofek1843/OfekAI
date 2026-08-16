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
    if (touchesEdge || members.length >= 24) {
      for (const index of members) background[index] = 1;
    }
  };
  for (let index = 0; index < count; index += 1) visitComponent(index);

  const rgba = Buffer.alloc(count * 4);
  for (let i = 0; i < count; i += 1) {
    const source = i * 3;
    const target = i * 4;
    rgba[target] = data[source];
    rgba[target + 1] = data[source + 1];
    rgba[target + 2] = data[source + 2];
    rgba[target + 3] = background[i] ? 0 : 255;
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
  const sourceStat = fs.statSync(SOURCE);
  const outputStat = fs.statSync(OUTPUT);
  const metadata = await sharp(OUTPUT).metadata();
  console.log(JSON.stringify({ source: path.relative(ROOT, SOURCE), output: path.relative(ROOT, OUTPUT), sourceBytes: sourceStat.size, normalizedBytes: outputStat.size, width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
