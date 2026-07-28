# Exercise Image Coverage Report

Generated: 2026-07-28T11:07:56.815Z

The workout model may still produce arbitrary free-text exercise names. This audit covers the canonical resolver inventory plus set-credit aliases; unsupported free text intentionally falls back to the branded image.

## Totals

| Metric | Value |
| --- | --- |
| physicalFiles | 86 |
| dedicatedExerciseImagesExcludingFallback | 85 |
| canonicalSupportedExercises | 85 |
| canonicalExercisesWithDedicatedImages | 85 |
| canonicalExercisesMissingImages | 0 |
| aliasesCovered | 199 |
| orphanFiles | 0 |
| brokenMappings | 0 |
| invalidFiles | 0 |
| caseMismatches | 0 |
| fallbackOnlyAliases | 0 |
| generatorSupportedCanonicalExercises | 49 |
| generatorKnownNameVariants | 106 |
| generatorVariantsWithDedicatedOrSurrogateImage | 106 |
| generatorVariantsReachingFallback | 0 |
| generatorExistingFilesWithBrokenRouting | 0 |
| generatorGenuinelyMissingImages | 0 |
| generatorSurrogateImageRoutes | 53 |
| generatorCanonicalMismatches | 0 |

## A. Resolver-internal coverage

This checks `KNOWN_EXERCISE_IMAGE_SLUGS` against files on disk. It proves resolver/disk consistency only.

## Missing canonical exercise images

| Item |
| --- |
| None |

## Canonical exercise to image

