# PROJECT_STATUS

## Current state
FuelPhysique is running as a public early-access fitness platform with workout planning, nutrition planning, workout tracking, progress tracking, conversation history, pricing, billing flow, and landing-page funnel tracking.

## Working features
- Authentication and onboarding flow.
- Workout builder and manual workout builder.
- Saved workout plans and saved nutrition plans.
- Workout tracker and workout history.
- Progress tracking charts.
- Pricing / wishlist flow.
- Billing result handling.
- Landing page analytics and referral attribution.
- Public stats endpoint for the landing page.
- Brand-neutral coach identity response in the server prompt.
- Quick food check-in on the dashboard.

## Known issues / limitations
- Public stats rely on Firebase service-account access and REST queries.
- The live GPS / running flow still depends on browser location support and may be less accurate on some mobile devices.
- Some older localization strings in non-English languages may still need cleanup in follow-up passes.
- Leaderboard visibility is intentionally reduced for now; the underlying logic remains.

## Recent fixes in this pass
- Removed exposed founder-name text from the main chat/app surface.
- Added public beta / early-access landing positioning.
- Added registered-user and usage counters on the landing page.
- Added analytics sanitization and more funnel events.
- Added tests for creator response, analytics sanitization, and public-stat summaries.
- Kept the load-test harness passing.

## Next best step
Polish the mobile navigation and running flow, then decide whether the public leaderboard should return before launch.
