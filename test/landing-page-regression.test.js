const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("landing page no longer exposes Public Beta copy", () => {
  const html = read("public/index.html");
  const landingJs = read("public/js/landing.js");
  const visibleText = `${html}\n${landingJs}`;

  assert.match(visibleText, /EARLY ACCESS/);
  assert.doesNotMatch(visibleText, /PUBLIC BETA/i);
  assert.doesNotMatch(visibleText, />[^<]*Public beta[^<]*</i);
});

test("landing live counter IDs and primary CTA hooks remain intact", () => {
  const html = read("public/index.html");
  const landingJs = read("public/js/landing.js");

  assert.match(html, /id="publicRegisteredUsers"/);
  assert.match(html, /id="publicWorkoutPlans"/);
  assert.match(html, /id="buildProgramCta"/);
  assert.match(html, /id="builderChooser"/);
  assert.match(landingJs, /\/api\/public-stats/);
  assert.match(landingJs, /animateNumber\(document\.getElementById\("publicRegisteredUsers"\)/);
  assert.match(landingJs, /animateNumber\(document\.getElementById\("publicWorkoutPlans"\)/);
});

test("landing contains both verified transformation stories and comparison labels", () => {
  const html = read("public/index.html");

  assert.match(html, /data-result-story="user-transformation"/);
  assert.match(html, /data-result-story="two-month-transformation"/);
  assert.match(html, /progress-bulk\.jpg/);
  assert.match(html, /progress-cutting\.jpg/);
  assert.match(html, /before2\.jpeg/);
  assert.match(html, /after2\.jpeg/);
  assert.match(html, /landingBeforeLabel/);
  assert.match(html, /landingAfterLabel/);
  assert.match(html, /landingResultThreeMonths/);
  assert.match(html, /landingResultTwoMonths/);
  assert.match(html, /landingResultTwoTitle/);
  assert.match(html, /Individual results vary/);
  assert.equal((html.match(/data-comparison-slider/g) || []).length, 2);
  assert.equal((html.match(/class="comparison-range"/g) || []).length, 2);
  assert.equal((html.match(/value="50"/g) || []).length, 2);
  assert.equal((html.match(/comparison-hint/g) || []).length, 2);
  assert.match(html, /landingCompareHint/);
});

test("dashboard public progress teaser markup was removed", () => {
  const dashboard = read("public/dashboard.html");

  assert.doesNotMatch(dashboard, /progress-teaser-card/);
  assert.doesNotMatch(dashboard, /REAL RESULTS/);
  assert.doesNotMatch(dashboard, /This is what 12 weeks on FuelPhysique looks like/);
});

test("new landing translation keys exist in English and Hebrew fallbacks", () => {
  const landingJs = read("public/js/landing.js");
  const requiredKeys = [
    "landingSystemTitle",
    "landingResultsTitle",
    "landingResultThreeTitle",
    "landingResultTwoMonths",
    "landingResultTwoTitle",
    "landingResultsDisclaimer",
    "landingFinalTitle",
    "landingFinalButton"
  ];

  for (const key of requiredKeys) {
    const occurrences = landingJs.match(new RegExp(`${key}:`, "g")) || [];
    assert.equal(occurrences.length, 2, `${key} should exist in en and he fallbacks`);
  }

  assert.match(landingJs, /2-month transformation/);
  assert.match(landingJs, /שינוי במשך חודשיים/);
});

test("landing transformation community CTA exists in English and Hebrew", () => {
  const html = read("public/index.html");
  const landingJs = read("public/js/landing.js");
  const i18n = read("public/js/i18n.js");

  assert.match(html, /class="transformation-invite"/);
  assert.match(html, /href="\/transformation-submit\.html"/);
  assert.match(html, /landingTransformationInviteTitle/);
  assert.match(html, /landingTransformationInviteButton/);
  assert.match(landingJs, /Have you documented a body transformation while using FuelPhysique tools\?/);
  assert.match(landingJs, /יש לכם שינוי בגוף שתיעדתם בעזרת כלי FuelPhysique\?/);
  assert.match(i18n, /Submit my transformation/);
  assert.match(i18n, /שליחת התהליך שלי/);
});

test("transformation submission form requires files duration process and consent", () => {
  const html = read("public/transformation-submit.html");

  assert.match(html, /id="transformationSubmissionForm"/);
  assert.match(html, /id="beforePhoto"[^>]+type="file"[^>]+required/);
  assert.match(html, /id="afterPhoto"[^>]+type="file"[^>]+required/);
  assert.match(html, /id="durationValue"[^>]+type="number"[^>]+required/);
  assert.match(html, /id="processType"[^>]+required/);
  assert.match(html, /data-consent="ownsPhotos"[^>]+required/);
  assert.match(html, /data-consent="adultsOnly"[^>]+required/);
  assert.match(html, /data-consent="notAutomatic"[^>]+required/);
  assert.match(html, /data-consent="explicitPublication"[^>]+required/);
  assert.match(html, /id="anonymousDisplay"[^>]+checked/);
});

test("transformation submission stores private pending metadata and never auto-publishes", () => {
  const submitJs = read("public/js/transformation-submit.js");

  assert.match(submitJs, /status: "pending"/);
  assert.match(submitJs, /publicationStatus: "private"/);
  assert.match(submitJs, /moderationStatus: "pending"/);
  assert.match(submitJs, /autoPublish: false/);
  assert.match(submitJs, /publicPublicationApproved: false/);
  assert.match(submitJs, /publicPublicationRequiresExplicitConsent: true/);
  assert.match(submitJs, /users\/\$\{userId\}\/transformationSubmissions\/\$\{submissionId\}/);
  assert.doesNotMatch(submitJs, /public\/images/);
  assert.doesNotMatch(submitJs, /images\/demo/);
});
