# FuelPhysique Social Experience - Local Implementation Handoff

## Status

The social experience is implemented for local review on `feature/social-sharing-foundation`. It has not been deployed, production data has not been changed, Firebase billing has not been enabled, and no production Firestore rule has been replaced.

Production release remains blocked until the complete live Firestore rules and indexes are backed up, merged with the isolated drafts, regression-tested in the Emulator, and explicitly approved for deployment.

## Product Surface

- `public/social.html`: username onboarding, friends, requests, blocks, conversation list, chat, artifact sharing and previews.
- `public/js/social.js`: authenticated UI controller, active-chat listener, pagination, retries, tombstones, sharing, preview and copy flows.
- `public/js/social-core.mjs`: localization, message merging, chart geometry and presentation helpers.
- `public/css/social.css`: Blue Abyss styling, responsive chat, focus states, RTL and reduced-motion behavior.
- Dashboard, saved workout plans, saved nutrition plans, progress, exercise-progress and workout-history pages link directly into social actions.

## Trusted Server Boundary

`server.js` mounts authenticated routes at `/api/social`. `lib/social-router.js` never accepts a client-provided actor or sender UID; it uses `requireFirebaseUser` and passes the verified UID into `lib/social-store.js`.

Rate limits per authenticated UID, per minute:

- username search: 20
- relationship changes: 12
- messages: 30
- artifacts/copies: 8

The defaults can be lowered through environment variables without changing code. Existing global JSON request limits remain in force.

## Routes

- `GET /api/social/identity`
- `PUT /api/social/identity/username`
- `GET /api/social/users/search?q=...&mode=prefix|exact`
- `GET /api/social/relationships`
- `POST /api/social/friend-requests`
- `PATCH /api/social/friend-requests/:requestId`
- `DELETE /api/social/friends/:friendUid`
- `POST /api/social/blocks`
- `DELETE /api/social/blocks/:targetUid`
- `GET|POST /api/social/conversations`
- `GET /api/social/conversations/:conversationId`
- `GET|POST /api/social/conversations/:conversationId/messages`
- `DELETE /api/social/conversations/:conversationId/messages/:messageId`
- `POST /api/social/conversations/:conversationId/read`
- `GET /api/social/share-sources?type=...`
- `POST /api/social/conversations/:conversationId/artifacts`
- `GET|DELETE /api/social/artifacts/:artifactId`
- `POST /api/social/artifacts/:artifactId/copy`

## Collections And Schemas

- `usernames/{usernameLower}`: atomic case-insensitive reservation and safe search projection.
- `socialProfiles/{uid}`: minimal discoverable profile; no email, body, medical or account fields.
- `friendRequests/{canonicalPairKey}`: one pending direction per user pair, preventing duplicate and opposite requests.
- `friendships/{canonicalPairKey}`: accepted relationship with two immutable participants.
- `users/{uid}/blocks/{blockedUid}`: owner-scoped block records.
- `conversations/{canonicalPairKey}`: immutable two-person participant list and compact last-message metadata.
- `conversations/{conversationId}/messages/{idempotencyHash}`: text or artifact messages. Text is limited to 2,000 Unicode characters.
- `users/{uid}/conversationSummaries/{conversationId}`: compact list rows and unread counts.
- `sharedArtifacts/{artifactId}`: immutable, versioned, sanitized snapshots with one owner, bounded recipients, conversation and revocation state.
- `users/{uid}/sharedImports/{artifactId}`: recipient-owned idempotency record linking an artifact to exactly one copied plan.
- Recipient copies remain in existing `users/{uid}/workoutPlans` or `users/{uid}/nutritionPlans`, with `sourceType: "shared-copy"`, `sourceArtifactId` and attribution.

## Friendship And Chat Security

- Username reservation runs in a Firestore transaction and deletes a previous reservation only when ownership matches.
- Canonical pair document IDs prevent parallel/opposite pending requests.
- Self requests, duplicate requests, opposite requests, non-friend conversations and blocked relationships are rejected.
- Every send transaction rechecks accepted friendship and blocks in both directions.
- Conversation participants cannot be supplied or replaced by the client.
- Message sender UID is derived from the verified token.
- Client idempotency keys become deterministic server-side message document IDs.
- Only a sender can tombstone their own message.
- Conversation history starts at 25 messages and older pages use a timestamp cursor.
- Only the currently open conversation gets a Firestore listener. Authenticated REST remains the fallback until draft rules are safely merged.
- There is no presence, typing indicator, file upload, image upload, voice, video or end-to-end-encryption claim.

## Immutable Sharing

