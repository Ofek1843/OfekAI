"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");
const publicDir = path.join(__dirname, "../public");
const translation = fs.readFileSync(path.join(publicDir, "js/legal-i18n.js"), "utf8");

function policy(name, language) {
  const { document } = parseHTML(fs.readFileSync(path.join(publicDir, `${name}.html`), "utf8"));
  vm.runInNewContext(translation, {
    document, location: { pathname: `/${name}.html` },
    localStorage: { getItem: () => language }
  });
  return document;
}

test("refund policy preserves mandatory rights in both displayed languages without invented guarantees", () => {
  const english = policy("refund-policy", "en");
  const hebrew = policy("refund-policy", "he");
  assert.match(english.querySelector(".legal-highlight").textContent, /does not limit mandatory cancellation, refund/);
  assert.match(hebrew.querySelector(".legal-highlight").textContent, /אינה מגבילה זכויות חובה/);
  assert.match(english.querySelectorAll(".legal-section")[1].textContent, /no additional 48-hour deadline/);
  assert.match(hebrew.querySelectorAll(".legal-section")[1].textContent, /אינה מטילה מגבלת פנייה נוספת/);
  assert.doesNotMatch(hebrew.body.textContent, /אחריות החזרת כסף של 7 ימים|החזר מלא תוך/);
  assert.doesNotMatch(english.body.textContent, /Refunds will not be issued for dissatisfaction/);
  assert.doesNotMatch(hebrew.body.textContent, /לא יוחזרו כספים בגין חוסר שביעות רצון/);
  for (const document of [english, hebrew]) {
    assert.equal(document.querySelectorAll(".legal-section").length, 5);
    assert.ok(document.querySelector('.legal-section a[href="mailto:fuelphysiquesupport@gmail.com"]'));
    assert.ok(document.querySelector('link[rel="canonical"]').href.endsWith("/refund-policy.html"));
  }
});

test("subscription cancellation offers a contact route without excluding statutory rights", () => {
  for (const language of ["en", "he"]) {
    const document = policy("subscription-policy", language);
    const cancellation = document.querySelectorAll(".legal-section")[2];
    assert.ok(cancellation.querySelector('a[href="mailto:fuelphysiquesupport@gmail.com"]'));
    assert.ok(cancellation.querySelector('a[href="/refund-policy.html"]'));
    assert.match(cancellation.textContent, language === "en" ? /does not limit them/ : /אינה מגבילה אותן/);
    assert.match(document.querySelector(".legal-hero-meta").textContent, /2026/);
  }
});

test("privacy notice distinguishes feature-required inputs from a blanket optional promise", () => {
  const english = policy("privacy", "en");
  const hebrew = policy("privacy", "he");
  assert.doesNotMatch(english.querySelector("#collect").textContent, /All optional/);
  assert.match(english.querySelector("#collect").textContent, /Some inputs are required/);
  assert.match(hebrew.querySelector("#collect").textContent, /חלק מהנתונים נדרשים לתכונה/);
  assert.match(english.querySelector("#use").textContent, /does not load until you accept it/);
  assert.match(hebrew.querySelector("#use").textContent, /אינו נטען עד לאישור/);
});
