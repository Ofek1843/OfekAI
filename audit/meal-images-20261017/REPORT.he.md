# תמונות ארוחות והעדפת ארוחות מוכרות — 17.10.2026

נבדקו כל 165 הארוחות בקטלוג. ל־157 כבר הייתה תמונה מקומית; לשמונה הארוחות החסרות נוצרו תמונות אוכל. לכל שמונה נשמרו PNG מקורי ו־WebP מותאם לאתר בתיקייה `public/images/meals/`. כל 165 הקבצים נפתחו בהצלחה בבדיקת פענוח תמונה. בתפריט שמור ישן התמונה החדשה מוצגת לפי מזהה הארוחה בלי לשנות את פרטי המזון או הכמויות השמורים.

| מזהה הארוחה | תיאור התמונה | מקור התמונה שנוצרה |
| --- | --- | --- |
| `simple-soy-oats-banana` | קערת שיבולת שועל, חלב סויה ובננה | `exec-d1ad9713-9daf-493d-a03c-1ef1eb4be15d.png` |
| `simple-soy-oats-apple` | שיבולת שועל, חלב סויה, תפוח וחמאת בוטנים | `exec-36d37fa0-d1f5-4c49-9771-cbefe1d77b97.png` |
| `simple-peanut-banana-bread` | לחם מלא עם חמאת בוטנים, בננה וחלב סויה | `exec-8bcb32ab-45ce-4cf1-a9e0-8bed0cb90e1a.png` |
| `simple-tofu-hummus-pita` | פיתה עם טופו, חומוס ומלפפון | `exec-5e26de2b-8672-4d6f-81cb-c1c07877b681.png` |
| `simple-tofu-ready-rice` | אורז, טופו ומלפפון | `exec-89502352-be35-4358-ad80-3d1e37cd699c.png` |
| `simple-chickpea-tofu-salad` | חומוס, טופו, עגבנייה ולחם מלא | `exec-867003bf-0659-496b-97ef-79aba2074193.png` |
| `simple-bean-tofu-bread` | שעועית לבנה, טופו, עגבנייה ולחם מלא | `exec-7dafb9c2-b0fb-4673-83a6-6fb8ff21342d.png` |
| `simple-lentil-tofu-rice` | עדשים, טופו, אורז ומלפפון | `exec-6aea5c2c-c3f0-40c8-a474-3c48e8b10efb.png` |

קובצי המקור שנוצרו נמצאים ב־`C:/Users/ofek1/.codex/generated_images/01a13089-c405-70b0-9b1b-32b2cf12219b/`; שמות קובצי היעד זהים למזהי הארוחות לעיל. התמונות להמחשה ואינן מדידה של גודל מנה.

## שיטת יצירה והנחיות

נוצרו באמצעות הכלי המובנה `image_gen.imagegen` לפי מיומנות `imagegen`; כל נכס נוצר בקריאה נפרדת. הנחיית הסגנון לשבע התמונות של הארוחות הטבעוניות הייתה:

> Use case: photorealistic-natural. Asset: landscape meal photograph for a nutrition-planning app. Subject: [subject]. Exactly the foods described; do not add garnishes, sauces, animal products, extra vegetables or nuts. Pale warm neutral tabletop, soft natural daylight, everyday home meal, appetizing realistic food textures and modest simple plating, no extravagant restaurant decoration. Three-quarter overhead view, entire bowl or plate centered and visible with margin, suitable for 3:2 crop. No people, text, labels, logos or watermark. Illustrative photo, not a measured serving guide.

הנושא שהוצב לכל תמונה:

- `simple-soy-oats-banana`: a white ceramic bowl of soaked rolled oats in soy milk topped only with sliced banana
- `simple-soy-oats-apple`: a white ceramic bowl of soaked rolled oats in soy milk with diced apple and a spoonful of smooth peanut butter, no whole peanuts
- `simple-tofu-hummus-pita`: a pita pocket stuffed with plain ready-to-eat firm tofu cubes, hummus and sliced cucumber, on a white plate
- `simple-tofu-ready-rice`: a white plate with cooked white rice, plain ready-to-eat firm tofu cubes and fresh cucumber slices, lightly drizzled olive oil
- `simple-chickpea-tofu-salad`: a white plate with cooked chickpeas, plain ready-to-eat firm tofu cubes and chopped fresh tomato, with two whole wheat bread slices on the side
- `simple-bean-tofu-bread`: a white plate with cooked white beans, plain ready-to-eat firm tofu cubes and fresh tomato wedges, with two whole wheat bread slices on the side
- `simple-lentil-tofu-rice`: a white plate of cooked lentils and white rice, plain ready-to-eat firm tofu cubes and cucumber slices

הנחיה לתמונת הלחם, חמאת הבוטנים, הבננה וחלב הסויה:

> Use case: photorealistic-natural. Create a landscape food photograph for a meal-planning app: two slices of whole wheat bread spread with smooth peanut butter on a white ceramic plate, a peeled banana alongside, and one clear glass of soy milk. Exactly these foods, no other toppings, no nuts scattered, no meat or dairy packaging. Warm pale neutral tabletop, soft natural window light, realistic everyday home breakfast, appealing but not extravagant. Three-quarter overhead view, whole meal centered and fully visible with space around plate, suitable for 3:2 crop. No people, words, labels, logos, watermark. Image is illustrative, not a measured serving-size guide.

## בחירת ארוחות ובדיקות

הסימון `everyday-preferred` נותן קדימות רכה ל־39 ארוחות מוכרות. הוא משפיע על בחירת ברירת המחדל ועל רשימת המועמדים שמוצגת למחולל, אבל העדפת משתמש מפורשת, התאמה ליעדים והגבלות תזונה נשמרות. זאת בחירה מערכתית של ארוחות מוכרות, לא נתון סטטיסטי על פופולריות.

- 165/165 תמונות ארוחה מקומיות קיימות וניתנות לפענוח.
- 20 בדיקות ממוקדות עברו: כיסוי תמונות, תפריטים שמורים, העדפת ארוחות ואילוצי תזונה.
- בדיקה רחבה יותר: 41/42 עברו; הכישלון היחיד הוא בדיקת תרגום קיימת של קישור Messages בשפות הדשבורד, שאינה קשורה לשינוי הארוחות.
- `git diff --check` עבר.

השינויים נמצאים בעותק המקומי בלבד; לא בוצע פרסום לאתר החי.
