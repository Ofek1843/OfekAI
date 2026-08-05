// Technical SEO and social-preview foundation regression tests.
//
// These guard the crawl/index contract for FuelPhysique: which routes are
// public and indexable, which must stay out of search results, and whether
// the metadata a crawler or social platform reads is present, absolute,
// consistent and free of fabricated claims.
//
// Everything asserted here is checked against the SOURCE HTML, because a
// crawler that does not execute JavaScript must still see the title,
// description, canonical, robots directive, Open Graph tags and JSON-LD.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const ORIGIN = "https://fuelphysique.com";

const read = file => fs.readFileSync(path.join(PUBLIC_DIR, file), "utf8");

// --- Approved route classification -------------------------------------
//
// This fixture is the audited classification, not an assumption. It was
// derived from each page's actual auth behaviour:
//
//   A  public + indexable  -- renders useful standalone content anonymously
//   B  public + noindex    -- reachable anonymously, but transitional or a
//                             submission utility that must not rank
//   C  private application -- Firebase-authenticated, account-specific
//   D  technical/action    -- machine or callback surface, no indexable doc
//
// Evidence for the non-obvious ones:
//   pricing.html            A -- plans render anonymously; only the wishlist
//                                button redirects to /auth.html
//   leaderboard.html        C -- onAuthStateChanged hard-redirects anonymous
//                                visitors via location.replace("/auth.html")
//   transformation-submit   B -- renders anonymously but is a personal-photo
//                                submission form gated behind sign-in
//   billing-result.html     B -- transitional post-checkout status page
const PUBLIC_INDEXABLE = Object.freeze({
  "index.html": "/",
  "pricing.html": "/pricing.html",
  "faq.html": "/faq.html",
  "contact.html": "/contact.html",
  "terms.html": "/terms.html",
  "privacy.html": "/privacy.html",
  "refund-policy.html": "/refund-policy.html",
  "subscription-policy.html": "/subscription-policy.html"
});

const MUST_BE_NOINDEX = Object.freeze([
  "app.html", "auth.html", "auth-action.html", "billing-result.html",
  "dashboard.html", "exercise-progress.html", "leaderboard.html",
  "leaderboard-admin.html", "log-workout.html", "manual-nutrition-builder.html",
  "manual-workout-builder.html", "my-nutrition-plans.html", "my-workout-plans.html",
  "nutrition-builder.html", "progress.html", "running.html", "social.html",
  "transformation-submit.html", "workout-builder.html", "workout-history.html",
  "workout-tracker.html"
]);

// Substrings that must never reach production metadata: superseded brand
// names, non-production origins and preview hosts.
const FORBIDDEN_IN_METADATA = Object.freeze([
  "FuelPhysique AI Fitness", "Ofek AI", "ofek-ai", "localhost", "127.0.0.1", "onrender.com"
]);

const metaTags = html => [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]);
const attr = (tag, name) => (tag.match(new RegExp(`${name}=["']([^"']*)["']`, "i")) || [])[1];

function metaContent(html, key) {
  const found = metaTags(html).filter(tag => {
    const id = attr(tag, "name") || attr(tag, "property");
    return id && id.toLowerCase() === key.toLowerCase();
  });
  return found.map(tag => attr(tag, "content"));
}

function canonicals(html) {
  return [...html.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi)]
    .map(m => attr(m[0], "href"));
}

// --- robots.txt ---------------------------------------------------------

test("robots.txt exists and declares exactly one absolute sitemap", () => {
  const robots = read("robots.txt");
  const declarations = robots.split(/\r?\n/).filter(line => /^\s*sitemap:/i.test(line));
  assert.equal(declarations.length, 1, "exactly one Sitemap: line");
  assert.equal(declarations[0].trim(), `Sitemap: ${ORIGIN}/sitemap.xml`);
});

test("robots.txt does not block the site or the assets public pages need", () => {
  const robots = read("robots.txt");
  const disallows = robots
    .split(/\r?\n/)
    .filter(line => /^\s*disallow:/i.test(line))
    .map(line => line.replace(/^\s*disallow:\s*/i, "").trim());

  assert.ok(!disallows.includes("/"), "must not disallow the whole site");
  for (const asset of ["/css/", "/js/", "/images/", "/favicon.svg", "/manifest.json"]) {
    assert.ok(
      !disallows.some(rule => rule && asset.startsWith(rule)),
      `${asset} must stay crawlable so public pages can render`
    );
  }
});

test("robots.txt does not try to hide indexable private pages from crawling", () => {
  // A URL blocked here can never be fetched, so its noindex would never be
  // read. Private routes are protected by auth + noindex instead.
  const robots = read("robots.txt");
  const disallows = robots
    .split(/\r?\n/)
    .filter(line => /^\s*disallow:/i.test(line))
    .map(line => line.replace(/^\s*disallow:\s*/i, "").trim());

  for (const page of MUST_BE_NOINDEX) {
    assert.ok(
      !disallows.includes(`/${page}`),
      `/${page} is Disallow'd, which would prevent its noindex from being seen`
    );
  }
});

