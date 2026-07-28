# Meal plate photos — what to generate

The nutrition builder serves complete meals from a curated catalog
(`lib/meal-catalog.js`) instead of letting the AI invent food lists.
Each meal needs one plate photo.

## Folder

```
public/images/meals/
```

Currently empty. Until a file exists the app shows a purple gradient card
with the meal name, so you can add photos gradually with nothing broken.

## Naming

`<meal-id>.jpg` — exactly the id in the checklist below, lowercase,
hyphenated. Example: `grilled-chicken-rice-broccoli.jpg`.

## What each photo should show

- The finished dish plated, shot from above or at a 45° angle.
- Every listed component visible on the plate — the ingredient list shown
  under the photo must match what is pictured.
- One consistent style across the whole set: same lighting, same plate or
  bowl family, same background. Mixed styles make the library look stitched
  together from stock photos.
- Landscape 4:3. The card crops to 4:3, so keep the food centred.

## Checklist — 75 meals

### Breakfast (23)

- [ ] `oats-banana-peanut-butter.jpg` — **Oatmeal with Banana & Peanut Butter** (דייסת שיבולת שועל עם בננה וחמאת בוטנים)
  - Base: 574 kcal · P25 C86 F17 · vegetarian · b12/vitaminD
  - On the plate: Oats (dry) 70g, Banana 110g, Peanut butter 20g, Milk (1%) 200g, Cinnamon 1g
- [ ] `greek-yogurt-granola-berries.jpg` — **Greek Yogurt, Granola & Berries** (יוגורט יווני עם גרנולה ופירות יער)
  - Base: 424 kcal · P27 C58 F10 · vegetarian · b12
  - On the plate: Greek yogurt (plain) 220g, Granola 45g, Blueberries 80g, Honey 12g
- [ ] `scrambled-eggs-toast-avocado.jpg` — **Scrambled Eggs, Toast & Avocado** (ביצים מקושקשות, טוסט ואבוקדו)
  - Base: 402 kcal · P23 C34 F21 · vegetarian · b12/vitaminD
  - On the plate: Eggs 100g, Whole wheat bread 60g, Avocado 60g, Tomato 80g
- [ ] `veggie-omelette-toast.jpg` — **Vegetable Omelette with Toast** (חביתת ירקות עם טוסט)
  - Base: 456 kcal · P31 C33 F24 · vegetarian · b12/vitaminD/iron
  - On the plate: Eggs 150g, Spinach 50g, Mushrooms 60g, Bell pepper 50g, Whole wheat bread 60g, Olive oil 6g
- [ ] `cottage-cheese-toast-tomato.jpg` — **Cottage Cheese Toast with Tomato** (טוסט קוטג׳ עם עגבנייה)
  - Base: 397 kcal · P29 C37 F15 · vegetarian · b12
  - On the plate: Cottage cheese (5%) 180g, Whole wheat bread 60g, Tomato 90g, Cucumber 80g, Olive oil 5g
- [ ] `protein-oats-berries.jpg` — **Protein Oats with Strawberries** (שיבולת שועל חלבונית עם תותים)
  - Base: 556 kcal · P44 C63 F16 · vegetarian · b12/vitaminD
  - On the plate: Oats (dry) 60g, Whey protein powder 30g, Strawberries 100g, Almond butter 15g, Milk (1%) 200g
- [ ] `shakshuka-pita.jpg` — **Shakshuka with Pita** (שקשוקה עם פיתה)
  - Base: 563 kcal · P29 C59 F25 · vegetarian · b12/vitaminD
  - On the plate: Eggs 150g, Tomato sauce 200g, Bell pepper 80g, Onion 60g, Olive oil 8g, Whole wheat pita 60g
- [ ] `tofu-scramble-toast.jpg` — **Tofu Scramble on Toast** (טופו מקושקש על טוסט)
  - Base: 514 kcal · P37 C36 F25 · vegan · iron
  - On the plate: Tofu (firm) 180g, Spinach 60g, Bell pepper 70g, Whole wheat bread 60g, Olive oil 8g
