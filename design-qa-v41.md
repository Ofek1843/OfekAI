# FuelPhysique V4.1 design QA

## Visual truth

- Approved implementation source: the V4.1 athlete/scene modules already present at starting commit `dddf97b04cfede5bc64d554fe83937b321f3dde1`.
- Product constraints: preserve the existing FuelPhysique V4 layout, copy, interaction model, authentication flow, and functional routes; integrate the approved premium athletic scenes without introducing a sixth Dashboard card.
- Browser environment: local-only app at `http://127.0.0.1:3304`, Firebase Auth Emulator `127.0.0.1:9099`, Firestore Emulator `127.0.0.1:8080`, synthetic User A, device pixel ratio 1.

## Evidence

| State | Viewport | Evidence |
| --- | --- | --- |
| Landing hero / deadlift | 1440x900 | `.redesign-review/screenshots/final-deadlift-in-view-v41-1440x900.png` |
| Landing feature scenes | 1440x900 | `.redesign-review/screenshots/final-landing-scenes-v41-1440x900-settled.png` |
| Dashboard top | 1440x900 | `.redesign-review/screenshots/after-dashboard-v41-top-1440x900.png` |
| Dashboard bench scene | 1440x900 | `.redesign-review/screenshots/after-dashboard-bench-v41-1440x900.png` |
| Landing scenes / contained mobile hosts | 390x844 | `.redesign-review/screenshots/after-landing-v41-scenes-2-390x844.png` |
| Dashboard scenes / contained mobile hosts | 390x844 | `.redesign-review/screenshots/after-dashboard-scenes-contained-390x844.png` |
| Interactive comparison slider at 72% | 390x844 | `.redesign-review/screenshots/after-slider-interaction-final-390x844.png` |
| Dashboard Hebrew RTL | 390x844 | `.redesign-review/screenshots/after-dashboard-v41-he-390x844.png` |
| Landing Hebrew RTL | 390x844 | `.redesign-review/screenshots/after-landing-v41-he-390x844.png` |

Screenshots were captured after animation settling. Full-page stitched captures were excluded from final evidence because the browser compositor produced unreliable stitching; viewport evidence and DOM geometry were used instead.

## Findings and corrections

1. **P1 — stale illustration generation risk:** page query versions and the service-worker cache still referenced the older athletic-spectrum generation. Corrected to one `20260814-premium-v41` asset generation and `fuelphysique-v14-premium-v41` cache.
2. **P1 — approved bench scene had no host:** the existing Dashboard Progress card now hosts `benchPr`; Landing retains the scale-based progress scene. No card or route was added.
3. **P1 — mobile Dashboard grid collapse:** a legacy direct child with `grid-column: span 8` created implicit narrow tracks. The Dashboard content container now uses one explicit full-width track and constrains direct children to it.
4. **P2 — mobile illustration cropping:** negative inline offsets moved the Landing and Dashboard scenes outside their cards. Mobile offsets are now zero and every audited host remains within its card.
5. **P2 — iPhone install guidance obscured first paint:** instructional guidance is delayed six seconds, height-capped, scrollable, and keeps actions visible. Install behavior and eligibility are unchanged.

## Final comparison result

- Scene identity: exact approved V4.1 modules and markup are mounted for deadlift, training, nutrition, progress, bench press, coach, and social.
- Layout: no horizontal overflow or clipped core controls at 375x812, 390x844, 393x852, 430x932, 768x1024, or 1440x900.
- RTL: Landing and Dashboard passed at 390x844 in Hebrew; slider direction and scene containment remain correct.
- Interaction: the before/after slider updates one overlaid comparison from 50% to 72%; scenes are not stacked.
- Regression status: no visual blocker remains in the audited Landing, Dashboard, Auth, PWA, Social, voice, or music-link paths.

**Design QA: PASS**
