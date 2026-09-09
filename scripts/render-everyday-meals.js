// Raster derivatives preserve the existing meal PNG/WebP delivery contract.
const path = require("node:path");
const sharp = require("sharp");
const meals = require("../lib/everyday-meals");
async function main() {
  for (const { id } of meals) {
    const base = path.join(__dirname, "..", "public", "images", "meals", id);
    await sharp(`${base}.svg`).resize(640, 520).png().toFile(`${base}.png`);
    await sharp(`${base}.svg`).resize(640, 520).webp({ quality: 85 }).toFile(`${base}.webp`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
