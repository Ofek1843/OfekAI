"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ASSET_ROOT = path.join(ROOT, "public", "assets", "athlete-motion", "v43");
const REVIEW_ROOT = path.join(ROOT, "docs", "illustration", "v43");
const CANVAS = Object.freeze({ width: 960, height: 720 });

const SCENES = Object.freeze({
  deadlift: {
    surface: "#203a9c",
    frames: [
      { file: "frame-01.jpg", semantic: "setup", height: 660, x: 50, bottom: 710 },
      { file: "frame-02.jpg", semantic: "early-pull", height: 690, x: 190, bottom: 710 },
      { file: "frame-03.jpg", semantic: "lockout", height: 690, x: 195, bottom: 710 },
      { file: "frame-04.jpg", semantic: "controlled-descent", height: 690, x: 188, bottom: 710 }
    ]
  },
  bench: {
    surface: "#4b338f",
    frames: [
      { file: "frame-01.jpg", semantic: "lockout", width: 920, x: 20, bottom: 704 },
      { file: "frame-02.jpg", semantic: "controlled-descent", width: 920, x: 20, bottom: 704 },
      { file: "frame-03.jpg", semantic: "bottom-high-neck", width: 920, x: 20, bottom: 704 },
      { file: "frame-04.jpg", semantic: "mid-press", width: 920, x: 20, bottom: 704 }
    ]
  },
  nutrition: {
    surface: "#81510f",
    frames: [
      { file: "frame-01.jpg", semantic: "utensil-near-meal", width: 820, x: 180, bottom: 712 },
      { file: "frame-02.jpg", semantic: "food-lifted", width: 820, x: 180, bottom: 712 },
      { file: "frame-03.jpg", semantic: "food-to-mouth", width: 820, x: 180, bottom: 712 },
      { file: "frame-04.jpg", semantic: "bite", width: 820, x: 180, bottom: 712 },
      { file: "frame-05.jpg", semantic: "utensil-return", width: 820, x: 180, bottom: 712 }
    ]
  }
});

function isBackgroundPixel(data, offset) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= 230 && max - min <= 28;
}

async function removeConnectedWhiteBackground(input) {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const count = info.width * info.height;
  const visited = new Uint8Array(count);
  const queue = new Uint32Array(count);
  let head = 0;
  let tail = 0;

  const enqueue = (index) => {
    if (visited[index] || !isBackgroundPixel(data, index * 3)) return;
    visited[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < info.width; x += 1) {
    enqueue(x);
    enqueue((info.height - 1) * info.width + x);
  }
  for (let y = 1; y < info.height - 1; y += 1) {
    enqueue(y * info.width);
    enqueue(y * info.width + info.width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < info.width) enqueue(index + 1);
    if (y > 0) enqueue(index - info.width);
    if (y + 1 < info.height) enqueue(index + info.width);
  }

  // Pull the matte one or two pixels into pale JPEG edge contamination.
  // This removes the white fringe without globally keying white shoe soles,
  // plate highlights, glass reflections, or food details.
  const edgeDepth = new Uint8Array(count);
  for (let depth = 1; depth <= 2; depth += 1) {
    const additions = [];
    for (let index = 0; index < count; index += 1) {
      if (visited[index]) continue;
      const x = index % info.width;
      const y = Math.floor(index / info.width);
      const touchesMatte = (x > 0 && visited[index - 1])
        || (x + 1 < info.width && visited[index + 1])
        || (y > 0 && visited[index - info.width])
        || (y + 1 < info.height && visited[index + info.width]);
      if (!touchesMatte) continue;
      const offset = index * 3;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      if (Math.min(r, g, b) >= 205 && Math.max(r, g, b) - Math.min(r, g, b) <= 50) additions.push(index);
    }
    for (const index of additions) {
      visited[index] = 1;
      edgeDepth[index] = depth;
    }
  }

  const rgba = Buffer.allocUnsafe(count * 4);
  for (let index = 0; index < count; index += 1) {
    const source = index * 3;
    const target = index * 4;
    const r = data[source];
    const g = data[source + 1];
    const b = data[source + 2];
    rgba[target] = r;
    rgba[target + 1] = g;
    rgba[target + 2] = b;
    if (!visited[index]) {
      rgba[target + 3] = 255;
      continue;
    }
    const average = (r + g + b) / 3;
    const alpha = edgeDepth[index]
      ? (245 - average) * (255 / 40)
      : (248 - average) * (255 / 13);
    rgba[target + 3] = Math.max(0, Math.min(255, Math.round(alpha)));
  }

  return sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 }
  }).png().toBuffer();
}

