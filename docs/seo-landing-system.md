# Feature landing pages: audit and rollout

## Audit before implementation — 20 October 2026

The app is CommonJS Express serving HTML and browser JavaScript on Render.
Firebase provides authentication and account storage, not public-page rendering.
`server.js` serves `/exercise-library` as server-rendered HTML; other public
pages are static. The existing `/workout-plan-generator.html` already targets
workout planning and should retain its canonical URL.

The homepage has metadata, consent-based GA4 and a sitemap. The existing
workout landing page has stale early-access language and sends visitors to
authentication before they can explore the builder. Dedicated meal-planning,
diary, workout-logging, planned-volume and body-progress explanations are
missing. Private application pages have noindex; this must remain intact.

Verified feature evidence:

| Feature | Implementation evidence | Important boundary |
| --- | --- | --- |
| Workout planning | `public/js/workout-builder.js`, `server.js`, workout engine | Gym, calisthenics and hybrid use the same builder; no separate doorway pages |
| Meal planning | `public/js/nutrition-builder.js`, server nutrition builder and meal catalog | A day of meals, not a promised seven-day menu; quantities and estimates need review |
| Food diary | `public/js/daily-nutrition.js`, diary domain/store | Guest trial: three entries; account needed to save; no barcode-scanning claim |
| Workout logging | `public/workout-tracker.html`, `public/js/workout-tracker.js` | Requires an account and active saved plan |
| Weekly muscle volume | `public/js/saved-workout-volume.mjs`, workout volume data | Planned weekly sets with fractional contributions, not completed-workout adherence |
| Body progress | `public/js/progress.js`, `public/js/progress-report.mjs` | Weight, averages, measurements and optional private photo comparison; not diagnosis |

## Strategy and sequence

1. Central content/metadata records and a dependency-free static HTML renderer.
2. Upgrade the existing workout URL and add meal and diary pages plus a hub.
3. Validate initial HTML, navigation, metadata and routes before adding the
   distinct tracking, planned-volume and progress pages.
4. Integrate sitemap/internal links and safe events into existing analytics.
5. Run generation, route/content/privacy tests and browser layout checks.

No framework migration, new paid service, authentication/rules changes or
production deployment is part of this implementation.

## Search intent and prioritization

