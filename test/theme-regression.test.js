// Release regression tests for the global FuelPhysique theme.
//
// The product previously carried a different palette per page stylesheet, each
// with its own :root of dark-navy and saturated purple/blue values. Those are
// now consolidated onto public/css/theme.css, which every page loads first so
// the palette exists on the first paint.
//
// These tests guard the two things most likely to silently regress: a page
// shipping without the shared theme, and old-theme colour values creeping back
// into a stylesheet.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const CSS_DIR = path.join(ROOT, "public", "css");
const PUBLIC_DIR = path.join(ROOT, "public");
const THEME = fs.readFileSync(path.join(CSS_DIR, "theme.css"), "utf8");

const htmlPages = fs.readdirSync(PUBLIC_DIR).filter(f => f.endsWith(".html"));
const stylesheets = fs.readdirSync(CSS_DIR).filter(f => f.endsWith(".css") && f !== "theme.css");

// The dominant values of the previous palette. Category accents are NOT in
// this list -- those are allowed to survive where they carry meaning.
const RETIRED_COLOURS = [
  "#7c5cff", "#7c3aed", "#8b5cf6", "#6c4cff", "#4f46e5", // purple brand
  "#2563eb", "#3b82f6", "#60a5fa", "#38bdf8",             // electric blue
  "#070b14", "#050812", "#050810", "#060912",             // navy page backgrounds
  "#101725", "#10192b", "#0b1220", "#171f30"              // navy surfaces
];

const REQUIRED_TOKENS = [
  "--fp-bg-deep", "--fp-bg-page", "--fp-bg-section",
  "--fp-surface", "--fp-surface-raised", "--fp-surface-soft", "--fp-surface-input",
  "--fp-border", "--fp-border-strong",
  "--fp-text-primary", "--fp-text-secondary", "--fp-text-muted", "--fp-text-inverse",
  "--fp-brand-primary", "--fp-brand-secondary",
  "--fp-success", "--fp-warning", "--fp-danger", "--fp-info",
  "--fp-overlay", "--fp-focus-ring",
  "--fp-disabled-surface", "--fp-disabled-text",
  "--fp-hover-surface", "--fp-active-surface"
];

test("the shared theme defines every required semantic token", () => {
  const missing = REQUIRED_TOKENS.filter(token => !THEME.includes(`${token}:`));
  assert.deepEqual(missing, []);
});

test("every public page loads the shared theme", () => {
  const missing = htmlPages.filter(page => {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, page), "utf8");
    return !/href="\/?css\/theme\.css"/.test(html);
  });
  assert.deepEqual(missing, [], "these pages would render without the global palette");
});

test("the theme is loaded before any page stylesheet, so there is no old-theme flash", () => {
  const late = [];
  for (const page of htmlPages) {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, page), "utf8");
    const links = [...html.matchAll(/href="\/?css\/([a-z0-9-]+\.css)/g)].map(m => m[1]);
    if (!links.length) continue;
    if (links[0] !== "theme.css") late.push(`${page} loads ${links[0]} first`);
  }
  assert.deepEqual(late, []);
});

