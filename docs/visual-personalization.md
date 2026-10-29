# Visual personalization — local implementation, 2026-10-26

## Audit and implementation
Existing presentation preference infrastructure already covers generated plans, saved plans, library/detail views, demo modal, replacement and workout tracking. This change reuses demonstrationModel at users/{uid}/settings/main, protected by the existing owner-only settings rule. No rules or workout engine changes.

The prompt is in the post-login dashboard and existing Profile settings, rather than adding signup friction. It offers Male, Female and No preference. The existing optional Gender builder field seeds the presentation preference only when no independent preference has been chosen. Users can change the independent choice without regenerating a plan. No additional sex field is stored.

The same setting now selects female homepage and dashboard hero photographs. The original images remain intact. Failed variants fall back once to originals; dimensions and layout CSS are unchanged. This also fixes the dashboard language dialog's broad select lookup, which otherwise conflicts with the new preference select.

Explicit guest choice is handed off through sessionStorage to a signed-in account with no saved preference. Returning account settings take precedence over that handoff. Local caching remains UID-scoped. Existing users without values use the default and are not blocked. Network failures leave current-view/local behavior usable and do not interrupt auth or generation.

## Exact files for this task
- public/index.html
- public/dashboard.html
- public/app.html
- public/workout-builder.html
- public/js/dashboard-editorial-view.mjs
- public/js/exercise-demo-preference.js (existing local architecture extended)
- public/js/visual-personalization-core.mjs
- public/js/visual-personalization.js
- public/assets/dashboard/training-female-v2.webp
- public/assets/dashboard/landing-training-female-v2.webp
- test/visual-personalization.test.cjs
- docs/visual-personalization.md

Prior uncommitted exercise-media architecture is a prerequisite, not newly implemented here. Unrelated telemetry/server/dependency changes are excluded from this task. No commit/push/deploy.

## Media and approval
Two new promotional photos generated using built-in imagegen with original photos as references; WebP derivatives are in public/assets/dashboard. Full prompts/provenance: outputs/training-female-generation.json and outputs/landing-training-female-generation.json.
The release registry includes 123 explicit, hash-matched human-approved WebP variants covering all 129 exercise IDs. Original male assets are preserved. Plan-list thumbnails are unchanged.

## Validation
128 targeted Node tests passed, including preference persistence/isolation, guest handoff, returning-account precedence, missing media, image errors, saved plans, replacement integration, tracker, builder/layout regressions, guest flow and SEO foundation.
Local headless Chrome fixture: 1440px English and 390px Hebrew, female/male switching, one preference control after rerender, no horizontal overflow and no page errors.
25-batch/20-batch QC artifacts and originals untouched.
All browser Firebase interactions mocked; no real accounts or production data written. Real Firebase cross-device synchronization and end-to-end registration/generation were not exercised. Existing generation/saved-plan tests passed; do not interpret them as a live backend generation test.

Preview screenshots:
- outputs/visual-personalization/dashboard-en.png
- outputs/visual-personalization/dashboard-he.png

## Readiness / limitations
Release validation is recorded in personalization-final-integration.md. Human visual approval is distinct from professional certification. No preference values are sent to analytics and workout programming is unchanged.
