# Exercise Image Coverage Report

Generated: 2026-07-30T15:41:14.977Z

The workout model may still produce arbitrary free-text exercise names. This audit covers the canonical resolver inventory plus set-credit aliases; unsupported free text intentionally falls back to the branded image.

## Totals

| Metric | Value |
| --- | --- |
| physicalFiles | 101 |
| dedicatedExerciseImagesExcludingFallback | 100 |
| canonicalSupportedExercises | 100 |
| canonicalExercisesWithDedicatedImages | 100 |
| canonicalExercisesMissingImages | 0 |
| aliasesCovered | 240 |
| orphanFiles | 0 |
| brokenMappings | 0 |
| invalidFiles | 0 |
| caseMismatches | 0 |
| fallbackOnlyAliases | 0 |
| generatorSupportedCanonicalExercises | 103 |
| generatorKnownNameVariants | 309 |
| generatorVariantsWithDedicatedOrSurrogateImage | 309 |
| generatorVariantsReachingFallback | 0 |
| generatorExistingFilesWithBrokenRouting | 0 |
| generatorGenuinelyMissingImages | 0 |
| generatorSurrogateImageRoutes | 188 |
| generatorCanonicalMismatches | 0 |
| publicEnabledExercises | 106 |
| publicReleaseImageFailures | 0 |
| disabledUntilDedicatedImages | 0 |

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
| abductors | Abductors | /images/exercises/abductors.png | abductors.png | COVERED | abduction, abduction-machine, abductor-machine, abductors, hip-abduction, hip-abduction-machine, hip-abductor, hip-abductor-machine, seated-hip-abduction |
| adductors | Adductors | /images/exercises/adductors.png | adductors.png | COVERED | adduction, adduction-machine, adductor-machine, adductors, hip-adduction, hip-adduction-machine, hip-adductor, hip-adductor-machine, seated-hip-adduction |
| archer-push-up | Archer Push Up | /images/exercises/archer-push-up.png | archer-push-up.png | COVERED |  |
| arnold-press | Arnold Press | /images/exercises/arnold-press.png | arnold-press.png | COVERED |  |
| assisted-chin-up | Assisted Chin Up | /images/exercises/assisted-chin-up.png | assisted-chin-up.png | COVERED |  |
| assisted-pull-up | Assisted Pull Up | /images/exercises/assisted-pull-up.png | assisted-pull-up.png | COVERED |  |
| australian-row | Australian Row | /images/exercises/australian-row.png | australian-row.png | COVERED | australian-pull-up, bodyweight-row, inverted-row, ring-row, suspension-row |
| barbell-bicep-curl | Barbell Bicep Curl | /images/exercises/barbell-bicep-curl.png | barbell-bicep-curl.png | COVERED | barbell-biceps-curl, barbell-curl, ez-bar-curl |
| barbell-front-squat | Barbell Front Squat | /images/exercises/barbell-front-squat.png | barbell-front-squat.png | COVERED | front-squat |
| barbell-hip-thrust | Barbell Hip Thrust | /images/exercises/barbell-hip-thrust.png | barbell-hip-thrust.png | COVERED | barbell-glute-bridge, glute-bridge, hip-thrust |
| barbell-row | Barbell Row | /images/exercises/barbell-row.png | barbell-row.png | COVERED | barbell-bent-over-row, barbell-bent-over-rows, bent-over-barbell-row, bent-over-row, bent-over-row-barbell, pendlay-row |
| barbell-shoulder-press | Barbell Shoulder Press | /images/exercises/barbell-shoulder-press.png | barbell-shoulder-press.png | COVERED | military-press, overhead-press, seated-barbell-shoulder-press, standing-overhead-press |
| barbell-shrug | Barbell Shrug | /images/exercises/barbell-shrug.png | barbell-shrug.png | COVERED | barbell-shrugs, shrug, shrugs |
| barbell-squat | Barbell Squat | /images/exercises/barbell-squat.png | barbell-squat.png | COVERED | back-squat, barbell-back-squat, high-bar-squat, low-bar-squat, squat |
| barbell-upright-row | Barbell Upright Row | /images/exercises/barbell-upright-row.png | barbell-upright-row.png | COVERED | upright-row |
| bench-dip | Bench Dip | /images/exercises/bench-dip.png | bench-dip.png | COVERED | bench-dip |
| bench-press | Bench Press | /images/exercises/bench-press.png | bench-press.png | COVERED | barbell-bench-press, flat-barbell-bench-press, flat-bench-press |
| cable-bicep-curl | Cable Bicep Curl | /images/exercises/cable-bicep-curl.png | cable-bicep-curl.png | COVERED | cable-biceps-curl, cable-curl |
| cable-crossover | Cable Crossover | /images/exercises/cable-crossover.png | cable-crossover.png | COVERED | cable-chest-fly, cable-fly, high-to-low-cable-fly |
| cable-crunch | Cable Crunch | /images/exercises/cable-crunch.png | cable-crunch.png | COVERED | cable-crunch, kneeling-cable-crunch |
| cable-lateral-raise | Cable Lateral Raise | /images/exercises/cable-lateral-raise.png | cable-lateral-raise.png | COVERED |  |
| cable-overhead-triceps-extension | Cable Overhead Triceps Extension | /images/exercises/cable-overhead-triceps-extension.png | cable-overhead-triceps-extension.png | COVERED | cable-overhead-triceps-extension |
| cable-tricep-pushdown | Cable Tricep Pushdown | /images/exercises/cable-tricep-pushdown.png | cable-tricep-pushdown.png | COVERED | cable-triceps-pushdown, rope-tricep-pushdown, rope-triceps-pushdown, tricep-pushdown, triceps-pushdown |
| cable-woodchopper | Cable Woodchopper | /images/exercises/cable-woodchopper.png | cable-woodchopper.png | COVERED | cable-wood-chopper, cable-woodchop, wood-chopper, woodchopper |
| chest-supported-row | Chest Supported Row | /images/exercises/chest-supported-row.png | chest-supported-row.png | COVERED | chest-supported-row |
| chin-up | Chin Up | /images/exercises/chin-up.png | chin-up.png | COVERED | chin-ups |
| close-grip-bench-press | Close Grip Bench Press | /images/exercises/close-grip-bench-press.png | close-grip-bench-press.png | COVERED |  |
| close-grip-lat-pulldown | Close Grip Lat Pulldown | /images/exercises/close-grip-lat-pulldown.png | close-grip-lat-pulldown.png | COVERED | neutral-grip-lat-pulldown, straight-arm-pulldown |
| concentration-curl | Concentration Curl | /images/exercises/concentration-curl.png | concentration-curl.png | COVERED |  |
| conventional-deadlift | Conventional Deadlift | /images/exercises/conventional-deadlift.png | conventional-deadlift.png | COVERED | conventional-deadlift |
| crunch | Crunch | /images/exercises/crunch.png | crunch.png | COVERED | ab-crunch, ab-crunch-machine, crunch, machine-ab-crunch, machine-crunch, seated-ab-crunch |
| diamond-push-up | Diamond Push Up | /images/exercises/diamond-push-up.png | diamond-push-up.png | COVERED | close-grip-push-up |
| dip | Dip | /images/exercises/dip.png | dip.png | COVERED | chest-dip, parallel-bar-dip |
| dumbbell-bench-press | Dumbbell Bench Press | /images/exercises/dumbbell-bench-press.png | dumbbell-bench-press.png | COVERED | dumbbell-press |
| dumbbell-bicep-curl | Dumbbell Bicep Curl | /images/exercises/dumbbell-bicep-curl.png | dumbbell-bicep-curl.png | COVERED | alternating-dumbbell-curl, bicep-curl, biceps-curl, dumbbell-biceps-curl, dumbbell-curl |
| dumbbell-bulgarian-split-squat | Dumbbell Bulgarian Split Squat | /images/exercises/dumbbell-bulgarian-split-squat.png | dumbbell-bulgarian-split-squat.png | COVERED | bulgarian-dumbbell-split-squat, bulgarian-split-squat, bulgarian-split-squat-dumbbell, dumbbell-bulgarian-split-squat, split-squat |
| dumbbell-calf-raise | Dumbbell Calf Raise | /images/exercises/dumbbell-calf-raise.png | dumbbell-calf-raise.png | COVERED | dumbbell-calf-raises, dumbbell-standing-calf-raise, dumbbell-standing-calf-raises, standing-dumbbell-calf-raise, standing-dumbbell-calf-raises |
| dumbbell-fly | Dumbbell Fly | /images/exercises/dumbbell-fly.png | dumbbell-fly.png | COVERED | dumbbell-chest-fly, flat-dumbbell-fly |
| dumbbell-front-raise | Dumbbell Front Raise | /images/exercises/dumbbell-front-raise.png | dumbbell-front-raise.png | COVERED | front-raise |
| dumbbell-goblet-squat | Dumbbell Goblet Squat | /images/exercises/dumbbell-goblet-squat.png | dumbbell-goblet-squat.png | COVERED | goblet-squat |
| dumbbell-hip-thrust | Dumbbell Hip Thrust | /images/exercises/dumbbell-hip-thrust.png | dumbbell-hip-thrust.png | COVERED |  |
| dumbbell-lateral-raise | Dumbbell Lateral Raise | /images/exercises/dumbbell-lateral-raise.png | dumbbell-lateral-raise.png | COVERED | dumbell-lateral-raise, dumbell-lateral-raises, lateral-raise, lateral-raises, side-lateral-raise |
| dumbbell-reverse-fly | Dumbbell Reverse Fly | /images/exercises/dumbbell-reverse-fly.png | dumbbell-reverse-fly.png | COVERED | bent-over-lateral-raise, rear-delt-fly, rear-delt-raise, reverse-fly |
| dumbbell-row | Dumbbell Row | /images/exercises/dumbbell-row.png | dumbbell-row.png | COVERED | dumbbell-bent-over-row, one-arm-dumbbell-row, single-arm-dumbbell-row |
| dumbbell-shoulder-press | Dumbbell Shoulder Press | /images/exercises/dumbbell-shoulder-press.png | dumbbell-shoulder-press.png | COVERED | dumbbell-overhead-press, seated-dumbbell-shoulder-press |
| dumbbell-shrug | Dumbbell Shrug | /images/exercises/dumbbell-shrug.png | dumbbell-shrug.png | COVERED | dumbbell-shrugs, dumbbells-shrug, dumbbells-shrugs |
| dumbbell-walking-lunge | Dumbbell Walking Lunge | /images/exercises/dumbbell-walking-lunge.png | dumbbell-walking-lunge.png | COVERED | dumbbell-walking-lunges, walking-dumbbell-lunge, walking-dumbbell-lunges |
| face-pull | Face Pull | /images/exercises/face-pull.png | face-pull.png | COVERED | cable-face-pull |
| forward-lunge | Forward Lunge | /images/exercises/forward-lunge.png | forward-lunge.png | COVERED | forward-lunge |
| good-morning | Good Morning | /images/exercises/good-morning.png | good-morning.png | COVERED | back-extension, hyperextension |
| hack-squat | Hack Squat | /images/exercises/hack-squat.png | hack-squat.png | COVERED | smith-machine-squat |
| hammer-curl | Hammer Curl | /images/exercises/hammer-curl.png | hammer-curl.png | COVERED | dumbbell-hammer-curl, dumbbell-hammer-curls, hammer-curls |
| handstand | Handstand | /images/exercises/handstand.png | handstand.png | COVERED |  |
| handstand-push-up | Handstand Push Up | /images/exercises/handstand-push-up.png | handstand-push-up.png | COVERED |  |
| hanging-knee-raise | Hanging Knee Raise | /images/exercises/hanging-knee-raise.png | hanging-knee-raise.png | COVERED | hanging-knee-raise |
| hanging-leg-raise | Hanging Leg Raise | /images/exercises/hanging-leg-raise.png | hanging-leg-raise.png | COVERED | leg-raise |
| hip-thrust-machine | Hip Thrust Machine | /images/exercises/hip-thrust-machine.png | hip-thrust-machine.png | COVERED |  |
| incline-bench-press | Incline Bench Press | /images/exercises/incline-bench-press.png | incline-bench-press.png | COVERED | barbell-incline-bench-press, barbell-incline-chest-press, incline-barbell-bench-press, incline-barbell-chest-press, incline-chest-press-barbell, incline-press |
| incline-dumbbell-bench-press | Incline Dumbbell Bench Press | /images/exercises/incline-dumbbell-bench-press.png | incline-dumbbell-bench-press.png | COVERED | dumbell-incline-bench-press, dumbell-incline-press, incline-db-bench-press, incline-db-press, incline-dumbbell-bench, incline-dumbbell-bench-chest-press, incline-dumbbell-bench-press, incline-dumbbell-chest-press, incline-dumbbell-chest-press-machine, incline-dumbbell-press |
| incline-dumbbell-curl | Incline Dumbbell Curl | /images/exercises/incline-dumbbell-curl.png | incline-dumbbell-curl.png | COVERED | incline-dumbbell-curl |
| kettlebell-swing | Kettlebell Swing | /images/exercises/kettlebell-swing.png | kettlebell-swing.png | COVERED |  |
| l-sit | L-sit | /images/exercises/l-sit.png | l-sit.png | COVERED |  |
| lat-pulldown | Lat Pulldown | /images/exercises/lat-pulldown.png | lat-pulldown.png | COVERED | cable-lat-pulldown, front-lat-pulldown, lat-pulldown-machine, lat-pulldowns, machine-lat-pulldown, wide-grip-lat-pulldown |
| leg-extension | Leg Extension | /images/exercises/leg-extension.png | leg-extension.png | COVERED | knee-extension, leg-extensions, seated-leg-extension |
| leg-press | Leg Press | /images/exercises/leg-press.png | leg-press.png | COVERED |  |
| lying-leg-curl | Lying Leg Curl | /images/exercises/lying-leg-curl.png | lying-leg-curl.png | COVERED | hamstring-curl, leg-curl, lying-leg-curls |
| machine-chest-fly | Machine Chest Fly | /images/exercises/machine-chest-fly.png | machine-chest-fly.png | COVERED | chest-fly, machine-fly, pec-deck |
| machine-chest-press | Machine Chest Press | /images/exercises/machine-chest-press.png | machine-chest-press.png | COVERED | chest-press, chest-press-machine, seated-chest-press |
| machine-shoulder-press | Machine Shoulder Press | /images/exercises/machine-shoulder-press.png | machine-shoulder-press.png | COVERED | shoulder-press-machine |
| muscle-up | Muscle Up | /images/exercises/muscle-up.png | muscle-up.png | COVERED |  |
| neutral-grip-pull-up | Neutral Grip Pull Up | /images/exercises/neutral-grip-pull-up.png | neutral-grip-pull-up.png | COVERED | neutral-grip-pullup |
| one-arm-pull-up | One Arm Pull Up | /images/exercises/one-arm-pull-up.png | one-arm-pull-up.png | COVERED | archer-pull-up, assisted-one-arm-pull-up, one-arm-chin-up |
| overhead-tricep-extension | Overhead Tricep Extension | /images/exercises/overhead-tricep-extension.png | overhead-tricep-extension.png | COVERED | dumbbell-overhead-tricep-extension, dumbbell-overhead-triceps-extension, overhead-dumbbell-tricep-extension, overhead-dumbbell-triceps-extension, overhead-triceps-extension, seated-overhead-tricep-extension, seated-overhead-triceps-extension |
| pike-push-up | Pike Push Up | /images/exercises/pike-push-up.png | pike-push-up.png | COVERED |  |
| pistol-squat | Pistol Squat | /images/exercises/pistol-squat.png | pistol-squat.png | COVERED |  |
| plank | Plank | /images/exercises/plank.png | plank.png | COVERED | plank-hold |
| preacher-curl | Preacher Curl | /images/exercises/preacher-curl.png | preacher-curl.png | COVERED | cable-preacher-curl, ez-bar-preacher-curl, machine-preacher-curl |
| pull-up | Pull Up | /images/exercises/pull-up.png | pull-up.png | COVERED | pull-ups, pullup |
| push-up | Push Up | /images/exercises/push-up.png | push-up.png | COVERED | push-ups, pushup |
| rack-pull | Rack Pull | /images/exercises/rack-pull.png | rack-pull.png | COVERED |  |
| reverse-lunge | Reverse Lunge | /images/exercises/reverse-lunge.png | reverse-lunge.png | COVERED | dumbbell-lunge, dumbbell-lunges, lunge, walking-lunge, walking-lunges |
| reverse-pec-deck | Reverse Pec Deck | /images/exercises/reverse-pec-deck.png | reverse-pec-deck.png | COVERED | machine-rear-delt-fly, machine-reverse-fly, rear-delt-machine-fly, rear-delt-pec-deck, reverse-machine-fly, reverse-pec-deck, reverse-pec-deck-fly, reverse-pec-deck-machine |
| romanian-deadlift | Romanian Deadlift | /images/exercises/romanian-deadlift.png | romanian-deadlift.png | COVERED | dumbbell-romanian-deadlift, rdl |
| russian-twist | Russian Twist | /images/exercises/russian-twist.png | russian-twist.png | COVERED |  |
| seated-cable-row | Seated Cable Row | /images/exercises/seated-cable-row.png | seated-cable-row.png | COVERED | cable-row |
| seated-calf-raise | Seated Calf Raise | /images/exercises/seated-calf-raise.png | seated-calf-raise.png | COVERED | seated-calf-raises |
| seated-leg-curl | Seated Leg Curl | /images/exercises/seated-leg-curl.png | seated-leg-curl.png | COVERED | seated-hamstring-curl, seated-leg-curl, seated-leg-curls |
| seated-machine-row | Seated Machine Row | /images/exercises/seated-machine-row.png | seated-machine-row.png | COVERED | seated-machine-row |
| side-plank | Side Plank | /images/exercises/side-plank.png | side-plank.png | COVERED |  |
| single-arm-cable-row | Single Arm Cable Row | /images/exercises/single-arm-cable-row.png | single-arm-cable-row.png | COVERED |  |
| skull-crusher | Skull Crusher | /images/exercises/skull-crusher.png | skull-crusher.png | COVERED | lying-triceps-extension, skull-crushers |
| standing-calf-raise | Standing Calf Raise | /images/exercises/standing-calf-raise.png | standing-calf-raise.png | COVERED | machine-calf-raise, smith-machine-calf-raise, standing-calf-raise-machine, standing-calf-raises |
| step-up | Step Up | /images/exercises/step-up.png | step-up.png | COVERED | barbell-step-up, box-step-up, dumbbell-step-up, step-ups |
| sumo-deadlift | Sumo Deadlift | /images/exercises/sumo-deadlift.png | sumo-deadlift.png | COVERED |  |
| t-bar-row | T Bar Row | /images/exercises/t-bar-row.png | t-bar-row.png | COVERED |  |
| tricep-dip | Tricep Dip | /images/exercises/tricep-dip.png | tricep-dip.png | COVERED | triceps-dip |
| typewriter-pull-ups | Typewriter Pull Ups | /images/exercises/typewriter-pull-ups.png | typewriter-pull-ups.png | COVERED | typewriter-pull-up, typewriter-pull-ups, typewriter-pullups |
| wide-grip-pull-up | Wide Grip Pull Up | /images/exercises/wide-grip-pull-up.png | wide-grip-pull-up.png | COVERED | wide-grip-pull-up |
| wide-grip-push-up | Wide Grip Push Up | /images/exercises/wide-grip-push-up.png | wide-grip-push-up.png | COVERED | wide-push-up |

