"use strict";

// Repairs the plate scene's "bulk-female" frame (frame-04). The previous pass
// (clean-nutrition-hero-matte-v43.js) keyed frame-04-regenerated.png with a
// flood fill that removed BOTH the border-connected background AND any
// enclosed neutral blob of 24+ pixels. The quad/knee specular highlights are
// near-white, so they were erased too -- leaving a rectangular transparent
// hole through the legs.
//
// frame-04-regenerated.png is otherwise the best source: clean render, solid
// continuous legs, no studio fringe. This script re-keys it correctly --
// removing ONLY background that is connected to the image border -- and then
// re-normalizes it with the exact geometry the other plate frames use
// (prepare-remaining-real-athlete-v43.js): trim -> resize to height 680 ->
// centre on a 600x720 canvas, bottom-aligned with a 10px margin.
//
// Only the normalized WebP and its manifest entry change. Sources are
// untouched.

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ASSET_ROOT = path.join(ROOT, "public", "assets", "athlete-motion", "v43");
const SOURCE = path.join(ASSET_ROOT, "plate", "final-source", "frame-04-regenerated.png");
const OUTPUT = path.join(ASSET_ROOT, "plate", "normalized", "frame-04.webp");
const MANIFEST_PATH = path.join(ASSET_ROOT, "manifest.json");
const REVIEW_ROOT = path.join(ROOT, "docs", "illustration", "v43");

const CANVAS = { width: 600, height: 720 };
const SUBJECT_HEIGHT = 680;
const BOTTOM_MARGIN = 10;
const VERSION = "20260907-v45-plate-bulk-female-leg-repair-1";

// The render's transparency was flattened to a faint neutral checkerboard
// (~235-255, near-zero chroma). Match that, but nothing darker or coloured.
function isBackdrop(data, offset) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  return Math.min(r, g, b) >= 214 && Math.max(r, g, b) - Math.min(r, g, b) <= 18;
}

// Flood fill 8-connected, seeded ONLY from the image border. Enclosed light
// blobs inside the silhouette (leg highlights, skin speculars) are never
// reached, so they survive.
function keyBorderBackground(data, info) {
  const { width, height } = info;
  const count = width * height;
  const background = new Uint8Array(count);
  const stack = [];
  const consider = (index) => {
    if (background[index]) return;
    if (!isBackdrop(data, index * 3)) return;
    background[index] = 1;
    stack.push(index);
  };
  for (let x = 0; x < width; x += 1) {
    consider(x);
    consider((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    consider(y * width);
    consider(y * width + width - 1);
  }
  while (stack.length) {
    const index = stack.pop();
    const x = index % width;
    const y = (index - x) / width;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        consider(ny * width + nx);
      }
    }
  }
  // Enclosed backdrop pockets (between the forearms and the torso) are not
  // border-connected. Remove a pocket only when it is a large, compact blob of
  // pure backdrop -- never the narrow, tinted speculars on the legs (the bug
  // in the previous pass, which used a 24px area rule). All such pockets in
  // this frame sit at torso height, well clear of the legs.
  const seen = new Uint8Array(count);
  for (let start = 0; start < count; start += 1) {
    if (seen[start] || background[start] || !isBackdrop(data, start * 3)) continue;
    const members = [start];
    seen[start] = 1;
    let head = 0;
    while (head < members.length) {
      const index = members[head++];
      const x = index % width;
      const y = (index - x) / width;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (seen[next] || background[next] || !isBackdrop(data, next * 3)) continue;
          seen[next] = 1;
          members.push(next);
        }
      }
    }
    if (members.length < 250) continue;
    for (const index of members) background[index] = 1;
  }

  const rgba = Buffer.alloc(count * 4);
  let removed = 0;
  for (let index = 0; index < count; index += 1) {
    const source = index * 3;
    const target = index * 4;
    rgba[target] = data[source];
    rgba[target + 1] = data[source + 1];
    rgba[target + 2] = data[source + 2];
    if (background[index]) {
      rgba[target + 3] = 0;
      removed += 1;
    } else {
      rgba[target + 3] = 255;
    }
  }
  return { rgba, removed };
}

// Remove the anti-aliased neutral matte fringe hugging the silhouette. Same
// contract as clean-real-athlete-fringes-v45.js: a pixel that is light and
// low-chroma and sits within two pixels of transparency is background bleed,
// not the subject. Runs a few passes so a 2-3px halo is fully eroded; skin,
// fabric and saturated food keep their edge.
function stripMatteFringe(data, info) {
  const { width, height } = info;
  for (let pass = 0; pass < 5; pass += 1) {
    const alpha = new Uint8Array(width * height);
    for (let i = 0; i < alpha.length; i += 1) alpha[i] = data[i * 4 + 3];
    const clear = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (alpha[index] < 16) continue;
        const offset = index * 4;
        const minimum = Math.min(data[offset], data[offset + 1], data[offset + 2]);
        const chroma = Math.max(data[offset], data[offset + 1], data[offset + 2]) - minimum;
        if (minimum < 178 || chroma > 55) continue;
        let touchesTransparency = false;
        for (let dy = -2; dy <= 2 && !touchesTransparency; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            if (alpha[ny * width + nx] < 16) { touchesTransparency = true; break; }
          }
        }
        if (touchesTransparency) clear.push(index);
      }
    }
    if (!clear.length) break;
    for (const index of clear) {
      data[index * 4] = 0;
      data[index * 4 + 1] = 0;
      data[index * 4 + 2] = 0;
      data[index * 4 + 3] = 0;
    }
  }
}

