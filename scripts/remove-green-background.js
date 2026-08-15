"use strict";

const fs = require("fs");
const sharp = require("sharp");

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: node scripts/remove-green-background.js INPUT OUTPUT");

(async () => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  const separator = new Uint8Array(info.width);
  for (let x = 0; x < info.width; x += 1) {
    let white = 0;
    for (let y = 0; y < info.height; y += 1) {
      const offset = (y * info.width + x) * 4;
      if (out[offset] > 245 && out[offset + 1] > 245 && out[offset + 2] > 245 && out[offset + 3] > 220) white += 1;
    }
    separator[x] = white / info.height > 0.7 ? 1 : 0;
  }
  for (let i = 0; i < out.length; i += 4) {
    const x = (i / 4) % info.width;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const green = g - Math.max(r, b);
    if (separator[x] || (green >= 90 && g >= 150)) {
      out[i + 3] = 0;
      continue;
    }
    if (green > 12) {
      const alpha = Math.max(0, Math.min(255, Math.round(255 - green * 5.4)));
      const factor = alpha / 255;
      out[i] = Math.min(255, Math.round(r / Math.max(factor, 0.18)));
      out[i + 1] = Math.min(255, Math.round((g - (g - Math.max(r, b)) * (1 - factor)) / Math.max(factor, 0.18)));
      out[i + 2] = Math.min(255, Math.round(b / Math.max(factor, 0.18)));
      out[i + 3] = alpha;
    }
  }
  await sharp(out, { raw: info }).png().toFile(output);
  console.log(JSON.stringify({ input, output, width: info.width, height: info.height, bytes: fs.statSync(output).size }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
