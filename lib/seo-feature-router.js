"use strict";

const path = require("node:path");
const { features, hub } = require("./seo-feature-content");
const pages = [hub, ...features];
const routes = new Map(pages.map(page => [page.route, page]));
const aliases = new Map(pages.map(page => ["/" + page.file, page.route]));
aliases.set("/features/workout-plan-generator", "/workout-plan-generator.html");
aliases.set("/features/workout-plan-generator.html", "/workout-plan-generator.html");

module.exports = function featurePages(req, res, next) {
  if (!["GET", "HEAD"].includes(req.method)) return next();
  const normalized = req.path.toLowerCase().replace(/\/+$/, "") || "/";
  const canonical = aliases.get(normalized) || (routes.has(normalized) ? normalized : null);
  if (!canonical) {
    if (normalized === "/features" || normalized.startsWith("/features/")) {
      return res.status(404).set("X-Robots-Tag", "noindex").type("html").send(
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Feature not found | FuelPhysique</title><main><h1>Feature not found</h1><p><a href="/features">Explore FuelPhysique features</a></p></main></html>'
      );
    }
    return next();
  }
  if (req.path !== canonical) {
    const query = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
    return res.redirect(301, canonical + query);
  }
  res.set("Cache-Control", "no-store, max-age=0");
  return res.sendFile(path.join(__dirname, "../public", routes.get(canonical).file));
};
