"use strict";

// Generates a .webp sibling next to every source image under public/images.
//
// Why siblings rather than replacing the originals: server.js serves the
// .webp transparently via Accept-header negotiation (see the
// webpContentNegotiation middleware), so every existing URL, the exercise
// image resolver, the catalog's `image:` filenames, the coverage audits and
// their tests all keep working untouched. Browsers that don't advertise
// webp support still get the original PNG/JPEG.
//
// The source images are full-resolution renders (~1400x1100 PNG, ~1.15MB
// each; ~260MB across exercises + meals) but are displayed at roughly
// 650 CSS px. Downscaling to MAX_WIDTH and re-encoding as webp is what
// actually fixes the load time -- PNG is the worst possible container for
// photographic content.
//
// Idempotent: a .webp that is newer than its source is left alone, so
// re-running is cheap.

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const IMAGES_DIR = path.join(ROOT, "public", "images");

// 1000px covers a ~650px display box at ~1.5x density. Going wider costs
// bytes no current layout can use.
const MAX_WIDTH = 1000;
const WEBP_QUALITY = 82;
const SOURCE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

function isUpToDate(sourcePath, webpPath) {
  if (!fs.existsSync(webpPath)) return false;
  return fs.statSync(webpPath).mtimeMs >= fs.statSync(sourcePath).mtimeMs;
}

async function main() {
  const force = process.argv.includes("--force");
  const sources = [...walk(IMAGES_DIR)].filter((file) =>
    SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase())
  );

  let converted = 0;
  let skipped = 0;
  let sourceBytes = 0;
  let webpBytes = 0;

  for (const source of sources) {
    const webpPath = `${source.replace(/\.[^.]+$/, "")}.webp`;
    sourceBytes += fs.statSync(source).size;

    if (!force && isUpToDate(source, webpPath)) {
      webpBytes += fs.statSync(webpPath).size;
      skipped += 1;
      continue;
    }

    const image = sharp(source);
    const { width } = await image.metadata();
    await image
      .resize({ width: Math.min(width || MAX_WIDTH, MAX_WIDTH), withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(webpPath);

    webpBytes += fs.statSync(webpPath).size;
    converted += 1;
  }

  const mb = (bytes) => `${(bytes / 1048576).toFixed(1)}MB`;
  const saved = sourceBytes - webpBytes;
  console.log("Image optimization");
  console.log(
    JSON.stringify(
      {
        sourceImages: sources.length,
        converted,
        skippedUpToDate: skipped,
        sourceTotal: mb(sourceBytes),
        webpTotal: mb(webpBytes),
        saved: mb(saved),
        savedPercent: sourceBytes ? `${((saved / sourceBytes) * 100).toFixed(1)}%` : "0%"
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
