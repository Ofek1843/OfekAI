"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ASSET_ROOT = path.join(ROOT, "public", "assets", "athlete-motion", "v43");
const REVIEW_ROOT = path.join(ROOT, "docs", "illustration", "v43");
const MANIFEST_PATH = path.join(ASSET_ROOT, "manifest.json");
const VERSION = "20260815-real-athlete-v43-complete-1";

const SCENES = Object.freeze({
  track: { frameCount: 4, canvas: { width: 600, height: 720 }, height: 680, source: "track-progress-motion-sheet-transparent.png", contact: "track-final-contact-sheet.png" },
  connect: { frameCount: 4, canvas: { width: 760, height: 720 }, height: 680, source: "connect-social-motion-sheet-transparent.png", contact: "connect-final-contact-sheet.png" },
  coach: { frameCount: 4, canvas: { width: 600, height: 720 }, height: 680, source: "coach-plan-motion-sheet-transparent.png", contact: "coach-final-contact-sheet.png" }
});

async function removeConnectSeparators(input) {
  const meta = await sharp(input).metadata();
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cleaned = Buffer.from(data);
  for (let x = 0; x < info.width; x += 1) {
    let white = 0;
    for (let y = 0; y < info.height; y += 1) {
      const offset = (y * info.width + x) * 4;
      if (cleaned[offset] > 238 && cleaned[offset + 1] > 238 && cleaned[offset + 2] > 238 && cleaned[offset + 3] > 200) white += 1;
    }
    if (white / info.height > 0.78) {
      for (let y = 0; y < info.height; y += 1) cleaned[(y * info.width + x) * 4 + 3] = 0;
    }
  }
  const output = input.replace(/\.png$/i, "-clean.png");
  await sharp(cleaned, { raw: info }).png().toFile(output);
  return { path: output, width: meta.width, height: meta.height, bytes: fs.statSync(output).size };
}

async function splitScene(sceneName, config) {
  const sceneRoot = path.join(ASSET_ROOT, sceneName);
  const sourceRoot = path.join(sceneRoot, "final-source");
  const normalizedRoot = path.join(sceneRoot, "normalized");
  fs.mkdirSync(normalizedRoot, { recursive: true });
  const original = path.join(sourceRoot, config.source);
  const cleaned = sceneName === "connect" ? await removeConnectSeparators(original) : { path: original };
  const meta = await sharp(cleaned.path).metadata();
  if (!meta.width || !meta.height) throw new Error(`${sceneName}: missing source dimensions`);
  const frames = [];
  for (let index = 0; index < config.frameCount; index += 1) {
    const left = Math.floor(index * meta.width / config.frameCount);
    const right = Math.floor((index + 1) * meta.width / config.frameCount);
    const file = `frame-${String(index + 1).padStart(2, "0")}.png`;
    const framePath = path.join(sourceRoot, file);
    await sharp(cleaned.path).extract({ left, top: 0, width: right - left, height: meta.height }).png().toFile(framePath);
    const trimmed = await sharp(framePath).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).resize({ height: config.height, fit: "inside" }).toBuffer({ resolveWithObject: true });
    const leftPad = Math.max(0, Math.round((config.canvas.width - trimmed.info.width) / 2));
    const topPad = Math.max(0, config.canvas.height - trimmed.info.height - 10);
    const output = path.join(normalizedRoot, file.replace(/\.png$/, ".webp"));
    await sharp({ create: { width: config.canvas.width, height: config.canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: trimmed.data, left: leftPad, top: topPad }])
      .webp({ quality: 88, alphaQuality: 95, effort: 6 })
      .toFile(output);
    frames.push({ file: path.basename(output), sourceBytes: fs.statSync(framePath).size, normalizedBytes: fs.statSync(output).size, index, semantic: sceneName === "track" ? ["approach", "planted", "reading", "settled"][index] : sceneName === "connect" ? ["engage", "show-phone", "respond", "together"][index] : ["review", "raise", "tap", "ready"][index] });
  }
  const contactInputs = await Promise.all(frames.map(frame => sharp(path.join(normalizedRoot, frame.file)).resize(320, 240, { fit: "contain", background: sceneName === "track" ? "#315bff" : sceneName === "connect" ? "#a9305d" : "#147a58" }).png().toBuffer()));
  const contactPath = path.join(REVIEW_ROOT, config.contact);
  await sharp({ create: { width: config.frameCount * 320, height: 240, channels: 4, background: sceneName === "track" ? "#315bff" : sceneName === "connect" ? "#a9305d" : "#147a58" } }).composite(contactInputs.map((input, index) => ({ input, left: index * 320, top: 0 }))).png().toFile(contactPath);
  if (cleaned.path !== original) fs.rmSync(cleaned.path, { force: true });
  return { frames, motionSheetSource: `${sceneName}/final-source/${config.source}`, motionSheetSourceDimensions: { width: meta.width, height: meta.height }, motionSheetSourceBytes: fs.statSync(original).size, normalizedBytes: frames.reduce((sum, frame) => sum + frame.normalizedBytes, 0), canvas: config.canvas, contactSheet: `docs/illustration/v43/${config.contact}` };
}

async function main() {
  fs.mkdirSync(REVIEW_ROOT, { recursive: true });
  const previous = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const scenes = { ...previous.scenes };
  for (const [name, config] of Object.entries(SCENES)) scenes[name] = await splitScene(name, config);
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify({ ...previous, version: VERSION, generatedAt: new Date().toISOString(), scenes }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ version: VERSION, scenes: Object.fromEntries(Object.entries(scenes).filter(([name]) => SCENES[name])) }, null, 2)}\n`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