test("no stylesheet still uses a retired dominant colour", () => {
  const offenders = [];
  for (const file of stylesheets) {
    const css = fs.readFileSync(path.join(CSS_DIR, file), "utf8").toLowerCase();
    for (const colour of RETIRED_COLOURS) {
      if (css.includes(colour)) offenders.push(`${file} -> ${colour}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("no page markup or browser script hardcodes a retired colour", () => {
  const offenders = [];
  const scan = (dir, files) => {
    for (const file of files) {
      const source = fs.readFileSync(path.join(dir, file), "utf8").toLowerCase();
      for (const colour of RETIRED_COLOURS) {
        if (source.includes(colour)) offenders.push(`${file} -> ${colour}`);
      }
    }
  };
  scan(PUBLIC_DIR, htmlPages);
  const jsDir = path.join(PUBLIC_DIR, "js");
  scan(jsDir, fs.readdirSync(jsDir).filter(f => f.endsWith(".js")));
  assert.deepEqual(offenders, []);
});

test("the theme sets the page canvas so the palette exists on first paint", () => {
  assert.match(THEME, /html\s*\{[^}]*background-color:\s*var\(--fp-bg-deep\)/);
  assert.match(THEME, /body\s*\{[^}]*background-color:\s*var\(--fp-bg-page\)/);
  assert.match(THEME, /body\s*\{[^}]*color:\s*var\(--fp-text-primary\)/);
});

test("the theme changes colour only and cannot move anything on the page", () => {
  // Properties that would alter layout, size, spacing, type or motion.
  const layoutProps = [
    "margin", "padding", "width", "height", "display", "position",
    "font-size", "font-family", "font-weight", "line-height", "letter-spacing",
    "border-radius", "grid", "flex", "gap", "transform", "animation", "transition"
  ];
  const offenders = [];
  for (const line of THEME.split("\n")) {
    const declaration = line.trim();
    // Skip comments and custom-property definitions (a token may be named
    // anything; only real CSS declarations can affect layout).
    if (!declaration || declaration.startsWith("//") || declaration.startsWith("*") || declaration.startsWith("--")) continue;
    const match = /^([a-z-]+)\s*:/.exec(declaration);
    if (!match) continue;
    const prop = match[1];
    if (layoutProps.some(p => prop === p || prop.startsWith(`${p}-`))) {
      offenders.push(declaration);
    }
  }
  assert.deepEqual(offenders, [], "theme.css must not declare layout, sizing, typography or motion");
});

test("surface hierarchy stays visually distinguishable", () => {
  const value = name => {
    const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(THEME);
    assert.ok(match, `${name} should be a hex value`);
    const hex = match[1];
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  };
  const lum = ([r, g, b]) => {
    const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ramp = ["--fp-bg-deep", "--fp-bg-page", "--fp-bg-section", "--fp-surface", "--fp-surface-raised", "--fp-surface-soft"];
  let previous = -1;
  for (const step of ramp) {
    const l = lum(value(step));
    assert.ok(l > previous, `${step} must be lighter than the layer beneath it`);
    previous = l;
  }
  // ...and the whole site must not be pure black.
  assert.ok(lum(value("--fp-bg-deep")) > 0.002, "the deepest background must not be pure black");
});

test("text tokens meet WCAG AA against the surfaces they sit on", () => {
  const value = name => {
    const hex = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(THEME)[1];
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  };
  const lum = ([r, g, b]) => {
    const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [x, y] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)]; return (x + 0.05) / (y + 0.05); };

  for (const surface of ["--fp-bg-page", "--fp-surface", "--fp-surface-raised"]) {
    const bg = value(surface);
    assert.ok(ratio(value("--fp-text-primary"), bg) >= 4.5, `primary text on ${surface}`);
    assert.ok(ratio(value("--fp-text-secondary"), bg) >= 4.5, `secondary text on ${surface}`);
    // Muted text is used for de-emphasised labels; AA for large text at minimum.
    assert.ok(ratio(value("--fp-text-muted"), bg) >= 3, `muted text on ${surface}`);
  }
  // Inverse text is for filled brand buttons.
  assert.ok(ratio(value("--fp-text-inverse"), value("--fp-brand-primary")) >= 4.5, "inverse text on the primary brand fill");
});

test("category accents remain distinct from each other", () => {
  const value = name => {
    const hex = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(THEME)[1];
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  };
  const cats = ["--fp-cat-workout", "--fp-cat-nutrition", "--fp-cat-progress", "--fp-cat-coach"];
  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) {
      const a = value(cats[i]), b = value(cats[j]);
      const distance = Math.sqrt(a.reduce((t, c, k) => t + (c - b[k]) ** 2, 0));
      assert.ok(distance > 45, `${cats[i]} and ${cats[j]} are too similar to tell apart`);
    }
  }
});

test("chart series stay distinguishable against the chart surface", () => {
  const series = ["--fp-chart-1", "--fp-chart-2", "--fp-chart-3", "--fp-chart-4", "--fp-chart-5", "--fp-chart-6"];
  const value = name => {
    const hex = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(THEME)[1];
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  };
  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      const a = value(series[i]), b = value(series[j]);
      const distance = Math.sqrt(a.reduce((t, c, k) => t + (c - b[k]) ** 2, 0));
      assert.ok(distance > 30, `${series[i]} and ${series[j]} are too close to read as separate series`);
    }
  }
});

test("the light meal card keeps its own dark text after the theme change", () => {
  // The nutrition card is a deliberate light surface inside the dark system.
  // A global palette change is the obvious way to reintroduce white-on-white.
  const css = fs.readFileSync(path.join(CSS_DIR, "nutrition-builder.css"), "utf8");
  const card = /\.meal-card\s*\{([^}]*)\}/.exec(css);
  assert.ok(card, "the .meal-card rule must exist");
  assert.match(card[1], /--card-text:\s*#0f172a/, "the card must still define dark local text");
  assert.doesNotMatch(card[1], /--card-text:\s*var\(--fp-text-primary\)/, "the card must not inherit the dark page's light text");
});
