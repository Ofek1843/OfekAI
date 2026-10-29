# Personalization release validation — 2026-10-29

## Scope

Existing account personalization, Hebrew addressing, plan-recipient overrides, hero visuals, and approved exercise media. No workout-engine, calorie-formula, authentication-rule, or analytics change. First-visit language uses the primary browser language, otherwise English. Telegram changes, dependencies, review galleries, old candidates and unused promotional images are excluded.

123 female WebPs were copied byte-for-byte from latest staged candidates after validating explicit human approvals against SHA-256. The committed media manifest records each approved hash and its exercise IDs. Coverage is 129/129 IDs, including six shared mappings. Male originals remain untouched. Human visual approval is not professional exercise certification.

The new female hero uses existing dimensions and versioned filenames. Male/no-preference and bounded load-error fallback remain intact. Generated plans retain recipient and demonstration preference independently of the account. Saved-plan viewing overrides operate on a copy.

## Executed checks

- Build, lint and postlint: passed; no generated feature-page/sitemap changes.
- Focused media, recipient, account, Hebrew, responsive/result and tracker tests: 71 passed.
- Existing isolated Firebase rules and email flows: 11 passed.
- New Firebase integration test: passed with actual Auth and Firestore emulators (demo-fuelphysique, localhost only). Tested new account without settings, preference write, logout/login, independent SDK client, male-recipient saved/reopened workout, legacy account and cross-user access denial. The test normalizes objects at the VM boundary and waits for initial settings load before changing preference.
- Chrome: all 123 WebPs decoded; real result/saved-view renderers, four days, demo modal, replacement, model switching, widths 1440/860/390 passed with zero JS errors or horizontal overflow. Synthetic fixture, no production access.
- Dashboard/builder Chrome fixtures: female/male Hebrew, new hero, male recipient without account writes, explicit physiological coefficient and nutrition/calculator defaults passed. Auth/generation controllers are excluded; separate API tests exercise the real server with mocked upstreams.
- Workout generation/reroll HTTP tests: 10 passed with mocked upstream Firebase/OpenAI.
- Localization suites: 25 passed.
- Standard suite before updated language-version assertion: 1569/1582 passed; 13 failed. The introduced exact-language-version assertion now targets the intentional new version and its suite passes. Remaining 12 are previously reproduced clean-HEAD failures: historical cache/layout/source assertions, cache-query expectations and nutrition VM harnesses parsing ES-module imports as classic scripts. Tests were not disabled. A new directory-inventory issue was fixed by auditing files only; female variants have separate hash/ID tests.

## Limits

Actual live AI Coach replies remain unverified: no isolated endpoint or local API key is configured. Trusted prompt construction, authenticated preference lookup, bounded timeout and neutral fallback were tested. Production Firebase cross-device persistence remains unverified; actual SDK persistence and owner-only rules passed in emulators. No production accounts or private user data were accessed or changed.

## Deployment and rollback

Pre-release production /health and Render both reported 99535801d7f4c6504650e74d695d114e2c3c0b64, live deploy dep-dbebmc7avr4c73ad1l40.

Target: existing OfekAI service srv-d7b12fdm5p6s73aldlj0 in FuelPhysique workspace tea-d7b104dm5p6s73alc36g, Ofek1843/OfekAI repository, main branch, manual deploy (auto-deploy off).

On a critical regression, redeploy the previous known-good commit through Render's manual specific-commit deployment, keep auto-deploy off and verify /health.buildId plus read-only routes. Do not reset Git, delete data or rewrite branch history. No database migration.