// Dilate opaque colour outward into the transparent margin (alpha stays 0).
// Without this, lossy WebP interpolates the white subject against pure-black
// transparent pixels and leaves a grey ring the matte test flags.
function bleedEdges(data, info, passes = 4) {
  const { width, height } = info;
  for (let pass = 0; pass < passes; pass += 1) {
    const snapshot = Buffer.from(data);
    const writes = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (snapshot[index * 4 + 3] !== 0) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const o = (ny * width + nx) * 4;
            if (snapshot[o + 3] === 0) continue;
            r += snapshot[o];
            g += snapshot[o + 1];
            b += snapshot[o + 2];
            n += 1;
          }
        }
        if (!n) continue;
        writes.push([index, Math.round(r / n), Math.round(g / n), Math.round(b / n)]);
      }
    }
    if (!writes.length) break;
    for (const [index, r, g, b] of writes) {
      data[index * 4] = r;
      data[index * 4 + 1] = g;
      data[index * 4 + 2] = b;
    }
  }
}

async function alphaBounds(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] < 8) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < left || bottom < top) throw new Error("frame-04 source has no visible pixels");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`Missing plate frame source: ${SOURCE}`);
  const flat = await sharp(fs.readFileSync(SOURCE)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { rgba, removed } = keyBorderBackground(flat.data, flat.info);
  stripMatteFringe(rgba, flat.info);
  const keyed = await sharp(rgba, { raw: { width: flat.info.width, height: flat.info.height, channels: 4 } }).png().toBuffer();

  const bounds = await alphaBounds(keyed);
  const subject = await sharp(keyed)
    .extract(bounds)
    .resize({ height: SUBJECT_HEIGHT, fit: "inside" })
    .toBuffer({ resolveWithObject: true });

  const leftPad = Math.max(0, Math.round((CANVAS.width - subject.info.width) / 2));
  const topPad = Math.max(0, CANVAS.height - subject.info.height - BOTTOM_MARGIN);

  const composited = await sharp({
    create: { width: CANVAS.width, height: CANVAS.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: subject.data, left: leftPad, top: topPad }])
    .raw()
    .toBuffer({ resolveWithObject: true });

  // The resize re-feathered the edge: clean the neutral halo the interpolation
  // reintroduced, then dilate the subject colour into the transparent margin
  // so the lossless encode has no white/black boundary to ring.
  stripMatteFringe(composited.data, composited.info);
  bleedEdges(composited.data, composited.info);

  const output = await sharp(composited.data, {
    raw: { width: CANVAS.width, height: CANVAS.height, channels: 4 },
  })
    .webp({ lossless: true, alphaQuality: 100, effort: 6 })
    .toBuffer();
  fs.writeFileSync(OUTPUT, output);

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  manifest.version = VERSION;
  manifest.generatedAt = new Date().toISOString();
  const plate = manifest.scenes.plate;
  plate.frames = plate.frames.map((frame) => (frame.index === 3
    ? { file: frame.file, source: "frame-04-regenerated.png", semantic: frame.semantic, index: frame.index, sourceBytes: fs.statSync(SOURCE).size, normalizedBytes: output.length }
    : frame));
  plate.normalizedBytes = plate.frames.reduce((sum, frame) => sum + Number(frame.normalizedBytes || 0), 0);
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  const contactFrames = await Promise.all(plate.frames.map((frame) => sharp(path.join(ASSET_ROOT, "plate", "normalized", frame.file))
    .resize(320, 240, { fit: "contain", background: "#147a58" })
    .png()
    .toBuffer()));
  await sharp({ create: { width: 320 * contactFrames.length, height: 240, channels: 4, background: "#147a58" } })
    .composite(contactFrames.map((input, index) => ({ input, left: index * 320, top: 0 })))
    .png()
    .toFile(path.join(REVIEW_ROOT, "plan-plate-final-contact-sheet.png"));

  process.stdout.write(`${JSON.stringify({
    version: VERSION,
    removedBackgroundPixels: removed,
    bounds,
    placement: { left: leftPad, top: topPad, width: subject.info.width, height: subject.info.height },
    normalizedBytes: output.length,
  }, null, 2)}\n`);
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
