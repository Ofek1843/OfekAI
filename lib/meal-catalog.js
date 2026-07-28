// Curated meal catalog.
//
// The nutrition builder used to let the AI invent every food line, which
// produced long "a little of everything" lists that don't work as an actual
// plate (and blew past the token limit). Instead the AI now *selects* whole
// meals from this catalog by id, and this module expands the selection into
// full food lists scaled to the calorie target.
//
// FOODS holds per-100g macros once, so meals only reference an ingredient
// key plus a gram amount. Allergens and nutrient highlights are derived from
// the ingredients automatically — no hand-tagging per meal to drift out of
// sync.
//
// Every `img` value must exist in localFoodImages in server.js (the small
// per-ingredient thumbnails). Every meal's `id` doubles as its plate-photo
// filename: public/images/meals/<id>.png — see docs/meal-images-plan.md.

const fs = require("fs");
const path = require("path");

const FOODS = {
  // --- Proteins ---
  "chicken-breast": { en: "Chicken breast (grilled)", he: "חזה עוף בגריל", img: "chicken breast", kcal: 165, p: 31, c: 0, f: 3.6, nut: ["b12"] },
  "chicken-thigh": { en: "Chicken thigh (skinless)", he: "שוק עוף ללא עור", img: "chicken thigh", kcal: 209, p: 26, c: 0, f: 11, nut: ["b12", "iron"] },
  "turkey-breast": { en: "Turkey breast", he: "חזה הודו", img: "turkey breast", kcal: 135, p: 29, c: 0, f: 1, nut: ["b12"] },
  "lean-beef": { en: "Lean ground beef (90%)", he: "בשר בקר טחון רזה", img: "lean ground beef", kcal: 176, p: 26, c: 0, f: 8, nut: ["b12", "iron"] },
  "steak": { en: "Beef steak", he: "סטייק בקר", img: "steak", kcal: 217, p: 27, c: 0, f: 12, nut: ["b12", "iron"] },
  "salmon": { en: "Salmon fillet", he: "פילה סלמון", img: "salmon", kcal: 208, p: 20, c: 0, f: 13, nut: ["b12", "vitaminD"] },
  "tuna": { en: "Tuna (canned in water)", he: "טונה במים", img: "tuna", kcal: 116, p: 26, c: 0, f: 1, nut: ["b12", "vitaminD"] },
  "tilapia": { en: "Tilapia fillet", he: "פילה אמנון", img: "tilapia", kcal: 129, p: 26, c: 0, f: 3, nut: ["b12"] },
  "cod": { en: "Cod fillet", he: "פילה בקלה", img: "cod", kcal: 105, p: 23, c: 0, f: 1, nut: ["b12", "vitaminD"] },
  "shrimp": { en: "Shrimp", he: "שרימפס", img: "shrimp", kcal: 99, p: 24, c: 0, f: 0.3, nut: ["b12"] },
  "eggs": { en: "Eggs", he: "ביצים", img: "eggs", kcal: 143, p: 13, c: 1, f: 10, nut: ["b12", "vitaminD"], piece: { g: 50, en: ["egg", "eggs"], he: ["ביצה", "ביצים"] } },
  "egg-whites": { en: "Egg whites", he: "חלבון ביצה", img: "egg whites", kcal: 52, p: 11, c: 1, f: 0 },
  "cottage-cheese": { en: "Cottage cheese (5%)", he: "גבינת קוטג׳ 5%", img: "cottage cheese", kcal: 98, p: 11, c: 3.4, f: 4.3, alg: ["dairy"], nut: ["b12"] },
  "greek-yogurt": { en: "Greek yogurt (plain)", he: "יוגורט יווני", img: "greek yogurt", kcal: 59, p: 10, c: 3.6, f: 0.4, alg: ["dairy"], nut: ["b12"] },
  "skyr": { en: "Skyr (plain)", he: "סקיר", img: "skyr", kcal: 63, p: 11, c: 4, f: 0.2, alg: ["dairy"], nut: ["b12"] },
  "tofu": { en: "Tofu (firm)", he: "טופו קשה", img: "tofu", kcal: 144, p: 15, c: 3, f: 8, alg: ["soy"], nut: ["iron"] },
  "tempeh": { en: "Tempeh", he: "טמפה", img: "tempeh", kcal: 192, p: 20, c: 8, f: 11, alg: ["soy"], nut: ["iron"] },
  "seitan": { en: "Seitan", he: "סייטן", img: "seitan", kcal: 143, p: 25, c: 14, f: 2, alg: ["gluten"], nut: ["iron"] },
  "protein-powder": { en: "Whey protein powder", he: "אבקת חלבון", img: "protein powder", kcal: 380, p: 78, c: 8, f: 4, alg: ["dairy"] },
  "lentils": { en: "Lentils (cooked)", he: "עדשים מבושלות", img: "peas", kcal: 116, p: 9, c: 20, f: 0.4, nut: ["iron"] },
  "chickpeas": { en: "Chickpeas (cooked)", he: "חומוס גרגרים מבושל", img: "peas", kcal: 164, p: 9, c: 27, f: 2.6, nut: ["iron"] },
  "black-beans": { en: "Black beans (cooked)", he: "שעועית שחורה מבושלת", img: "peas", kcal: 132, p: 9, c: 24, f: 0.5, nut: ["iron"] },
  "kidney-beans": { en: "Kidney beans (cooked)", he: "שעועית אדומה מבושלת", img: "peas", kcal: 127, p: 9, c: 23, f: 0.5, nut: ["iron"] },
  "edamame": { en: "Edamame", he: "אדממה", img: "peas", kcal: 121, p: 12, c: 9, f: 5, alg: ["soy"], nut: ["iron"] },

  // --- Grains & starches (cooked weights unless marked dry) ---
  "white-rice": { en: "White rice (cooked)", he: "אורז לבן מבושל", img: "white rice", kcal: 130, p: 2.7, c: 28, f: 0.3 },
  "brown-rice": { en: "Brown rice (cooked)", he: "אורז מלא מבושל", img: "brown rice", kcal: 123, p: 2.7, c: 26, f: 1 },
  "jasmine-rice": { en: "Jasmine rice (cooked)", he: "אורז יסמין מבושל", img: "jasmine rice", kcal: 130, p: 2.7, c: 28, f: 0.3 },
  "basmati-rice": { en: "Basmati rice (cooked)", he: "אורז בסמטי מבושל", img: "basmati rice", kcal: 121, p: 3, c: 25, f: 0.4 },
  "oats": { en: "Oats (dry)", he: "שיבולת שועל יבשה", img: "oats", kcal: 389, p: 17, c: 66, f: 7 },
  "quinoa": { en: "Quinoa (cooked)", he: "קינואה מבושלת", img: "quinoa", kcal: 120, p: 4.4, c: 21, f: 1.9, nut: ["iron"] },
  "couscous": { en: "Couscous (cooked)", he: "קוסקוס מבושל", img: "couscous", kcal: 112, p: 3.8, c: 23, f: 0.2, alg: ["gluten"] },
  "bulgur": { en: "Bulgur (cooked)", he: "בורגול מבושל", img: "bulgur", kcal: 83, p: 3, c: 19, f: 0.2, alg: ["gluten"] },
  "whole-wheat-pasta": { en: "Whole wheat pasta (cooked)", he: "פסטה מחיטה מלאה מבושלת", img: "whole wheat pasta", kcal: 124, p: 5, c: 26, f: 0.5, alg: ["gluten"] },
  "pasta": { en: "Pasta (cooked)", he: "פסטה מבושלת", img: "pasta", kcal: 131, p: 5, c: 25, f: 1.1, alg: ["gluten"] },
  "sweet-potato": { en: "Sweet potato (cooked)", he: "בטטה מבושלת", img: "sweet potato", kcal: 90, p: 2, c: 21, f: 0.1 },
  "potato": { en: "Potato (cooked)", he: "תפוח אדמה מבושל", img: "potato", kcal: 87, p: 2, c: 20, f: 0.1 },
  "whole-wheat-bread": { en: "Whole wheat bread", he: "לחם מחיטה מלאה", img: "whole wheat bread", kcal: 247, p: 13, c: 41, f: 3.4, alg: ["gluten"], piece: { g: 30, en: ["slice", "slices"], he: ["פרוסה", "פרוסות"] } },
  "bread": { en: "White bread", he: "לחם לבן", img: "bread", kcal: 265, p: 9, c: 49, f: 3.2, alg: ["gluten"], piece: { g: 30, en: ["slice", "slices"], he: ["פרוסה", "פרוסות"] } },
  "pita": { en: "Whole wheat pita", he: "פיתה מחיטה מלאה", img: "pita", kcal: 275, p: 9, c: 55, f: 1.2, alg: ["gluten"], piece: { g: 60, en: ["pita", "pitas"], he: ["פיתה", "פיתות"] } },
  "tortilla": { en: "Tortilla wrap", he: "טורטייה", img: "tortilla", kcal: 310, p: 8, c: 51, f: 8, alg: ["gluten"], piece: { g: 45, en: ["wrap", "wraps"], he: ["טורטייה", "טורטיות"] } },
  "rice-cakes": { en: "Rice cakes", he: "פריכיות אורז", img: "rice cakes", kcal: 387, p: 8, c: 82, f: 3, piece: { g: 9, en: ["cake", "cakes"], he: ["פריכית", "פריכיות"] } },
  "cornflakes": { en: "Cornflakes", he: "קורנפלקס", img: "cornflakes", kcal: 357, p: 7, c: 84, f: 0.4 },
  "granola": { en: "Granola", he: "גרנולה", img: "granola", kcal: 471, p: 10, c: 64, f: 20, alg: ["gluten"] },

  // --- Fruit ---
  "banana": { en: "Banana", he: "בננה", img: "banana", kcal: 89, p: 1.1, c: 23, f: 0.3 },
  "apple": { en: "Apple", he: "תפוח", img: "apple", kcal: 52, p: 0.3, c: 14, f: 0.2 },
  "orange": { en: "Orange", he: "תפוז", img: "orange", kcal: 47, p: 0.9, c: 12, f: 0.1 },
  "pear": { en: "Pear", he: "אגס", img: "pear", kcal: 57, p: 0.4, c: 15, f: 0.1 },
  "grapes": { en: "Grapes", he: "ענבים", img: "grapes", kcal: 69, p: 0.7, c: 18, f: 0.2 },
  "strawberries": { en: "Strawberries", he: "תותים", img: "strawberries", kcal: 32, p: 0.7, c: 8, f: 0.3 },
  "blueberries": { en: "Blueberries", he: "אוכמניות", img: "blueberries", kcal: 57, p: 0.7, c: 14, f: 0.3 },
  "raspberries": { en: "Raspberries", he: "פטל", img: "raspberries", kcal: 52, p: 1.2, c: 12, f: 0.7 },
  "kiwi": { en: "Kiwi", he: "קיווי", img: "kiwi", kcal: 61, p: 1.1, c: 15, f: 0.5 },
  "pineapple": { en: "Pineapple", he: "אננס", img: "pineapple", kcal: 50, p: 0.5, c: 13, f: 0.1 },
  "mango": { en: "Mango", he: "מנגו", img: "mango", kcal: 60, p: 0.8, c: 15, f: 0.4 },
  "melon": { en: "Melon", he: "מלון", img: "melon", kcal: 34, p: 0.8, c: 8, f: 0.2 },
  "peach": { en: "Peach", he: "אפרסק", img: "peach", kcal: 39, p: 0.9, c: 10, f: 0.3 },
  "dates": { en: "Dates", he: "תמרים", img: "dates", kcal: 282, p: 2.5, c: 75, f: 0.4 },

  // --- Vegetables ---
  "broccoli": { en: "Broccoli", he: "ברוקולי", img: "broccoli", kcal: 35, p: 2.4, c: 7, f: 0.4 },
  "cauliflower": { en: "Cauliflower", he: "כרובית", img: "cauliflower", kcal: 25, p: 1.9, c: 5, f: 0.3 },
  "carrots": { en: "Carrots", he: "גזר", img: "carrots", kcal: 41, p: 0.9, c: 10, f: 0.2 },
  "cucumber": { en: "Cucumber", he: "מלפפון", img: "cucumber", kcal: 15, p: 0.7, c: 3.6, f: 0.1 },
  "tomato": { en: "Tomato", he: "עגבנייה", img: "tomato", kcal: 18, p: 0.9, c: 3.9, f: 0.2 },
  "lettuce": { en: "Lettuce", he: "חסה", img: "lettuce", kcal: 15, p: 1.4, c: 2.9, f: 0.2 },
  "spinach": { en: "Spinach", he: "תרד", img: "spinach", kcal: 23, p: 2.9, c: 3.6, f: 0.4, nut: ["iron"] },
  "kale": { en: "Kale", he: "קייל", img: "kale", kcal: 49, p: 4.3, c: 9, f: 0.9, nut: ["iron"] },
  "zucchini": { en: "Zucchini", he: "קישוא", img: "zucchini", kcal: 17, p: 1.2, c: 3.1, f: 0.3 },
  "bell-pepper": { en: "Bell pepper", he: "פלפל", img: "bell pepper", kcal: 31, p: 1, c: 6, f: 0.3 },
  "onion": { en: "Onion", he: "בצל", img: "onion", kcal: 40, p: 1.1, c: 9, f: 0.1 },
  "mushrooms": { en: "Mushrooms", he: "פטריות", img: "mushrooms", kcal: 22, p: 3.1, c: 3.3, f: 0.3 },
  "avocado": { en: "Avocado", he: "אבוקדו", img: "avocado", kcal: 160, p: 2, c: 9, f: 15 },
  "cabbage": { en: "Cabbage", he: "כרוב", img: "cabbage", kcal: 25, p: 1.3, c: 6, f: 0.1 },
  "green-beans": { en: "Green beans", he: "שעועית ירוקה", img: "green beans", kcal: 31, p: 1.8, c: 7, f: 0.2 },
  "peas": { en: "Green peas", he: "אפונה", img: "peas", kcal: 81, p: 5, c: 14, f: 0.4 },
  "corn": { en: "Corn", he: "תירס", img: "corn", kcal: 86, p: 3.2, c: 19, f: 1.2 },
  "asparagus": { en: "Asparagus", he: "אספרגוס", img: "asparagus", kcal: 20, p: 2.2, c: 3.9, f: 0.1 },

  // --- Nuts, seeds & fats ---
  "almonds": { en: "Almonds", he: "שקדים", img: "almonds", kcal: 579, p: 21, c: 22, f: 50, alg: ["nuts"] },
  "walnuts": { en: "Walnuts", he: "אגוזי מלך", img: "walnuts", kcal: 654, p: 15, c: 14, f: 65, alg: ["nuts"] },
  "cashews": { en: "Cashews", he: "קשיו", img: "cashews", kcal: 553, p: 18, c: 30, f: 44, alg: ["nuts"] },
  "peanut-butter": { en: "Peanut butter", he: "חמאת בוטנים", img: "peanut butter", kcal: 588, p: 25, c: 20, f: 50, alg: ["peanuts"] },
  "almond-butter": { en: "Almond butter", he: "חמאת שקדים", img: "almond butter", kcal: 614, p: 21, c: 19, f: 56, alg: ["nuts"] },
  "tahini": { en: "Tahini", he: "טחינה", img: "tahini", kcal: 595, p: 17, c: 21, f: 54, alg: ["sesame"] },
  "olive-oil": { en: "Olive oil", he: "שמן זית", img: "olive oil", kcal: 884, p: 0, c: 0, f: 100 },

  // --- Dairy & drinks ---
  "milk": { en: "Milk (1%)", he: "חלב 1%", img: "milk", kcal: 42, p: 3.4, c: 5, f: 1, alg: ["dairy"], nut: ["b12", "vitaminD"] },
  "soy-milk": { en: "Soy milk", he: "משקה סויה", img: "soy milk", kcal: 43, p: 3.3, c: 3, f: 1.8, alg: ["soy"] },
  "almond-milk": { en: "Almond milk", he: "משקה שקדים", img: "almond milk", kcal: 17, p: 0.6, c: 0.6, f: 1.5, alg: ["nuts"] },
  "oat-milk": { en: "Oat milk", he: "משקה שיבולת שועל", img: "oat milk", kcal: 47, p: 1, c: 7, f: 1.5 },
  "cheese": { en: "Cheese", he: "גבינה צהובה", img: "cheese", kcal: 402, p: 25, c: 1.3, f: 33, alg: ["dairy"], nut: ["b12"] },
  "mozzarella": { en: "Mozzarella", he: "מוצרלה", img: "mozzarella", kcal: 280, p: 22, c: 2.2, f: 22, alg: ["dairy"], nut: ["b12"] },
  "parmesan": { en: "Parmesan", he: "פרמזן", img: "parmesan", kcal: 431, p: 38, c: 4.1, f: 29, alg: ["dairy"], nut: ["b12"] },

  // --- Extras ---
  "honey": { en: "Honey", he: "דבש", img: "honey", kcal: 304, p: 0.3, c: 82, f: 0 },
  "cinnamon": { en: "Cinnamon", he: "קינמון", img: "cinnamon", kcal: 247, p: 4, c: 81, f: 1.2 },
  "dark-chocolate": { en: "Dark chocolate", he: "שוקולד מריר", img: "dark chocolate", kcal: 546, p: 5, c: 61, f: 31 },
  "hummus": { en: "Hummus", he: "חומוס", img: "hummus", kcal: 166, p: 8, c: 14, f: 10, alg: ["sesame"] },
  "mustard": { en: "Mustard", he: "חרדל", img: "mustard", kcal: 66, p: 4, c: 6, f: 3.3 },
  "tomato-sauce": { en: "Tomato sauce", he: "רוטב עגבניות", img: "tomato sauce", kcal: 32, p: 1.3, c: 7, f: 0.3 },
  "salsa": { en: "Salsa", he: "סלסה", img: "salsa", kcal: 36, p: 1.5, c: 7, f: 0.2 }
};

