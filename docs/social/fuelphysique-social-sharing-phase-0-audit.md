# FuelPhysique Social Sharing - Phase 0 Verified Architecture Audit

Audit date: 2026-08-01

Repository root: `C:\Users\ofek1\Documents\Codex\2026-07-20\90-frontend-sqlite-mongodb-postgresql-supabase\ofek-ai`

Branch: `feature/social-sharing-foundation`

HEAD: `b17583378cb50347fe0a12d8fc6efc5098d58c35`

`origin/main`: `b17583378cb50347fe0a12d8fc6efc5098d58c35`

Scope: verification/materialization only. No implementation, Firebase CLI install, Firebase Console change, Firestore rules creation, deployment, commit, or push was performed.

## Executive Verdict

Phase 1 is **NO-GO** until the complete live Firestore rules are manually backed up from Firebase Console and source-controlled.

The repository contains a working authenticated Firebase client foundation, existing profile/plan/progress/tracking data paths, backend Firebase ID-token verification, rate limiting, localization/RTL support, and passing tests. It does **not** contain a complete `firestore.rules`, `firestore.indexes.json`, `firebase.json`, or `.firebaserc`. The file `firestore-leaderboard-rules.txt` is only a partial leaderboard insertion snippet and must not be treated as the complete live ruleset.

The Spark/no-cost constraint is preserved as a hard requirement. Social Phase 1 must not require Blaze, Cloud Functions, Cloud Run, Pub/Sub, paid search/moderation, paid backups/PITR/TTL, SMS auth, extra Firestore databases, Firebase billing changes, or progress-photo/media sharing.

## Evidence Classification

Confirmed from repository code:

- Repository, branch, SHA, package scripts, test files, and test output were verified locally.
- Firebase Web SDK usage was found in browser modules under `public/js/`.
- Backend ID-token verification and rate limiting were found in `server.js` and `lib/runtime-guards.js`.
- Service-account Firestore REST helper behavior was found in `lib/payplus-billing.js` and its callers.
- Localization and RTL behavior were found in `public/js/i18n.js`, `public/js/chat.js`, `public/js/auth.js`, and page-specific modules.
- No complete Firestore rules/config files were found in the repository.

Manually reported production behavior, not revalidated by this pass:

- `fuelphysique.com` is authorized for Firebase Auth.
- Desktop and mobile Google login work.
- New-user Terms gate works.
- Returning-user login works.
- `www.fuelphysique.com` redirects before the app runs.

Unknown because live Firebase Console state is unavailable:

- The complete currently published Firestore rules.
- The exact deployed indexes.
- The exact authorized domains list.
- Whether live rules contain collection paths or helper functions not represented in this repository.
- Current Firebase usage/quota graphs, rejected rule reads, and production read/write volume.
- Whether any Console-only settings or emergency rules edits exist outside Git.

## Git And Test Baseline

Confirmed current state:

- `git rev-parse --show-toplevel`: `C:/Users/ofek1/Documents/Codex/2026-07-20/90-frontend-sqlite-mongodb-postgresql-supabase/ofek-ai`
- Current branch: `feature/social-sharing-foundation`
- HEAD equals `origin/main`: `b17583378cb50347fe0a12d8fc6efc5098d58c35`
- `git diff --stat origin/main...HEAD`: empty
- `origin/feature/social-sharing-foundation`: not found
- Worktree at the repository root is clean before this documentation file was added.

Exact test runner command from `package.json`:

```text
npm run lint && node --test test/fuelphysique-policy.test.js test/landing-page-regression.test.js test/workout-priority.test.js test/workout-builder-assets.test.js test/workout-builder-result-cards.test.js test/workout-phase-1.test.js test/workout-phase-1-integration.test.js test/workout-builder-language.test.js test/openai-upstream-error-mapping.test.js test/workout-repair.test.js test/workout-validation-i18n.test.js test/workout-builder-422-repair.test.js test/workout-equipment-language-hotfix.test.js test/workout-builder-calisthenics-equipment.test.js test/food-image-routing.test.js test/nutrition-totals.test.js test/coach-identity.test.js test/workout-builder-style-images.test.js test/workout-language-leakage.test.js test/progress-photos.test.js test/nutrition-card-contrast.test.js test/nutrition-portion-balancer.test.js test/nutrition-locale-and-validity.test.js test/theme-regression.test.js test/workout-mobility-stretch-fallback.test.js test/image-performance.test.js test/workout-tracker-exercise-images.test.js test/workout-tracker-discard-draft.test.js test/pwa-installability.test.js test/workout-equipment-strict-enforcement.test.js test/workout-volume-targets.test.js test/workout-weekly-volume-summary.test.js test/workout-weekly-volume-gate.test.js test/workout-volume-stress-matrix.test.js test/workout-volume-solver-regression.test.js test/google-auth.test.js test/auth-action.test.js test/email-verification.test.js test/verification-gate-coverage.test.js test/auth-proxy.test.js && npm run load:test
```