## Image file to exercise

| filename | size | git status | canonical exercise | referenced by resolver | classification |
| --- | --- | --- | --- | --- | --- |
| ab-wheel-rollout.png | 1291247 | tracked | ab-wheel-rollout | yes | COVERED |
| abductors.png | 1270491 | tracked | abductors | yes | COVERED |
| adductors.png | 1268975 | tracked | adductors | yes | COVERED |
| archer-push-up.png | 1023012 | tracked | archer-push-up | yes | COVERED |
| arnold-press.png | 1269440 | tracked | arnold-press | yes | COVERED |
| assisted-chin-up.png | 1001681 | tracked | assisted-chin-up | yes | COVERED |
| assisted-pull-up.png | 1381540 | tracked | assisted-pull-up | yes | COVERED |
| australian-row.png | 1300427 | tracked | australian-row | yes | COVERED |
| barbell-bicep-curl.png | 1018407 | tracked | barbell-bicep-curl | yes | COVERED |
| barbell-front-squat.png | 1270755 | tracked | barbell-front-squat | yes | COVERED |
| barbell-hip-thrust.png | 1418796 | tracked | barbell-hip-thrust | yes | COVERED |
| barbell-row.png | 1570829 | tracked | barbell-row | yes | COVERED |
| barbell-shoulder-press.png | 1296830 | tracked | barbell-shoulder-press | yes | COVERED |
| barbell-shrug.png | 1217377 | tracked | barbell-shrug | yes | COVERED |
| barbell-squat.png | 1611817 | tracked | barbell-squat | yes | COVERED |
| barbell-upright-row.png | 1506554 | tracked | barbell-upright-row | yes | COVERED |
| bench-dip.png | 1297995 | tracked | bench-dip | yes | COVERED |
| bench-press.png | 1192641 | tracked | bench-press | yes | COVERED |
| cable-bicep-curl.png | 1045077 | tracked | cable-bicep-curl | yes | COVERED |
| cable-crossover.png | 1593955 | tracked | cable-crossover | yes | COVERED |
| cable-crunch.png | 1302454 | tracked | cable-crunch | yes | COVERED |
| cable-lateral-raise.png | 1509185 | tracked | cable-lateral-raise | yes | COVERED |
| cable-overhead-triceps-extension.png | 1156406 | tracked | cable-overhead-triceps-extension | yes | COVERED |
| cable-tricep-pushdown.png | 1363681 | tracked | cable-tricep-pushdown | yes | COVERED |
| cable-woodchopper.png | 1534389 | tracked | cable-woodchopper | yes | COVERED |
| chest-supported-row.png | 1510074 | tracked | chest-supported-row | yes | COVERED |
| chin-up.png | 923852 | tracked | chin-up | yes | COVERED |
| close-grip-bench-press.png | 1133049 | tracked | close-grip-bench-press | yes | COVERED |
| close-grip-lat-pulldown.png | 1505180 | tracked | close-grip-lat-pulldown | yes | COVERED |
| concentration-curl.png | 1487280 | tracked | concentration-curl | yes | COVERED |
| conventional-deadlift.png | 1159314 | tracked | conventional-deadlift | yes | COVERED |
| crunch.png | 1011469 | tracked | crunch | yes | COVERED |
| diamond-push-up.png | 1141454 | tracked | diamond-push-up | yes | COVERED |
| dip.png | 1215324 | tracked | dip | yes | COVERED |
| dumbbell-bench-press.png | 1353888 | tracked | dumbbell-bench-press | yes | COVERED |
| dumbbell-bicep-curl.png | 943124 | tracked | dumbbell-bicep-curl | yes | COVERED |
| dumbbell-bulgarian-split-squat.png | 1313247 | tracked | dumbbell-bulgarian-split-squat | yes | COVERED |
| dumbbell-calf-raise.png | 1098289 | tracked | dumbbell-calf-raise | yes | COVERED |
| dumbbell-fly.png | 1418851 | tracked | dumbbell-fly | yes | COVERED |
| dumbbell-front-raise.png | 1127923 | tracked | dumbbell-front-raise | yes | COVERED |
| dumbbell-goblet-squat.png | 1315053 | tracked | dumbbell-goblet-squat | yes | COVERED |
| dumbbell-hip-thrust.png | 1349311 | tracked | dumbbell-hip-thrust | yes | COVERED |
| dumbbell-lateral-raise.png | 1144244 | tracked | dumbbell-lateral-raise | yes | COVERED |
| dumbbell-reverse-fly.png | 1502435 | tracked | dumbbell-reverse-fly | yes | COVERED |
| dumbbell-row.png | 1875335 | tracked | dumbbell-row | yes | COVERED |
| dumbbell-shoulder-press.png | 1445782 | tracked | dumbbell-shoulder-press | yes | COVERED |
| dumbbell-shrug.png | 143844 | tracked | dumbbell-shrug | yes | COVERED |
| dumbbell-walking-lunge.png | 1598340 | tracked | dumbbell-walking-lunge | yes | COVERED |
| face-pull.png | 1300713 | tracked | face-pull | yes | COVERED |
| forward-lunge.png | 1078371 | tracked | forward-lunge | yes | COVERED |
| fuelphysique-demo-fallback.svg | 1865 | tracked |  | yes | COVERED |
| good-morning.png | 1385017 | tracked | good-morning | yes | COVERED |
| hack-squat.png | 1134490 | tracked | hack-squat | yes | COVERED |
| hammer-curl.png | 974428 | tracked | hammer-curl | yes | COVERED |
| handstand-push-up.png | 201548 | tracked | handstand-push-up | yes | COVERED |
| handstand.png | 189673 | tracked | handstand | yes | COVERED |
| hanging-knee-raise.png | 1166234 | tracked | hanging-knee-raise | yes | COVERED |
| hanging-leg-raise.png | 1149960 | tracked | hanging-leg-raise | yes | COVERED |
| hip-thrust-machine.png | 1350923 | tracked | hip-thrust-machine | yes | COVERED |
| incline-bench-press.png | 1297955 | tracked | incline-bench-press | yes | COVERED |
| incline-dumbbell-bench-press.png | 1536297 | tracked | incline-dumbbell-bench-press | yes | COVERED |
| incline-dumbbell-curl.png | 1154186 | tracked | incline-dumbbell-curl | yes | COVERED |
| kettlebell-swing.png | 1328800 | tracked | kettlebell-swing | yes | COVERED |
| l-sit.png | 1331514 | tracked | l-sit | yes | COVERED |
| lat-pulldown.png | 1327966 | tracked | lat-pulldown | yes | COVERED |
| leg-extension.png | 983864 | tracked | leg-extension | yes | COVERED |
| leg-press.png | 1176564 | tracked | leg-press | yes | COVERED |
| lying-leg-curl.png | 1284696 | tracked | lying-leg-curl | yes | COVERED |
| machine-chest-fly.png | 1684957 | tracked | machine-chest-fly | yes | COVERED |
| machine-chest-press.png | 1359035 | tracked | machine-chest-press | yes | COVERED |
| machine-shoulder-press.png | 1402469 | tracked | machine-shoulder-press | yes | COVERED |
| muscle-up.png | 1122486 | tracked | muscle-up | yes | COVERED |
| neutral-grip-pull-up.png | 1334073 | tracked | neutral-grip-pull-up | yes | COVERED |
| one-arm-pull-up.png | 1302630 | tracked | one-arm-pull-up | yes | COVERED |
| overhead-tricep-extension.png | 1016910 | tracked | overhead-tricep-extension | yes | COVERED |
| pike-push-up.png | 1153909 | tracked | pike-push-up | yes | COVERED |
| pistol-squat.png | 1263303 | tracked | pistol-squat | yes | COVERED |
| plank.png | 847254 | tracked | plank | yes | COVERED |
| preacher-curl.png | 1098725 | tracked | preacher-curl | yes | COVERED |
| pull-up.png | 1297673 | tracked | pull-up | yes | COVERED |
| push-up.png | 1142435 | tracked | push-up | yes | COVERED |
| rack-pull.png | 1360410 | tracked | rack-pull | yes | COVERED |
| reverse-lunge.png | 1205732 | tracked | reverse-lunge | yes | COVERED |
| reverse-pec-deck.png | 1158834 | tracked | reverse-pec-deck | yes | COVERED |
| romanian-deadlift.png | 1185094 | tracked | romanian-deadlift | yes | COVERED |
| russian-twist.png | 1369448 | tracked | russian-twist | yes | COVERED |
| seated-cable-row.png | 1181976 | tracked | seated-cable-row | yes | COVERED |
| seated-calf-raise.png | 976276 | tracked | seated-calf-raise | yes | COVERED |
| seated-leg-curl.png | 84041 | tracked | seated-leg-curl | yes | COVERED |
| seated-machine-row.png | 1434221 | tracked | seated-machine-row | yes | COVERED |
| side-plank.png | 968384 | tracked | side-plank | yes | COVERED |
| single-arm-cable-row.png | 1475588 | tracked | single-arm-cable-row | yes | COVERED |
| skull-crusher.png | 1024550 | tracked | skull-crusher | yes | COVERED |
| standing-calf-raise.png | 1078765 | tracked | standing-calf-raise | yes | COVERED |
| step-up.png | 1219330 | tracked | step-up | yes | COVERED |
| sumo-deadlift.png | 1330662 | tracked | sumo-deadlift | yes | COVERED |
| t-bar-row.png | 949888 | tracked | t-bar-row | yes | COVERED |
| tricep-dip.png | 966138 | tracked | tricep-dip | yes | COVERED |
| typewriter-pull-ups.png | 1284498 | tracked | typewriter-pull-ups | yes | COVERED |
| wide-grip-pull-up.png | 1134115 | tracked | wide-grip-pull-up | yes | COVERED |
| wide-grip-push-up.png | 1163178 | tracked | wide-grip-push-up | yes | COVERED |

