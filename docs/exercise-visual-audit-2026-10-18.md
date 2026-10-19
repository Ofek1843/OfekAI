# Exercise library visual audit — 2026-10-18

This is a visual-content review in addition to `exercise-image-coverage-report.md`.
The coverage report verifies file presence and resolver routing; it does not
verify movement quality. The 123 canonical exercise images were screened in
contact sheets, with suspicious or low-quality examples opened at full size.

## Findings addressed

- Replaced blurry, single-photo or illustrated guides with photorealistic
  start/end/muscle-map guides where the movement can be represented clearly.
- Removed unreadable tips and paragraphs from selected guides, including
  seated machine row, dumbbell shrug, dumbbell row, barbell row, machine chest
  press, push-up and pike push-up.
- Corrected/clarified examples raised by the user: Ring Row, Bayesian Cable
  Curl, Standing Bodyweight Calf Raise, Tibialis Raise, Dumbbell Floor Press,
  Ring Dip, Dead Bug, Dragon Flag, Pallof Press, Sit Up, Toes-to-Bar,
  Landmine Press and Cable Glute Kickback.
- Replaced additional single-photo or inconsistent guides in the row, dip,
  press, hip, curl, core, bodyweight-skill and calf-raise groups, including
  Barbell Shrug and Handstand/Handstand Push-Up.
- Checked the image artwork itself for whether start and finish visibly differ;
  images that failed that check were regenerated rather than accepted.

## Image consumers

Exercise IDs remain unchanged, so the exercise library, plan generator, workout
builder, history and share previews continue to resolve the same canonical
images. Cache-busting revision `20261018-guides-6` ensures updated guides are
requested by browser clients; the exercise library now uses contain sizing so
instructional panels are not cropped.

## Verification and limits

The resolver audit reports 123/123 canonical images present, 270 aliases
covered, 360/360 generator name variants routed, and no broken mappings. The
workout-image regression suite passes. Image coverage and visual review do not
constitute professional biomechanical sign-off; generated guides are visual
references, not a substitute for qualified coaching.
