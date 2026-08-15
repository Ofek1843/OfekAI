"use strict";

const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const DIRECTORY = path.join(ROOT, "public", "assets", "athlete-motion", "v43", "deadlift", "normalized");
const CLEAN_DIRECTORY = path.join(ROOT, "public", "assets", "athlete-motion", "v43", "deadlift", "normalized-clean");

function isTransparentNeighbor(data, info, x, y) {
  const alpha = (candidateX, candidateY) => {
    if (candidateX < 0 || candidateY < 0 || candidateX >= info.width || candidateY >= info.height) return 0;
    return data[(candidateY * info.width + candidateX) * 4 + 3];
  };
  return alpha(x - 1, y) < 28 || alpha(x + 1, y) < 28 || alpha(x, y - 1) < 28 || alpha(x, y + 1) < 28;
}

async function clean(file) {
  const source = path.join(DIRECTORY, file);
  const target = path.join(CLEAN_DIRECTORY, file);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let removed = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      const alpha = data[offset + 3];
      if (alpha < 28 || !isTransparentNeighbor(data, info, x, y)) continue;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const minimum = Math.min(r, g, b);
      const maximum = Math.max(r, g, b);
      const chroma = maximum - minimum;
      // The source was white-background photography. Neutral, high-value
      // silhouette pixels are matte contamination, while warmer pixels are
      // retained so skin, shoe highlights and metal reflections survive.
      if (minimum >= 214 && chroma <= 18) {
        data[offset + 3] = 0;
        removed += 1;
      } else if (minimum >= 188 && chroma <= 24) {
        data[offset + 3] = Math.min(alpha, Math.max(0, Math.round((255 - minimum) * 2.2)));
        removed += 1;
      }
    }
  }
  fs.mkdirSync(CLEAN_DIRECTORY, { recursive: true });
  await sharp(data, { raw: info }).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(target);
  return removed;
}

async function main() {
  const files = Array.from({ length: 5 }, (_, index) => `frame-${String(index + 1).padStart(2, "0")}.webp`);
  const removed = {};
  for (const file of files) removed[file] = await clean(file);
  process.stdout.write(`${JSON.stringify(removed, null, 2)}\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
