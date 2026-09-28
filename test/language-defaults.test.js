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
  assert.match(LANDING, /<option value="en" selected>English<\/option>/);
  for (const language of ["en", "he", "es", "fr", "de", "ar", "zh"]) {
    assert.match(LANDING, new RegExp(`<option value="${language}"`));
  }
  const landingScript = fs.readFileSync(path.join(ROOT, "public", "js", "landing.js"), "utf8");
  const welcomeScript = fs.readFileSync(path.join(ROOT, "public", "js", "language-welcome.js"), "utf8");
  assert.match(welcomeScript, /ofek-ai-language-welcome-complete/);
  assert.match(LANDING, /language-welcome\.js\?v=20260928-instant-language-1/);
  assert.match(welcomeScript, /dialog\.showModal\(\)/);
  assert.ok(LANDING.indexOf("language-welcome.js") < LANDING.indexOf("<main>"), "language chooser should run before page content and the deferred landing module");
  assert.match(welcomeScript, /setItem\(completedKey, "1"\)/);
  assert.match(welcomeScript, /setItem\(languageKey, language\)/);
  assert.doesNotMatch(landingScript, /wireLanguageWelcome/);
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