- [ ] `skyr-apple-walnut-bowl.jpg` — **Skyr Bowl with Apple & Walnuts** (קערת סקיר עם תפוח ואגוזי מלך)
  - Base: 376 kcal · P28 C40 F14 · vegetarian · b12
  - On the plate: Skyr (plain) 220g, Apple 130g, Walnuts 20g, Honey 12g, Cinnamon 1g
- [ ] `banana-oat-protein-smoothie.jpg` — **Banana Oat Protein Smoothie** (שייק בננה, שיבולת שועל וחלבון)
  - Base: 589 kcal · P45 C75 F15 · vegetarian · b12/vitaminD
  - On the plate: Banana 120g, Oats (dry) 45g, Whey protein powder 30g, Peanut butter 15g, Milk (1%) 250g
- [ ] `egg-white-veggie-wrap.jpg` — **Egg White & Vegetable Wrap** (טורטייה עם חלבוני ביצה וירקות)
  - Base: 508 kcal · P38 C53 F16 · vegetarian · iron/b12
  - On the plate: Egg whites 200g, Tortilla wrap 90g, Spinach 50g, Tomato 70g, Cheese 25g
- [ ] `cornflakes-milk-banana.jpg` — **Cornflakes with Milk & Banana** (קורנפלקס עם חלב ובננה)
  - Base: 504 kcal · P17 C92 F11 · vegetarian · b12/vitaminD
  - On the plate: Cornflakes 60g, Milk (1%) 250g, Banana 110g, Almonds 15g
- [ ] `avocado-toast-poached-eggs.jpg` — **Avocado Toast with Poached Eggs** (טוסט אבוקדו עם ביצים עלומות)
  - Base: 467 kcal · P23 C36 F28 · vegetarian · b12/vitaminD
  - On the plate: Whole wheat bread 60g, Avocado 80g, Eggs 100g, Tomato 70g, Olive oil 4g
- [ ] `quinoa-breakfast-bowl.jpg` — **Warm Quinoa Breakfast Bowl** (קערת קינואה חמה לבוקר)
  - Base: 477 kcal · P18 C71 F15 · vegetarian · iron/b12/vitaminD
  - On the plate: Quinoa (cooked) 180g, Milk (1%) 150g, Blueberries 80g, Almonds 20g, Honey 12g
- [ ] `salmon-cottage-open-sandwich.jpg` — **Salmon & Cottage Open Sandwich** (כריך פתוח עם סלמון וקוטג׳)
  - Base: 425 kcal · P35 C31 F17 · pescatarian · b12/vitaminD
  - On the plate: Salmon fillet 80g, Whole wheat bread 60g, Cottage cheese (5%) 100g, Cucumber 80g
- [ ] `vegan-oat-berry-bowl.jpg` — **Vegan Oat & Berry Bowl** (קערת שיבולת שועל טבעונית עם פירות יער)
  - Base: 595 kcal · P25 C86 F20 · vegan
  - On the plate: Oats (dry) 70g, Soy milk 220g, Raspberries 90g, Almond butter 18g, Dates 25g
- [ ] `vegan-oat-banana-tahini-bowl.jpg` — **Oat, Banana & Tahini Bowl** (קערת שיבולת שועל, בננה וטחינה)
  - Base: 672 kcal · P19 C112 F19 · vegan
  - On the plate: Oats (dry) 70g, Oat milk 220g, Banana 120g, Tahini 20g, Dates 25g
- [ ] `tofu-veggie-breakfast-bowl.jpg` — **Tofu & Roasted Vegetable Breakfast Bowl** (קערת בוקר טופו וירקות צלויים)
  - Base: 604 kcal · P34 C51 F32 · vegan · iron
  - On the plate: Tofu (firm) 180g, Sweet potato (cooked) 180g, Spinach 70g, Avocado 60g, Olive oil 8g
- [ ] `quinoa-berry-breakfast-vegan.jpg` — **Vegan Quinoa & Berry Breakfast** (ארוחת בוקר קינואה ופירות יער טבעונית)
  - Base: 451 kcal · P12 C88 F7 · vegan · iron
  - On the plate: Quinoa (cooked) 190g, Oat milk 180g, Blueberries 90g, Dates 30g, Cinnamon 1g
