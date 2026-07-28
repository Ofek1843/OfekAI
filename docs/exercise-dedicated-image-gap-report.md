# Exercise dedicated image gap report

Generated on: 2026-07-28

Scope: analysis only. No image files, workout generation logic, equipment repair logic, or image mappings were changed.

## Totals

| Metric | Count |
| --- | ---: |
| Total generated names reviewed | 106 |
| Current surrogate routes reviewed | 53 |
| Safe alias routes | 22 |
| Existing-image routing bug routes | 5 |
| Distinct existing-image routing bugs | 4 |
| Inaccurate surrogate routes that require image work | 22 |
| Distinct new or replacement dedicated images required | 12 |
| Ambiguous routes requiring naming/product decision | 4 |
| Dedicated exercise images already available, excluding fallback | 85 |

Important correction: the previous audit correctly showed `generatorVariantsReachingFallback: 0`, but that does not mean every exercise has its own accurate image. Many generated names currently resolve to a different exercise image.

## Definition used

An exercise has a dedicated image only when the physical image accurately matches the movement, equipment, setup, body position, and variant shown to the user.

Safe sharing is allowed only for harmless naming variants of the same exercise, such as `Hammer Curl` and `Dumbbell Hammer Curl`.

## Table 1 — new images the user must create

| # | Exact exercise name | Suggested filename | Muscle group | Equipment | Current surrogate image | Why the surrogate is inaccurate | Priority |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Assisted Pull Up / Pull Up Assisted If Needed | `assisted-pull-up.png` | Back | Assisted pull-up machine or band + pull-up bar | `pull-up.png` | A normal pull-up does not show assistance, counterweight, band, or assisted setup. | High |
| 2 | Chin Up Assisted If Needed | `assisted-chin-up.png` | Back / biceps | Assisted pull-up machine or band + supinated grip | `chin-up.png` | A normal chin-up does not show assistance, and the grip differs from assisted pull-up. | Medium |
| 3 | Bench Dip | `bench-dip.png` | Triceps / chest | Bench / bodyweight | `dip.png` | Parallel-bar chest dip is a different setup and torso/body path than a bench dip. | High |
| 4 | Hip Thrust Machine / Barbell Hip Thrust Machine | `hip-thrust-machine.png` | Glutes | Hip thrust machine | `barbell-hip-thrust.png` | Machine hip thrust setup is meaningfully different from a barbell-on-hips setup. | Medium |
| 5 | Chest Supported Row | `chest-supported-row.png` | Back | Chest-supported machine, incline bench, or T-bar row setup | `seated-cable-row.png` | Chest support and torso angle change setup and body position; cable seated row is not the same exercise. | High |
| 6 | Seated Machine Row / Machine Row / Seated Row Machine | `seated-machine-row.png` | Back | Machine row | `seated-cable-row.png` | A plate/selectorized machine row is not the same setup as a cable row. | High |
| 7 | Machine Rear Delt Fly / Rear Delt Machine Fly / Reverse Pec Deck | `reverse-pec-deck.png` | Rear delts / shoulders | Reverse pec deck machine | `dumbbell-reverse-fly.png` | Machine reverse fly has different equipment, support, path, and setup from dumbbell reverse fly. | High |
| 8 | Single Arm Cable Row | `single-arm-cable-row.png` | Back | Cable | `seated-cable-row.png` | Single-arm cable row has unilateral setup and torso/handle position not shown in bilateral seated cable row. | Medium |
| 9 | Cable Overhead Triceps Extension | `cable-overhead-triceps-extension.png` | Triceps | Cable | `overhead-tricep-extension.png` | Current image shows dumbbell overhead extension; cable path and setup are different. | Medium |
| 10 | Hanging Knee Raise | `hanging-knee-raise.png` | Core | Pull-up bar | `hanging-leg-raise.png` | Knee raise uses bent knees and different range/body position than straight-leg hanging leg raise. | Low |
| 11 | Incline Dumbbell Curl | `incline-dumbbell-curl.png` | Biceps | Dumbbells + incline bench | `dumbbell-bicep-curl.png` | Incline bench body position and shoulder extension are not shown in a standard dumbbell curl. | Medium |
| 12 | Standing Calf Raise / Standing Calf Raise Machine | `standing-calf-raise.png` or `standing-calf-raise-machine.png` | Calves | Standing calf raise machine or standing setup | `standing-calf-raise.png` currently exists but visually shows a seated calf raise | The file name exists, but the physical image content is seated calf raise, so standing calf raise still lacks an accurate dedicated image. | High |

Note: Table 1 has 12 distinct image tasks. Standing Calf Raise is counted because `standing-calf-raise.png` exists by filename but its visual content is seated calf raise, so it still requires a new accurate image or replacement.

## Table 2 — existing image but broken routing

| Exercise name | Existing correct filename | Current incorrect image | Mapping that must later be repaired |
| --- | --- | --- | --- |
| Bulgarian Split Squat | `bulgarian-split-squat.png` | `dumbbell-goblet-squat.png` | `bulgarian-split-squat` should resolve to `bulgarian-split-squat`, not `dumbbell-goblet-squat`. |
| Dumbbell Bulgarian Split Squat | `bulgarian-split-squat.png` | `dumbbell-goblet-squat.png` | `dumbbell-bulgarian-split-squat` should resolve to `bulgarian-split-squat`. |
| Incline Dumbbell Press | `incline-dumbbell-bench-press.png` | `dumbbell-bench-press.png` | `incline-dumbbell-press` should resolve to `incline-dumbbell-bench-press`. |
| Seated Leg Curl | `seated-leg-curl.png` | `lying-leg-curl.png` | `seated-leg-curl` should resolve to `seated-leg-curl`, not generic `leg-curl`. |
| Triceps Dip | `tricep-dip.png` | `dip.png` | `triceps-dip` should resolve to `tricep-dip`, not chest-focused `dip`. |

