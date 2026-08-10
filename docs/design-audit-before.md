# FuelPhysique visual audit — before redesign

Audit date: 2026-08-10
Audited release: `b6bee85d5082f249c1569177db21206761a16cfd`
Environment: isolated local app (`127.0.0.1:3304`) with local-only Auth and Firestore emulators and synthetic users.

## Evidence

Baseline screenshots are stored in `outputs/complete-redesign/before/`. The route matrix was captured at 1440×900, 768×1024, 430×932, and 390×844. Representative contact sheets are:

- `outputs/complete-redesign/before/contact-sheet-1440.png`
- `outputs/complete-redesign/before/contact-sheet-390.png`

No production Firebase data or real user data was used.

## Executive findings

1. **The product has no single visual grammar.** Landing, dashboard, builders, Social, Settings, pricing, and legal pages each use different spacing, corner, type, navigation, and surface conventions.
2. **Mobile is not a true responsive composition.** At 390 px, authentication content can render completely outside the viewport, while the dashboard keeps a desktop sidebar and pushes the primary content to the right.
3. **Hierarchy is card-led instead of task-led.** Large rounded panels, pills, gradients, and glows compete with the user’s actual next action.
4. **Navigation changes by route.** The five core destinations are not consistently visible, and protected routes rely on a mix of sidebars, back links, page-specific top bars, and browser history.
5. **The palette obscures product categories.** Blue, teal, green, gold, purple, and cyan accents carry inconsistent meanings; the strong blue glow treatment reduces editorial clarity.
6. **Typography lacks a product-wide scale.** Oversized builder headings, tiny navigation labels, legal copy, and data values do not share a predictable hierarchy.
7. **Settings is visually detached from the rest of the app.** It uses a bright white modal-like surface inside a dark product and becomes especially narrow on mobile.
8. **Legal pages are readable but isolated.** They use a separate header, inconsistent content widths, and weak cross-linking to product/account contexts.

## Route inventory

| Route | Primary purpose | Current shell | Priority finding |
| --- | --- | --- | --- |
| `/index.html` | Marketing and entry | Landing header | Strong headline, but gradient/glow-heavy and visually disconnected from product |
| `/auth.html` | Email/Google auth and consent | Standalone auth | Blocking 390 px horizontal displacement; form becomes invisible |
| `/auth-action.html` | Auth action completion | Standalone panel | Utility state needs shared status language |
| `/dashboard.html` | Daily command center | Left sidebar | Desktop-only shell causes severe mobile overflow |
| `/app.html` | AI coach and Settings | Coach shell/modal | Settings style conflicts with dark product; dense mobile layout |
| `/workout-builder.html` | Generated plan builder | Builder top bar | Long form has strong content but oversized steps and card repetition |
| `/manual-workout-builder.html` | Manual plan creation | Back-link shell | Form density and repeated nested cards weaken scanability |
| `/my-workout-plans.html` | Saved workout plans | Back-link shell | Plan management is disconnected from builder navigation |
| `/workout-tracker.html` | Active workout | Back-link shell | Core task is clear; action hierarchy and time controls need consolidation |
| `/log-workout.html` | Past workout logging | Back-link shell | Form needs shared field rhythm and destructive-state language |
| `/workout-history.html` | Workout history | Back-link shell | Dense records lack editorial grouping and mobile prioritization |
| `/exercise-progress.html` | Per-exercise analytics | Back-link shell | Chart/data hierarchy differs from main Progress experience |
| `/nutrition-builder.html` | Generated nutrition builder | Builder top bar | Large imagery dominates functional selection; progress steps repeat workout builder inconsistently |
| `/manual-nutrition-builder.html` | Manual nutrition planning | Back-link shell | Wide desktop composition clips on mobile; controls are too card-heavy |
| `/my-nutrition-plans.html` | Saved nutrition plans | Back-link shell | Needs the same collection pattern as workout plans |
| `/progress.html` | Body metrics and charts | Back-link shell | Sparse first state and chart surfaces need clearer measurement hierarchy |
| `/transformation-submit.html` | Transformation submission | Standalone form | Needs shared upload, consent, and status patterns |
| `/running.html` | Running tools | Standalone content | Navigation and data conventions differ from training tools |
| `/social.html` | Friends, chat, sharing | Social-specific shell | Functional identity is strong but navigation and mobile split panes are inconsistent |
| `/leaderboard.html` | Community ranking | Standalone board | Needs privacy-aware status and table language from Social |
| `/leaderboard-admin.html` | Ranking administration | Admin shell | Must remain visually distinct while using shared fields/tables |
| `/pricing.html` | Plan comparison | Marketing nav | Attractive content, but old gradients/pills and product naming diverge |
| `/billing-result.html` | Billing outcome | Standalone status | Needs shared success/error status component |
| `/terms.html` | Terms and health disclaimer | Legal shell | Readable but too narrow/isolated; cross-links need consistency |
| `/privacy.html` | Privacy notice | Legal shell | Same legal-shell inconsistency |
| `/community-guidelines.html` | Community rules | Legal shell | Good hierarchy; inconsistent header and content width |
| `/copyright.html` | Copyright/IP | Legal shell | Same legal-shell inconsistency |
| `/accessibility.html` | Accessibility statement | Legal shell | Same legal-shell inconsistency |
| `/subprocessors.html` | Subprocessor disclosure | Legal shell | Tables need shared responsive treatment |
| `/subscription-policy.html` | Subscription policy | Legal shell | Same legal-shell inconsistency |
| `/refund-policy.html` | Refund policy | Legal shell | Same legal-shell inconsistency |
| `/contact.html` | Contact and support | Marketing utility | Needs shared public header/form language |
| `/faq.html` | Product help | Marketing utility | Needs clearer task-based grouping and accordion rhythm |

## Severity-ranked issues

### Blocking

- Auth layout can place the entire interactive panel outside a 390×844 viewport.
- Dashboard mobile keeps the desktop sidebar and creates horizontal overflow that hides core actions.

### High

- Core navigation is route-specific rather than product-wide.
- Multiple pages use layout widths that exceed small mobile viewports.
- Fixed and floating elements compete with form actions and content near the mobile safe area.
- Focus, selected, disabled, error, empty, and loading states are styled inconsistently.

### Medium

- Card, pill, glow, gradient, radius, and shadow usage is excessive.
- Category colors are not semantic enough to be relied upon.
- Data values do not use a consistent tabular style.
- Legal/public pages do not feel like part of the same product.

## Three visual directions

| Direction | Product fit | Accessibility | Responsive translation | Distinctiveness | Overall |
| --- | ---: | ---: | ---: | ---: | ---: |
| Editorial Performance | 9.5 | 9.0 | 9.0 | 9.5 | **9.3** |
| Modern Training Journal | 8.7 | 9.2 | 8.3 | 9.1 | 8.8 |
| Precision Athletic System | 9.1 | 8.8 | 8.7 | 8.8 | 8.9 |

Selected direction: **Editorial Performance**. It best supports the existing navigation depth, high-information training workflows, photography already owned by FuelPhysique, and a compact five-destination mobile navigation without becoming a generic SaaS dashboard.

Direction images are preserved in `outputs/complete-redesign/directions/`.
