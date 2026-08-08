# Social-report operations

Social reports are stored server-side in `socialReports`. Clients cannot read,
create, update, or delete those records directly. The reporting endpoint
verifies that the reporter can access the target, records a bounded snapshot,
and rate-limits submissions.

For a voice-message report, the report snapshot stores only the immutable
conversation/message reference, sender UID, and type `voice`. It does not copy
the audio, ImageKit file ID, signed URL, duration, MIME type, size, or waveform.
Authorized reviewers must request the original through the same participant-
aware operational process and must not place audio in alerts or broad logs.

## Operational signal

Set `SOCIAL_REPORT_ALERT_WEBHOOK_URL` only for a controlled internal HTTPS
endpoint if an immediate alert is needed. The alert is best effort and contains
only `event`, `reportId`, `targetType`, and `reason`. It never includes report
details, message bodies, names, emails, UIDs, image URLs, health data, IP
addresses, file IDs, or credentials. An alert-delivery failure never changes a
report submission result.

Without that optional configuration, reports remain in the protected
moderation queue for authorized operational review. Product copy must not
promise a review time or a particular outcome.

## Review procedure

1. Use authorized server-side administrative tooling to inspect the report ID.
2. Confirm the target and report reason before viewing only the minimum source
   data needed for the investigation.
3. Record any action in protected operational tooling; do not expose a
   reporter's identity to the reported person.
4. Preserve or remove content only under the applicable product and legal
   process. This repository does not create an automatic enforcement action.