- [ ] `chickpea-scramble-potato.jpg` — **Chickpea Scramble with Potatoes** (חביתת חומוס עם תפוחי אדמה)
  - Base: 629 kcal · P25 C101 F16 · vegan · iron
  - On the plate: Chickpeas (cooked) 200g, Potato (cooked) 200g, Bell pepper 80g, Spinach 60g, Olive oil 10g
- [ ] `eggs-potato-spinach-skillet.jpg` — **Egg, Potato & Spinach Skillet** (מחבת ביצים, תפוח אדמה ותרד)
  - Base: 512 kcal · P27 C48 F26 · vegetarian · b12/vitaminD/iron
  - On the plate: Eggs 150g, Potato (cooked) 200g, Spinach 80g, Tomato 90g, Olive oil 10g
- [ ] `omelette-sweet-potato-avocado.jpg` — **Omelette with Sweet Potato & Avocado** (חביתה עם בטטה ואבוקדו)
  - Base: 574 kcal · P25 C49 F34 · vegetarian · b12/vitaminD
  - On the plate: Eggs 150g, Sweet potato (cooked) 180g, Avocado 70g, Tomato 80g, Olive oil 8g
- [ ] `greek-yogurt-fruit-honey.jpg` — **Greek Yogurt with Fruit & Honey** (יוגורט יווני עם פירות ודבש)
  - Base: 325 kcal · P25 C57 F1 · vegetarian · b12
  - On the plate: Greek yogurt (plain) 230g, Banana 110g, Blueberries 80g, Honey 15g

### Lunch (38)

- [ ] `grilled-chicken-rice-broccoli.jpg` — **Grilled Chicken, Rice & Broccoli** (חזה עוף בגריל, אורז וברוקולי)
  - Base: 644 kcal · P58 C66 F15 · omnivore · b12
  - On the plate: Chicken breast (grilled) 160g, White rice (cooked) 200g, Broccoli 140g, Olive oil 8g
- [ ] `chicken-sweet-potato-green-beans.jpg` — **Chicken, Sweet Potato & Green Beans** (עוף, בטטה ושעועית ירוקה)
  - Base: 573 kcal · P56 C55 F14 · omnivore · b12
  - On the plate: Chicken breast (grilled) 160g, Sweet potato (cooked) 220g, Green beans 130g, Olive oil 8g
- [ ] `salmon-quinoa-asparagus.jpg` — **Baked Salmon, Quinoa & Asparagus** (סלמון בתנור, קינואה ואספרגוס)
  - Base: 623 kcal · P41 C42 F31 · pescatarian · b12/vitaminD/iron
  - On the plate: Salmon fillet 150g, Quinoa (cooked) 180g, Asparagus 120g, Olive oil 8g
- [ ] `beef-rice-peppers.jpg` — **Beef, Rice & Sautéed Peppers** (בקר, אורז ופלפלים מוקפצים)
  - Base: 650 kcal · P46 C67 F21 · omnivore · b12/iron
  - On the plate: Lean ground beef (90%) 150g, White rice (cooked) 200g, Bell pepper 100g, Onion 60g, Olive oil 8g
- [ ] `turkey-pasta-tomato.jpg` — **Turkey Pasta in Tomato Sauce** (פסטה עם הודו ברוטב עגבניות)
  - Base: 586 kcal · P57 C66 F11 · omnivore · b12
  - On the plate: Turkey breast 150g, Whole wheat pasta (cooked) 200g, Tomato sauce 150g, Zucchini 100g, Olive oil 8g
- [ ] `tuna-pasta-salad.jpg` — **Tuna Pasta Salad** (סלט פסטה עם טונה)
  - Base: 529 kcal · P43 C64 F13 · pescatarian · b12/vitaminD
  - On the plate: Tuna (canned in water) 120g, Whole wheat pasta (cooked) 180g, Corn 70g, Tomato 100g, Olive oil 10g
- [ ] `chicken-couscous-roasted-veg.jpg` — **Chicken with Couscous & Roasted Vegetables** (עוף עם קוסקוס וירקות צלויים)
  - Base: 621 kcal · P59 C55 F17 · omnivore · b12
  - On the plate: Chicken breast (grilled) 160g, Couscous (cooked) 200g, Zucchini 100g, Bell pepper 90g, Olive oil 10g