// --- sitemap.xml --------------------------------------------------------

function sitemapUrls() {
  const xml = read("sitemap.xml");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
}

test("sitemap.xml is well-formed and uses the sitemap namespace", () => {
  const xml = read("sitemap.xml");
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset\s+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<\/urlset>\s*$/);

  // Balanced <url> wrappers -- a truncated entry is invalid.
  assert.equal((xml.match(/<url>/g) || []).length, (xml.match(/<\/url>/g) || []).length);
  assert.equal((xml.match(/<url>/g) || []).length, sitemapUrls().length);
});

test("sitemap URLs are absolute production HTTPS with no duplicates or fragments", () => {
  const urls = sitemapUrls();
  assert.ok(urls.length > 0, "sitemap must not be empty");
  assert.equal(new Set(urls).size, urls.length, "no duplicate <loc> values");

  for (const url of urls) {
    assert.ok(url.startsWith(`${ORIGIN}/`), `${url} must be on ${ORIGIN}`);
    assert.ok(!url.includes("#"), `${url} must not contain a fragment`);
    assert.ok(!url.includes("?"), `${url} must not carry query parameters`);
    for (const forbidden of FORBIDDEN_IN_METADATA) {
      assert.ok(!url.includes(forbidden), `${url} must not contain ${forbidden}`);
    }
  }
});

test("sitemap omits lastmod, changefreq and priority rather than inventing them", () => {
  const xml = read("sitemap.xml");
  for (const tag of ["lastmod", "changefreq", "priority"]) {
    assert.ok(!new RegExp(`<${tag}>`).test(xml), `<${tag}> would be a fabricated signal`);
  }
});

test("sitemap contains exactly the approved public indexable routes", () => {
  const expected = Object.values(PUBLIC_INDEXABLE).map(route => `${ORIGIN}${route}`).sort();
  assert.deepEqual(sitemapUrls().slice().sort(), expected);
});

test("sitemap contains no private, auth, action or callback route", () => {
  const urls = sitemapUrls().join("\n");
  for (const page of MUST_BE_NOINDEX) {
    assert.ok(!urls.includes(`/${page}`), `${page} must never appear in the sitemap`);
  }
  for (const fragment of ["dashboard", "settings", "social", "progress", "my-", "auth", "billing", "leaderboard"]) {
    assert.ok(!urls.includes(fragment), `sitemap must not reference "${fragment}"`);
  }
});

test("every sitemap URL maps to a real file that is served", () => {
  for (const url of sitemapUrls()) {
    const route = url.slice(ORIGIN.length);
    // "/" is served by express.static's directory index.
    const file = route === "/" ? "index.html" : route.replace(/^\//, "");
    assert.ok(
      fs.existsSync(path.join(PUBLIC_DIR, file)),
      `${url} has no backing file at public/${file}`
    );
  }
});

// --- canonical ----------------------------------------------------------

test("every public indexable page has exactly one correct absolute canonical", () => {
  for (const [file, route] of Object.entries(PUBLIC_INDEXABLE)) {
    const found = canonicals(read(file));
    assert.equal(found.length, 1, `${file} must have exactly one canonical`);
    assert.equal(found[0], `${ORIGIN}${route}`, `${file} canonical must match its route`);
  }
});

test("canonical URLs are unique across public pages", () => {
  const all = Object.keys(PUBLIC_INDEXABLE).map(file => canonicals(read(file))[0]);
  assert.equal(new Set(all).size, all.length, "two pages must not share a canonical");
});

test("noindex pages do not claim an indexable canonical", () => {
  for (const file of MUST_BE_NOINDEX) {
    assert.equal(canonicals(read(file)).length, 0, `${file} must not advertise a canonical`);
  }
});

// --- titles and descriptions -------------------------------------------

test("every public indexable page has one meaningful, unique title", () => {
  const titles = [];
  for (const file of Object.keys(PUBLIC_INDEXABLE)) {
    const html = read(file);
    const found = [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)].map(m => m[1].trim());
    assert.equal(found.length, 1, `${file} must have exactly one <title>`);
    assert.ok(found[0].length > 0, `${file} title must not be empty`);
    assert.ok(!/^(home|page|untitled)$/i.test(found[0]), `${file} title is generic`);
    titles.push(found[0]);
  }
  assert.equal(new Set(titles).size, titles.length, "public titles must be unique");
});

test("the landing title describes the product rather than only the brand", () => {
  const title = read("index.html").match(/<title>([\s\S]*?)<\/title>/)[1].trim();
  assert.notEqual(title, "FuelPhysique", "the bare brand name explains nothing");
  assert.match(title, /FuelPhysique/);
});

