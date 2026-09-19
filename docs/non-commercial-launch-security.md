# Non-commercial launch security checklist

This checklist records the remaining owner-controlled checks for the free
version. It is not legal advice and does not authorize paid subscriptions.

## Before promoting the free version

- [ ] In Firebase Console, restrict Authentication authorized domains to the
  production domain and deliberate local/preview environments only.
- [ ] Enable Firebase App Check monitoring, verify legitimate traffic, then
  enforce it for Firestore and Storage.
- [ ] Restrict the Firebase web API key by browser referrer and to the APIs
  actually used by FuelPhysique. The web key is public by design; restrictions
  and Firestore rules are the security boundary.
- [ ] Confirm the deployed Firestore and Storage rules match this repository.
- [ ] Confirm Render environment variables are set only in Render, rotate any
  credential ever pasted into a public location, and limit dashboard access.
- [ ] Confirm ImageKit uses private files for member media and a least-privilege
  key where ImageKit supports it.
- [ ] Test sign-up, sign-in, account export, account deletion, a private photo,
  and a voice message using two separate test accounts.
- [ ] Review the Privacy Policy and Terms with qualified local counsel before
  making any compliance claim or collecting paid subscriptions.

## Guardrails kept in code

- `npm run security:check` fails on a production dependency vulnerability rated
  High or Critical and runs focused privacy/auth/media regression tests.
- The public operational-statistics endpoint is intentionally absent. Aggregate
  internal telemetry continues server-side and does not need to be exposed to
  visitors.
- Authentication, signed private media, rate limits, Terms acceptance, and
  security headers are covered by regression tests. A clean `npm ci` install is
  required for a release candidate.