- [ ] `tofu-stir-fry-brown-rice.jpg` — **Tofu Stir-Fry with Brown Rice** (טופו מוקפץ עם אורז מלא)
  - Base: 697 kcal · P39 C74 F29 · vegan · iron
  - On the plate: Tofu (firm) 200g, Brown rice (cooked) 200g, Broccoli 120g, Carrots 80g, Olive oil 10g
- [ ] `lentil-stew-rice.jpg` — **Lentil Stew with Rice** (תבשיל עדשים עם אורז)
  - Base: 677 kcal · P29 C116 F12 · vegan · iron
  - On the plate: Lentils (cooked) 250g, White rice (cooked) 180g, Carrots 90g, Onion 70g, Olive oil 10g
- [ ] `chickpea-curry-basmati.jpg` — **Chickpea Curry with Basmati** (קארי חומוס עם אורז בסמטי)
  - Base: 748 kcal · P30 C121 F17 · vegan · iron
  - On the plate: Chickpeas (cooked) 220g, Basmati rice (cooked) 200g, Spinach 80g, Tomato sauce 120g, Olive oil 10g
- [ ] `steak-potato-salad.jpg` — **Steak with Potatoes & Garden Salad** (סטייק עם תפוחי אדמה וסלט)
  - Base: 631 kcal · P47 C49 F29 · omnivore · b12/iron
  - On the plate: Beef steak 150g, Potato (cooked) 220g, Lettuce 60g, Tomato 90g, Olive oil 10g
- [ ] `cod-potato-broccoli.jpg` — **Baked Cod with Potato & Broccoli** (בקלה בתנור עם תפוח אדמה וברוקולי)
  - Base: 514 kcal · P49 C53 F13 · pescatarian · b12/vitaminD
  - On the plate: Cod fillet 180g, Potato (cooked) 220g, Broccoli 130g, Olive oil 10g
- [ ] `shrimp-garlic-pasta.jpg` — **Garlic Shrimp Pasta** (פסטה שרימפס ושום)
  - Base: 543 kcal · P50 C53 F15 · pescatarian · b12
  - On the plate: Shrimp 160g, Pasta (cooked) 200g, Zucchini 100g, Olive oil 12g
- [ ] `chicken-shawarma-pita.jpg` — **Chicken Shawarma Pita** (פיתה שווארמה עוף)
  - Base: 601 kcal · P50 C47 F23 · omnivore · b12/iron
  - On the plate: Chicken thigh (skinless) 150g, Whole wheat pita 60g, Hummus 60g, Cucumber 70g, Tomato 70g
- [ ] `beef-burrito-bowl.jpg` — **Beef Burrito Bowl** (קערת בוריטו בקר)
  - Base: 749 kcal · P54 C90 F22 · omnivore · b12/iron
  - On the plate: Lean ground beef (90%) 140g, Brown rice (cooked) 180g, Black beans (cooked) 100g, Corn 60g, Salsa 50g, Avocado 50g
- [ ] `tilapia-bulgur-salad.jpg` — **Tilapia with Bulgur Salad** (אמנון עם סלט בורגול)
  - Base: 516 kcal · P54 C45 F16 · pescatarian · b12
  - On the plate: Tilapia fillet 180g, Bulgur (cooked) 200g, Cucumber 90g, Tomato 90g, Olive oil 10g
- [ ] `turkey-club-sandwich.jpg` — **Turkey Club Sandwich** (כריך הודו)
  - Base: 544 kcal · P58 C42 F15 · omnivore · b12
  - On the plate: Turkey breast 130g, Whole wheat bread 90g, Lettuce 40g, Tomato 70g, Cheese 30g, Mustard 10g
- [ ] `seitan-noodle-stir-fry.jpg` — **Seitan Noodle Stir-Fry** (אטריות מוקפצות עם סייטן)
  - Base: 608 kcal · P51 C85 F14 · vegan · iron
  - On the plate: Seitan 160g, Whole wheat pasta (cooked) 190g, Cabbage 90g, Carrots 80g, Olive oil 10g
