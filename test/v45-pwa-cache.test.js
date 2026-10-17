"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sw = fs.readFileSync(path.join(__dirname, "..", "public", "sw.js"), "utf8");

test("V4.5 cache generation includes the Deep Ocean daily nutrition shell", () => {
  require("./helpers/current-product.cjs").assertCurrentCache(sw);
  for (const asset of [
    "/daily-nutrition.html",
    "/css/workout-builder.css?v=20261014-rir-1",
    "/css/v45-deep-ocean.css?v=20260914-i18n-dashboard-1",
    "/css/daily-nutrition.css?v=20260918-daily-resilience-1",
    "/js/daily-nutrition.js?v=20260928-language-coverage-1",
    "/js/daily-nutrition-domain.mjs?v=20260928-multilingual-food-1",
    "/js/daily-nutrition-store.mjs?v=20260928-multilingual-food-1",
    "/js/daily-nutrition-i18n.mjs?v=20260928-language-coverage-1",
    "/js/daily-nutrition-format.mjs?v=20260914-i18n-dashboard-1"
  ]) require('./helpers/current-product.cjs').assertCachedAsset(sw,asset);
});

test("V4.5 cache keeps auth, API, Firebase, ImageKit and voice media network-only", () => {
  assert.match(sw, /NETWORK_ONLY_PREFIXES = \['\/api\/'\]/);
  assert.match(sw, /AUTH_PROXY_PREFIX = '\/__\/auth\/'/);
  assert.match(sw, /event\.request\.destination === 'audio'/);
  assert.match(sw, /event\.request\.url\.includes\('imagekit\.io'\)/);
  assert.match(sw, /AUTH_INFRASTRUCTURE_ORIGINS\.has\(requestUrl\.origin\)/);
  assert.match(sw, /requestPath\.startsWith\(AUTH_PROXY_PREFIX\)/);
});