test("every public indexable page has one page-specific description", () => {
  const descriptions = [];
  for (const file of Object.keys(PUBLIC_INDEXABLE)) {
    const found = metaContent(read(file), "description");
    assert.equal(found.length, 1, `${file} must have exactly one meta description`);
    assert.ok(found[0] && found[0].trim().length >= 40, `${file} description is too thin`);
    descriptions.push(found[0].trim());
  }
  assert.equal(new Set(descriptions).size, descriptions.length, "descriptions must not be duplicated across pages");
});

// --- Open Graph and Twitter/X ------------------------------------------

test("every public indexable page has complete Open Graph metadata", () => {
  for (const [file, route] of Object.entries(PUBLIC_INDEXABLE)) {
    const html = read(file);
    for (const key of ["og:type", "og:site_name", "og:title", "og:description", "og:url"]) {
      const found = metaContent(html, key);
      assert.equal(found.length, 1, `${file} must have exactly one ${key}`);
      assert.ok(found[0] && found[0].trim(), `${file} ${key} must not be empty`);
    }
    assert.equal(metaContent(html, "og:site_name")[0], "FuelPhysique");
    assert.equal(metaContent(html, "og:type")[0], "website");
    assert.equal(metaContent(html, "og:url")[0], `${ORIGIN}${route}`);
    // og:url must agree with the canonical or the two signals fight.
    assert.equal(metaContent(html, "og:url")[0], canonicals(html)[0], `${file} og:url must equal its canonical`);
  }
});

test("every public indexable page has Twitter/X card metadata", () => {
  for (const file of Object.keys(PUBLIC_INDEXABLE)) {
    const html = read(file);
    for (const key of ["twitter:card", "twitter:title", "twitter:description"]) {
      const found = metaContent(html, key);
      assert.equal(found.length, 1, `${file} must have exactly one ${key}`);
      assert.ok(found[0] && found[0].trim(), `${file} ${key} must not be empty`);
    }
  }
});

test("card type matches whether a preview image is actually present", () => {
  // summary_large_image without a usable image renders an empty card.
  for (const file of Object.keys(PUBLIC_INDEXABLE)) {
    const html = read(file);
    const card = metaContent(html, "twitter:card")[0];
    const hasImage = metaContent(html, "og:image").length > 0 || metaContent(html, "twitter:image").length > 0;
    if (!hasImage) {
      assert.equal(card, "summary", `${file} has no preview image, so twitter:card must be "summary"`);
    }
  }
});

