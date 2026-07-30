// Release regression tests for the Workout Builder training-style cards.
//
// Reported bug: the Gym / Calisthenics / Hybrid cards showed only their
// gradient background for ~3-4 seconds before the photo appeared, so the cards
// looked broken and a user could pick an option before seeing it.
//
// Two causes, both fixed here:
//   1. Wizard steps are display:none until reached and the card art is a CSS
//      background-image, so the browser did not start fetching these images
//      until the step was revealed. They are now preloaded in the document
//      head, which begins the request during the initial page load.
//   2. The source files were ~2.1-2.3 MB each (44.6 MB across the wizard) at
//      near-lossless quality for cards that render around 380x450.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "public", "workout-builder.html"), "utf8");
const CSS = fs.readFileSync(path.join(ROOT, "public", "css", "workout-builder.css"), "utf8");

const STYLE_IMAGES = [
  "/images/workout-builder/styles/gym.webp",
  "/images/workout-builder/styles/calishtenics.webp",
  "/images/workout-builder/styles/hybrid.webp"
];

const head = HTML.slice(0, HTML.indexOf("</head>"));

test("all three training-style images are preloaded in the document head", () => {
  for (const src of STYLE_IMAGES) {
    const pattern = new RegExp(`<link[^>]+rel="preload"[^>]+href="${src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`);
    assert.match(head, pattern, `${src} must be preloaded so it is requested during initial page load`);
  }
});

test("the style preloads declare an image type and high fetch priority", () => {
  for (const src of STYLE_IMAGES) {
    const tag = head.split("\n").find(line => line.includes(src) && line.includes("rel=\"preload\""));
    assert.ok(tag, `missing preload tag for ${src}`);
    assert.match(tag, /as="image"/, `${src} preload must declare as="image"`);
    assert.match(tag, /type="image\/webp"/, `${src} preload must declare its type`);
    assert.match(tag, /fetchpriority="high"/, `${src} preload should not queue behind lower-priority work`);
  }
});

test("each preloaded style image exists on disk and is a real WebP", () => {
  for (const src of STYLE_IMAGES) {
    const file = path.join(ROOT, "public", src.replace(/^\//, ""));
    assert.ok(fs.existsSync(file), `${src} is preloaded but missing on disk`);
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(file, "r");
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);
    assert.equal(buffer.slice(0, 4).toString("ascii"), "RIFF", `${src} must be a real WebP`);
    assert.equal(buffer.slice(8, 12).toString("ascii"), "WEBP", `${src} must be a real WebP`);
  }
});

test("style card images are small enough not to stall the step", () => {
  // A card renders around 380x450. Anything approaching a megabyte here is the
  // regression that caused the multi-second gradient-only window.
  const MAX_BYTES = 400 * 1024;
  const oversized = [];
  for (const src of STYLE_IMAGES) {
    const size = fs.statSync(path.join(ROOT, "public", src.replace(/^\//, ""))).size;
    if (size > MAX_BYTES) oversized.push(`${src} is ${(size / 1024).toFixed(0)}KB`);
  }
  assert.deepEqual(oversized, []);
});

test("no wizard card image is left at the original multi-megabyte weight", () => {
  const dir = path.join(ROOT, "public", "images", "workout-builder");
  const MAX_BYTES = 400 * 1024;
  const oversized = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".webp")) {
        const size = fs.statSync(full).size;
        if (size > MAX_BYTES) {
          oversized.push(`${path.relative(dir, full)} is ${(size / 1024).toFixed(0)}KB`);
        }
      }
    }
  };
  walk(dir);
  assert.deepEqual(oversized, []);
});

test("the card gradient stays an overlay and is not the only background", () => {
  // The gradient must remain a design layer on top of the photo, not a
  // stand-in shown while the photo loads.
  for (const [selector, file] of [
    ["visual-choice-card--gym", "gym.webp"],
    ["visual-choice-card--calisthenics", "calishtenics.webp"],
    ["visual-choice-card--hybrid", "hybrid.webp"]
  ]) {
    const rule = CSS.split("\n").find(line => line.includes(`.${selector} .visual-choice-image`));
    assert.ok(rule, `missing background rule for ${selector}`);
    assert.ok(rule.includes("linear-gradient"), `${selector} should keep its gradient overlay`);
    assert.ok(rule.includes(file), `${selector} must still reference ${file}`);
  }
});

test("style card art is not lazy-loaded or attached by JavaScript", () => {
  const styleSection = HTML.slice(
    HTML.indexOf('data-wizard-step="style"'),
    HTML.indexOf('data-wizard-step="equipment"')
  );
  assert.ok(styleSection.length > 0, "could not isolate the training-style step");
  assert.doesNotMatch(styleSection, /loading="lazy"/, "critical style art must not be lazy-loaded");
  assert.doesNotMatch(styleSection, /data-src=/, "style art must not wait on a JS-applied src");

  const js = fs.readFileSync(path.join(ROOT, "public", "js", "workout-builder.js"), "utf8");
  assert.doesNotMatch(
    js,
    /styles\/(gym|calishtenics|hybrid)\.webp/,
    "style card URLs must come from CSS/preload, not be attached at runtime by JavaScript"
  );
});
