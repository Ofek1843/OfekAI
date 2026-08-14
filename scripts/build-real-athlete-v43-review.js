"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const OUTPUT = path.join(ROOT, "docs", "illustration", "v43");
const CAPTURE_SOURCE = process.argv[2] ? path.resolve(process.argv[2]) : null;
const WIDTH = 960;
const HEIGHT = 660;
const GAP = 16;

const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

function loadV42Templates() {
  const window = { matchMedia: () => ({ matches: true }), setTimeout, clearTimeout };
  const document = {
    readyState: "complete",
    querySelectorAll: () => [],
    documentElement: { classList: { add() {}, toggle() {} } }
  };
  const context = vm.createContext({ window, document, console, setTimeout, clearTimeout });
  for (const file of [
    ["public", "js", "athlete-figure.js"],
    ["public", "js", "scenes", "training.js"],
    ["public", "js", "scenes", "nutrition.js"],
    ["public", "js", "scenes", "progress.js"],
    ["public", "js", "scenes", "coachsocial.js"],
    ["public", "js", "illustrated-v4.js"]
  ]) vm.runInContext(read(...file), context, { filename: file.join("/") });
  return window.__fuelPhysiqueIllustratedV4.templates;
}

async function renderV42(template, background) {
  const css = read("public", "css", "illustrated-v4.css");
  const styled = template().replace(">", `><style>${css}</style>`);
  return sharp(Buffer.from(styled))
    .resize({ width: WIDTH, height: HEIGHT, fit: "contain", background })
    .flatten({ background })
    .png()
    .toBuffer();
}

async function renderV43(scene, frame, background) {
  const input = path.join(ROOT, "public", "assets", "athlete-motion", "v43", scene, "normalized", frame);
  const fitted = await sharp(input)
    .resize({ width: WIDTH, height: HEIGHT, fit: "contain" })
    .png()
    .toBuffer();
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background } })
    .composite([{ input: fitted, gravity: "centre" }])
    .flatten({ background })
    .png()
    .toBuffer();
}

async function board(name, left, right) {
  await sharp({
    create: { width: WIDTH * 2 + GAP, height: HEIGHT, channels: 3, background: "#0f1422" }
  }).composite([
    { input: left, left: 0, top: 0 },
    { input: right, left: WIDTH + GAP, top: 0 }
  ]).png().toFile(path.join(OUTPUT, name));
}

function copyCaptures() {
  if (!CAPTURE_SOURCE || !fs.existsSync(CAPTURE_SOURCE)) return [];
  const destination = path.join(OUTPUT, "screenshots");
  fs.mkdirSync(destination, { recursive: true });
  const copied = [];
  for (const file of fs.readdirSync(CAPTURE_SOURCE).filter((name) => name.endsWith(".png"))) {
    fs.copyFileSync(path.join(CAPTURE_SOURCE, file), path.join(destination, file));
    copied.push(file);
  }
  return copied;
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const templates = loadV42Templates();
  const scenes = [
    { output: "deadlift-v42-v43-final.png", key: "deadlift", dir: "deadlift", frame: "frame-03.webp", background: "#283fa8" },
    { output: "bench-v42-v43-final.png", key: "benchPr", dir: "bench", frame: "frame-03.webp", background: "#53379b" },
    { output: "nutrition-v42-vs-v43-prototype.png", key: "nutrition", dir: "nutrition", frame: "frame-04.webp", background: "#8c5809" }
  ];
  for (const scene of scenes) {
    const before = await renderV42(templates[scene.key], scene.background);
    const after = await renderV43(scene.dir, scene.frame, scene.background);
    await board(scene.output, before, after);
  }
  const copied = copyCaptures();
  console.log(JSON.stringify({ boards: scenes.map((scene) => scene.output), copied }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