- [ ] `chicken-caesar-style-salad.jpg` — **Chicken Caesar-Style Salad** (סלט קיסר עם עוף)
  - Base: 586 kcal · P68 C17 F27 · omnivore · b12
  - On the plate: Chicken breast (grilled) 170g, Lettuce 120g, Parmesan 25g, Whole wheat bread 30g, Olive oil 12g
- [ ] `tempeh-quinoa-kale-bowl.jpg` — **Tempeh, Quinoa & Kale Bowl** (קערת טמפה, קינואה וקייל)
  - Base: 740 kcal · P46 C85 F29 · vegan · iron
  - On the plate: Tempeh 150g, Quinoa (cooked) 180g, Kale 80g, Sweet potato (cooked) 120g, Tahini 15g
- [ ] `egg-fried-rice-vegetables.jpg` — **Egg Fried Rice with Vegetables** (אורז מוקפץ עם ביצה וירקות)
  - Base: 702 kcal · P31 C86 F26 · vegetarian · b12/vitaminD
  - On the plate: Eggs 150g, White rice (cooked) 220g, Green peas 80g, Carrots 70g, Onion 50g, Olive oil 10g
- [ ] `salmon-sweet-potato-spinach.jpg` — **Salmon, Sweet Potato & Spinach** (סלמון, בטטה ותרד)
  - Base: 586 kcal · P37 C46 F28 · pescatarian · b12/vitaminD/iron
  - On the plate: Salmon fillet 150g, Sweet potato (cooked) 200g, Spinach 100g, Olive oil 8g
- [ ] `chicken-quinoa-mediterranean.jpg` — **Mediterranean Chicken Quinoa Bowl** (קערת קינואה ים תיכונית עם עוף)
  - Base: 610 kcal · P59 C47 F20 · omnivore · b12/iron
  - On the plate: Chicken breast (grilled) 160g, Quinoa (cooked) 190g, Cucumber 90g, Tomato 90g, Olive oil 10g
- [ ] `beef-lentil-chili-rice.jpg` — **Beef & Lentil Chili with Rice** (צ׳ילי בקר ועדשים עם אורז)
  - Base: 699 kcal · P54 C94 F12 · omnivore · b12/iron
  - On the plate: Lean ground beef (90%) 130g, Lentils (cooked) 150g, White rice (cooked) 180g, Tomato sauce 120g, Onion 60g
- [ ] `tuna-rice-avocado-bowl.jpg` — **Tuna, Rice & Avocado Bowl** (קערת טונה, אורז ואבוקדו)
  - Base: 546 kcal · P44 C65 F13 · pescatarian · b12/vitaminD
  - On the plate: Tuna (canned in water) 140g, Jasmine rice (cooked) 200g, Avocado 70g, Cucumber 80g
- [ ] `chicken-tortilla-wrap.jpg` — **Chicken Tortilla Wrap** (טורטייה במילוי עוף)
  - Base: 646 kcal · P61 C50 F21 · omnivore · b12
  - On the plate: Chicken breast (grilled) 150g, Tortilla wrap 90g, Lettuce 40g, Tomato 70g, Cheese 25g
- [ ] `mushroom-spinach-pasta.jpg` — **Mushroom & Spinach Pasta** (פסטה פטריות ותרד)
  - Base: 557 kcal · P29 C66 F23 · vegetarian · iron/b12
  - On the plate: Whole wheat pasta (cooked) 220g, Mushrooms 140g, Spinach 80g, Parmesan 30g, Olive oil 12g
- [ ] `baked-potato-cottage-cheese.jpg` — **Baked Potato with Cottage Cheese** (תפוח אדמה אפוי עם קוטג׳)
  - Base: 533 kcal · P28 C71 F17 · vegetarian · b12
  - On the plate: Potato (cooked) 280g, Cottage cheese (5%) 180g, Broccoli 120g, Olive oil 8g
- [ ] `black-bean-quinoa-bowl.jpg` — **Black Bean & Quinoa Bowl** (קערת שעועית שחורה וקינואה)
  - Base: 691 kcal · P31 C115 F15 · vegan · iron
  - On the plate: Black beans (cooked) 200g, Quinoa (cooked) 190g, Corn 70g, Bell pepper 80g, Avocado 60g, Salsa 50g
