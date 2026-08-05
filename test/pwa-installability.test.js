// PWA installability audit + platform-aware install-promotion regression
// tests.
//
// This does NOT substitute for testing on a real Android phone and a real
// iPhone -- see the final report for what was and was not verified on
// physical devices. What this file verifies mechanically:
//   - the manifest is valid and satisfies the fields Chrome's install
//     criteria require
//   - the manifest/service-worker are wired into every page that loads the
//     install-promotion script (not just index/dashboard)
//   - manifest.json and sw.js are actually served with 200 by the real
//     server
//   - pwa-install.js implements distinct branches for Android, iOS Safari,
//     iOS other-browser, and standalone -- not just "load the script and
//     hope beforeinstallprompt fires"
//   - dismissal is namespaced per platform, so a desktop dismissal cannot
//     suppress the iOS instructional banner

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { stopChildProcess } = require("./child-process-cleanup");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

const PAGES_WITH_INSTALL_PROMOTION = [
  "index.html",
  "dashboard.html",
  "app.html",
  "workout-tracker.html",
  "workout-builder.html",
  "nutrition-builder.html"
];

test("manifest.json is valid and satisfies install-criteria fields", () => {
  const raw = fs.readFileSync(path.join(PUBLIC, "manifest.json"), "utf8");
  const manifest = JSON.parse(raw);

  assert.equal(typeof manifest.name, "string");
  assert.ok(manifest.name.length > 0);
  assert.equal(typeof manifest.short_name, "string");
  assert.ok(manifest.short_name.length > 0);
  assert.equal(manifest.name, "FuelPhysique");
  assert.equal(manifest.short_name, "FuelPhysique");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/dashboard.html");
  assert.equal(manifest.scope, "/");
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);

  const has192 = manifest.icons.some(icon => icon.sizes === "192x192" && (icon.purpose || "any").includes("any"));
  const has512 = manifest.icons.some(icon => icon.sizes === "512x512" && (icon.purpose || "any").includes("any"));
  assert.ok(has192, "manifest must declare a 192x192 icon with purpose any");
  assert.ok(has512, "manifest must declare a 512x512 icon with purpose any");

  const hasMaskable = manifest.icons.some(icon => (icon.purpose || "").includes("maskable"));
  assert.ok(hasMaskable, "manifest should declare at least one maskable icon for adaptive Android icon shapes");
});

test("manifest theme/background colors match the Blue Abyss palette", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, "manifest.json"), "utf8"));
  assert.equal(manifest.theme_color.toLowerCase(), "#2f9bff", "theme_color must be Blue Abyss electric blue");
});

test("sw.js exists and is syntactically valid", () => {
  const swPath = path.join(PUBLIC, "sw.js");
  assert.ok(fs.existsSync(swPath));
  // Executing --check on file content directly, not the classic-script-vs-CJS
  // ambiguity that trips up ES modules; sw.js is a plain classic script.
  const { execFileSync } = require("node:child_process");
  execFileSync(process.execPath, ["--check", swPath]);
});