async function alphaBounds(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] < 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error("No visible subject after background removal");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function normalizeFrame(sceneName, frame, index, options = {}) {
  const sourceDirectory = options.sourceDirectory || "source";
  const outputDirectory = options.outputDirectory || "normalized";
  const source = path.join(ASSET_ROOT, sceneName, sourceDirectory, frame.file);
  const keyed = await removeConnectedWhiteBackground(source);
  const keyedMeta = await sharp(keyed).metadata();
  const edgeInsetX = options.preserveFullFrame ? Math.max(0, options.edgeInsetX || 0) : 0;
  const edgeInsetY = options.preserveFullFrame ? Math.max(0, options.edgeInsetY || 0) : 0;
  const bounds = options.preserveFullFrame
    ? {
      left: edgeInsetX,
      top: edgeInsetY,
      width: keyedMeta.width - edgeInsetX * 2,
      height: keyedMeta.height - edgeInsetY * 2
    }
    : await alphaBounds(keyed);
  const subject = options.preserveFullFrame && edgeInsetX === 0 && edgeInsetY === 0
    ? sharp(keyed)
    : sharp(keyed).extract(bounds);
  const resize = frame.width
    ? { width: frame.width, height: CANVAS.height }
    : { width: CANVAS.width, height: frame.height };
  const resized = await subject.resize({ ...resize, fit: "inside", withoutEnlargement: false }).png().toBuffer();
  const resizedMeta = await sharp(resized).metadata();
  const left = Math.max(0, Math.min(CANVAS.width - resizedMeta.width, frame.x));
  const top = Math.max(0, Math.min(CANVAS.height - resizedMeta.height, frame.bottom - resizedMeta.height));
  const canvas = await sharp({
    create: { width: CANVAS.width, height: CANVAS.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).composite([{ input: resized, left, top }]).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toBuffer();
  const outputName = `frame-${String(index + 1).padStart(2, "0")}.webp`;
  const output = path.join(ASSET_ROOT, sceneName, outputDirectory, outputName);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, canvas);
  return {
    file: outputName,
    semantic: frame.semantic,
    sourceBytes: fs.statSync(source).size,
    normalizedBytes: canvas.length,
    sourceBounds: bounds,
    placement: { left, top, width: resizedMeta.width, height: resizedMeta.height }
  };
}

async function contactSheet(sceneName, surface, frameCount, outputName = `${sceneName}-normalized-contact-sheet.png`) {
  const columns = Math.min(4, frameCount);
  const rows = Math.ceil(frameCount / columns);
  const cellWidth = 480;
  const cellHeight = 360;
  const gap = 18;
  const width = columns * cellWidth + (columns + 1) * gap;
  const height = rows * cellHeight + (rows + 1) * gap;
  const composites = [];
  for (let index = 0; index < frameCount; index += 1) {
    const frame = path.join(ASSET_ROOT, sceneName, "normalized", `frame-${String(index + 1).padStart(2, "0")}.webp`);
    const rendered = await sharp({
      create: { width: cellWidth, height: cellHeight, channels: 4, background: surface }
    }).composite([{ input: await sharp(frame).resize(cellWidth, cellHeight, { fit: "contain" }).png().toBuffer() }]).png().toBuffer();
    composites.push({
      input: rendered,
      left: gap + (index % columns) * (cellWidth + gap),
      top: gap + Math.floor(index / columns) * (cellHeight + gap)
    });
  }
  const output = path.join(REVIEW_ROOT, outputName);
  await sharp({ create: { width, height, channels: 4, background: "#101420" } }).composite(composites).png().toFile(output);
  return output;
}

async function main() {
  fs.mkdirSync(REVIEW_ROOT, { recursive: true });
  const manifest = {
    version: "20260814-real-athlete-v43-prototype",
    canvas: CANVAS,
    generatedAt: new Date().toISOString(),
    scenes: {}
  };
  for (const [sceneName, scene] of Object.entries(SCENES)) {
    const frames = [];
    for (let index = 0; index < scene.frames.length; index += 1) {
      frames.push(await normalizeFrame(sceneName, scene.frames[index], index));
    }
    manifest.scenes[sceneName] = {
      frames,
      sourceBytes: frames.reduce((sum, frame) => sum + frame.sourceBytes, 0),
      normalizedBytes: frames.reduce((sum, frame) => sum + frame.normalizedBytes, 0),
      contactSheet: path.relative(ROOT, await contactSheet(sceneName, scene.surface, frames.length)).replaceAll("\\", "/")
    };
  }
  fs.writeFileSync(path.join(ASSET_ROOT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  ROOT,
  ASSET_ROOT,
  REVIEW_ROOT,
  CANVAS,
  removeConnectedWhiteBackground,
  alphaBounds,
  normalizeFrame,
  contactSheet
});
