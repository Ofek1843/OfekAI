# Food-data review and migration

Status (2026-10-16): inventory complete; 12 explicit commodity identities now match pinned USDA SR Legacy records in both catalogs. 119/131 generator ingredients and 80/92 diary foods remain without matched external evidence. See `audit/source-validation-20261016/` for this batch and `audit/regression-recovery-20261016/` for the historical pre-migration inventory. No production values were changed or deployed.

## Implemented source batch

`data/food-reference-v1.json` pins raw tomato, cucumber with peel, spinach, carrots, peeled banana, avocado flesh, pear, strawberries, lemon without peel, apple with skin, regular/quick unfortified dry oats, and olive oil. `public/js/food-reference-data.mjs` is an exact browser mirror checked in tests. The explicit `carrot`/`carrots` mapping connects the two existing catalog ids; brands and counted packages are not remapped.

Each record carries its FDC id, exact source description, publication date, retrieval date, preparation, 100g edible-portion basis, source URL, composition version and record SHA256. The official SR Legacy JSON archive is pinned by SHA256. These are historical SR Legacy data, not a claim that all records are current Foundation analytical records. Source matching is numerical/identity traceability, not dietitian approval, clinical adequacy, allergen certification, exact cultivar or branded-product matching.

Generic regular/quick dry oats now use 379 kcal/100g consistently, replacing generator 389 and diary 375 prospectively. Quaker's separate legacy brand entry remains unchanged and unverified. Ingredient weights refer to the named state (dry/raw ingredients weighed before preparation where stated); no cooked yield, retention factor or raw-to-cooked gram equivalence has been inferred. Calories come from source energy, not forced 4/4/9 equality.

New diary entries and generated recipe rows retain the reference used. Save/reload/copy preserve it. Existing diary entries and saved plans are not rewritten: editing a diary quantity scales that entry's persisted composition, not the current catalog. Source descriptions and recipe suitability still need qualified professional review.

Reproduce the external-source integrity check after downloading/extracting the [official SR Legacy archive](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip):

```text
node scripts/verify-food-reference-source.js <official-zip> <extracted-json>
node scripts/audit-food-provenance.js --summary
node --test test/food-reference-data.test.mjs test/food-provenance.test.js test/daily-nutrition-store.test.mjs
```

The verifier is offline/read-only and checks archive/record hashes, exact identities, dates, nutrient identifiers, units and values. No API key is needed. `sourceMatched` deliberately replaces the misleading `verifiedExternalSources` inventory field. `--require-verified` remains a failing **source coverage** gate until all records have matched evidence; even a future green coverage gate would not certify clinical adequacy.

## Required evidence per canonical food

- Stable local id, exact English/Hebrew identity, variety and brand when relevant.
- Source provider, record/product id, direct record URL, release or revision, retrieval date and reviewer.
- Nutrient basis and units (100g edible portion versus serving); explicitly distinguish missing data from zero.
- Raw/cooked/dry/drained state, edible portion, preparation and recipe yield where applicable. A gram/millilitre conversion requires suitable density evidence; counted items/packages need measured or label-derived weights.
- Source calories and macros, plus available fiber and micronutrients. Preserve source values and calculation method; do not force 4/4/9 equality by fabricating numbers.
- Ingredient/allergen declaration and its limits. Generic composition is not a certification of brand ingredients or cross-contact absence.

USDA separates analytical Foundation Foods, dietary-study foods, legacy data and manufacturer-label Branded Foods: [data documentation](https://fdc.nal.usda.gov/data-documentation/). The [API guide](https://fdc.nal.usda.gov/api-guide/) describes stable record lookups and key handling. These are candidate source systems, not provenance for the existing catalog.

## Order of work

1. Review high-use ambiguous ingredients first, using `reviewPriority` in the inventory. 19 shared-id differences remain after this batch (26 in the historical inventory); identical ids do not prove identical preparation or product. 98 generator ingredients still lack an explicit preparation state.
2. Match an exact source identity and preserve its evidence. Confirm its preparation/units before assigning a value. Unresolved foods remain explicitly unverified.
3. For packaged Israeli products, obtain an identifiable current product label/record, including package weight. Do not treat an unspecified pack as one item or use a generic foreign brand as an exact match.
4. Introduce versioned canonical data, migrate both generators and diary prospectively, and test all portion conversions, allergens, totals, alternatives and saving again.
5. Preserve historical saved entries and plan snapshots with their original values/source version. Do not silently recalculate past diaries after a database update.
6. Have a qualified nutrition professional review assumptions and adequacy claims. Micronutrient coverage, clinical appropriateness and individual energy calibration are separate from matching database numbers.

## Completion gates

No missing source ids for foods claimed verified; all preparation and portion bases explicit; each cross-catalog difference reviewed; ingredient sums and every offered selection within documented tolerances; old snapshots unchanged; professional review recorded where required. Until then, `node scripts/audit-food-provenance.js --require-verified` must remain red.
