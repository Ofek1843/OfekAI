# Data retention and deletion design

FuelPhysique retains account content while an account is active so the member can use saved plans, tracking, social, and progress features. The in-product deletion request requires recent reauthentication and a typed confirmation. The server cleans user-root data, owned subcollections, social profile/name reservation, social graph records, owned shares, participant conversations, notification installations/preferences, referenced media, then deletes Firebase Auth last.

The only deletion audit is a SHA-256 hash of the UID, outcome, and server timestamps in `accountDeletionAudits`; it deliberately contains no email, health information, message text, or media URL. Failed jobs retain a bounded failure code until retried by the same authenticated account or handled under the incident process.

Backups, provider retention, legal holds, and statutory retention periods are owner/counsel decisions. This application does not claim immediate deletion from every provider backup. See `docs/OWNER_LEGAL_ACTIONS.md` before publishing a fixed retention promise.