| exerciseId | English name | resolved URL | physical file | classification | aliases |
| --- | --- | --- | --- | --- | --- |
| ab-wheel-rollout | Ab Wheel Rollout | /images/exercises/ab-wheel-rollout.png | ab-wheel-rollout.png | COVERED | ab-rollout |
| abductors | Abductors | /images/exercises/abductors.png | abductors.png | COVERED | abductor-machine, abductors, hip-abduction-machine, hip-abductor, hip-abductor-machine, seated-hip-abduction |
| adductors | Adductors | /images/exercises/adductors.png | adductors.png | COVERED | adductor-machine, adductors, hip-adduction-machine, hip-adductor, hip-adductor-machine, seated-hip-adduction |
| archer-push-up | Archer Push Up | /images/exercises/archer-push-up.png | archer-push-up.png | COVERED |  |
| arnold-press | Arnold Press | /images/exercises/arnold-press.png | arnold-press.png | COVERED |  |
| australian-row | Australian Row | /images/exercises/australian-row.png | australian-row.png | COVERED | australian-pull-up, bodyweight-row, inverted-row, ring-row, suspension-row |
| barbell-bicep-curl | Barbell Bicep Curl | /images/exercises/barbell-bicep-curl.png | barbell-bicep-curl.png | COVERED | barbell-biceps-curl, barbell-curl, ez-bar-curl |
| barbell-front-squat | Barbell Front Squat | /images/exercises/barbell-front-squat.png | barbell-front-squat.png | COVERED | front-squat |
| barbell-hip-thrust | Barbell Hip Thrust | /images/exercises/barbell-hip-thrust.png | barbell-hip-thrust.png | COVERED | barbell-glute-bridge, glute-bridge, hip-thrust |
| barbell-row | Barbell Row | /images/exercises/barbell-row.png | barbell-row.png | COVERED | bent-over-barbell-row, bent-over-row, pendlay-row |
| barbell-shoulder-press | Barbell Shoulder Press | /images/exercises/barbell-shoulder-press.png | barbell-shoulder-press.png | COVERED | military-press, overhead-press, seated-barbell-shoulder-press, standing-overhead-press |
| barbell-shrug | Barbell Shrug | /images/exercises/barbell-shrug.png | barbell-shrug.png | COVERED | barbell-shrugs, shrug, shrugs |
| barbell-squat | Barbell Squat | /images/exercises/barbell-squat.png | barbell-squat.png | COVERED | back-squat, barbell-back-squat, high-bar-squat, low-bar-squat, squat |
| barbell-upright-row | Barbell Upright Row | /images/exercises/barbell-upright-row.png | barbell-upright-row.png | COVERED | upright-row |
| bench-press | Bench Press | /images/exercises/bench-press.png | bench-press.png | COVERED | barbell-bench-press, flat-barbell-bench-press, flat-bench-press |
| bulgarian-split-squat | Bulgarian Split Squat | /images/exercises/bulgarian-split-squat.png | bulgarian-split-squat.png | COVERED | bulgarian-split-squat-dumbbell, split-squat |
| cable-bicep-curl | Cable Bicep Curl | /images/exercises/cable-bicep-curl.png | cable-bicep-curl.png | COVERED | cable-biceps-curl, cable-curl |
| cable-crossover | Cable Crossover | /images/exercises/cable-crossover.png | cable-crossover.png | COVERED | cable-chest-fly, cable-fly, high-to-low-cable-fly |
| cable-crunch | Cable Crunch | /images/exercises/cable-crunch.png | cable-crunch.png | COVERED | cable-crunch, kneeling-cable-crunch |
| cable-lateral-raise | Cable Lateral Raise | /images/exercises/cable-lateral-raise.png | cable-lateral-raise.png | COVERED |  |
| cable-tricep-pushdown | Cable Tricep Pushdown | /images/exercises/cable-tricep-pushdown.png | cable-tricep-pushdown.png | COVERED | cable-triceps-pushdown, rope-tricep-pushdown, rope-triceps-pushdown, tricep-pushdown, triceps-pushdown |
| cable-woodchopper | Cable Woodchopper | /images/exercises/cable-woodchopper.png | cable-woodchopper.png | COVERED | cable-wood-chopper, cable-woodchop, wood-chopper, woodchopper |
| chin-up | Chin Up | /images/exercises/chin-up.png | chin-up.png | COVERED | chin-ups |
| close-grip-bench-press | Close Grip Bench Press | /images/exercises/close-grip-bench-press.png | close-grip-bench-press.png | COVERED |  |
| close-grip-lat-pulldown | Close Grip Lat Pulldown | /images/exercises/close-grip-lat-pulldown.png | close-grip-lat-pulldown.png | COVERED | neutral-grip-lat-pulldown, straight-arm-pulldown |
| concentration-curl | Concentration Curl | /images/exercises/concentration-curl.png | concentration-curl.png | COVERED |  |
| diamond-push-up | Diamond Push Up | /images/exercises/diamond-push-up.png | diamond-push-up.png | COVERED | close-grip-push-up |
| dip | Dip | /images/exercises/dip.png | dip.png | COVERED | chest-dip, parallel-bar-dip |
| dumbbell-bench-press | Dumbbell Bench Press | /images/exercises/dumbbell-bench-press.png | dumbbell-bench-press.png | COVERED | dumbbell-press |
| dumbbell-bicep-curl | Dumbbell Bicep Curl | /images/exercises/dumbbell-bicep-curl.png | dumbbell-bicep-curl.png | COVERED | alternating-dumbbell-curl, bicep-curl, biceps-curl, dumbbell-biceps-curl, dumbbell-curl, incline-dumbbell-curl |
| dumbbell-calf-raise | Dumbbell Calf Raise | /images/exercises/dumbbell-calf-raise.png | dumbbell-calf-raise.png | COVERED | dumbbell-calf-raises, standing-dumbbell-calf-raise, standing-dumbbell-calf-raises |
| dumbbell-fly | Dumbbell Fly | /images/exercises/dumbbell-fly.png | dumbbell-fly.png | COVERED | dumbbell-chest-fly, flat-dumbbell-fly |
| dumbbell-front-raise | Dumbbell Front Raise | /images/exercises/dumbbell-front-raise.png | dumbbell-front-raise.png | COVERED | front-raise |
| dumbbell-goblet-squat | Dumbbell Goblet Squat | /images/exercises/dumbbell-goblet-squat.png | dumbbell-goblet-squat.png | COVERED | goblet-squat |
| dumbbell-hip-thrust | Dumbbell Hip Thrust | /images/exercises/dumbbell-hip-thrust.png | dumbbell-hip-thrust.png | COVERED |  |
| dumbbell-lateral-raise | Dumbbell Lateral Raise | /images/exercises/dumbbell-lateral-raise.png | dumbbell-lateral-raise.png | COVERED | dumbell-lateral-raise, dumbell-lateral-raises, lateral-raise, lateral-raises, side-lateral-raise |
| dumbbell-reverse-fly | Dumbbell Reverse Fly | /images/exercises/dumbbell-reverse-fly.png | dumbbell-reverse-fly.png | COVERED | bent-over-lateral-raise, machine-rear-delt-fly, rear-delt-fly, rear-delt-machine-fly, rear-delt-raise, reverse-fly, reverse-pec-deck |
| dumbbell-row | Dumbbell Row | /images/exercises/dumbbell-row.png | dumbbell-row.png | COVERED | dumbbell-bent-over-row, one-arm-dumbbell-row, single-arm-dumbbell-row |
| dumbbell-shoulder-press | Dumbbell Shoulder Press | /images/exercises/dumbbell-shoulder-press.png | dumbbell-shoulder-press.png | COVERED | dumbbell-overhead-press, seated-dumbbell-shoulder-press |
| dumbbell-shrug | Dumbbell Shrug | /images/exercises/dumbbell-shrug.png | dumbbell-shrug.png | COVERED | dumbbell-shrugs, dumbbells-shrug, dumbbells-shrugs |
| dumbbell-walking-lunge | Dumbbell Walking Lunge | /images/exercises/dumbbell-walking-lunge.png | dumbbell-walking-lunge.png | COVERED | dumbbell-walking-lunges, walking-dumbbell-lunge, walking-dumbbell-lunges |
| face-pull | Face Pull | /images/exercises/face-pull.png | face-pull.png | COVERED | cable-face-pull |
| good-morning | Good Morning | /images/exercises/good-morning.png | good-morning.png | COVERED | back-extension, hyperextension |
| hack-squat | Hack Squat | /images/exercises/hack-squat.png | hack-squat.png | COVERED | smith-machine-squat |
| hammer-curl | Hammer Curl | /images/exercises/hammer-curl.png | hammer-curl.png | COVERED | dumbbell-hammer-curl, dumbbell-hammer-curls, hammer-curls |
| handstand | Handstand | /images/exercises/handstand.png | handstand.png | COVERED |  |
| handstand-push-up | Handstand Push Up | /images/exercises/handstand-push-up.png | handstand-push-up.png | COVERED |  |
| hanging-leg-raise | Hanging Leg Raise | /images/exercises/hanging-leg-raise.png | hanging-leg-raise.png | COVERED | hanging-knee-raise, leg-raise |
| incline-bench-press | Incline Bench Press | /images/exercises/incline-bench-press.png | incline-bench-press.png | COVERED | incline-barbell-bench-press, incline-press |
| incline-dumbbell-bench-press | Incline Dumbbell Bench Press | /images/exercises/incline-dumbbell-bench-press.png | incline-dumbbell-bench-press.png | COVERED | dumbell-incline-bench-press, dumbell-incline-press, incline-db-bench-press, incline-db-press, incline-dumbbell-bench-press, incline-dumbbell-press |
| kettlebell-swing | Kettlebell Swing | /images/exercises/kettlebell-swing.png | kettlebell-swing.png | COVERED |  |
| l-sit | L-sit | /images/exercises/l-sit.png | l-sit.png | COVERED |  |
| lat-pulldown | Lat Pulldown | /images/exercises/lat-pulldown.png | lat-pulldown.png | COVERED | cable-lat-pulldown, lat-pulldowns, wide-grip-lat-pulldown |
| leg-extension | Leg Extension | /images/exercises/leg-extension.png | leg-extension.png | COVERED | knee-extension, leg-extensions, seated-leg-extension |
| leg-press | Leg Press | /images/exercises/leg-press.png | leg-press.png | COVERED |  |
| lying-leg-curl | Lying Leg Curl | /images/exercises/lying-leg-curl.png | lying-leg-curl.png | COVERED | hamstring-curl, leg-curl, lying-leg-curls |
| machine-chest-fly | Machine Chest Fly | /images/exercises/machine-chest-fly.png | machine-chest-fly.png | COVERED | chest-fly, machine-fly, pec-deck |
| machine-chest-press | Machine Chest Press | /images/exercises/machine-chest-press.png | machine-chest-press.png | COVERED | chest-press, chest-press-machine, seated-chest-press |
| machine-shoulder-press | Machine Shoulder Press | /images/exercises/machine-shoulder-press.png | machine-shoulder-press.png | COVERED | shoulder-press-machine |
| muscle-up | Muscle Up | /images/exercises/muscle-up.png | muscle-up.png | COVERED |  |
| neutral-grip-pull-up | Neutral Grip Pull Up | /images/exercises/neutral-grip-pull-up.png | neutral-grip-pull-up.png | COVERED | neutral-grip-pullup |
| one-arm-pull-up | One Arm Pull Up | /images/exercises/one-arm-pull-up.png | one-arm-pull-up.png | COVERED | archer-pull-up, assisted-one-arm-pull-up, one-arm-chin-up |
| overhead-tricep-extension | Overhead Tricep Extension | /images/exercises/overhead-tricep-extension.png | overhead-tricep-extension.png | COVERED | cable-overhead-triceps-extension, dumbbell-overhead-triceps-extension, overhead-triceps-extension |
| pike-push-up | Pike Push Up | /images/exercises/pike-push-up.png | pike-push-up.png | COVERED |  |
| pistol-squat | Pistol Squat | /images/exercises/pistol-squat.png | pistol-squat.png | COVERED |  |
| plank | Plank | /images/exercises/plank.png | plank.png | COVERED | plank-hold |
| preacher-curl | Preacher Curl | /images/exercises/preacher-curl.png | preacher-curl.png | COVERED | cable-preacher-curl, ez-bar-preacher-curl, machine-preacher-curl |
| pull-up | Pull Up | /images/exercises/pull-up.png | pull-up.png | COVERED | pull-ups, pullup, wide-grip-pull-up |
| push-up | Push Up | /images/exercises/push-up.png | push-up.png | COVERED | push-ups, pushup |
| rack-pull | Rack Pull | /images/exercises/rack-pull.png | rack-pull.png | COVERED | conventional-deadlift |
| reverse-lunge | Reverse Lunge | /images/exercises/reverse-lunge.png | reverse-lunge.png | COVERED | dumbbell-lunge, dumbbell-lunges, forward-lunge, lunge, walking-lunge, walking-lunges |
| romanian-deadlift | Romanian Deadlift | /images/exercises/romanian-deadlift.png | romanian-deadlift.png | COVERED | deadlift, dumbbell-romanian-deadlift, rdl, stiff-leg-deadlift |
| russian-twist | Russian Twist | /images/exercises/russian-twist.png | russian-twist.png | COVERED | crunch |
| seated-cable-row | Seated Cable Row | /images/exercises/seated-cable-row.png | seated-cable-row.png | COVERED | cable-row, chest-supported-row, machine-row, seated-machine-row, seated-row, seated-row-machine |
| seated-calf-raise | Seated Calf Raise | /images/exercises/seated-calf-raise.png | seated-calf-raise.png | COVERED | seated-calf-raises |
| seated-leg-curl | Seated Leg Curl | /images/exercises/seated-leg-curl.png | seated-leg-curl.png | COVERED | seated-hamstring-curl, seated-leg-curl, seated-leg-curls |
| side-plank | Side Plank | /images/exercises/side-plank.png | side-plank.png | COVERED |  |
| skull-crusher | Skull Crusher | /images/exercises/skull-crusher.png | skull-crusher.png | COVERED | lying-triceps-extension, skull-crushers |
| standing-calf-raise | Standing Calf Raise | /images/exercises/standing-calf-raise.png | standing-calf-raise.png | COVERED | calf-raise, machine-calf-raise, smith-machine-calf-raise, standing-calf-raises |
| step-up | Step Up | /images/exercises/step-up.png | step-up.png | COVERED | barbell-step-up, box-step-up, dumbbell-step-up, step-ups |
| sumo-deadlift | Sumo Deadlift | /images/exercises/sumo-deadlift.png | sumo-deadlift.png | COVERED |  |
| t-bar-row | T Bar Row | /images/exercises/t-bar-row.png | t-bar-row.png | COVERED |  |
| tricep-dip | Tricep Dip | /images/exercises/tricep-dip.png | tricep-dip.png | COVERED | bench-dip, triceps-dip |
| typewriter-pull-ups | Typewriter Pull Ups | /images/exercises/typewriter-pull-ups.png | typewriter-pull-ups.png | COVERED | typewriter-pull-up, typewriter-pull-ups, typewriter-pullups |
| wide-grip-push-up | Wide Grip Push Up | /images/exercises/wide-grip-push-up.png | wide-grip-push-up.png | COVERED | wide-push-up |