- [ ] `chicken-basmati-spinach.jpg` — **Chicken with Basmati & Spinach** (עוף עם אורז בסמטי ותרד)
  - Base: 636 kcal · P62 C54 F17 · omnivore · b12/iron
  - On the plate: Chicken breast (grilled) 170g, Basmati rice (cooked) 200g, Spinach 110g, Olive oil 10g
- [ ] `steak-bulgur-asparagus.jpg` — **Steak with Bulgur & Asparagus** (סטייק עם בורגול ואספרגוס)
  - Base: 612 kcal · P49 C45 F29 · omnivore · b12/iron
  - On the plate: Beef steak 150g, Bulgur (cooked) 210g, Asparagus 120g, Olive oil 10g
- [ ] `edamame-tofu-rice-bowl.jpg` — **Edamame & Tofu Rice Bowl** (קערת אורז עם אדממה וטופו)
  - Base: 735 kcal · P46 C75 F30 · vegan · iron
  - On the plate: Edamame 150g, Tofu (firm) 150g, Brown rice (cooked) 190g, Carrots 80g, Olive oil 8g
- [ ] `turkey-sweet-potato-hash.jpg` — **Turkey & Sweet Potato Hash** (מוקפץ הודו ובטטה)
  - Base: 554 kcal · P52 C57 F12 · omnivore · b12
  - On the plate: Turkey breast 160g, Sweet potato (cooked) 220g, Bell pepper 90g, Onion 60g, Olive oil 10g
- [ ] `kidney-bean-pasta-bake.jpg` — **Kidney Bean Pasta Bake** (פסטה אפויה עם שעועית אדומה)
  - Base: 665 kcal · P39 C105 F13 · vegetarian · iron/b12
  - On the plate: Kidney beans (cooked) 180g, Whole wheat pasta (cooked) 200g, Tomato sauce 150g, Mozzarella 50g
- [ ] `chicken-hummus-bowl.jpg` — **Chicken Hummus Bowl** (קערת חומוס עם עוף)
  - Base: 676 kcal · P61 C53 F24 · omnivore · b12
  - On the plate: Chicken breast (grilled) 150g, Hummus 100g, Whole wheat pita 60g, Cucumber 80g, Tomato 80g, Olive oil 8g
- [ ] `tofu-cauliflower-rice-curry.jpg` — **Tofu & Cauliflower Curry with Rice** (קארי טופו וכרובית עם אורז)
  - Base: 671 kcal · P37 C75 F26 · vegan · iron
  - On the plate: Tofu (firm) 180g, Cauliflower 150g, White rice (cooked) 190g, Tomato sauce 120g, Olive oil 10g
- [ ] `salmon-couscous-zucchini.jpg` — **Salmon with Couscous & Zucchini** (סלמון עם קוסקוס וקישואים)
  - Base: 627 kcal · P39 C50 F28 · pescatarian · b12/vitaminD
  - On the plate: Salmon fillet 150g, Couscous (cooked) 200g, Zucchini 120g, Olive oil 8g
- [ ] `chicken-potato-carrot-tray.jpg` — **Chicken, Potato & Carrot Tray Bake** (מגש אפייה עוף, תפוח אדמה וגזר)
  - Base: 659 kcal · P47 C55 F28 · omnivore · b12/iron
  - On the plate: Chicken thigh (skinless) 160g, Potato (cooked) 220g, Carrots 110g, Olive oil 10g

### Snack (14)

- [ ] `dates-tahini-oat-bites.jpg` — **Date & Tahini Oat Bites** (כדורי תמרים, טחינה ושיבולת שועל)
  - Base: 524 kcal · P14 C88 F17 · vegan
  - On the plate: Dates 70g, Tahini 25g, Oats (dry) 45g, Cinnamon 1g
- [ ] `banana-oat-energy-balls.jpg` — **Banana Oat Energy Balls** (כדורי אנרגיה בננה ושיבולת שועל)
  - Base: 450 kcal · P12 C98 F4 · vegan
  - On the plate: Oats (dry) 55g, Banana 120g, Dates 45g, Cinnamon 1g
