# FuelPhysique data inventory

Last reviewed: 2026-08-08. This is a technical inventory, not legal advice.

| Category | Primary storage | Purpose | Access |
| --- | --- | --- | --- |
| Account identity | Firebase Authentication; `users/{uid}` | sign-in, profile routing, acceptance record | member; server for protected operations |
| Athlete Core / plans / logs / measurements | `users/{uid}` subcollections | personalized fitness and nutrition features | owner; server where an API action needs it |
| Progress / transformation media | ImageKit; legacy Firebase Storage transformation path | user-requested photo features | owner paths and authorized server operations |
| Social profile / friendship / messages / shares | Firestore social collections | friend, message and sharing features | constrained by server routes and Firestore read rules |
| Push installation / preferences | `pushInstallations`, `notificationPreferences`, `pushEvents` | optional device notifications | server only |
| Billing status | `users/{uid}.subscription` | entitlement display | trusted PayPlus callback/server only writes |
| Operational metrics / feedback | in-memory aggregate telemetry | reliability and coarse product metrics | operators; no raw feedback sent to Telegram |
| Reports / deletion audit | server-only Firestore collections | abuse handling and minimum deletion evidence | authorized staff only; no client rule allows access |

External processors are listed in the public Subprocessors page and owner-provider review. Do not add a processor without updating both documents and obtaining the required owner/counsel review.
