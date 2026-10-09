const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "public", "index.html");
const serverPath = path.join(root, "server.js");
const cssPath = path.join(root, "public", "css", "landing-studio-v1.css");
const html = fs.readFileSync(htmlPath, "utf8");
const server = fs.readFileSync(serverPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

test("local landing preview serves the real homepage with its existing features", () => {
  const previewRoute = server.indexOf('app.get("/landing-preview.html"');
  const staticRoute = server.indexOf("app.use(express.static(path.join(__dirname, \"public\")");
  assert.ok(previewRoute >= 0 && previewRoute < staticRoute, "preview route must run before static serving");
  assert.match(server, /process\.env\.NODE_ENV === "production"\) return next\(\)/);
  assert.match(server, /public", "index\.html"/);
  assert.match(server, /landing-studio-v1\.css/);
  assert.match(server, /landing-studio-preview/);
  assert.match(html, /id="languageWelcomeDialog"/);
  assert.match(html, /id="builderChooser"/);
  assert.match(html, /id="features"/);
  assert.match(html, /id="productLoopTitle"/);
  assert.match(html, /id="results"/);
  assert.match(html, /id="transformationInviteTitle"/);
  assert.match(html, /id="howSectionTitle"/);
  assert.match(html, /id="finalCtaTitle"/);
  for (const capability of ["training", "nutrition", "progress", "social", "coach"]) {
    assert.match(html, new RegExp(`data-capability="${capability}"`));
  }
  assert.match(html, /language-welcome\.js/);
  assert.match(html, /site-feedback\.js/);
  assert.match(html, /pwa-install\.js/);
  assert.match(html, /href="\/faq\.html"/);
});

test("landing preview retains the real social profiles and before-and-after comparison images", () => {
  assert.match(html, /instagram\.com\/fuel_physique/);
  assert.match(html, /youtube\.com\/@fuelphysique/);
  assert.match(html, /tiktok\.com\/@fuelphysique1/);
  assert.match(html, /src="\/images\/demo\/progress-bulk\.jpg"/);
  assert.match(html, /src="\/images\/demo\/progress-cutting\.jpg"/);
  assert.match(html, /src="\/images\/demo\/before2\.jpeg"/);
  assert.match(html, /src="\/images\/demo\/after2\.jpeg"/);
  assert.equal((html.match(/data-comparison-slider/g) || []).length, 2);
  assert.match(html, /comparison-range/);
  assert.match(html, /landing\.js/);
});

test("preview redesign references local assets and has responsive and reduced-motion styles", () => {
  const assets = [...html.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith("/images/") || url.startsWith("/icons/"));
  for (const asset of assets) {
    assert.ok(fs.existsSync(path.join(root, "public", asset.slice(1))), `missing local asset: ${asset}`);
  }
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /comparison-before/);
  assert.match(css, /journey-card/);
  assert.match(css, /prefers-reduced-motion/);
});
