# FuelPhysique Early Access launch checklist

This checklist is a practical prep list, not legal advice.

## Privacy and policy

- [ ] Privacy Policy reviewed for fitness, nutrition, progress photos, videos, leaderboard proof, voice input, saved plans, and conversation history.
- [ ] Terms of Service reviewed for AI-generated content, user responsibility, verification content, and moderation rights.
- [ ] Age guidance documented for workout and nutrition features.
- [ ] Account deletion flow reviewed and tested.
- [ ] Data deletion / export request process defined.
- [ ] Consent copy added for progress photos, verification videos, and health-related inputs.
- [ ] Moderation review flow documented for leaderboard submissions.

## Security and abuse prevention

- [ ] Firebase auth enforced on all private endpoints.
- [ ] Rate limits and queue limits verified in production-like settings.
- [ ] Secrets checked in `.env` only and not committed.
- [ ] CORS and headers reviewed.
- [ ] File ownership checks verified for media deletion and signing.
- [ ] No server route accepts large media bodies in memory for the new upload flow.

## Operations

- [ ] Render environment variables documented.
- [ ] `/health` endpoint verified.
- [ ] Load test results reviewed locally.
- [ ] Log output confirmed to avoid tokens, private keys, or medical content.
- [ ] Graceful shutdown tested.

## Telegram monitoring agent

- [ ] `TELEGRAM_BOT_TOKEN` added to Render.
- [ ] `TELEGRAM_CHAT_ID` added to Render.
- [ ] `TELEGRAM_MONITOR_ENABLED` left on by default, or set to `false` only if you want to pause alerts.
- [ ] Optional tuning vars reviewed: `TELEGRAM_ALERT_COOLDOWN_MS`, `TELEGRAM_HEALTH_INTERVAL_MS`, `TELEGRAM_REPORT_INTERVAL_MS`, `TELEGRAM_DAILY_REPORT_HOUR`.
- [ ] Confirm the bot can send a startup message, a startup digest, and a daily digest.
- [ ] Confirm the site-feedback widget sends reports to `/api/site-feedback` and falls back to email only if the API is unavailable.

