# FuelPhysique Athletic Spectrum illustration system

Status: Phase 4 implementation source of truth.

## Visual language

FuelPhysique uses one original, lightweight human-figure system implemented in `public/js/illustrated-v4.js` and styled by `public/css/illustrated-v4.css`. No external illustration pack, stock character, remote SVG, or third-party artwork is used.

- Heads are filled circles with a consistent 15-18 px radius inside a `320 x 220` view box.
- Torsos are compact filled athletic shapes, while articulated arms and legs use rounded seven-pixel strokes.
- Equipment uses five-to-seven-pixel rounded outlines. Plates and handles remain geometric and readable at small sizes.
- A lighter domain-relative accent marks muscle, chart, measurement, or exchange detail without glow.
- Poster labels are short uppercase capability statements, never fabricated user metrics.
- Every SVG is presentation-only with `role="presentation"`, `aria-hidden="true"`, and no focusable body parts.

## Capability scenes

| Scene | Idle composition | First viewport entry | Replay on hover/focus/touch |
| --- | --- | --- | --- |
| Training | Side/lower-edge athlete under a barbell | One controlled squat and bar travel | Repeats the single rep |
| Nutrition | Athletic seated figure, plate, meal, and utensil | One utensil-to-mouth interaction | Repeats the interaction |
| Progress | Athlete standing on a scale beside a real-looking but non-numeric capability chart | Needle settles and chart draws | Scene changes briefly to one bench-press lockout and a non-user-specific `PR` capability state |
| Coach | Athlete beside a training checklist | Three checks resolve in sequence | Repeats the checklist response |
| Social | Two athlete silhouettes exchanging message, workout, and music cards | Cards establish in sequence | Repeats the exchange |
| Landing deadlift | Athlete and barbell held near the lower edge | One controlled pull, lockout, and return | Repeats the one rep |

The PR illustration never claims that the current user achieved a record and contains no invented weight or score.

## Athletic Spectrum color

| Domain | Primary | Deep surface |
| --- | --- | --- |
| Training | `#315BFF` | `#203A9C` |
| Nutrition | `#F0A326` | `#81510F` |
| Progress | `#7957E8` | `#4B338F` |
| Coach | `#1FA978` | `#126849` |
| Social | `#D94F82` | `#8E2C52` |

The shared landing canvas is `#E9EEF8`; the dark application canvas is `#151A29`. Cards use flat domain surfaces, moderate radii, one-pixel structure, and no gradients, glass, or glow.

## Illustrative motion tokens

| Token | Duration | Use |
| --- | ---: | --- |
| `--motion-illustrative-training` | 1800 ms | Controlled resistance rep |
| `--motion-illustrative-nutrition` | 1500 ms | Meal interaction |
| `--motion-illustrative-progress` | 1700 ms | Scale and chart measurement |
| `--motion-illustrative-bench-pr` | 1700 ms | Bench lockout and capability-only PR state |
| `--motion-illustrative-coach` | 1400 ms | Checklist response |
| `--motion-illustrative-social` | 1600 ms | Message/workout/music exchange |
| `--motion-illustrative-deadlift` | 2400 ms | Landing hero lift |

These sit above the existing Instant, Micro, Interface, Content, and Moment tiers because they describe one complete physical action rather than UI latency.

## Runtime behavior

- `IntersectionObserver` starts each scene once at 24% visibility.
- An active scene pauses when it leaves the viewport.
- Pointer hover and keyboard focus may replay one complete scene after the first run.
- Touch replay is attached to `pointerdown` only when `pointerType` is `touch`.
- Animations use transforms, opacity, and stroke offset. They do not block links or delay application work.
- Illustration hosts reuse a single template per capability and avoid per-frame JavaScript.

At mobile widths, the illustration is cropped and repositioned independently from desktop composition. Text and actions retain their own column and are not covered by the figure.

## Reduced motion

When `prefers-reduced-motion: reduce` is active, the runtime does not create viewport choreography or replays. CSS resolves every scene into a static, legible pose; chart paths remain visible and core actions remain unchanged.