Test inventory:

- `test/*.js` files in repository: 41
- Test files explicitly passed to `node --test` in `npm test`: 40
- The extra repository test file is `test/food-image-coverage.test.js`; it is not named in the current `npm test` script.
- Current `npm test` result: 581 tests, 581 pass, 0 fail.
- The `581` value is Node's individual test count reported by the Node test runner. It is not a suite count and not the total number of files.
- No repository-history evidence was found for a prior `604` test baseline. A Git grep for `604`, `tests 604`, and related phrases found only unrelated values such as meal calories, image file sizes, and Safari user-agent strings. The 581 vs 604 discrepancy is therefore **UNKNOWN** in this checkout.

## Current Firestore Collection Usage

The following repository paths were confirmed by inspecting Firestore calls:

- `users/{uid}`: root profile/account document. Evidence: `public/js/auth.js`, `public/js/auth-google-core.mjs`, `public/js/app-auth.js`, `public/js/user-profile.js`, `public/js/dashboard.js`, `public/js/billing-result.js`, `lib/payplus-billing.js`.
- `users/{uid}/athleteCore/main`: athlete profile core. Evidence: `public/js/user-profile.js`.
- `users/{uid}/settings/main`: settings, athlete core mirrors, language/theme/AI preferences. Evidence: `public/js/settings.js`, `public/js/dashboard.js`.
- `users/{uid}/workoutPlans/{planId}`: saved AI/manual workout plans and active-plan reads. Evidence: `public/js/workout-builder.js`, `public/js/manual-workout-builder.js`, `public/js/my-workout-plans.js`, `public/js/dashboard.js`, `public/js/chat.js`, `public/js/log-workout.js`, `public/js/workout-tracker.js`.
- `users/{uid}/nutritionPlans/{planId}`: saved nutrition plans. Evidence: `public/js/nutrition-builder.js`, `public/js/my-nutrition-plans.js`, `public/js/dashboard.js`, `public/js/chat.js`.
- `users/{uid}/workoutLogs/{logId}`: workout tracking/history. Evidence: `public/js/log-workout.js`, `public/js/workout-tracker.js`, `public/js/workout-history.js`, `public/js/exercise-progress.js`, `public/js/dashboard.js`.
- `users/{uid}/weightEntries/{entryId}`: weight history. Evidence: `public/js/progress.js`, `public/js/dashboard.js`.
- `users/{uid}/bodyMeasurements/{entryId}`: body measurements. Evidence: `public/js/progress.js`.
- `users/{uid}/progressPhotos/{photoSetId}`: progress-photo metadata. Evidence: `public/js/progress.js`; private upload/delete helpers in `public/js/imagekit-upload.js` and `server.js`.
- `users/{uid}/runs/{runId}`: running records with route/location data. Evidence: `public/js/running.js`.
- `users/{uid}/conversations/{conversationId}` and `/messages/{messageId}`: existing AI Coach conversations. Evidence: `public/js/conversations.js`.
- `users/{uid}/leaderboardSubmissions/{submissionId}`: user leaderboard submissions. Evidence: `public/js/leaderboard.js`, `public/js/leaderboard-admin.js`.
- `users/{uid}/transformationSubmissions/{submissionId}`: transformation submissions. Evidence: `public/js/transformation-submit.js`.
- `users/{uid}/waitlists/pro`: Pro wishlist. Evidence: `public/js/pricing.js`.
- `leaderboardEntries/{entryId}`: public approved leaderboard rows. Evidence: `public/js/leaderboard.js`, `public/js/leaderboard-admin.js`.
- `shares/{shareId}`: legacy workout sharing record. Evidence: `public/js/share-workout.js`.