test("any social image that is declared is absolute HTTPS and exists on disk", () => {
  // No image is declared today (see DEDICATED SOCIAL PREVIEW IMAGE
  // REQUIRED). This locks the contract for whenever one is added: it must
  // be absolute, production-origin, and actually resolve.
  for (const file of [...Object.keys(PUBLIC_INDEXABLE), ...MUST_BE_NOINDEX]) {
    const html = read(file);
    for (const key of ["og:image", "twitter:image"]) {
      for (const value of metaContent(html, key)) {
        assert.ok(value.startsWith(`${ORIGIN}/`), `${file} ${key} must be an absolute ${ORIGIN} URL`);
        const asset = value.slice(ORIGIN.length).replace(/^\//, "").split("?")[0];
        assert.ok(fs.existsSync(path.join(PUBLIC_DIR, asset)), `${file} ${key} points at missing public/${asset}`);
      }
    }
  }
});

// --- index / noindex policy --------------------------------------------

test("every private, auth and transitional page is noindex", () => {
  for (const file of MUST_BE_NOINDEX) {
    const directives = metaContent(read(file), "robots");
    assert.equal(directives.length, 1, `${file} must have exactly one robots meta`);
    assert.match(directives[0], /\bnoindex\b/i, `${file} must be noindex`);
  }
});

test("no public indexable page is accidentally noindex", () => {
  for (const file of Object.keys(PUBLIC_INDEXABLE)) {
    for (const directive of metaContent(read(file), "robots")) {
      assert.ok(!/\bnoindex\b/i.test(directive), `${file} is in the sitemap but declares noindex`);
    }
  }
});

test("no noindex page appears in the sitemap", () => {
  const urls = sitemapUrls();
  for (const file of MUST_BE_NOINDEX) {
    assert.ok(!urls.includes(`${ORIGIN}/${file}`), `${file} is noindex and must not be in the sitemap`);
  }
});

// --- structured data ----------------------------------------------------

function landingJsonLd() {
  const blocks = [...read("index.html").matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return blocks.map(block => JSON.parse(block[1]));
}

test("landing JSON-LD parses and uses the production origin", () => {
  const blocks = landingJsonLd();
  assert.equal(blocks.length, 1, "exactly one JSON-LD block on the landing page");

  const graph = blocks[0]["@graph"];
  assert.ok(Array.isArray(graph) && graph.length > 0, "expected an @graph");
  assert.equal(blocks[0]["@context"], "https://schema.org");

  for (const node of graph) {
    assert.ok(node["@type"], "every node needs an @type");
    if (node.url) assert.ok(node.url.startsWith(ORIGIN), `${node["@type"]} url must use ${ORIGIN}`);
    if (node.name) assert.equal(node.name, "FuelPhysique");
  }
});

test("landing JSON-LD asserts no rating, review, offer or price", () => {
  const serialized = JSON.stringify(landingJsonLd());
  for (const forbidden of [
    "aggregateRating", "ratingValue", "ratingCount", "reviewCount",
    "\"review\"", "offers", "priceCurrency", "\"price\"", "downloadCount", "award"
  ]) {
    assert.ok(!serialized.includes(forbidden), `JSON-LD must not contain ${forbidden}`);
  }
});

test("JSON-LD is only on the landing page", () => {
  for (const file of Object.keys(PUBLIC_INDEXABLE)) {
    if (file === "index.html") continue;
    assert.ok(
      !/application\/ld\+json/i.test(read(file)),
      `${file} should not carry structured data in this foundation`
    );
  }
});

// --- brand, origin hygiene and initial HTML ----------------------------

test("metadata carries no superseded brand name, localhost or preview host", () => {
  const files = [...Object.keys(PUBLIC_INDEXABLE), ...MUST_BE_NOINDEX, "robots.txt", "sitemap.xml"];
  for (const file of files) {
    const html = read(file);
    const inspected = file.endsWith(".html")
      ? [...metaTags(html), ...canonicals(html), ...(html.match(/<title>[\s\S]*?<\/title>/gi) || [])].join("\n")
      : html;

    for (const forbidden of FORBIDDEN_IN_METADATA) {
      assert.ok(
        !inspected.includes(forbidden),
        `${file} metadata must not reference "${forbidden}"`
      );
    }
  }
});

test("brand spelling is exactly FuelPhysique wherever it appears in metadata", () => {
  // Human-readable values only. URLs are excluded deliberately: the
  // production host is lowercase "fuelphysique.com" by definition, and
  // folding it into this check would flag every correct canonical.
  const HUMAN_KEYS = ["description", "og:title", "og:description", "og:site_name", "twitter:title", "twitter:description"];

  for (const file of Object.keys(PUBLIC_INDEXABLE)) {
    const html = read(file);
    const values = [
      ...HUMAN_KEYS.flatMap(key => metaContent(html, key)),
      ...(html.match(/<title>([\s\S]*?)<\/title>/i) || []).slice(1)
    ].filter(Boolean);

    for (const value of values) {
      const wrong = value.match(/\b(?:fuelphysique|Fuelphysique|FuelPhysiQue|Fuel\s+Physique|FUELPHYSIQUE)\b/g);
      assert.equal(wrong, null, `${file} misspells the brand in "${value}": ${wrong}`);
      // Any occurrence at all must be the exact brand casing.
      const occurrences = value.match(/fuel\s*physique/gi) || [];
      for (const occurrence of occurrences) {
        assert.equal(occurrence, "FuelPhysique", `${file} brand casing must be exactly FuelPhysique`);
      }
    }
  }
});

test("crawl-critical metadata is in the served HTML, not injected by script", () => {
  // A crawler that does not run JavaScript must still see all of it, so the
  // tags must not be created from JS at runtime.
  for (const file of Object.keys(PUBLIC_INDEXABLE)) {
    const html = read(file);
    const head = html.slice(0, html.search(/<\/head>/i));
    assert.match(head, /<title>/i, `${file} title must be in the source head`);
    assert.match(head, /name=["']description["']/i, `${file} description must be in the source head`);
    assert.match(head, /rel=["']canonical["']/i, `${file} canonical must be in the source head`);
    assert.match(head, /property=["']og:url["']/i, `${file} og:url must be in the source head`);

    assert.ok(
      !/createElement\(["']meta["']\)|setAttribute\(["']content["']/.test(html),
      `${file} must not build metadata at runtime`
    );
  }
});

test("public indexable pages declare a language and a viewport", () => {
  for (const file of Object.keys(PUBLIC_INDEXABLE)) {
    const html = read(file);
    assert.equal((html.match(/<html\b/gi) || []).length, 1, `${file} must have exactly one <html>`);
    assert.match(html, /<html[^>]*\blang=["'][a-z]{2}(?:-[A-Za-z]{2})?["']/i, `${file} needs a lang`);
    assert.equal(metaContent(html, "viewport").length, 1, `${file} needs exactly one viewport meta`);
  }
});
