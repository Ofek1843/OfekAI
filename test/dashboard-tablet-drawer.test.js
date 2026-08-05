// Release regression tests for the tablet-width dashboard navigation.
//
// Reported bug (visitor-experience audit):
//
// VX-002 -- dashboard.css collapsed the shell to one column and made the
// sidebar `position: static` at max-width 1100px, but the off-canvas drawer
// only started at max-width 520px. Every width from 521px to 1100px therefore
// rendered the full-height sidebar stacked ABOVE the dashboard: at 768x1024
// the primary actions sat at y=1096 on a 1024-tall viewport, so the first
// screen was navigation only. The drawer block now covers the whole band.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const DASHBOARD_CSS = fs.readFileSync(path.join(ROOT, "public", "css", "dashboard.css"), "utf8");
const DASHBOARD_JS = fs.readFileSync(path.join(ROOT, "public", "js", "dashboard.js"), "utf8");

// Returns the concatenated bodies of EVERY @media block whose condition
// matches `condition` exactly, by brace-counting from each opening brace.
// Blunt but dependency-free, and good enough for a stylesheet that never
// nests @media. It must collect every block, not just the first: the phone
// breakpoint legitimately appears more than once (drawer-adjacent shell
// sizing in one place, the quick-action grid in another).
function mediaBlock(css, condition) {
  const marker = `@media ${condition} {`;
  const bodies = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(marker, from);
    if (start === -1) break;
    let depth = 0;
    for (let i = start + marker.length - 1; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          bodies.push(css.slice(start + marker.length, i));
          from = i;
          break;
        }
      }
    }
    if (depth !== 0) break;
  }
  return bodies.length ? bodies.join("\n") : null;
}

test("VX-002: the drawer block covers the whole tablet band, not just phones", () => {
  const drawer = mediaBlock(DASHBOARD_CSS, "(max-width: 1100px)");
  assert.ok(drawer, "expected an @media (max-width: 1100px) block");

  // The three things that make the sidebar an overlay rather than a block in
  // the document flow.
  assert.match(drawer, /\.sidebar\s*{[^}]*position:\s*fixed/);
  assert.match(drawer, /\.sidebar\s*{[^}]*transform:\s*translateX\(-104%\)/);
  assert.match(drawer, /body\.drawer-open\s+\.sidebar\s*{[^}]*transform:\s*translateX\(0\)/);
});

test("VX-002: no rule leaves the sidebar in flow across the 521-1100px band", () => {
  // The regression was `position: static` inside a max-width:1100px block.
  // Any reintroduction of an in-flow sidebar at a tablet width brings the
  // stacked-sidebar layout straight back.
  assert.doesNotMatch(
    DASHBOARD_CSS,
    /@media\s*\(max-width:\s*(?:5[2-9]\d|[6-9]\d\d|10\d\d|1100)px\)\s*{[^@]*\.sidebar\s*{[^}]*position:\s*static/,
    "a tablet-width media query still pins .sidebar to position: static"
  );
});

test("VX-002: a drawer toggle and backdrop are available in the tablet band", () => {
  const drawer = mediaBlock(DASHBOARD_CSS, "(max-width: 1100px)");
  // .mobile-topbar / .mobile-backdrop are display:none in the base stylesheet,
  // so the drawer band must switch them on or there is no way to open the nav.
  assert.match(drawer, /\.mobile-topbar\s*{[^}]*display:\s*grid/);
  assert.match(drawer, /\.mobile-backdrop\s*{[^}]*display:\s*block/);
  assert.match(drawer, /\.mobile-menu-button\s*{/);
});

test("VX-002: RTL keeps the drawer anchored to the inline-end edge", () => {
  const drawer = mediaBlock(DASHBOARD_CSS, "(max-width: 1100px)");
  assert.match(drawer, /html\[dir="rtl"\]\s+\.sidebar\s*{[^}]*transform:\s*translateX\(104%\)/);
});

test("VX-002: the JS resize guard matches the drawer CSS breakpoint", () => {
  // If these drift apart, resizing into the band either force-closes a drawer
  // that is still the only navigation, or leaves body scroll locked above it.
  assert.match(DASHBOARD_JS, /const DRAWER_MAX_WIDTH = 1100;/);
  assert.match(DASHBOARD_JS, /window\.innerWidth > DRAWER_MAX_WIDTH/);
  assert.doesNotMatch(DASHBOARD_JS, /window\.innerWidth > 520/);
});

test("VX-002: the desktop sidebar above the breakpoint is untouched", () => {
  // The base .sidebar rule still owns the sticky desktop column.
  assert.match(DASHBOARD_CSS, /\n\.sidebar\s*{[^}]*position:\s*sticky/);
});

test("VX-002: the verified quick-action grid breakpoints are unchanged", () => {
  // 320px -> 1 column
  assert.match(mediaBlock(DASHBOARD_CSS, "(max-width: 360px)"), /\.dashboard-primary-actions\s*{[^}]*grid-template-columns:\s*1fr\s*;/);
  // 390/430px -> 2 columns
  assert.match(mediaBlock(DASHBOARD_CSS, "(max-width: 520px)"), /\.dashboard-primary-actions\s*{[^}]*grid-template-columns:\s*1fr 1fr/);
  // 768px -> 3 columns (3 + 2 with five actions). The tablet edge sits at
  // 520px, deliberately overlapping the phone block rather than meeting it at
  // 521px -- see test/dashboard-breakpoint-coverage.test.js.
  assert.match(
    mediaBlock(DASHBOARD_CSS, "(min-width: 520px) and (max-width: 1080px)"),
    /\.dashboard-primary-actions\s*{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/
  );
  // 1280/1440px -> 5 columns
  assert.match(
    mediaBlock(DASHBOARD_CSS, "(min-width: 520px)"),
    /\.dashboard-primary-actions\s*{[^}]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/
  );
});

test("VX-002: phone-only shell padding did not leak into the tablet band", () => {
  // The drawer band needs `display: block` on the shell, but the phone
  // block's zero side padding would run tablet content to the screen edge.
  const drawer = mediaBlock(DASHBOARD_CSS, "(max-width: 1100px)");
  assert.match(drawer, /\.dashboard-shell\s*{[^}]*display:\s*block/);
  assert.doesNotMatch(drawer, /\.dashboard-shell\s*{[^}]*padding:/);
  assert.match(mediaBlock(DASHBOARD_CSS, "(max-width: 520px)"), /\.dashboard-shell\s*{[^}]*padding:\s*0 0 18px/);
});

