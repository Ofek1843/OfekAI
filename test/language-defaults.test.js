const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const I18N = fs.readFileSync(path.join(ROOT, "public", "js", "i18n.js"), "utf8");
const AUTH = fs.readFileSync(path.join(ROOT, "public", "auth.html"), "utf8");
const LANDING = fs.readFileSync(path.join(ROOT, "public", "index.html"), "utf8");

test("new and anonymous visitors default to English instead of browser locale", () => {
  assert.match(I18N, /export function getLanguage\(\)[\s\S]*?return "en";/);
  assert.doesNotMatch(I18N.slice(I18N.indexOf("export function getLanguage()")), /return detectBrowserLanguage\(\)/);
  assert.doesNotMatch(AUTH, /HE\s*\/\s*EN|EN\s*\/\s*HE/i);
  assert.doesNotMatch(LANDING, /HE\s*\/\s*EN|EN\s*\/\s*HE/i);
});

test("Hebrew remains an explicit authenticated settings preference", () => {
  const settings = fs.readFileSync(path.join(ROOT, "public", "app.html"), "utf8");
  const settingsScript = fs.readFileSync(path.join(ROOT, "public", "js", "settings.js"), "utf8");
  assert.match(settings, /settingsLanguage/);
  assert.match(settingsScript, /ofek-ai-language/);
  assert.match(settingsScript, /settings\.language/);
});
