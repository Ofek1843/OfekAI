# FuelPhysique Social Experience production deployment runbook

This runbook is a controlled release procedure for the social experience. It
is documentation only. The release candidate preparation does not publish
Firestore rules, create Firebase indexes, change Render settings, or deploy
the application.

## Release inputs

Before starting, record these values in the change ticket without pasting any
secret values:

- Release commit: the exact feature-branch SHA to deploy.
- Previous Render commit: the rollback SHA.
- Untouched Firestore baseline: `docs/social/firestore-rules-production-baseline-2026-08-01.txt` plus the separately retained production backup.
- Final rules: `firestore.rules`.
- Final indexes: `firestore.indexes.json`.
- Required composite indexes:
  - `friendRequests`: `toUid ASC`, `status ASC`.
  - `friendRequests`: `fromUid ASC`, `status ASC`.

Required production environment-variable names are listed in the release
ticket or Render configuration. Never paste their values into this runbook,
logs, screenshots, or chat.

## Controlled order

### 1. Verify backups and rollback

Owner: Codex or release engineer.

1. Confirm the untouched dated Firestore baseline and the separately retained
   production backup are readable and unchanged.
2. Confirm the previous Render commit is known and can be redeployed.
3. Compare the release candidate rules with the untouched baseline and review
   the social additions. Stop if any legacy path is missing or broadened.

Validation: record the baseline checksum, release rules checksum, previous
Render SHA, and release SHA in the change ticket. Do not publish anything yet.

### 2. Verify Render environment names

Owner: user/release engineer in Render.

1. Open the production Render service settings.
2. Confirm only the expected environment-variable names exist for Firebase,
   authentication, storage, billing, telemetry, and AI provider operation.
3. Confirm no emulator host, demo project ID, local-demo flag, demo account,
   or test-auth bypass variable is present in production.
4. Do not print or copy values.

Validation: record names and a redacted presence/absence checklist only.

### 3. Create the two Firestore composite indexes

Owner: user in Firebase Console.

Create only these indexes in the production Firebase project:

1. Collection `friendRequests`: `toUid` ascending, `status` ascending.
2. Collection `friendRequests`: `fromUid` ascending, `status` ascending.

Do not create indexes from a generated error unless the query is confirmed in
the source. Do not create indexes in the emulator as a substitute for the
production Console operation.

Validation: confirm both requested indexes appear in the Console with the
correct collection, fields, direction, and scope.

### 4. Wait for both indexes to become Ready

Owner: user in Firebase Console.

Wait until both composite indexes show `Ready`. Do not publish rules while an
index is still building.

Validation: capture the two Ready statuses and timestamps in the change
ticket.

### 5. Publish the final Firestore rules

Owner: user in Firebase Console or the separately approved Firebase release
workflow.

Publish the contents of `firestore.rules` only after the backup, index, and
diff checks pass. Do not replace the untouched baseline file in the
repository. Do not publish `docs/social/firestore-rules-production-baseline-2026-08-01.txt`.

Validation immediately after publishing:

- Confirm the Firebase Console reports the new rules version as active.
- Run authenticated legacy reads/writes for Workout, Nutrition, Progress,
  Auth/profile settings, and existing leaderboard behavior.
- Confirm unauthenticated access and forged social writes remain denied.
- Confirm participant, friendship, block, owner, recipient, and revocation
  checks behave as expected.

### 6. Deploy the exact release commit to Render

Owner: user/release engineer in Render.

Deploy the exact SHA recorded in step 1 from the feature branch. Do not deploy
an uncommitted working tree or a different branch. Keep the existing single
instance architecture; no Redis, Cloud Functions, Cloud Run, Pub/Sub, or paid
realtime service is required.

Validation immediately after deployment:

- Confirm the service is healthy.
- Confirm the deployment commit matches the recorded release SHA.
- Confirm no emulator variables or local-demo flag are active.

### 7. Verify `/health` provenance

Owner: Codex or release engineer.

Request the production `/health` endpoint and confirm:

- `ok` is `true`.
- `buildId` equals the exact deployed Render commit SHA.
- No environment secret, token, API key, or user data is present.

Stop and roll back if the SHA does not match.

### 8. Refresh service-worker state

Owner: Codex or release engineer for validation; user may assist with browser
verification.

Confirm the release service worker has the new cache version and that:

- `/api/*`, including `/api/social/*` and the SSE typing stream, is network
  only and never stored in Cache Storage.
- `/__/auth/*` remains network only.
- Social HTML/CSS/JS are refreshed by the new cache version.
- No user-owned Firestore data is deleted or altered.

Validation: use a clean browser profile and an existing browser profile after
normal service-worker update/refresh. Confirm the Social UI loads and signed-
in API/SSE requests reach the network.

### 9. Run production smoke tests

Owner: user/release engineer with two real verified accounts.

Run the smoke test only after steps 1–8 succeed:

- Sign in with both verified accounts.
- Create/search usernames and send/accept a friend request without refresh.
- Exchange messages without refresh and verify typing works when available.
- Create, save, share, preview, copy, and open a workout plan.
- Create, save, share, preview, copy, and open a nutrition plan.
- Verify personal-record and completed-workout artifacts.
- Verify graph privacy modes, revocation, friend removal, blocking,
  duplicate-message protection, and duplicate-import protection.
- Repeat critical checks in English and Hebrew RTL, desktop and mobile sizes.

Validation: record HTTP status, visible UI result, and any permission,
index, SSE, or API error. Do not record message text, tokens, passwords,
health data, or private artifact contents.

### 10. Monitor the release

Owner: user/release engineer.

For the agreed observation window, monitor:

- Firestore permission-denied and failed-precondition errors.
- Missing-index errors.
- Social API 4xx/5xx rates and latency.
- SSE disconnects and typing-channel cleanup.
- Auth verification and Terms-gate failures.
- Builder failures and provider errors.

The typing state is intentionally in memory on the single Render instance.
It may disappear after a restart; messages must continue to work and the UI
must report typing unavailability without blocking chat.

### 11. Roll back immediately on a critical failure

Owner: user/release engineer.

1. Redeploy the previous known-good Render commit.
2. Restore the untouched Firestore baseline rules through the approved Firebase
   Console/workflow.
3. Confirm legacy Workout, Nutrition, Progress, Auth/profile settings, and
   leaderboard behavior.
4. Keep or remove unused composite indexes according to the Firebase release
   decision; indexes do not grant read/write permission.
5. Verify `/health` reports the previous production SHA.
6. Re-run the two-account smoke checks for the restored release.

Record the rollback reason, timestamps, previous SHA, active rules version, and
the post-rollback validation results.

## Responsibility boundary

Codex can prepare and review the committed rules, indexes, tests, health
provenance, service-worker behavior, and this runbook. Codex can validate
against local emulators and local synthetic data.

The user must perform Firebase Console index creation and rule publication,
Render environment/deployment actions, production smoke testing with real
verified accounts, monitoring, and rollback decisions. This release
preparation does not perform any of those production actions.