## B. Generator-to-image coverage

This starts from names and IDs the Workout Builder backend can plausibly return: set-credit IDs, backend aliases and observed generated fixtures.

| generated name | demoName | provided exerciseId | canonical exerciseId | resolved URL | classification | sources |
| --- | --- | --- | --- | --- | --- | --- |
| Ab Crunch | Ab Crunch | ab-crunch | crunch | /images/exercises/crunch.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Ab Crunch Machine | Ab Crunch Machine |  | crunch | /images/exercises/crunch.png | GENERATOR_COVERED | observed-fixture |
| Ab Crunch Machine | Ab Crunch Machine | ab-crunch-machine | crunch | /images/exercises/crunch.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Ab Rollout | Ab Rollout | ab-rollout | ab-wheel-rollout | /images/exercises/ab-wheel-rollout.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Ab Wheel Rollout | Ab Wheel Rollout | ab-wheel-rollout | ab-wheel-rollout | /images/exercises/ab-wheel-rollout.png | GENERATOR_COVERED | setcredits |
| Abduction | Abduction | abduction | abductors | /images/exercises/abductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Abduction Machine | Abduction Machine |  | abductors | /images/exercises/abductors.png | GENERATOR_COVERED | observed-fixture |
| Abduction Machine | Abduction Machine | abduction-machine | abductors | /images/exercises/abductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Abductor Machine | Abductor Machine | abductor-machine | abductors | /images/exercises/abductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Abductors | Abductors | abductors | abductors | /images/exercises/abductors.png | GENERATOR_COVERED | backend-alias, setcredits |
| Adduction | Adduction | adduction | adductors | /images/exercises/adductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Adduction Machine | Adduction Machine |  | adductors | /images/exercises/adductors.png | GENERATOR_COVERED | observed-fixture |
| Adduction Machine | Adduction Machine | adduction-machine | adductors | /images/exercises/adductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Adductor Machine | Adductor Machine | adductor-machine | adductors | /images/exercises/adductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Adductors | Adductors | adductors | adductors | /images/exercises/adductors.png | GENERATOR_COVERED | backend-alias, setcredits |
| Alternating Dumbbell Curl | Alternating Dumbbell Curl | alternating-dumbbell-curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Archer Push Up | Archer Push Up | archer-push-up | archer-push-up | /images/exercises/archer-push-up.png | GENERATOR_COVERED | setcredits |
| Arnold Press | Arnold Press | arnold-press | arnold-press | /images/exercises/arnold-press.png | GENERATOR_COVERED | setcredits |
| Assisted Chin Up | Assisted Chin Up | assisted-chin-up | assisted-chin-up | /images/exercises/assisted-chin-up.png | GENERATOR_COVERED | backend-alias, setcredits |
| Assisted Pull Up | Assisted Pull Up | assisted-pull-up | assisted-pull-up | /images/exercises/assisted-pull-up.png | GENERATOR_COVERED | backend-alias, setcredits |
| Australian Pull Up | Australian Pull Up | australian-pull-up | australian-row | /images/exercises/australian-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Australian Row | Australian Row | australian-row | australian-row | /images/exercises/australian-row.png | GENERATOR_COVERED | setcredits |
| Back Extension | Back Extension | back-extension | good-morning | /images/exercises/good-morning.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Back Squat | Back Squat | back-squat | barbell-squat | /images/exercises/barbell-squat.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Barbell Back Squat | Barbell Back Squat | barbell-back-squat | barbell-squat | /images/exercises/barbell-squat.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Barbell Bench Press | Barbell Bench Press | barbell-bench-press | barbell-bench-press | /images/exercises/bench-press.png | GENERATOR_COVERED | backend-alias, setcredits |
| Barbell Bicep Curl | Barbell Bicep Curl | barbell-bicep-curl | barbell-bicep-curl | /images/exercises/barbell-bicep-curl.png | GENERATOR_COVERED | setcredits |
| Barbell Biceps Curl | Barbell Biceps Curl | barbell-biceps-curl | barbell-bicep-curl | /images/exercises/barbell-bicep-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Barbell Curl | Barbell Curl | barbell-curl | barbell-bicep-curl | /images/exercises/barbell-bicep-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Barbell Front Squat | Barbell Front Squat | barbell-front-squat | barbell-front-squat | /images/exercises/barbell-front-squat.png | GENERATOR_COVERED | setcredits |
| Barbell Hip Thrust | Barbell Hip Thrust | barbell-hip-thrust | barbell-hip-thrust | /images/exercises/barbell-hip-thrust.png | GENERATOR_COVERED | setcredits |
| Barbell Hip Thrust Machine | Barbell Hip Thrust Machine | barbell-hip-thrust-machine | hip-thrust-machine | /images/exercises/hip-thrust-machine.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Barbell Romanian Deadlift | Barbell Romanian Deadlift | barbell-romanian-deadlift | romanian-deadlift | /images/exercises/romanian-deadlift.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Barbell Row | Barbell Row | barbell-row | barbell-row | /images/exercises/barbell-row.png | GENERATOR_COVERED | setcredits |
| Barbell Shoulder Press | Barbell Shoulder Press | barbell-shoulder-press | barbell-shoulder-press | /images/exercises/barbell-shoulder-press.png | GENERATOR_COVERED | setcredits |
| Barbell Shrug | Barbell Shrug | barbell-shrug | barbell-shrug | /images/exercises/barbell-shrug.png | GENERATOR_COVERED | setcredits |
| Barbell Shrugs | Barbell Shrugs | barbell-shrugs | barbell-shrug | /images/exercises/barbell-shrug.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Barbell Squat | Barbell Squat | barbell-squat | barbell-squat | /images/exercises/barbell-squat.png | GENERATOR_COVERED | setcredits |
| Barbell Upright Row | Barbell Upright Row | barbell-upright-row | barbell-upright-row | /images/exercises/barbell-upright-row.png | GENERATOR_COVERED | setcredits |
| Bench Dip | Bench Dip | bench-dip | bench-dip | /images/exercises/bench-dip.png | GENERATOR_COVERED | backend-alias, setcredits |
| Bent Over Barbell Row | Bent Over Barbell Row | bent-over-barbell-row | barbell-row | /images/exercises/barbell-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Bent Over Lateral Raise | Bent Over Lateral Raise | bent-over-lateral-raise | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Bent Over Row | Bent Over Row | bent-over-row | barbell-row | /images/exercises/barbell-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Bicep Curl | Bicep Curl | bicep-curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Biceps Curl | Biceps Curl | biceps-curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Bodyweight Row | Bodyweight Row | bodyweight-row | australian-row | /images/exercises/australian-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Box Step Up | Box Step Up | box-step-up | step-up | /images/exercises/step-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Bulgarian Dumbbell Split Squat | Bulgarian Dumbbell Split Squat | bulgarian-dumbbell-split-squat | dumbbell-bulgarian-split-squat | /images/exercises/dumbbell-bulgarian-split-squat.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Bulgarian Split Squat | Bulgarian Split Squat |  | dumbbell-bulgarian-split-squat | /images/exercises/dumbbell-bulgarian-split-squat.png | GENERATOR_COVERED | observed-fixture |
| Bulgarian Split Squat | Bulgarian Split Squat | bulgarian-split-squat | dumbbell-bulgarian-split-squat | /images/exercises/dumbbell-bulgarian-split-squat.png | GENERATOR_COVERED | setcredits |
| Bulgarian Split Squat | Bulgarian Split Squat | bulgarian-split-squat | dumbbell-bulgarian-split-squat | /images/exercises/dumbbell-bulgarian-split-squat.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Bulgarian Split Squat Dumbbell | Bulgarian Split Squat Dumbbell | bulgarian-split-squat-dumbbell | dumbbell-bulgarian-split-squat | /images/exercises/dumbbell-bulgarian-split-squat.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Bicep Curl | Cable Bicep Curl | cable-bicep-curl | cable-bicep-curl | /images/exercises/cable-bicep-curl.png | GENERATOR_COVERED | setcredits |
| Cable Biceps Curl | Cable Biceps Curl | cable-biceps-curl | cable-bicep-curl | /images/exercises/cable-bicep-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Chest Fly | Cable Chest Fly | cable-chest-fly | cable-crossover | /images/exercises/cable-crossover.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Crossover | Cable Crossover | cable-crossover | cable-crossover | /images/exercises/cable-crossover.png | GENERATOR_COVERED | setcredits |
| Cable Crossover Fly | Cable Crossover Fly | cable-crossover-fly | cable-crossover | /images/exercises/cable-crossover.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Crunch | Cable Crunch | cable-crunch | cable-crunch | /images/exercises/cable-crunch.png | GENERATOR_COVERED | setcredits |
| Cable Curl | Cable Curl | cable-curl | cable-bicep-curl | /images/exercises/cable-bicep-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Face Pull | Cable Face Pull |  | face-pull | /images/exercises/face-pull.png | GENERATOR_COVERED | observed-fixture |
| Cable Face Pull | Cable Face Pull | cable-face-pull | face-pull | /images/exercises/face-pull.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Fly | Cable Fly | cable-fly | cable-crossover | /images/exercises/cable-crossover.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Lat Pulldown | Cable Lat Pulldown | cable-lat-pulldown | lat-pulldown | /images/exercises/lat-pulldown.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Lateral Raise | Cable Lateral Raise | cable-lateral-raise | cable-lateral-raise | /images/exercises/cable-lateral-raise.png | GENERATOR_COVERED | setcredits |
| Cable Overhead Triceps Extension | Cable Overhead Triceps Extension | cable-overhead-triceps-extension | cable-overhead-triceps-extension | /images/exercises/cable-overhead-triceps-extension.png | GENERATOR_COVERED | backend-alias, setcredits |
| Cable Preacher Curl | Cable Preacher Curl | cable-preacher-curl | preacher-curl | /images/exercises/preacher-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Row | Cable Row | cable-row | seated-cable-row | /images/exercises/seated-cable-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Tricep Pushdown | Cable Tricep Pushdown | cable-tricep-pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | GENERATOR_COVERED | setcredits |
| Cable Triceps Pushdown | Cable Triceps Pushdown |  | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | GENERATOR_COVERED | observed-fixture |
| Cable Triceps Pushdown | Cable Triceps Pushdown | cable-triceps-pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Wood Chopper | Cable Wood Chopper | cable-wood-chopper | cable-woodchopper | /images/exercises/cable-woodchopper.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Woodchop | Cable Woodchop | cable-woodchop | cable-woodchopper | /images/exercises/cable-woodchopper.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Cable Woodchopper | Cable Woodchopper | cable-woodchopper | cable-woodchopper | /images/exercises/cable-woodchopper.png | GENERATOR_COVERED | setcredits |
| Calf Raise | Calf Raise | calf-raise | standing-calf-raise | /images/exercises/standing-calf-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Chest Dip | Chest Dip | chest-dip | dip | /images/exercises/dip.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Chest Fly | Chest Fly | chest-fly | machine-chest-fly | /images/exercises/machine-chest-fly.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Chest Press | Chest Press | chest-press | machine-chest-press | /images/exercises/machine-chest-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Chest Press Machine | Chest Press Machine | chest-press-machine | machine-chest-press | /images/exercises/machine-chest-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Chest Supported Row | Chest Supported Row | chest-supported-row | chest-supported-row | /images/exercises/chest-supported-row.png | GENERATOR_COVERED | backend-alias, setcredits |
| Chin Up | Chin Up | chin-up | chin-up | /images/exercises/chin-up.png | GENERATOR_COVERED | setcredits |
| Chin Up Assisted If Needed | Chin Up Assisted If Needed | chin-up-assisted-if-needed | assisted-chin-up | /images/exercises/assisted-chin-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Chin Ups | Chin Ups | chin-ups | chin-up | /images/exercises/chin-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Close Grip Bench Press | Close Grip Bench Press | close-grip-bench-press | close-grip-bench-press | /images/exercises/close-grip-bench-press.png | GENERATOR_COVERED | setcredits |
| Close Grip Lat Pulldown | Close Grip Lat Pulldown | close-grip-lat-pulldown | close-grip-lat-pulldown | /images/exercises/close-grip-lat-pulldown.png | GENERATOR_COVERED | setcredits |
| Close Grip Push Up | Close Grip Push Up | close-grip-push-up | diamond-push-up | /images/exercises/diamond-push-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Concentration Curl | Concentration Curl | concentration-curl | concentration-curl | /images/exercises/concentration-curl.png | GENERATOR_COVERED | setcredits |
| Conventional Deadlift | Conventional Deadlift | conventional-deadlift | conventional-deadlift | /images/exercises/conventional-deadlift.png | GENERATOR_COVERED | backend-alias, setcredits |
| Crunch | Crunch | crunch | crunch | /images/exercises/crunch.png | GENERATOR_COVERED | backend-alias, setcredits |
| Diamond Push Up | Diamond Push Up | diamond-push-up | diamond-push-up | /images/exercises/diamond-push-up.png | GENERATOR_COVERED | setcredits |
| Dip | Dip | dip | dip | /images/exercises/dip.png | GENERATOR_COVERED | setcredits |
| Dumbbell Bench Press | Dumbbell Bench Press | dumbbell-bench-press | dumbbell-bench-press | /images/exercises/dumbbell-bench-press.png | GENERATOR_COVERED | setcredits |
| Dumbbell Bent Over Row | Dumbbell Bent Over Row | dumbbell-bent-over-row | dumbbell-row | /images/exercises/dumbbell-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Bicep Curl | Dumbbell Bicep Curl | dumbbell-bicep-curl | dumbbell-bicep-curl | /images/exercises/dumbbell-bicep-curl.png | GENERATOR_COVERED | setcredits |
| Dumbbell Biceps Curl | Dumbbell Biceps Curl | dumbbell-biceps-curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Bulgarian Split Squat | Dumbbell Bulgarian Split Squat |  | dumbbell-bulgarian-split-squat | /images/exercises/dumbbell-bulgarian-split-squat.png | GENERATOR_COVERED | observed-fixture |
| Dumbbell Bulgarian Split Squat | Dumbbell Bulgarian Split Squat | dumbbell-bulgarian-split-squat | dumbbell-bulgarian-split-squat | /images/exercises/dumbbell-bulgarian-split-squat.png | GENERATOR_COVERED | backend-alias, setcredits |
| Dumbbell Calf Raise | Dumbbell Calf Raise | dumbbell-calf-raise | dumbbell-calf-raise | /images/exercises/dumbbell-calf-raise.png | GENERATOR_COVERED | setcredits |
| Dumbbell Chest Fly | Dumbbell Chest Fly | dumbbell-chest-fly | dumbbell-fly | /images/exercises/dumbbell-fly.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Curl | Dumbbell Curl | dumbbell-curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | GENERATOR_COVERED | setcredits |
| Dumbbell Fly | Dumbbell Fly | dumbbell-fly | dumbbell-fly | /images/exercises/dumbbell-fly.png | GENERATOR_COVERED | setcredits |
| Dumbbell Front Raise | Dumbbell Front Raise | dumbbell-front-raise | dumbbell-front-raise | /images/exercises/dumbbell-front-raise.png | GENERATOR_COVERED | setcredits |
| Dumbbell Goblet Squat | Dumbbell Goblet Squat | dumbbell-goblet-squat | dumbbell-goblet-squat | /images/exercises/dumbbell-goblet-squat.png | GENERATOR_COVERED | setcredits |
| Dumbbell Hammer Curl | Dumbbell Hammer Curl |  | hammer-curl | /images/exercises/hammer-curl.png | GENERATOR_COVERED | observed-fixture |
| Dumbbell Hammer Curl | Dumbbell Hammer Curl | dumbbell-hammer-curl | hammer-curl | /images/exercises/hammer-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Hammer Curls | Dumbbell Hammer Curls | dumbbell-hammer-curls | hammer-curl | /images/exercises/hammer-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Hip Thrust | Dumbbell Hip Thrust | dumbbell-hip-thrust | dumbbell-hip-thrust | /images/exercises/dumbbell-hip-thrust.png | GENERATOR_COVERED | setcredits |
| Dumbbell Lateral Raise | Dumbbell Lateral Raise | dumbbell-lateral-raise | dumbbell-lateral-raise | /images/exercises/dumbbell-lateral-raise.png | GENERATOR_COVERED | setcredits |
| Dumbbell Lunge | Dumbbell Lunge | dumbbell-lunge | forward-lunge | /images/exercises/forward-lunge.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Lunges | Dumbbell Lunges | dumbbell-lunges | forward-lunge | /images/exercises/forward-lunge.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Overhead Press | Dumbbell Overhead Press | dumbbell-overhead-press | dumbbell-shoulder-press | /images/exercises/dumbbell-shoulder-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Overhead Triceps Extension | Dumbbell Overhead Triceps Extension | dumbbell-overhead-triceps-extension | overhead-tricep-extension | /images/exercises/overhead-tricep-extension.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Press | Dumbbell Press | dumbbell-press | dumbbell-bench-press | /images/exercises/dumbbell-bench-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Reverse Fly | Dumbbell Reverse Fly | dumbbell-reverse-fly | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | GENERATOR_COVERED | setcredits |
| Dumbbell Row | Dumbbell Row | dumbbell-row | dumbbell-row | /images/exercises/dumbbell-row.png | GENERATOR_COVERED | setcredits |
| Dumbbell Shoulder Press | Dumbbell Shoulder Press | dumbbell-shoulder-press | dumbbell-shoulder-press | /images/exercises/dumbbell-shoulder-press.png | GENERATOR_COVERED | setcredits |
| Dumbbell Shoulder Press Seated Or Standing | Dumbbell Shoulder Press Seated Or Standing | dumbbell-shoulder-press-seated-or-standing | dumbbell-shoulder-press | /images/exercises/dumbbell-shoulder-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Shrug | Dumbbell Shrug | dumbbell-shrug | dumbbell-shrug | /images/exercises/dumbbell-shrug.png | GENERATOR_COVERED | setcredits |
| Dumbbell Shrugs | Dumbbell Shrugs | dumbbell-shrugs | dumbbell-shrug | /images/exercises/dumbbell-shrug.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Standing Calf Raise | Dumbbell Standing Calf Raise | dumbbell-standing-calf-raise | dumbbell-calf-raise | /images/exercises/dumbbell-calf-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Standing Calf Raises | Dumbbell Standing Calf Raises | dumbbell-standing-calf-raises | dumbbell-calf-raise | /images/exercises/dumbbell-calf-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Step Up | Dumbbell Step Up | dumbbell-step-up | step-up | /images/exercises/step-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbell Walking Lunge | Dumbbell Walking Lunge | dumbbell-walking-lunge | dumbbell-walking-lunge | /images/exercises/dumbbell-walking-lunge.png | GENERATOR_COVERED | setcredits |
| Dumbbell Walking Lunges | Dumbbell Walking Lunges | dumbbell-walking-lunges | dumbbell-walking-lunge | /images/exercises/dumbbell-walking-lunge.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbells Shrug | Dumbbells Shrug | dumbbells-shrug | dumbbell-shrug | /images/exercises/dumbbell-shrug.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbbells Shrugs | Dumbbells Shrugs | dumbbells-shrugs | dumbbell-shrug | /images/exercises/dumbbell-shrug.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbell Lateral Raise | Dumbell Lateral Raise | dumbell-lateral-raise | dumbbell-lateral-raise | /images/exercises/dumbbell-lateral-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Dumbell Lateral Raises | Dumbell Lateral Raises | dumbell-lateral-raises | dumbbell-lateral-raise | /images/exercises/dumbbell-lateral-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Ez Bar Curl | Ez Bar Curl | ez-bar-curl | barbell-bicep-curl | /images/exercises/barbell-bicep-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Ez Bar Preacher Curl | Ez Bar Preacher Curl | ez-bar-preacher-curl | preacher-curl | /images/exercises/preacher-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Face Pull | Face Pull | face-pull | face-pull | /images/exercises/face-pull.png | GENERATOR_COVERED | setcredits |
| Flat Barbell Bench Press | Flat Barbell Bench Press | flat-barbell-bench-press | barbell-bench-press | /images/exercises/bench-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Flat Bench Press | Flat Bench Press | flat-bench-press | barbell-bench-press | /images/exercises/bench-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Flat Dumbbell Fly | Flat Dumbbell Fly | flat-dumbbell-fly | dumbbell-fly | /images/exercises/dumbbell-fly.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Flat Dumbbell Press | Flat Dumbbell Press | flat-dumbbell-press | dumbbell-bench-press | /images/exercises/dumbbell-bench-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Forward Lunge | Forward Lunge | forward-lunge | forward-lunge | /images/exercises/forward-lunge.png | GENERATOR_COVERED | backend-alias, setcredits |
| Front Raise | Front Raise | front-raise | dumbbell-front-raise | /images/exercises/dumbbell-front-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Front Squat | Front Squat | front-squat | barbell-front-squat | /images/exercises/barbell-front-squat.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Goblet Squat | Goblet Squat | goblet-squat | dumbbell-goblet-squat | /images/exercises/dumbbell-goblet-squat.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Good Morning | Good Morning | good-morning | good-morning | /images/exercises/good-morning.png | GENERATOR_COVERED | setcredits |
| Hack Squat | Hack Squat | hack-squat | hack-squat | /images/exercises/hack-squat.png | GENERATOR_COVERED | setcredits |
| Hammer Curl | Hammer Curl | hammer-curl | hammer-curl | /images/exercises/hammer-curl.png | GENERATOR_COVERED | setcredits |
| Hammer Curls | Hammer Curls |  | hammer-curl | /images/exercises/hammer-curl.png | GENERATOR_COVERED | observed-fixture |
| Hammer Curls | Hammer Curls | hammer-curls | hammer-curl | /images/exercises/hammer-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Hamstring Curl | Hamstring Curl | hamstring-curl | lying-leg-curl | /images/exercises/lying-leg-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Handstand | Handstand | handstand | handstand | /images/exercises/handstand.png | GENERATOR_COVERED | setcredits |
| Handstand Push Up | Handstand Push Up | handstand-push-up | handstand-push-up | /images/exercises/handstand-push-up.png | GENERATOR_COVERED | setcredits |
| Hanging Knee Raise | Hanging Knee Raise | hanging-knee-raise | hanging-knee-raise | /images/exercises/hanging-knee-raise.png | GENERATOR_COVERED | backend-alias, setcredits |
| Hanging Leg Raise | Hanging Leg Raise | hanging-leg-raise | hanging-leg-raise | /images/exercises/hanging-leg-raise.png | GENERATOR_COVERED | setcredits |
| High Bar Squat | High Bar Squat | high-bar-squat | barbell-squat | /images/exercises/barbell-squat.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| High To Low Cable Fly | High To Low Cable Fly | high-to-low-cable-fly | cable-crossover | /images/exercises/cable-crossover.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Hip Abduction | Hip Abduction | hip-abduction | abductors | /images/exercises/abductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Hip Abduction Machine | Hip Abduction Machine | hip-abduction-machine | abductors | /images/exercises/abductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Hip Abductor | Hip Abductor | hip-abductor | abductors | /images/exercises/abductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Hip Abductor Machine | Hip Abductor Machine | hip-abductor-machine | abductors | /images/exercises/abductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Hip Adduction | Hip Adduction | hip-adduction | adductors | /images/exercises/adductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Hip Adduction Machine | Hip Adduction Machine | hip-adduction-machine | adductors | /images/exercises/adductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Hip Adductor | Hip Adductor | hip-adductor | adductors | /images/exercises/adductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Hip Adductor Machine | Hip Adductor Machine | hip-adductor-machine | adductors | /images/exercises/adductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Hip Thrust Machine | Hip Thrust Machine | hip-thrust-machine | hip-thrust-machine | /images/exercises/hip-thrust-machine.png | GENERATOR_COVERED | backend-alias, setcredits |
| Hyperextension | Hyperextension | hyperextension | good-morning | /images/exercises/good-morning.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Incline Barbell Bench Press | Incline Barbell Bench Press | incline-barbell-bench-press | incline-bench-press | /images/exercises/incline-bench-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Incline Bench Press | Incline Bench Press | incline-bench-press | incline-bench-press | /images/exercises/incline-bench-press.png | GENERATOR_COVERED | setcredits |
| Incline Db Bench Press | Incline Db Bench Press | incline-db-bench-press | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Incline Db Press | Incline Db Press | incline-db-press | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Incline Dumbbell Bench | Incline Dumbbell Bench | incline-dumbbell-bench | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Incline Dumbbell Bench Chest Press | Incline Dumbbell Bench Chest Press | incline-dumbbell-bench-chest-press | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Incline Dumbbell Bench Press | Incline Dumbbell Bench Press | incline-dumbbell-bench-press | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | GENERATOR_COVERED | setcredits |
| Incline Dumbbell Chest Press | Incline Dumbbell Chest Press |  | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | GENERATOR_COVERED | observed-fixture |
| Incline Dumbbell Chest Press | Incline Dumbbell Chest Press | incline-dumbbell-chest-press | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Incline Dumbbell Chest Press Machine | Incline Dumbbell Chest Press Machine | incline-dumbbell-chest-press-machine | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Incline Dumbbell Curl | Incline Dumbbell Curl | incline-dumbbell-curl | incline-dumbbell-curl | /images/exercises/incline-dumbbell-curl.png | GENERATOR_COVERED | backend-alias, setcredits |
| Incline Dumbbell Press | Incline Dumbbell Press |  | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | GENERATOR_COVERED | observed-fixture |
| Incline Dumbbell Press | Incline Dumbbell Press | incline-dumbbell-press | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Incline Press | Incline Press | incline-press | incline-bench-press | /images/exercises/incline-bench-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Inverted Row | Inverted Row | inverted-row | australian-row | /images/exercises/australian-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Kettlebell Swing | Kettlebell Swing | kettlebell-swing | kettlebell-swing | /images/exercises/kettlebell-swing.png | GENERATOR_COVERED | setcredits |
| Knee Extension | Knee Extension | knee-extension | leg-extension | /images/exercises/leg-extension.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Kneeling Cable Crunch | Kneeling Cable Crunch | kneeling-cable-crunch | cable-crunch | /images/exercises/cable-crunch.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| L-sit | L-sit | l-sit | l-sit | /images/exercises/l-sit.png | GENERATOR_COVERED | setcredits |
| Lat Pulldown | Lat Pulldown | lat-pulldown | lat-pulldown | /images/exercises/lat-pulldown.png | GENERATOR_COVERED | setcredits |
| Lat Pulldowns | Lat Pulldowns | lat-pulldowns | lat-pulldown | /images/exercises/lat-pulldown.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Lateral Raise | Lateral Raise | lateral-raise | dumbbell-lateral-raise | /images/exercises/dumbbell-lateral-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Lateral Raises | Lateral Raises | lateral-raises | dumbbell-lateral-raise | /images/exercises/dumbbell-lateral-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Leg Curl | Leg Curl | leg-curl | lying-leg-curl | /images/exercises/lying-leg-curl.png | GENERATOR_COVERED | setcredits |
| Leg Curl | Leg Curl | leg-curl | lying-leg-curl | /images/exercises/lying-leg-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Leg Extension | Leg Extension | leg-extension | leg-extension | /images/exercises/leg-extension.png | GENERATOR_COVERED | setcredits |
| Leg Extension Machine | Leg Extension Machine | leg-extension-machine | leg-extension | /images/exercises/leg-extension.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Leg Extensions | Leg Extensions | leg-extensions | leg-extension | /images/exercises/leg-extension.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Leg Press | Leg Press | leg-press | leg-press | /images/exercises/leg-press.png | GENERATOR_COVERED | setcredits |
| Leg Press Machine | Leg Press Machine | leg-press-machine | leg-press | /images/exercises/leg-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Leg Raise | Leg Raise | leg-raise | hanging-leg-raise | /images/exercises/hanging-leg-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Low Bar Squat | Low Bar Squat | low-bar-squat | barbell-squat | /images/exercises/barbell-squat.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Lunge | Lunge | lunge | forward-lunge | /images/exercises/forward-lunge.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Lying Leg Curl | Lying Leg Curl | lying-leg-curl | lying-leg-curl | /images/exercises/lying-leg-curl.png | GENERATOR_COVERED | setcredits |
| Lying Leg Curls | Lying Leg Curls | lying-leg-curls | lying-leg-curl | /images/exercises/lying-leg-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Lying Triceps Extension | Lying Triceps Extension | lying-triceps-extension | skull-crusher | /images/exercises/skull-crusher.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Machine Ab Crunch | Machine Ab Crunch | machine-ab-crunch | crunch | /images/exercises/crunch.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Machine Calf Raise | Machine Calf Raise | machine-calf-raise | standing-calf-raise-machine | /images/exercises/standing-calf-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Machine Chest Fly | Machine Chest Fly | machine-chest-fly | machine-chest-fly | /images/exercises/machine-chest-fly.png | GENERATOR_COVERED | setcredits |
| Machine Chest Press | Machine Chest Press | machine-chest-press | machine-chest-press | /images/exercises/machine-chest-press.png | GENERATOR_COVERED | setcredits |
| Machine Crunch | Machine Crunch | machine-crunch | crunch | /images/exercises/crunch.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Machine Fly | Machine Fly | machine-fly | machine-chest-fly | /images/exercises/machine-chest-fly.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Machine Preacher Curl | Machine Preacher Curl | machine-preacher-curl | preacher-curl | /images/exercises/preacher-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Machine Rear Delt Fly | Machine Rear Delt Fly | machine-rear-delt-fly | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Machine Reverse Fly | Machine Reverse Fly | machine-reverse-fly | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Machine Row | Machine Row | machine-row | seated-machine-row | /images/exercises/seated-machine-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Machine Shoulder Press | Machine Shoulder Press | machine-shoulder-press | machine-shoulder-press | /images/exercises/machine-shoulder-press.png | GENERATOR_COVERED | setcredits |
| Military Press | Military Press | military-press | barbell-shoulder-press | /images/exercises/barbell-shoulder-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Muscle Up | Muscle Up | muscle-up | muscle-up | /images/exercises/muscle-up.png | GENERATOR_COVERED | setcredits |
| Neutral Grip Lat Pulldown | Neutral Grip Lat Pulldown | neutral-grip-lat-pulldown | close-grip-lat-pulldown | /images/exercises/close-grip-lat-pulldown.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Neutral Grip Pull Up | Neutral Grip Pull Up | neutral-grip-pull-up | neutral-grip-pull-up | /images/exercises/neutral-grip-pull-up.png | GENERATOR_COVERED | backend-alias, setcredits |
| Neutral Grip Pullup | Neutral Grip Pullup | neutral-grip-pullup | neutral-grip-pull-up | /images/exercises/neutral-grip-pull-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| One Arm Dumbbell Row | One Arm Dumbbell Row | one-arm-dumbbell-row | dumbbell-row | /images/exercises/dumbbell-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| One Arm Pull Up | One Arm Pull Up | one-arm-pull-up | one-arm-pull-up | /images/exercises/one-arm-pull-up.png | GENERATOR_COVERED | setcredits |
| Overhead Press | Overhead Press | overhead-press | barbell-shoulder-press | /images/exercises/barbell-shoulder-press.png | GENERATOR_COVERED | setcredits |
| Overhead Press | Overhead Press | overhead-press | barbell-shoulder-press | /images/exercises/barbell-shoulder-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Overhead Tricep Extension | Overhead Tricep Extension | overhead-tricep-extension | overhead-tricep-extension | /images/exercises/overhead-tricep-extension.png | GENERATOR_COVERED | setcredits |
| Overhead Triceps Extension | Overhead Triceps Extension | overhead-triceps-extension | overhead-tricep-extension | /images/exercises/overhead-tricep-extension.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Parallel Bar Dip | Parallel Bar Dip | parallel-bar-dip | dip | /images/exercises/dip.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Pec Deck | Pec Deck | pec-deck | pec-deck | /images/exercises/machine-chest-fly.png | GENERATOR_COVERED | backend-alias, setcredits |
| Pendlay Row | Pendlay Row | pendlay-row | barbell-row | /images/exercises/barbell-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Pike Push Up | Pike Push Up | pike-push-up | pike-push-up | /images/exercises/pike-push-up.png | GENERATOR_COVERED | setcredits |
| Pistol Squat | Pistol Squat | pistol-squat | pistol-squat | /images/exercises/pistol-squat.png | GENERATOR_COVERED | setcredits |
| Plank | Plank | plank | plank | /images/exercises/plank.png | GENERATOR_COVERED | setcredits |
| Plank Hold | Plank Hold | plank-hold | plank | /images/exercises/plank.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Preacher Curl | Preacher Curl | preacher-curl | preacher-curl | /images/exercises/preacher-curl.png | GENERATOR_COVERED | setcredits |
| Pull Up | Pull Up | pull-up | pull-up | /images/exercises/pull-up.png | GENERATOR_COVERED | setcredits |
| Pull Up Assisted If Needed | Pull Up Assisted If Needed | pull-up-assisted-if-needed | assisted-pull-up | /images/exercises/assisted-pull-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Pull Ups | Pull Ups | pull-ups | pull-up | /images/exercises/pull-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Pullup | Pullup | pullup | pull-up | /images/exercises/pull-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Push Up | Push Up | push-up | push-up | /images/exercises/push-up.png | GENERATOR_COVERED | setcredits |
| Push Up Standard | Push Up Standard | push-up-standard | push-up | /images/exercises/push-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Push Ups | Push Ups | push-ups | push-up | /images/exercises/push-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Pushup | Pushup | pushup | push-up | /images/exercises/push-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Rack Pull | Rack Pull | rack-pull | rack-pull | /images/exercises/rack-pull.png | GENERATOR_COVERED | setcredits |
| Rdl | Rdl | rdl | romanian-deadlift | /images/exercises/romanian-deadlift.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Rear Delt Fly | Rear Delt Fly | rear-delt-fly | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Rear Delt Machine Fly | Rear Delt Machine Fly | rear-delt-machine-fly | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Rear Delt Pec Deck | Rear Delt Pec Deck | rear-delt-pec-deck | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Rear Delt Raise | Rear Delt Raise | rear-delt-raise | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Reverse Fly | Reverse Fly | reverse-fly | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Reverse Lunge | Reverse Lunge | reverse-lunge | reverse-lunge | /images/exercises/reverse-lunge.png | GENERATOR_COVERED | setcredits |
| Reverse Machine Fly | Reverse Machine Fly |  | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | GENERATOR_COVERED | observed-fixture |
| Reverse Machine Fly | Reverse Machine Fly | reverse-machine-fly | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Reverse Pec Deck | Reverse Pec Deck |  | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | GENERATOR_COVERED | observed-fixture |
| Reverse Pec Deck | Reverse Pec Deck | reverse-pec-deck | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | GENERATOR_COVERED | backend-alias, setcredits |
| Reverse Pec Deck Fly | Reverse Pec Deck Fly | reverse-pec-deck-fly | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Reverse Pec Deck Machine | Reverse Pec Deck Machine | reverse-pec-deck-machine | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Ring Row | Ring Row | ring-row | australian-row | /images/exercises/australian-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Romanian Deadlift | Romanian Deadlift | romanian-deadlift | romanian-deadlift | /images/exercises/romanian-deadlift.png | GENERATOR_COVERED | setcredits |
| Romanian Deadlift Rdl | Romanian Deadlift Rdl | romanian-deadlift-rdl | romanian-deadlift | /images/exercises/romanian-deadlift.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Rope Tricep Pushdown | Rope Tricep Pushdown | rope-tricep-pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Rope Triceps Pushdown | Rope Triceps Pushdown | rope-triceps-pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Russian Twist | Russian Twist | russian-twist | russian-twist | /images/exercises/russian-twist.png | GENERATOR_COVERED | setcredits |
| Seated Ab Crunch | Seated Ab Crunch | seated-ab-crunch | crunch | /images/exercises/crunch.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Seated Barbell Shoulder Press | Seated Barbell Shoulder Press | seated-barbell-shoulder-press | barbell-shoulder-press | /images/exercises/barbell-shoulder-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Seated Cable Row | Seated Cable Row | seated-cable-row | seated-cable-row | /images/exercises/seated-cable-row.png | GENERATOR_COVERED | setcredits |
| Seated Calf Raise | Seated Calf Raise | seated-calf-raise | seated-calf-raise | /images/exercises/seated-calf-raise.png | GENERATOR_COVERED | setcredits |
| Seated Chest Press | Seated Chest Press | seated-chest-press | machine-chest-press | /images/exercises/machine-chest-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Seated Dumbbell Shoulder Press | Seated Dumbbell Shoulder Press | seated-dumbbell-shoulder-press | dumbbell-shoulder-press | /images/exercises/dumbbell-shoulder-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Seated Hamstring Curl | Seated Hamstring Curl | seated-hamstring-curl | seated-leg-curl | /images/exercises/seated-leg-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Seated Hip Abduction | Seated Hip Abduction | seated-hip-abduction | abductors | /images/exercises/abductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Seated Hip Adduction | Seated Hip Adduction | seated-hip-adduction | adductors | /images/exercises/adductors.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Seated Leg Curl | Seated Leg Curl |  | seated-leg-curl | /images/exercises/seated-leg-curl.png | GENERATOR_COVERED | observed-fixture |
| Seated Leg Curl | Seated Leg Curl | seated-leg-curl | seated-leg-curl | /images/exercises/seated-leg-curl.png | GENERATOR_COVERED | setcredits |
| Seated Leg Curls | Seated Leg Curls | seated-leg-curls | seated-leg-curl | /images/exercises/seated-leg-curl.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Seated Leg Extension | Seated Leg Extension | seated-leg-extension | leg-extension | /images/exercises/leg-extension.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Seated Machine Row | Seated Machine Row | seated-machine-row | seated-machine-row | /images/exercises/seated-machine-row.png | GENERATOR_COVERED | backend-alias, setcredits |
| Seated Row | Seated Row | seated-row | seated-machine-row | /images/exercises/seated-machine-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Seated Row Machine | Seated Row Machine | seated-row-machine | seated-machine-row | /images/exercises/seated-machine-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Shoulder Press Machine | Shoulder Press Machine | shoulder-press-machine | machine-shoulder-press | /images/exercises/machine-shoulder-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Shrug | Shrug | shrug | barbell-shrug | /images/exercises/barbell-shrug.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Shrugs | Shrugs | shrugs | barbell-shrug | /images/exercises/barbell-shrug.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Side Lateral Raise | Side Lateral Raise | side-lateral-raise | dumbbell-lateral-raise | /images/exercises/dumbbell-lateral-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Side Plank | Side Plank | side-plank | side-plank | /images/exercises/side-plank.png | GENERATOR_COVERED | setcredits |
| Single Arm Cable Row | Single Arm Cable Row | single-arm-cable-row | single-arm-cable-row | /images/exercises/single-arm-cable-row.png | GENERATOR_COVERED | backend-alias, setcredits |
| Single Arm Dumbbell Row | Single Arm Dumbbell Row | single-arm-dumbbell-row | dumbbell-row | /images/exercises/dumbbell-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Skull Crusher | Skull Crusher | skull-crusher | skull-crusher | /images/exercises/skull-crusher.png | GENERATOR_COVERED | setcredits |
| Skull Crushers | Skull Crushers | skull-crushers | skull-crusher | /images/exercises/skull-crusher.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Smith Machine Calf Raise | Smith Machine Calf Raise | smith-machine-calf-raise | standing-calf-raise-machine | /images/exercises/standing-calf-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Split Squat | Split Squat | split-squat | dumbbell-bulgarian-split-squat | /images/exercises/dumbbell-bulgarian-split-squat.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Squat | Squat | squat | barbell-squat | /images/exercises/barbell-squat.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Standing Calf Raise | Standing Calf Raise | standing-calf-raise | standing-calf-raise | /images/exercises/standing-calf-raise.png | GENERATOR_COVERED | backend-alias, setcredits |
| Standing Calf Raise Machine | Standing Calf Raise Machine | standing-calf-raise-machine | standing-calf-raise-machine | /images/exercises/standing-calf-raise.png | GENERATOR_COVERED | setcredits |
| Standing Calf Raises | Standing Calf Raises | standing-calf-raises | standing-calf-raise | /images/exercises/standing-calf-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Standing Dumbbell Calf Raise | Standing Dumbbell Calf Raise | standing-dumbbell-calf-raise | dumbbell-calf-raise | /images/exercises/dumbbell-calf-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Standing Dumbbell Calf Raises | Standing Dumbbell Calf Raises | standing-dumbbell-calf-raises | dumbbell-calf-raise | /images/exercises/dumbbell-calf-raise.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Standing Overhead Press | Standing Overhead Press | standing-overhead-press | barbell-shoulder-press | /images/exercises/barbell-shoulder-press.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Step Up | Step Up | step-up | step-up | /images/exercises/step-up.png | GENERATOR_COVERED | setcredits |
| Step Ups | Step Ups | step-ups | step-up | /images/exercises/step-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Straight Arm Pulldown | Straight Arm Pulldown | straight-arm-pulldown | close-grip-lat-pulldown | /images/exercises/close-grip-lat-pulldown.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Sumo Deadlift | Sumo Deadlift | sumo-deadlift | sumo-deadlift | /images/exercises/sumo-deadlift.png | GENERATOR_COVERED | setcredits |
| Suspension Row | Suspension Row | suspension-row | australian-row | /images/exercises/australian-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| T Bar Row | T Bar Row | t-bar-row | t-bar-row | /images/exercises/t-bar-row.png | GENERATOR_COVERED | setcredits |
| Tricep Dip | Tricep Dip | tricep-dip | tricep-dip | /images/exercises/tricep-dip.png | GENERATOR_COVERED | setcredits |
| Tricep Pushdown | Tricep Pushdown | tricep-pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Triceps Dip | Triceps Dip |  | tricep-dip | /images/exercises/tricep-dip.png | GENERATOR_COVERED | observed-fixture |
| Triceps Dip | Triceps Dip | triceps-dip | tricep-dip | /images/exercises/tricep-dip.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Triceps Pushdown | Triceps Pushdown | triceps-pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Typewriter Pull Ups | Typewriter Pull Ups | typewriter-pull-ups | typewriter-pull-ups | /images/exercises/typewriter-pull-ups.png | GENERATOR_COVERED | setcredits |
| Upright Row | Upright Row | upright-row | barbell-upright-row | /images/exercises/barbell-upright-row.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Walking Dumbbell Lunge | Walking Dumbbell Lunge | walking-dumbbell-lunge | dumbbell-walking-lunge | /images/exercises/dumbbell-walking-lunge.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Walking Dumbbell Lunges | Walking Dumbbell Lunges | walking-dumbbell-lunges | dumbbell-walking-lunge | /images/exercises/dumbbell-walking-lunge.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Wide Grip Lat Pulldown | Wide Grip Lat Pulldown | wide-grip-lat-pulldown | lat-pulldown | /images/exercises/lat-pulldown.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Wide Grip Pull Up | Wide Grip Pull Up | wide-grip-pull-up | wide-grip-pull-up | /images/exercises/wide-grip-pull-up.png | GENERATOR_COVERED | backend-alias, setcredits |
| Wide Grip Push Up | Wide Grip Push Up | wide-grip-push-up | wide-grip-push-up | /images/exercises/wide-grip-push-up.png | GENERATOR_COVERED | setcredits |
| Wide Push Up | Wide Push Up | wide-push-up | wide-grip-push-up | /images/exercises/wide-grip-push-up.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Wood Chopper | Wood Chopper | wood-chopper | cable-woodchopper | /images/exercises/cable-woodchopper.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |
| Woodchopper | Woodchopper | woodchopper | cable-woodchopper | /images/exercises/cable-woodchopper.png | COVERED_BY_SURROGATE_IMAGE | backend-alias |

