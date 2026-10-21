# Feature SEO: final validation and release readiness

Status on 21 October 2026: **READY WITH WARNINGS for a reviewed, manual release**.
This is a local implementation; it has not been pushed or deployed. The seven
public URLs, content, metadata, links, redirects and sitemap passed local
checks. Existing unrelated regression failures and unavailable emulator/live
account tests remain disclosed below. This is not a claim of Google indexing,
Core Web Vitals field results, GA4 delivery or completed live signup.

## Scope and fixes in this validation pass

- Confirmed the six differentiated feature pages and `/features` hub expose
  complete HTML without JavaScript, unique title/H1/description/canonical,
  accurate sample previews and links to the actual tools. The existing workout
  generator URL stays canonical; `.html` aliases for clean feature URLs 301
  redirect, and unknown feature URLs return 404. Private application pages
  retain noindex and are excluded from the sitemap.
- Confirmed all local image paths and link targets in the generated pages.
  The public workout preview uses two existing small WebP images (48 and 53 KB)
  instead of large PNGs. The SEO stylesheet is 6.5 KB; the shared preview
  stylesheet is 4 KB. Images have explicit dimensions and lazy decoding.
  Increased the small preview explanation text to 14 px for readability.
- Corrected Google clicks on the **login** tab being recorded as signup starts.
  A start is now recorded only when the signup tab is selected. Completed
  Google signup remains based on Firebase's `isNewUser` result.
- Deduplicated `signup_started` by method across the same browser session's
  landing-to-auth navigation (30-minute window), not just within one page.
- Restricted new feature analytics events to fixed feature/placement values
  and the fixed `nutrition` builder value both before the first-party request
  and at the server sanitizer. Referrer telemetry now retains only the origin,
  never URL paths or query strings. Consent remains required for GA4 events.
  A rejected `sendBeacon` now falls back to `fetch` rather than silently
  dropping an event. No new analytics ID, tag, provider or Meta Pixel was added.

## Validation performed

- `node scripts/build-feature-pages.js --check`: passed; all six pages, hub
  and sitemap are current.
- `lint` (46 syntax checks), `postlint` (2 checks), additional SEO JS syntax
  checks and `git diff --check`: passed.
- Focused SEO/analytics/auth/guest tests: **120/120 passed**.
- Full standard suite: **1,522 total; 1,512 passed; 10 failed**. The same ten
  named tests failed before the final analytics changes. None tests a new SEO
  route or changed metadata. See the exact baseline comparison below.
- Local Express server: all seven public URLs, `/robots.txt` and
  `/sitemap.xml` returned 200; a backing HTML alias returned 301 to its
  canonical route; an unknown feature route returned 404. The route test also
  covers HEAD and preserved query parameters.
- Browser journey: hub → meal page → meal builder; meal page → food-diary page
  → three-entry guest diary; workout page → workout builder. The local guest
  diary accepted a sample `50g oats` entry and updated its calorie/macro
  summary. No production account or user data was used.
- Desktop and mobile layout checks at 1440, 390 and 320 px were completed in
  the preceding implementation pass; the 320 px heading overflow was fixed
  and rechecked. Semantic headings, keyboard skip link, focus styling,
  visible CTA destinations, labeled sample previews and reduced-motion rule
  were reviewed. No Lighthouse lab run or real-user Core Web Vitals data is
  available, so no CWV pass is claimed.
- The local load test from the implementation pass completed all static and
  health scenarios with zero errors, timeouts or non-2xx responses. Its local
  timings are not production Core Web Vitals.

## Ten existing standard-suite failures

All nine failing test files are unchanged from `HEAD`. The unchanged product
files named below already contain the conflicting state in `HEAD`, which is
also the currently live Render commit (`7026ffce62313b16ae7e978791b2fcbfd1306c1e`).
The two product files touched for SEO, `server.js` and
`public/js/nutrition-builder.js`, have only an additive route/navigation change
and a meal-generation analytics call; they do not alter the failing reroll
assertion. This is a source-level baseline comparison, not a separate clean
`HEAD` suite run.

| Failing test | Baseline evidence / observed mismatch |
| --- | --- |
| `current-product-contract.test.js` — cache generation | Test expects dashboard view cache key `20261015-plan-tabs-1`; `HEAD` service worker already has `20261020-guest-dashboard-1`. |
| `nutrition-dashboard-polish.test.mjs` — saved dish contrast | Test expects an old `simple-ux.js` selector string; the unchanged `HEAD` file no longer has that exact branch. |
| `pwa-installability.test.js` — install guidance | Test regex expects `guardProtectedPage({onAuthenticated:` ordering in `dashboard-editorial.js`; the unchanged `HEAD` source uses a different guard shape. |
| `saved-nutrition-view.test.mjs` — older meal photo | Test expects an unversioned WebP URL; the unchanged `HEAD` photo helper appends `?v=20261018-meal-photo-1`. |
| `v45-regression-recovery.test.js` — reroll controls | Test expects `exclude: [...usedMealIds, ...rerollHistory]`; `HEAD` server already uses `activeMealIds, currentMealId, ...rerollHistory`. |
| `v46-nutrition-mobile.test.js` — optional daily data | Its isolated VM invocation lacks `normalizeLog`, which the unchanged `HEAD` diary initialization now calls. |
| `workout-builder-assets.test.js` — exercise images | Test expects the older `20261015-curl-2` cache suffix; `HEAD` image resolver uses `20261018-guides-6`. |
| `workout-mobile-results-v2.test.js` — builder assets | Test expects `workout-builder.js?v=20261014-rir-1`; unchanged `HEAD` HTML has `20261020-guest-resume-1`. |
| `workout-view-navigation.test.mjs` — Back Extension | Test expects an unversioned image URL; unchanged `HEAD` image resolver appends `?v=20261018-guides-6`. |
| `workout-view-navigation.test.mjs` — incline press/sit-ups | Same unversioned-image expectation against the unchanged `HEAD` resolver. |

