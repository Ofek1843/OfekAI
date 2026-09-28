const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const I18N = fs.readFileSync(path.join(ROOT, "public", "js", "i18n.js"), "utf8");
const AUTH = fs.readFileSync(path.join(ROOT, "public", "auth.html"), "utf8");
const LANDING = fs.readFileSync(path.join(ROOT, "public", "index.html"), "utf8");

test("new visitors default to English and can choose any supported landing-page language", () => {
  assert.match(I18N, /export function getLanguage\(\)[\s\S]*?return "en";/);
  assert.doesNotMatch(I18N.slice(I18N.indexOf("export function getLanguage()")), /return detectBrowserLanguage\(\)/);
  assert.doesNotMatch(AUTH, /HE\s*\/\s*EN|EN\s*\/\s*HE/i);
  assert.match(LANDING, /<html lang="en" dir="ltr">/);
  assert.match(LANDING, /id="languageWelcomeDialog"/);
  assert.match(LANDING, /window\.__fpLanguageWelcomeRequired = localStorage\.getItem\("ofek-ai-language-welcome-complete"\) !== "1"/);
  assert.match(LANDING, /ofek-ai-language-welcome-complete/);
  assert.match(LANDING, /window\.__fpLanguageWelcomeRequired = localStorage\.getItem\("ofek-ai-language-welcome-complete"\) !== "1"/);
  assert.match(LANDING, /<option value="en" selected>English<\/option>/);
  for (const language of ["en", "he", "es", "fr", "de", "ar", "zh"]) {
    assert.match(LANDING, new RegExp(`<option value="${language}"`));
  }
  const landingScript = fs.readFileSync(path.join(ROOT, "public", "js", "landing.js"), "utf8");
  assert.match(landingScript, /window\.__fpLanguageWelcomeRequired/);
  assert.match(landingScript, /setLanguage\(language\)/);
  assert.match(landingScript, /setItem\("ofek-ai-language-welcome-complete", "1"\)/);
  assert.match(landingScript, /setItem\("ofek-ai-language-welcome-complete", "1"\)/);
  assert.match(LANDING, /Continue in Hebrew/);
  assert.match(I18N, /const current = supported\.includes\(lang\)[\s\S]*?: "en";/);
});

test("Hebrew remains an explicit authenticated settings preference", () => {
  const settings = fs.readFileSync(path.join(ROOT, "public", "app.html"), "utf8");
  const settingsScript = fs.readFileSync(path.join(ROOT, "public", "js", "settings.js"), "utf8");
  assert.match(settings, /settingsLanguage/);
  assert.match(settingsScript, /ofek-ai-language/);
  assert.match(settingsScript, /settings\.language/);
});

test("supported locale and RTL direction are preserved by core workout and nutrition flows", () => {
  const files = [
    "daily-nutrition.js",
    "workout-builder.js",
    "nutrition-builder.js",
    "manual-workout-builder.js",
    "manual-nutrition-builder.js"
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, "public", "js", file), "utf8");
    assert.match(source, /\["en",\s*"he",\s*"es",\s*"fr",\s*"de",\s*"ar",\s*"zh"\]/, `${file} should accept every supported locale`);
    assert.match(source, /\["he",\s*"ar"\]\.includes\(/, `${file} should set RTL for Hebrew and Arabic`);
  }
  const nutritionBuilder = fs.readFileSync(path.join(ROOT, "public", "js", "nutrition-builder.js"), "utf8");
  assert.match(nutritionBuilder, /language: currentLanguage/);
});
