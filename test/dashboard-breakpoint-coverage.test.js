// Release regression test for responsive breakpoint COVERAGE on the
// dashboard.
//
// Reported bug (visitor-experience audit follow-up): the quick-action grid
// was defined by `@media (max-width: 520px)` on one side and
// `@media (min-width: 521px)` on the other. A CSS viewport width is not an
// integer -- a 520.5px viewport (fractional device pixel ratio, browser zoom,
// a scrollbar taking a fractional slice) matched NEITHER query. With no
// media block applying, `.dashboard-primary-actions` lost the
// `display: grid` that only the breakpoint blocks declare and fell back to
// block layout, so the five action cards stacked as uneven inline boxes.
//
// The breakpoints now overlap at 520px instead of meeting at 520/521. This
// test guards the invariant that actually matters -- every width is covered
// by at least one block -- rather than the specific numbers, so any future
// breakpoint edit that reopens a gap fails here.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const DASHBOARD_CSS = fs.readFileSync(path.join(ROOT, "public", "css", "dashboard.css"), "utf8");

// Every top-level @media condition in the stylesheet, paired with the body it
// guards. The stylesheet never nests @media, so a brace count from each
// opening brace is sufficient.
function mediaBlocks(css) {
  const blocks = [];
  const re = /@media ([^{]+){/g;
  let match;
  while ((match = re.exec(css)) !== null) {
    let depth = 0;
    for (let i = match.index + match[0].length - 1; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push({ condition: match[1].trim(), body: css.slice(match.index + match[0].length, i) });
          break;
        }
      }
    }
  }
  return blocks;
}

// Evaluates the width-based media features this stylesheet uses. Any
// condition carrying a feature we do not model (print, prefers-*, hover, ...)
// is reported as non-width so callers can ignore it rather than guess.
function matchesWidth(condition, width) {
  const parts = condition.split(/\s+and\s+/i).map(part => part.trim());
  let sawWidth = false;
  for (const part of parts) {
    const max = /^\(\s*max-width:\s*([\d.]+)px\s*\)$/.exec(part);
    const min = /^\(\s*min-width:\s*([\d.]+)px\s*\)$/.exec(part);
    if (max) {
      sawWidth = true;
      if (!(width <= Number(max[1]))) return { isWidthQuery: true, matches: false };
    } else if (min) {
      sawWidth = true;
      if (!(width >= Number(min[1]))) return { isWidthQuery: true, matches: false };
    } else {
      return { isWidthQuery: false, matches: false };
    }
  }
  return { isWidthQuery: sawWidth, matches: sawWidth };
}

const GRID_SELECTOR = /\.dashboard-primary-actions\s*{([^}]*)}/;

// Widths straddling the phone/tablet boundary, including the fractional ones
// that a real device actually produces and that integer-only manual testing
// never reaches.
const PROBE_WIDTHS = [320, 360, 360.5, 390, 430, 519.5, 520, 520.25, 520.5, 520.75, 521, 768, 1024, 1080.5, 1100, 1101, 1280, 1440];

test("every probe width is covered by a quick-action grid breakpoint", () => {
  const gridBlocks = mediaBlocks(DASHBOARD_CSS).filter(block => GRID_SELECTOR.test(block.body));
  assert.ok(gridBlocks.length >= 2, "expected the quick-action grid to be defined across several breakpoints");

  const uncovered = PROBE_WIDTHS.filter(width =>
    !gridBlocks.some(block => {
      const result = matchesWidth(block.condition, width);
      return result.isWidthQuery && result.matches;
    })
  );

  assert.deepEqual(uncovered, [], `these widths match no quick-action grid media query: ${uncovered.join(", ")}`);
});

test("no probe width loses display:grid on the quick-action row", () => {
  // The regression was not a wrong column count -- it was the grid formatting
  // context disappearing entirely, which is what turned the row into stacked
  // inline boxes. Resolve the cascade per width and assert the winner still
  // establishes a grid.
  const gridBlocks = mediaBlocks(DASHBOARD_CSS).filter(block => GRID_SELECTOR.test(block.body));

  for (const width of PROBE_WIDTHS) {
    const applying = gridBlocks.filter(block => {
      const result = matchesWidth(block.condition, width);
      return result.isWidthQuery && result.matches;
    });
    // Later source order wins for equal specificity, so the effective
    // declarations are the last matching block's.
    const declarations = applying
      .map(block => GRID_SELECTOR.exec(block.body)[1])
      .filter(text => /display:\s*grid/.test(text) || /grid-template-columns/.test(text));

    assert.ok(
      declarations.length > 0,
      `width ${width}px resolves to no grid declaration on .dashboard-primary-actions`
    );
  }
});

test("the phone and tablet breakpoints overlap rather than leaving a gap", () => {
  // Guards the specific fix: an exclusive 520/521 pair is what produced the
  // fractional dead zone. Any edit back to a "max-width: N / min-width: N+1"
  // pair around this boundary reopens it.
  const conditions = mediaBlocks(DASHBOARD_CSS)
    .filter(block => GRID_SELECTOR.test(block.body))
    .map(block => block.condition);

  const maxima = conditions.flatMap(c => [...c.matchAll(/max-width:\s*([\d.]+)px/g)].map(m => Number(m[1])));
  const minima = conditions.flatMap(c => [...c.matchAll(/min-width:\s*([\d.]+)px/g)].map(m => Number(m[1])));

  for (const max of maxima) {
    for (const min of minima) {
      // A tablet edge sitting just above a phone edge is the bug signature.
      assert.ok(
        !(min > max && min - max <= 1),
        `breakpoints max-width: ${max}px and min-width: ${min}px leave widths between them uncovered`
      );
    }
  }
});

test("the fractional dead zone specifically is covered", () => {
  // The exact widths reported in the audit, asserted directly so the
  // regression is named in the failure output if it ever returns.
  const gridBlocks = mediaBlocks(DASHBOARD_CSS).filter(block => GRID_SELECTOR.test(block.body));
  for (const width of [520.25, 520.5, 520.75]) {
    const matching = gridBlocks.filter(block => {
      const result = matchesWidth(block.condition, width);
      return result.isWidthQuery && result.matches;
    });
    assert.ok(matching.length > 0, `${width}px fell into the phone/tablet dead zone again`);
  }
});