// diet: the strictest pattern a meal already satisfies.
// vegan ⊂ vegetarian ⊂ pescatarian ⊂ omnivore when matching a user's choice.
const MEALS = [
  // ================= BREAKFAST =================
  {
    id: "oats-banana-peanut-butter", en: "Oatmeal with Banana & Peanut Butter", he: "דייסת שיבולת שועל עם בננה וחמאת בוטנים",
    slots: ["breakfast"], diet: "vegetarian",
    items: [["oats", 70], ["banana", 110], ["peanut-butter", 20], ["milk", 200], ["cinnamon", 1]],
    prepEn: "Cook the oats with the milk for 4-5 minutes until creamy. Top with sliced banana, peanut butter and a pinch of cinnamon.",
    prepHe: "בשלו את השיבולת שועל בחלב 4-5 דקות עד למרקם קרמי. הוסיפו מעל בננה פרוסה, חמאת בוטנים וקורט קינמון."
  },
  {
    id: "greek-yogurt-granola-berries", en: "Greek Yogurt, Granola & Berries", he: "יוגורט יווני עם גרנולה ופירות יער",
    slots: ["breakfast", "snack"], diet: "vegetarian",
    items: [["greek-yogurt", 220], ["granola", 45], ["blueberries", 80], ["honey", 12]],
    prepEn: "Layer the yogurt in a bowl, add granola and blueberries on top and finish with a drizzle of honey.",
    prepHe: "שכבו את היוגורט בקערה, פזרו מעל גרנולה ואוכמניות וסיימו בזילוף דבש."
  },
  {
    id: "scrambled-eggs-toast-avocado", en: "Scrambled Eggs, Toast & Avocado", he: "ביצים מקושקשות, טוסט ואבוקדו",
    slots: ["breakfast"], diet: "vegetarian",
    items: [["eggs", 100], ["whole-wheat-bread", 60], ["avocado", 60], ["tomato", 80]],
    prepEn: "Scramble the eggs over low heat. Toast the bread, spread the mashed avocado and serve with sliced tomato.",
    prepHe: "קשקשו את הביצים על אש נמוכה. הקלו את הלחם, מרחו אבוקדו מעוך והגישו עם עגבנייה פרוסה."
  },
  {
    id: "veggie-omelette-toast", en: "Vegetable Omelette with Toast", he: "חביתת ירקות עם טוסט",
    slots: ["breakfast"], diet: "vegetarian",
    items: [["eggs", 150], ["spinach", 50], ["mushrooms", 60], ["bell-pepper", 50], ["whole-wheat-bread", 60], ["olive-oil", 6]],
    prepEn: "Sauté the vegetables in the olive oil, pour the beaten eggs over and fold once set. Serve with toasted bread.",
    prepHe: "טגנו את הירקות בשמן הזית, יצקו מעל את הביצים הטרופות וקפלו כשהתייצבו. הגישו עם לחם קלוי."
  },
  {
    id: "cottage-cheese-toast-tomato", en: "Cottage Cheese Toast with Tomato", he: "טוסט קוטג׳ עם עגבנייה",
    slots: ["breakfast", "snack"], diet: "vegetarian",
    items: [["cottage-cheese", 180], ["whole-wheat-bread", 60], ["tomato", 90], ["cucumber", 80], ["olive-oil", 5]],
    prepEn: "Spread the cottage cheese on toasted bread, top with sliced tomato and cucumber and drizzle with olive oil.",
    prepHe: "מרחו קוטג׳ על לחם קלוי, סדרו מעל עגבנייה ומלפפון פרוסים וזלפו שמן זית."
  },
  {
    id: "protein-oats-berries", en: "Protein Oats with Strawberries", he: "שיבולת שועל חלבונית עם תותים",
    slots: ["breakfast"], diet: "vegetarian",
    items: [["oats", 60], ["protein-powder", 30], ["strawberries", 100], ["almond-butter", 15], ["milk", 200]],
    prepEn: "Cook the oats with milk, stir in the protein powder off the heat, then top with strawberries and almond butter.",
    prepHe: "בשלו את השיבולת שועל בחלב, ערבבו את אבקת החלבון מחוץ לאש, והוסיפו מעל תותים וחמאת שקדים."
  },
  {
    id: "shakshuka-pita", en: "Shakshuka with Pita", he: "שקשוקה עם פיתה",
    slots: ["breakfast", "lunch"], diet: "vegetarian",
    items: [["eggs", 150], ["tomato-sauce", 200], ["bell-pepper", 80], ["onion", 60], ["olive-oil", 8], ["pita", 60]],
    prepEn: "Sauté the onion and pepper, add the tomato sauce and simmer. Crack the eggs on top, cover and cook until set. Serve with pita.",
    prepHe: "טגנו בצל ופלפל, הוסיפו רוטב עגבניות ובשלו. שברו את הביצים מעל, כסו ובשלו עד להתייצבות. הגישו עם פיתה."
  },
  {
    id: "tofu-scramble-toast", en: "Tofu Scramble on Toast", he: "טופו מקושקש על טוסט",
    slots: ["breakfast"], diet: "vegan",
    items: [["tofu", 180], ["spinach", 60], ["bell-pepper", 70], ["whole-wheat-bread", 60], ["olive-oil", 8]],
    prepEn: "Crumble the tofu into a hot pan with the oil, add the vegetables and cook 5 minutes. Pile onto toasted bread.",
    prepHe: "פוררו את הטופו למחבת חמה עם השמן, הוסיפו את הירקות ובשלו 5 דקות. הגישו על לחם קלוי."
  },
  {
    id: "skyr-apple-walnut-bowl", en: "Skyr Bowl with Apple & Walnuts", he: "קערת סקיר עם תפוח ואגוזי מלך",
    slots: ["breakfast", "snack"], diet: "vegetarian",
    items: [["skyr", 220], ["apple", 130], ["walnuts", 20], ["honey", 12], ["cinnamon", 1]],
    prepEn: "Spoon the skyr into a bowl, add diced apple and chopped walnuts, then finish with honey and cinnamon.",
    prepHe: "העבירו את הסקיר לקערה, הוסיפו תפוח קצוץ ואגוזי מלך, וסיימו עם דבש וקינמון."
  },
  {
    id: "banana-oat-protein-smoothie", en: "Banana Oat Protein Smoothie", he: "שייק בננה, שיבולת שועל וחלבון",
    slots: ["breakfast", "snack"], diet: "vegetarian",
    items: [["banana", 120], ["oats", 45], ["protein-powder", 30], ["peanut-butter", 15], ["milk", 250]],
    prepEn: "Blend everything with a few ice cubes until completely smooth.",
    prepHe: "טחנו את כל המרכיבים עם מספר קוביות קרח עד לקבלת מרקם חלק."
  },
  {
    id: "egg-white-veggie-wrap", en: "Egg White & Vegetable Wrap", he: "טורטייה עם חלבוני ביצה וירקות",
    slots: ["breakfast", "lunch"], diet: "vegetarian",
    items: [["egg-whites", 200], ["tortilla", 90], ["spinach", 50], ["tomato", 70], ["cheese", 25]],
    prepEn: "Cook the egg whites with the spinach, spoon into the warmed wrap with tomato and cheese, then roll tightly.",
    prepHe: "בשלו את חלבוני הביצה עם התרד, העבירו לטורטייה מחוממת עם עגבנייה וגבינה וגלגלו היטב."
  },
  {
    id: "cornflakes-milk-banana", en: "Cornflakes with Milk & Banana", he: "קורנפלקס עם חלב ובננה",
    slots: ["breakfast"], diet: "vegetarian",
    items: [["cornflakes", 60], ["milk", 250], ["banana", 110], ["almonds", 15]],
    prepEn: "Pour the milk over the cornflakes and top with sliced banana and almonds.",
    prepHe: "יצקו את החלב על הקורנפלקס והוסיפו מעל בננה פרוסה ושקדים."
  },
  {
    id: "avocado-toast-poached-eggs", en: "Avocado Toast with Poached Eggs", he: "טוסט אבוקדו עם ביצים עלומות",
    slots: ["breakfast"], diet: "vegetarian",
    items: [["whole-wheat-bread", 60], ["avocado", 80], ["eggs", 100], ["tomato", 70], ["olive-oil", 4]],
    prepEn: "Poach the eggs for 3 minutes. Spread mashed avocado on toast, set the eggs on top and add sliced tomato.",
    prepHe: "עלמו את הביצים 3 דקות. מרחו אבוקדו מעוך על הטוסט, הניחו מעל את הביצים והוסיפו עגבנייה פרוסה."
  },
  {
    id: "quinoa-breakfast-bowl", en: "Warm Quinoa Breakfast Bowl", he: "קערת קינואה חמה לבוקר",
    slots: ["breakfast"], diet: "vegetarian",
    items: [["quinoa", 180], ["milk", 150], ["blueberries", 80], ["almonds", 20], ["honey", 12]],
    prepEn: "Warm the cooked quinoa with the milk, then top with blueberries, almonds and honey.",
    prepHe: "חממו את הקינואה המבושלת עם החלב, והוסיפו מעל אוכמניות, שקדים ודבש."
  },
  {
    id: "salmon-cottage-open-sandwich", en: "Salmon & Cottage Open Sandwich", he: "כריך פתוח עם סלמון וקוטג׳",
    slots: ["breakfast", "lunch"], diet: "pescatarian",
    items: [["salmon", 80], ["whole-wheat-bread", 60], ["cottage-cheese", 100], ["cucumber", 80]],
    prepEn: "Spread cottage cheese on the bread, lay the salmon over it and finish with thin cucumber slices.",
    prepHe: "מרחו קוטג׳ על הלחם, הניחו מעל את הסלמון וסיימו עם פרוסות מלפפון דקות."
  },
  {
    id: "vegan-oat-berry-bowl", en: "Vegan Oat & Berry Bowl", he: "קערת שיבולת שועל טבעונית עם פירות יער",
    slots: ["breakfast"], diet: "vegan",
    items: [["oats", 70], ["soy-milk", 220], ["raspberries", 90], ["almond-butter", 18], ["dates", 25]],
    prepEn: "Cook the oats in the soy milk, then top with raspberries, almond butter and chopped dates.",
    prepHe: "בשלו את השיבולת שועל במשקה הסויה, והוסיפו מעל פטל, חמאת שקדים ותמרים קצוצים."
  },

  // The block below exists to keep every diet x allergy combination able to
  // fill 3 breakfast options. Breakfast is the thinnest slot once gluten,
  // dairy and nuts are all excluded, so these are deliberately built from
  // naturally free-from ingredients.
  {
    id: "vegan-oat-banana-tahini-bowl", en: "Oat, Banana & Tahini Bowl", he: "קערת שיבולת שועל, בננה וטחינה",
    slots: ["breakfast"], diet: "vegan",
    items: [["oats", 70], ["oat-milk", 220], ["banana", 120], ["tahini", 20], ["dates", 25]],
    prepEn: "Cook the oats in the oat milk, then top with sliced banana, a swirl of tahini and chopped dates.",
    prepHe: "בשלו את השיבולת שועל במשקה השיבולת, והוסיפו מעל בננה פרוסה, טפטוף טחינה ותמרים קצוצים."
  },
  {
    id: "tofu-veggie-breakfast-bowl", en: "Tofu & Roasted Vegetable Breakfast Bowl", he: "קערת בוקר טופו וירקות צלויים",
    slots: ["breakfast"], diet: "vegan",
    items: [["tofu", 180], ["sweet-potato", 180], ["spinach", 70], ["avocado", 60], ["olive-oil", 8]],
    prepEn: "Roast the sweet potato cubes, sear the crumbled tofu with turmeric, wilt the spinach and top with sliced avocado.",
    prepHe: "צלו קוביות בטטה, צרבו את הטופו המפורר עם כורכום, הוסיפו את התרד וסדרו מעל אבוקדו פרוס."
  },
  {
    id: "quinoa-berry-breakfast-vegan", en: "Vegan Quinoa & Berry Breakfast", he: "ארוחת בוקר קינואה ופירות יער טבעונית",
    slots: ["breakfast"], diet: "vegan",
    items: [["quinoa", 190], ["oat-milk", 180], ["blueberries", 90], ["dates", 30], ["cinnamon", 1]],
    prepEn: "Warm the cooked quinoa with the oat milk, then stir through blueberries, chopped dates and cinnamon.",
    prepHe: "חממו את הקינואה המבושלת עם משקה השיבולת, וערבבו פנימה אוכמניות, תמרים קצוצים וקינמון."
  },
  {
    id: "chickpea-scramble-potato", en: "Chickpea Scramble with Potatoes", he: "חביתת חומוס עם תפוחי אדמה",
    slots: ["breakfast"], diet: "vegan",
    items: [["chickpeas", 200], ["potato", 200], ["bell-pepper", 80], ["spinach", 60], ["olive-oil", 10]],
    prepEn: "Pan-roast the diced potato until golden, add mashed chickpeas, pepper and spinach and cook 5 more minutes.",
    prepHe: "השחימו קוביות תפוח אדמה במחבת, הוסיפו חומוס מעוך, פלפל ותרד ובשלו 5 דקות נוספות."
  },
  {
    id: "eggs-potato-spinach-skillet", en: "Egg, Potato & Spinach Skillet", he: "מחבת ביצים, תפוח אדמה ותרד",
    slots: ["breakfast"], diet: "vegetarian",
    items: [["eggs", 150], ["potato", 200], ["spinach", 80], ["tomato", 90], ["olive-oil", 10]],
    prepEn: "Fry the diced potato until crisp, add the spinach and tomato, then crack the eggs on top and cover until set.",
    prepHe: "טגנו קוביות תפוח אדמה עד להזהבה, הוסיפו תרד ועגבנייה, שברו מעל את הביצים וכסו עד להתייצבות."
  },
  {
    id: "omelette-sweet-potato-avocado", en: "Omelette with Sweet Potato & Avocado", he: "חביתה עם בטטה ואבוקדו",
    slots: ["breakfast"], diet: "vegetarian",
    items: [["eggs", 150], ["sweet-potato", 180], ["avocado", 70], ["tomato", 80], ["olive-oil", 8]],
    prepEn: "Roast the sweet potato, cook a plain omelette and serve with sliced avocado and tomato on the side.",
    prepHe: "צלו את הבטטה, הכינו חביתה פשוטה והגישו עם אבוקדו ועגבנייה פרוסים בצד."
  },
  {
    id: "greek-yogurt-fruit-honey", en: "Greek Yogurt with Fruit & Honey", he: "יוגורט יווני עם פירות ודבש",
    slots: ["breakfast", "snack"], diet: "vegetarian",
    items: [["greek-yogurt", 230], ["banana", 110], ["blueberries", 80], ["honey", 15]],
    prepEn: "Spoon the yogurt into a bowl and top with sliced banana, blueberries and honey.",
    prepHe: "העבירו את היוגורט לקערה והוסיפו מעל בננה פרוסה, אוכמניות ודבש."
  },
  {
    id: "dates-tahini-oat-bites", en: "Date & Tahini Oat Bites", he: "כדורי תמרים, טחינה ושיבולת שועל",
    slots: ["snack"], diet: "vegan",
    items: [["dates", 70], ["tahini", 25], ["oats", 45], ["cinnamon", 1]],
    prepEn: "Blend the dates with the tahini, fold in the oats and cinnamon, roll into balls and chill 20 minutes.",
    prepHe: "טחנו את התמרים עם הטחינה, ערבבו פנימה שיבולת שועל וקינמון, גלגלו לכדורים וקררו 20 דקות."
  },
  {
    id: "banana-oat-energy-balls", en: "Banana Oat Energy Balls", he: "כדורי אנרגיה בננה ושיבולת שועל",
    slots: ["snack"], diet: "vegan",
    items: [["oats", 55], ["banana", 120], ["dates", 45], ["cinnamon", 1]],
    prepEn: "Mash the banana with the chopped dates, mix in the oats and cinnamon, shape into balls and chill.",
    prepHe: "מעכו את הבננה עם תמרים קצוצים, ערבבו שיבולת שועל וקינמון, עצבו לכדורים וקררו."
  },

  // ================= LUNCH / DINNER =================
  {
    id: "grilled-chicken-rice-broccoli", en: "Grilled Chicken, Rice & Broccoli", he: "חזה עוף בגריל, אורז וברוקולי",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["chicken-breast", 160], ["white-rice", 200], ["broccoli", 140], ["olive-oil", 8]],
    prepEn: "Season and grill the chicken 6 minutes per side. Steam the broccoli and serve alongside the rice with a drizzle of olive oil.",
    prepHe: "תבלו וצלו את העוף 6 דקות מכל צד. אדו את הברוקולי והגישו לצד האורז עם זילוף שמן זית."
  },
  {
    id: "chicken-sweet-potato-green-beans", en: "Chicken, Sweet Potato & Green Beans", he: "עוף, בטטה ושעועית ירוקה",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["chicken-breast", 160], ["sweet-potato", 220], ["green-beans", 130], ["olive-oil", 8]],
    prepEn: "Roast the sweet potato cubes 25 minutes at 200°C. Pan-sear the chicken and steam the green beans.",
    prepHe: "צלו קוביות בטטה 25 דקות ב-200 מעלות. צרבו את העוף במחבת ואדו את השעועית הירוקה."
  },
  {
    id: "salmon-quinoa-asparagus", en: "Baked Salmon, Quinoa & Asparagus", he: "סלמון בתנור, קינואה ואספרגוס",
    slots: ["lunch", "dinner"], diet: "pescatarian",
    items: [["salmon", 150], ["quinoa", 180], ["asparagus", 120], ["olive-oil", 8]],
    prepEn: "Bake the salmon 12-14 minutes at 200°C. Roast the asparagus alongside and serve over the quinoa.",
    prepHe: "אפו את הסלמון 12-14 דקות ב-200 מעלות. צלו את האספרגוס לצדו והגישו על מצע קינואה."
  },
  {
    id: "beef-rice-peppers", en: "Beef, Rice & Sautéed Peppers", he: "בקר, אורז ופלפלים מוקפצים",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["lean-beef", 150], ["white-rice", 200], ["bell-pepper", 100], ["onion", 60], ["olive-oil", 8]],
    prepEn: "Brown the beef, add the peppers and onion and cook until soft. Serve over the rice.",
    prepHe: "השחימו את הבקר, הוסיפו פלפלים ובצל ובשלו עד לריכוך. הגישו על מצע אורז."
  },
  {
    id: "turkey-pasta-tomato", en: "Turkey Pasta in Tomato Sauce", he: "פסטה עם הודו ברוטב עגבניות",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["turkey-breast", 150], ["whole-wheat-pasta", 200], ["tomato-sauce", 150], ["zucchini", 100], ["olive-oil", 8]],
    prepEn: "Cook the turkey strips with the zucchini, add the tomato sauce, then toss with the drained pasta.",
    prepHe: "בשלו רצועות הודו עם הקישוא, הוסיפו רוטב עגבניות וערבבו עם הפסטה המסוננת."
  },
  {
    id: "tuna-pasta-salad", en: "Tuna Pasta Salad", he: "סלט פסטה עם טונה",
    slots: ["lunch"], diet: "pescatarian",
    items: [["tuna", 120], ["whole-wheat-pasta", 180], ["corn", 70], ["tomato", 100], ["olive-oil", 10]],
    prepEn: "Toss the cooled pasta with flaked tuna, corn and diced tomato, then dress with olive oil.",
    prepHe: "ערבבו את הפסטה המצוננת עם טונה מפוררת, תירס ועגבנייה קצוצה, ותבלו בשמן זית."
  },
  {
    id: "chicken-couscous-roasted-veg", en: "Chicken with Couscous & Roasted Vegetables", he: "עוף עם קוסקוס וירקות צלויים",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["chicken-breast", 160], ["couscous", 200], ["zucchini", 100], ["bell-pepper", 90], ["olive-oil", 10]],
    prepEn: "Roast the vegetables 20 minutes at 200°C, grill the chicken and serve everything over the couscous.",
    prepHe: "צלו את הירקות 20 דקות ב-200 מעלות, צלו את העוף והגישו הכל על מצע קוסקוס."
  },
  {
    id: "tofu-stir-fry-brown-rice", en: "Tofu Stir-Fry with Brown Rice", he: "טופו מוקפץ עם אורז מלא",
    slots: ["lunch", "dinner"], diet: "vegan",
    items: [["tofu", 200], ["brown-rice", 200], ["broccoli", 120], ["carrots", 80], ["olive-oil", 10]],
    prepEn: "Sear the tofu cubes until golden, add the vegetables and stir-fry 5 minutes. Serve over brown rice.",
    prepHe: "צרבו קוביות טופו עד להזהבה, הוסיפו את הירקות והקפיצו 5 דקות. הגישו על אורז מלא."
  },
  {
    id: "lentil-stew-rice", en: "Lentil Stew with Rice", he: "תבשיל עדשים עם אורז",
    slots: ["lunch", "dinner"], diet: "vegan",
    items: [["lentils", 250], ["white-rice", 180], ["carrots", 90], ["onion", 70], ["olive-oil", 10]],
    prepEn: "Sauté the onion and carrot, add the cooked lentils and simmer 10 minutes. Serve with rice.",
    prepHe: "טגנו בצל וגזר, הוסיפו את העדשים המבושלות ובשלו 10 דקות. הגישו עם אורז."
  },
  {
    id: "chickpea-curry-basmati", en: "Chickpea Curry with Basmati", he: "קארי חומוס עם אורז בסמטי",
    slots: ["lunch", "dinner"], diet: "vegan",
    items: [["chickpeas", 220], ["basmati-rice", 200], ["spinach", 80], ["tomato-sauce", 120], ["olive-oil", 10]],
    prepEn: "Simmer the chickpeas in the tomato sauce with your curry spices, stir in the spinach and serve over rice.",
    prepHe: "בשלו את החומוס ברוטב עגבניות עם תבליני קארי, הוסיפו את התרד והגישו על אורז."
  },
  {
    id: "steak-potato-salad", en: "Steak with Potatoes & Garden Salad", he: "סטייק עם תפוחי אדמה וסלט",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["steak", 150], ["potato", 220], ["lettuce", 60], ["tomato", 90], ["olive-oil", 10]],
    prepEn: "Grill the steak to your liking and rest 5 minutes. Serve with roasted potatoes and a dressed salad.",
    prepHe: "צלו את הסטייק לפי טעמכם והניחו לו 5 דקות. הגישו עם תפוחי אדמה צלויים וסלט מתובל."
  },
  {
    id: "cod-potato-broccoli", en: "Baked Cod with Potato & Broccoli", he: "בקלה בתנור עם תפוח אדמה וברוקולי",
    slots: ["lunch", "dinner"], diet: "pescatarian",
    items: [["cod", 180], ["potato", 220], ["broccoli", 130], ["olive-oil", 10]],
    prepEn: "Bake the cod 12 minutes at 200°C with lemon. Serve with roasted potato and steamed broccoli.",
    prepHe: "אפו את הבקלה 12 דקות ב-200 מעלות עם לימון. הגישו עם תפוח אדמה צלוי וברוקולי מאודה."
  },
  {
    id: "shrimp-garlic-pasta", en: "Garlic Shrimp Pasta", he: "פסטה שרימפס ושום",
    slots: ["lunch", "dinner"], diet: "pescatarian",
    items: [["shrimp", 160], ["pasta", 200], ["zucchini", 100], ["olive-oil", 12]],
    prepEn: "Sauté the shrimp with garlic and zucchini for 4 minutes, then toss through the hot pasta.",
    prepHe: "טגנו את השרימפס עם שום וקישוא 4 דקות, וערבבו עם הפסטה החמה."
  },
  {
    id: "chicken-shawarma-pita", en: "Chicken Shawarma Pita", he: "פיתה שווארמה עוף",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["chicken-thigh", 150], ["pita", 60], ["hummus", 60], ["cucumber", 70], ["tomato", 70]],
    prepEn: "Cook the seasoned chicken strips in a hot pan. Spread hummus inside the pita, fill with chicken and chopped salad.",
    prepHe: "בשלו רצועות עוף מתובלות במחבת חמה. מרחו חומוס בתוך הפיתה, מלאו בעוף ובסלט קצוץ."
  },
  {
    id: "beef-burrito-bowl", en: "Beef Burrito Bowl", he: "קערת בוריטו בקר",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["lean-beef", 140], ["brown-rice", 180], ["black-beans", 100], ["corn", 60], ["salsa", 50], ["avocado", 50]],
    prepEn: "Brown the seasoned beef. Build the bowl with rice, beans, corn, beef, then top with salsa and avocado.",
    prepHe: "השחימו את הבקר המתובל. הרכיבו את הקערה עם אורז, שעועית, תירס ובשר, וסיימו עם סלסה ואבוקדו."
  },
  {
    id: "tilapia-bulgur-salad", en: "Tilapia with Bulgur Salad", he: "אמנון עם סלט בורגול",
    slots: ["lunch", "dinner"], diet: "pescatarian",
    items: [["tilapia", 180], ["bulgur", 200], ["cucumber", 90], ["tomato", 90], ["olive-oil", 10]],
    prepEn: "Pan-fry the tilapia 4 minutes per side. Mix the bulgur with diced cucumber, tomato and olive oil.",
    prepHe: "טגנו את האמנון 4 דקות מכל צד. ערבבו את הבורגול עם מלפפון, עגבנייה ושמן זית."
  },
  {
    id: "turkey-club-sandwich", en: "Turkey Club Sandwich", he: "כריך הודו",
    slots: ["lunch"], diet: "omnivore",
    items: [["turkey-breast", 130], ["whole-wheat-bread", 90], ["lettuce", 40], ["tomato", 70], ["cheese", 30], ["mustard", 10]],
    prepEn: "Layer the turkey, cheese, lettuce and tomato between the bread slices with a spread of mustard.",
    prepHe: "סדרו את ההודו, הגבינה, החסה והעגבנייה בין פרוסות הלחם עם מריחת חרדל."
  },
  {
    id: "seitan-noodle-stir-fry", en: "Seitan Noodle Stir-Fry", he: "אטריות מוקפצות עם סייטן",
    slots: ["lunch", "dinner"], diet: "vegan",
    items: [["seitan", 160], ["whole-wheat-pasta", 190], ["cabbage", 90], ["carrots", 80], ["olive-oil", 10]],
    prepEn: "Stir-fry the seitan strips with the cabbage and carrot, then toss with the cooked noodles.",
    prepHe: "הקפיצו רצועות סייטן עם כרוב וגזר, וערבבו עם האטריות המבושלות."
  },
  {
    id: "chicken-caesar-style-salad", en: "Chicken Caesar-Style Salad", he: "סלט קיסר עם עוף",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["chicken-breast", 170], ["lettuce", 120], ["parmesan", 25], ["whole-wheat-bread", 30], ["olive-oil", 12]],
    prepEn: "Grill and slice the chicken. Toss the lettuce with olive oil and parmesan, add the chicken and toasted bread croutons.",
    prepHe: "צלו ופרסו את העוף. ערבבו את החסה עם שמן זית ופרמזן, הוסיפו את העוף וקרוטונים מלחם קלוי."
  },
  {
    id: "tempeh-quinoa-kale-bowl", en: "Tempeh, Quinoa & Kale Bowl", he: "קערת טמפה, קינואה וקייל",
    slots: ["lunch", "dinner"], diet: "vegan",
    items: [["tempeh", 150], ["quinoa", 180], ["kale", 80], ["sweet-potato", 120], ["tahini", 15]],
    prepEn: "Roast the tempeh and sweet potato 20 minutes. Massage the kale with a little oil and assemble with a tahini drizzle.",
    prepHe: "צלו את הטמפה והבטטה 20 דקות. עסו את הקייל עם מעט שמן והרכיבו עם זילוף טחינה."
  },
  {
    id: "egg-fried-rice-vegetables", en: "Egg Fried Rice with Vegetables", he: "אורז מוקפץ עם ביצה וירקות",
    slots: ["lunch", "dinner"], diet: "vegetarian",
    items: [["eggs", 150], ["white-rice", 220], ["peas", 80], ["carrots", 70], ["onion", 50], ["olive-oil", 10]],
    prepEn: "Stir-fry the vegetables, push aside and scramble the eggs in the pan, then fold in the cold rice.",
    prepHe: "הקפיצו את הירקות, הזיזו הצידה וקשקשו את הביצים במחבת, ולבסוף ערבבו פנימה את האורז הקר."
  },
  {
    id: "salmon-sweet-potato-spinach", en: "Salmon, Sweet Potato & Spinach", he: "סלמון, בטטה ותרד",
    slots: ["lunch", "dinner"], diet: "pescatarian",
    items: [["salmon", 150], ["sweet-potato", 200], ["spinach", 100], ["olive-oil", 8]],
    prepEn: "Roast the sweet potato, pan-sear the salmon skin-side down, and wilt the spinach in the same pan.",
    prepHe: "צלו את הבטטה, צרבו את הסלמון על צד העור, וטגנו את התרד באותה מחבת."
  },
  {
    id: "chicken-quinoa-mediterranean", en: "Mediterranean Chicken Quinoa Bowl", he: "קערת קינואה ים תיכונית עם עוף",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["chicken-breast", 160], ["quinoa", 190], ["cucumber", 90], ["tomato", 90], ["olive-oil", 10]],
    prepEn: "Grill the chicken with oregano. Serve over quinoa with chopped cucumber, tomato and olive oil.",
    prepHe: "צלו את העוף עם אורגנו. הגישו על קינואה עם מלפפון ועגבנייה קצוצים ושמן זית."
  },
  {
    id: "beef-lentil-chili-rice", en: "Beef & Lentil Chili with Rice", he: "צ׳ילי בקר ועדשים עם אורז",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["lean-beef", 130], ["lentils", 150], ["white-rice", 180], ["tomato-sauce", 120], ["onion", 60]],
    prepEn: "Brown the beef with onion, add lentils and tomato sauce and simmer 15 minutes. Serve over rice.",
    prepHe: "השחימו את הבקר עם הבצל, הוסיפו עדשים ורוטב עגבניות ובשלו 15 דקות. הגישו על אורז."
  },
  {
    id: "tuna-rice-avocado-bowl", en: "Tuna, Rice & Avocado Bowl", he: "קערת טונה, אורז ואבוקדו",
    slots: ["lunch", "dinner"], diet: "pescatarian",
    items: [["tuna", 140], ["jasmine-rice", 200], ["avocado", 70], ["cucumber", 80]],
    prepEn: "Arrange the flaked tuna, sliced avocado and cucumber over warm rice.",
    prepHe: "סדרו את הטונה המפוררת, אבוקדו פרוס ומלפפון על מצע אורז חם."
  },
  {
    id: "chicken-tortilla-wrap", en: "Chicken Tortilla Wrap", he: "טורטייה במילוי עוף",
    slots: ["lunch"], diet: "omnivore",
    items: [["chicken-breast", 150], ["tortilla", 90], ["lettuce", 40], ["tomato", 70], ["cheese", 25]],
    prepEn: "Fill the warmed tortilla with sliced grilled chicken, lettuce, tomato and cheese, then roll tightly.",
    prepHe: "מלאו את הטורטייה המחוממת בעוף צלוי פרוס, חסה, עגבנייה וגבינה וגלגלו היטב."
  },
  {
    id: "mushroom-spinach-pasta", en: "Mushroom & Spinach Pasta", he: "פסטה פטריות ותרד",
    slots: ["lunch", "dinner"], diet: "vegetarian",
    items: [["whole-wheat-pasta", 220], ["mushrooms", 140], ["spinach", 80], ["parmesan", 30], ["olive-oil", 12]],
    prepEn: "Sauté the mushrooms until golden, wilt in the spinach, toss with pasta and finish with parmesan.",
    prepHe: "טגנו את הפטריות עד להזהבה, הוסיפו את התרד, ערבבו עם הפסטה וסיימו עם פרמזן."
  },
  {
    id: "baked-potato-cottage-cheese", en: "Baked Potato with Cottage Cheese", he: "תפוח אדמה אפוי עם קוטג׳",
    slots: ["lunch", "dinner"], diet: "vegetarian",
    items: [["potato", 280], ["cottage-cheese", 180], ["broccoli", 120], ["olive-oil", 8]],
    prepEn: "Bake the potato 45 minutes at 200°C, split it open and fill with cottage cheese. Serve with steamed broccoli.",
    prepHe: "אפו את תפוח האדמה 45 דקות ב-200 מעלות, חצו ומלאו בקוטג׳. הגישו עם ברוקולי מאודה."
  },
  {
    id: "black-bean-quinoa-bowl", en: "Black Bean & Quinoa Bowl", he: "קערת שעועית שחורה וקינואה",
    slots: ["lunch", "dinner"], diet: "vegan",
    items: [["black-beans", 200], ["quinoa", 190], ["corn", 70], ["bell-pepper", 80], ["avocado", 60], ["salsa", 50]],
    prepEn: "Warm the beans with spices and build the bowl over quinoa with corn, pepper, avocado and salsa.",
    prepHe: "חממו את השעועית עם תבלינים והרכיבו את הקערה על קינואה עם תירס, פלפל, אבוקדו וסלסה."
  },
  {
    id: "chicken-basmati-spinach", en: "Chicken with Basmati & Spinach", he: "עוף עם אורז בסמטי ותרד",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["chicken-breast", 170], ["basmati-rice", 200], ["spinach", 110], ["olive-oil", 10]],
    prepEn: "Sear the chicken, then wilt the spinach in the same pan with garlic. Serve over basmati rice.",
    prepHe: "צרבו את העוף, וטגנו את התרד באותה מחבת עם שום. הגישו על אורז בסמטי."
  },
  {
    id: "steak-bulgur-asparagus", en: "Steak with Bulgur & Asparagus", he: "סטייק עם בורגול ואספרגוס",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["steak", 150], ["bulgur", 210], ["asparagus", 120], ["olive-oil", 10]],
    prepEn: "Grill the steak and rest it. Roast the asparagus and serve both over the bulgur.",
    prepHe: "צלו את הסטייק והניחו לו לנוח. צלו את האספרגוס והגישו את שניהם על הבורגול."
  },
  {
    id: "edamame-tofu-rice-bowl", en: "Edamame & Tofu Rice Bowl", he: "קערת אורז עם אדממה וטופו",
    slots: ["lunch", "dinner"], diet: "vegan",
    items: [["edamame", 150], ["tofu", 150], ["brown-rice", 190], ["carrots", 80], ["olive-oil", 8]],
    prepEn: "Sear the tofu, warm the edamame and arrange both over brown rice with julienned carrot.",
    prepHe: "צרבו את הטופו, חממו את האדממה וסדרו את שניהם על אורז מלא עם גזר חתוך לרצועות."
  },
  {
    id: "turkey-sweet-potato-hash", en: "Turkey & Sweet Potato Hash", he: "מוקפץ הודו ובטטה",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["turkey-breast", 160], ["sweet-potato", 220], ["bell-pepper", 90], ["onion", 60], ["olive-oil", 10]],
    prepEn: "Dice and pan-roast the sweet potato until tender, then add the turkey, pepper and onion and cook through.",
    prepHe: "חתכו לקוביות והשחימו את הבטטה במחבת עד לריכוך, הוסיפו את ההודו, הפלפל והבצל ובשלו."
  },
  {
    id: "kidney-bean-pasta-bake", en: "Kidney Bean Pasta Bake", he: "פסטה אפויה עם שעועית אדומה",
    slots: ["lunch", "dinner"], diet: "vegetarian",
    items: [["kidney-beans", 180], ["whole-wheat-pasta", 200], ["tomato-sauce", 150], ["mozzarella", 50]],
    prepEn: "Mix the pasta, beans and sauce in a dish, cover with mozzarella and bake 15 minutes at 200°C.",
    prepHe: "ערבבו את הפסטה, השעועית והרוטב בתבנית, כסו במוצרלה ואפו 15 דקות ב-200 מעלות."
  },
  {
    id: "chicken-hummus-bowl", en: "Chicken Hummus Bowl", he: "קערת חומוס עם עוף",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["chicken-breast", 150], ["hummus", 100], ["pita", 60], ["cucumber", 80], ["tomato", 80], ["olive-oil", 8]],
    prepEn: "Spread the hummus in a wide bowl, top with warm sliced chicken and chopped salad, serve with pita.",
    prepHe: "מרחו את החומוס בקערה רחבה, סדרו מעל עוף חם פרוס וסלט קצוץ, והגישו עם פיתה."
  },
  {
    id: "tofu-cauliflower-rice-curry", en: "Tofu & Cauliflower Curry with Rice", he: "קארי טופו וכרובית עם אורז",
    slots: ["lunch", "dinner"], diet: "vegan",
    items: [["tofu", 180], ["cauliflower", 150], ["white-rice", 190], ["tomato-sauce", 120], ["olive-oil", 10]],
    prepEn: "Sear the tofu, add cauliflower and tomato sauce with curry spices and simmer 12 minutes. Serve with rice.",
    prepHe: "צרבו את הטופו, הוסיפו כרובית ורוטב עגבניות עם תבליני קארי ובשלו 12 דקות. הגישו עם אורז."
  },
  {
    id: "salmon-couscous-zucchini", en: "Salmon with Couscous & Zucchini", he: "סלמון עם קוסקוס וקישואים",
    slots: ["lunch", "dinner"], diet: "pescatarian",
    items: [["salmon", 150], ["couscous", 200], ["zucchini", 120], ["olive-oil", 8]],
    prepEn: "Pan-sear the salmon, sauté the zucchini with garlic and serve both over fluffy couscous.",
    prepHe: "צרבו את הסלמון, טגנו את הקישואים עם שום והגישו את שניהם על קוסקוס תפוח."
  },
  {
    id: "chicken-potato-carrot-tray", en: "Chicken, Potato & Carrot Tray Bake", he: "מגש אפייה עוף, תפוח אדמה וגזר",
    slots: ["lunch", "dinner"], diet: "omnivore",
    items: [["chicken-thigh", 160], ["potato", 220], ["carrots", 110], ["olive-oil", 10]],
    prepEn: "Toss everything with oil and herbs on one tray and roast 35 minutes at 200°C, turning once.",
    prepHe: "ערבבו הכל עם שמן ותבלינים במגש אחד וצלו 35 דקות ב-200 מעלות, הפכו פעם אחת."
  },

  // ================= SNACKS =================
  {
    id: "greek-yogurt-honey-almonds", en: "Greek Yogurt with Honey & Almonds", he: "יוגורט יווני עם דבש ושקדים",
    slots: ["snack"], diet: "vegetarian",
    items: [["greek-yogurt", 200], ["honey", 15], ["almonds", 20]],
    prepEn: "Stir the honey through the yogurt and scatter the almonds on top.",
    prepHe: "ערבבו את הדבש ביוגורט ופזרו מעל שקדים."
  },
  {
    id: "rice-cakes-peanut-butter-banana", en: "Rice Cakes with Peanut Butter & Banana", he: "פריכיות עם חמאת בוטנים ובננה",
    slots: ["snack"], diet: "vegan",
    items: [["rice-cakes", 27], ["peanut-butter", 25], ["banana", 100]],
    prepEn: "Spread peanut butter over the rice cakes and top with banana slices.",
    prepHe: "מרחו חמאת בוטנים על הפריכיות והוסיפו מעל פרוסות בננה."
  },
  {
    id: "cottage-cheese-fruit-bowl", en: "Cottage Cheese & Fruit Bowl", he: "קערת קוטג׳ ופירות",
    slots: ["snack"], diet: "vegetarian",
    items: [["cottage-cheese", 200], ["peach", 130], ["walnuts", 15], ["honey", 10]],
    prepEn: "Spoon the cottage cheese into a bowl and top with sliced peach, walnuts and honey.",
    prepHe: "העבירו את הקוטג׳ לקערה והוסיפו מעל אפרסק פרוס, אגוזי מלך ודבש."
  },
  {
    id: "protein-shake-banana", en: "Banana Protein Shake", he: "שייק חלבון בננה",
    slots: ["snack"], diet: "vegetarian",
    items: [["protein-powder", 30], ["banana", 120], ["milk", 250]],
    prepEn: "Blend all three with ice until smooth.",
    prepHe: "טחנו את שלושת המרכיבים עם קרח עד לקבלת מרקם חלק."
  },
  {
    id: "hummus-veggie-sticks", en: "Hummus with Vegetable Sticks", he: "חומוס עם מקלות ירקות",
    slots: ["snack"], diet: "vegan",
    items: [["hummus", 100], ["carrots", 100], ["cucumber", 100], ["pita", 30]],
    prepEn: "Cut the vegetables into sticks and serve alongside the hummus with warm pita.",
    prepHe: "חתכו את הירקות למקלות והגישו לצד החומוס עם פיתה חמה."
  },
  {
    id: "apple-almond-butter", en: "Apple Slices with Almond Butter", he: "פרוסות תפוח עם חמאת שקדים",
    slots: ["snack"], diet: "vegan",
    items: [["apple", 160], ["almond-butter", 25], ["cinnamon", 1]],
    prepEn: "Slice the apple, spread with almond butter and dust with cinnamon.",
    prepHe: "פרסו את התפוח, מרחו חמאת שקדים ופזרו קינמון."
  },
  {
    id: "tuna-rice-cakes", en: "Tuna on Rice Cakes", he: "טונה על פריכיות",
    slots: ["snack"], diet: "pescatarian",
    items: [["tuna", 100], ["rice-cakes", 27], ["cucumber", 70], ["olive-oil", 5]],
    prepEn: "Mix the tuna with olive oil, pile onto the rice cakes and top with cucumber slices.",
    prepHe: "ערבבו את הטונה עם שמן זית, הניחו על הפריכיות והוסיפו מעל פרוסות מלפפון."
  },
  {
    id: "dark-chocolate-nuts-fruit", en: "Dark Chocolate, Nuts & Grapes", he: "שוקולד מריר, אגוזים וענבים",
    slots: ["snack"], diet: "vegan",
    items: [["dark-chocolate", 20], ["cashews", 25], ["grapes", 120]],
    prepEn: "Serve together as a simple plate — no preparation needed.",
    prepHe: "הגישו יחד כצלחת פשוטה — ללא צורך בהכנה."
  },
  {
    id: "skyr-berries-bowl", en: "Skyr with Mixed Berries", he: "סקיר עם פירות יער",
    slots: ["snack"], diet: "vegetarian",
    items: [["skyr", 220], ["strawberries", 90], ["blueberries", 70], ["honey", 10]],
    prepEn: "Top the skyr with the berries and a drizzle of honey.",
    prepHe: "הוסיפו מעל הסקיר את פירות היער וזילוף דבש."
  },
  {
    id: "edamame-snack-bowl", en: "Edamame Snack Bowl", he: "קערת אדממה",
    slots: ["snack"], diet: "vegan",
    items: [["edamame", 180], ["olive-oil", 5]],
    prepEn: "Steam the edamame 5 minutes, drizzle with oil and sprinkle with coarse salt.",
    prepHe: "אדו את האדממה 5 דקות, זלפו שמן ופזרו מלח גס."
  },
  {
    id: "cheese-crackers-grapes", en: "Cheese, Rice Cakes & Grapes", he: "גבינה, פריכיות וענבים",
    slots: ["snack"], diet: "vegetarian",
    items: [["cheese", 40], ["rice-cakes", 27], ["grapes", 120]],
    prepEn: "Arrange the cheese on the rice cakes and serve with grapes on the side.",
    prepHe: "סדרו את הגבינה על הפריכיות והגישו עם ענבים בצד."
  },
  {
    id: "chocolate-protein-oat-bites", en: "Chocolate Protein Oat Bites", he: "כדורי שיבולת שועל וחלבון",
    slots: ["snack"], diet: "vegetarian",
    items: [["oats", 50], ["protein-powder", 25], ["peanut-butter", 25], ["dates", 30], ["dark-chocolate", 10]],
    prepEn: "Blitz everything into a sticky dough, roll into balls and chill 20 minutes before eating.",
    prepHe: "טחנו הכל לבצק דביק, גלגלו לכדורים וקררו 20 דקות לפני האכילה."
  }
];

