# Automated plan safety policy — 2026-10-15

These are product operating constraints, not clinical validation or a promise of safety.

## Inputs and supported pathways

- Explicit suitability confirmation (`screeningStatus: "none"`) is required for generation and mutations. `review` refers for individual assessment. A missing response is not treated as “healthy”. Do not infer pregnancy, medication or recovery from gender.
- Workout generation currently supports ages 18–100 with no declared movement limitations. Free-text limitations/injuries require review rather than being silently ignored by generation, repair, reroll or volume adjustment. This does **not** mean resistance training is inherently inappropriate for young people or people with conditions: a qualified supervised pathway has not been implemented here. Viewing existing/manual plans remains available.
- Nutrition accepts explicitly supplied years, kg and cm, age 15–100, height 100–250 cm and mass 30–300 kg. These are syntactic operating bounds, not proof that the equation is appropriate throughout that space. Manual targets remain adult-only. Youth Mode requires guardian approval and carries a professional-supervision notice; it is not a weight-loss treatment.
- Mifflin–St Jeor adult coefficients are unchanged, but missing or unsupported coefficients/activity/goal cannot silently default. A person for whom these equations are unsuitable should obtain an individually measured/professionally assessed estimate.

## Energy and macro starting policy

The ordinary adult RMR/TDEE equations are unchanged. Fat loss uses the smaller of 15% of estimated maintenance and the existing 400 kcal adjustment cap (250 at age65+). Muscle gain uses the smaller of 10% and the existing 250 cap (150 at age65+). These percentages are **conservative product heuristics**, not published universally safe cutoffs. Targets still round to50 kcal, so the final adjustment can differ by up to25 kcal. Progress calibration has not been implemented; users are told to review trends professionally.

Adult BMI below18.5 is used only as a screening/referral trigger for automated weight loss, using [WHO's adult underweight classification](https://www.who.int/data/gho/data/indicators/indicator-details/GHO/prevalence-of-underweight-among-adults-bmi-18-%28crude-estimate%29-%28-%29). It does not diagnose malnutrition or REDs and is not applied as a child BMI threshold.

Nonfinite, nonpositive or negative-residual macro estimates are refused. If the ordinary protein rule exceeds35% of energy, this general-population tool requires individual review instead of forcing a plan. The adult AMDR upper boundary is a **review trigger, not a toxicity threshold**; some athletic contexts may justify higher proportions. See [National Academies AMDR discussion](https://www.nationalacademies.org/read/10872/chapter/7) and [ISSN protein position](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/). There is no universal female calorie cap, no sex-based workout volume multiplier, and no universal1200/1500 calorie safety floor.

## Model and data boundaries

- The nutrition model selects catalog IDs only. Its free-text name, description and notes are not published as advice. Mandatory localized notes come from code.
- Generated workout advice uses controlled effort cues and catalog identities. Unconstrained model loading/medication/nutrition notes are not authoritative. RIR must parse as a nonnegative number or ordered range; the operational working-set scale currently stops at10, not a physiological universal.
- Fat loss alone no longer shortens a prescribed longer rest or changes intentional strength reps. The model prompt matches that rule. Existing volume ranges remain planning heuristics; “safe ceiling” copy is replaced with product-cap wording.
- Ingredient allergens propagate to recipes and are checked again at output. Unknown or partially understood allergy text asks for clarification. Common English plural and Hebrew peanut forms, fish/eggs/shellfish, mustard/celery/lupin are covered. Brand ingredients and cross-contact remain unverified; generic catalog filtering is not an allergy-free certification.
- Alternative meal balancing freezes the other meals. A final interval check over the committed returned options proves every offered combination stays inside the existing calorie/macro tolerances. Some alternatives may be unavailable rather than falsely marked valid.
- The client saves an immutable, revalidated snapshot of the shown selection with exact ingredient totals. This is not a clinical signature or a Firestore authorization change.

## Still open before any clinical/adequacy claims

Independent ingredient-source IDs/versions, ambiguous raw/cooked states, brand/recipe yield validation, micronutrient completeness, individual recovery/energy availability and longitudinal calibration need further professional review. Generic notes disclose these limitations; they do not replace validation. No REDs diagnosis, drug changes or supplement doses are generated. The [2023 IOC statement and its2024 correction](https://bjsm.bmj.com/content/58/3/e4) must not be reduced to a single automatic calorie threshold.

Testing here uses isolated model/auth boundaries and local HTTP. No live model, production account, deployment or clinician-supervised outcome study was used. See the remediation report under `audit/scientific-safety-20261015/` for exact runs and baseline comparison.
