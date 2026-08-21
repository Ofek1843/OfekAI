"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ASSET_ROOT = path.join(ROOT, "public", "assets", "athlete-motion", "v43");
const MANIFEST_PATH = path.join(ASSET_ROOT, "manifest.json");
const REVIEW_ROOT = path.join(ROOT, "docs", "illustration", "v43");

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
  if (right < left || bottom < top) throw new Error(`No visible pixels in ${input}`);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function reframeDeadlift(file) {
  const input = path.join(ASSET_ROOT, "deadlift", "normalized", file);
  const source = fs.readFileSync(input);
  const bounds = await alphaBounds(source);
  const trimmed = await sharp(source).extract(bounds).resize({ width: 440, fit: "inside" }).webp({
    quality: 90,
    alphaQuality: 100,
    effort: 6,
  }).toBuffer({ resolveWithObject: true });
  const canvas = { width: 720, height: 720 };
  const left = Math.round((canvas.width - trimmed.info.width) / 2);
  const top = 700 - trimmed.info.height;
  const output = await sharp({
    create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: trimmed.data, left, top }]).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer();
  fs.writeFileSync(input, output);
  return { file, canvas, placement: { left, top, width: trimmed.info.width, height: trimmed.info.height }, bytes: fs.statSync(input).size };
}

function isNeutralWhite(data, offset) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  return data[offset + 3] > 40 && Math.min(r, g, b) >= 225 && Math.max(r, g, b) - Math.min(r, g, b) <= 34;
}

async function removeSessionFrame(file) {
  const input = path.join(ASSET_ROOT, "session", "normalized", file);
  const source = fs.readFileSync(input);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const count = info.width * info.height;
  const seen = new Uint8Array(count);
  const remove = new Uint8Array(count);
  const queue = new Uint32Array(count);
  let removedComponents = 0;

  for (let start = 0; start < count; start += 1) {
    if (seen[start] || !isNeutralWhite(data, start * 4)) continue;
    let head = 0;
    let tail = 0;
    const members = [];
    seen[start] = 1;
    queue[tail++] = start;
    while (head < tail) {
      const index = queue[head++];
      members.push(index);
      const x = index % info.width;
      const y = Math.floor(index / info.width);
      const inspect = (candidate) => {
        if (seen[candidate] || !isNeutralWhite(data, candidate * 4)) return;
        seen[candidate] = 1;
        queue[tail++] = candidate;
      };
      if (x > 0) inspect(index - 1);
      if (x + 1 < info.width) inspect(index + 1);
      if (y > 0) inspect(index - info.width);
      if (y + 1 < info.height) inspect(index + info.width);
    }
    if (members.length < 420) continue;
    removedComponents += 1;
    for (const index of members) remove[index] = 1;
  }

  // A one-pixel panel edge can survive as a separate component below the
  // area threshold. Treat only long, near-perfect neutral columns as source
  // separators; real shoes and equipment do not form a 120px straight line.
  for (let x = 0; x < info.width; x += 1) {
    const members = [];
    for (let y = 0; y < info.height; y += 1) {
      const index = y * info.width + x;
      if (isNeutralWhite(data, index * 4)) members.push(index);
    }
    if (members.length < 120) continue;
    removedComponents += 1;
    for (const index of members) remove[index] = 1;
  }

  // Remove the anti-aliased neutral fringe attached to the discarded studio
  // separator, without touching isolated shoe or equipment highlights.
  for (let pass = 0; pass < 3; pass += 1) {
    const additions = [];
    for (let index = 0; index < count; index += 1) {
      if (remove[index] || data[index * 4 + 3] < 16) continue;
      const x = index % info.width;
      const y = Math.floor(index / info.width);
      const touchesRemoved = (x > 0 && remove[index - 1])
        || (x + 1 < info.width && remove[index + 1])
        || (y > 0 && remove[index - info.width])
        || (y + 1 < info.height && remove[index + info.width]);
      if (!touchesRemoved) continue;
      const offset = index * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      if (Math.min(r, g, b) >= 170 && Math.max(r, g, b) - Math.min(r, g, b) <= 60) additions.push(index);
    }
    for (const index of additions) remove[index] = 1;
  }

  let removedPixels = 0;
  for (let index = 0; index < count; index += 1) {
    if (!remove[index]) continue;
    data[index * 4 + 3] = 0;
    removedPixels += 1;
  }
  if (!removedComponents) return { file, removedComponents: 0, removedPixels: 0, bytes: fs.statSync(input).size };
  const output = await sharp(data, { raw: info }).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer();
  fs.writeFileSync(input, output);
  return { file, removedComponents, removedPixels, bytes: fs.statSync(input).size };
}

async function contactSheet(scene, files, background, output) {
  const width = 320;
  const height = 240;
  const frames = await Promise.all(files.map((file) => sharp(path.join(ASSET_ROOT, scene, "normalized", file))
    .resize(width, height, { fit: "contain", background })
    .png()
    .toBuffer()));
  await sharp({ create: { width: width * files.length, height, channels: 4, background } })
    .composite(frames.map((input, index) => ({ input, left: index * width, top: 0 })))
    .png()
    .toFile(path.join(REVIEW_ROOT, output));
}

async function main() {
  const deadliftFiles = Array.from({ length: 5 }, (_, index) => `frame-${String(index + 1).padStart(2, "0")}.webp`);
  const sessionFiles = Array.from({ length: 4 }, (_, index) => `frame-${String(index + 1).padStart(2, "0")}.webp`);
  const deadlift = [];
  const session = [];
  const target = process.argv[2] || "all";
  if (!["all", "deadlift", "session"].includes(target)) throw new Error(`Unknown target: ${target}`);
  if (target !== "session") for (const file of deadliftFiles) deadlift.push(await reframeDeadlift(file));
  if (target !== "deadlift") for (const file of sessionFiles) session.push(await removeSessionFrame(file));

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  if (deadlift.length) {
    manifest.scenes.deadlift.canvas = { width: 720, height: 720 };
    manifest.scenes.deadlift.frames = manifest.scenes.deadlift.frames.map((frame, index) => ({
      ...frame,
      normalizedBytes: deadlift[index].bytes,
      placement: deadlift[index].placement,
    }));
    manifest.scenes.deadlift.normalizedBytes = deadlift.reduce((sum, item) => sum + item.bytes, 0);
  }
  if (session.length) {
    manifest.scenes.session.frames = manifest.scenes.session.frames.map((frame, index) => ({
      ...frame,
      normalizedBytes: session[index].bytes,
    }));
    manifest.scenes.session.normalizedBytes = session.reduce((sum, item) => sum + item.bytes, 0);
  }
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  if (deadlift.length) await contactSheet("deadlift", deadliftFiles, "#051f36", "deadlift-v45-stabilized-contact-sheet.png");
  if (session.length) await contactSheet("session", sessionFiles, "#2741aa", "build-session-v45-clean-contact-sheet.png");
  process.stdout.write(`${JSON.stringify({ deadlift, session }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
