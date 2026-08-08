# Legal-hardening release procedure

This change set couples the Render application release to a Firestore Rules
release. Do not deploy either automatically.

## Preconditions

- Record the exact application commit and the currently published Rules backup.
- Confirm the committed `firestore.rules` passed the local Emulator suite.
- Confirm the full application test suite, lint, and `git diff --check` pass.
- Configure any optional `SOCIAL_REPORT_ALERT_WEBHOOK_URL` only if a controlled
  internal HTTPS moderation-alert endpoint is available. It is not required for
  core reporting.

## Controlled manual order

1. Review the exact committed rules diff against the production backup.
2. Publish the reviewed rules with:

   ```powershell
   npx firebase-tools deploy --only firestore:rules --project ofek-ai-55f1d
   ```

3. Deploy the same recorded application commit to Render.
4. Check `/health` reports that exact commit.
5. Smoke-test existing/current Terms acceptance, account export/deletion UI,
   Social reporting, and ordinary workout/nutrition flows using synthetic test
   accounts only.

No index deployment is required by this change set because
`firestore.indexes.json` is unchanged.

## Rollback

If the application must be rolled back, restore the matching previous Render
commit and restore the exact Rules backup recorded before step 2. Rules and
application must be treated as a pair: leaving the hardened rules active with
an earlier application version can block the earlier client assumptions; using
the new application before publishing the rules can block social-history reads
for deleted-participant tombstones.
