// Release regression tests for nutrition meal-card readability.
//
// Reported bug: white text on the white meal card on mobile. The meal card is
// deliberately a LIGHT surface inside a dark-themed page, so any descendant
// that inherits the page-level --text/--muted (tuned for light-text-on-dark)
// renders white-on-white.
//
// The fix already on the branch is that .meal-card declares card-local
// variables (--card-text, --card-text-secondary, --card-text-muted, ...) and
// its descendants consume those instead of the page variables. These tests
// lock that invariant in, which matters most because a site-wide palette
// change is the obvious way to reintroduce the bug.
//
// Live computed-style measurement at 375x812 (mobile) over a real generated
// plan found every visible element passing WCAG AA: meal title 17.85, recipe
// title 17.85, calorie target 17.85, macro values 17.85, macro labels 4.76,
// ingredient rows 14.63, preparation control 16.61, navigation control 5.33,
// plan total 16.69, target label 16.69. The table header is display:none on
// mobile and uses white on a blue gradient on desktop.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const CSS = fs.readFileSync(
  path.join(__dirname, "..", "public", "css", "nutrition-builder.css"),
  "utf8"
);

// The light card block and everything it scopes.
const CARD_LOCAL_VARS = [
  "--card-text",
  "--card-text-secondary",
  "--card-text-muted",
  "--card-surface"
];

function ruleBodies(selectorPattern) {
  const bodies = [];
  const re = new RegExp(`([^{}]*${selectorPattern}[^{}]*)\\{([^}]*)\\}`, "g");
  let match;
  while ((match = re.exec(CSS))) bodies.push({ selector: match[1].trim(), body: match[2] });
  return bodies;
}

test(".meal-card defines its own text colours instead of inheriting the dark page's", () => {
  const card = ruleBodies("\\.meal-card").find(r => /^\.meal-card\s*$/.test(r.selector));
  assert.ok(card, "could not find the .meal-card rule");
  for (const variable of CARD_LOCAL_VARS) {
    assert.ok(
      card.body.includes(variable),
      `.meal-card must define ${variable} so descendants never fall back to the page palette`
    );
  }
});

test("the card-local text colours are dark enough for a light surface", () => {
  const card = ruleBodies("\\.meal-card").find(r => /^\.meal-card\s*$/.test(r.selector));
  const relLum = hex => {
    const n = hex.replace("#", "");
    const full = n.length === 3 ? n.split("").map(c => c + c).join("") : n;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
    const f = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrastOnWhite = hex => (1.0 + 0.05) / (relLum(hex) + 0.05);

  for (const variable of ["--card-text", "--card-text-secondary", "--card-text-muted"]) {
    const value = new RegExp(`${variable}:\\s*(#[0-9a-fA-F]{3,6})`).exec(card.body);
    assert.ok(value, `${variable} should be a hex colour`);
    const ratio = contrastOnWhite(value[1]);
    assert.ok(
      ratio >= 4.5,
      `${variable} (${value[1]}) is only ${ratio.toFixed(2)}:1 on white; needs >= 4.5:1`
    );
  }
});

test("light-card text does not use the page-level dark-theme variables", () => {
  // These page variables are white/near-white by design. Any of them applied
  // to text inside the light card is the white-on-white bug.
  const cardScopedSelectors = [
    ".meal-option-name",
    ".meal-option-macros",
    ".meal-card-header",
    ".meal-prep",
    ".nutrition-food-table td"
  ];
  const offenders = [];
  for (const selector of cardScopedSelectors) {
    for (const rule of ruleBodies(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))) {
      const colorDecl = /(?:^|[;{])\s*color:\s*([^;]+)/.exec(rule.body);
      if (!colorDecl) continue;
      const value = colorDecl[1].trim();
      if (/var\(\s*--(text|muted|text-secondary)\s*\)/.test(value)) {
        offenders.push(`${rule.selector} -> color: ${value}`);
      }
      if (/^#fff(fff)?$/i.test(value) || /^white$/i.test(value)) {
        offenders.push(`${rule.selector} -> color: ${value} (white on a light card)`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("no rule paints white text directly onto the light card surface", () => {
  // A white background and white text declared in the same rule is always wrong.
  const offenders = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let match;
  while ((match = re.exec(CSS))) {
    const [, selector, body] = match;
    const bg = /background(?:-color)?:\s*([^;]+)/.exec(body);
    const fg = /(?:^|[;{])\s*color:\s*([^;]+)/.exec(body);
    if (!bg || !fg) continue;
    const bgValue = bg[1].trim().toLowerCase();
    const fgValue = fg[1].trim().toLowerCase();
    const bgIsWhite = /^#fff(fff)?$/.test(bgValue) || bgValue === "white" || /^rgb\(\s*255,\s*255,\s*255\s*\)$/.test(bgValue);
    const fgIsWhite = /^#fff(fff)?$/.test(fgValue) || fgValue === "white" || /^rgb\(\s*255,\s*255,\s*255\s*\)$/.test(fgValue);
    if (bgIsWhite && fgIsWhite) offenders.push(selector.trim());
  }
  assert.deepEqual(offenders, []);
});

test("the mobile layout hides the food table header rather than leaving it unreadable", () => {
  // On narrow screens the table becomes a grid and the header is dropped; it
  // must be display:none, not merely invisible-because-unstyled.
  const mobileBlock = CSS.slice(CSS.indexOf("@media (max-width: 760px)"));
  assert.match(
    mobileBlock,
    /\.nutrition-food-table thead\s*\{[^}]*display:\s*none/,
    "the header must be explicitly hidden on mobile"
  );
});

test("the visible desktop table header has a real background behind its white text", () => {
  // Several rules target th (RTL alignment, mobile). Pick the one that
  // actually declares the header's colour.
  const rule = ruleBodies("\\.nutrition-food-table th").find(r => /(?:^|[;{])\s*color:/.test(r.body));
  assert.ok(rule, "could not find the rule that colours the table header");
  assert.match(rule.body, /color:\s*#ffffff/i, "header text is white");
  assert.match(
    rule.body,
    /background:\s*linear-gradient/,
    "white header text needs an explicit dark/coloured background behind it"
  );
});

test("the plan summary and its target label are styled for the dark page, not the light card", () => {
  // The summary sits on the dark page surface, so it legitimately uses the
  // page palette -- but it must not accidentally pick up the card variables.
  for (const rule of ruleBodies("\\.nutrition-summary-target")) {
    assert.doesNotMatch(
      rule.body,
      /color:\s*var\(--card-text\)/,
      "the summary is on the dark page and must not use light-card text colours"
    );
  }
});