Collection-group behavior confirmed in code:

- `public/js/leaderboard-admin.js` uses `collectionGroup(db, "leaderboardSubmissions")`.
- `lib/public-stats.js` and backend public stats can use collection-group or collection REST endpoints for aggregate counts when service-account credentials are configured.

## Authentication

Confirmed modules:

- `public/js/auth.js`: email/password auth, Google sign-in orchestration, Terms gate handling, root `users/{uid}` writes.
- `public/js/auth-google-core.mjs`: shared Google auth helper; redirect vs popup decision; Firebase environment resolution.
- `public/js/auth-action.js` and `public/js/auth-action-core.mjs`: email verification, password reset, recover-email action handling.
- `public/js/app-auth.js`: protected-page user lookup and shared app auth behavior.
- `public/js/verification-gate.js`: shared email-verification access gate.
- `public/js/firebase-config.js` and `public/js/firebase-environment.mjs`: Firebase client configuration and production auth-domain selection.

Repository-confirmed root user document fields include email/display-name/provider metadata, Terms acceptance/version/timestamps, plan/subscription fields, and active plan IDs. This root document is private account data and must not become the social-readable profile. Social needs a separate minimal profile projection.

## User Profiles

Confirmed modules:

- `public/js/user-profile.js` reads/writes `users/{uid}` and `users/{uid}/athleteCore/main`.
- `public/js/settings.js` reads/writes `users/{uid}/settings/main`.
- `public/js/dashboard.js` reads `users/{uid}`, `settings/main`, latest weight, logs, active workout plan, and active nutrition plan.

Private fields include email, age, weight, height, goal, limitations, equipment, dietary restrictions, favorite/disliked foods, personal notes, AI preferences, and health-adjacent builder inputs. These fields must not be copied into a social profile or shared artifact by default.

## Workout Plan Storage

Confirmed modules:

- `public/js/workout-builder.js` saves generated workout plans to `users/{uid}/workoutPlans`.
- `public/js/manual-workout-builder.js` saves manual workout plans to the same collection.
- `public/js/my-workout-plans.js` lists by `createdAt desc`, renames/updates/deletes plans, and updates `users/{uid}.activeWorkoutPlanId`.
- `public/js/dashboard.js`, `public/js/chat.js`, `public/js/log-workout.js`, and `public/js/workout-tracker.js` read active/specific workout plans.

Confirmed supporting authorities:

- `lib/workout-exercise-catalog.js`
- `lib/workout-validator.js`
- `lib/workout-equipment-policy.js`
- `lib/workout-setcredits-map.js`
- `lib/workout-volume.js`
- `public/js/exercise-image.js`

Any social copy/import flow must create a recipient-owned deep copy and revalidate/recompute derived values through these existing authorities. It must not trust client-supplied volume summaries or private source paths.

## Nutrition Plan Storage

Confirmed modules:

- `public/js/nutrition-builder.js` saves nutrition plans to `users/{uid}/nutritionPlans` after a client-side `limit(5)` check.
- `public/js/my-nutrition-plans.js` lists by `createdAt desc` with `limit(5)`, renames/deletes plans, and updates `users/{uid}.activeNutritionPlanId`.
- `public/js/dashboard.js` and `public/js/chat.js` read active/specific nutrition plans.

Confirmed supporting authorities:

- `lib/meal-catalog.js`
- `lib/meal-ingredient-database.js`
- `lib/nutrition-totals.js`
- `lib/nutrition-portion-balancer.js`
- `lib/nutrition-portion-constraints.js`
- `lib/food-image-map.js`

Nutrition sharing must exclude request-only personal inputs such as age, gender, height, weight, diagnosed conditions, guardian consent, allergies, restrictions, avoided/preferred foods, and private notes unless an explicitly designed, bounded, non-sensitive display field is approved.

## Workout Tracking And History

Confirmed modules:

- `public/js/workout-tracker.js` writes completed workout logs to `users/{uid}/workoutLogs`.
- `public/js/log-workout.js` writes manual workout logs.
- `public/js/workout-history.js` lists/deletes logs ordered by `completedAt desc`.
- `public/js/exercise-progress.js` reads logs ordered by `completedAt desc` with `limit(200)`.
- `public/js/dashboard.js` reads recent logs with `limit(30)`.