## Image file to exercise

| filename | size | git status | canonical exercise | referenced by resolver | classification |
| --- | --- | --- | --- | --- | --- |
| ab-wheel-rollout.png | 1291247 | tracked | ab-wheel-rollout | yes | COVERED |
| abductors.png | 1270491 | tracked | abductors | yes | COVERED |
| adductors.png | 1268975 | tracked | adductors | yes | COVERED |
| archer-push-up.png | 1674534 | tracked | archer-push-up | yes | COVERED |
| arnold-press.png | 1269440 | tracked | arnold-press | yes | COVERED |
| australian-row.png | 1300427 | tracked | australian-row | yes | COVERED |
| barbell-bicep-curl.png | 1018407 | tracked | barbell-bicep-curl | yes | COVERED |
| barbell-front-squat.png | 1577237 | tracked | barbell-front-squat | yes | COVERED |
| barbell-hip-thrust.png | 1601799 | tracked | barbell-hip-thrust | yes | COVERED |
| barbell-row.png | 1570829 | tracked | barbell-row | yes | COVERED |
| barbell-shoulder-press.png | 1296830 | tracked | barbell-shoulder-press | yes | COVERED |
| barbell-shrug.png | 1217377 | tracked | barbell-shrug | yes | COVERED |
| barbell-squat.png | 1595059 | tracked | barbell-squat | yes | COVERED |
| barbell-upright-row.png | 1506554 | tracked | barbell-upright-row | yes | COVERED |
| bench-press.png | 1192641 | tracked | bench-press | yes | COVERED |
| bulgarian-split-squat.png | 1708698 | tracked | bulgarian-split-squat | yes | COVERED |
| cable-bicep-curl.png | 1045077 | tracked | cable-bicep-curl | yes | COVERED |
| cable-crossover.png | 1593955 | tracked | cable-crossover | yes | COVERED |
| cable-crunch.png | 1302454 | tracked | cable-crunch | yes | COVERED |
| cable-lateral-raise.png | 1509185 | tracked | cable-lateral-raise | yes | COVERED |
| cable-tricep-pushdown.png | 1363681 | tracked | cable-tricep-pushdown | yes | COVERED |
| cable-woodchopper.png | 1534389 | tracked | cable-woodchopper | yes | COVERED |
| chin-up.png | 923852 | tracked | chin-up | yes | COVERED |
| close-grip-bench-press.png | 1133049 | tracked | close-grip-bench-press | yes | COVERED |
| close-grip-lat-pulldown.png | 1505180 | tracked | close-grip-lat-pulldown | yes | COVERED |
| concentration-curl.png | 1487280 | tracked | concentration-curl | yes | COVERED |
| diamond-push-up.png | 1665909 | tracked | diamond-push-up | yes | COVERED |
| dip.png | 1603945 | tracked | dip | yes | COVERED |
| dumbbell-bench-press.png | 1353888 | tracked | dumbbell-bench-press | yes | COVERED |
| dumbbell-bicep-curl.png | 943124 | tracked | dumbbell-bicep-curl | yes | COVERED |
| dumbbell-calf-raise.png | 1098289 | tracked | dumbbell-calf-raise | yes | COVERED |
| dumbbell-fly.png | 1418851 | tracked | dumbbell-fly | yes | COVERED |
| dumbbell-front-raise.png | 1127923 | tracked | dumbbell-front-raise | yes | COVERED |
| dumbbell-goblet-squat.png | 1686351 | tracked | dumbbell-goblet-squat | yes | COVERED |
| dumbbell-hip-thrust.png | 1633763 | tracked | dumbbell-hip-thrust | yes | COVERED |
| dumbbell-lateral-raise.png | 1144244 | tracked | dumbbell-lateral-raise | yes | COVERED |
| dumbbell-reverse-fly.png | 1502435 | tracked | dumbbell-reverse-fly | yes | COVERED |
| dumbbell-row.png | 1875335 | tracked | dumbbell-row | yes | COVERED |
| dumbbell-shoulder-press.png | 1723418 | tracked | dumbbell-shoulder-press | yes | COVERED |
| dumbbell-shrug.png | 143844 | tracked | dumbbell-shrug | yes | COVERED |
| dumbbell-walking-lunge.png | 1598340 | tracked | dumbbell-walking-lunge | yes | COVERED |
| face-pull.png | 1300713 | tracked | face-pull | yes | COVERED |
| fuelphysique-demo-fallback.svg | 1891 | tracked |  | yes | COVERED |
| good-morning.png | 1385017 | tracked | good-morning | yes | COVERED |
| hack-squat.png | 1700114 | tracked | hack-squat | yes | COVERED |
| hammer-curl.png | 974428 | tracked | hammer-curl | yes | COVERED |
| handstand-push-up.png | 201548 | tracked | handstand-push-up | yes | COVERED |
| handstand.png | 189673 | tracked | handstand | yes | COVERED |
| hanging-leg-raise.png | 1149960 | tracked | hanging-leg-raise | yes | COVERED |
| incline-bench-press.png | 1297955 | tracked | incline-bench-press | yes | COVERED |
| incline-dumbbell-bench-press.png | 1536297 | tracked | incline-dumbbell-bench-press | yes | COVERED |
| kettlebell-swing.png | 1656935 | tracked | kettlebell-swing | yes | COVERED |
| l-sit.png | 1331514 | tracked | l-sit | yes | COVERED |
| lat-pulldown.png | 1327966 | tracked | lat-pulldown | yes | COVERED |
| leg-extension.png | 983864 | tracked | leg-extension | yes | COVERED |
| leg-press.png | 1448844 | tracked | leg-press | yes | COVERED |
| lying-leg-curl.png | 1487638 | tracked | lying-leg-curl | yes | COVERED |
| machine-chest-fly.png | 1693795 | tracked | machine-chest-fly | yes | COVERED |
| machine-chest-press.png | 1359035 | tracked | machine-chest-press | yes | COVERED |
| machine-shoulder-press.png | 1402469 | tracked | machine-shoulder-press | yes | COVERED |
| muscle-up.png | 1122486 | tracked | muscle-up | yes | COVERED |
| neutral-grip-pull-up.png | 1334073 | tracked | neutral-grip-pull-up | yes | COVERED |
| one-arm-pull-up.png | 1302630 | tracked | one-arm-pull-up | yes | COVERED |
| overhead-tricep-extension.png | 1016910 | tracked | overhead-tricep-extension | yes | COVERED |
| pike-push-up.png | 1153909 | tracked | pike-push-up | yes | COVERED |
| pistol-squat.png | 1743444 | tracked | pistol-squat | yes | COVERED |
| plank.png | 847254 | tracked | plank | yes | COVERED |
| preacher-curl.png | 1098725 | tracked | preacher-curl | yes | COVERED |
| pull-up.png | 1297673 | tracked | pull-up | yes | COVERED |
| push-up.png | 1694045 | tracked | push-up | yes | COVERED |
| rack-pull.png | 1360410 | tracked | rack-pull | yes | COVERED |
| reverse-lunge.png | 1674039 | tracked | reverse-lunge | yes | COVERED |
| romanian-deadlift.png | 1185094 | tracked | romanian-deadlift | yes | COVERED |
| russian-twist.png | 1369448 | tracked | russian-twist | yes | COVERED |
| seated-cable-row.png | 1181976 | tracked | seated-cable-row | yes | COVERED |
| seated-calf-raise.png | 976276 | tracked | seated-calf-raise | yes | COVERED |
| seated-leg-curl.png | 84041 | tracked | seated-leg-curl | yes | COVERED |
| side-plank.png | 968384 | tracked | side-plank | yes | COVERED |
| skull-crusher.png | 1024550 | tracked | skull-crusher | yes | COVERED |
| standing-calf-raise.png | 1584518 | tracked | standing-calf-raise | yes | COVERED |
| step-up.png | 1219330 | tracked | step-up | yes | COVERED |
| sumo-deadlift.png | 1319675 | tracked | sumo-deadlift | yes | COVERED |
| t-bar-row.png | 949888 | tracked | t-bar-row | yes | COVERED |
| tricep-dip.png | 966138 | tracked | tricep-dip | yes | COVERED |
| typewriter-pull-ups.png | 1284498 | tracked | typewriter-pull-ups | yes | COVERED |
| wide-grip-push-up.png | 1629368 | tracked | wide-grip-push-up | yes | COVERED |