- [ ] `greek-yogurt-honey-almonds.jpg` — **Greek Yogurt with Honey & Almonds** (יוגורט יווני עם דבש ושקדים)
  - Base: 279 kcal · P24 C24 F11 · vegetarian · b12
  - On the plate: Greek yogurt (plain) 200g, Honey 15g, Almonds 20g
- [ ] `rice-cakes-peanut-butter-banana.jpg` — **Rice Cakes with Peanut Butter & Banana** (פריכיות עם חמאת בוטנים ובננה)
  - Base: 340 kcal · P10 C50 F14 · vegan
  - On the plate: Rice cakes 27g, Peanut butter 25g, Banana 100g
- [ ] `cottage-cheese-fruit-bowl.jpg` — **Cottage Cheese & Fruit Bowl** (קערת קוטג׳ ופירות)
  - Base: 375 kcal · P25 C30 F19 · vegetarian · b12
  - On the plate: Cottage cheese (5%) 200g, Peach 130g, Walnuts 15g, Honey 10g
- [ ] `protein-shake-banana.jpg` — **Banana Protein Shake** (שייק חלבון בננה)
  - Base: 326 kcal · P33 C43 F4 · vegetarian · b12/vitaminD
  - On the plate: Whey protein powder 30g, Banana 120g, Milk (1%) 250g
- [ ] `hummus-veggie-sticks.jpg` — **Hummus with Vegetable Sticks** (חומוס עם מקלות ירקות)
  - Base: 305 kcal · P12 C44 F11 · vegan
  - On the plate: Hummus 100g, Carrots 100g, Cucumber 100g, Whole wheat pita 30g
- [ ] `apple-almond-butter.jpg` — **Apple Slices with Almond Butter** (פרוסות תפוח עם חמאת שקדים)
  - Base: 239 kcal · P6 C28 F14 · vegan
  - On the plate: Apple 160g, Almond butter 25g, Cinnamon 1g
- [ ] `tuna-rice-cakes.jpg` — **Tuna on Rice Cakes** (טונה על פריכיות)
  - Base: 275 kcal · P29 C25 F7 · pescatarian · b12/vitaminD
  - On the plate: Tuna (canned in water) 100g, Rice cakes 27g, Cucumber 70g, Olive oil 5g
- [ ] `dark-chocolate-nuts-fruit.jpg` — **Dark Chocolate, Nuts & Grapes** (שוקולד מריר, אגוזים וענבים)
  - Base: 330 kcal · P6 C41 F17 · vegan
  - On the plate: Dark chocolate 20g, Cashews 25g, Grapes 120g
- [ ] `skyr-berries-bowl.jpg` — **Skyr with Mixed Berries** (סקיר עם פירות יער)
  - Base: 238 kcal · P25 C34 F1 · vegetarian · b12
  - On the plate: Skyr (plain) 220g, Strawberries 90g, Blueberries 70g, Honey 10g
- [ ] `edamame-snack-bowl.jpg` — **Edamame Snack Bowl** (קערת אדממה)
  - Base: 262 kcal · P22 C16 F14 · vegan · iron
  - On the plate: Edamame 180g, Olive oil 5g
- [ ] `cheese-crackers-grapes.jpg` — **Cheese, Rice Cakes & Grapes** (גבינה, פריכיות וענבים)
  - Base: 348 kcal · P13 C44 F14 · vegetarian · b12
  - On the plate: Cheese 40g, Rice cakes 27g, Grapes 120g
- [ ] `chocolate-protein-oat-bites.jpg` — **Chocolate Protein Oat Bites** (כדורי שיבולת שועל וחלבון)
  - Base: 576 kcal · P36 C69 F20 · vegetarian
  - On the plate: Oats (dry) 50g, Whey protein powder 25g, Peanut butter 25g, Dates 30g, Dark chocolate 10g

## Notes

- Amounts above are the catalog baseline. The app scales portions to each
  user's calorie target, so the photo does not need to match grams exactly —
  it needs to match the *components*.
- Meals tagged `iron`, `b12` or `vitaminD` are served first to users who
  reported a matching diagnosed deficiency.
- The catalog covers every diet x allergy combination with at least three
  options per meal slot. If you add or remove meals, re-run the coverage
  check before shipping.