Every artifact is rebuilt from a document owned by the authenticated sender. Sanitizers use field allowlists and byte limits:

- workout: 64 KiB
- nutrition: 96 KiB
- personal record / graph: 16 KiB
- completed workout: 24 KiB

Workout snapshots exclude injury, limitation, private note, generation prompt, optimizer and authentication fields. Copying canonicalizes exercise IDs/equipment, resolves an image path with a safe UI fallback, recalculates weekly muscle volume and recalculates session duration.

Nutrition snapshots include only the visible first option for each shared meal, its ingredients/amounts/images and recomputed macros. Allergies, conditions, deficiencies, body values, restrictions, exclusions, private notes and prompts are not copied. Import totals are rebuilt from the visible ingredient rows.

Recipient-only compatibility checks compare a snapshot with the recipient's own saved equipment or dietary preferences. Warnings never expose sender-private information and change the action to an explicit **Copy As-Is** choice. No exercise or ingredient is silently replaced.

Duplicate imports return the original recipient copy instead of writing another plan. Revocation blocks future preview/copy but does not mutate a copy already owned by the recipient.

## Other Shared Artifacts

- Personal records are verified against sender-owned workout logs and remain view-only for the recipient.
- Completed workouts exclude notes, pain/injury data, unfinished sets and hidden comments.
- Progress graph sources include body-weight trend, weight change, workout consistency, completed workouts per week, training-volume trend and per-exercise strength progression.
- Weight-related sharing defaults to total change. Available privacy modes are exact values, total change only, percentage change only, and normalized trend without numeric labels.
- Graph artifacts contain at most 60 points (or 26 weekly points) and never expose an entire collection.
- Progress photos and GPS routes are not shareable.

## Accessibility, Motion And Layout

- English and Hebrew use matching string tables and document-level RTL/LTR.
- Message text uses `dir="auto"` and `unicode-bidi: plaintext` for mixed-direction content.
- Native dialogs provide focus containment; controls have visible focus outlines and screen-reader labels.
- Workout preview has sticky, keyboard-accessible session navigation and a persistent copy action.
- Charts include SVG title/description and a visible text summary.
- Desktop uses conversation rail plus main surface. Mobile uses a single-pane conversation/chat flow and safe-area-aware composer.
- Animations are short entrance/feedback transitions. Only loading skeletons loop; `prefers-reduced-motion` collapses all motion.

## Spark Compatibility

- Search returns at most 10 username rows.
- Friends/blocks are bounded at 100 and requests at 50 per direction.
- Conversation summaries are bounded at 50.
- Messages are paged 25 at a time.
- Workout/nutrition source lists are bounded at 20, logs at 50-100, and weight entries at 60.
- No global conversation listener, presence writes, typing writes, fan-out service, attachment storage, Cloud Functions, Cloud Run or paid search/messaging dependency was added.

These bounds preserve the hard zero-cost design target but are not a quota guarantee. Existing application traffic shares the same Firebase Spark quota and must be measured in the Console before release.

## Draft Security Files

- `docs/social/firestore-social-rules-draft.txt`
- `docs/social/firestore-social-indexes-draft.json`

The rules draft is a social-only fragment and begins with the required non-deployment warning. `firestore.rules`, `firebase.json` and `.firebaserc` were intentionally not created.

## Manual Firebase Steps Before Release

1. Copy the complete currently published Firestore rules from Firebase Console and save an untouched dated backup with project/version metadata.
2. Export or record the complete current Firestore index list.
3. Add the live baseline to source control and write Emulator regression tests for every existing collection/path.
4. Merge the social fragment by hand; do not replace the baseline.
5. Review the two proposed friend-request indexes against live indexes before creating anything.
6. Configure/verify the existing Render service account has only the Firestore permissions required by these routes.
7. Run Emulator tests for both existing and social behavior, including denied paths.
8. Verify Auth providers/authorized domains and measure current Firestore usage/quota headroom.
9. Perform two-user local/staging acceptance tests in English/Hebrew and mobile/desktop.
10. Deploy rules/indexes/application only after explicit approval with a tested rollback plan.

## Remaining Blockers

- Complete live Firestore rules and index state are still unknown and not backed up in this repository.
- Emulator execution was not performed because Firebase CLI was explicitly not installed and no approved complete baseline exists.
- A real two-account integration pass requires configured Firebase credentials/emulator data and the merged rules in a non-production environment.
- Production Spark quota headroom remains unknown.

Verdict: **READY FOR LOCAL CODE/UI REVIEW; NOT READY FOR PRODUCTION OR FIREBASE RULE DEPLOYMENT.**
