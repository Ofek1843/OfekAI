# FuelPhysique performance motion system

Status: implementation source of truth for the Athletic Spectrum / Illustrated V4 release.

## Principles

Motion communicates a change in training state. It should express effort, velocity, progression, repetition, recovery, completion, momentum, or performance. It must not exist simply because an element is visible.

1. **Effort compresses.** Pressed controls travel one pixel and compress to 98.5%, then settle quickly.
2. **Velocity has direction.** TRAIN and sent messages move forward; received messages establish from the opposite edge. RTL mirrors inline direction.
3. **Progression locks into place.** Exercise, meal, and plan rows enter in short sequences after real data arrives.
4. **Recovery is calm.** Rest state is represented by the real timer track, without shimmer, flashing, or fabricated progress.
5. **Completion earns emphasis.** Normal sets receive a short 360 ms resolve. Workout completion and genuine milestones may use the 900 ms moment tier.
6. **Truth before theatre.** No fake generation percentages, fake waveform, invented chart values, or delayed response is introduced.

## Tokens

| Tier | Token | Duration | Use |
| --- | --- | ---: | --- |
| Instant | `--motion-instant` | 80 ms | Pressed state and immediate feedback |
| Micro | `--motion-fast` | 160 ms | Hover, focus, toggle, checkbox, compact confirmation |
| Interface | `--motion-standard` | 280 ms | Tabs, selection, sheets, composer, dynamic rows |
| Content | `--motion-slow` | 560 ms | Metric, chart, section, and result reveal |
| Moment | `--motion-moment` | 900 ms | Workout completion, plan completion, real milestone |

Illustrated V4 adds an **Illustrative** category for one complete physical or explanatory action. Its 1400-2400 ms durations are centralized in `public/css/illustrated-v4.css`; the figure construction, triggers, viewport pause, touch replay, and reduced-motion behavior are documented in `docs/illustration-motion-system.md`.

All durations sit inside the required bands: micro 50–180 ms, interface 180–350 ms, content 300–700 ms, and moment 600–1400 ms.

## Easing

- `--ease-effort`: controlled acceleration and deceleration for opacity and state changes.
- `--ease-velocity`: quick launch with a clean stop for directional movement.
- `--ease-recovery`: calm, even settling for rest and sustained state.
- `--ease-settle`: slight, bounded overshoot for physical selection and completion. It never becomes elastic or cartoon-like.

## Journey choreography

### Landing

- Wordmark establishes first.
- The first-party athlete illustration assembles once through a clipped vertical reveal.
- CTA locks last.
- TRAIN moves along the inline training direction, FUEL expands from its baseline, TRACK reveals like a data trace, and CONNECT enters from the response direction. The four concepts deliberately do not share one generic fade-up.

### Navigation and dashboard

- Active navigation uses a 3 px Ultramarine rule and weight state, never a blue pill or glow.
- Dashboard title remains immediate. Primary workout context establishes before supporting metrics; supporting activity follows.
- Integer metrics interpolate only when visible or when their real value changes. The final value is exposed as the accessible name throughout the transition. Decimal values are not fabricated.
- Capability illustrations perform one bounded rep or explanatory sequence on first viewport entry, may replay once on hover/focus/touch, and pause offscreen.

### Workout

- Wizard selection compresses and settles around the real selected control.
- Existing Muscle Focus regions receive one bounded activation when selected.
- Generated exercise rows assemble in 45 ms increments after the real result reaches the DOM. No backend stage or percentage is invented.
- Set completion resolves in 360 ms, then the existing active-set logic identifies the next set.
- Rest uses the actual `--rest-progress` value and disables the old looping shimmer/pulse.
- Workout completion uses the moment tier without confetti.

### Nutrition

- Target/summary structure establishes from the macro baseline.
- Meal rows animate only when actually added or loaded.
- Macro values update from their previous real integer value. Bars preserve their real DOM values.

### Progress

- Chart containers reveal once when visible without mutating source data or SVG points.
- Real metric changes receive a short lock state.
- Existing real PR/completion surfaces may use the moment tier; no synthetic milestone is created.

### Social and voice

- Sent and received messages use opposing 12 px directions; RTL mirrors reading direction.
- Friend, shared-artifact, and conversation surfaces use the interface/content tiers.
- Recording motion is limited to the real recording indicator. Audio controls remain native and no fake waveform is rendered.
- The Social capability illustration exchanges only generic message/workout/music shapes; it never mirrors private conversation content.

### Forms and authentication

- Authentication and legal forms use one calm content entrance. Validation stays immediate and is never delayed by motion.
- Modals/sheets use a short 14 px settle and remain interactive throughout.

## Runtime and performance

- CSS transforms, opacity, and clip paths carry primary choreography.
- `IntersectionObserver` triggers content only as it becomes visible.
- `MutationObserver` attaches motion only to real newly inserted workout, meal, plan, history, and message rows.
- `requestAnimationFrame` is limited to real integer metric interpolation and class synchronization.
- A 1.6 second visibility safety net ensures a suspended observer can never leave content hidden.
- No third-party motion runtime, permanent decorative loop, animated gradient, blur animation, or page-transition screen is used.

## Reduced motion

`prefers-reduced-motion: reduce` is mandatory and functional:

- the runtime does not enable IntersectionObserver choreography or metric counting;
- all targets remain visible in their final state;
- transforms and clip reveals are removed;
- transitions/animations resolve in 0.01 ms with one iteration;
- the recording indicator remains a stable truthful state;
- navigation, forms, timers, chat, modals, and every core action remain usable.