const round5 = value => Math.max(5, Math.round(value / 5) * 5);

function foodOrThrow(key) {
  const food = FOODS[key];
  if (!food) throw new Error(`Unknown food key in meal catalog: ${key}`);
  return food;
}

function macrosFor(key, grams) {
  const food = foodOrThrow(key);
  const factor = grams / 100;
  return {
    calories: food.kcal * factor,
    proteinGrams: food.p * factor,
    carbsGrams: food.c * factor,
    fatGrams: food.f * factor
  };
}

function baseTotals(meal) {
  return meal.items.reduce(
    (totals, [key, grams]) => {
      const macros = macrosFor(key, grams);
      totals.calories += macros.calories;
      totals.proteinGrams += macros.proteinGrams;
      totals.carbsGrams += macros.carbsGrams;
      totals.fatGrams += macros.fatGrams;
      return totals;
    },
    { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
  );
}

function deriveSets(meal) {
  const allergens = new Set();
  const nutrients = new Set();
  meal.items.forEach(([key]) => {
    const food = foodOrThrow(key);
    (food.alg || []).forEach(value => allergens.add(value));
    (food.nut || []).forEach(value => nutrients.add(value));
  });
  return { allergens: [...allergens], nutrients: [...nutrients] };
}

// Resolved once at require time: a meal only advertises a plate photo when the
// file is actually on disk. Meals still awaiting a photo get image: null so the
// UI renders its gradient fallback instead of a broken <img>.
const MEAL_IMAGE_DIR = path.join(__dirname, "..", "public", "images", "meals");

function resolveMealImage(mealId) {
  for (const ext of [".png", ".jpg"]) {
    if (fs.existsSync(path.join(MEAL_IMAGE_DIR, `${mealId}${ext}`))) {
      return `/images/meals/${mealId}${ext}`;
    }
  }
  return null;
}

// Built once at require time so every lookup is a plain array read, and any
// typo in a food key fails loudly on boot rather than mid-request.
const CATALOG = MEALS.map(meal => {
  const totals = baseTotals(meal);
  const { allergens, nutrients } = deriveSets(meal);
  return {
    ...meal,
    allergens,
    nutrients,
    baseCalories: Math.round(totals.calories),
    baseProtein: Math.round(totals.proteinGrams),
    baseCarbs: Math.round(totals.carbsGrams),
    baseFat: Math.round(totals.fatGrams),
    image: resolveMealImage(meal.id)
  };
});

const CATALOG_BY_ID = new Map(CATALOG.map(meal => [meal.id, meal]));

const DIET_ALLOWS = {
  vegan: ["vegan"],
  vegetarian: ["vegan", "vegetarian"],
  pescatarian: ["vegan", "vegetarian", "pescatarian"],
  omnivore: ["vegan", "vegetarian", "pescatarian", "omnivore"]
};

// Free-text allergy/avoid input -> allergen keys used on the foods above.
const ALLERGEN_PATTERNS = [
  [/\b(dairy|milk|lactose|cheese)\b|חלב|לקטוז|גבינה/i, "dairy"],
  [/\b(gluten|wheat|celiac|coeliac)\b|גלוטן|חיטה|צליאק/i, "gluten"],
  [/\b(nut|nuts|almond|walnut|cashew|pistachio)\b|אגוז|שקד|קשיו/i, "nuts"],
  [/\b(peanut|peanuts)\b|בוטן/i, "peanuts"],
  [/\b(egg|eggs)\b|ביצ/i, "eggs"],
  [/\b(fish|salmon|tuna|cod|tilapia)\b|דג|סלמון|טונה/i, "fish"],
  [/\b(shellfish|shrimp|prawn)\b|שרימפס|פירות ים/i, "shellfish"],
  [/\b(soy|soya|tofu|edamame)\b|סויה|טופו/i, "soy"],
  [/\b(sesame|tahini)\b|שומשום|טחינה/i, "sesame"]
];

function detectAllergens(...texts) {
  const combined = texts.filter(Boolean).join(" ");
  if (!combined.trim()) return [];
  return ALLERGEN_PATTERNS.filter(([pattern]) => pattern.test(combined)).map(([, key]) => key);
}

// Conditions the nutrition builder already collects -> nutrients to favour.
const CONDITION_NUTRIENTS = {
  ironDeficiencyAnemia: "iron",
  b12Deficiency: "b12",
  vitaminDDeficiency: "vitaminD"
};

function filterMeals({ diet = "omnivore", excludeAllergens = [], slot = null } = {}) {
  const allowedDiets = DIET_ALLOWS[String(diet).toLowerCase()] || DIET_ALLOWS.omnivore;
  return CATALOG.filter(meal => {
    if (!allowedDiets.includes(meal.diet)) return false;
    if (slot && !meal.slots.includes(slot)) return false;
    if (excludeAllergens.some(allergen => meal.allergens.includes(allergen))) return false;
    return true;
  });
}

function formatAmount(key, grams, isHebrew) {
  const food = foodOrThrow(key);
  if (food.piece) {
    const pieces = Math.max(1, Math.round(grams / food.piece.g));
    const labels = isHebrew ? food.piece.he : food.piece.en;
    const label = pieces === 1 ? labels[0] : labels[1];
    return `${pieces} ${label} (${pieces * food.piece.g} ${isHebrew ? "גרם" : "g"})`;
  }
  return `${grams} ${isHebrew ? "גרם" : "g"}`;
}

// Snaps a scaled amount to something a person can actually measure: whole
// pieces for sliceable/countable foods, 5g steps for everything else.
function snapAmount(key, grams) {
  const food = foodOrThrow(key);
  if (food.piece) {
    const pieces = Math.max(1, Math.round(grams / food.piece.g));
    return pieces * food.piece.g;
  }
  if (grams < 20) return Math.max(1, Math.round(grams));
  return round5(grams);
}

/**
 * Expands a catalog meal into a full plan option, scaled toward a calorie
 * target. Totals are recomputed from the snapped amounts so the numbers the
 * user sees always add up to the numbers actually on the plate.
 */
function buildMealOption(mealId, { targetCalories, isHebrew = false, optionNumber = 1, foodImages = {} } = {}) {
  const meal = CATALOG_BY_ID.get(mealId);
  if (!meal) return null;

  const rawScale = targetCalories ? targetCalories / meal.baseCalories : 1;
  const scale = Math.min(1.6, Math.max(0.6, rawScale));

  const foods = meal.items.map(([key, baseGrams]) => {
    const food = foodOrThrow(key);
    const grams = snapAmount(key, baseGrams * scale);
    const macros = macrosFor(key, grams);
    return {
      name: isHebrew ? food.he : food.en,
      imageKey: food.img,
      imageUrl: foodImages[food.img] || "/images/food-placeholder.png",
      amount: formatAmount(key, grams, isHebrew),
      grams,
      calories: Math.round(macros.calories),
      proteinGrams: Math.round(macros.proteinGrams),
      carbsGrams: Math.round(macros.carbsGrams),
      fatGrams: Math.round(macros.fatGrams)
    };
  });

  // Totals are summed from the already-rounded per-food values (not from the
  // raw floats) so the numbers in the ingredient rows always add up to the
  // headline number the user sees. Rounding each separately drifted by up to
  // 2 kcal/g, which reads as a mistake on screen.
  const sumOf = key => foods.reduce((total, food) => total + food[key], 0);

  return {
    optionNumber,
    mealId: meal.id,
    mealName: isHebrew ? meal.he : meal.en,
    mealImage: meal.image,
    preparation: isHebrew ? meal.prepHe : meal.prepEn,
    nutrients: meal.nutrients,
    foods,
    optionCalories: sumOf("calories"),
    optionProteinGrams: sumOf("proteinGrams"),
    optionCarbsGrams: sumOf("carbsGrams"),
    optionFatGrams: sumOf("fatGrams")
  };
}

/** Compact one-line-per-meal listing for the selection prompt. */
function catalogForPrompt(meals, isHebrew = false) {
  return meals
    .map(meal => {
      const tags = [meal.diet, ...meal.nutrients].join(",");
      return `${meal.id} | ${isHebrew ? meal.he : meal.en} | ${meal.baseCalories}kcal P${meal.baseProtein} C${meal.baseCarbs} F${meal.baseFat} | ${meal.slots.join("/")} | ${tags}`;
    })
    .join("\n");
}

function getMealById(mealId) {
  return CATALOG_BY_ID.get(mealId) || null;
}

// Which slots a day of N meals is made of, and how much of the daily
// calorie budget each slot carries relative to the others.
const SLOT_SEQUENCE = {
  2: ["breakfast", "dinner"],
  3: ["breakfast", "lunch", "dinner"],
  4: ["breakfast", "lunch", "snack", "dinner"],
  5: ["breakfast", "snack", "lunch", "snack", "dinner"],
  6: ["breakfast", "snack", "lunch", "snack", "dinner", "snack"],
  7: ["breakfast", "snack", "lunch", "snack", "dinner", "snack", "snack"],
  8: ["breakfast", "snack", "lunch", "snack", "lunch", "snack", "dinner", "snack"]
};

const SLOT_LABELS = {
  breakfast: { en: "Breakfast", he: "ארוחת בוקר" },
  lunch: { en: "Lunch", he: "ארוחת צהריים" },
  dinner: { en: "Dinner", he: "ארוחת ערב" },
  snack: { en: "Snack", he: "ארוחת ביניים" }
};

const SLOT_WEIGHTS = { breakfast: 1, lunch: 1.15, dinner: 1.1, snack: 0.5 };

function buildMealSlots(mealsPerDay, isHebrew = false) {
  const sequence = SLOT_SEQUENCE[mealsPerDay] || SLOT_SEQUENCE[3];
  const counts = {};
  return sequence.map((slot, index) => {
    counts[slot] = (counts[slot] || 0) + 1;
    const label = SLOT_LABELS[slot];
    const base = isHebrew ? label.he : label.en;
    const repeated = sequence.filter(entry => entry === slot).length > 1;
    return {
      mealNumber: index + 1,
      slot,
      name: repeated ? `${base} ${counts[slot]}` : base,
      weight: SLOT_WEIGHTS[slot]
    };
  });
}

/**
 * Server-side meal picker. Used to top up whatever the model didn't return
 * (or returned invalid), so a plan is always complete even if the model
 * misbehaves. Ranks by closeness to the calorie target, nudged toward meals
 * carrying a nutrient the user's diagnosed condition calls for.
 */
function selectMeals({ pool, slot, targetCalories, count = 3, exclude = [], preferNutrients = [] } = {}) {
  const excluded = new Set(exclude);
  return pool
    .filter(meal => meal.slots.includes(slot) && !excluded.has(meal.id))
    .map(meal => {
      const calorieGap = Math.abs(meal.baseCalories - targetCalories) / Math.max(1, targetCalories);
      const nutrientHits = preferNutrients.filter(nutrient => meal.nutrients.includes(nutrient)).length;
      return { meal, score: calorieGap - nutrientHits * 0.25 };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map(entry => entry.meal.id);
}

module.exports = {
  FOODS,
  CATALOG,
  buildMealOption,
  buildMealSlots,
  catalogForPrompt,
  detectAllergens,
  filterMeals,
  getMealById,
  selectMeals,
  CONDITION_NUTRIENTS
};
