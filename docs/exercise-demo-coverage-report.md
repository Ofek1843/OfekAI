# Exercise demo coverage report

Updated: 2026-07-27

## Summary

- Canonical dedicated exercise image files: 84 PNG files.
- Fallback image: `/images/exercises/fuelphysique-demo-fallback.svg`.
- Alias entries in the resolver: 155.
- Dedicated-image coverage for the resolver's known image slugs: 84 / 84 = 100%.
- Arbitrary model wording is not claimed as 100% covered. Unknown names now resolve to the branded fallback instead of a broken PNG URL.
- Missing exercise-specific image behavior: returns HTTP 200 fallback, logs a localhost-only development warning, and does not claim to demonstrate the movement.

## Newly added dedicated image files

| Exercise ID | Display names / aliases | Image path | Status |
|---|---|---|---|
| abductors | Hip Abductor Machine, Hip Abduction Machine, Abductor Machine, Seated Hip Abduction | `/images/exercises/abductors.png` | newly_added |
| adductors | Hip Adductor Machine, Hip Adduction Machine, Adductor Machine, Seated Hip Adduction | `/images/exercises/adductors.png` | newly_added |
| cable-crunch | Cable Crunch, Kneeling Cable Crunch | `/images/exercises/cable-crunch.png` | newly_added |
| incline-dumbbell-bench-press | Incline Dumbbell Bench Press, Incline Dumbbell Press, Incline DB Press | `/images/exercises/incline-dumbbell-bench-press.png` | newly_added |
| seated-leg-curl | Seated Leg Curl, Seated Hamstring Curl | `/images/exercises/seated-leg-curl.png` | newly_added |
| step-up | Step-up, Step-ups, Box Step-up, Dumbbell Step-up, Barbell Step-up | `/images/exercises/step-up.png` | newly_added |
| typewriter-pull-ups | Typewriter Pull-up, Typewriter Pull-ups, Typewriter Pullups | `/images/exercises/typewriter-pull-ups.png` | newly_added |

## Approved `new` replacements imported into canonical filenames

| Temporary file | Canonical file overwritten | Before | After | Status |
|---|---|---:|---:|---|
| abb-rollout-new.png | ab-wheel-rollout.png | 1,576,531 | 1,291,247 | replaced_with_new |
| barbell-bench-pressnew.png | bench-press.png | 1,789,598 | 1,192,641 | replaced_with_new |
| cable-crassovernew.png | cable-crossover.png | 1,734,217 | 1,593,955 | replaced_with_new |
| cable-woodchopper-new.png | cable-woodchopper.png | 1,720,402 | 1,534,389 | replaced_with_new |
| dumbell-bench-pressnew.png | dumbbell-bench-press.png | 1,689,000 | 1,353,888 | replaced_with_new |
| dumbell-fly-new.png | dumbbell-fly.png | 1,714,081 | 1,418,851 | replaced_with_new |
| face-pull-new.png | face-pull.png | 1,587,453 | 1,300,713 | replaced_with_new |
| good-morning-new.png | good-morning.png | 1,534,397 | 1,385,017 | replaced_with_new |
| hanging-leg-raise-new.png | hanging-leg-raise.png | 1,760,112 | 1,149,960 | replaced_with_new |
| incline-barbell-dumbbell-bench-pressnew.png | incline-bench-press.png | 1,772,133 | 1,297,955 | replaced_with_new |
| incline-dumbell-bench-press-new.png | incline-dumbbell-bench-press.png | 0 | 1,499,062 | newly_added |
| l-sit-new.png | l-sit.png | 1,576,531 | 1,331,514 | replaced_with_new |
| leg-extension-new.png | leg-extension.png | 1,592,528 | 983,864 | replaced_with_new |
| leg-press-new.png | leg-press.png | 1,683,611 | 1,448,844 | replaced_with_new |
| machine-chest-press-new.png | machine-chest-press.png | 1,832,303 | 1,359,035 | replaced_with_new |
| muscle-up-new.png | muscle-up.png | 1,602,521 | 1,122,486 | replaced_with_new |
| plank-new.png | plank.png | 1,577,100 | 847,254 | replaced_with_new |
| rack-pull-new.png | rack-pull.png | 1,697,314 | 1,360,410 | replaced_with_new |
| romanian-deadlift-new.png | romanian-deadlift.png | 1,735,333 | 1,185,094 | replaced_with_new |
| russian-twist-new.png | russian-twist.png | 1,555,783 | 1,369,448 | replaced_with_new |
| seated-calf-raise-new.png | seated-calf-raise.png | 1,570,717 | 976,276 | replaced_with_new |
| side-plank-new.png | side-plank.png | 1,649,136 | 968,384 | replaced_with_new |
| sumo-deadlift-new.png | sumo-deadlift.png | 1,723,322 | 1,319,675 | replaced_with_new |

## Runtime resolution order

1. `exercise.exerciseId`
2. `exercise.id`
3. `exercise.demoName`
4. `exercise.name`
5. `exercise.exercise`
6. exact normalized alias
7. normalized slug if it is a known file
8. branded neutral fallback

## Verification performed

- `node --test test/workout-builder-assets.test.js`
- `npm test`
- Local HTTP checks for representative images:
  - `/images/exercises/dumbbell-bench-press.png`
  - `/images/exercises/machine-chest-press.png`
  - `/images/exercises/plank.png`
  - `/images/exercises/abductors.png`
  - `/images/exercises/incline-dumbbell-bench-press.png`
  - `/images/exercises/fuelphysique-demo-fallback.svg`

All returned HTTP 200 with the expected image MIME type.

