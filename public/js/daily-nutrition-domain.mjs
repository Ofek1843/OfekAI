const round = (value, precision = 1) => {
  const factor = 10 ** precision;
  return Math.round((Number(value) || 0) * factor) / factor;
};

// Generic foods are canonical, representative references rather than arbitrary
// branded records. Values are stored per 100 g of edible food unless a counted
// unit is explicitly part of the food definition. Commodity references follow
// the FoodData Central 100 g edible-portion model; cooked foods are named as
// cooked so a normal "what I ate" entry does not silently use a raw value.
const FOOD_CATALOG = Object.freeze([
  { id: "oats", name: { en: "Oats (generic, dry)", he: "שיבולת שועל (גנרית, יבשה)" }, aliases: ["oats", "oatmeal", "rolled oats", "porridge oats", "שיבולת שועל", "שיבולת שועל יבשה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 375, protein: 13.2, carbs: 67.7, fat: 6.5 }, reference: { source: "curated generic commodity reference", ediblePortion: true, state: "dry", policy: "representative-not-brand" } },
  { id: "oats-quaker-original", name: { en: "Quaker original oats", he: "שיבולת שועל קוואקר מקורית" }, aliases: ["quaker original oats", "quaker oats", "שיבולת שועל קוואקר", "קוואקר מקורי"], baseAmount: 100, baseUnit: "g", specificity: "brand", macros: { calories: 375, protein: 12.5, carbs: 67.5, fat: 7.5 }, reference: { source: "known-product reference", ediblePortion: true, state: "dry", policy: "specific-product" } },
  { id: "cottage-3", name: { en: "Cottage cheese 3%", he: "קוטג׳ 3%" }, aliases: ["cottage cheese 3%", "cottage 3%", "3% cottage", "קוטג 3%", "קוטג׳ 3%", "קוטג", "קוטג׳", "cottage", "cottage cheese"], baseAmount: 100, baseUnit: "g", macros: { calories: 84, protein: 11.5, carbs: 3, fat: 3 } },
  { id: "cottage-5", name: { en: "Cottage cheese 5%", he: "קוטג׳ 5%" }, aliases: ["cottage cheese 5%", "cottage 5%", "5% cottage", "קוטג 5%", "קוטג׳ 5%", "קוטג", "קוטג׳", "cottage", "cottage cheese"], baseAmount: 100, baseUnit: "g", macros: { calories: 100, protein: 11.5, carbs: 3, fat: 5 } },
  { id: "rice-cake", name: { en: "Rice cake", he: "פריכית אורז" }, aliases: ["rice cake", "rice cakes", "פריכית", "פריכיות", "פריכית אורז", "פריכיות אורז"], baseAmount: 1, baseUnit: "item", gramsPerItem: 9, macros: { calories: 35, protein: 0.7, carbs: 7.3, fat: 0.3 }, reference: { source: "generic plain rice cake (~9 g each)", ediblePortion: true, state: "ready-to-eat" } },
  { id: "protein-drink", name: { en: "Protein drink", he: "משקה חלבון" }, aliases: ["protein drink", "protein shake", "protein bottle", "משקה חלבון", "שייק חלבון"], baseAmount: 1, baseUnit: "item", gramsPerItem: 330, specificity: "generic", macros: { calories: 160, protein: 25, carbs: 8, fat: 3 }, reference: { source: "internal representative generic protein drink (~330 ml)", ediblePortion: true, state: "ready-to-drink", policy: "representative-not-brand" } },
  { id: "protein-bar", name: { en: "Protein bar (average)", he: "חטיף חלבון (ממוצע)" }, aliases: ["protein bar", "protein bars", "protein snack bar", "חטיף חלבון", "חטיפי חלבון", "חטיף חלבונים", "חטיף פרוטאין"], baseAmount: 1, baseUnit: "item", gramsPerItem: 60, specificity: "generic", macros: { calories: 220, protein: 20, carbs: 22, fat: 8 }, reference: { source: "internal representative generic protein bar (~60 g)", ediblePortion: true, state: "ready-to-eat", policy: "representative-not-brand" } },
  { id: "high-protein-yogurt", name: { en: "High-protein yogurt", he: "יוגורט חלבון" }, aliases: ["high protein yogurt", "protein yogurt", "יוגורט חלבון", "יוגורט פרו"], baseAmount: 1, baseUnit: "item", gramsPerItem: 200, macros: { calories: 150, protein: 20, carbs: 12, fat: 2 }, reference: { source: "internal representative high-protein yogurt cup (~200 g)", ediblePortion: true, state: "ready-to-eat" } },
  { id: "banana", name: { en: "Banana", he: "בננה" }, aliases: ["banana", "bananas", "בננה", "בננות"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 }, reference: { source: "generic raw edible portion", ediblePortion: true, state: "raw" } },
  { id: "apple", name: { en: "Apple", he: "תפוח" }, aliases: ["apple", "apples", "תפוח", "תפוחים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2 }, reference: { source: "generic raw edible portion", ediblePortion: true, state: "raw" } },
  { id: "pomegranate", name: { en: "Pomegranate", he: "רימון" }, aliases: ["pomegranate", "pomegranates", "pomegranate arils", "pomegranate seeds", "רימון", "רימונים", "גרגרי רימון", "זרעי רימון"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 83, protein: 1.7, carbs: 18.7, fat: 1.2 }, reference: { source: "generic raw pomegranate arils, edible portion", ediblePortion: true, state: "raw" } },
  { id: "lemon", name: { en: "Lemon", he: "לימון" }, aliases: ["lemon", "lemons", "לימון", "לימונים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 29, protein: 1.1, carbs: 9.3, fat: 0.3 }, reference: { source: "generic raw lemon, edible portion", ediblePortion: true, state: "raw" } },
  { id: "cucumber", name: { en: "Cucumber", he: "מלפפון" }, aliases: ["cucumber", "cucumbers", "מלפפון", "מלפפונים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1 }, reference: { source: "generic raw edible portion", ediblePortion: true, state: "raw" } },
  { id: "avocado", name: { en: "Avocado", he: "אבוקדו" }, aliases: ["avocado", "avocados", "אבוקדו"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 160, protein: 2, carbs: 8.5, fat: 14.7 }, reference: { source: "generic raw edible portion", ediblePortion: true, state: "raw" } },
  { id: "walnuts", name: { en: "Walnuts", he: "אגוזי מלך" }, aliases: ["walnut", "walnuts", "walnut halves", "אגוז מלך", "אגוזי מלך", "אגוזים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 654, protein: 15.2, carbs: 13.7, fat: 65.2 }, reference: { source: "generic raw walnuts, edible portion", ediblePortion: true, state: "raw" } },
  { id: "almonds", name: { en: "Almonds", he: "שקדים" }, aliases: ["almond", "almonds", "שקד", "שקדים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9 }, reference: { source: "generic raw almonds, edible portion", ediblePortion: true, state: "raw" } },
  { id: "cashews", name: { en: "Cashews", he: "אגוזי קשיו" }, aliases: ["cashew", "cashews", "קשיו", "אגוז קשיו", "אגוזי קשיו"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 553, protein: 18.2, carbs: 30.2, fat: 43.9 }, reference: { source: "generic dry-roasted cashews, edible portion", ediblePortion: true, state: "ready-to-eat" } },
  { id: "pistachios", name: { en: "Pistachios", he: "פיסטוקים" }, aliases: ["pistachio", "pistachios", "פיסטוק", "פיסטוקים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 562, protein: 20.2, carbs: 27.2, fat: 45.4 }, reference: { source: "generic shelled pistachios, edible portion", ediblePortion: true, state: "ready-to-eat" } },
  { id: "peanuts", name: { en: "Peanuts", he: "בוטנים" }, aliases: ["peanut", "peanuts", "בוטן", "בוטנים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 567, protein: 25.8, carbs: 16.1, fat: 49.2 }, reference: { source: "generic dry-roasted peanuts, edible portion", ediblePortion: true, state: "ready-to-eat" } },
  { id: "peanut-butter", name: { en: "Peanut butter", he: "חמאת בוטנים" }, aliases: ["peanut butter", "natural peanut butter", "חמאת בוטנים", "חמאת בוטנים טבעית"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 588, protein: 25, carbs: 20, fat: 50 }, reference: { source: "generic smooth peanut butter", ediblePortion: true, state: "ready-to-eat" } },
  { id: "dates", name: { en: "Dates", he: "תמרים" }, aliases: ["date", "dates", "תמר", "תמרים", "מג'הול", "מג׳הול", "תמר מג'הול", "תמר מג׳הול"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 277, protein: 1.8, carbs: 75, fat: 0.2 }, reference: { source: "generic dried dates, edible portion", ediblePortion: true, state: "ready-to-eat" } },
  { id: "date-syrup", name: { en: "Date syrup (silan)", he: "סילאן (סירופ תמרים)" }, aliases: ["date syrup", "silan", "date honey", "date molasses", "סילאן", "סילן", "דבש תמרים", "סירופ תמרים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 318, protein: 1.2, carbs: 77.5, fat: 0.4 }, reference: { source: "representative date-syrup composition; Al Barakah Dates product specification (2025)", ediblePortion: true, state: "ready-to-eat", policy: "representative-not-brand" } },
  { id: "sweet-potato", name: { en: "Cooked sweet potato", he: "בטטה מבושלת" }, aliases: ["sweet potato", "sweet potatoes", "cooked sweet potato", "בטטה", "בטטות", "בטטה מבושלת"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 90, protein: 2, carbs: 20.7, fat: 0.2 }, reference: { source: "generic cooked edible portion", ediblePortion: true, state: "cooked", defaultState: "cooked when logged as eaten" } },
  { id: "tuna-water", name: { en: "Tuna in water", he: "טונה במים" }, aliases: ["tuna in water", "tuna", "טונה במים", "טונה"], baseAmount: 100, baseUnit: "g", macros: { calories: 116, protein: 26, carbs: 0, fat: 1 }, reference: { source: "generic canned tuna in water", ediblePortion: true, state: "drained" } },
  { id: "pita", name: { en: "Pita", he: "פיתה" }, aliases: ["pita", "pitta", "pitas", "פיתה", "פיתות"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 275, protein: 9.1, carbs: 55.7, fat: 1.2 }, reference: { source: "generic white pita", ediblePortion: true, state: "ready-to-eat" } },
  { id: "bread-slice", name: { en: "Bread", he: "לחם" }, aliases: ["bread slice", "slice of bread", "bread", "פרוסת לחם", "פרוסות לחם", "לחם"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 250, protein: 9, carbs: 49, fat: 3.2 }, reference: { source: "generic commercial bread", ediblePortion: true, state: "ready-to-eat" } },
  { id: "white-cheese-5", name: { en: "White cheese 5%", he: "גבינה לבנה 5%" }, aliases: ["white cheese 5%", "white cheese", "גבינה לבנה 5%", "גבינה לבנה"], baseAmount: 100, baseUnit: "g", macros: { calories: 100, protein: 9, carbs: 3, fat: 5 } },
  { id: "egg", name: { en: "Egg", he: "ביצה" }, aliases: ["egg", "eggs", "ביצה", "ביצים"], baseAmount: 1, baseUnit: "item", gramsPerItem: 50, macros: { calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 }, reference: { source: "generic large egg (~50 g edible portion)", ediblePortion: true, state: "edible item" } },
  { id: "hummus", name: { en: "Hummus", he: "חומוס" }, aliases: ["hummus", "humus", "חומוס"], baseAmount: 100, baseUnit: "g", macros: { calories: 166, protein: 7.9, carbs: 14.3, fat: 9.6 }, reference: { source: "generic prepared hummus", ediblePortion: true, state: "ready-to-eat", policy: "representative-not-brand" } },
  { id: "tahini", name: { en: "Tahini", he: "טחינה" }, aliases: ["tahini", "sesame tahini", "טחינה", "טחינה גולמית", "טחינה מלאה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 595, protein: 17, carbs: 21, fat: 53.8 }, reference: { source: "generic sesame tahini", ediblePortion: true, state: "ready-to-eat", policy: "representative-not-brand" } },
  { id: "labneh", name: { en: "Labneh", he: "לבנה" }, aliases: ["labneh", "labaneh", "לבנה", "לאבנה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 135, protein: 8, carbs: 5, fat: 9 }, reference: { source: "generic labneh", ediblePortion: true, state: "ready-to-eat", policy: "representative-not-brand" } },
  { id: "falafel-ball", name: { en: "Falafel ball", he: "כדור פלאפל" }, aliases: ["falafel", "falafel ball", "falafel balls", "כדור פלאפל", "כדורי פלאפל", "פלאפל"], baseAmount: 1, baseUnit: "item", gramsPerItem: 18, specificity: "generic", macros: { calories: 60, protein: 2.2, carbs: 5.5, fat: 3.5 }, reference: { source: "generic fried falafel ball (~18 g)", ediblePortion: true, state: "ready-to-eat", policy: "representative-not-brand" } },
  { id: "malabi", name: { en: "Malabi", he: "מלבי" }, aliases: ["malabi", "malabi dessert", "מלבי", "מלבי קינוח"], baseAmount: 1, baseUnit: "item", gramsPerItem: 180, specificity: "generic", macros: { calories: 220, protein: 4, carbs: 35, fat: 7 }, reference: { source: "generic individual malabi with usual syrup and topping (~180 g)", ediblePortion: true, state: "ready-to-eat", policy: "variable-dessert-average" } },
  { id: "chocolate-ball", name: { en: "Chocolate ball", he: "כדור שוקולד" }, aliases: ["chocolate ball", "chocolate balls", "coconut chocolate ball", "כדור שוקולד", "כדורי שוקולד"], baseAmount: 1, baseUnit: "item", gramsPerItem: 25, specificity: "generic", macros: { calories: 115, protein: 1.5, carbs: 16, fat: 5 }, reference: { source: "generic coconut-coated chocolate biscuit ball (~25 g)", ediblePortion: true, state: "ready-to-eat", policy: "variable-dessert-average" } },
  { id: "alfajores", name: { en: "Alfajores cookie", he: "אלפחורס" }, aliases: ["alfajores", "alfajor", "alfajore", "alfajores cookie", "אלפחורס", "אלפחור", "אלפחורסים", "עוגיית אלפחורס"], baseAmount: 1, baseUnit: "item", gramsPerItem: 35, specificity: "generic", macros: { calories: 165, protein: 2, carbs: 22, fat: 8 }, reference: { source: "generic dulce-de-leche alfajores cookie (~35 g)", ediblePortion: true, state: "ready-to-eat", policy: "variable-dessert-average" } },
  { id: "bamba", name: { en: "Peanut snack", he: "במבה" }, aliases: ["bamba", "peanut snack", "במבה", "שקית במבה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 544, protein: 14, carbs: 53, fat: 34 }, reference: { source: "generic peanut puff snack", ediblePortion: true, state: "ready-to-eat", policy: "representative-not-brand" } },
  { id: "bissli", name: { en: "Wheat snack", he: "ביסלי" }, aliases: ["bissli", "wheat snack", "ביסלי", "שקית ביסלי"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 500, protein: 9, carbs: 63, fat: 22 }, reference: { source: "generic savory wheat snack", ediblePortion: true, state: "ready-to-eat", policy: "representative-not-brand" } },
  { id: "cheese-bourekas", name: { en: "Cheese bourekas", he: "בורקס גבינה" }, aliases: ["cheese bourekas", "bourekas", "burekas", "בורקס", "בורקס גבינה", "בורקסים"], baseAmount: 1, baseUnit: "item", specificity: "generic", macros: { calories: 210, protein: 5, carbs: 24, fat: 10 }, reference: { source: "generic medium cheese bourekas (~65 g)", ediblePortion: true, state: "ready-to-eat", policy: "variable-composite" } },
  { id: "malawach", name: { en: "Malawach", he: "מלאווח" }, aliases: ["malawach", "malawach pastry", "מלאווח", "מלווח"], baseAmount: 1, baseUnit: "item", specificity: "generic", macros: { calories: 420, protein: 8, carbs: 48, fat: 22 }, reference: { source: "generic plain malawach pastry", ediblePortion: true, state: "ready-to-eat", policy: "variable-composite" } },
  { id: "schnitzel", name: { en: "Chicken schnitzel", he: "שניצל עוף" }, aliases: ["chicken schnitzel", "schnitzel", "שניצל", "שניצל עוף"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 250, protein: 21, carbs: 18, fat: 11 }, reference: { source: "generic breaded cooked chicken schnitzel", ediblePortion: true, state: "cooked", policy: "representative-not-brand" } },
  { id: "turkey-breast", name: { en: "Cooked turkey breast", he: "חזה הודו מבושל" }, aliases: ["turkey breast", "turkey fillet", "cooked turkey breast", "turkey", "חזה הודו", "הודו", "חזה תרנגול הודו"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 135, protein: 29, carbs: 0, fat: 1.6 }, reference: { source: "generic cooked skinless turkey breast", ediblePortion: true, state: "cooked", policy: "representative-not-brand" } },
  { id: "spinach", name: { en: "Raw spinach", he: "תרד טרי" }, aliases: ["spinach", "fresh spinach", "baby spinach", "תרד", "תרד טרי", "עלי תרד"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 }, reference: { source: "generic raw spinach", ediblePortion: true, state: "raw", policy: "representative-not-brand" } },
  { id: "turkey-pastrami", name: { en: "Turkey pastrami", he: "פסטרמה הודו" }, aliases: ["turkey pastrami", "turkey slices", "pastrami", "פסטרמה הודו", "פסטרמה"], baseAmount: 100, baseUnit: "g", macros: { calories: 120, protein: 21, carbs: 3, fat: 3 } },
  { id: "ready-rice", name: { en: "Cooked rice", he: "אורז מבושל" }, aliases: ["ready rice", "cooked rice", "rice", "אורז מוכן", "אורז מבושל", "אורז"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 }, reference: { source: "generic cooked white rice", ediblePortion: true, state: "cooked", defaultState: "cooked when logged as eaten" } },
  { id: "pasta-cooked", name: { en: "Cooked pasta", he: "פסטה מבושלת" }, aliases: ["cooked pasta", "pasta", "פסטה מבושלת", "פסטה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 157, protein: 5.8, carbs: 30.9, fat: 0.9 }, reference: { source: "generic cooked pasta", ediblePortion: true, state: "cooked", defaultState: "cooked when logged as eaten" } },
  { id: "potato", name: { en: "Cooked potato", he: "תפוח אדמה מבושל" }, aliases: ["potato", "potatoes", "cooked potato", "תפוח אדמה", "תפוחי אדמה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 87, protein: 1.9, carbs: 20.1, fat: 0.1 }, reference: { source: "generic cooked edible portion", ediblePortion: true, state: "cooked" } },
  { id: "yogurt", name: { en: "Plain yogurt", he: "יוגורט טבעי" }, aliases: ["plain yogurt", "yogurt", "יוגורט טבעי", "יוגורט"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3 }, reference: { source: "generic plain whole-milk yogurt", ediblePortion: true, state: "ready-to-eat" } },
  { id: "salmon", name: { en: "Cooked salmon", he: "סלמון מבושל" }, aliases: ["cooked salmon", "salmon", "סלמון מבושל", "סלמון"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 206, protein: 22, carbs: 0, fat: 12.4 }, reference: { source: "generic cooked salmon", ediblePortion: true, state: "cooked" } },
  { id: "cornflakes", name: { en: "Cornflakes", he: "קורנפלקס" }, aliases: ["cornflakes", "corn flakes", "קורנפלקס", "דגני בוקר"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 357, protein: 7.5, carbs: 84, fat: 0.4 }, reference: { source: "generic ready-to-eat corn flakes", ediblePortion: true, state: "dry" } },
  { id: "pizza", name: { en: "Cheese pizza", he: "פיצה עם גבינה" }, aliases: ["pizza", "pizza slice", "pizza slices", "whole pizza", "pizza tray", "פיצה", "משולש פיצה", "משולשי פיצה", "מגש פיצה", "פיצה שלמה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 265, protein: 11, carbs: 33, fat: 10 }, reference: { source: "representative generic cheese pizza", ediblePortion: true, state: "ready-to-eat", policy: "variable-composite" } },
  { id: "shawarma-laffa", name: { en: "Shawarma laffa", he: "לאפה שווארמה" }, aliases: ["shawarma laffa", "shawarma wrap", "laffa shawarma", "לאפה שווארמה", "שווארמה בלאפה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 170, protein: 9, carbs: 17, fat: 7 }, reference: { source: "internal representative composite: laffa, shawarma, salad and normal sauce allowance", ediblePortion: true, state: "ready-to-eat", policy: "variable-composite" } },
  { id: "tuna-sandwich", name: { en: "Tuna sandwich", he: "כריך טונה" }, aliases: ["tuna sandwich", "כריך טונה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 190, protein: 12, carbs: 22, fat: 6 }, reference: { source: "internal representative composite", ediblePortion: true, state: "ready-to-eat", policy: "variable-composite" } },
  { id: "pita-hummus", name: { en: "Pita with hummus", he: "פיתה עם חומוס" }, aliases: ["pita with hummus", "hummus pita", "פיתה עם חומוס"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 240, protein: 7, carbs: 36, fat: 8 }, reference: { source: "internal representative composite", ediblePortion: true, state: "ready-to-eat", policy: "variable-composite" } },
  { id: "ready-chicken", name: { en: "Cooked chicken breast", he: "חזה עוף מוכן" }, aliases: ["ready chicken", "cooked chicken", "chicken breast", "חזה עוף מוכן", "חזה עוף"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 165, protein: 31, carbs: 0, fat: 3.6 }, reference: { source: "generic cooked skinless breast", ediblePortion: true, state: "cooked" } },
  { id: "orange", name: { en: "Orange", he: "תפוז" }, aliases: ["orange", "oranges", "תפוז", "תפוזים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 47, protein: 0.9, carbs: 11.8, fat: 0.1 }, reference: { source: "generic raw orange, edible portion", ediblePortion: true, state: "raw" } },
  { id: "pear", name: { en: "Pear", he: "אגס" }, aliases: ["pear", "pears", "אגס", "אגסים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 57, protein: 0.4, carbs: 15.2, fat: 0.1 }, reference: { source: "generic raw pear, edible portion", ediblePortion: true, state: "raw" } },
  { id: "grapes", name: { en: "Grapes", he: "ענבים" }, aliases: ["grape", "grapes", "ענב", "ענבים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 69, protein: 0.7, carbs: 18.1, fat: 0.2 }, reference: { source: "generic raw grapes, edible portion", ediblePortion: true, state: "raw" } },
  { id: "strawberries", name: { en: "Strawberries", he: "תותים" }, aliases: ["strawberry", "strawberries", "תות", "תותים", "תות שדה", "תותי שדה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3 }, reference: { source: "generic raw strawberries, edible portion", ediblePortion: true, state: "raw" } },
  { id: "watermelon", name: { en: "Watermelon", he: "אבטיח" }, aliases: ["watermelon", "אבטיח", "אבטיחים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 30, protein: 0.6, carbs: 7.6, fat: 0.2 }, reference: { source: "generic raw watermelon, edible portion", ediblePortion: true, state: "raw" } },
  { id: "mango", name: { en: "Mango", he: "מנגו" }, aliases: ["mango", "mangos", "mangoes", "מנגו", "מנגוים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 60, protein: 0.8, carbs: 15, fat: 0.4 }, reference: { source: "generic raw mango, edible portion", ediblePortion: true, state: "raw" } },
  { id: "tomato", name: { en: "Tomato", he: "עגבנייה" }, aliases: ["tomato", "tomatoes", "עגבנייה", "עגבניה", "עגבניות"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 }, reference: { source: "generic raw tomato, edible portion", ediblePortion: true, state: "raw" } },
  { id: "carrot", name: { en: "Carrot", he: "גזר" }, aliases: ["carrot", "carrots", "גזר", "גזרים"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 }, reference: { source: "generic raw carrot, edible portion", ediblePortion: true, state: "raw" } },
  { id: "bell-pepper", name: { en: "Bell pepper", he: "פלפל גמבה" }, aliases: ["bell pepper", "sweet pepper", "pepper", "פלפל", "פלפל גמבה", "גמבה", "גמבות"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 31, protein: 1, carbs: 6, fat: 0.3 }, reference: { source: "generic raw sweet pepper, edible portion", ediblePortion: true, state: "raw" } },
  { id: "lettuce", name: { en: "Lettuce", he: "חסה" }, aliases: ["lettuce", "salad lettuce", "חסה", "עלי חסה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2 }, reference: { source: "generic raw lettuce, edible portion", ediblePortion: true, state: "raw" } },
  { id: "broccoli", name: { en: "Cooked broccoli", he: "ברוקולי מבושל" }, aliases: ["broccoli", "cooked broccoli", "ברוקולי", "ברוקולי מבושל"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4 }, reference: { source: "generic cooked broccoli, edible portion", ediblePortion: true, state: "cooked" } },
  { id: "zucchini", name: { en: "Cooked zucchini", he: "קישוא מבושל" }, aliases: ["zucchini", "courgette", "קישוא", "קישואים", "קישוא מבושל"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3 }, reference: { source: "generic cooked zucchini, edible portion", ediblePortion: true, state: "cooked" } },
  { id: "mushrooms", name: { en: "Mushrooms", he: "פטריות" }, aliases: ["mushroom", "mushrooms", "פטריה", "פטריות"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3 }, reference: { source: "generic cooked mushrooms, edible portion", ediblePortion: true, state: "cooked" } },
  { id: "milk-3", name: { en: "Milk 3%", he: "חלב 3%" }, aliases: ["milk", "whole milk", "milk 3%", "חלב", "חלב 3%"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 }, reference: { source: "generic 3% cow milk", ediblePortion: true, state: "ready-to-drink" } },
  { id: "greek-yogurt", name: { en: "Greek yogurt", he: "יוגורט יווני" }, aliases: ["greek yogurt", "greek yoghurt", "יוגורט יווני", "יוגורט יוונית"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 97, protein: 9, carbs: 3.9, fat: 5 }, reference: { source: "generic plain Greek yogurt", ediblePortion: true, state: "ready-to-eat" } },
  { id: "yellow-cheese", name: { en: "Yellow cheese", he: "גבינה צהובה" }, aliases: ["yellow cheese", "hard cheese", "cheddar", "גבינה צהובה", "גבינה קשה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 403, protein: 25, carbs: 1.3, fat: 33 }, reference: { source: "generic semi-hard yellow cheese", ediblePortion: true, state: "ready-to-eat" } },
  { id: "mozzarella", name: { en: "Mozzarella", he: "מוצרלה" }, aliases: ["mozzarella", "מוצרלה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 280, protein: 28, carbs: 3.1, fat: 17 }, reference: { source: "generic mozzarella", ediblePortion: true, state: "ready-to-eat" } },
  { id: "chicken-thigh", name: { en: "Cooked chicken thigh", he: "פרגית מבושלת" }, aliases: ["chicken thigh", "cooked chicken thigh", "פרגית", "פרגיות", "ירך עוף", "ירכי עוף"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 209, protein: 26, carbs: 0, fat: 11 }, reference: { source: "generic cooked skinless chicken thigh", ediblePortion: true, state: "cooked" } },
  { id: "ground-beef", name: { en: "Cooked lean ground beef", he: "בשר טחון מבושל" }, aliases: ["ground beef", "minced beef", "lean ground beef", "בשר טחון", "בשר בקר טחון"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 217, protein: 26, carbs: 0, fat: 12 }, reference: { source: "generic cooked lean ground beef", ediblePortion: true, state: "cooked" } },
  { id: "beef-steak", name: { en: "Cooked beef steak", he: "סטייק בקר" }, aliases: ["beef steak", "steak", "סטייק", "סטייק בקר"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 250, protein: 26, carbs: 0, fat: 15 }, reference: { source: "generic cooked lean beef steak", ediblePortion: true, state: "cooked" } },
  { id: "white-fish", name: { en: "Cooked white fish", he: "דג לבן מבושל" }, aliases: ["white fish", "fish fillet", "fish", "דג", "דגים", "פילה דג", "דג לבן"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 128, protein: 26, carbs: 0, fat: 2.7 }, reference: { source: "generic cooked white fish fillet", ediblePortion: true, state: "cooked" } },
  { id: "tofu", name: { en: "Firm tofu", he: "טופו" }, aliases: ["tofu", "firm tofu", "טופו"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 144, protein: 17, carbs: 2.8, fat: 8.7 }, reference: { source: "generic firm tofu", ediblePortion: true, state: "ready-to-eat" } },
  { id: "lentils-cooked", name: { en: "Cooked lentils", he: "עדשים מבושלות" }, aliases: ["lentils", "cooked lentils", "lentil", "עדשים", "עדשים מבושלות", "עדשה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 116, protein: 9, carbs: 20.1, fat: 0.4 }, reference: { source: "generic cooked lentils", ediblePortion: true, state: "cooked" } },
  { id: "chickpeas-cooked", name: { en: "Cooked chickpeas", he: "גרגירי חומוס מבושלים" }, aliases: ["chickpeas", "cooked chickpeas", "chickpea", "גרגירי חומוס", "חומוס מבושל", "גרגרי חומוס"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 164, protein: 8.9, carbs: 27.4, fat: 2.6 }, reference: { source: "generic cooked chickpeas", ediblePortion: true, state: "cooked" } },
  { id: "quinoa-cooked", name: { en: "Cooked quinoa", he: "קינואה מבושלת" }, aliases: ["quinoa", "cooked quinoa", "קינואה", "קינואה מבושלת"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 120, protein: 4.4, carbs: 21.3, fat: 1.9 }, reference: { source: "generic cooked quinoa", ediblePortion: true, state: "cooked" } },
  { id: "bulgur-cooked", name: { en: "Cooked bulgur", he: "בורגול מבושל" }, aliases: ["bulgur", "cooked bulgur", "בורגול", "בורגול מבושל"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 83, protein: 3.1, carbs: 18.6, fat: 0.2 }, reference: { source: "generic cooked bulgur", ediblePortion: true, state: "cooked" } },
  { id: "couscous-cooked", name: { en: "Cooked couscous", he: "קוסקוס מבושל" }, aliases: ["couscous", "cooked couscous", "קוסקוס", "קוסקוס מבושל"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 112, protein: 3.8, carbs: 23.2, fat: 0.2 }, reference: { source: "generic cooked couscous", ediblePortion: true, state: "cooked" } },
  { id: "olive-oil", name: { en: "Olive oil", he: "שמן זית" }, aliases: ["olive oil", "שמן זית"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 884, protein: 0, carbs: 0, fat: 100 }, reference: { source: "generic olive oil", ediblePortion: true, state: "ready-to-eat" } },
  { id: "granola", name: { en: "Granola", he: "גרנולה" }, aliases: ["granola", "גרנולה"], baseAmount: 100, baseUnit: "g", specificity: "generic", macros: { calories: 471, protein: 10, carbs: 64, fat: 20 }, reference: { source: "generic oat-and-nut granola", ediblePortion: true, state: "ready-to-eat", policy: "representative-not-brand" } },
  { id: "chocolate-granola-bar", name: { en: "Chocolate granola bar", he: "חטיף שוקולד גרנולה" }, aliases: ["chocolate granola bar", "granola bar", "granola snack bar", "חטיף גרנולה", "חטיף גרנולה שוקולד", "חטיף שוקולד גרנולה", "חטיף שוקולד גרנול", "חטיף שוקולד גרנל", "חטיף גרנול"], baseAmount: 1, baseUnit: "item", gramsPerItem: 40, specificity: "generic", macros: { calories: 180, protein: 3, carbs: 27, fat: 7 }, reference: { source: "representative generic chocolate granola bar (~40 g)", ediblePortion: true, state: "ready-to-eat", policy: "variable-product-average" } }
]);

const PORTION_REFERENCES = Object.freeze({
  "sweet-potato": Object.freeze({ unit: "g", default: 180, sizes: Object.freeze({ small: 130, medium: 180, large: 250 }), portions: Object.freeze({ serving: 180, plate: 250 }), confidence: "medium", ediblePortion: true }),
  banana: Object.freeze({ unit: "g", default: 118, sizes: Object.freeze({ small: 80, medium: 118, large: 136 }), confidence: "high", ediblePortion: true }),
  apple: Object.freeze({ unit: "g", default: 182, sizes: Object.freeze({ small: 150, medium: 182, large: 223 }), confidence: "high", ediblePortion: true }),
  pomegranate: Object.freeze({ unit: "g", default: 174, confidence: "medium", ediblePortion: true }),
  lemon: Object.freeze({ unit: "g", default: 58, confidence: "medium", ediblePortion: true }),
  pita: Object.freeze({ unit: "g", default: 60, sizes: Object.freeze({ small: 50, medium: 60, large: 80 }), portions: Object.freeze({ item: 60 }), confidence: "medium", ediblePortion: true }),
  "bread-slice": Object.freeze({ unit: "g", default: 32, portions: Object.freeze({ slice: 32 }), confidence: "medium", ediblePortion: true }),
  "ready-rice": Object.freeze({ unit: "g", default: 200, portions: Object.freeze({ serving: 180, plate: 200, bowl: 220, cup: 160 }), confidence: "medium", ediblePortion: true }),
  "pasta-cooked": Object.freeze({ unit: "g", default: 220, portions: Object.freeze({ serving: 200, plate: 220, bowl: 240, cup: 140 }), confidence: "medium", ediblePortion: true }),
  potato: Object.freeze({ unit: "g", default: 170, sizes: Object.freeze({ small: 120, medium: 170, large: 280 }), confidence: "medium", ediblePortion: true }),
  cucumber: Object.freeze({ unit: "g", default: 200, sizes: Object.freeze({ small: 120, medium: 200, large: 300 }), confidence: "medium", ediblePortion: true }),
  avocado: Object.freeze({ unit: "g", default: 150, sizes: Object.freeze({ small: 120, medium: 150, large: 200 }), confidence: "medium", ediblePortion: true }),
  walnuts: Object.freeze({ unit: "g", default: 28, portions: Object.freeze({ serving: 28, tablespoon: 8 }), confidence: "medium", ediblePortion: true }),
  almonds: Object.freeze({ unit: "g", default: 28, portions: Object.freeze({ serving: 28, tablespoon: 9 }), confidence: "medium", ediblePortion: true }),
  cashews: Object.freeze({ unit: "g", default: 28, portions: Object.freeze({ serving: 28, tablespoon: 9 }), confidence: "medium", ediblePortion: true }),
  pistachios: Object.freeze({ unit: "g", default: 28, portions: Object.freeze({ serving: 28, tablespoon: 9 }), confidence: "medium", ediblePortion: true }),
  peanuts: Object.freeze({ unit: "g", default: 28, portions: Object.freeze({ serving: 28, tablespoon: 9 }), confidence: "medium", ediblePortion: true }),
  "peanut-butter": Object.freeze({ unit: "g", default: 16, portions: Object.freeze({ tablespoon: 16 }), confidence: "medium", ediblePortion: true }),
  dates: Object.freeze({ unit: "g", default: 24, portions: Object.freeze({ serving: 24 }), confidence: "medium", ediblePortion: true }),
  "date-syrup": Object.freeze({ unit: "g", default: 20, portions: Object.freeze({ tablespoon: 20, serving: 20 }), confidence: "low", ediblePortion: true }),
  hummus: Object.freeze({ unit: "g", default: 60, portions: Object.freeze({ tablespoon: 15, bowl: 120, plate: 100 }), confidence: "medium", ediblePortion: true }),
  tahini: Object.freeze({ unit: "g", default: 15, portions: Object.freeze({ tablespoon: 15 }), confidence: "medium", ediblePortion: true }),
  labneh: Object.freeze({ unit: "g", default: 60, portions: Object.freeze({ tablespoon: 20, bowl: 120 }), confidence: "medium", ediblePortion: true }),
  bamba: Object.freeze({ unit: "g", default: 25, portions: Object.freeze({ serving: 25, bowl: 35 }), confidence: "low", ediblePortion: true }),
  bissli: Object.freeze({ unit: "g", default: 25, portions: Object.freeze({ serving: 25, bowl: 35 }), confidence: "low", ediblePortion: true }),
  schnitzel: Object.freeze({ unit: "g", default: 150, portions: Object.freeze({ serving: 150, plate: 200 }), confidence: "medium", ediblePortion: true }),
  cornflakes: Object.freeze({ unit: "g", default: 40, portions: Object.freeze({ bowl: 40, cup: 30 }), confidence: "low", ediblePortion: true }),
  pizza: Object.freeze({ unit: "g", portions: Object.freeze({ slice: 120 }), confidence: "low", ediblePortion: true, composite: true }),
  "shawarma-laffa": Object.freeze({ unit: "g", default: 500, sizes: Object.freeze({ small: 380, medium: 500, large: 650 }), confidence: "low", ediblePortion: true, composite: true }),
  "tuna-sandwich": Object.freeze({ unit: "g", default: 220, sizes: Object.freeze({ small: 170, medium: 220, large: 300 }), confidence: "low", ediblePortion: true, composite: true }),
  "pita-hummus": Object.freeze({ unit: "g", default: 140, sizes: Object.freeze({ small: 110, medium: 140, large: 190 }), confidence: "low", ediblePortion: true, composite: true })
});

const PIZZA_WHOLE_CHOICES = Object.freeze([
  Object.freeze({ id: "personal", amount: 500, label: { en: "Personal pizza (~500 g)", he: "פיצה אישית (כ־500 גרם)" } }),
  Object.freeze({ id: "medium", amount: 800, label: { en: "Medium pizza (~800 g)", he: "פיצה בינונית (כ־800 גרם)" } }),
  Object.freeze({ id: "large", amount: 1100, label: { en: "Large pizza (~1,100 g)", he: "פיצה גדולה (כ־1,100 גרם)" } })
]);

const UNIT_ALIASES = new Map([
  ["g", "g"], ["gr", "g"], ["gram", "g"], ["grams", "g"], ["גרם", "g"], ["גרמים", "g"],
  ["kg", "kg"], ["kilogram", "kg"], ["kilograms", "kg"], ["קג", "kg"], ["קילו", "kg"],
  ["ml", "ml"], ["milliliter", "ml"], ["milliliters", "ml"], ["מל", "ml"],
  ["item", "item"], ["items", "item"], ["unit", "item"], ["units", "item"], ["יחידה", "item"], ["יחידות", "item"],
  ["serving", "serving"], ["servings", "serving"], ["מנה", "serving"], ["מנות", "serving"],
  ["slice", "slice"], ["slices", "slice"], ["פרוסה", "slice"], ["פרוסות", "slice"], ["משולש", "slice"], ["משולשים", "slice"], ["משולשי", "slice"],
  ["cup", "cup"], ["cups", "cup"], ["כוס", "cup"], ["כוסות", "cup"],
  ["bowl", "bowl"], ["bowls", "bowl"], ["קערה", "bowl"], ["קערת", "bowl"],
  ["plate", "plate"], ["plates", "plate"], ["צלחת", "plate"],
  ["tbsp", "tablespoon"], ["tablespoon", "tablespoon"], ["tablespoons", "tablespoon"], ["כף", "tablespoon"], ["כפות", "tablespoon"]
]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[׳’`]/g, "'")
    .replace(/["“”()[\]{}:!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUnit(value) {
  const clean = normalizeText(value).replace(/[.'״']/g, "");
  return UNIT_ALIASES.get(clean) || "";
}

const SIZE_WORDS = Object.freeze({
  small: Object.freeze(["small", "קטן", "קטנה", "קטנים", "קטנות"]),
  medium: Object.freeze(["medium", "regular", "בינוני", "בינונית", "בינוניים", "בינוניות", "רגיל", "רגילה"]),
  large: Object.freeze(["large", "גדול", "גדולה", "גדולים", "גדולות"])
});

const COUNT_WORDS = Object.freeze(new Map([
  ["one", 1], ["a", 1], ["an", 1], ["אחד", 1], ["אחת", 1], ["שלם", 1], ["שלמה", 1],
  ["two", 2], ["שניים", 2], ["שני", 2], ["שתיים", 2], ["שתי", 2], ["half", 0.5], ["חצי", 0.5]
]));

// Natural food logging should not require a user to switch keyboard layouts
// merely to write an amount. These are deliberately bounded number words for
// portion/weight prefixes (not free-form numeric NLP), covering ordinary
// Hebrew and English quantities up to one hundred.
const SPELLED_NUMBER_WORDS = Object.freeze(new Map([
  ["half", 0.5], ["חצי", 0.5],
  ["one", 1], ["a", 1], ["an", 1], ["אחד", 1], ["אחת", 1],
  ["two", 2], ["שניים", 2], ["שני", 2], ["שתיים", 2], ["שתי", 2],
  ["three", 3], ["שלוש", 3], ["שלושה", 3],
  ["four", 4], ["ארבע", 4], ["ארבעה", 4],
  ["five", 5], ["חמש", 5], ["חמישה", 5],
  ["six", 6], ["שש", 6], ["שישה", 6],
  ["seven", 7], ["שבע", 7], ["שבעה", 7],
  ["eight", 8], ["שמונה", 8], ["שמונת", 8],
  ["nine", 9], ["תשע", 9], ["תשעה", 9],
  ["ten", 10], ["עשר", 10], ["עשרה", 10],
  ["eleven", 11], ["אחת עשרה", 11], ["אחד עשר", 11],
  ["twelve", 12], ["שתים עשרה", 12], ["שנים עשר", 12],
  ["thirteen", 13], ["שלוש עשרה", 13], ["שלושה עשר", 13],
  ["fourteen", 14], ["ארבע עשרה", 14], ["ארבעה עשר", 14],
  ["fifteen", 15], ["חמש עשרה", 15], ["חמישה עשר", 15],
  ["sixteen", 16], ["שש עשרה", 16], ["שישה עשר", 16],
  ["seventeen", 17], ["שבע עשרה", 17], ["שבעה עשר", 17],
  ["eighteen", 18], ["שמונה עשרה", 18], ["שמונה עשר", 18],
  ["nineteen", 19], ["תשע עשרה", 19], ["תשעה עשר", 19],
  ["twenty", 20], ["עשרים", 20], ["thirty", 30], ["שלושים", 30],
  ["forty", 40], ["ארבעים", 40], ["fifty", 50], ["חמישים", 50],
  ["sixty", 60], ["שישים", 60], ["seventy", 70], ["שבעים", 70],
  ["eighty", 80], ["שמונים", 80], ["ninety", 90], ["תשעים", 90],
  ["one hundred", 100], ["מאה", 100]
]));

function spelledNumberValue(word) {
  const normalized = normalizeText(word);
  if (SPELLED_NUMBER_WORDS.has(normalized)) return SPELLED_NUMBER_WORDS.get(normalized);
  // Hebrew commonly joins "and" to the next number: "עשרים וחמש".
  if (normalized.startsWith("ו") && SPELLED_NUMBER_WORDS.has(normalized.slice(1))) return SPELLED_NUMBER_WORDS.get(normalized.slice(1));
  return null;
}

function spelledAmountPrefix(normalized) {
  const words = normalized.split(" ").filter(Boolean);
  // A bounded prefix keeps food names from being interpreted as a number.
  for (let wordCount = Math.min(3, words.length - 1); wordCount >= 1; wordCount -= 1) {
    const numberWords = words.slice(0, wordCount);
    const values = numberWords.map(spelledNumberValue);
    if (values.some((value) => value === null)) continue;
    const amount = values.reduce((total, value) => total + value, 0);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) continue;
    const possibleUnit = normalizeUnit(words[wordCount]);
    if (possibleUnit && words.length > wordCount + 1) {
      return { amount, unit: possibleUnit, foodText: words.slice(wordCount + 1).join(" ") };
    }
    return { amount, unit: "", foodText: words.slice(wordCount).join(" ") };
  }
  return null;
}

function detectSize(value) {
  const words = new Set(normalizeText(value).split(" "));
  return Object.entries(SIZE_WORDS).find(([, aliases]) => aliases.some((alias) => words.has(alias)))?.[0] || "";
}

function detectPortionKind(value) {
  const text = normalizeText(value);
  const checks = [
    ["whole", /(?:whole pizza|pizza tray|מגש פיצה|פיצה שלמה|מגש)/u],
    ["slice", /(?:slice|slices|פרוסה|פרוסות|משולש|משולשים|משולשי)/u],
    ["bowl", /(?:bowl|bowls|קערה|קערת)/u],
    ["plate", /(?:plate|plates|צלחת)/u],
    ["cup", /(?:cup|cups|כוס|כוסות)/u],
    ["tablespoon", /(?:tbsp|tablespoons?|כף|כפות)/u],
    ["serving", /(?:serving|servings|מנה|מנות)/u],
    ["item", /(?:item|items|unit|units|יחידה|יחידות)/u]
  ];
  return checks.find(([, pattern]) => pattern.test(text))?.[0] || "";
}

function trailingCount(value) {
  const words = normalizeText(value).split(" ");
  return COUNT_WORDS.get(words.at(-1)) || words.map((word) => COUNT_WORDS.get(word)).find((count) => count !== undefined) || null;
}

function splitFoodInput(value) {
  return String(value || "")
    .replace(/[;+]/g, ",")
    .replace(/\s+and\s+/giu, ",")
    .replace(/\s+ו-?\s*(?=\d)/gu, ",")
    .replace(/\s+ו-?\s*(?=[\u0590-\u05ff])/gu, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseAmountPrefix(segment) {
  const normalized = normalizeText(segment);
  const suffix = normalized.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([a-z\u0590-\u05ff.'״׳]+)$/iu);
  if (suffix) {
    const suffixUnit = normalizeUnit(suffix[3]);
    if (suffixUnit) return { amount: Number(suffix[2].replace(",", ".")), unit: suffixUnit, foodText: normalizeText(suffix[1]) };
  }
  const match = normalized.match(/^(\d+(?:[.,]\d+)?)\s*([a-z\u0590-\u05ff.'״׳]*)\s+(.+)$/iu);
  if (!match) return spelledAmountPrefix(normalized) || { amount: null, unit: "", foodText: normalized };
  const amount = Number(match[1].replace(",", "."));
  const unit = normalizeUnit(match[2]);
  if (match[2] && !unit) return { amount, unit: "", foodText: normalizeText(`${match[2]} ${match[3]}`) };
  return { amount, unit, foodText: normalizeText(match[3]) };
}

function catalogWithCustom(customFoods = []) {
  const custom = customFoods.map((food) => ({
    ...food,
    id: String(food.id || "").trim(),
    name: typeof food.name === "object" ? food.name : { en: String(food.name || ""), he: String(food.name || "") },
    aliases: [...new Set([...(food.aliases || []), food.name?.en, food.name?.he, typeof food.name === "string" ? food.name : ""].filter(Boolean))],
    baseAmount: Number(food.baseAmount) || 1,
    baseUnit: normalizeUnit(food.baseUnit) || "item",
    specificity: "custom",
    // AI-assisted food records are intentionally marked as estimates all the
    // way through to the saved entry. They are cached locally for editing,
    // but never promoted into the canonical food catalog automatically.
    source: food.source === "ai-estimate" ? "ai-estimate" : "custom"
  }));
  return [...custom, ...FOOD_CATALOG];
}

function foodPriority(food) {
  return { custom: 400, brand: 300, generic: 100 }[food.specificity || (food.source === "custom" ? "custom" : "generic")] || 0;
}

function foodMatches(food, foodText) {
  return (food.aliases || [])
    .map((alias) => normalizeText(alias))
    .filter(Boolean)
    .map((alias) => ({
      alias,
      score: foodText === alias ? 10000 + alias.length : foodText.includes(alias) ? 1000 + alias.length : alias.includes(foodText) ? 100 + foodText.length : 0
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function scaleFood(food, amount = null, requestedUnit = "") {
  const baseAmount = Number(food.baseAmount) || 1;
  const baseUnit = normalizeUnit(food.baseUnit) || "item";
  let unit = normalizeUnit(requestedUnit) || baseUnit;
  let numericAmount = amount === null || amount === undefined ? baseAmount : Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 10000) throw new Error("INVALID_AMOUNT");
  if (unit === "kg") {
    unit = "g";
    numericAmount *= 1000;
  }
  // Counted foods can also be logged by weight when a representative edible
  // weight is known. The macros remain the catalog average for one item, but
  // the result is explicitly marked as an estimate so the user can edit it.
  const weightConverted = unit === "g" && baseUnit === "item" && Number(food.gramsPerItem) > 0;
  if (unit !== baseUnit && !weightConverted) throw new Error("INCOMPATIBLE_UNIT");
  const factor = weightConverted
    ? numericAmount / Number(food.gramsPerItem)
    : numericAmount / baseAmount;
  return {
    foodId: food.id,
    name: { ...food.name },
    amount: round(numericAmount, weightConverted || baseUnit !== "item" ? 1 : 2),
    unit,
    unitEstimated: weightConverted,
    calories: round(food.macros.calories * factor),
    proteinGrams: round(food.macros.protein * factor),
    carbsGrams: round(food.macros.carbs * factor),
    fatGrams: round(food.macros.fat * factor),
    source: food.source || (String(food.id).startsWith("custom-") ? "custom" : food.specificity === "brand" ? "brand" : "canonical-generic"),
    reference: food.reference ? { ...food.reference } : undefined
  };
}

function estimatedEntry(food, amount, { count = 1, size = "", portionKind = "", confidence = "medium", composite = false, rawText = "", unit = "g", reason = "" } = {}) {
  const entry = scaleFood(food, amount, unit);
  return {
    ...entry,
    estimated: true,
    approximate: true,
    estimateConfidence: confidence,
    estimateReason: reason || null,
    estimatedGrams: unit === "g" ? entry.amount : null,
    portionCount: count,
    portionSize: size || null,
    portionKind: portionKind || null,
    compositeEstimate: composite,
    rawText
  };
}

// Foods whose macros vary enough by brand that a single compact "which
// product?" question is worth asking before defaulting to a representative
// average -- and where "I don't know" always continues with that average.
const BRAND_CLARIFY_FOODS = new Set(["protein-bar"]);

function estimateFromReference(food, reference, chosenGrams, { count = 1, size = "", portionKind = "", reason = "portion-size", rawText = "" }) {
  return estimatedEntry(food, chosenGrams * count, {
    count,
    size,
    portionKind,
    confidence: reference?.confidence || "low",
    composite: reference?.composite === true,
    reason,
    rawText,
    unit: "g"
  });
}

// A clarification always offers an explicit "I don't know -- estimate it"
// path. `fallback` is the choice that path resolves to.
function buildAmbiguity({ segment, kind, foodId, choices, fallback, allowBrandInput = false }) {
  return Object.freeze({
    segment,
    kind,
    foodId,
    allowBrandInput,
    choices: [...choices, { ...fallback, choiceId: "estimate", isEstimateFallback: true }]
  });
}

function brandAmbiguity(food, parsed, segment) {
  const fallbackEstimate = { confidence: "low", portionKind: "item", reason: "generic-product", unit: "item", count: parsed.amount && parsed.unit ? 1 : parsed.amount || 1 };
  return buildAmbiguity({
    segment,
    kind: "brand",
    foodId: food.id,
    allowBrandInput: true,
    choices: [],
    fallback: { foodId: food.id, label: { ...food.name }, amount: fallbackEstimate.count, unit: "item", estimate: fallbackEstimate }
  });
}

function sizeAmbiguity(food, reference, segment, count) {
  const sizes = reference.sizes || {};
  const order = ["small", "medium", "large"].filter((key) => sizes[key]);
  const choices = order.map((key) => ({
    choiceId: key,
    foodId: food.id,
    label: { en: key, he: key },
    amount: sizes[key] * count,
    unit: "g",
    estimate: { confidence: reference.confidence || "medium", portionSize: key, portionKind: "size", reason: "portion-size", count, composite: reference.composite === true }
  }));
  const mediumGrams = sizes.medium || reference.default || sizes.large || sizes.small;
  return buildAmbiguity({
    segment,
    kind: "size",
    foodId: food.id,
    choices,
    fallback: {
      foodId: food.id,
      label: { en: "medium", he: "medium" },
      amount: mediumGrams * count,
      unit: "g",
      estimate: { confidence: "low", portionSize: "medium", portionKind: "size", reason: "portion-default", count, composite: reference.composite === true }
    }
  });
}

function portionKindAmbiguity(food, reference, segment) {
  const perSlice = reference.portions?.slice || 120;
  const choices = [1, 2].map((n) => ({
    choiceId: `slice-${n}`,
    foodId: food.id,
    label: { en: n === 1 ? "1 slice" : `${n} slices`, he: n === 1 ? "משולש אחד" : `${n} משולשים` },
    amount: perSlice * n,
    unit: "g",
    estimate: { confidence: "low", portionKind: "slice", portionCount: n, reason: "composite", count: n, composite: reference.composite === true }
  }));
  return buildAmbiguity({
    segment,
    kind: "portion",
    foodId: food.id,
    choices,
    fallback: {
      foodId: food.id,
      label: { en: "1 slice", he: "משולש אחד" },
      amount: perSlice,
      unit: "g",
      estimate: { confidence: "low", portionKind: "slice", reason: "composite", count: 1, composite: reference.composite === true }
    }
  });
}

function estimateNaturalPortion(food, parsed, segment) {
  const explicitUnit = normalizeUnit(parsed.unit);
  const size = detectSize(parsed.foodText);
  const portionKind = explicitUnit && !["g", "kg", "ml"].includes(explicitUnit) ? explicitUnit : detectPortionKind(parsed.foodText);
  const explicitWeight = ["g", "kg", "ml"].includes(explicitUnit);
  const trailing = trailingCount(parsed.foodText);
  const hasCount = (parsed.amount !== null && !explicitWeight) || trailing !== null;
  const count = parsed.amount && !explicitWeight
    ? parsed.amount
    : trailing || 1;

  // 1. Explicit weight always wins -- no clarification, no estimate flag.
  if (explicitWeight) {
    const scaled = scaleFood(food, parsed.amount, explicitUnit);
    return {
      entry: {
        ...scaled,
        rawText: segment,
        estimated: scaled.unitEstimated === true,
        approximate: scaled.unitEstimated === true,
        estimateConfidence: scaled.unitEstimated === true ? "low" : null,
        estimateReason: scaled.unitEstimated === true ? "average-item-weight" : null
      }
    };
  }

  // 2. Brand matters and none was given -> ask once, "I don't know" -> average.
  if (BRAND_CLARIFY_FOODS.has(food.id) && food.source !== "custom" && food.specificity !== "brand") {
    return { ambiguity: brandAmbiguity(food, parsed, segment) };
  }

  // 3. Counted items (egg, rice cake, yogurt cup...) resolve by count.
  if (food.baseUnit === "item") return { entry: { ...scaleFood(food, parsed.amount ?? count, "item"), rawText: segment, estimated: false, approximate: false } };

  const reference = PORTION_REFERENCES[food.id];

  // 4. Whole pizza / tray -> size of the tray.
  if (food.id === "pizza" && portionKind === "whole") {
    return {
      ambiguity: buildAmbiguity({
        segment,
        kind: "portion",
        foodId: food.id,
        choices: PIZZA_WHOLE_CHOICES.map((choice) => ({
          choiceId: choice.id,
          foodId: food.id,
          label: { ...choice.label },
          amount: choice.amount,
          unit: "g",
          estimate: { confidence: "low", composite: true, portionKind: "whole", portionSize: choice.id, reason: "composite" }
        })),
        fallback: { foodId: food.id, label: { en: "I don't know — medium tray", he: "לא יודע — מגש בינוני" }, amount: 800, unit: "g", estimate: { confidence: "low", composite: true, portionKind: "whole", portionSize: "medium", reason: "composite" } }
      })
    };
  }

  if (!reference) {
    if (parsed.amount !== null) return { entry: { ...scaleFood(food, parsed.amount, parsed.unit), rawText: segment, estimated: false, approximate: false } };
    return { entry: { ...scaleFood(food), rawText: segment, estimated: false, approximate: false } };
  }

  // 5. Explicit size word -> resolve directly (e.g. "בטטה בינונית").
  if (size && reference.sizes?.[size]) {
    return { entry: estimateFromReference(food, reference, reference.sizes[size], { count, size, reason: "portion-size", rawText: segment }) };
  }
  // 6. Explicit portion word ("bowl", "plate", "slice") -> resolve directly.
  if (portionKind && reference.portions?.[portionKind]) {
    return { entry: estimateFromReference(food, reference, reference.portions[portionKind], { count, portionKind, reason: "portion-size", rawText: segment }) };
  }
  // 7. Size actually matters and nothing told us which -> compact size question.
  //    A bare count ("half a pita", "2 potatoes") is a quantity signal, not a
  //    size, so fall through to the representative default instead of asking.
  if (reference.sizes && !size && !portionKind && !hasCount) {
    return { ambiguity: sizeAmbiguity(food, reference, segment, count) };
  }
  // 8. Composite with no default and no signal -> "how much?" question.
  if (!reference.default && !reference.sizes) {
    return { ambiguity: portionKindAmbiguity(food, reference, segment) };
  }
  // 9. A sensible representative default exists -> use it as an estimate.
  return { entry: estimateFromReference(food, reference, reference.default, { count, reason: "portion-default", rawText: segment }) };
}

function parseFoodText(value, { customFoods = [] } = {}) {
  const segments = splitFoodInput(value);
  if (!segments.length) return { status: "empty", entries: [], errors: [], ambiguities: [] };
  const catalog = catalogWithCustom(customFoods);
  const entries = [];
  const errors = [];
  const ambiguities = [];

  segments.forEach((segment, segmentIndex) => {
    const parsed = parseAmountPrefix(segment);
    const matches = catalog
      .map((food) => ({ food, match: foodMatches(food, parsed.foodText) }))
      .filter((candidate) => candidate.match)
      .sort((a, b) => b.match.score - a.match.score || foodPriority(b.food) - foodPriority(a.food));
    if (!matches.length) {
      errors.push({ segment, segmentIndex, code: "UNKNOWN_FOOD" });
      return;
    }
    const bestScore = matches[0].match.score;
    const bestPriority = foodPriority(matches[0].food);
    const best = matches.filter((candidate) => candidate.match.score === bestScore && foodPriority(candidate.food) === bestPriority);
    if (best.length > 1) {
      const options = best.map(({ food }) => ({ choiceId: food.id, foodId: food.id, label: { ...food.name }, amount: parsed.amount, unit: parsed.unit }));
      ambiguities.push({
        ...buildAmbiguity({
          segment,
          kind: "match",
          foodId: options[0].foodId,
          choices: options,
          fallback: { foodId: options[0].foodId, label: { ...best[0].food.name }, amount: parsed.amount, unit: parsed.unit }
        }),
        segmentIndex,
        amount: parsed.amount,
        unit: parsed.unit
      });
      return;
    }
    try {
      const resolution = estimateNaturalPortion(best[0].food, parsed, segment);
      if (resolution.ambiguity) {
        ambiguities.push({ ...resolution.ambiguity, segmentIndex, amount: parsed.amount, unit: parsed.unit });
        return;
      }
      if (resolution.error) {
        errors.push({ segment, segmentIndex, code: resolution.error });
        return;
      }
      entries.push(resolution.entry);
    } catch (error) {
      errors.push({ segment, segmentIndex, code: error.message });
    }
  });

  return {
    status: ambiguities.length ? "needs-clarification" : errors.length ? "partial" : "ready",
    entries,
    errors,
    ambiguities
  };
}

function resolveFoodChoice(foodId, { amount = null, unit = "", customFoods = [], estimate = null, rawText = "" } = {}) {
  const food = catalogWithCustom(customFoods).find((item) => item.id === foodId);
  if (!food) throw new Error("UNKNOWN_FOOD");
  if (estimate) return estimatedEntry(food, amount, {
    count: estimate.count || 1,
    size: estimate.portionSize || "",
    portionKind: estimate.portionKind || "",
    confidence: estimate.confidence || "low",
    composite: estimate.composite === true,
    reason: estimate.reason || "",
    unit: estimate.unit || "g",
    rawText
  });
  return { ...scaleFood(food, amount, unit), rawText, estimated: false, approximate: false };
}

function totalsForEntries(entries = []) {
  return entries.reduce((totals, entry) => ({
    calories: round(totals.calories + Number(entry.calories || 0)),
    proteinGrams: round(totals.proteinGrams + Number(entry.proteinGrams || 0)),
    carbsGrams: round(totals.carbsGrams + Number(entry.carbsGrams || 0)),
    fatGrams: round(totals.fatGrams + Number(entry.fatGrams || 0))
  }), { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
}

function macroEnergyPercentages(totals = {}) {
  const energy = {
    protein: Number(totals.proteinGrams || 0) * 4,
    carbs: Number(totals.carbsGrams || 0) * 4,
    fat: Number(totals.fatGrams || 0) * 9
  };
  const total = energy.protein + energy.carbs + energy.fat;
  if (!total) return { protein: 0, carbs: 0, fat: 0, macroCalories: 0 };
  return {
    protein: round((energy.protein / total) * 100),
    carbs: round((energy.carbs / total) * 100),
    fat: round((energy.fat / total) * 100),
    macroCalories: round(total)
  };
}

function remainingAgainstTargets(totals = {}, targets = {}) {
  return {
    calories: round(Number(targets.dailyCalories || 0) - Number(totals.calories || 0)),
    proteinGrams: round(Number(targets.proteinGrams || 0) - Number(totals.proteinGrams || 0)),
    carbsGrams: round(Number(targets.carbsGrams || 0) - Number(totals.carbsGrams || 0)),
    fatGrams: round(Number(targets.fatGrams || 0) - Number(totals.fatGrams || 0))
  };
}

function classifyEstimatedBalance(consumedCalories, maintenanceCalories, neutralBand = 100) {
  const consumed = Number(consumedCalories);
  const maintenance = Number(maintenanceCalories);
  if (!Number.isFinite(consumed) || !Number.isFinite(maintenance) || maintenance <= 0) return { status: "unknown", balance: null, neutralBand };
  const balance = round(consumed - maintenance, 0);
  return {
    status: balance < -neutralBand ? "deficit" : balance > neutralBand ? "surplus" : "maintenance",
    balance,
    neutralBand
  };
}

function localDateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) throw new Error("INVALID_DATE");
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
}

function shiftDateKey(dateKey, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) throw new Error("INVALID_DATE_KEY");
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  date.setDate(date.getDate() + Number(days || 0));
  return localDateKey(date);
}

function weekDateKeys(anchorDateKey) {
  return Array.from({ length: 7 }, (_, index) => shiftDateKey(anchorDateKey, index - 6));
}

function weeklySummary(logs = []) {
  const relevant = logs.filter((log) => Array.isArray(log?.entries) && log.entries.length > 0);
  const total = relevant.reduce((summary, log) => {
    const totals = log.totals || totalsForEntries(log.entries);
    const maintenance = Number(log.maintenanceSnapshot || log.targetSnapshot?.maintenanceCalories || 0);
    return {
      calories: summary.calories + Number(totals.calories || 0),
      proteinGrams: summary.proteinGrams + Number(totals.proteinGrams || 0),
      carbsGrams: summary.carbsGrams + Number(totals.carbsGrams || 0),
      fatGrams: summary.fatGrams + Number(totals.fatGrams || 0),
      maintenance: summary.maintenance + (maintenance > 0 ? maintenance : 0),
      maintenanceDays: summary.maintenanceDays + (maintenance > 0 ? 1 : 0),
      balance: summary.balance + (maintenance > 0 ? Number(totals.calories || 0) - maintenance : 0),
      completedDays: summary.completedDays + (log.completed ? 1 : 0)
    };
  }, { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, maintenance: 0, maintenanceDays: 0, balance: 0, completedDays: 0 });
  const denominator = relevant.length;
  const average = (value) => denominator ? round(value / denominator) : 0;
  const averageMaintenance = total.maintenanceDays ? round(total.maintenance / total.maintenanceDays) : null;
  const averageBalance = total.maintenanceDays ? round(total.balance / total.maintenanceDays) : null;
  const averageCalories = average(total.calories);
  return {
    loggedDays: denominator,
    completedDays: total.completedDays,
    averageCalories,
    averageProteinGrams: average(total.proteinGrams),
    averageCarbsGrams: average(total.carbsGrams),
    averageFatGrams: average(total.fatGrams),
    averageMaintenance,
    averageBalance,
    balanceStatus: averageBalance === null ? "unknown" : classifyEstimatedBalance(averageMaintenance + averageBalance, averageMaintenance).status
  };
}

function recentFoodsFromLogs(logs = [], limit = 8) {
  const seen = new Set();
  const recents = [];
  for (const log of logs) {
    for (const entry of [...(log.entries || [])].reverse()) {
      const key = entry.foodId || normalizeText(entry.name?.en || entry.name?.he || "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      recents.push({ ...entry });
      if (recents.length >= limit) return recents;
    }
  }
  return recents;
}

function validateCustomFood(input = {}) {
  const name = String(input.name || "").trim().slice(0, 80);
  const baseAmount = Number(input.baseAmount);
  const baseUnit = normalizeUnit(input.baseUnit);
  const macros = {
    calories: Number(input.calories),
    protein: Number(input.proteinGrams),
    carbs: Number(input.carbsGrams),
    fat: Number(input.fatGrams)
  };
  if (!name || !Number.isFinite(baseAmount) || baseAmount <= 0 || !baseUnit) throw new Error("INVALID_CUSTOM_FOOD");
  if (Object.values(macros).some((value) => !Number.isFinite(value) || value < 0 || value > 10000)) throw new Error("INVALID_CUSTOM_FOOD");
  return {
    id: String(input.id || `custom-${normalizeText(name).replace(/[^a-z0-9\u0590-\u05ff]+/gu, "-")}`).slice(0, 100),
    name: { en: name, he: String(input.nameHe || name).trim().slice(0, 80) },
    aliases: [name, input.nameHe].filter(Boolean),
    baseAmount: round(baseAmount, 2),
    baseUnit,
    macros,
    favorite: input.favorite === true,
    source: "custom"
  };
}

function targetSnapshot({ activePlan = null, calculatedTargets = null } = {}) {
  const raw = activePlan?.plan || activePlan || calculatedTargets || {};
  const maintenance = Number(raw.maintenanceCalories || raw.tdee || activePlan?.calculationSnapshot?.tdee || calculatedTargets?.tdee || 0);
  const result = {
    dailyCalories: Number(raw.dailyCalories || 0) || null,
    proteinGrams: Number(raw.proteinGrams || 0) || null,
    carbsGrams: Number(raw.carbsGrams || 0) || null,
    fatGrams: Number(raw.fatGrams || 0) || null,
    maintenanceCalories: maintenance > 0 ? maintenance : null,
    source: activePlan ? "active-plan" : calculatedTargets ? "athlete-core" : "missing"
  };
  result.complete = Boolean(result.dailyCalories && result.proteinGrams);
  return result;
}

export {
  FOOD_CATALOG,
  PIZZA_WHOLE_CHOICES,
  PORTION_REFERENCES,
  classifyEstimatedBalance,
  localDateKey,
  macroEnergyPercentages,
  normalizeText,
  normalizeUnit,
  parseAmountPrefix,
  parseFoodText,
  recentFoodsFromLogs,
  remainingAgainstTargets,
  resolveFoodChoice,
  scaleFood,
  shiftDateKey,
  splitFoodInput,
  targetSnapshot,
  totalsForEntries,
  validateCustomFood,
  weekDateKeys,
  weeklySummary
};
