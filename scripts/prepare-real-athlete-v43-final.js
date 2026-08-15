"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const {
  ROOT,
  ASSET_ROOT,
  REVIEW_ROOT,
  CANVAS,
  SCENES,
  normalizeFrame,
  contactSheet
} = require("./prepare-real-athlete-v43");

const VERSION = "20260815-real-athlete-v43-complete-2";
const DEADLIFT_DIRECTORY = path.join(ASSET_ROOT, "deadlift", "final-source");
const DEADLIFT_SHEET = path.join(DEADLIFT_DIRECTORY, "deadlift-motion-sheet.png");
const BENCH_DIRECTORY = path.join(ASSET_ROOT, "bench", "final-source");
const MANIFEST_PATH = path.join(ASSET_ROOT, "manifest.json");

const DEADLIFT_FRAMES = Object.freeze([
  { file: "frame-01.png", semantic: "setup", width: 360, x: 300, bottom: 720 },
  { file: "frame-02.png", semantic: "early-pull", width: 360, x: 300, bottom: 720 },
  { file: "frame-03.png", semantic: "lockout", width: 360, x: 300, bottom: 720 },
  { file: "frame-04.png", semantic: "controlled-descent", width: 360, x: 300, bottom: 720 },
  { file: "frame-05.png", semantic: "return-to-setup", width: 360, x: 300, bottom: 720 }
]);

async function splitDeadliftSheet() {
  const metadata = await sharp(DEADLIFT_SHEET).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Deadlift motion sheet dimensions are unavailable");
  const frames = [];
  for (let index = 0; index < DEADLIFT_FRAMES.length; index += 1) {
    const left = Math.floor(index * metadata.width / DEADLIFT_FRAMES.length);
    const right = Math.floor((index + 1) * metadata.width / DEADLIFT_FRAMES.length);
    const output = path.join(DEADLIFT_DIRECTORY, DEADLIFT_FRAMES[index].file);
    await sharp(DEADLIFT_SHEET)
      .extract({ left, top: 0, width: right - left, height: metadata.height })
      .png()
      .toFile(output);
    frames.push({ file: DEADLIFT_FRAMES[index].file, left, right, width: right - left, height: metadata.height, bytes: fs.statSync(output).size });
  }
  return { width: metadata.width, height: metadata.height, bytes: fs.statSync(DEADLIFT_SHEET).size, frames };
}

async function main() {
  fs.mkdirSync(REVIEW_ROOT, { recursive: true });
  const previous = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const sheet = await splitDeadliftSheet();
  const deadliftFrames = [];
  for (let index = 0; index < DEADLIFT_FRAMES.length; index += 1) {
    deadliftFrames.push(await normalizeFrame("deadlift", DEADLIFT_FRAMES[index], index, {
      sourceDirectory: "final-source",
      preserveFullFrame: true,
      edgeInsetX: 8,
      backgroundMinimum: 210,
      backgroundChromaLimit: 64,
      hardBackgroundTransparency: true,
      minimumForegroundComponent: 200
    }));
  }

  const benchFrames = [];
  for (let index = 0; index < SCENES.bench.frames.length; index += 1) {
    if (index === 2) {
      benchFrames.push(await normalizeFrame("bench", {
        file: "frame-03.png",
        semantic: "bottom-lower-mid-chest",
        width: 920,
        x: 20,
        bottom: 704
      }, index, { sourceDirectory: "final-source" }));
      continue;
    }
    benchFrames.push(await normalizeFrame("bench", SCENES.bench.frames[index], index));
  }

  const nutritionFrames = [];
  for (let index = 0; index < SCENES.nutrition.frames.length; index += 1) {
    nutritionFrames.push(await normalizeFrame("nutrition", SCENES.nutrition.frames[index], index));
  }

  const deadliftContactSheet = await contactSheet("deadlift", "#203a9c", deadliftFrames.length, "deadlift-final-5-frame-contact-sheet.png");
  const benchContactSheet = await contactSheet("bench", "#4b338f", benchFrames.length, "bench-final-contact-sheet.png");
  const nutritionContactSheet = await contactSheet("nutrition", "#81510f", nutritionFrames.length, "nutrition-final-contact-sheet.png");

  const manifest = {
    ...previous,
    version: VERSION,
    generatedAt: new Date().toISOString(),
    scenes: {
      ...previous.scenes,
      deadlift: {
        frames: deadliftFrames,
        motionSheetSource: path.relative(ROOT, DEADLIFT_SHEET).replaceAll("\\", "/"),
        motionSheetSourceDimensions: { width: sheet.width, height: sheet.height },
        motionSheetSourceBytes: sheet.bytes,
        splitFrames: sheet.frames,
        splitSourceBytes: sheet.frames.reduce((sum, frame) => sum + frame.bytes, 0),
        normalizedBytes: deadliftFrames.reduce((sum, frame) => sum + frame.normalizedBytes, 0),
        contactSheet: path.relative(ROOT, deadliftContactSheet).replaceAll("\\", "/")
      },
      bench: {
        ...previous.scenes.bench,
        frames: benchFrames,
        correctedFrameSource: path.relative(ROOT, path.join(BENCH_DIRECTORY, "frame-03.png")).replaceAll("\\", "/"),
        correctedFrameSourceBytes: fs.statSync(path.join(BENCH_DIRECTORY, "frame-03.png")).size,
        sourceBytes: benchFrames.reduce((sum, frame) => sum + frame.sourceBytes, 0),
        normalizedBytes: benchFrames.reduce((sum, frame) => sum + frame.normalizedBytes, 0),
        contactSheet: path.relative(ROOT, benchContactSheet).replaceAll("\\", "/")
      },
      nutrition: {
        ...previous.scenes.nutrition,
        frames: nutritionFrames,
        sourceBytes: nutritionFrames.reduce((sum, frame) => sum + frame.sourceBytes, 0),
        normalizedBytes: nutritionFrames.reduce((sum, frame) => sum + frame.normalizedBytes, 0),
        contactSheet: path.relative(ROOT, nutritionContactSheet).replaceAll("\\", "/")
      }
    }
  };
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
