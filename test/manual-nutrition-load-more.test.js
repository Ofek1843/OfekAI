// Release regression test for the Manual Nutrition "Load more" control.
//
// Reported bug (visitor-experience audit, VX-003): the button ships with the
// `hidden` attribute and the builder drives its visibility through that
// attribute alone, but `.load-more { display: block }` outranked the UA
// stylesheet's `[hidden] { display: none }`. The result was a visible,
// permanently dead "Load more" button sitting under the "Find your next meal"
// empty state before any search had run -- clicking it did nothing, because
// there was no result set to extend.
//
// The rule is now scoped with :not([hidden]) so the attribute wins.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const MANUAL_CSS = fs.readFileSync(path.join(ROOT, "public", "css", "manual-nutrition-builder.css"), "utf8");
const MANUAL_HTML = fs.readFileSync(path.join(ROOT, "public", "manual-nutrition-builder.html"), "utf8");
const MANUAL_JS = fs.readFileSync(path.join(ROOT, "public", "js", "manual-nutrition-builder.js"), "utf8");

test("VX-003: the hidden Load more button cannot render", () => {
  // The markup ships the attribute...
  assert.match(MANUAL_HTML, /<button id="loadMoreMeals"[^>]*\shidden>/);
  // ...and the stylesheet must no longer override it.
  assert.doesNotMatch(
    MANUAL_CSS,
    /(?<!:not\(\[hidden\]\))\.load-more\s*{\s*display:\s*block/,
    "an unscoped .load-more display rule would beat [hidden] again"
  );
  assert.match(MANUAL_CSS, /\.load-more:not\(\[hidden\]\)\s*{[^}]*display:\s*block/);
});

test("VX-003: the button keeps its layout styling when it is shown", () => {
  // Scoping the rule must not drop the centring margin, or a visible
  // "Load more" would sit flush against the left edge of the results grid.
  assert.match(MANUAL_CSS, /\.load-more:not\(\[hidden\]\)\s*{[^}]*margin:\s*18px auto 0/);
});

test("VX-003: visibility stays driven by the hidden attribute", () => {
  // The CSS fix only holds while [hidden] is the single source of truth. The
  // builder must keep deriving it from the paging state: hidden before a
  // search, hidden when a result set has no further page, shown only when
  // discovery reports hasMore, and hidden again after the final page.
  assert.match(MANUAL_JS, /\$\("#loadMoreMeals"\)\.hidden = true;/);
  assert.match(MANUAL_JS, /\$\("#loadMoreMeals"\)\.hidden = !state\.discovery\.hasMore;/);
  // No class- or inline-style-based visibility path may creep back in.
  assert.doesNotMatch(MANUAL_JS, /loadMoreMeals"\)\.style\.display/);
});
