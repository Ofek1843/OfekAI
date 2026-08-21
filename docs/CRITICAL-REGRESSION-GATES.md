# FuelPhysique critical regression gates

Run these gates after every major product or visual phase. A redesign is not complete when an existing control, route, persistence path, security boundary, or fallback disappears.

## Workout Builder

- Generate a complete program in provider and deterministic local/demo modes.
- Navigate every workout day without losing the program state.
- Exercise names, instructions, metadata, and verified images remain coherent.
- Every exercise exposes a discoverable `Replace` action.
- Replacing one exercise preserves muscle, movement role, equipment, limitations, experience, day intent, goal, and volume context.
- Replacement avoids the same exercise and same-day duplicates when an alternative exists.
- Save Workout remains readable in idle, focus, loading, success, and error states.
- Saved plans reopen with any exercise replacement persisted.

## Nutrition Generator

- Generate a target-aware nutrition plan.
- Ready, Quick, Cook, and Mix preferences remain available.
- Practical/local foods and international catalog options remain available.
- Meal images resolve without unrelated fallbacks.
- Every meal exposes a discoverable `Replace` action.
- Replacing one meal preserves calorie structure, macros, allergies, dietary restrictions, dislikes, slot, practicality, and preparation preferences.
- Saved plans reopen with the selected/replaced meal state.

## Athlete Core

- Body/profile data remains user-owned and readable only by that user.
- Existing canonical metabolism/TDEE calculations remain the source of maintenance estimates.
- Existing protein and calorie targets remain the source of plan/log targets.
- Progress tracking and historical records remain intact.

## Dashboard and navigation

- Primary navigation routes resolve.
- Hamburger opens a readable drawer above all content.
- Escape, backdrop, and close control dismiss the drawer and return focus.
- Keyboard focus stays inside an open modal drawer.
- Mobile drawer and Hebrew RTL layout remain usable without horizontal overflow.

## Authentication

- Email/password session behavior remains intact.
- Google Auth popup and redirect helper paths remain intact.
- Terms acceptance routing does not loop.

## V4 real-athlete scenes

- Deadlift, Training, Nutrition, Progress, Connect, Coach, and Bench load through the image-sequence engine.
- Viewport playback, preload/decode, reduced motion, fallback, and responsive containment remain intact.
- Transparent derivatives have no obvious matte/halo on their production card surfaces.

## PWA

- Service-worker generation matches the current release assets.
- Authentication helpers, `/api/`, private media, and voice media remain network-only and uncached.
- No stale old/new design asset mix survives activation.

## Social, voice, music, and push

- Existing messaging, sharing, blocking, voice recording/playback, music links, notification preferences, and push notification flows remain intact.
- Private voice media remains `no-store` and is never added to the application cache.

## Phase exit checklist

1. Run the phase-focused tests.
2. Run lint and `git diff --check`.
3. Exercise the affected flows in the local browser in English and Hebrew.
4. Check desktop, tablet, and mobile for overflow and keyboard access.
5. Commit only when the phase is green and independently reversible.
