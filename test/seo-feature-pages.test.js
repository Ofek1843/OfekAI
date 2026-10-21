"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const { parseHTML } = require("linkedom");
const { features, hub, ORIGIN } = require("../lib/seo-feature-content");
const { renderFeature, renderHub, previewMarkup } = require("../lib/seo-feature-pages");
const router = require("../lib/seo-feature-router");
const publicDir = path.join(__dirname, "../public");
const pages = [...features, hub];
const generated = page => page === hub ? renderHub() : renderFeature(page);

test("committed HTML equals the deterministic renderer; no browser rendering needed", () => {
  for (const page of pages) {
    const source = fs.readFileSync(path.join(publicDir, page.file), "utf8").replace(/\r\n/g, "\n");
    assert.equal(source, generated(page), `${page.route}: run build`);
    const { document } = parseHTML(source);
    assert.equal(document.querySelectorAll("h1").length, 1);
    assert.equal(document.querySelector("h1").textContent, page.h1);
    assert.equal(document.querySelector('link[rel="canonical"]').href, ORIGIN + page.route);
    assert.equal(document.querySelectorAll('meta[name="description"]').length, 1);
    assert.equal(document.querySelector('meta[name="robots"]').content, "index,follow");
    assert.equal(document.querySelectorAll('script[src*="google-analytics-consent"]').length, 1);
    assert.equal(document.querySelectorAll('script[src*="seo-features.js"]').length, 1);
    assert.doesNotMatch(source, /firebase-config|fetch\(|localStorage|loading\.\.\./i);
    const graph = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)["@graph"];
    assert.deepEqual(graph.map(node => node["@type"]), ["WebPage", "BreadcrumbList"]);
    assert.equal(graph[0].url, ORIGIN + page.route);
    assert.doesNotMatch(JSON.stringify(graph), /"aggregateRating"|"@type":"(?:FAQPage|Review)"|"offers"/);
    if (page !== hub) {
      assert.equal(document.querySelectorAll("details").length, page.faqs.length);
      assert.equal(document.querySelectorAll(".steps li").length, page.steps.length);
      for (const cta of document.querySelectorAll("[data-seo-cta]")) {
        assert.equal(cta.getAttribute("href"), page.destination);
      }
    }
  }
  assert.equal(new Set(pages.map(page => page.title)).size, pages.length);
  assert.equal(new Set(pages.map(page => page.description)).size, pages.length);
});

test("all local links, CTA destinations, assets and in-page anchors exist", () => {
  const canonicalRoutes = new Set(pages.map(page => page.route));
  for (const page of pages) {
    const { document } = parseHTML(generated(page));
    for (const element of document.querySelectorAll("[href], [src]")) {
      const href = element.getAttribute("href") || element.getAttribute("src");
      const url = new URL(href, ORIGIN + page.route);
      if (url.origin !== ORIGIN) continue;
      if (href.startsWith("#")) {
        assert.ok(document.getElementById(url.hash.slice(1)), `${page.route} ${href}`);
        continue;
      }
      if (canonicalRoutes.has(url.pathname) || url.pathname === "/exercise-library") continue;
      const target = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      assert.ok(fs.existsSync(path.join(publicDir, target)), `${page.route} -> ${href}`);
    }
  }
});

test("homepage previews are reused without unresolved translation templates", () => {
  for (const name of ["workout", "nutrition", "diary", "tracker", "progress"]) {
    const markup = previewMarkup(name);
    assert.doesNotMatch(markup, /\$\{|<script|<input|<button/);
    assert.ok(markup.length > 300);
  }
});

test("public routing works without auth; aliases redirect, unknown routes are real 404s", async t => {
  const app = express();
  app.use(router);
  app.use(express.static(publicDir));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const page of pages) {
    const response = await fetch(base + page.route);
    assert.equal(response.status, 200, page.route);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
    assert.equal(await response.text(), generated(page));
    assert.equal((await fetch(base + page.route, { method: "HEAD" })).status, 200);
    for (const alias of [page.route + "/", page.route.toUpperCase(), "/" + page.file]) {
      if (alias === page.route) continue;
      const redirect = await fetch(base + alias + "?utm_source=test", { redirect: "manual" });
      assert.equal(redirect.status, 301, alias);
      assert.equal(redirect.headers.get("location"), page.route + "?utm_source=test");
    }
  }
  for (const route of ["/features/missing", "/features/../../private", "/features/unknown.html"]) {
    assert.equal((await fetch(base + route)).status, 404, route);
  }
  for (const route of ["/features/workout-plan-generator", "/features/workout-plan-generator.html"]) {
    const response = await fetch(base + route, { redirect: "manual" });
    assert.equal(response.status, 301);
    assert.equal(response.headers.get("location"), "/workout-plan-generator.html");
  }
  assert.equal((await fetch(base + "/sitemap.xml")).status, 200);
  assert.equal((await fetch(base + "/robots.txt")).status, 200);
});