## B. Generator-to-image coverage

This starts from names and IDs the Workout Builder backend can plausibly return: set-credit IDs, backend aliases and observed generated fixtures.

| generated name | demoName | provided exerciseId | canonical exerciseId | resolved URL | classification | sources |
| --- | --- | --- | --- | --- | --- | --- |
| Ab Wheel Rollout | Ab Wheel Rollout | ab-wheel-rollout | ab-wheel-rollout | /images/exercises/ab-wheel-rollout.png | GENERATOR_COVERED | setcredits |
| Assisted Pull Up | Assisted Pull Up | assisted-pull-up | pull-up | /images/exercises/pull-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Australian Row | Australian Row | australian-row | australian-row | /images/exercises/australian-row.png | GENERATOR_COVERED | setcredits |
| Back Squat | Back Squat | back-squat | barbell-squat | /images/exercises/barbell-squat.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Barbell Back Squat | Barbell Back Squat | barbell-back-squat | barbell-squat | /images/exercises/barbell-squat.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Barbell Bench Press | Barbell Bench Press | barbell-bench-press | barbell-bench-press | /images/exercises/bench-press.png | GENERATOR_COVERED | setcredits |
| Barbell Bicep Curl | Barbell Bicep Curl | barbell-bicep-curl | barbell-bicep-curl | /images/exercises/barbell-bicep-curl.png | GENERATOR_COVERED | setcredits |
| Barbell Biceps Curl | Barbell Biceps Curl | barbell-biceps-curl | barbell-bicep-curl | /images/exercises/barbell-bicep-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Barbell Hip Thrust | Barbell Hip Thrust | barbell-hip-thrust | barbell-hip-thrust | /images/exercises/barbell-hip-thrust.png | GENERATOR_COVERED | setcredits |
| Barbell Hip Thrust Machine | Barbell Hip Thrust Machine | barbell-hip-thrust-machine | barbell-hip-thrust | /images/exercises/barbell-hip-thrust.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Barbell Romanian Deadlift | Barbell Romanian Deadlift | barbell-romanian-deadlift | romanian-deadlift | /images/exercises/romanian-deadlift.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Barbell Row | Barbell Row | barbell-row | barbell-row | /images/exercises/barbell-row.png | GENERATOR_COVERED | setcredits |
| Barbell Shoulder Press | Barbell Shoulder Press | barbell-shoulder-press | barbell-shoulder-press | /images/exercises/barbell-shoulder-press.png | GENERATOR_COVERED | setcredits |
| Barbell Squat | Barbell Squat | barbell-squat | barbell-squat | /images/exercises/barbell-squat.png | GENERATOR_COVERED | setcredits |
| Bench Dip | Bench Dip | bench-dip | dip | /images/exercises/dip.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Bicep Curl | Bicep Curl | bicep-curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Biceps Curl | Biceps Curl | biceps-curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Bulgarian Split Squat | Bulgarian Split Squat | bulgarian-split-squat | dumbbell-goblet-squat | /images/exercises/dumbbell-goblet-squat.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Bicep Curl | Cable Bicep Curl | cable-bicep-curl | cable-bicep-curl | /images/exercises/cable-bicep-curl.png | GENERATOR_COVERED | setcredits |
| Cable Biceps Curl | Cable Biceps Curl | cable-biceps-curl | cable-bicep-curl | /images/exercises/cable-bicep-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Chest Fly | Cable Chest Fly | cable-chest-fly | cable-crossover | /images/exercises/cable-crossover.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Crossover | Cable Crossover | cable-crossover | cable-crossover | /images/exercises/cable-crossover.png | GENERATOR_COVERED | setcredits |
| Cable Crossover Fly | Cable Crossover Fly | cable-crossover-fly | cable-crossover | /images/exercises/cable-crossover.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Crunch | Cable Crunch | cable-crunch | cable-crunch | /images/exercises/cable-crunch.png | GENERATOR_COVERED | setcredits |
| Cable Face Pull | Cable Face Pull |  | face-pull | /images/exercises/face-pull.png | GENERATOR_COVERED | observed-fixture |
| Cable Face Pull | Cable Face Pull | cable-face-pull | face-pull | /images/exercises/face-pull.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Lateral Raise | Cable Lateral Raise | cable-lateral-raise | cable-lateral-raise | /images/exercises/cable-lateral-raise.png | GENERATOR_COVERED | setcredits |
| Cable Overhead Triceps Extension | Cable Overhead Triceps Extension | cable-overhead-triceps-extension | overhead-tricep-extension | /images/exercises/overhead-tricep-extension.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Tricep Pushdown | Cable Tricep Pushdown | cable-tricep-pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | GENERATOR_COVERED | setcredits |
| Cable Triceps Pushdown | Cable Triceps Pushdown |  | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | GENERATOR_COVERED | observed-fixture |
| Cable Triceps Pushdown | Cable Triceps Pushdown | cable-triceps-pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Chest Supported Row | Chest Supported Row | chest-supported-row | chest-supported-row | /images/exercises/seated-cable-row.png | GENERATOR_COVERED | setcredits |
| Chin Up | Chin Up | chin-up | chin-up | /images/exercises/chin-up.png | GENERATOR_COVERED | setcredits |
| Chin Up Assisted If Needed | Chin Up Assisted If Needed | chin-up-assisted-if-needed | chin-up | /images/exercises/chin-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dip | Dip | dip | dip | /images/exercises/dip.png | GENERATOR_COVERED | setcredits |
| Dumbbell Bench Press | Dumbbell Bench Press | dumbbell-bench-press | dumbbell-bench-press | /images/exercises/dumbbell-bench-press.png | GENERATOR_COVERED | setcredits |
| Dumbbell Biceps Curl | Dumbbell Biceps Curl | dumbbell-biceps-curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Bulgarian Split Squat | Dumbbell Bulgarian Split Squat | dumbbell-bulgarian-split-squat | dumbbell-goblet-squat | /images/exercises/dumbbell-goblet-squat.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Curl | Dumbbell Curl | dumbbell-curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | GENERATOR_COVERED | setcredits |
| Dumbbell Fly | Dumbbell Fly | dumbbell-fly | dumbbell-fly | /images/exercises/dumbbell-fly.png | GENERATOR_COVERED | setcredits |
| Dumbbell Goblet Squat | Dumbbell Goblet Squat | dumbbell-goblet-squat | dumbbell-goblet-squat | /images/exercises/dumbbell-goblet-squat.png | GENERATOR_COVERED | setcredits |
| Dumbbell Hammer Curl | Dumbbell Hammer Curl |  | hammer-curl | /images/exercises/hammer-curl.png | GENERATOR_COVERED | observed-fixture |
| Dumbbell Hammer Curl | Dumbbell Hammer Curl | dumbbell-hammer-curl | hammer-curl | /images/exercises/hammer-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Lateral Raise | Dumbbell Lateral Raise | dumbbell-lateral-raise | dumbbell-lateral-raise | /images/exercises/dumbbell-lateral-raise.png | GENERATOR_COVERED | setcredits |
| Dumbbell Reverse Fly | Dumbbell Reverse Fly | dumbbell-reverse-fly | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | GENERATOR_COVERED | setcredits |
| Dumbbell Shoulder Press | Dumbbell Shoulder Press | dumbbell-shoulder-press | dumbbell-shoulder-press | /images/exercises/dumbbell-shoulder-press.png | GENERATOR_COVERED | setcredits |
| Dumbbell Shoulder Press Seated Or Standing | Dumbbell Shoulder Press Seated Or Standing | dumbbell-shoulder-press-seated-or-standing | dumbbell-shoulder-press | /images/exercises/dumbbell-shoulder-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Face Pull | Face Pull | face-pull | face-pull | /images/exercises/face-pull.png | GENERATOR_COVERED | setcredits |
| Flat Dumbbell Press | Flat Dumbbell Press | flat-dumbbell-press | dumbbell-bench-press | /images/exercises/dumbbell-bench-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Hack Squat | Hack Squat | hack-squat | hack-squat | /images/exercises/hack-squat.png | GENERATOR_COVERED | setcredits |
| Hammer Curl | Hammer Curl | hammer-curl | hammer-curl | /images/exercises/hammer-curl.png | GENERATOR_COVERED | setcredits |
| Hammer Curls | Hammer Curls |  | hammer-curl | /images/exercises/hammer-curl.png | GENERATOR_COVERED | observed-fixture |
| Hammer Curls | Hammer Curls | hammer-curls | hammer-curl | /images/exercises/hammer-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Hanging Knee Raise | Hanging Knee Raise | hanging-knee-raise | hanging-leg-raise | /images/exercises/hanging-leg-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Hanging Leg Raise | Hanging Leg Raise | hanging-leg-raise | hanging-leg-raise | /images/exercises/hanging-leg-raise.png | GENERATOR_COVERED | setcredits |
| Incline Dumbbell Curl | Incline Dumbbell Curl | incline-dumbbell-curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Incline Dumbbell Press | Incline Dumbbell Press | incline-dumbbell-press | dumbbell-bench-press | /images/exercises/dumbbell-bench-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Lat Pulldown | Lat Pulldown | lat-pulldown | lat-pulldown | /images/exercises/lat-pulldown.png | GENERATOR_COVERED | setcredits |
| Leg Curl | Leg Curl | leg-curl | leg-curl | /images/exercises/lying-leg-curl.png | GENERATOR_COVERED | setcredits |
| Leg Extension | Leg Extension | leg-extension | leg-extension | /images/exercises/leg-extension.png | GENERATOR_COVERED | setcredits |
| Leg Extension Machine | Leg Extension Machine | leg-extension-machine | leg-extension | /images/exercises/leg-extension.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Leg Press | Leg Press | leg-press | leg-press | /images/exercises/leg-press.png | GENERATOR_COVERED | setcredits |
| Leg Press Machine | Leg Press Machine | leg-press-machine | leg-press | /images/exercises/leg-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Lying Leg Curl | Lying Leg Curl | lying-leg-curl | lying-leg-curl | /images/exercises/lying-leg-curl.png | GENERATOR_COVERED | setcredits |
| Machine Chest Fly | Machine Chest Fly | machine-chest-fly | machine-chest-fly | /images/exercises/machine-chest-fly.png | GENERATOR_COVERED | backend-alias, setcredits |
| Machine Chest Press | Machine Chest Press | machine-chest-press | machine-chest-press | /images/exercises/machine-chest-press.png | GENERATOR_COVERED | setcredits |
| Machine Rear Delt Fly | Machine Rear Delt Fly |  | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | COVERED_BY_SURROGATE_IMAGE | observed-fixture |
| Machine Rear Delt Fly | Machine Rear Delt Fly | machine-rear-delt-fly | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Machine Row | Machine Row |  | seated-cable-row | /images/exercises/seated-cable-row.png | COVERED_BY_SURROGATE_IMAGE | observed-fixture |
| Machine Row | Machine Row | machine-row | seated-cable-row | /images/exercises/seated-cable-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Machine Shoulder Press | Machine Shoulder Press | machine-shoulder-press | machine-shoulder-press | /images/exercises/machine-shoulder-press.png | GENERATOR_COVERED | setcredits |
| Muscle Up | Muscle Up | muscle-up | muscle-up | /images/exercises/muscle-up.png | GENERATOR_COVERED | setcredits |
| Neutral Grip Lat Pulldown | Neutral Grip Lat Pulldown | neutral-grip-lat-pulldown | neutral-grip-lat-pulldown | /images/exercises/close-grip-lat-pulldown.png | GENERATOR_COVERED | setcredits |
| Overhead Press | Overhead Press | overhead-press | overhead-press | /images/exercises/barbell-shoulder-press.png | GENERATOR_COVERED | setcredits |
| Overhead Tricep Extension | Overhead Tricep Extension | overhead-tricep-extension | overhead-tricep-extension | /images/exercises/overhead-tricep-extension.png | GENERATOR_COVERED | setcredits |
| Overhead Triceps Extension | Overhead Triceps Extension | overhead-triceps-extension | overhead-tricep-extension | /images/exercises/overhead-tricep-extension.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Pec Deck | Pec Deck | pec-deck | pec-deck | /images/exercises/machine-chest-fly.png | GENERATOR_COVERED | setcredits |
| Plank | Plank | plank | plank | /images/exercises/plank.png | GENERATOR_COVERED | setcredits |
| Pull Up | Pull Up | pull-up | pull-up | /images/exercises/pull-up.png | GENERATOR_COVERED | setcredits |
| Pull Up Assisted If Needed | Pull Up Assisted If Needed | pull-up-assisted-if-needed | pull-up | /images/exercises/pull-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Push Up | Push Up | push-up | push-up | /images/exercises/push-up.png | GENERATOR_COVERED | setcredits |
| Push Up Standard | Push Up Standard | push-up-standard | push-up | /images/exercises/push-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Rdl | Rdl | rdl | romanian-deadlift | /images/exercises/romanian-deadlift.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Rear Delt Machine Fly | Rear Delt Machine Fly |  | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | COVERED_BY_SURROGATE_IMAGE | observed-fixture |
| Rear Delt Machine Fly | Rear Delt Machine Fly | rear-delt-machine-fly | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Reverse Pec Deck | Reverse Pec Deck |  | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | COVERED_BY_SURROGATE_IMAGE | observed-fixture |
| Reverse Pec Deck | Reverse Pec Deck | reverse-pec-deck | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Romanian Deadlift | Romanian Deadlift | romanian-deadlift | romanian-deadlift | /images/exercises/romanian-deadlift.png | GENERATOR_COVERED | setcredits |
| Romanian Deadlift Rdl | Romanian Deadlift Rdl | romanian-deadlift-rdl | romanian-deadlift | /images/exercises/romanian-deadlift.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Russian Twist | Russian Twist | russian-twist | russian-twist | /images/exercises/russian-twist.png | GENERATOR_COVERED | setcredits |
| Seated Cable Row | Seated Cable Row | seated-cable-row | seated-cable-row | /images/exercises/seated-cable-row.png | GENERATOR_COVERED | setcredits |
| Seated Calf Raise | Seated Calf Raise | seated-calf-raise | seated-calf-raise | /images/exercises/seated-calf-raise.png | GENERATOR_COVERED | setcredits |
| Seated Calf Raise Machine | Seated Calf Raise Machine | seated-calf-raise-machine | seated-calf-raise | /images/exercises/seated-calf-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Seated Leg Curl | Seated Leg Curl | seated-leg-curl | leg-curl | /images/exercises/lying-leg-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Seated Machine Row | Seated Machine Row |  | seated-cable-row | /images/exercises/seated-cable-row.png | COVERED_BY_SURROGATE_IMAGE | observed-fixture |
| Seated Machine Row | Seated Machine Row | seated-machine-row | seated-cable-row | /images/exercises/seated-cable-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Seated Row | Seated Row | seated-row | seated-cable-row | /images/exercises/seated-cable-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Seated Row Machine | Seated Row Machine |  | seated-cable-row | /images/exercises/seated-cable-row.png | COVERED_BY_SURROGATE_IMAGE | observed-fixture |
| Seated Row Machine | Seated Row Machine | seated-row-machine | seated-cable-row | /images/exercises/seated-cable-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Single Arm Cable Row | Single Arm Cable Row | single-arm-cable-row | seated-cable-row | /images/exercises/seated-cable-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Skull Crusher | Skull Crusher | skull-crusher | skull-crusher | /images/exercises/skull-crusher.png | GENERATOR_COVERED | setcredits |
| Standing Calf Raise | Standing Calf Raise | standing-calf-raise | standing-calf-raise | /images/exercises/standing-calf-raise.png | GENERATOR_COVERED | setcredits |
| Standing Calf Raise Machine | Standing Calf Raise Machine | standing-calf-raise-machine | standing-calf-raise | /images/exercises/standing-calf-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Tricep Pushdown | Tricep Pushdown | tricep-pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Triceps Dip | Triceps Dip | triceps-dip | dip | /images/exercises/dip.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Triceps Pushdown | Triceps Pushdown | triceps-pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |

## Generator names reaching fallback

| Item |
| --- |
| None |

## Generator names routed to surrogate images

| generated name | canonical exerciseId | resolved URL | exact dedicated file status |
| --- | --- | --- | --- |
| Assisted Pull Up | pull-up | /images/exercises/pull-up.png | no exact dedicated file |
| Back Squat | barbell-squat | /images/exercises/barbell-squat.png | no exact dedicated file |
| Barbell Back Squat | barbell-squat | /images/exercises/barbell-squat.png | no exact dedicated file |
| Barbell Biceps Curl | barbell-bicep-curl | /images/exercises/barbell-bicep-curl.png | no exact dedicated file |
| Barbell Hip Thrust Machine | barbell-hip-thrust | /images/exercises/barbell-hip-thrust.png | no exact dedicated file |
| Barbell Romanian Deadlift | romanian-deadlift | /images/exercises/romanian-deadlift.png | no exact dedicated file |
| Bench Dip | dip | /images/exercises/dip.png | no exact dedicated file |
| Bicep Curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | no exact dedicated file |
| Biceps Curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | no exact dedicated file |
| Bulgarian Split Squat | dumbbell-goblet-squat | /images/exercises/dumbbell-goblet-squat.png | bulgarian-split-squat.png |
| Cable Biceps Curl | cable-bicep-curl | /images/exercises/cable-bicep-curl.png | no exact dedicated file |
| Cable Chest Fly | cable-crossover | /images/exercises/cable-crossover.png | no exact dedicated file |
| Cable Crossover Fly | cable-crossover | /images/exercises/cable-crossover.png | no exact dedicated file |
| Cable Face Pull | face-pull | /images/exercises/face-pull.png | no exact dedicated file |
| Cable Overhead Triceps Extension | overhead-tricep-extension | /images/exercises/overhead-tricep-extension.png | no exact dedicated file |
| Cable Triceps Pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | no exact dedicated file |
| Chin Up Assisted If Needed | chin-up | /images/exercises/chin-up.png | no exact dedicated file |
| Dumbbell Biceps Curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | no exact dedicated file |
| Dumbbell Bulgarian Split Squat | dumbbell-goblet-squat | /images/exercises/dumbbell-goblet-squat.png | no exact dedicated file |
| Dumbbell Hammer Curl | hammer-curl | /images/exercises/hammer-curl.png | no exact dedicated file |
| Dumbbell Shoulder Press Seated Or Standing | dumbbell-shoulder-press | /images/exercises/dumbbell-shoulder-press.png | no exact dedicated file |
| Flat Dumbbell Press | dumbbell-bench-press | /images/exercises/dumbbell-bench-press.png | no exact dedicated file |
| Hammer Curls | hammer-curl | /images/exercises/hammer-curl.png | no exact dedicated file |
| Hanging Knee Raise | hanging-leg-raise | /images/exercises/hanging-leg-raise.png | no exact dedicated file |
| Incline Dumbbell Curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | no exact dedicated file |
| Incline Dumbbell Press | dumbbell-bench-press | /images/exercises/dumbbell-bench-press.png | no exact dedicated file |
| Leg Extension Machine | leg-extension | /images/exercises/leg-extension.png | no exact dedicated file |
| Leg Press Machine | leg-press | /images/exercises/leg-press.png | no exact dedicated file |
| Machine Rear Delt Fly | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | no exact dedicated file |
| Machine Rear Delt Fly | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | no exact dedicated file |
| Machine Row | seated-cable-row | /images/exercises/seated-cable-row.png | no exact dedicated file |
| Machine Row | seated-cable-row | /images/exercises/seated-cable-row.png | no exact dedicated file |
| Overhead Triceps Extension | overhead-tricep-extension | /images/exercises/overhead-tricep-extension.png | no exact dedicated file |
| Pull Up Assisted If Needed | pull-up | /images/exercises/pull-up.png | no exact dedicated file |
| Push Up Standard | push-up | /images/exercises/push-up.png | no exact dedicated file |
| Rdl | romanian-deadlift | /images/exercises/romanian-deadlift.png | no exact dedicated file |
| Rear Delt Machine Fly | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | no exact dedicated file |
| Rear Delt Machine Fly | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | no exact dedicated file |
| Reverse Pec Deck | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | no exact dedicated file |
| Reverse Pec Deck | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | no exact dedicated file |
| Romanian Deadlift Rdl | romanian-deadlift | /images/exercises/romanian-deadlift.png | no exact dedicated file |
| Seated Calf Raise Machine | seated-calf-raise | /images/exercises/seated-calf-raise.png | no exact dedicated file |
| Seated Leg Curl | leg-curl | /images/exercises/lying-leg-curl.png | seated-leg-curl.png |
| Seated Machine Row | seated-cable-row | /images/exercises/seated-cable-row.png | no exact dedicated file |
| Seated Machine Row | seated-cable-row | /images/exercises/seated-cable-row.png | no exact dedicated file |
| Seated Row | seated-cable-row | /images/exercises/seated-cable-row.png | no exact dedicated file |
| Seated Row Machine | seated-cable-row | /images/exercises/seated-cable-row.png | no exact dedicated file |
| Seated Row Machine | seated-cable-row | /images/exercises/seated-cable-row.png | no exact dedicated file |
| Single Arm Cable Row | seated-cable-row | /images/exercises/seated-cable-row.png | no exact dedicated file |
| Standing Calf Raise Machine | standing-calf-raise | /images/exercises/standing-calf-raise.png | no exact dedicated file |
| Tricep Pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | no exact dedicated file |
| Triceps Dip | dip | /images/exercises/dip.png | no exact dedicated file |
| Triceps Pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | no exact dedicated file |

## Orphan files

| Item |
| --- |
| None |

## Broken mappings

| Item |
| --- |
| None |

## Invalid files

| Item |
| --- |
| None |

## Fallback-only set-credit aliases

| Item |
| --- |
| None |
