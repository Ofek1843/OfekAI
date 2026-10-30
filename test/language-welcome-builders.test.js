"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("direct entry to both plan builders loads the shared first-visit language chooser", () => {
  const scriptVersion = "20261030-flag-images-1";
  const styleVersion = "20261023-language-first-1";
  for (const [page, moduleScript] of [
    ["public/workout-builder.html", "/js/workout-builder.js"],
    ["public/nutrition-builder.html", "/js/nutrition-builder.js"]
  ]) {
    const html = read(page);
    assert.match(html, new RegExp(`/css/language-welcome\\.css\\?v=${styleVersion}`), `${page} must style the shared dialog`);
    assert.match(html, new RegExp(`/js/language-welcome\\.js\\?v=${scriptVersion}`), `${page} must load the shared chooser`);
    assert.ok(html.indexOf("language-welcome.js") < html.indexOf(moduleScript), `${page} must show the chooser before its builder module initializes`);
  }
});

test("shared language chooser injects its dialog on builder pages and respects existing language preferences", () => {
  const source = read("public/js/language-welcome.js");
  assert.match(source, /const createDialog = \(\) =>/);
  assert.match(source, /document\.body\.append\(dialog\)/);
  assert.match(source, /const browserLanguages =/);
  assert.match(source, /navigator\.language \|\| "en"/);
  assert.match(source, /if \(!completed && !savedLanguage\) dialog\.showModal\(\)/);
  assert.match(source, /openButton\?\.addEventListener/);
  for (const language of ["en", "he", "es", "fr", "de", "ar", "zh"]) {
    assert.match(source, new RegExp(`data-language="${language}"`));
  }
});
test('language flags are local SVG images instead of platform-dependent emoji', () => {
  const source = read('public/js/language-welcome.js');
  assert.match(source, /document\.createElement\('img'\)/);
  for (const code of ['us','il','es','fr','de','sa','cn']) {
    assert.match(read(`public/assets/flags/${code}.svg`), /<svg/);
  }
});