Workout logs include plan/session context, duration, completed set counts, notes, exercises, and set-level performance such as weight, reps, RPE/RIR, and completion state. Logs and free-text notes are private by default.

## Progress, Weight, Personal Records, And Photos

Confirmed modules:

- `public/js/progress.js` stores `weightEntries`, `bodyMeasurements`, and `progressPhotos`.
- `public/js/imagekit-upload.js` and `server.js` support authenticated private ImageKit progress-photo upload/delete/access flows.
- `public/js/running.js` stores `runs` with route and start/end location fields.
- `public/js/exercise-progress.js` derives exercise progress and record-like views from workout logs.

Personal records are not a dedicated stable Firestore collection in this source. Record/PR-like displays are derived from workout logs, and tracker behavior may call backend notification-related endpoints after workout completion. Any future PR card must therefore be a new, explicitly consented, immutable summary artifact rather than an automatic export of logs.

Never auto-share exact weight, measurements, GPS routes, progress photos, progress-photo metadata/URLs, injuries, limitations, medical conditions, allergies, private notes, email, phone, private AI Coach content, or private Firestore paths.

## Firebase Admin And Backend Authentication

Confirmed modules:

- `server.js` defines `requireFirebaseUser(req, res)`.
- `requireFirebaseUser` expects `Authorization: Bearer <Firebase ID token>` and verifies it through Firebase Identity Toolkit `accounts:lookup`.
- Test/CI bypass behavior is guarded by `ALLOW_TEST_AUTH_BYPASS === "true"` and non-production `NODE_ENV`.
- `server.js` authenticates AI, upload, progress-photo, billing, and related routes with this helper.
- `package.json` includes `firebase-admin`, but `server.js` does not initialize the Firebase Admin SDK in this checkout.
- `lib/payplus-billing.js` uses a service-account JSON environment variable and Google OAuth JWT flow to call Firestore REST for trusted subscription/public-stats related operations.

Future social mutation routes should derive actor UID from `requireFirebaseUser`, never from client body fields.

## Existing Rate Limiting

Confirmed in `server.js` and `lib/runtime-guards.js`:

- `ai`: default 6 per UID per minute.
- `uploads`: default 8 per UID per minute.
- `auth`: default 10 per UID per minute for upload auth.
- `analytics`: default 180 per IP per minute.
- `feedback`: default 6 per IP per minute.
- Request body caps: `express.json({ limit: "512kb" })` and URL-encoded `64kb`.

There are no current social-specific rate limiters for username search, friend requests, block/report actions, messages, shared artifacts, or artifact copy/import. Phase 1 must add bounded server-side limits before enabling cross-user mutation.

## Localization And RTL

Confirmed modules:

- `public/js/i18n.js` defines shared translations, `isRTL`, `getLanguage`, and `setLanguage`, and sets `document.documentElement.lang`/`dir`.
- `public/js/chat.js`, `public/js/auth.js`, `public/js/auth-action.js`, `public/js/landing.js`, `public/js/workout-tracker.js`, `public/js/workout-history.js`, `public/js/exercise-progress.js`, and other page scripts apply localized strings and RTL/LTR direction.
- CSS includes RTL-specific handling in files such as `public/css/dashboard.css`, `public/css/landing.css`, `public/css/legal.css`, and `public/css/auth-action.css`.

Social UI must use the existing localization pattern and RTL-safe layout conventions rather than inventing a separate language system.

## Existing Social-Like Code Not Suitable As Foundation

`public/js/conversations.js` is AI Coach history, not peer chat. It permits client-selected roles including `system`, uses client-created messages, loads message subcollections with no cursor-based pagination for the full delete path, and has no friend/block/participant authorization model in code.

`public/js/share-workout.js` creates `shares/{shareId}` with `userId` and `planId`, then reads `users/{userId}/workoutPlans/{planId}` from the public loader and increments `viewCount` with a merge. This is a live mutable reference to a private sender document. It must be retired, isolated, or fully secured before any social artifact surface ships.

`public/js/plan-sharing.js` is browser-level export/share-to-clipboard/WhatsApp/Gmail behavior. It is not an in-app social sharing architecture.

## Proposed Social Schemas

Proposed only; no documents or rules were created.

