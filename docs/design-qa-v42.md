# Premium Athletic Illustration V4.2 QA

## Scope

This pass preserves the V4.1 product design and upgrades only the shared athlete anatomy, exercise biomechanics, scene motion, and asset-generation synchronization.

## Visual evidence

Evidence is stored in `.redesign-review/v42-athlete-quality/` and intentionally excluded from production assets.

### Before

- `before/01-landing-hero-1440x900.png` — original deadlift hero.
- `before/03-landing-scenes-current-1440x900.png` — original training, nutrition, progress, coach, and social scenes.
- `before/05-dashboard-bench-current-1440x900-stable.png` — original bench press lockout.

### After

- `after/05-deadlift-final-1440x900.png` — refined deadlift silhouette and close, vertical bar path.
- `after/06-feature-scenes-final-1440x900.png` — final training, nutrition, progress, coach, and social scene set.
- `after/03-bench-corrected-1440x900.png` — corrected bench press geometry and lockout.
- `after/07-landing-mobile-390x844.png` — mobile landing containment.
- `after/08-landing-scenes-mobile-390x844.jpg` — mobile feature-card containment.
- `after/16-landing-hebrew-mobile-390x844.jpg` — Hebrew/RTL inspection state.

## Acceptance observations

- Shared figures now use broader shoulders, a narrower waist, a defined chest/waist line, shaped limbs, curved feet, and a directional head silhouette.
- Deadlift setup, pull, and lockout keep the bar close to the body with readable circular plates.
- The curl keeps the dumbbell connected to the hand and level through the motion.
- The nutrition scene settles in a visible bite pose with coordinated utensil, arm, head, and torso motion.
- The progress figure reads as an athletic stance on a scale.
- Bench press now starts over the lower/mid chest and travels slightly back toward the shoulder line at lockout.
- Coach and social inherit the stronger athlete silhouette without adding scene clutter.
- Landing, Dashboard, and Auth loaded locally; email login succeeded against the Auth emulator.
- English and Hebrew states remained functional. The comparison slider accepted an interactive value of 72.
- Browser diagnostics contained no errors; only expected local Firestore profile lifecycle logs were present.
- The mobile browser harness reports a 390px layout viewport with a 375px content width and no document-level horizontal overflow. The harness screenshot surface trims the scrollbar-width edge, so geometry and automated responsive checks are the authoritative containment signal.

## Remaining visual limitation

The figures intentionally remain faceless, flat editorial vectors. They are materially more athletic and expressive than V4.1, but they are not intended to approach realistic anatomical illustration.