Distinct mapping bugs: 4, because both Bulgarian Split Squat rows share the same correct file and repair.

## Table 3 — safe aliases that do not need new images

| Generated name | Existing image | Reason sharing the image is accurate |
| --- | --- | --- |
| Back Squat | `barbell-squat.png` | Back squat is a naming variant of barbell squat. |
| Barbell Back Squat | `barbell-squat.png` | Same barbell squat movement and setup. |
| Barbell Biceps Curl | `barbell-bicep-curl.png` | Plural spelling only; same barbell curl. |
| Barbell Romanian Deadlift | `romanian-deadlift.png` | Same RDL movement with barbell wording. |
| Rdl | `romanian-deadlift.png` | Abbreviation for Romanian Deadlift. |
| Romanian Deadlift Rdl | `romanian-deadlift.png` | Expanded name plus abbreviation; same exercise. |
| Cable Biceps Curl | `cable-bicep-curl.png` | Plural spelling only; same cable curl. |
| Cable Chest Fly | `cable-crossover.png` | Cable chest fly/crossover naming is close enough for this same cable fly setup. |
| Cable Crossover Fly | `cable-crossover.png` | Same cable fly/crossover movement family and setup. |
| Cable Face Pull | `face-pull.png` | Face pull image represents the cable face pull setup. |
| Cable Triceps Pushdown | `cable-tricep-pushdown.png` | Plural spelling only; same cable pushdown. |
| Tricep Pushdown | `cable-tricep-pushdown.png` | Common shortened name for cable triceps pushdown. |
| Triceps Pushdown | `cable-tricep-pushdown.png` | Same cable pushdown movement. |
| Dumbbell Biceps Curl | `dumbbell-bicep-curl.png` | Plural spelling only; same dumbbell curl. |
| Dumbbell Hammer Curl | `hammer-curl.png` | Dumbbell is implicit in hammer curl image. |
| Hammer Curls | `hammer-curl.png` | Plural spelling only; same hammer curl. |
| Flat Dumbbell Press | `dumbbell-bench-press.png` | Flat bench is the standard dumbbell bench press setup. |
| Leg Extension Machine | `leg-extension.png` | Machine is implicit; same leg extension movement. |
| Leg Press Machine | `leg-press.png` | Machine is implicit; same leg press movement. |
| Overhead Triceps Extension | `overhead-tricep-extension.png` | Plural spelling only; same overhead dumbbell triceps extension. |
| Push Up Standard | `push-up.png` | Standard push-up is the default push-up image. |
| Seated Calf Raise Machine | `seated-calf-raise.png` | Current seated calf raise image accurately shows a seated calf raise machine. |

## Table 4 — ambiguous names requiring a decision

| Generated name | Current image | Possible interpretations | Recommended decision |
| --- | --- | --- | --- |
| Bicep Curl | `dumbbell-bicep-curl.png` | Could mean dumbbell curl, barbell curl, cable curl, preacher curl, or machine curl. | Avoid generating generic `Bicep Curl`; generator should specify equipment. |
| Biceps Curl | `dumbbell-bicep-curl.png` | Same ambiguity as Bicep Curl. | Treat as generic and ask generator/repair to choose a specific equipment-based curl. |
| Dumbbell Shoulder Press Seated Or Standing | `dumbbell-shoulder-press.png` | Could be seated or standing; current image may show only one setup. | Prefer generator names `Seated Dumbbell Shoulder Press` or `Standing Dumbbell Shoulder Press`. |
| Seated Row | `seated-cable-row.png` | Could mean seated cable row or seated machine row. | Keep only if equipment is cable; otherwise route machine wording to a dedicated machine-row image after it exists. |

## Mandatory exercise review notes

- Seated Machine Row: not safe; needs `seated-machine-row.png`.
- Machine Rear Delt Fly: not safe; needs reverse pec deck / machine rear delt image.
- Dumbbell Hammer Curl: safe alias; `hammer-curl.png` is accurate.
- Assisted Pull Up: not safe; needs assisted pull-up image.
- Bench Dip: not safe; needs bench dip image.
- Barbell Hip Thrust Machine: not safe; machine setup needs dedicated image or clearer naming.
- Chest Supported Row: not safe; needs dedicated image.
- Bulgarian Split Squat: correct image already exists; routing bug only.
- Cable Chest Fly: safe enough with cable crossover image.
- Cable Crossover Fly: safe enough with cable crossover image.
- Barbell Romanian Deadlift: safe alias to Romanian Deadlift.
- Chin Up Assisted If Needed: not safe; needs assisted chin-up image.

## What this means for the next implementation pass

Do not create all images blindly. The highest-leverage next pass is:

1. Fix routing bugs where correct files already exist.
2. Replace the inaccurate `standing-calf-raise.png` content or add a correct standing calf machine image and route to it.
3. Create the high-priority missing dedicated images: assisted pull-up, bench dip, chest-supported row, seated machine row, reverse pec deck.
