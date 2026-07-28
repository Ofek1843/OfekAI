# Exercise demonstration images — AI-generation plan

The old exercise-demonstration feature (wger-sourced photos, before that
YouTube embeds) has been removed completely — no code, no CSS, no leftover
media, no dead endpoint. This document replaces it: a folder, a naming
convention, and a checklist of exercises to generate images for.

## Folder

```
public/images/exercises/
```

Currently empty. Drop finished images directly in here — nothing else in
the codebase reads from this folder yet, so it's safe to fill in gradually.

## What each image should contain

**One image per exercise**, combining both the start position and the end
position of the movement in a single composite (e.g. side-by-side or
before/after within one frame) — not two separate files. This matches what
was asked for: one purchase-worthy image per exercise showing the full
range of motion at a glance.

Recommended composition:
- Consistent character/art style across the whole set (same model, same
  render style, same background) so the library reads as one coherent
  product, not a mismatched grab-bag.
- Clear left→right or top→bottom read order: starting position first, end
  position second.
- Equipment visibly correct for the named variation (a "Dumbbell Row" image
  must show dumbbells, not a barbell — this was the single biggest source
  of "wrong demonstration" complaints with the old system, so it's worth
  getting right at generation time rather than fixing later).

## Naming convention

`kebab-case-exercise-name.png` (or `.webp` if you prefer smaller files),
lowercase, hyphen-separated, equipment first when equipment matters:

```
barbell-bench-press.png
dumbbell-bicep-curl.png
pull-up.png
```

This intentionally matches the `demoName` field the AI workout/nutrition
generator already writes for every exercise in `server.js` (search for
`demoName` — the prompt instructs the model to output "the precise
canonical English exercise name, including equipment and position
modifiers"). That field was originally built for the old media lookup and
was deliberately left in place when the old system was removed, so the
naming is already consistent end-to-end: generate `demoName` → slugify →
this is your filename. No new wiring needed on the code side once the
images exist — that's a follow-up task, not part of this document.

## Exercise checklist

Organized by category. Check off as you generate. This list is deliberately
broader than what the old system ever covered (which topped out at 46
exercises and was missing most calisthenics entirely) — treat it as the
target for a complete v1 library, not a minimum.

### Chest
- [ ] barbell-bench-press
- [ ] dumbbell-bench-press
- [ ] incline-barbell-bench-press
- [ ] incline-dumbbell-bench-press
- [ ] decline-bench-press
- [ ] dumbbell-fly
- [ ] cable-crossover
- [ ] machine-chest-fly (pec deck)
- [ ] machine-chest-press
- [ ] push-up
- [ ] wide-grip-push-up
- [ ] diamond-push-up
- [ ] archer-push-up
- [ ] chest-dip

### Back
- [ ] barbell-row (bent-over)
- [ ] dumbbell-row (single-arm)
- [ ] t-bar-row
- [ ] seated-cable-row
- [ ] lat-pulldown (wide grip)
- [ ] close-grip-lat-pulldown
- [ ] pull-up
- [ ] chin-up
- [ ] neutral-grip-pull-up
- [ ] one-arm-pull-up
- [ ] australian-row (inverted row)
- [ ] deadlift (conventional)
- [ ] sumo-deadlift
- [ ] romanian-deadlift
- [ ] rack-pull

### Shoulders
- [ ] barbell-shoulder-press
- [ ] dumbbell-shoulder-press
- [ ] machine-shoulder-press
- [ ] arnold-press
- [ ] dumbbell-lateral-raise
- [ ] cable-lateral-raise
- [ ] dumbbell-front-raise
- [ ] dumbbell-reverse-fly (rear delt)
- [ ] face-pull
- [ ] barbell-upright-row
- [ ] barbell-shrug
- [ ] handstand-push-up
- [ ] pike-push-up

### Biceps
- [ ] dumbbell-bicep-curl (standing)
- [ ] barbell-bicep-curl
- [ ] hammer-curl
- [ ] cable-bicep-curl
- [ ] preacher-curl
- [ ] concentration-curl
- [ ] chin-up (biceps-emphasis alt of the back entry above)

### Triceps
- [ ] cable-triceps-pushdown
- [ ] skull-crusher (lying triceps extension)
- [ ] overhead-triceps-extension
- [ ] tricep-dip
- [ ] close-grip-bench-press
- [ ] diamond-push-up (triceps-emphasis alt of the chest entry above)

### Legs
- [ ] barbell-squat (back squat)
- [ ] barbell-front-squat
- [ ] dumbbell-goblet-squat
- [ ] bulgarian-split-squat
- [ ] hack-squat
- [ ] leg-press
- [ ] leg-extension
- [ ] seated-leg-curl
- [ ] lying-leg-curl
- [ ] standing-calf-raise
- [ ] seated-calf-raise
- [ ] dumbbell-lunge (walking)
- [ ] reverse-lunge
- [ ] step-up
- [ ] barbell-hip-thrust
- [ ] dumbbell-hip-thrust
- [ ] kettlebell-swing
- [ ] pistol-squat
- [ ] good-morning

### Core
- [ ] plank
- [ ] side-plank
- [ ] hanging-leg-raise
- [ ] hanging-knee-raise
- [ ] cable-woodchopper
- [ ] russian-twist
- [ ] ab-rollout
- [ ] cable-crunch
- [ ] l-sit
- [ ] dragon-flag

### Calisthenics skills (explicitly prioritized — this is the area the
generator currently handles worst, per your own testing)
- [ ] muscle-up
- [ ] front-lever (tuck / advanced tuck / full — pick the progression set you want covered)
- [ ] back-lever
- [ ] planche (tuck / advanced tuck / full)
- [ ] handstand
- [ ] handstand-push-up
- [ ] pistol-squat
- [ ] archer-pull-up
- [ ] typewriter-pull-up
- [ ] skin-the-cat
- [ ] human-flag

### Conditioning / other
- [ ] farmer-carry
- [ ] box-jump
- [ ] battle-ropes
- [ ] burpee
- [ ] mountain-climber

## Next step once images exist

This document intentionally stops at "generate and drop the files in." Once
even a handful of images exist, come back and ask for the display layer to
be rebuilt (server-side lookup by `demoName` → check
`public/images/exercises/<slug>.png` exists → serve it; client-side modal
or inline card to show it) — that's a small, fast follow-up once there's
real content to point it at.