These are keyword hypotheses, not measured volumes, keyword difficulty scores
or traffic forecasts. Current search results for workout generators and meal
planners show tool-seeking intent (for example
[FitCraft's workout tool](https://getfitcraft.com/tools/ai-workout-generator),
[Eat This Much](https://www.eatthismuch.com/) and
[Prospre](https://www.prospre.io/)). These references inform intent only, not
claims about FuelPhysique or competitor market share. No paid keyword dataset
or Search Console performance export was available.

| Priority / page | Primary keyword | Secondary intent variants | Audience / problem / product response | CTA |
| --- | --- | --- | --- | --- |
| 1 `/workout-plan-generator.html` | AI workout plan generator | personalized workout plan; workout plan builder; gym workout planner; calisthenics workout planner | People needing a routine that fits their experience, equipment and week; configurable builder | Build my workout plan |
| 1 `/features/meal-plan-generator` | personalized meal plan generator | AI meal plan generator; meal planner with macros | People unsure what and how much to eat; meal suggestions with quantities, estimates and replacements | Build my meal plan |
| 1 `/features/nutrition-tracker` | food diary and nutrition tracker | calorie tracker online; macro tracker; food log | People wanting to see logged intake and remaining targets; editable diary | Try the food diary |
| 2 `/features/workout-tracker` | workout tracker | gym workout log; set tracker; workout history | Lifters wanting continuity between sessions; log saved-plan sets and review history | Open workout tracker |
| 2 `/features/training-volume` | weekly training volume calculator | weekly sets per muscle; workout volume planner | Lifters reviewing planned workload distribution; direct and fractional set totals | Plan my weekly sets |
| 2 `/features/progress-tracking` | fitness progress tracker | body measurement tracker; weight progress tracker | People comparing measurements over time; dated records, averages and private optional photos | Start tracking progress |

All six target product/tool intent, not generic informational articles. Metadata,
H1s and exact CTA destinations live in `lib/seo-feature-content.js`, avoiding a
second manually maintained metadata source. `/features` is a navigation hub,
not a competing generic workout-generator page.

## Rendering and indexing contract

Full static HTML is generated as files. JavaScript is not needed to see
content, metadata, FAQ answers or follow CTAs. Production canonicals always use
`https://fuelphysique.com`. Clean feature URLs are served explicitly by Express;
backing `.html` URLs redirect to canonicals. There is no SPA fallback for unknown
feature paths. Public previews contain only labeled sample data, never account
queries. Application forms and account pages remain noindex.

Use WebPage and BreadcrumbList for visible content; no reviews, ratings,
invented offers or FAQ rich-result promises. Guidance:
[Google SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
and [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

## Implemented pages and metadata

The table below lists the primary keyword and visible title/H1 for every
indexable feature page. Exact descriptions, related keywords, FAQ content and
CTA routes are maintained in lib/seo-feature-content.js. Each description is
specific to its page and includes the feature's relevant limits.

| URL | Primary keyword / intent | Title | H1 |
| --- | --- | --- | --- |
| /workout-plan-generator.html | AI workout plan generator / build a routine | AI Workout Plan Generator — Build Your Routine | A workout plan built around your real week. |
| /features/meal-plan-generator | personalized meal plan generator / plan meals | Personalized Meal Plan Generator with Macros | Turn a nutrition goal into meals you can make. |
| /features/nutrition-tracker | food diary and nutrition tracker / log intake | Food Diary & Nutrition Tracker — Log Your Meals | Log your food. See what is left. |
| /features/workout-tracker | workout tracker / record sets | Workout Tracker — Log Sets & Review Sessions | Bring your plan to the session. Keep the record. |
| /features/training-volume | weekly training volume calculator / inspect planned sets | Weekly Training Volume — Planned Sets by Muscle | See where your weekly training sets go. |
| /features/progress-tracking | fitness progress tracker / record trends | Fitness Progress Tracker — Weight & Measurements | Keep a history, not just a single measurement. |

All titles also include FuelPhysique. The /features hub serves visitors who
want to choose a tool, and its metadata describes the collection rather than
competing with the workout page. Calisthenics is covered on the workout page
because it is a style in that same generator, not a distinct product.

## Implementation and navigation

- lib/seo-feature-content.js holds editorial content and metadata. The shared
  renderer in lib/seo-feature-pages.js produces full HTML at build time;
  scripts/build-feature-pages.js writes the static pages and public/sitemap.xml.
  Build again after editing content. Its --check option rejects stale output.
- lib/seo-feature-router.js serves clean routes, redirects their file aliases
  to canonical URLs, and returns 404 for unknown feature paths. The existing
  workout URL remains the canonical URL for that page.
- The homepage footer and exercise library navigation link to /features. The
  hub links to each page. Each page links to relevant related features, the
  exercise library and help page. The hub and page footers link back to the
  homepage. This gives visitors a route to nearby tools without duplicating
  pages for slight keyword variants.
- Public previews reuse markup and sample data from the homepage components.
  The workout exercise images use the existing smaller WebP copies. The
  progress preview reuses the actual empty summary from progress.html.
  Product previews contain no account data.
- Primary CTAs open the workout builder, meal builder or three-entry guest
  diary directly. Workout logging and personal progress open authentication
  with a next-page destination because those tools require saved account data.

## Conversion measurement

The existing consent loader remains the only GA4 tag. It already provides
ordinary GA page views after consent; feature pages add a separate
seo_landing_view event rather than sending a second page_view. CTA clicks
emit seo_cta_click with a fixed feature ID and hero/footer placement. A CTA
click stores only the feature ID in session storage for 24 hours so later
signup starts, completed signups and generated plans can be attributed.
Successful meal generation now emits nutrition_generated; workout generation
and signup completion keep their existing events. The first party analytics
allowlist was extended for the three new events. GA forwarding uses only
fixed feature IDs, placement and authentication method after consent; it does
not forward free text, food, weight, medical data or account identifiers.
There is no Meta Pixel in this codebase, so no Meta conversion is claimed.

Registration, Google Sign-In and plan generation depend on Firebase and
other live services. The route and event tests cover this wiring locally,
but they cannot prove a real completed registration or production analytics
delivery. Inspect DebugView with consent granted and a test account after
deployment. Do not send real personal or health values in analytics tests.

## Validation, 21 October 2026

- Build and deterministic --check: passed.
- Focused SEO, routing, metadata, link, preview, consent and guest flow tests:
  48 passed.
- Lint and postlint syntax gates: passed using their package scripts through
  Node (npm is not installed on this host).
- Standard regression suite: 1,518 assertions; 1,508 passed and 10 failed.
  The 10 remaining failures concern existing service worker cache/version
  fixtures, dashboard install messaging, meal-image and reroll fixtures,
  nutrition diary optional-data handling, exercise-image mappings and a
  workout builder asset fixture. None reference the new SEO routes. The suite
  had 16 failures before the tests were updated to recognize the new public
  page shell; six were caused by outdated shell assumptions.
- Local load test: three scenarios (static at 10 and 25 connections, health
  at 25) completed with zero errors, timeouts or non-2xx responses.
- Desktop and mobile browser checks: all seven public pages at 1440px,
  390px and 320px. A long heading overflow at 320px was corrected and
  rechecked. Sample images loaded. Source and route tests cover working CTA
  hrefs, sitemap, robots and private-page noindex. Live account generation
  and account data were not exercised.
- Firebase emulator suites did not start: this machine has Java 8, while
  firebase-tools 13.35.1 requires Java 11 or later. No emulator-based
  production-auth or Firestore test result is asserted here.

## Owner steps and future work

1. Deploy the reviewed build, then verify the production sitemap and the
   seven public URLs return 200, canonicalize correctly and show the expected
   full HTML without authentication. Production indexation is not yet known.
2. In Google Search Console, add or select the property for
   https://fuelphysique.com/, complete its ownership verification using an
   available method, and submit https://fuelphysique.com/sitemap.xml.
   Use URL Inspection on a sample of pages after deployment. Sitemap
   submission does not guarantee indexing.
3. In GA4, accept analytics in a test browser and check DebugView for
   seo_landing_view, seo_cta_click, signup_started, sign_up,
   workout_generated and nutrition_generated. Confirm sign_up occurs only on
   completed registration. Compare by feature ID; do not send personal data.
4. Priority next: obtain actual Search Console queries and impressions to
   refine page titles and FAQs; capture approved, readable product
   screenshots that reflect the current UI; improve the ten unrelated
   regression failures and run emulator tests on Java 11+; then consider
   genuinely useful educational guides for exercise choice, portion review
   and planned training volume. Add a page only when its intent and content
   are distinct from these tools.

No search volume, ranking, traffic uplift or Google indexation claim was made.
The implementation is local and has not been deployed as part of this work.
The later final validation, unchanged baseline failures and exact manual
release sequence are recorded in `docs/seo-deployment-readiness.md`.
