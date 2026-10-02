# FuelPhysique brand and release-quality audit — 2026-10-02

## Scope and outcome

Polished the existing Deep Ocean identity; did not replace the product, erase previous work, manufacture social proof or alter the nutrition/workout formulas. Public landing, shared shell, language switching, generated workout/nutrition views and daily logging were the priority flows.

## Evidence-backed fixes

| Finding | Release change | Verification |
| --- | --- | --- |
| Mobile navigation hid the language recovery button | Always-visible English `Language` button; compact readable dialog | Browser at 390 × 844; English → Arabic → Hebrew → English |
| Keyed text could remember translated Hebrew as its source | Canonical English restoration, generation guard, merged mutation batches, in-place text handling | Behavioral tests for all six non-English locales and skipped user content |
| Public login could wait indefinitely for SDK/auth | Lazy auth SDK, bounded 1.2-second session check, ordinary auth-page fallback | Five behavioral navigation tests |
| Landing hero was oversized and crowded | Compact typography, earlier CTA, structured social/copy/preview areas; preserved curl and coach bubble | Desktop/mobile screenshots |
| Animation could stop permanently at its loop delay or continue in background | Explicit loop-delay state and document visibility pause/resume | Two behavioral lifecycle tests |
| Hidden labels showed above nutrition inputs; date field was cramped | Complete `sr-only` utility and readable mobile date width | Live daily-log observation |
| Mobile bug-report button obscured primary controls | Feedback button moves to normal flow on small screens | Responsive stylesheet and browser review |
| Weekly volume appeared twice | Single volume panel controlled by the program map | Workout browser review, guidance tests |
| Raw muscle identifiers and plural “1 exercises” were unpolished | Canonical English muscle labels and singular exercise count | Workout locale/guidance regression tests |
| Nutrition totals were an inline text stack | Consistent responsive metric tiles; retained ingredient/macro contrast | Live generated nutrition plan and DOM color checks |
| Builder requests could leave a spinner indefinitely | 90-second abort deadline, localized recovery message, retained form answers | Timeout/cancellation behavior tests in seven languages |
| Old asset generations could mix after publication | Shared i18n URL and new shell/sequence/service-worker cache generation | Cache, source-order and public asset tests |

## Live local flows

Isolated Firebase emulator project only; no real customer accounts or records were modified.

- Generated an English intermediate gym fat-loss workout for four days with dumbbell/barbell/machine equipment. Checked muscle volume display, visible English copy and mobile width.
- Logged `40g dry rice`; result was **Dry white rice, 40 g, 146 kcal**, not cooked rice. “Saved” appeared; record survived reload.
- Generated a male maintenance nutrition plan (30 years, 180 cm, 80 kg, moderate activity, three meals). Displayed 2,730 kcal against 2,750 target, 161 g protein against 160 g target. Replaced breakfast successfully; totals updated and the meal changed. Checked ingredient foreground colors and lack of Hebrew in English main content.
- Switched landing Arabic → Hebrew → English. Verified English document language/LTR, no visible Hebrew, and no horizontal document overflow at 390 px.

Screenshots: `outputs/complete-redesign/brand-quality-20261002/` (local review artifacts, intentionally not shipped).

## Automated verification and limits

The focused 29-file regression run passed **280 tests, zero failures**. Additional shared-quality assertions cover stylesheet delivery, accessible hidden state, mobile language/feedback recovery and preservation of athlete playback. `npm run lint` and `git diff --check` passed.

The full standard suite and a broad workout integration run were attempted but did not complete (existing long-running integration behavior); this release does **not** claim the full repository suite is green. This is not a security audit or a guarantee of zero bugs.

No measured FPS claim is made. Rendering-heavy blur/decorative layers and background animation timers were reduced; browser observations and lifecycle tests support those concrete changes. The existing Render service is on a **free plan**: cold starts or server-side/model latency cannot be eliminated by frontend CSS. No paid hosting change was authorized or performed.

Local generator checks use isolated review services; they do not prove every external AI-provider request will succeed. Food estimates remain estimates, not laboratory measurements. Some secondary translations still fall back to English.
