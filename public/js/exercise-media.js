import { exerciseImageUrl, exerciseImageResolutionDetails, fallbackExerciseImageUrl } from './exercise-image.js';

// Keyed by the existing resolved media slug, so canonical aliases share a
// complete start/finish infographic. Add only reviewed, existing assets here.
export const FEMALE_EXERCISE_MEDIA = Object.freeze({
  "ab-wheel-rollout": "/images/exercises/female/ab-wheel-rollout.webp",
  "abductors": "/images/exercises/female/abductors.webp",
  "adductors": "/images/exercises/female/adductors.webp",
  "archer-push-up": "/images/exercises/female/archer-push-up.webp",
  "arnold-press": "/images/exercises/female/arnold-press.webp",
  "assisted-chin-up": "/images/exercises/female/assisted-chin-up.webp",
  "assisted-pull-up": "/images/exercises/female/assisted-pull-up.webp",
  "australian-row": "/images/exercises/female/australian-row.webp",
  "back-extension": "/images/exercises/female/back-extension.webp",
  "barbell-bicep-curl": "/images/exercises/female/barbell-bicep-curl.webp",
  "barbell-front-squat": "/images/exercises/female/barbell-front-squat.webp",
  "barbell-hip-thrust": "/images/exercises/female/barbell-hip-thrust.webp",
  "barbell-row": "/images/exercises/female/barbell-row.webp",
  "barbell-shoulder-press": "/images/exercises/female/barbell-shoulder-press.webp",
  "barbell-shrug": "/images/exercises/female/barbell-shrug.webp",
  "barbell-squat": "/images/exercises/female/barbell-squat.webp",
  "barbell-upright-row": "/images/exercises/female/barbell-upright-row.webp",
  "bayesian-cable-curl": "/images/exercises/female/bayesian-cable-curl.webp",
  "bench-dip": "/images/exercises/female/bench-dip.webp",
  "bench-press": "/images/exercises/female/bench-press.webp",
  "bodyweight-glute-bridge": "/images/exercises/female/bodyweight-glute-bridge.webp",
  "cable-bicep-curl": "/images/exercises/female/cable-bicep-curl.webp",
  "cable-crossover": "/images/exercises/female/cable-crossover.webp",
  "cable-crunch": "/images/exercises/female/cable-crunch.webp",
  "cable-glute-kickback": "/images/exercises/female/cable-glute-kickback.webp",
  "cable-lateral-raise": "/images/exercises/female/cable-lateral-raise.webp",
  "cable-overhead-triceps-extension": "/images/exercises/female/cable-overhead-triceps-extension.webp",
  "cable-tricep-pushdown": "/images/exercises/female/cable-tricep-pushdown.webp",
  "cable-woodchopper": "/images/exercises/female/cable-woodchopper.webp",
  "chest-supported-row": "/images/exercises/female/chest-supported-row.webp",
  "chin-up": "/images/exercises/female/chin-up.webp",
  "close-grip-bench-press": "/images/exercises/female/close-grip-bench-press.webp",
  "close-grip-lat-pulldown": "/images/exercises/female/close-grip-lat-pulldown.webp",
  "concentration-curl": "/images/exercises/female/concentration-curl.webp",
  "conventional-deadlift": "/images/exercises/female/conventional-deadlift.webp",
  "crunch": "/images/exercises/female/crunch.webp",
  "dead-bug": "/images/exercises/female/dead-bug.webp",
  "diamond-push-up": "/images/exercises/female/diamond-push-up.webp",
  "dip": "/images/exercises/female/dip.webp",
  "dragon-flag": "/images/exercises/female/dragon-flag.webp",
  "dumbbell-bench-press": "/images/exercises/female/dumbbell-bench-press.webp",
  "dumbbell-bicep-curl": "/images/exercises/female/dumbbell-bicep-curl.webp",
  "dumbbell-bulgarian-split-squat": "/images/exercises/female/dumbbell-bulgarian-split-squat.webp",
  "dumbbell-calf-raise": "/images/exercises/female/dumbbell-calf-raise.webp",
  "dumbbell-floor-press": "/images/exercises/female/dumbbell-floor-press.webp",
  "dumbbell-fly": "/images/exercises/female/dumbbell-fly.webp",
  "dumbbell-front-raise": "/images/exercises/female/dumbbell-front-raise.webp",
  "dumbbell-goblet-squat": "/images/exercises/female/dumbbell-goblet-squat.webp",
  "dumbbell-hip-thrust": "/images/exercises/female/dumbbell-hip-thrust.webp",
  "dumbbell-lateral-raise": "/images/exercises/female/dumbbell-lateral-raise.webp",
  "dumbbell-reverse-fly": "/images/exercises/female/dumbbell-reverse-fly.webp",
  "dumbbell-reverse-lunge": "/images/exercises/female/dumbbell-reverse-lunge.webp",
  "dumbbell-row": "/images/exercises/female/dumbbell-row.webp",
  "dumbbell-shoulder-press": "/images/exercises/female/dumbbell-shoulder-press.webp",
  "dumbbell-shrug": "/images/exercises/female/dumbbell-shrug.webp",
  "dumbbell-walking-lunge": "/images/exercises/female/dumbbell-walking-lunge.webp",
  "face-pull": "/images/exercises/female/face-pull.webp",
  "forward-lunge": "/images/exercises/female/forward-lunge.webp",
  "front-lever": "/images/exercises/female/front-lever.webp",
  "good-morning": "/images/exercises/female/good-morning.webp",
  "hack-squat": "/images/exercises/female/hack-squat.webp",
  "hammer-curl": "/images/exercises/female/hammer-curl.webp",
  "handstand": "/images/exercises/female/handstand.webp",
  "handstand-push-up": "/images/exercises/female/handstand-push-up.webp",
  "hanging-knee-raise": "/images/exercises/female/hanging-knee-raise.webp",
  "hanging-leg-raise": "/images/exercises/female/hanging-leg-raise.webp",
  "hip-thrust-machine": "/images/exercises/female/hip-thrust-machine.webp",
  "incline-bench-press": "/images/exercises/female/incline-bench-press.webp",
  "incline-chest-press-machine": "/images/exercises/female/incline-chest-press-machine.webp",
  "incline-dumbbell-bench-press": "/images/exercises/female/incline-dumbbell-bench-press.webp",
  "incline-dumbbell-curl": "/images/exercises/female/incline-dumbbell-curl.webp",
  "kettlebell-swing": "/images/exercises/female/kettlebell-swing.webp",
  "l-sit": "/images/exercises/female/l-sit.webp",
  "landmine-press": "/images/exercises/female/landmine-press.webp",
  "lat-pulldown": "/images/exercises/female/lat-pulldown.webp",
  "leg-extension": "/images/exercises/female/leg-extension.webp",
  "leg-press": "/images/exercises/female/leg-press.webp",
  "lying-leg-curl": "/images/exercises/female/lying-leg-curl.webp",
  "machine-chest-fly": "/images/exercises/female/machine-chest-fly.webp",
  "machine-chest-press": "/images/exercises/female/machine-chest-press.webp",
  "machine-shoulder-press": "/images/exercises/female/machine-shoulder-press.webp",
  "muscle-up": "/images/exercises/female/muscle-up.webp",
  "neutral-grip-pull-up": "/images/exercises/female/neutral-grip-pull-up.webp",
  "nordic-hamstring-curl": "/images/exercises/female/nordic-hamstring-curl.webp",
  "one-arm-pull-up": "/images/exercises/female/one-arm-pull-up.webp",
  "overhead-tricep-extension": "/images/exercises/female/overhead-tricep-extension.webp",
  "pallof-press": "/images/exercises/female/pallof-press.webp",
  "pike-push-up": "/images/exercises/female/pike-push-up.webp",
  "pistol-squat": "/images/exercises/female/pistol-squat.webp",
  "planche": "/images/exercises/female/planche.webp",
  "plank": "/images/exercises/female/plank.webp",
  "preacher-curl": "/images/exercises/female/preacher-curl.webp",
  "pseudo-planche-push-up": "/images/exercises/female/pseudo-planche-push-up.webp",
  "pull-up": "/images/exercises/female/pull-up.webp",
  "push-up": "/images/exercises/female/push-up.webp",
  "rack-pull": "/images/exercises/female/rack-pull.webp",
  "reverse-lunge": "/images/exercises/female/reverse-lunge.webp",
  "reverse-pec-deck": "/images/exercises/female/reverse-pec-deck.webp",
  "ring-dip": "/images/exercises/female/ring-dip.webp",
  "ring-muscle-up": "/images/exercises/female/ring-muscle-up.webp",
  "ring-row": "/images/exercises/female/ring-row.webp",
  "romanian-deadlift": "/images/exercises/female/romanian-deadlift.webp",
  "russian-twist": "/images/exercises/female/russian-twist.webp",
  "seated-cable-row": "/images/exercises/female/seated-cable-row.webp",
  "seated-calf-raise": "/images/exercises/female/seated-calf-raise.webp",
  "seated-leg-curl": "/images/exercises/female/seated-leg-curl.webp",
  "seated-machine-row": "/images/exercises/female/seated-machine-row.webp",
  "side-plank": "/images/exercises/female/side-plank.webp",
  "single-arm-cable-row": "/images/exercises/female/single-arm-cable-row.webp",
  "sissy-squat": "/images/exercises/female/sissy-squat.webp",
  "sit-up": "/images/exercises/female/sit-up.webp",
  "skull-crusher": "/images/exercises/female/skull-crusher.webp",
  "standing-bodyweight-calf-raise": "/images/exercises/female/standing-bodyweight-calf-raise.webp",
  "standing-calf-raise": "/images/exercises/female/standing-calf-raise.webp",
  "step-up": "/images/exercises/female/step-up.webp",
  "sumo-deadlift": "/images/exercises/female/sumo-deadlift.webp",
  "t-bar-row": "/images/exercises/female/t-bar-row.webp",
  "tibialis-raise": "/images/exercises/female/tibialis-raise.webp",
  "toes-to-bar": "/images/exercises/female/toes-to-bar.webp",
  "tricep-dip": "/images/exercises/female/tricep-dip.webp",
  "typewriter-pull-ups": "/images/exercises/female/typewriter-pull-ups.webp",
  "wide-grip-pull-up": "/images/exercises/female/wide-grip-pull-up.webp",
  "wide-grip-push-up": "/images/exercises/female/wide-grip-push-up.webp"
});

