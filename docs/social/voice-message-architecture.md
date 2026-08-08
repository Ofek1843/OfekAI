# Social voice-message architecture

Last reviewed: 2026-08-08.

## Storage decision

Voice media uses the already configured ImageKit integration. Uploads are
server-mediated, marked private, placed below
`/fuelphysique/users/{senderUid}/voice/{conversationId}`, and accessed only
through a short-lived signed URL after the server rechecks the requesting
participant's current conversation authorization. Firestore stores safe
metadata and the provider file ID, never raw audio or a permanent media URL.
ImageKit's official security documentation describes private files and signed
URLs as basic security features available across its pricing plans. Its upload
API accepts non-image/audio files; the implementation's 10 MiB default remains
below the documented free-plan per-file audio/raw limit. This does not promise
that the existing FuelPhysique account has sufficient monthly storage or
delivery quota—the owner must verify that account before production rollout.

Firebase Storage was not selected. Current Firebase documentation requires a
Blaze project to use Cloud Storage, while this release is explicitly forbidden
from enabling billing or paid services. A new storage product and rules
deployment would also duplicate the provider and account-media controls that
already exist for ImageKit.

Official capability references:

- ImageKit private files and signed URLs: https://imagekit.io/docs/media-delivery-basic-security
- ImageKit server upload API: https://imagekit.io/docs/api-reference/upload-file/upload-file
- ImageKit deletion API: https://imagekit.io/docs/api-reference/digital-asset-management-dam/managing-assets/delete-file
- Firebase Storage billing requirement: https://firebase.google.com/docs/storage/web/start

## Security and lifecycle

- Authentication and accepted-friend/block checks run before the raw request
  body parser or provider upload.
- The final Firestore transaction rechecks the relationship to close the race
  between preflight and commit.
- Limits default to 120 seconds, 10 MiB, and six uploads per UID per minute.
- MIME allowlisting is paired with WebM, Ogg, or ISO BMFF/MP4 signatures.
- Message IDs are stable by sender/client idempotency key. Duplicate retries do
  not upload again; a concurrent loser is deleted.
- Playback revalidates provider file ID, private status, sender namespace, and
  conversation namespace before producing a 10-minute signed URL.
- Message/account deletion verifies the same ownership and clears the active
  file ID. Ownership mismatches can never delete another member's asset.
- Push payloads say only that a voice message arrived. Reports contain no audio
  copy or media capability. Account export contains bounded metadata only.
- The service worker never caches audio or signed ImageKit URLs.
- The voice path never calls `/api/transcribe`, OpenAI, analytics, telemetry,
  or feedback endpoints.

## Environment configuration

The existing `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, and
`IMAGEKIT_URL_ENDPOINT` variables are required. No new secret is introduced.
Optional non-secret controls are `VOICE_MESSAGE_MAX_BYTES` (default 10485760),
`VOICE_MESSAGE_MAX_SECONDS` (default 120),
`VOICE_MESSAGE_PLAYBACK_TTL_SECONDS` (default 600), and
`SOCIAL_VOICE_MESSAGES_PER_UID_PER_MINUTE` (default 6). When ImageKit is not
fully configured, voice upload/playback/deletion returns a controlled 503;
text chat and all other Social features continue to work.

This design consumes storage and delivery quota from the existing ImageKit
account. The owner must confirm available quota and provider agreement coverage
before production enablement; the implementation does not enable billing.
