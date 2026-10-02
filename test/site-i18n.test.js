const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const I18N = fs.readFileSync(path.join(PUBLIC, "js", "i18n.js"), "utf8");
const SHARED = I18N.slice(I18N.indexOf("const SITE_UI_TRANSLATIONS = {"), I18N.indexOf("for (const language of Object.keys(SITE_UI_TRANSLATIONS))"));
const SHELL = fs.readFileSync(path.join(PUBLIC, "js", "redesign-shell.js"), "utf8");
const SW = fs.readFileSync(path.join(PUBLIC, "sw.js"), "utf8");

test("the shared locale runtime covers all seven supported languages with common UI terms", () => {
  const supported = ["en", "he", "es", "fr", "de", "ar", "zh"];
  for (const language of supported) {
    assert.match(SHARED, new RegExp(`\\b${language}: \\{`));
    const localeBlock = SHARED.match(new RegExp(`\\b${language}: \\{([\\s\\S]*?)\\n  \\}(?:,|\\n)`))?.[1];
    assert.ok(localeBlock, `${language} translation block should exist`);
    for (const phrase of ["save:", "search:", "loading:", "primaryGoal:", "calories:", "exercise:", "whatDidYouEat:"]) {
      assert.ok(localeBlock.includes(phrase), `${language} should translate ${phrase}`);
    }
    if (!['en', 'he'].includes(language)) {
      for (const phrase of ["landingResultsTitle:", "landingTransformationInviteText:", "landingTransformationInvitePrivacy:"]) {
        assert.ok(localeBlock.includes(phrase), `${language} should translate ${phrase}`);
      }
    }
  }
});

test("the site shell applies translations on every route and supports dynamically rendered UI", () => {
  assert.match(SHELL, /import\("\.\/i18n\.js\?v=20261002-brand-quality-1"\)/);
  assert.match(SHELL, /applyLanguageCopy\?\.\(language\)/);
  assert.match(SHELL, /ofekai:settings-saved/);
  assert.match(I18N, /new MutationObserver/);
  assert.match(I18N, /translatedTextNodes/);
  assert.match(I18N, /\.user-content,\.user-message,\.coach-message,\.chat-message/);

  const pages = fs.readdirSync(PUBLIC).filter((file) => file.endsWith(".html"));
  assert.ok(pages.length >= 35);
  for (const page of pages) {
    const html = fs.readFileSync(path.join(PUBLIC, page), "utf8");
    assert.match(html, /redesign-shell\.js\?v=20261002-brand-quality-1/, `${page} should load the shared localization shell`);
  }
  assert.match(SW, /\/js\/i18n\.js\?v=20261002-brand-quality-1/);
});

test("Arabic and Hebrew use RTL while invalid or missing locale falls back to English", () => {
  assert.match(I18N, /return \["he", "ar"\]\.includes\(lang\)/);
  assert.match(I18N, /supported\.includes\(lang\)[\s\S]*?: "en"/);
  assert.match(I18N, /const language = translations\[lang\] \? lang : "en"/);
});
