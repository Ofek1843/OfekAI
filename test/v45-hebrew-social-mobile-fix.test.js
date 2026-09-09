"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

test("late V4.5 rules preserve crisp Hebrew typography and a vertical top-layer drawer", () => {
  const css = read("public", "css", "v45-deep-ocean.css");
  assert.match(css, /html\[dir="rtl"\] body\.fp-v45-deep-ocean\s*\{[^}]*font-family:\s*"Segoe UI"/s);
  assert.match(css, /html\[dir="rtl"\] body\.fp-v45-deep-ocean :where\(h1,[\s\S]*?letter-spacing:\s*normal !important[\s\S]*?text-transform:\s*none !important/);
  assert.match(css, /body\.fp-v45-deep-ocean \.fp-global-menu\s*\{[^}]*z-index:\s*5002 !important[^}]*flex-direction:\s*column/s);
  assert.match(css, /body\.fp-v45-deep-ocean \.fp-global-menu-group\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) !important/s);
  assert.match(css, /body\.fp-v45-deep-ocean \.fp-global-menu-backdrop\s*\{[^}]*z-index:\s*5001 !important/s);
  assert.match(css, /body\.fp-v45-deep-ocean\.fp-global-menu-open \.fp-global-nav\s*\{[^}]*z-index:\s*6000 !important/s);
  assert.match(css, /body\.fp-v45-deep-ocean\.fp-global-menu-open > :not\(\.fp-global-nav\):not\(\.site-feedback-widget\)\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /html\[dir="rtl"\] body\.fp-v45-deep-ocean\.fp-route-dashboard \.dashboard-compact-header \.hero-copy h1,[\s\S]*?-webkit-text-fill-color:\s*currentColor !important/);
});

test("Social loads the ocean layer and keeps Hebrew when the settings read is unavailable", () => {
  const html = read("public", "social.html");
  const client = read("public", "js", "social.js");
  const css = read("public", "css", "v45-deep-ocean.css");
  assert.ok(html.includes('/css/v45-deep-ocean.css?v=20260822-v45-rtl-hebrew-animation-fix-1'));
  assert.match(client, /let language = localLanguage\(\)/);
  assert.match(client, /async function loadSavedLanguage\(\)[\s\S]*?catch\s*\{[\s\S]*?language = saved === "he" \|\| saved === "en" \? saved : localLanguage\(\)/);
  assert.match(client, /privateSpace:\s*"מרחב פרטי"/);
  assert.match(client, /document\.title = language === "he"/);
  assert.match(css, /body\.fp-v45-deep-ocean\.fp-route-social\s*\{[\s\S]*?--social-panel:\s*rgba\(10, 31, 53, 0\.92\)/);
  assert.match(css, /body\.fp-global-menu-open\.fp-route-social \.social-shell\s*\{[^}]*pointer-events:\s*none/s);
});

test("real-athlete hosts cannot block nutrition actions and mobile card spacing is bounded", () => {
  for (const file of ["illustrated-v4.css", path.join("scenes", "image-sequence-v43.css")]) {
    const css = read("public", "css", file);
    assert.match(css, /\.fp-route-dashboard \.capability-illustration\[data-v43-motion="prototype"\]\s*\{[^}]*pointer-events:\s*none/s);
    assert.match(css, /\.capability-card--nutrition \.capability-illustration\[data-v43-motion="prototype"\]\s*\{[^}]*height:\s*44% !important/s);
    assert.match(css, /\.fp-route-dashboard \.capability-card--training\s*\{\s*min-height:\s*430px !important/);
    assert.match(css, /#v43-bench-review\s*\{\s*min-height:\s*450px/);
  }
});

test("daily and saved nutrition Hebrew copy is readable and no longer mojibake", () => {
  const dailyCss = read("public", "css", "daily-nutrition.css");
  const plansHtml = read("public", "my-nutrition-plans.html");
  const plansClient = read("public", "js", "my-nutrition-plans.js");
  const nutritionClient = read("public", "js", "nutrition-builder.js");
  assert.match(dailyCss, /html\[dir="rtl"\] \.daily-nutrition-shell :where\(\.daily-kicker,[\s\S]*?text-transform:\s*none/);
  assert.match(dailyCss, /html\[dir="rtl"\] \.daily-nutrition-shell \.food-table td\[data-label\]::before\s*\{[^}]*letter-spacing:\s*normal/s);
  assert.ok(plansHtml.includes('/css/v45-deep-ocean.css?v=20260822-v45-rtl-hebrew-animation-fix-1'));
  for (const copy of ["בנייה ידנית", "עריכה", "שכפול", "גישה מוקדמת:"]) assert.ok(plansClient.includes(copy), copy);
  assert.match(plansClient, /const earlyAccessLabel = document\.querySelector\("#earlyAccessLabel"\)/);
  assert.match(plansClient, /if \(earlyAccessLabel\) earlyAccessLabel\.textContent = ui\.earlyAccessLabel/);
  assert.match(plansClient, /if \(isHebrew && earlyAccessNote\) earlyAccessNote\.innerHTML/);
  for (const copy of ["תוכנית תזונה", "רשימת קניות", "מוצרים מתוך", "הועתק ללוח", "העתקת הרשימה"]) assert.ok(nutritionClient.includes(copy), copy);
  assert.doesNotMatch(plansClient, /׳×|׳|׳¨|׳©/);
  assert.doesNotMatch(nutritionClient, /׳×|׳|׳¨|׳©/);
});

test("the service worker uses a fresh cache while keeping private routes network-only", () => {
  const sw = read("public", "sw.js");
  assert.match(sw, /CACHE_NAME = 'fuelphysique-v43-v47-motion-experience-polish-2'/);
  assert.match(sw, /NETWORK_ONLY_PREFIXES = \['\/api\/'\]/);
  assert.match(sw, /AUTH_PROXY_PREFIX = '\/__\/auth\/'/);
  assert.match(sw, /event\.request\.destination === 'audio'/);
});