- `usernames/{usernameKey}`: server-reserved username directory with `uid`, `username`, `usernameLower`, `displayNameSnapshot`, `searchable`, timestamps, and optional tombstone. Deterministic ID, transaction-only reservation.
- `users/{uid}/socialProfile/main`: minimal social projection with username, display name snapshot, discoverability, friend-request setting, and share defaults. Never mirror email or health fields.
- `users/{uid}/friends/{friendUid}`: accepted friendship mirror with friend UID, safe display snapshots, friendship ID, and timestamps.
- `friendRequests/{requestId}`: request state with `fromUid`, `toUid`, `status`, created/updated/responded timestamps. Server controls status transitions.
- `blocks/{blockKey}` or `users/{uid}/blocks/{blockedUid}`: owner/block target pair. All social mutations check both directions.
- `reports/{reportId}`: bounded abuse report with reporter, target, type, reason code, bounded details, status, and timestamps.
- `conversations/{conversationId}`: canonical two-user conversation metadata, participant UIDs/key, status, timestamps, and last-message preview.
- `users/{uid}/conversationSummaries/{conversationId}`: owner-readable summary list with other user safe display info, last preview, unread count, and updated timestamp.
- `conversations/{conversationId}/messages/{messageId}`: text-only messages with server-derived sender UID, client idempotency key, text, schema version, and created timestamp.
- `sharedArtifacts/{artifactId}`: owner/recipient-scoped immutable artifact snapshot with type, schema version, source version metadata, sanitized snapshot, status, timestamps, and safe attribution.
- `users/{uid}/notifications/{notificationId}`: bounded in-app notification records; no push requirement.

Suggested size caps:

- Text messages: 2,000 Unicode characters, target max 4 KiB document.
- Workout artifact: max 64 KiB.
- Nutrition artifact: max 96 KiB.
- PR/card/graph artifact: max 16 KiB.
- Notification/profile/friend/request documents: small bounded projections, typically 2-8 KiB.

## Immutable Shared-Artifact Design

The new sharing model must not point recipients at sender-owned private documents. Sharing creates an immutable sanitized snapshot, and copying creates a new recipient-owned plan/log/card document with a new ID.

Required controls:

- Derive `ownerUid` and actor identity from the verified auth token.
- Require exact recipient/friend/block authorization.
- Strip private fields server-side.
- Store display-safe attribution only; never email, phone, private Firestore path, raw source UID in user-visible snapshot fields, or private ImageKit URLs.
- Preserve `schemaVersion`, `sourcePlanVersion` or `sourceUpdatedAt`, `sourceArtifactId`, `copiedAt`, and attribution.
- Recompute workout volume/equipment/image resolution and nutrition totals from canonical local code when importing.
- Revocation blocks future reads/copies but does not mutate independent recipient copies already created.

## Spark Read/Write Estimates

These are architecture estimates, not billing guarantees. Existing app traffic shares the same Spark quotas.

- Open conversation list: about 20 summary reads plus 1 profile read.
- Open one chat: about 1 conversation read plus 25 message reads.
- Receive one new message in an open chat: about 1 listener document read.
- Send one message: about 2-4 server validation reads and 3-4 writes for message, two summaries, and optional notification.
- Username exact availability: 1 read.
- Username prefix search: up to 10 reads.
- Send friend request: about 2-5 validation reads and 2 writes.
- Accept friend request: about 2-4 reads and 4 writes.
- Share workout/nutrition artifact: about 3-6 validation/source reads and 2 writes.
- Copy workout/nutrition artifact: about 2-3 reads and 1 recipient-owned plan write.
- Share PR/completed-workout/graph card: about 1-3 reads and 2 writes.

Current Spark constraints to preserve:

- No billing/Blaze assumption.
- Keep all social reads/writes bounded by page limits and rate limits.
- No media or progress-photo social sharing.
- No TTL dependency; use bounded manual cleanup.
- No Cloud Functions, Cloud Run, Pub/Sub, paid extensions, paid search, paid moderation, paid backups, PITR, SMS auth, or extra database.
- Measure Firebase Usage tab and Emulator behavior before approval, especially public stats scans and rule `get()`/`exists()` read costs.

## Security And Privacy Risks

