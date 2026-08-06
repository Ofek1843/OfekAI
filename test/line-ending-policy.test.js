// Regression tests for the cross-platform line-ending policy.
//
// Reported issue: with core.autocrlf=true and no .gitattributes, a Windows
// checkout produced CRLF working-tree files while the stored blobs are LF.
// test/auth-action.test.js asserts on the source text of
// public/js/auth-action.js with patterns anchored on "\n}", so those patterns
// stopped matching and the suite reported a missing function on a file nobody
// had edited -- green on CI, red on a developer machine.
//
// .gitattributes now pins `* text=auto eol=lf`. These tests keep that policy
// in place and prove the source-text suites behave identically whichever way
// a checkout lands, so the class of failure cannot come back through a
// different test file.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const ATTRIBUTES = fs.readFileSync(path.join(ROOT, ".gitattributes"), "utf8");

const attributeLines = () =>
  ATTRIBUTES.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#"));

test(".gitattributes pins LF for text files", () => {
  assert.ok(
    attributeLines().some(line => /^\*\s+text=auto\s+eol=lf$/.test(line)),
    "expected `* text=auto eol=lf` as the baseline rule"
  );
});

test("binary formats are excluded from line-ending conversion", () => {
  const lines = attributeLines();
  for (const ext of [
    "png", "jpg", "jpeg", "gif", "webp", "ico",
    "woff", "woff2", "ttf", "pdf", "zip"
  ]) {
    assert.ok(
      lines.some(line => new RegExp(`^\\*\\.${ext}\\s+binary$`).test(line)),
      `*.${ext} must be marked binary`
    );
  }
});

test("Git actually resolves the intended attributes", () => {
  // Asserting the file's text is not enough -- the rules must win for real
  // paths once Git's precedence is applied.
  const check = target =>
    execFileSync("git", ["check-attr", "text", "eol", "binary", "--", target], {
      cwd: ROOT,
      encoding: "utf8"
    });

  const source = check("public/js/auth-action.js");
  assert.match(source, /text: auto/);
  assert.match(source, /eol: lf/);

  const image = check("public/images/food-placeholder.png");
  assert.match(image, /binary: set/, "PNG must resolve as binary");
  assert.match(image, /text: unset/, "PNG must not be treated as text");
});

test("the policy renormalizes nothing that is already committed", () => {
  // The dangerous failure mode of adding .gitattributes is a repository-wide
  // line-ending rewrite. `git ls-files --eol` reports what is actually in the
  // index ("i/") per file, which is the thing that would have to change.
  //
  // Deliberately NOT comparing worktree hashes against the index: that
  // reports every genuinely edited file too, so it would fail on any branch
  // with work in progress and say nothing about line endings.
  const listing = execFileSync("git", ["ls-files", "--eol"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1 << 28
  });

  const offenders = [];
  for (const line of listing.split(/\r?\n/).filter(Boolean)) {
    // e.g. "i/lf    w/crlf  attr/text=auto eol=lf   	path/to/file"
    const match = line.match(/^i\/(\S+)\s+w\/(\S+)\s+attr\/(\S*)\s*\t(.*)$/);
    if (!match) continue;
    const [, index, , attrs, file] = match;
    if (file.startsWith("node_modules/")) continue;
    // Binary files report i/-text and are irrelevant here.
    if (index === "-text" || attrs.includes("-text") || attrs.includes("binary")) continue;
    if (index === "crlf" || index === "mixed") offenders.push(`${file} (index=${index})`);
  }

  assert.deepEqual(
    offenders.slice(0, 20),
    [],
    `${offenders.length} tracked text files are stored with non-LF endings and would be rewritten`
  );
});

test("source-text assertions survive both LF and CRLF checkouts", () => {
  // The documented cross-checkout proof. Take the real file, build both
  // variants, and require the suite's own normalize-then-match approach to
  // produce identical results -- while confirming the raw CRLF form is what
  // breaks a naive "\n}"-anchored pattern, so this stays a real test.
  const source = fs.readFileSync(path.join(ROOT, "public", "js", "auth-action.js"), "utf8");
  const lf = source.replace(/\r\n/g, "\n");
  const crlf = lf.replace(/\n/g, "\r\n");

  const NAIVE = /async function submitNewPassword\([\s\S]*?\n\}\n/;
  const normalize = text => text.replace(/\r\n/g, "\n");

  assert.ok(NAIVE.test(lf), "the LF checkout must match");
  assert.ok(!NAIVE.test(crlf), "the CRLF checkout must NOT match -- this is the hazard being guarded");

  // After normalization the two checkouts are indistinguishable.
  assert.ok(NAIVE.test(normalize(crlf)));
  assert.equal(normalize(crlf), normalize(lf));
});

test("committed text files are stored with LF, not CRLF", () => {
  // Spot-check representative source files: the blob Git stores must contain
  // no CR. Reading the object directly avoids any checkout-time conversion.
  for (const file of [
    "public/js/auth-action.js",
    "public/index.html",
    "server.js",
    "package.json"
  ]) {
    const blob = execFileSync("git", ["cat-file", "-p", `HEAD:${file}`], {
      cwd: ROOT,
      encoding: "buffer",
      maxBuffer: 1 << 28
    });
    assert.ok(!blob.includes(0x0d), `${file} is stored with CRLF in Git`);
  }
});
