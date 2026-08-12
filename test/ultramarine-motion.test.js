const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = relative => fs.readFileSync(path.join(ROOT, relative), "utf8");
const CSS = read("public/css/redesign-v1.css");
const SHELL = read("public/js/redesign-shell.js");
const SOCIAL = read("public/js/social.js");
const PUSH = read("public/js/push-notifications.js");
const SW = read("public/sw.js");
const PROGRESS = read("public/js/progress.js");

test("Ultramarine Editorial uses the approved exact palette without legacy brand color", () => {
  for (const [name, value] of Object.entries({
    ink: "#10131a", midnight: "#10182b", midnightSoft: "#172238",
    glacier: "#eef3fb", glacierSurface: "#f7f9fe", coolBlue: "#e8eefa", ultramarine: "#304ffe",
    ultramarineStrong: "#243be8", ultramarineSoft: "#e7ebff",
    coach: "#18a979", nutrition: "#e99a28", progress: "#7957e8", social: "#d54d79",
    steel: "#73809a", borderLight: "#d3dae8", borderDark: "#292d35"
  })) assert.ok(CSS.toLowerCase().includes(value), `${name} ${value}`);
  assert.doesNotMatch(CSS, /linear-gradient|radial-gradient|conic-gradient/i);
  assert.doesNotMatch(CSS, /#2f9bff|#35cfdf|#ff5a3c|rgba\(53,\s*207,\s*223|rgba\(47,\s*155,\s*255/i);
  assert.match(CSS, /--fp-danger:\s*#e05a67/);
  assert.match(CSS, /--fp-success:\s*#62b37c/);
  assert.match(CSS, /--fp-warning:\s*#d8a542/);
});

test("first-party builder and brand imagery remains explicit with no gradient fallback", () => {
  for (const asset of [
    "/images/brand/ultramarine-athlete-hero.webp",
    "/images/workout-builder/goals/build-muscle.webp",
    "/images/workout-builder/priorities/hypertrophy.webp",
    "/images/nutrition-builder/goals/build-muscle.webp"
  ]) assert.ok(CSS.includes(asset), asset);
  assert.ok(fs.existsSync(path.join(ROOT, "public/images/brand/ultramarine-athlete-hero.png")));
  assert.ok(fs.existsSync(path.join(ROOT, "public/images/brand/ultramarine-athlete-hero.webp")));
  assert.ok(fs.existsSync(path.join(ROOT, "public/images/brand/fuelphysique-icon-192.png")));
  assert.ok(fs.existsSync(path.join(ROOT, "public/images/brand/fuelphysique-icon-512.png")));
});

test("motion system is bounded, meaningful and reduced-motion safe", () => {
  for (const token of ["--motion-instant: 80ms", "--motion-fast: 160ms", "--motion-standard: 280ms", "--motion-slow: 560ms", "--motion-moment: 900ms"]) {
    assert.ok(CSS.includes(token), token);
  }
  for (const mode of ["train", "fuel", "track", "connect"]) assert.ok(SHELL.includes(`"${mode}"`), mode);
  assert.match(SHELL, /IntersectionObserver/);
  assert.match(SHELL, /MutationObserver/);
  assert.match(CSS, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation-duration:\s*0\.01ms\s*!important/);
  assert.doesNotMatch(CSS, /animation-iteration-count:\s*infinite/i);
  assert.ok(fs.existsSync(path.join(ROOT, "docs/motion-system.md")));
});

test("Progress initializes its locale and renders a solid Ultramarine chart", () => {
  assert.match(PROGRESS, /const he=isHebrew/);
  assert.doesNotMatch(PROGRESS, /linearGradient|areaGradient/);
  assert.match(CSS, /\.fp-route-progress \.chart-area\s*\{[^}]*fill:\s*rgba\(48,\s*79,\s*254,\s*0\.14\)/s);
});

test("local review is loopback-only and never initializes production Messaging", () => {
  const start = read("scripts/start-redesign-review.ps1");
  const seed = read("scripts/seed-redesign-review.js");
  const verify = read("scripts/verify-redesign-review.js");
  for (const value of ["3304", "9099", "8080", "demo-fuelphysique"]) {
    assert.ok(start.includes(value), value);
    assert.ok(verify.includes(value), value);
  }
  assert.match(seed, /Refusing to seed outside the isolated review emulators/);
  assert.match(PUSH, /if \(localEmulatorMode\) return "unsupported"/);
  assert.match(PUSH, /!localEmulatorMode && await isSupported\(\)/);
});

test("mobile Social presents the conversation list before opening a private thread", () => {
  assert.match(SOCIAL, /classList\.toggle\("show-conversations",\s*messages\s*&&\s*!state\.activeConversation\)/);
  assert.match(SOCIAL, /state\.activeConversation\s*=\s*conversation;[\s\S]*?classList\.remove\("show-conversations"\)/);
});

test("all public pages and the service worker use the Ultramarine cache generation", () => {
  const pages = fs.readdirSync(path.join(ROOT, "public")).filter(file => file.endsWith(".html"));
  assert.equal(pages.length, 33);
  for (const page of pages) {
    const html = read(`public/${page}`);
    assert.match(html, /redesign-v1\.css\?v=20260810-ultramarine-motion/);
    assert.match(html, /redesign-shell\.js\?v=20260810-ultramarine-motion/);
  }
  assert.match(SW, /fuelphysique-v13-illustrated-v4/);
  assert.match(SW, /ultramarine-athlete-hero\.webp/);
});
