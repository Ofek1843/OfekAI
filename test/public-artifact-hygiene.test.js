// Regression tests for publicly served repository artifacts.
//
// Reported issue: everything under public/ is served verbatim by
// express.static, and four editor/OS artifacts had been committed there:
//
//   public/dashboard.html.backup-20260724   HTTP 200, 13439 B
//   public/log-workout.html.bak             HTTP 200,  1435 B
//   public/js/log-workout.js.bak            HTTP 200,  5729 B
//   public/desktop.ini                      HTTP 200,    48 B
//
// None was referenced anywhere in the repository, and the first three served
// stale copies of application markup and script to anonymous visitors. They
// are removed; these tests keep them gone and stop the next one landing.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

// The specific files that were exposed. Named individually so a regression
// reports the exact path rather than a generic pattern hit.
const REMOVED_ARTIFACTS = Object.freeze([
  "dashboard.html.backup-20260724",
  "log-workout.html.bak",
  "js/log-workout.js.bak",
  "desktop.ini"
]);

// Artifact shapes that must never appear under public/. Deliberately narrow:
// each targets a real editor/OS/backup convention, so a legitimate asset is
// not caught by accident.
const ARTIFACT_PATTERNS = Object.freeze([
  /\.bak$/i,
  /\.backup$/i,
  /\.backup-[\w.-]+$/i,
  /\.old$/i,
  /\.orig$/i,
  /\.rej$/i,
  /\.tmp$/i,
  /\.temp$/i,
  /~$/,
  /\.swp$/i,
  /\.swo$/i,
  /^desktop\.ini$/i,
  /^Thumbs\.db$/i,
  /^\.DS_Store$/i,
  /\.log$/i
]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const publicFiles = () =>
  walk(PUBLIC_DIR).map(file => path.relative(PUBLIC_DIR, file).split(path.sep).join("/"));

test("the exposed artifacts are gone from public/", () => {
  for (const artifact of REMOVED_ARTIFACTS) {
    assert.equal(
      fs.existsSync(path.join(PUBLIC_DIR, artifact)),
      false,
      `public/${artifact} is served at https://fuelphysique.com/${artifact} and must not exist`
    );
  }
});

test("no backup, editor or OS artifact is served from public/", () => {
  const offenders = publicFiles().filter(file => {
    const base = file.split("/").pop();
    return ARTIFACT_PATTERNS.some(pattern => pattern.test(base));
  });

  assert.deepEqual(
    offenders,
    [],
    `these files under public/ are publicly retrievable: ${offenders.join(", ")}`
  );
});

test("no artifact is tracked by Git under public/", () => {
  // Catches the case where a file is committed but not present in this
  // checkout, which the filesystem walk above would miss.
  const tracked = execFileSync("git", ["ls-files", "public/"], { cwd: ROOT, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);

  const offenders = tracked.filter(file => {
    const base = file.split("/").pop();
    return ARTIFACT_PATTERNS.some(pattern => pattern.test(base));
  });

  assert.deepEqual(offenders, [], `tracked artifacts under public/: ${offenders.join(", ")}`);
});

test(".gitignore covers the artifact shapes that reach public/", () => {
  const ignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  for (const rule of ["*.bak", "*.backup-*", "*.orig", "*.tmp", "desktop.ini", "Thumbs.db", ".DS_Store"]) {
    assert.ok(
      ignore.split(/\r?\n/).some(line => line.trim() === rule),
      `.gitignore should list ${rule} so the artifact never reaches public/ again`
    );
  }
});

test("no page under public/ has a same-named backup sibling", () => {
  // The dangerous shape specifically: foo.html next to foo.html.bak, where
  // the backup exposes an older revision of a live page.
  const files = publicFiles();
  const live = new Set(files);
  const shadowed = files.filter(file => {
    const stripped = file.replace(/\.(bak|backup|old|orig|tmp|temp)$/i, "").replace(/\.backup-[\w.-]+$/i, "");
    return stripped !== file && live.has(stripped);
  });

  assert.deepEqual(shadowed, [], `backup copies shadowing live pages: ${shadowed.join(", ")}`);
});

test("source maps do not leak local filesystem paths", () => {
  const maps = publicFiles().filter(file => file.endsWith(".map"));
  for (const map of maps) {
    const contents = fs.readFileSync(path.join(PUBLIC_DIR, map), "utf8");
    assert.ok(
      !/[A-Za-z]:\\\\Users\\\\|\/Users\/|\/home\//.test(contents),
      `public/${map} embeds an absolute local path`
    );
  }
});
