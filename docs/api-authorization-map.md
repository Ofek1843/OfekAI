# API authorization map

| Surface | Authority | Server enforcement |
| --- | --- | --- |
| `/api/account/export`, `/api/account` | Firebase bearer token UID only | export excludes other members and secrets; deletion requires recent auth time plus `DELETE` |
| `/api/social/*` | Firebase bearer token UID only | server derives actor/recipient; social writes are not client writable |
| `/api/notifications/*` | Firebase bearer token UID only | installation, preference and test notification bind to caller UID |
| `/api/billing/checkout` | Firebase bearer token UID only | signed, short-lived PayPlus reference |
| `/api/billing/payplus/callback` | PayPlus signature | subscription write originates server-side only |
| builder/chat/image upload auth | Firebase bearer token UID only | rate-limited and terms-gated; storage paths are UID scoped |
| public health/legal/static endpoints | none | no private data response |

Current Terms acceptance is checked server-side for protected Firebase-authenticated routes. Account export/deletion and legal-policy endpoints are intentionally exempt so a member can leave or review terms.
