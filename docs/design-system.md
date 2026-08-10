# FuelPhysique design system — Editorial Performance

Status: implementation source of truth for `design/complete-product-redesign-v1`.

## Principles

1. **The next action is the hero.** Pages lead with the user’s task, not decorative cards.
2. **Editorial rhythm over dashboard chrome.** Use columns, rules, spacing, and type hierarchy before containers.
3. **One accent.** Signal coral communicates primary action and active state. Status colors remain semantic and subordinate.
4. **Flat, durable surfaces.** No glassmorphism, glow, gradient-dependent hierarchy, or rounded-card sea.
5. **Data must scan.** Numeric content uses tabular figures, concise labels, and predictable alignment.
6. **Mobile is a recomposition.** Five primary destinations move into a fixed safe-area-aware bottom navigation; secondary tools remain in-page.

## Color tokens

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| Page | `#11110f` | `#f2eee6` | Primary canvas |
| Deep | `#090a09` | `#e6dfd3` | Navigation / recessed region |
| Surface | `#181816` | `#fffaf1` | Raised content only |
| Surface strong | `#22211e` | `#ffffff` | Modal and focused panels |
| Border | `#3a3832` | `#c8c0b3` | 1 px structure |
| Text | `#f4efe5` | `#191815` | Primary copy |
| Muted | `#aaa397` | `#625d55` | Secondary copy |
| Accent | `#ff5a3c` | `#d3351c` | Primary action / selected state |
| Success | `#8bbf79` | `#477f3a` | Confirmed state |
| Warning | `#d5a94e` | `#8c650d` | Warning state |
| Danger | `#e45c68` | `#b52939` | Destructive/error state |

Color is never the only state indicator.

## Typography

- Display: `Arial Narrow`, `Roboto Condensed`, `Impact`, sans-serif fallback stack; uppercase used only for short editorial headlines.
- UI/body: `Inter`, `Segoe UI`, `Arial`, sans-serif.
- Numeric: the body stack with `font-variant-numeric: tabular-nums`.
- Scale: 12 label, 14 metadata, 16 body/control, 20 section title, 28 page title, 48–72 display depending on viewport.
- Body line length: 45–75 characters; legal prose targets 68 characters.

## Spacing and geometry

- Base spacing unit: 4 px.
- Main steps: 4, 8, 12, 16, 24, 32, 48, 64.
- Control height: minimum 44 px; primary desktop actions 48 px.
- Radius: 0, 4, 6, 8 px. Pills are reserved for compact statuses only.
- Borders: 1 px by default, 2 px for explicit selection/focus.
- Shadows: modal elevation only; normal hierarchy uses surface contrast and rules.

## Core shell

Desktop exposes Dashboard, Workout Plans, Nutrition, Progress, and Messages in one sticky top rail. On protected pages, the page title and contextual actions sit below it.

At widths below 760 px:

- primary navigation becomes a fixed five-item bottom bar;
- the page receives safe-area bottom padding;
- content becomes one column;
- sidebars are hidden or converted to in-flow secondary navigation;
- primary actions remain reachable without horizontal scroll.

## Components

### Buttons

- Primary: accent fill, dark ink text, square/4 px radius.
- Secondary: transparent, 1 px border, light text.
- Tertiary: text/action arrow, no container unless focus/hover.
- Destructive: danger border or fill plus explicit verb.
- Disabled: lower contrast, no hover, `aria-disabled` or native disabled state.

### Forms

Labels are always visible. Inputs use one consistent height, border, focus ring, and inline help/error placement. Error copy explains how to recover. Long builders use editorial sections separated by rules rather than nested cards.

### Data and charts

Values are tabular. Chart series use the accent first, then semantic success/warning/danger where meaning requires it. Grid lines are low-contrast but visible. Tooltips use the strong surface and never obscure axis labels.

### Cards and lists

Use a card only when content is independently movable, selectable, or dismissible. Otherwise use a section, data row, or ruled list. Every card must have one dominant action and a predictable selected/empty/loading state.

### Modals and drawers

Modals are centered, width-constrained, and mobile-safe. Destructive confirmation names the action and consequence. Focus remains inside while open and returns to the invoker on close.

### Statuses

Status uses icon/label + color. Loading uses stable skeleton geometry. Empty states name the next useful action. Errors preserve user input whenever possible.

## Media

Use only existing FuelPhysique-owned or locally stored product media in the repository. Exercise demonstrations, meal images, and profile media retain their existing application paths. No third-party or generated replacement photography is introduced by the redesign.

## Accessibility and RTL

- WCAG AA contrast target for text and controls.
- Visible `:focus-visible` treatment on every interactive surface.
- Logical CSS properties support Hebrew RTL.
- Directional arrows mirror in RTL when they communicate flow.
- Touch targets are at least 44×44 px.
- Reduced motion removes non-essential transitions.
- Layout remains usable at 200% zoom and all required viewports.