These tests were **not weakened or disabled**. Their repair should be a
separate product/test-maintenance task with behavioral review, not part of a
small SEO release.

## Emulator and live-service limits

The Firebase Emulator test runner previously failed before tests could start:
this Windows host exposes Java `1.8.0_503` only, while the installed Firebase
CLI requires Java 11 or newer. No compatible JDK was found in the available
program directories or `PATH`; no machine-wide software was installed as part
of this audit. Install/use an approved Java 11+ runtime, then run
`node scripts/run-tests-with-emulators.js` before or immediately after the
release, according to the team's release policy.

The local server has no production OpenAI API key or Firebase test account.
Therefore a real plan generation, Google/email account creation, saved workout
tracking, saved nutrition tracking, Firestore authorization and live signup
conversion could not be completed end-to-end here. Existing auth, guest,
builder, tracking and rules-related local tests remain the available evidence.
Do not use production user data for this verification.

GA4 consent code contains measurement ID `G-1HG905SBV4`, also present in the
Firebase browser config. The tag loads only after opt-in; `seo_landing_view`
is distinct from the ordinary GA page view. New event forwarding is limited
to safe enum values. This verifies code configuration, not ownership of that
GA4 property or receipt of production events. Google Analytics DebugView and
Search Console require owner-side checks after deployment.

## Files within the SEO change set

Shared implementation: `lib/seo-feature-content.js`,
`lib/seo-feature-pages.js`, `lib/seo-feature-router.js`,
`scripts/build-feature-pages.js`, `server.js`, `package.json`.

Public pages and assets: `public/features/index.html`, the five generated
`public/features/*.html` pages, `public/workout-plan-generator.html`,
`public/css/seo-features.css`, `public/js/seo-features.js`,
`public/index.html`, `public/robots.txt`, `public/sitemap.xml`.

Conversion tracking: `public/js/analytics.js`, `public/js/auth.js`,
`public/js/nutrition-builder.js`, `lib/fuelphysique-policy.js`.

Tests/docs: `test/seo-feature-pages.test.js`,
`test/seo-feature-analytics.test.js`, `test/technical-seo-foundation.test.js`,
`test/google-auth.test.js`, `test/complete-redesign.test.js`,
`test/theme-regression.test.js`, `test/product-editorial.test.mjs`,
`test/helpers/current-product.cjs`, `docs/seo-landing-system.md` and this
report. Unrelated dirty `node_modules`, telemetry-agent, image-audit outputs
and other audit files were not changed for this release and must not be staged.

## Exact manual release sequence — not performed

1. Review the scoped diff and generated files. Stage **only** the listed SEO
   files, not the unrelated dirty worktree files. Verify
   `node scripts/build-feature-pages.js --check` and the focused tests once
   more. Commit the generated HTML and sitemap with the renderer; otherwise
   Render will not generate them during build.
2. After explicit release approval, push the reviewed commit to the GitHub
   `main` branch of `https://github.com/Ofek1843/OfekAI`. Confirm the exact
   commit SHA and keep the previous live SHA above for rollback.
3. The connected Render service is `OfekAI` (`srv-d7b12fdm5p6s73aldlj0`)
   in the `FuelPhysique` workspace (`tea-d7b104dm5p6s73alc36g`). It tracks
   `main`, has **autoDeploy off**, runs `npm install` as build command and
   `npm start` as start command. After the approved push, trigger one manual
   deploy of that same commit, verify the resulting deployed SHA and healthy
   status. No Render environment or Firebase setting change is required for
   these static SEO pages.
4. Smoke-test production: seven pages and sitemap/robots return 200, aliases
   301, unknown feature route 404; inspect initial HTML, canonical and noindex
   separation. Verify CTA links on desktop and mobile, then use disposable
   test accounts for signup and generation where permitted. If release checks
   fail, restore the prior live commit using the team's reviewed Render
   rollback/redeploy procedure.
5. In Google Search Console, verify ownership of the `fuelphysique.com`
   property, submit `https://fuelphysique.com/sitemap.xml`, and inspect sample
   feature URLs. Submission does not guarantee indexing. With consent enabled
   in a test browser, inspect GA4 DebugView for `seo_landing_view`,
   `seo_cta_click`, `signup_started`, `sign_up`, `workout_generated` and
   `nutrition_generated`; confirm counts and feature attribution, without
   entering personal or health data in analytics tests.

Owner action required now: approve the scoped commit/push/deploy separately
if you want this released. Until then, production remains unchanged.