## Generator names reaching fallback

| Item |
| --- |
| None |

## Generator names routed to surrogate images

| generated name | canonical exerciseId | resolved URL | exact dedicated file status |
| --- | --- | --- | --- |
| Ab Crunch | crunch | /images/exercises/crunch.png | no exact dedicated file |
| Ab Crunch Machine | crunch | /images/exercises/crunch.png | no exact dedicated file |
| Ab Rollout | ab-wheel-rollout | /images/exercises/ab-wheel-rollout.png | no exact dedicated file |
| Abduction | abductors | /images/exercises/abductors.png | no exact dedicated file |
| Abduction Machine | abductors | /images/exercises/abductors.png | no exact dedicated file |
| Abductor Machine | abductors | /images/exercises/abductors.png | no exact dedicated file |
| Adduction | adductors | /images/exercises/adductors.png | no exact dedicated file |
| Adduction Machine | adductors | /images/exercises/adductors.png | no exact dedicated file |
| Adductor Machine | adductors | /images/exercises/adductors.png | no exact dedicated file |
| Alternating Dumbbell Curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | no exact dedicated file |
| Australian Pull Up | australian-row | /images/exercises/australian-row.png | no exact dedicated file |
| Back Extension | good-morning | /images/exercises/good-morning.png | no exact dedicated file |
| Back Squat | barbell-squat | /images/exercises/barbell-squat.png | no exact dedicated file |
| Barbell Back Squat | barbell-squat | /images/exercises/barbell-squat.png | no exact dedicated file |
| Barbell Biceps Curl | barbell-bicep-curl | /images/exercises/barbell-bicep-curl.png | no exact dedicated file |
| Barbell Curl | barbell-bicep-curl | /images/exercises/barbell-bicep-curl.png | no exact dedicated file |
| Barbell Hip Thrust Machine | hip-thrust-machine | /images/exercises/hip-thrust-machine.png | no exact dedicated file |
| Barbell Romanian Deadlift | romanian-deadlift | /images/exercises/romanian-deadlift.png | no exact dedicated file |
| Barbell Shrugs | barbell-shrug | /images/exercises/barbell-shrug.png | no exact dedicated file |
| Bent Over Barbell Row | barbell-row | /images/exercises/barbell-row.png | no exact dedicated file |
| Bent Over Lateral Raise | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | no exact dedicated file |
| Bent Over Row | barbell-row | /images/exercises/barbell-row.png | no exact dedicated file |
| Bicep Curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | no exact dedicated file |
| Biceps Curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | no exact dedicated file |
| Bodyweight Row | australian-row | /images/exercises/australian-row.png | no exact dedicated file |
| Box Step Up | step-up | /images/exercises/step-up.png | no exact dedicated file |
| Bulgarian Dumbbell Split Squat | dumbbell-bulgarian-split-squat | /images/exercises/dumbbell-bulgarian-split-squat.png | no exact dedicated file |
| Bulgarian Split Squat | dumbbell-bulgarian-split-squat | /images/exercises/dumbbell-bulgarian-split-squat.png | no exact dedicated file |
| Bulgarian Split Squat Dumbbell | dumbbell-bulgarian-split-squat | /images/exercises/dumbbell-bulgarian-split-squat.png | no exact dedicated file |
| Cable Biceps Curl | cable-bicep-curl | /images/exercises/cable-bicep-curl.png | no exact dedicated file |
| Cable Chest Fly | cable-crossover | /images/exercises/cable-crossover.png | no exact dedicated file |
| Cable Crossover Fly | cable-crossover | /images/exercises/cable-crossover.png | no exact dedicated file |
| Cable Curl | cable-bicep-curl | /images/exercises/cable-bicep-curl.png | no exact dedicated file |
| Cable Face Pull | face-pull | /images/exercises/face-pull.png | no exact dedicated file |
| Cable Fly | cable-crossover | /images/exercises/cable-crossover.png | no exact dedicated file |
| Cable Lat Pulldown | lat-pulldown | /images/exercises/lat-pulldown.png | no exact dedicated file |
| Cable Preacher Curl | preacher-curl | /images/exercises/preacher-curl.png | no exact dedicated file |
| Cable Row | seated-cable-row | /images/exercises/seated-cable-row.png | no exact dedicated file |
| Cable Triceps Pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | no exact dedicated file |
| Cable Wood Chopper | cable-woodchopper | /images/exercises/cable-woodchopper.png | no exact dedicated file |
| Cable Woodchop | cable-woodchopper | /images/exercises/cable-woodchopper.png | no exact dedicated file |
| Calf Raise | standing-calf-raise | /images/exercises/standing-calf-raise.png | no exact dedicated file |
| Chest Dip | dip | /images/exercises/dip.png | no exact dedicated file |
| Chest Fly | machine-chest-fly | /images/exercises/machine-chest-fly.png | no exact dedicated file |
| Chest Press | machine-chest-press | /images/exercises/machine-chest-press.png | no exact dedicated file |
| Chest Press Machine | machine-chest-press | /images/exercises/machine-chest-press.png | no exact dedicated file |
| Chin Up Assisted If Needed | assisted-chin-up | /images/exercises/assisted-chin-up.png | no exact dedicated file |
| Chin Ups | chin-up | /images/exercises/chin-up.png | no exact dedicated file |
| Close Grip Push Up | diamond-push-up | /images/exercises/diamond-push-up.png | no exact dedicated file |
| Dumbbell Bent Over Row | dumbbell-row | /images/exercises/dumbbell-row.png | no exact dedicated file |
| Dumbbell Biceps Curl | dumbbell-curl | /images/exercises/dumbbell-bicep-curl.png | no exact dedicated file |
| Dumbbell Chest Fly | dumbbell-fly | /images/exercises/dumbbell-fly.png | no exact dedicated file |
| Dumbbell Hammer Curl | hammer-curl | /images/exercises/hammer-curl.png | no exact dedicated file |
| Dumbbell Hammer Curls | hammer-curl | /images/exercises/hammer-curl.png | no exact dedicated file |
| Dumbbell Lunge | forward-lunge | /images/exercises/forward-lunge.png | no exact dedicated file |
| Dumbbell Lunges | forward-lunge | /images/exercises/forward-lunge.png | no exact dedicated file |
| Dumbbell Overhead Press | dumbbell-shoulder-press | /images/exercises/dumbbell-shoulder-press.png | no exact dedicated file |
| Dumbbell Overhead Triceps Extension | overhead-tricep-extension | /images/exercises/overhead-tricep-extension.png | no exact dedicated file |
| Dumbbell Press | dumbbell-bench-press | /images/exercises/dumbbell-bench-press.png | no exact dedicated file |
| Dumbbell Shoulder Press Seated Or Standing | dumbbell-shoulder-press | /images/exercises/dumbbell-shoulder-press.png | no exact dedicated file |
| Dumbbell Shrugs | dumbbell-shrug | /images/exercises/dumbbell-shrug.png | no exact dedicated file |
| Dumbbell Standing Calf Raise | dumbbell-calf-raise | /images/exercises/dumbbell-calf-raise.png | no exact dedicated file |
| Dumbbell Standing Calf Raises | dumbbell-calf-raise | /images/exercises/dumbbell-calf-raise.png | no exact dedicated file |
| Dumbbell Step Up | step-up | /images/exercises/step-up.png | no exact dedicated file |
| Dumbbell Walking Lunges | dumbbell-walking-lunge | /images/exercises/dumbbell-walking-lunge.png | no exact dedicated file |
| Dumbbells Shrug | dumbbell-shrug | /images/exercises/dumbbell-shrug.png | no exact dedicated file |
| Dumbbells Shrugs | dumbbell-shrug | /images/exercises/dumbbell-shrug.png | no exact dedicated file |
| Dumbell Lateral Raise | dumbbell-lateral-raise | /images/exercises/dumbbell-lateral-raise.png | no exact dedicated file |
| Dumbell Lateral Raises | dumbbell-lateral-raise | /images/exercises/dumbbell-lateral-raise.png | no exact dedicated file |
| Ez Bar Curl | barbell-bicep-curl | /images/exercises/barbell-bicep-curl.png | no exact dedicated file |
| Ez Bar Preacher Curl | preacher-curl | /images/exercises/preacher-curl.png | no exact dedicated file |
| Flat Barbell Bench Press | barbell-bench-press | /images/exercises/bench-press.png | no exact dedicated file |
| Flat Bench Press | barbell-bench-press | /images/exercises/bench-press.png | no exact dedicated file |
| Flat Dumbbell Fly | dumbbell-fly | /images/exercises/dumbbell-fly.png | no exact dedicated file |
| Flat Dumbbell Press | dumbbell-bench-press | /images/exercises/dumbbell-bench-press.png | no exact dedicated file |
| Front Raise | dumbbell-front-raise | /images/exercises/dumbbell-front-raise.png | no exact dedicated file |
| Front Squat | barbell-front-squat | /images/exercises/barbell-front-squat.png | no exact dedicated file |
| Goblet Squat | dumbbell-goblet-squat | /images/exercises/dumbbell-goblet-squat.png | no exact dedicated file |
| Hammer Curls | hammer-curl | /images/exercises/hammer-curl.png | no exact dedicated file |
| Hamstring Curl | lying-leg-curl | /images/exercises/lying-leg-curl.png | no exact dedicated file |
| High Bar Squat | barbell-squat | /images/exercises/barbell-squat.png | no exact dedicated file |
| High To Low Cable Fly | cable-crossover | /images/exercises/cable-crossover.png | no exact dedicated file |
| Hip Abduction | abductors | /images/exercises/abductors.png | no exact dedicated file |
| Hip Abduction Machine | abductors | /images/exercises/abductors.png | no exact dedicated file |
| Hip Abductor | abductors | /images/exercises/abductors.png | no exact dedicated file |
| Hip Abductor Machine | abductors | /images/exercises/abductors.png | no exact dedicated file |
| Hip Adduction | adductors | /images/exercises/adductors.png | no exact dedicated file |
| Hip Adduction Machine | adductors | /images/exercises/adductors.png | no exact dedicated file |
| Hip Adductor | adductors | /images/exercises/adductors.png | no exact dedicated file |
| Hip Adductor Machine | adductors | /images/exercises/adductors.png | no exact dedicated file |
| Hyperextension | good-morning | /images/exercises/good-morning.png | no exact dedicated file |
| Incline Barbell Bench Press | incline-bench-press | /images/exercises/incline-bench-press.png | no exact dedicated file |
| Incline Db Bench Press | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | no exact dedicated file |
| Incline Db Press | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | no exact dedicated file |
| Incline Dumbbell Bench | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | no exact dedicated file |
| Incline Dumbbell Bench Chest Press | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | no exact dedicated file |
| Incline Dumbbell Chest Press | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | no exact dedicated file |
| Incline Dumbbell Chest Press Machine | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | no exact dedicated file |
| Incline Dumbbell Press | incline-dumbbell-bench-press | /images/exercises/incline-dumbbell-bench-press.png | no exact dedicated file |
| Incline Press | incline-bench-press | /images/exercises/incline-bench-press.png | no exact dedicated file |
| Inverted Row | australian-row | /images/exercises/australian-row.png | no exact dedicated file |
| Knee Extension | leg-extension | /images/exercises/leg-extension.png | no exact dedicated file |
| Kneeling Cable Crunch | cable-crunch | /images/exercises/cable-crunch.png | no exact dedicated file |
| Lat Pulldowns | lat-pulldown | /images/exercises/lat-pulldown.png | no exact dedicated file |
| Lateral Raise | dumbbell-lateral-raise | /images/exercises/dumbbell-lateral-raise.png | no exact dedicated file |
| Lateral Raises | dumbbell-lateral-raise | /images/exercises/dumbbell-lateral-raise.png | no exact dedicated file |
| Leg Curl | lying-leg-curl | /images/exercises/lying-leg-curl.png | no exact dedicated file |
| Leg Extension Machine | leg-extension | /images/exercises/leg-extension.png | no exact dedicated file |
| Leg Extensions | leg-extension | /images/exercises/leg-extension.png | no exact dedicated file |
| Leg Press Machine | leg-press | /images/exercises/leg-press.png | no exact dedicated file |
| Leg Raise | hanging-leg-raise | /images/exercises/hanging-leg-raise.png | no exact dedicated file |
| Low Bar Squat | barbell-squat | /images/exercises/barbell-squat.png | no exact dedicated file |
| Lunge | forward-lunge | /images/exercises/forward-lunge.png | no exact dedicated file |
| Lying Leg Curls | lying-leg-curl | /images/exercises/lying-leg-curl.png | no exact dedicated file |
| Lying Triceps Extension | skull-crusher | /images/exercises/skull-crusher.png | no exact dedicated file |
| Machine Ab Crunch | crunch | /images/exercises/crunch.png | no exact dedicated file |
| Machine Calf Raise | standing-calf-raise-machine | /images/exercises/standing-calf-raise.png | no exact dedicated file |
| Machine Crunch | crunch | /images/exercises/crunch.png | no exact dedicated file |
| Machine Fly | machine-chest-fly | /images/exercises/machine-chest-fly.png | no exact dedicated file |
| Machine Preacher Curl | preacher-curl | /images/exercises/preacher-curl.png | no exact dedicated file |
| Machine Rear Delt Fly | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | no exact dedicated file |
| Machine Reverse Fly | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | no exact dedicated file |
| Machine Row | seated-machine-row | /images/exercises/seated-machine-row.png | no exact dedicated file |
| Military Press | barbell-shoulder-press | /images/exercises/barbell-shoulder-press.png | no exact dedicated file |
| Neutral Grip Lat Pulldown | close-grip-lat-pulldown | /images/exercises/close-grip-lat-pulldown.png | no exact dedicated file |
| Neutral Grip Pullup | neutral-grip-pull-up | /images/exercises/neutral-grip-pull-up.png | no exact dedicated file |
| One Arm Dumbbell Row | dumbbell-row | /images/exercises/dumbbell-row.png | no exact dedicated file |
| Overhead Press | barbell-shoulder-press | /images/exercises/barbell-shoulder-press.png | no exact dedicated file |
| Overhead Triceps Extension | overhead-tricep-extension | /images/exercises/overhead-tricep-extension.png | no exact dedicated file |
| Parallel Bar Dip | dip | /images/exercises/dip.png | no exact dedicated file |
| Pendlay Row | barbell-row | /images/exercises/barbell-row.png | no exact dedicated file |
| Plank Hold | plank | /images/exercises/plank.png | no exact dedicated file |
| Pull Up Assisted If Needed | assisted-pull-up | /images/exercises/assisted-pull-up.png | no exact dedicated file |
| Pull Ups | pull-up | /images/exercises/pull-up.png | no exact dedicated file |
| Pullup | pull-up | /images/exercises/pull-up.png | no exact dedicated file |
| Push Up Standard | push-up | /images/exercises/push-up.png | no exact dedicated file |
| Push Ups | push-up | /images/exercises/push-up.png | no exact dedicated file |
| Pushup | push-up | /images/exercises/push-up.png | no exact dedicated file |
| Rdl | romanian-deadlift | /images/exercises/romanian-deadlift.png | no exact dedicated file |
| Rear Delt Fly | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | no exact dedicated file |
| Rear Delt Machine Fly | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | no exact dedicated file |
| Rear Delt Pec Deck | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | no exact dedicated file |
| Rear Delt Raise | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | no exact dedicated file |
| Reverse Fly | dumbbell-reverse-fly | /images/exercises/dumbbell-reverse-fly.png | no exact dedicated file |
| Reverse Machine Fly | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | no exact dedicated file |
| Reverse Pec Deck Fly | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | no exact dedicated file |
| Reverse Pec Deck Machine | reverse-pec-deck | /images/exercises/reverse-pec-deck.png | no exact dedicated file |
| Ring Row | australian-row | /images/exercises/australian-row.png | no exact dedicated file |
| Romanian Deadlift Rdl | romanian-deadlift | /images/exercises/romanian-deadlift.png | no exact dedicated file |
| Rope Tricep Pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | no exact dedicated file |
| Rope Triceps Pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | no exact dedicated file |
| Seated Ab Crunch | crunch | /images/exercises/crunch.png | no exact dedicated file |
| Seated Barbell Shoulder Press | barbell-shoulder-press | /images/exercises/barbell-shoulder-press.png | no exact dedicated file |
| Seated Chest Press | machine-chest-press | /images/exercises/machine-chest-press.png | no exact dedicated file |
| Seated Dumbbell Shoulder Press | dumbbell-shoulder-press | /images/exercises/dumbbell-shoulder-press.png | no exact dedicated file |
| Seated Hamstring Curl | seated-leg-curl | /images/exercises/seated-leg-curl.png | no exact dedicated file |
| Seated Hip Abduction | abductors | /images/exercises/abductors.png | no exact dedicated file |
| Seated Hip Adduction | adductors | /images/exercises/adductors.png | no exact dedicated file |
| Seated Leg Curls | seated-leg-curl | /images/exercises/seated-leg-curl.png | no exact dedicated file |
| Seated Leg Extension | leg-extension | /images/exercises/leg-extension.png | no exact dedicated file |
| Seated Row | seated-machine-row | /images/exercises/seated-machine-row.png | no exact dedicated file |
| Seated Row Machine | seated-machine-row | /images/exercises/seated-machine-row.png | no exact dedicated file |
| Shoulder Press Machine | machine-shoulder-press | /images/exercises/machine-shoulder-press.png | no exact dedicated file |
| Shrug | barbell-shrug | /images/exercises/barbell-shrug.png | no exact dedicated file |
| Shrugs | barbell-shrug | /images/exercises/barbell-shrug.png | no exact dedicated file |
| Side Lateral Raise | dumbbell-lateral-raise | /images/exercises/dumbbell-lateral-raise.png | no exact dedicated file |
| Single Arm Dumbbell Row | dumbbell-row | /images/exercises/dumbbell-row.png | no exact dedicated file |
| Skull Crushers | skull-crusher | /images/exercises/skull-crusher.png | no exact dedicated file |
| Smith Machine Calf Raise | standing-calf-raise-machine | /images/exercises/standing-calf-raise.png | no exact dedicated file |
| Split Squat | dumbbell-bulgarian-split-squat | /images/exercises/dumbbell-bulgarian-split-squat.png | no exact dedicated file |
| Squat | barbell-squat | /images/exercises/barbell-squat.png | no exact dedicated file |
| Standing Calf Raises | standing-calf-raise | /images/exercises/standing-calf-raise.png | no exact dedicated file |
| Standing Dumbbell Calf Raise | dumbbell-calf-raise | /images/exercises/dumbbell-calf-raise.png | no exact dedicated file |
| Standing Dumbbell Calf Raises | dumbbell-calf-raise | /images/exercises/dumbbell-calf-raise.png | no exact dedicated file |
| Standing Overhead Press | barbell-shoulder-press | /images/exercises/barbell-shoulder-press.png | no exact dedicated file |
| Step Ups | step-up | /images/exercises/step-up.png | no exact dedicated file |
| Straight Arm Pulldown | close-grip-lat-pulldown | /images/exercises/close-grip-lat-pulldown.png | no exact dedicated file |
| Suspension Row | australian-row | /images/exercises/australian-row.png | no exact dedicated file |
| Tricep Pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | no exact dedicated file |
| Triceps Dip | tricep-dip | /images/exercises/tricep-dip.png | no exact dedicated file |
| Triceps Pushdown | cable-tricep-pushdown | /images/exercises/cable-tricep-pushdown.png | no exact dedicated file |
| Upright Row | barbell-upright-row | /images/exercises/barbell-upright-row.png | no exact dedicated file |
| Walking Dumbbell Lunge | dumbbell-walking-lunge | /images/exercises/dumbbell-walking-lunge.png | no exact dedicated file |
| Walking Dumbbell Lunges | dumbbell-walking-lunge | /images/exercises/dumbbell-walking-lunge.png | no exact dedicated file |
| Wide Grip Lat Pulldown | lat-pulldown | /images/exercises/lat-pulldown.png | no exact dedicated file |
| Wide Push Up | wide-grip-push-up | /images/exercises/wide-grip-push-up.png | no exact dedicated file |
| Wood Chopper | cable-woodchopper | /images/exercises/cable-woodchopper.png | no exact dedicated file |
| Woodchopper | cable-woodchopper | /images/exercises/cable-woodchopper.png | no exact dedicated file |

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
