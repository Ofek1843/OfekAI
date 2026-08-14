# FuelPhysique V4.3 real-athlete prototype asset audit

## Source mapping

| Batch | Attachment | Scene | Semantic frame | Source dimensions | Format | Alpha |
|---|---:|---|---|---:|---|---|
| first | 1 | Deadlift | setup, bar near floor | 1280×853 | JPEG | no |
| first | 2 | Deadlift | early pull | 1066×1280 | JPEG | no |
| first | 3 | Deadlift | top lockout | 1066×1280 | JPEG | no |
| second | 1 | Deadlift | controlled descent, bar around thigh | 853×1280 | JPEG | no |
| second | 2 | Bench | top lockout | 1280×853 | JPEG | no |
| second | 3 | Bench | controlled descent | 1280×853 | JPEG | no |
| second | 4 | Bench | bottom position | 1280×853 | JPEG | no |
| second | 5 | Bench | mid press | 1280×853 | JPEG | no |
| second | 6 | Nutrition | utensil near meal | 1280×853 | JPEG | no |
| second | 7 | Nutrition | food lifted | 1280×853 | JPEG | no |
| second | 8 | Nutrition | food travelling toward mouth | 1280×853 | JPEG | no |
| second | 9 | Nutrition | bite | 1280×853 | JPEG | no |
| second | 10 | Nutrition | utensil returning | 1280×853 | JPEG | no |

All 13 supplied files are three-channel JPEGs on solid or near-solid white.
None has an alpha channel. The preparation script removes only pale pixels
connected to a canvas edge, then decontaminates a two-pixel JPEG matte. The
source JPEGs remain byte-preserved beneath each scene's `source/` directory.

## Sequence findings

- **Deadlift:** four distinct poses, but the setup is landscape while the
  other three are portrait. Camera, athlete, plate and bar scale differ
  materially. Alignment improves the baseline but cannot make the loop
  physically continuous. Regeneration is recommended from one locked camera.
- **Bench:** framing is broadly compatible. Source frame 03 puts the bar at
  the neck/face line rather than the lower chest and is omitted from default
  playback. It remains in source/normalized assets and the contact sheet.
- **Nutrition:** table, bowl and athlete are consistent enough for a clear
  five-pose eating action. The return frame changes posture slightly but keeps
  the table and meal baseline stable.

## Normalized outputs

Every derivative uses a transparent 960×720 canvas and WebP quality 88. Body
proportions are never stretched. Subjects are scaled proportionally, aligned
to scene-specific equipment/floor baselines, then translated with transparent
padding. See `manifest.json` for exact placement and byte totals.