export function resolveExerciseMedia(exercise, model = 'default', variants = FEMALE_EXERCISE_MEDIA) {
  const details = exerciseImageResolutionDetails(exercise);
  const standard = exerciseImageUrl(exercise);
  const female = !details.usedFallback && variants[details.attemptedSlug];
  const valid = typeof female === 'string' && /^\/images\/exercises\/female\/[a-z0-9-]+\.webp$/.test(female);
  const selected = model === 'female' && valid ? female : standard;
  return { url: selected, defaultUrl: standard,
    fallbackUrl: fallbackExerciseImageUrl(), model: selected === female ? 'female' : 'default' };
}

// A fresh handler for each exercise/preference prevents stale replacement
// handlers and guarantees a bounded female -> default -> branded fallback.
export function setExerciseMedia(image, exercise, model = 'default', variants = FEMALE_EXERCISE_MEDIA, {load = true} = {}) {
  const media = resolveExerciseMedia(exercise, model, variants);
  const queue = [...new Set([media.url, media.defaultUrl, media.fallbackUrl])];
  let index = 0;
  image.onerror = () => {
    if (++index < queue.length) {
      image.dataset.src = queue[index];
      image.src = queue[index];
    }
    else image.onerror = null;
  };
  image.dataset.src = media.url;
  if (load) image.src = media.url;
  return media;
}
