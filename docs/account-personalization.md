# Account personalization — local review, 2026-10-27

## Architecture and behavior

Reuse `users/{uid}/settings/main.demonstrationModel` (`female`, `male`, `default`) as the canonical account address/visual default. The existing optional dashboard/settings selector now describes these semantics. No new account collection, migration, forced onboarding, tracking event or security-rule change.

Previously the global media choice won over a saved plan and a builder gender change could update the account. Explicit plan media now wins over the account fallback; demonstration selectors in plan/library views change only their local view. Account-level controls alone persist the default. Workout generation stores `recipientGender` separately from `demonstrationModel`; regeneration retains both. Saved-plan rendering works on a copy. A local demonstration change on an already saved plan is a viewing preference, not an automatic database update.

New workout sessions initialize the recipient from the account. Existing edited fields and guest-resume/edit routes are protected. Nutrition and manual-calculator sessions reuse saved age/height/weight; physiological coefficients remain explicit. Manual calculator example values may be replaced with saved values only while untouched. Existing dietary preferences, restrictions, formulas, generation and save schemas remain intact. No new copy of sensitive nutrition inputs is stored.

The AI chat route reads the address enum from the authenticated UID's private settings on each request, with a 1.5-second timeout and neutral fallback. It adds trusted instructions separating account holder and plan recipient. Client-supplied system/developer roles are excluded. Past conversations are not rewritten. This validates prompt construction, not model compliance in a live response.

Account hero images require a signed-in nonanonymous account. The release registry now includes 123 exact hash-matched human-approved WebP exercise variants covering 129 exercise IDs. Original male assets are unchanged.

## Localization coverage

Account preference control and core builder prompts support female/male/neutral Hebrew and neutral English. Exact-string substitutions cover goals, activity, experience, style, schedule and availability; exercise names are untouched. This is bounded coverage, not a claim that every legacy dynamically generated notification across the application has been converted. Existing neutral/plural copy is retained. Manual builder's existing localization remains responsible for its other labels.

## Files changed by this account-wide extension

- `lib/account-address.js` — new trusted server context helper.
- `server.js` — chat integration; contains earlier unrelated/uncommitted library work that must be separated at release.
- `public/js/exercise-demo-preference.js` — account defaults, profile reads, context precedence, local selectors and account labels.
- `public/js/account-personalization.js` — new guarded field initialization and Hebrew copy.
- `public/js/visual-personalization.js` — account-only heroes; remove builder-to-account mutation.
- `public/js/workout-builder.js` — saved recipient/media metadata and local media selection.
- `public/js/saved-workout-view.mjs` — local override in copied saved plan.
- `public/js/nutrition-builder.js` — explicit physiological coefficient labels.
- `public/workout-builder.html` — recipient explanation and module.
- `public/nutrition-builder.html` — validation copy and module.
- `public/manual-nutrition-builder.html` — module.
- `public/app.html`, `public/dashboard.html` — module.
- `test/account-personalization.test.cjs` — new context/default/privacy tests.
- `test/exercise-media-variants.test.js` — corrected precedence expectations.
- This document.

Review-only: `outputs/check-account-personalization.cjs`, updated `outputs/check-visual-personalization.cjs`, and screenshots in `outputs/account-personalization/` and `outputs/visual-personalization/`. These are not production assets.

This extension depends on the earlier uncommitted media/visual-personalization implementation described in `visual-personalization.md`; the list above is not a standalone deployment manifest. Telegram, dependencies and other existing repository changes were not included or committed.

## Validation

250 selected automated tests passed, zero failures/skips: new account context tests; exercise media and fallback; saved workout/volume; guest flows; workout builder/result/responsive regressions; nutrition targets/totals/manual builder; Google authentication; SEO and consent/activation analytics.

Chrome checks: 1440px English and 390px Hebrew; female account and male recipient, retained override through language changes, editable profile defaults, explicit nutrition coefficient, zero account writes from builder edits. These use actual HTML/CSS with isolated personalization code and mocked Firebase; generation/auth controllers are excluded. Separate dashboard preview checks exercised male/female image switching, Hebrew labels, no page overflow and zero page errors. An initial browser run failed while the preview server was unavailable; after restart and a transient Chrome launch failure, both checks passed. Screenshots are local fixture previews.

Syntax checks passed for server/helper and the new browser module (ES-module mode); scoped Git whitespace check passed.

Scenario A/B/C/D/F: defaults, language, media selection and trusted prompt construction verified locally. Scenario E: legacy saved-plan and fallback regressions passed. Scenario G: mocked cloud reads/writes, logout/account-switch isolation and stale-read protection passed. Real Firebase test-account login/relogin, cross-device sync, deployed rules, and live AI grammar remain unverified. No production user data was changed.

Before release: review the combined prior/new change scope, run real staging-account persistence and AI response checks, and review broader legacy Hebrew copy if full application-wide linguistic coverage is required. No commit, push or deployment performed.
