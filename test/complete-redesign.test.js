const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const CSS = fs.readFileSync(path.join(PUBLIC, "css", "redesign-v1.css"), "utf8");
const SHELL = fs.readFileSync(path.join(PUBLIC, "js", "redesign-shell.js"), "utf8");
const SW = fs.readFileSync(path.join(PUBLIC, "sw.js"), "utf8");
const pages = fs.readdirSync(PUBLIC).filter((file) => file.endsWith(".html")).sort();

test("the complete redesign is applied once to every public HTML route", () => {
  assert.equal(pages.length, 33);
  const failures = [];
  for (const page of pages) {
    const html = fs.readFileSync(path.join(PUBLIC, page), "utf8");
    const styles = html.match(/\/css\/redesign-v1\.css/g) || [];
    const scripts = html.match(/\/js\/redesign-shell\.js/g) || [];
    if (styles.length !== 1 || scripts.length !== 1) {
      failures.push(`${page}: style=${styles.length}, shell=${scripts.length}`);
    }
    assert.ok(
      html.indexOf("/css/theme.css") < html.indexOf("/css/redesign-v1.css"),
      `${page} must load the base tokens before the redesign layer`,
    );
  }
  assert.deepEqual(failures, []);
});

test("the selected editorial direction uses the narrow Ultramarine brand system", () => {
  assert.match(CSS, /--fp-ultramarine:\s*#304ffe/);
  assert.match(CSS, /--fp-brand-primary:\s*var\(--fp-ultramarine\)/);
  assert.match(CSS, /--fp-brand-secondary:\s*var\(--fp-ultramarine\)/);
  assert.doesNotMatch(CSS, /linear-gradient|radial-gradient|conic-gradient/);
  assert.doesNotMatch(CSS, /#ff5a3c|#d3351c|rgba\(255,\s*90,\s*60|rgba\(216,\s*58,\s*32/i);
  assert.match(CSS, /--fp-danger:\s*#e05a67/);
  assert.match(CSS, /--fp-success:\s*#62b37c/);
  assert.match(CSS, /--fp-warning:\s*#d8a542/);
});

test("the product shell exposes exactly five primary destinations", () => {
  const destinations = [...SHELL.matchAll(/\["(dashboard|workouts|nutrition|progress|messages)",\s*"\/[^"]+"/g)]
    .map((match) => match[1]);
  assert.deepEqual(destinations, ["dashboard", "workouts", "nutrition", "progress", "messages"]);
  assert.match(CSS, /grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(CSS, /\.fp-global-nav\s*\{[^}]*position:\s*fixed/s);
  assert.match(CSS, /env\(safe-area-inset-bottom\)/);
});

test("route navigation removes decorative emoji without replacing real controls", () => {
  assert.match(SHELL, /\.builder-navigation a/);
  assert.match(SHELL, /Extended_Pictographic/);
  assert.doesNotMatch(SHELL, /innerHTML\s*=/);
});

test("the mobile layer explicitly repairs auth and dashboard overflow", () => {
  assert.match(CSS, /\.fp-route-auth \.auth-container\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(CSS, /\.fp-route-auth \.auth-container\s*\{[^}]*width:\s*100%\s*!important/s);
  assert.match(CSS, /\.fp-route-dashboard \.dashboard-grid\s*\{[^}]*grid-template-columns:\s*1fr\s*!important/s);
  assert.match(CSS, /body\.fp-redesign\s*\{[^}]*overflow-x:\s*clip/s);
});

test("the shell includes Hebrew navigation and logical RTL rules", () => {
  for (const label of ["לוח בקרה", "תוכניות אימון", "תזונה", "התקדמות", "הודעות"]) {
    assert.ok(SHELL.includes(label), `missing Hebrew primary label: ${label}`);
  }
  assert.match(CSS, /html\[dir="rtl"\]/);
  assert.match(CSS, /border-inline-(?:start|end)/);
});

test("focus, reduced motion, disabled controls, and minimum control size are explicit", () => {
  assert.match(CSS, /:focus-visible/);
  assert.match(CSS, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(CSS, /:disabled/);
  assert.match(CSS, /min-height:\s*44px/);
});

test("the service worker versions and pre-caches the shared redesign assets", () => {
  assert.match(SW, /fuelphysique-v13-illustrated-v4/);
  assert.ok(SW.includes("/css/redesign-v1.css?v=20260810-ultramarine-motion"));
  assert.ok(SW.includes("/js/redesign-shell.js?v=20260810-ultramarine-motion"));
  assert.ok(SW.includes("/css/illustrated-v4.css?v=20260812-athletic-spectrum"));
  assert.ok(SW.includes("/js/illustrated-v4.js?v=20260812-athletic-spectrum"));
  assert.ok(SW.includes("/images/brand/ultramarine-athlete-hero.webp"));
});

test("the before audit, implementation system, and same-input visual QA are documented", () => {
  for (const file of ["docs/design-audit-before.md", "docs/design-system.md", "docs/design-qa.md"]) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} should exist`);
  }
});
