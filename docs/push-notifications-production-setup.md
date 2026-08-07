# FuelPhysique PWA Push Notifications — production setup

This runbook prepares the infrastructure only after the feature branch has passed integration review. It does not require Cloud Functions, Cloud Run, Blaze billing, a second service worker, or a `render.yaml` takeover.

## Release architecture

- Browser Firebase SDK: `12.17.1`, loaded from the existing Google CDN imports. This minor upgrade is required for the current FID APIs: `register`, `onRegistered`, `onUnregistered`, and `unregister`.
- Server Firebase Admin SDK: `14.2.0` (already current in this repository), targeting `message.fid` rather than the deprecated registration-token field.
- Existing root service worker: `/sw.js`. The FCM registration is explicitly attached to this registration; do not add `firebase-messaging-sw.js` or another root-scope worker.
- Server-only Firestore collections: `pushInstallations`, `notificationPreferences`, and `pushEvents`.
- Scheduler command: `npm run notifications:send-workout-reminders`.
- Scheduler cadence: every 10 minutes in UTC. The script converts each user's IANA timezone and exits after one bounded, idempotent pass.

Official references:

- [Firebase Web FID registration](https://firebase.google.com/docs/cloud-messaging/web/get-started)
- [Firebase Admin FID targeting](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk)
- [Render Cron Jobs](https://render.com/docs/cronjobs)
- [Render environment variables](https://render.com/docs/configure-environment-variables)

## Checkpoint 1 — Firebase APIs

Use the existing Firebase project only. Do not create a second project.

1. Open Firebase Console and select the production FuelPhysique project (`ofek-ai-55f1d`; verify this against the production web app before changing anything).
2. Open **Project settings → Cloud Messaging**.
3. Confirm the **Firebase Cloud Messaging API (HTTP v1)** is enabled. If the page offers an enable action, enable only this API.
4. Open Google Cloud Console for the same project and go to **APIs & Services → Library**.
5. Search for **FCM Registration API** (`fcmregistrations.googleapis.com`) and enable it if it is not already enabled. Newer projects often have it enabled automatically; verify rather than assuming.
6. Do not enable Cloud Functions, Cloud Run, BigQuery export, campaigns, Analytics, or billing for this feature.

## Checkpoint 2 — Web Push / VAPID

1. In Firebase Console, open **Project settings → Cloud Messaging**.
2. In **Web configuration → Web Push certificates**, choose **Generate key pair** only if the production web app has no existing Web Push key.
3. If FuelPhysique already has a Web Push key used by installed clients, keep it. Replacing it can invalidate existing subscriptions.
4. Copy only the displayed **public key** into the secure deployment environment as `FIREBASE_WEB_PUSH_VAPID_PUBLIC_KEY`.
5. Do not paste or commit a VAPID private key. Firebase retains the generated private material for FCM.

## Checkpoint 3 — trusted server identity

The existing Render web service and the new cron job need a trusted Firebase Admin identity with access to the production Firestore database and permission to send FCM messages.

1. Reuse the existing `FIREBASE_SERVICE_ACCOUNT_JSON` already configured for server-side Social/Firestore access; do not generate a new key unless the existing identity cannot be granted the required permission.
2. In Google Cloud Console **IAM & Admin → IAM**, verify that identity can send FCM messages. For a cross-project sender, Firebase documents the **Firebase Cloud Messaging API Admin** role on the target project. Keep permissions no broader than the existing application needs.
3. Never expose this JSON to browser code, logs, screenshots, or repository files.

## Checkpoint 4 — Render web-service variables

On the existing FuelPhysique Render web service, open **Environment** and add/verify:

```text
FIREBASE_PROJECT_ID=ofek-ai-55f1d
PUSH_NOTIFICATIONS_ENABLED=true
FIREBASE_WEB_PUSH_VAPID_PUBLIC_KEY=<Firebase Web Push public key>
PUSH_TEST_NOTIFICATIONS_ENABLED=false
```

Keep the existing `FIREBASE_SERVICE_ACCOUNT_JSON` unchanged. Save these values with the release deployment, not before the reviewed code is ready. The public VAPID key is intentionally returned only to an authenticated browser by `/api/notifications/config`; no private key is used by the client.

## Checkpoint 5 — Render Cron Job

Create this manually in Render after the reviewed web release is healthy:

1. Render Dashboard → **New + → Cron Job**.
2. Connect the same repository and exact reviewed branch/commit used by the web service.
3. Runtime: the repository's existing Node runtime.
4. Build command: `npm ci`.
5. Command: `npm run notifications:send-workout-reminders`.
6. Schedule: `*/10 * * * *` (Render evaluates cron schedules in UTC).
7. Add the same `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, and `PUSH_NOTIFICATIONS_ENABLED=true` values as the web service, preferably through the existing secure Environment Group.
8. `FIREBASE_WEB_PUSH_VAPID_PUBLIC_KEY` is not needed by the server-only cron process, but is harmless if inherited from an Environment Group.
9. Keep `PUSH_TEST_NOTIFICATIONS_ENABLED=false`.
10. Confirm a manual run exits successfully and logs only aggregate counts/type/provider errors—never message content, full FIDs, or credentials.

Do not add a permanent worker or `setInterval`. Render documents a minimum monthly charge of US$1 per Cron Job service, billed by active runtime. Firebase lists Cloud Messaging as a no-cost product; existing Firestore reads/writes still count against the project's normal Firestore quota and billing plan.

## Firestore rules and indexes

No rules or index deployment is required for this release:

- The three new root collections have no client `match` grants in the currently reviewed rules, so Firestore's default deny behavior keeps them server-only.
- Registration/preferences are written through authenticated server endpoints using Admin credentials.
- Queries use single-field filters/orders only; no additional composite index is required.
- Emulator tests must remain green before release. Do not publish rules merely because this feature is deployed.

## Controlled smoke test

1. Deploy the reviewed commit to a non-production or controlled production window.
2. Confirm `/health` reports the exact reviewed SHA.
3. Sign in with verified test accounts A and B.
4. Install the PWA and enable notifications from the in-app prompt on B.
5. From A, send one text message, one workout share, and one nutrition share. Confirm B receives exactly one notification of each type and each tap opens the exact authorized destination.
6. Disable message previews on B and confirm the next text displays only “Sent you a new message.”
7. Sign B out, sign A into the same installation, and verify B's notifications no longer appear there.
8. Confirm the cron job sends one due workout reminder, skips a completed workout/rest day, and a second run does not duplicate it.
9. Leave the production self-test endpoint disabled.

## Real iPhone/iPad acceptance

Automated tests cannot validate Apple's system permission sheet or Lock Screen delivery. On a physical supported iPhone/iPad:

1. Open FuelPhysique in Safari before installation and confirm Notification Settings shows **Install FuelPhysique to enable notifications**, with no broken Enable button.
2. Use **Share → Add to Home Screen** and launch the installed PWA.
3. Tap **Enable notifications** and confirm the iOS permission dialog appears only after that tap.
4. Test Allow, background delivery, Lock Screen delivery, closed-PWA delivery, and exact deep-link navigation.
5. Test Don't Allow and confirm the app reports blocked status without automatically asking again.
6. Test **Not now**, relaunch, and confirm the custom prompt remains suppressed by the 30-day local cooldown while Settings remains available.

## Rollback

1. Roll Render back to the previous healthy application commit.
2. Disable or suspend the new Render Cron Job.
3. Set `PUSH_NOTIFICATIONS_ENABLED=false` on the web service if the previous commit includes the feature but FCM must be stopped immediately.
4. Do not rotate/delete the VAPID key during a code rollback; doing so can invalidate otherwise healthy installed registrations.
5. No Firestore rule rollback or index rollback is expected because this release requires neither deployment.
