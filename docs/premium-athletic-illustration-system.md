# FuelPhysique Premium Athletic Illustration System (V4.1)

The V4 illustrations proved the *motion* idea. They failed on *drawing*: a
circle head, a quadrilateral torso and polyline limbs read as a wire diagram,
and several scenes were only identifiable because of the heading next to them.

V4.1 keeps the V4 motion infrastructure unchanged (IntersectionObserver,
one-shot finite runs, offscreen pause, reduced-motion) and replaces the
illustration language underneath it.

Implementation: `public/js/athlete-figure.js`.

---

## 1. The rule that drives everything

**Silhouette first.** If the figure is filled black and shrunk to 120px wide,
the action must still be identifiable. Detail that does not survive that test
is not added. More SVG nodes is not the goal; a readable pose is.

---

## 2. Proportion table

`HEAD` is the module. A standing athlete is ~7.4 HEAD — athletic, not
heroic (8+) and not childlike (6).

| Part | Units | Note |
|---|---|---|
| Cranium height | 22 | |
| Cranium width | 17 | Narrower than tall — never a circle |
| Neck | 7 | Short and thick; a thin neck reads fragile |
| Shoulder width | 46 | ≈2.7 head widths |
| Chest width | 40 | Lat sweep sits at 42% of torso length |
| Waist width | 27 | **The taper is what reads as "trained"** |
| Pelvis width | 33 | Hips must be visible, or the figure reads as a tube |
| Torso (shoulder→hip) | 52 | |
| Upper arm / forearm | 33 / 31 | |
| Thigh / shin | 42 / 38 | |

## 3. Limb construction — filled, not stroked

Every arm and leg segment is a **tapered filled capsule** produced by one
primitive, `seg(x1,y1,x2,y2,w1,w2)`, which builds a path with rounded joint
caps. Half-widths step down distally:

| Segment | Proximal → distal |
|---|---|
| Upper arm | 7.4 → 5.4 |
| Forearm | 5.4 → 3.9 |
| Thigh | 11.2 → 7.6 |
| Shin | 7.6 → 4.6 |

Consequences that matter: limbs have mass; the rounded caps *are* the joints,
so elbows and knees are visible without drawing them; and one path per segment
keeps the node cost close to the old stroke version.

## 4. Anatomy language

- **Head** — cranium with a jaw taper and a slight facing bias. No face, no
  features. Direction comes from the jaw, which is most of what tells a viewer
  the figure is *doing* something.
- **Torso** — a single filled path: shoulder yoke → lat sweep (42%) → waist
  (72%) → pelvis. Drawn between the shoulder point and the hip point, so it
  re-derives correctly for any torso angle.
- **Hands** — a rounded mitt oriented along the forearm. Grip is abstracted,
  never fingers. The mitt must visibly *overlap* the bar, never touch it.
- **Feet** — a wedge with a facing direction, never a line end.

## 5. Joint model

Nested kinematic groups, each carrying an explicit `transform-origin` at the
joint:

```
fa-athlete
  fa-leg (origin = hip)
    fa-shin-group (origin = knee)
  fa-body (origin = pelvis)
    torso, neck, head
  fa-arm (origin = shoulder)
    fa-forearm-group (origin = elbow)
```

Motion rotates these groups. **A whole figure is never rotated as one piece** —
that is what made V4 movement look mechanical. Because arms are nested inside
`fa-body`, an arm that must stay vertical while the torso rises counter-rotates
by the torso's delta, which is exactly how a real pull looks.

## 6. Depth

Flat vector only. Permitted, in order of preference:

1. **Overlap** — far-side limbs are emitted before the body, near-side after,
   so the body occludes them.
2. **Two plane tones** — `fa-*--far` sits on a darker/softer plane tone.
3. **Equipment occlusion** — plates in front of, or behind, the shin.

Forbidden: glow, glass, blur, 3D, neon. (The V4 token test also fails the
build on any gradient.)

## 7. Domain colour

The body stays neutral. Domain colour carries **equipment, the working limb,
and one accent mark** — never the whole figure, which would read as a mascot.

| Domain | Colour |
|---|---|
| Training | `#315BFF` |
| Nutrition | `#F0A326` |
| Progress | `#7957E8` |
| Coach | `#1FA978` |
| Social | `#D94F82` |

## 8. Equipment language

Shared primitives so a barbell is the same object in every scene: bar as a
capped bar path, plates as rounded rects in two depths (outer + inner) to
imply plate stacking without drawing ten circles. Dumbbell is the same
grammar at 40% scale.

## 9. Motion vocabulary

Movements are phrased as **LOAD → EFFORT → CONTROL → LOCKOUT → RECOVERY**,
with asymmetric easing: effort is slower than recovery, because a lift that
returns at the same speed it rose looks weightless.

No cartoon bounce, no overshoot on a loaded joint.

## 10. Mobile composition rule

Mobile is not a scaled desktop SVG. Below 640px the scenes re-frame: the
athlete occupies a larger share of the canvas, background furniture (charts,
boards, macro marks) reduces or drops, and the action limb stays inside the
centre 70% of the canvas so it is never cropped by card padding.

## 11. Acceptance test

For every scene, hide the heading and description. A viewer must identify the
activity in ~1 second. If not, the scene is redrawn — not relabelled.
