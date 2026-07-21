# FuelPhysique — Project Status

Date: 2026-07-21

## 1) Features that are completed and working

- Authentication, dashboard, landing, settings, and language switching are present.
- Workout plan generation exists and saved plans can be managed.
- Workout tracker flow exists, including draft save/restore, quick mode, next-set preview, rest timer, and workout logging.
- Nutrition builder exists with age handling, Youth Mode, guardian consent for ages 15–17, and saved nutrition plans.
- Progress tracking exists, including bodyweight/progress entries and photo comparisons.
- Running/GPS tracking exists and saves route history.
- Conversation history, message editing/resend, copy actions, and voice-to-text support exist in the chat.
- Pro wishlist / pricing flow exists without active billing charges.
- Health endpoint exists for lightweight uptime checks.
- Direct browser-to-ImageKit upload flow exists for media-heavy features.

## 2) Features that started but are not finished

- The “special card” / context-sensitive routing idea for the chat has been discussed, but I did not find a dedicated implementation pass for it.
- Some product-meaningful safety handling is partial: Youth Mode exists, but anorexia / obesity / overweight do not appear as dedicated nutrition branches yet.
- There are multiple polished UI flows already started, but not every one has a matching mobile verification pass in this review.

## 3) Bugs, duplicate code, or conflicts introduced by the changes

- No blocking syntax errors were found in the server.
- The project currently has no lint script, so there is no existing lint pass to run.
- The local load test reported two non-2xx responses on `/api/exercise-demo?name=Squat`; this looks non-blocking, but it should stay on watch.
- A user-reported console issue (`mockExternalServices is not defined`) was not reproduced from the repository search and may be environment-specific or from an untracked browser state.

## 4) Ideas discussed but not yet implemented

- Dedicated handling for anorexia, eating-disorder risk, and overweight/obesity in nutrition flows.
- Evidence-strength badges for AI answers.
- More explicit “special card” surfacing when a user asks a question that matches a dedicated tool/page.
- Deeper workout logging UX polish beyond the current quick mode / rest flow work.
- Route-map visualization improvements for running history.
- More advanced feedback for stalled or regressed exercise progress.

## 5) Critical issues blocking real use

- None were found in the current smoke review that block signup/login, plan creation, workout logging, history viewing, or refresh persistence.
- The app starts locally and the main local load-test smoke run completed successfully.

## 6) Gaps in security, database, persistence, and mobile UX

- No lint process is configured, so code-quality enforcement is incomplete.
- Youth / medical safety exists, but there is still no fully dedicated branch for anorexia / obesity / eating-disorder risk.
- The mobile experience has not been fully re-validated in this review after the recent UI changes.
- The project depends on Firebase / ImageKit / external APIs; rate limiting and guards exist, but the safety posture should keep being watched as features grow.

## 7) Top 3 next actions

1. Reproduce the reported console issue only if it appears in the live browser, then fix only if it blocks core use.
2. Add dedicated nutrition safety handling for anorexia / overweight / obesity.
3. Re-run a browser smoke check on mobile-sized layout for the main flows that already exist.

## Verification performed

- `npm test`
- `node --check server.js`
- `node --check scripts/load-test.js`

