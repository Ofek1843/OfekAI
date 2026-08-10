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

test("the selected editorial direction uses one narrow non-blue brand accent", () => {
  assert.match(CSS, /--fp-brand-primary:\s*#ff5a3c/);
  assert.match(CSS, /--fp-brand-secondary:\s*#ff5a3c/);
  assert.doesNotMatch(CSS, /linear-gradient|radial-gradient|conic-gradient/);
  const primaryColours = [...CSS.matchAll(/--fp-brand-primary:\s*#([0-9a-f]{6})/gi)].map((match) => match[1]);
  assert.ok(primaryColours.length >= 2, "dark and light themes should both define the accent");
  for (const hex of primaryColours) {
    const [red, green, blue] = [0, 2, 4].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
    assert.ok(red > green && red > blue, `#${hex} must remain a warm, non-blue accent`);
  }
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
  assert.match(SW, /fuelphysique-v10-editorial/);
  assert.ok(SW.includes("/css/redesign-v1.css?v=20260810"));
  assert.ok(SW.includes("/js/redesign-shell.js?v=20260810"));
});

test("the before audit, implementation system, and same-input visual QA are documented", () => {
  for (const file of ["docs/design-audit-before.md", "docs/design-system.md", "docs/design-qa.md"]) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} should exist`);
  }
});
