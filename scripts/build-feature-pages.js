#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { ORIGIN, features, hub, existingSitemapRoutes } = require("../lib/seo-feature-content");
const { renderFeature, renderHub } = require("../lib/seo-feature-pages");
const publicDir = path.join(__dirname, "../public");
const check = process.argv.includes("--check");
const outputs = new Map(features.map(page => [page.file, renderFeature(page)]));
outputs.set(hub.file, renderHub());
const routes = [...existingSitemapRoutes, hub.route, ...features.map(page => page.route)];
if (new Set(routes).size !== routes.length) throw new Error("Duplicate sitemap route");
outputs.set("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(route => `  <url><loc>${ORIGIN}${route}</loc></url>`).join("\n")}
</urlset>
`);
for (const [file, content] of outputs) {
  const target = path.join(publicDir, file);
  if (check) {
    if (!fs.existsSync(target) || fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n") !== content) {
      throw new Error(`${file} is stale. Run npm run build.`);
    }
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}
console.log(`${check ? "Verified" : "Built"} ${features.length} feature pages, hub and sitemap.`);