- Complete live Firestore rules are missing from Git; this is the blocking Phase 1 risk.
- Root `users/{uid}` documents contain email/account/subscription data and must not be made socially readable.
- Settings, athlete core, builder inputs, weight, measurements, runs, progress photos, and AI Coach conversations are health-adjacent or sensitive.
- Legacy `shares/{shareId}` points at live private workout plans.
- Username availability checks are racy unless reservation is transactional/server-authoritative.
- User search can become account enumeration unless it uses an opted-in, bounded projection.
- Client-provided sender/actor/participant fields can be forged.
- Conversation IDs are not authorization.
- Friend and block checks must run on every cross-user mutation.
- Message/artifact sizes must be capped far below Firestore's 1 MiB document limit.
- Revocation and account deletion semantics must be explicit before launch.
- Copied artifacts must be independent recipient-owned snapshots, not live references.
- Progress-photo sharing remains postponed.

## Firestore Rules Preservation Procedure

Do not claim knowledge of the complete live Firestore rules until this procedure is completed manually:

1. Open Firebase Console -> Firestore Database -> Rules for the production project.
2. Copy the complete currently published rules, including every helper function and legacy collection path.
3. Save an untouched backup with project ID, timestamp, and published version metadata.
4. Add the complete current rules to source control as the baseline. Do not replace them with `firestore-leaderboard-rules.txt`.
5. Add Emulator tests for existing behavior before adding social rules: signup/profile, settings, athlete core, workout/nutrition plan CRUD, active-plan updates, logs, weight, measurements, progress-photo metadata, runs, AI conversations, leaderboard user/admin paths, transformation submissions, wishlist, subscription callback behavior, and any live-only path found in production.
6. Add social rules incrementally.
7. Run Emulator tests locally only after an approved setup step. Do not install Firebase CLI as part of this Phase 0 verification pass.
8. Compare emulator behavior against the saved baseline and access matrix.
9. Deploy rules only after explicit approval and with rollback instructions.

`storage.rules` is a separate Firebase Storage rules file and does not establish Firestore behavior. In this application, progress photos use ImageKit private files through authenticated backend routes, so Storage and ImageKit policies must be reviewed separately.

## Corrections To The External Draft

The external draft was treated as non-authoritative and corrected/materialized here as follows:

- Reframed all Firebase Auth production statements as manually reported production behavior unless backed by repository code.
- Removed any implication that this pass knows the complete live Firestore rules.
- Kept `firestore-leaderboard-rules.txt` classified as a partial snippet only.
- Clarified that `581` is Node's individual test count from current `npm test`, not suite/file count.
- Added the test-file discrepancy: 41 `test/*.js` files exist, while the current `npm test` script explicitly runs 40.
- Marked the `604` baseline as unknown/unverified because no Git-history or test-output evidence was found in this checkout.
- Clarified that personal records are derived from workout logs in the current source, not a stable dedicated Firestore collection.
- Preserved the hard Spark/no-cost requirement.
- Preserved the NO-GO verdict while live rules backup is missing.

## Remaining Unknowns

- Complete live Firestore rules.
- Complete live Firestore indexes.
- Live Firebase Auth authorized domains and provider configuration.
- Live Firebase usage, quota headroom, rejected rules reads, and read/write cost of public stats.
- Any production data collections created manually or by older deployed builds but not represented in this checkout.
- Exact moderation/account-deletion policy for social data.
- Whether the existing service-account REST pattern will be approved as the social trusted-write authority, or replaced by another tested approach.
- The source of the manually mentioned 604-test count.

## Manual Firebase Console Information Required

- Full published Firestore rules text and rules version metadata.
- Full Firestore indexes list or export.
- Firebase project ID and active web app IDs/domains.
- Auth sign-in providers enabled, including Google and email/password.
- Authorized domains list, including `fuelphysique.com` and any `www`/preview/localhost entries.
- Current Firestore Usage tab data: reads/day, writes/day, deletes/day, storage, bandwidth, and spikes.
- Any current rules playground/test notes for existing user paths.
- Whether any emergency Console rules edits were made after the latest deployed repository version.

## Final Recommendation

**NO-GO for Phase 1.**

Proceed only after the complete live Firestore rules are manually backed up and source-controlled, legacy behavior is covered in Emulator tests, Spark budgets are measured, and the legacy `shares/{shareId}` path is retired, isolated, or fully secured.