test("the service worker never caches authenticated APIs or SSE and refreshes the release cache", () => {
  const source = fs.readFileSync(path.join(PUBLIC, "sw.js"), "utf8");
  assert.match(source, /CACHE_NAME\s*=\s*['"]fuelphysique-v5['"]/);
  assert.match(source, /['"]\/manifest\.json['"]/);
  assert.match(source, /NETWORK_ONLY_PREFIXES\s*=\s*\[['"]\/api\/['"]\]/);
  assert.match(source, /requestPath\.startsWith\(prefix\)/);
  assert.match(source, /if \(NETWORK_ONLY_PREFIXES\.some\(prefix => requestPath\.startsWith\(prefix\)\)\) \{\s*return;/s);
  assert.match(source, /AUTH_PROXY_PREFIX/);
  assert.match(source, /social\.html/);
  assert.match(source, /social\.css/);
  assert.match(source, /social\.js/);
});

for (const page of PAGES_WITH_INSTALL_PROMOTION) {
  test(`${page}: links the manifest, registers the service worker, and loads pwa-install.js`, () => {
    const html = fs.readFileSync(path.join(PUBLIC, page), "utf8");
    assert.match(html, /<link rel="manifest" href="\/manifest\.json">/, `${page} must link the manifest`);
    assert.match(html, /navigator\.serviceWorker\.register\(['"]\/sw\.js['"]\)/, `${page} must register the service worker`);
    assert.match(html, /src="\/js\/pwa-install\.js"/, `${page} must load pwa-install.js`);
    assert.match(html, /theme-color" content="#2f9bff"/, `${page} theme-color meta must match Blue Abyss`);
    assert.match(html, /<meta name="application-name" content="FuelPhysique">/);
    assert.match(html, /<meta name="apple-mobile-web-app-title" content="FuelPhysique">/);
    assert.doesNotMatch(html, /<title>[^<]*(?:AI Fitness|AI Coach|AI Workout|Ofek AI)/i);
  });
}

test("install-facing metadata has no stale product label", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, "manifest.json"), "utf8"));
  const installSource = [
    JSON.stringify({ name: manifest.name, short_name: manifest.short_name }),
    fs.readFileSync(path.join(PUBLIC, "js", "pwa-install.js"), "utf8")
  ].join("\n");
  assert.doesNotMatch(installSource, /AI Fitness|AI Coach|AI Workout|Ofek AI/);
  assert.match(installSource, /FuelPhysique/);
});

test("pwa-install.js implements distinct platform detection, not a single generic banner", () => {
  const source = fs.readFileSync(path.join(PUBLIC, "js", "pwa-install.js"), "utf8");

  assert.match(source, /function isIOS\(/);
  assert.match(source, /function isAndroid\(/);
  assert.match(source, /function isIOSSafari\(/);
  assert.match(source, /function isStandalone\(/);

  // A. Android/desktop -- the real event.
  assert.match(source, /beforeinstallprompt/);
  assert.match(source, /event\.prompt\(\)/);
  assert.match(source, /event\.userChoice/);
  assert.match(source, /appinstalled/);

  // B. iOS Safari -- instructional, no fake install button wired to a
  // non-existent native flow.
  assert.match(source, /function showIOSSafariInstructions\(/);
  {
    const start = source.indexOf("function showIOSSafariInstructions(");
    const end = source.indexOf("function showIOSOtherBrowserNotice(", start);
    assert.ok(start !== -1 && end !== -1 && end > start, "expected to isolate the showIOSSafariInstructions function body");
    assert.doesNotMatch(
      source.slice(start, end),
      /event\.prompt\(\)/,
      "iOS Safari path must not call the non-existent prompt() API"
    );
  }

  // C. iOS non-Safari -- told to switch browsers, not shown a broken flow.
  assert.match(source, /function showIOSOtherBrowserNotice\(/);
  assert.match(source, /Open FuelPhysique in Safari/);

  // D. Standalone -- never promoted.
  assert.match(source, /if \(isStandalone\(\)\) return;/);
});

test("pwa-install.js: dismissal is namespaced per platform", () => {
  const source = fs.readFileSync(path.join(PUBLIC, "js", "pwa-install.js"), "utf8");

  assert.match(source, /DISMISS_KEY_PREFIX\s*=\s*"fuelphysique-pwa-install-dismissed-until"/);
  assert.match(source, /dismissKey\(key\)/);
  assert.match(source, /`\$\{DISMISS_KEY_PREFIX\}:\$\{key\}`/);

  // The four platform slugs must all appear as literal dismissal targets --
  // this is what stops a desktop dismissal from suppressing the iOS banner.
  for (const slug of ["android", "desktop", "ios-safari", "ios-other"]) {
    assert.match(source, new RegExp(`["'\`]${slug}["'\`]`), `expected platform slug "${slug}" to appear`);
  }
});

test("pwa-install.js: exposes a dev/QA reset that doesn't require waiting 14 days", () => {
  const source = fs.readFileSync(path.join(PUBLIC, "js", "pwa-install.js"), "utf8");
  assert.match(source, /window\.resetFuelPhysiquePwaInstallDismissal\s*=/);
  assert.match(source, /resetPwaInstall/, "expected a ?resetPwaInstall=1 URL-flag escape hatch");
});

test("iOS instructions include a visible Share icon and localized Hebrew/English steps", () => {
  const source = fs.readFileSync(path.join(PUBLIC, "js", "pwa-install.js"), "utf8");
  assert.match(source, /SHARE_ICON_SVG/);
  assert.match(source, /<svg/);
  assert.match(source, /הוסף למסך הבית/, "Hebrew Add-to-Home-Screen instruction must be present");
  assert.match(source, /Add to Home Screen/, "English Add-to-Home-Screen instruction must be present");
});

// --- HTTP-level: manifest and service worker actually serve -------------

test("manifest.json and sw.js are served with 200 by the real server", async (t) => {
  const PORT = 4175;
  const BASE_URL = `http://127.0.0.1:${PORT}`;
  let serverProcess;

  await t.test("start server", async () => {
    serverProcess = spawn(
      process.execPath,
      [path.join(ROOT, "server.js")],
      {
        env: { ...process.env, PORT: String(PORT), MOCK_EXTERNAL_SERVICES: "true", OPENAI_API_KEY: "test-key-not-used-in-mock-mode" },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    const deadline = Date.now() + 15_000;
    let lastError;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${BASE_URL}/health`);
        if (res.ok) return;
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`Server did not become healthy in time. Last error: ${lastError}`);
  });

  await t.test("GET /manifest.json -> 200, valid JSON", async () => {
    const res = await fetch(`${BASE_URL}/manifest.json`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.display, "standalone");
  });

  await t.test("GET /sw.js -> 200", async () => {
    const res = await fetch(`${BASE_URL}/sw.js`);
    assert.equal(res.status, 200);
    await res.text();
  });

  await t.test("GET /js/pwa-install.js -> 200", async () => {
    const res = await fetch(`${BASE_URL}/js/pwa-install.js`);
    assert.equal(res.status, 200);
    await res.text();
  });

  for (const page of PAGES_WITH_INSTALL_PROMOTION) {
    await t.test(`GET /${page} -> 200`, async () => {
      const res = await fetch(`${BASE_URL}/${page}`);
      assert.equal(res.status, 200);
      await res.text();
    });
  }

  stopChildProcess(serverProcess);
});
