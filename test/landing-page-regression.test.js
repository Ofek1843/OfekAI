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

test("landing hides low-count social proof and keeps the primary CTA hooks", () => {
  const html = read("public/index.html");
  const landingJs = read("public/js/landing.js");

  assert.doesNotMatch(html, /publicRegisteredUsers|publicWorkoutPlans|landing-stats|FuelPhysique community totals/i);
  assert.match(html, /id="buildProgramCta"/);
  assert.match(html, /id="builderChooser"/);
  assert.doesNotMatch(landingJs, /\/api\/public-social-proof|publicRegisteredUsers|publicWorkoutPlans|renderSocialProofCount/);
});

test("landing language choices keep English first and order remaining options consistently", () => {
  const html = read("public/index.html");
  const options = [...html.matchAll(/<option value="([a-z]+)"/g)].map((match) => match[1]);

  assert.deepEqual(options, ["en", "ar", "zh", "fr", "de", "he", "es"]);
  assert.match(html, /<option value="en" selected>English<\/option>/);
});

test("landing mobile cards are forced into readable single-column layout", () => {
  const css = read("public/css/site-quality.css");
  const landing = read("public/index.html");

  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /grid-auto-flow: row !important/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.match(css, /background: #0d2236 !important/);
  assert.match(css, /word-break: normal !important/);
  assert.match(css, /position: fixed !important;[\s\S]*?margin: auto !important/);
  assert.match(landing, /site-quality\.css\?v=20261007-mobile-clarity-2/);
});

test("mobile PWA instructions keep their action button legible and bounded", () => {
  const pwa = read("public/js/pwa-install.js");
  const html = read("public/index.html");

  assert.match(pwa, /\.pwa-install-btn\.primary\s*\{[\s\S]*?background: #47b7ff !important;[\s\S]*?color: #061323 !important/);
  assert.match(pwa, /max-height: min\(230px/);
  assert.match(html, /pwa-install\.js\?v=20261007-install-contrast-1/);
});

test("landing tool previews explain each workflow with quick localized motion", () => {
  const ux = read("public/js/simple-ux.js");
  const css = read("public/css/simple-ux.css");
  const landing = read("public/js/landing.js");
  const illustrationCss = read("public/css/illustrated-v4.css");

  for (const language of ["en", "he", "ar", "es", "fr", "de", "zh"]) {
    assert.match(ux, new RegExp(`${language}:\\[\\[`), `${language} needs translated workflow stage labels`);
  }
  assert.match(ux, /simple-preview-stage/);
  assert.match(ux, /2400\);/);
  assert.match(css, /simple-row 720ms/);
  assert.match(landing, /setActive\(index \+ 1\), 1300\)/);
  assert.match(illustrationCss, /--motion-illustrative-training: 1250ms/);
  assert.match(illustrationCss, /--motion-illustrative-deadlift: 1700ms/);
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
  assert.doesNotMatch(html, /<form[^>]+hidden/);
  assert.match(html, /<noscript>/);
  assert.match(html, /id="beforePhoto"[^>]+type="file"[^>]+required/);
  assert.match(html, /id="afterPhoto"[^>]+type="file"[^>]+required/);
  assert.match(html, /id="beforePhotoPreview"/);
  assert.match(html, /id="afterPhotoPreview"/);
  assert.match(html, /id="durationValue"[^>]+type="number"[^>]+required/);
  assert.match(html, /id="processType"[^>]+required/);
  assert.match(html, /name="toolsUsed"[^>]+value="workout-plans"/);
  assert.match(html, /name="toolsUsed"[^>]+value="nutrition-plans"/);
  assert.match(html, /name="toolsUsed"[^>]+value="workout-tracking"/);
  assert.match(html, /data-consent="ownsPhotos"[^>]+required/);
  assert.match(html, /data-consent="adultsOnly"[^>]+required/);
  assert.match(html, /data-consent="notAutomatic"[^>]+required/);
  assert.match(html, /data-consent="explicitPublication"[^>]+required/);
  assert.match(html, /id="anonymousDisplay"[^>]+checked/);
});

test("transformation submission remains visible before auth and localizes Hebrew copy", () => {
  const html = read("public/transformation-submit.html");
  const submitJs = read("public/js/transformation-submit.js");

  assert.match(html, /id="submissionAuthWarning"/);
  assert.doesNotMatch(html, /id="submissionAuthWarning" hidden/);
  assert.doesNotMatch(submitJs, /form\.hidden\s*=/);
  // The warning is hidden only for a signed-in AND verified user -- an
  // unverified email/password user must still see it (see
  // shouldBlockUnverifiedAccess in verification-gate.js).
  assert.match(submitJs, /authWarning\.hidden = isUsable/);
  assert.match(submitJs, /shouldBlockUnverifiedAccess/);
  assert.match(submitJs, /אפשר למלא את הטופס עכשיו/);
  assert.match(submitJs, /שליחת התהליך שלך/);
  assert.match(submitJs, /missingTools/);
  assert.match(submitJs, /tools\.length === 0/);
});

test("transformation submission essential content is visible without reveal observer", () => {
  const html = read("public/transformation-submit.html");
  const css = read("public/css/transformation-submit.css");

  assert.doesNotMatch(html, /class="submission-hero[^"]*reveal-on-scroll/);
  assert.doesNotMatch(html, /class="submission-card[^"]*reveal-on-scroll/);
  assert.match(css, /\.submission-page \.submission-hero,\s*\.submission-page \.submission-card\s*{\s*opacity: 1;\s*transform: none;/);
  assert.doesNotMatch(css, /\.submission-page \.submission-hero[^}]*opacity:\s*0/);
  assert.doesNotMatch(css, /\.submission-page \.submission-card[^}]*opacity:\s*0/);
  assert.doesNotMatch(html, /landing\.js/);
  assert.match(html, /id="transformationSubmissionForm"/);
  assert.match(html, /id="beforePhoto"[^>]+required/);
  assert.match(html, /id="afterPhoto"[^>]+required/);
  assert.match(html, /id="durationValue"[^>]+required/);
  assert.match(html, /id="processType"[^>]+required/);
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
