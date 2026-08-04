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
const { resolveFoodImage, FOOD_PLACEHOLDER_IMAGE } = require("./food-image-map");

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

// Ingredients added for the expanded catalog. Their image keys deliberately
// reuse an existing ingredient photo when a dedicated thumbnail is not yet
// available; new plate images are handled independently by the meal fallback.
Object.assign(FOODS, {
  mackerel: { en: "Smoked mackerel", he: "Smoked mackerel", img: "salmon", kcal: 205, p: 19, c: 0, f: 14, nut: ["b12", "vitaminD"] },
  "rye-bread": { en: "Rye bread", he: "Rye bread", img: "whole wheat bread", kcal: 259, p: 8.5, c: 48, f: 3.3, alg: ["gluten"], piece: { g: 35, en: ["slice", "slices"], he: ["slice", "slices"] } },
  lemon: { en: "Lemon", he: "Lemon", img: "orange", kcal: 29, p: 1.1, c: 9, f: 0.3 },
  "buckwheat-flour": { en: "Buckwheat flour", he: "Buckwheat flour", img: "oats", kcal: 335, p: 13.6, c: 71.5, f: 3.1, alg: ["gluten"] },
  kefir: { en: "Kefir", he: "Kefir", img: "yogurt", kcal: 59, p: 3.3, c: 4.8, f: 3.1, alg: ["dairy"], nut: ["b12"] },
  "whole-grain-flour": { en: "Whole-grain flour", he: "Whole-grain flour", img: "whole wheat bread", kcal: 340, p: 13, c: 72, f: 2.5, alg: ["gluten"] },
  "corn-tortilla": { en: "Corn tortilla", he: "Corn tortilla", img: "tortilla", kcal: 218, p: 5.7, c: 45, f: 2.9 },
  "chia-seeds": { en: "Chia seeds", he: "Chia seeds", img: "chia seeds", kcal: 486, p: 16.5, c: 42, f: 30.7, nut: ["iron"] },
  farro: { en: "Farro (cooked)", he: "Farro", img: "brown rice", kcal: 125, p: 5, c: 26, f: 1.5, alg: ["gluten"] },
  basil: { en: "Basil", he: "Basil", img: "spinach", kcal: 23, p: 3.2, c: 2.7, f: 0.6 },
  herbs: { en: "Fresh herbs", he: "Fresh herbs", img: "spinach", kcal: 25, p: 2.5, c: 4, f: 0.5 },
  polenta: { en: "Polenta (cooked)", he: "Polenta", img: "couscous", kcal: 70, p: 1.6, c: 15, f: 0.3 },
  "white-beans": { en: "White beans (cooked)", he: "White beans", img: "white beans", kcal: 139, p: 9.7, c: 25, f: 0.4, nut: ["iron"] },
  lamb: { en: "Lean lamb", he: "Lean lamb", img: "steak", kcal: 206, p: 27, c: 0, f: 10, nut: ["b12", "iron"] },
  celery: { en: "Celery", he: "Celery", img: "celery", kcal: 16, p: 0.7, c: 3, f: 0.2 },
  olives: { en: "Olives", he: "Olives", img: "olive oil", kcal: 115, p: 0.8, c: 6, f: 11 },
  haddock: { en: "Haddock fillet", he: "Haddock", img: "cod", kcal: 90, p: 20, c: 0, f: 0.7, nut: ["b12"] },
  sardines: { en: "Sardines", he: "Sardines", img: "tuna", kcal: 208, p: 25, c: 0, f: 11, nut: ["b12", "vitaminD"] },
  beetroot: { en: "Beetroot", he: "Beetroot", img: "beetroot", kcal: 43, p: 1.6, c: 10, f: 0.2 },
  trout: { en: "Trout fillet", he: "Trout", img: "salmon", kcal: 148, p: 20.5, c: 0, f: 6.5, nut: ["b12", "vitaminD"] },
  mussels: { en: "Mussels", he: "Mussels", img: "shrimp", kcal: 86, p: 12, c: 4, f: 2.2, nut: ["b12"] },
  "soba-noodles": { en: "Soba noodles (cooked)", he: "Soba noodles", img: "whole wheat pasta", kcal: 99, p: 5, c: 21, f: 0.1, alg: ["gluten"] },
  miso: { en: "Miso", he: "Miso", img: "soy milk", kcal: 199, p: 12, c: 26, f: 6 },
  halloumi: { en: "Halloumi", he: "Halloumi", img: "cheese", kcal: 321, p: 22, c: 3.4, f: 25, alg: ["dairy"], nut: ["b12"] },
  quark: { en: "Quark", he: "Quark", img: "cottage cheese", kcal: 67, p: 12, c: 4, f: 0.2, alg: ["dairy"], nut: ["b12"] },
  cocoa: { en: "Unsweetened cocoa", he: "Cocoa", img: "dark chocolate", kcal: 228, p: 20, c: 58, f: 14 },
  "broad-beans": { en: "Broad beans (cooked)", he: "Broad beans", img: "peas", kcal: 110, p: 7.6, c: 20, f: 0.4, nut: ["iron"] },
  "lupin-beans": { en: "Lupin beans", he: "Lupin beans", img: "chickpeas", kcal: 119, p: 16.4, c: 10, f: 2.9, nut: ["iron"] },
  watermelon: { en: "Watermelon", he: "Watermelon", img: "watermelon", kcal: 30, p: 0.6, c: 7.6, f: 0.2 },
  mint: { en: "Mint", he: "Mint", img: "spinach", kcal: 44, p: 3.3, c: 8.4, f: 0.7 },
  dill: { en: "Dill", he: "Dill", img: "spinach", kcal: 43, p: 3.5, c: 7, f: 1.1 },
  labneh: { en: "Labneh", he: "Labneh", img: "greek yogurt", kcal: 150, p: 8, c: 6, f: 10, alg: ["dairy"], nut: ["b12"] },
  ricotta: { en: "Ricotta", he: "Ricotta", img: "ricotta", kcal: 174, p: 11, c: 3, f: 13, alg: ["dairy"], nut: ["b12"] },
  cream: { en: "Cream cheese", he: "Cream cheese", img: "cream cheese", kcal: 342, p: 6, c: 4, f: 34, alg: ["dairy"], nut: ["b12"] },
  feta: { en: "Feta", he: "Feta", img: "feta", kcal: 264, p: 14, c: 4, f: 21, alg: ["dairy"], nut: ["b12"] }
});

// diet: the strictest pattern a meal already satisfies.
// vegan ⊂ vegetarian ⊂ pescatarian ⊂ omnivore when matching a user's choice.
const MEALS = [
  // ================= EXPANSION: 50 SEARCHABLE MEALS =================
  { id: "turkey-spinach-breakfast-muffins", en: "Turkey Spinach Breakfast Muffins", he: "Turkey Spinach Breakfast Muffins", slots: ["breakfast"], diet: "omnivore", items: [["turkey-breast", 120], ["eggs", 100], ["spinach", 70], ["bell-pepper", 60], ["onion", 35]], prepEn: "Bake turkey, egg and vegetables in a muffin tin until set.", prepHe: "Bake turkey, egg and vegetables until set." },
  { id: "savory-cottage-cheese-herb-pancakes", en: "Savory Cottage Cheese Herb Pancakes", he: "Savory Cottage Cheese Herb Pancakes", slots: ["breakfast"], diet: "vegetarian", items: [["cottage-cheese", 150], ["eggs", 100], ["whole-grain-flour", 45], ["herbs", 8], ["tomato", 100]], prepEn: "Mix the batter, cook small pancakes and serve with tomato.", prepHe: "Mix the batter, cook small pancakes and serve with tomato." },
  { id: "ricotta-berry-wholegrain-toast", en: "Ricotta Berry Wholegrain Toast", he: "Ricotta Berry Wholegrain Toast", slots: ["breakfast"], diet: "vegetarian", items: [["whole-wheat-bread", 60], ["ricotta", 100], ["strawberries", 70], ["blueberries", 70]], prepEn: "Toast the bread and top with ricotta and berries.", prepHe: "Toast the bread and top with ricotta and berries." },
  { id: "egg-black-bean-breakfast-tacos", en: "Egg and Black Bean Breakfast Tacos", he: "Egg and Black Bean Breakfast Tacos", slots: ["breakfast"], diet: "vegetarian", items: [["eggs", 100], ["black-beans", 100], ["corn-tortilla", 60], ["tomato", 80], ["avocado", 50]], prepEn: "Warm the tortillas, fill with scrambled egg, beans, tomato and avocado.", prepHe: "Warm the tortillas and fill with egg, beans, tomato and avocado." },
  { id: "smoked-mackerel-rye-breakfast-plate", en: "Smoked Mackerel Rye Breakfast Plate", he: "Smoked Mackerel Rye Breakfast Plate", slots: ["breakfast"], diet: "pescatarian", items: [["mackerel", 100], ["rye-bread", 70], ["cucumber", 100], ["tomato", 80], ["lemon", 15]], prepEn: "Serve the mackerel with rye bread, cucumber, tomato and lemon.", prepHe: "Serve the mackerel with rye bread, cucumber, tomato and lemon." },
  { id: "buckwheat-banana-protein-pancakes", en: "Buckwheat Banana Protein Pancakes", he: "Buckwheat Banana Protein Pancakes", slots: ["breakfast"], diet: "vegetarian", items: [["buckwheat-flour", 55], ["banana", 100], ["eggs", 50], ["milk", 120], ["protein-powder", 20]], prepEn: "Blend the batter and cook pancakes on a lightly heated pan.", prepHe: "Blend the batter and cook pancakes on a lightly heated pan." },
  { id: "quinoa-egg-stuffed-peppers", en: "Quinoa Egg Stuffed Peppers", he: "Quinoa Egg Stuffed Peppers", slots: ["breakfast"], diet: "vegetarian", items: [["quinoa", 140], ["eggs", 100], ["bell-pepper", 160], ["spinach", 60], ["herbs", 6]], prepEn: "Fill halved peppers with quinoa, egg and spinach, then bake until set.", prepHe: "Fill peppers with quinoa, egg and spinach, then bake until set." },
  { id: "labneh-cucumber-zaatar-toast", en: "Labneh Cucumber Za'atar Toast", he: "Labneh Cucumber Za'atar Toast", slots: ["breakfast"], diet: "vegetarian", items: [["whole-wheat-bread", 60], ["labneh", 100], ["cucumber", 100], ["tomato", 60], ["herbs", 5]], prepEn: "Spread labneh on toast and top with cucumber, tomato and herbs.", prepHe: "Spread labneh on toast and top with cucumber, tomato and herbs." },
  { id: "high-protein-french-toast-berries", en: "High Protein French Toast with Berries", he: "High Protein French Toast with Berries", slots: ["breakfast"], diet: "vegetarian", items: [["whole-wheat-bread", 90], ["eggs", 100], ["milk", 80], ["strawberries", 80], ["blueberries", 60], ["cinnamon", 1]], prepEn: "Dip the bread in egg and milk, cook until golden and serve with berries.", prepHe: "Dip bread in egg and milk, cook until golden and serve with berries." },
  { id: "kefir-mango-chia-cup", en: "Kefir Mango Chia Cup", he: "Kefir Mango Chia Cup", slots: ["breakfast"], diet: "vegetarian", items: [["kefir", 250], ["mango", 130], ["chia-seeds", 18], ["cinnamon", 1]], prepEn: "Stir chia into kefir, chill briefly and top with mango and cinnamon.", prepHe: "Stir chia into kefir, chill briefly and top with mango and cinnamon." },

  { id: "lemon-garlic-chicken-orzo-bowl", en: "Lemon Garlic Chicken Orzo Bowl", he: "Lemon Garlic Chicken Orzo Bowl", slots: ["lunch", "dinner"], diet: "omnivore", items: [["chicken-breast", 170], ["pasta", 190], ["spinach", 70], ["tomato", 100], ["lemon", 15]], prepEn: "Cook the chicken and pasta, then fold through spinach, tomato and lemon.", prepHe: "Cook the chicken and pasta, then fold through spinach, tomato and lemon." },
  { id: "chicken-caprese-farro-salad", en: "Chicken Caprese Farro Salad", he: "Chicken Caprese Farro Salad", slots: ["lunch", "dinner"], diet: "omnivore", items: [["chicken-breast", 160], ["farro", 180], ["tomato", 120], ["mozzarella", 45], ["basil", 8]], prepEn: "Combine sliced chicken, farro, tomato, mozzarella and basil.", prepHe: "Combine chicken, farro, tomato, mozzarella and basil." },
  { id: "chicken-tzatziki-souvlaki-box", en: "Chicken Tzatziki Souvlaki Box", he: "Chicken Tzatziki Souvlaki Box", slots: ["lunch", "dinner"], diet: "omnivore", items: [["chicken-breast", 170], ["bulgur", 180], ["cucumber", 100], ["tomato", 100], ["greek-yogurt", 80]], prepEn: "Grill the chicken and serve with bulgur, cucumber, tomato and yogurt sauce.", prepHe: "Grill the chicken and serve with bulgur, cucumber, tomato and yogurt sauce." },
  { id: "chicken-peanut-satay-noodle-salad", en: "Chicken Peanut Satay Noodle Salad", he: "Chicken Peanut Satay Noodle Salad", slots: ["lunch", "dinner"], diet: "omnivore", items: [["chicken-breast", 160], ["whole-wheat-pasta", 180], ["carrots", 70], ["cucumber", 80], ["peanut-butter", 20]], prepEn: "Cook the chicken and noodles, then toss with vegetables and peanut sauce.", prepHe: "Cook chicken and noodles, then toss with vegetables and peanut sauce." },
  { id: "turkey-zucchini-meatballs-polenta", en: "Turkey Zucchini Meatballs with Polenta", he: "Turkey Zucchini Meatballs with Polenta", slots: ["lunch", "dinner"], diet: "omnivore", items: [["turkey-breast", 170], ["zucchini", 120], ["polenta", 220], ["tomato-sauce", 120]], prepEn: "Shape turkey and zucchini meatballs, simmer in tomato sauce and serve over polenta.", prepHe: "Shape turkey and zucchini meatballs, simmer in tomato sauce and serve over polenta." },
  { id: "turkey-lettuce-taco-cups", en: "Turkey Lettuce Taco Cups", he: "Turkey Lettuce Taco Cups", slots: ["lunch", "dinner"], diet: "omnivore", items: [["turkey-breast", 160], ["lettuce", 100], ["black-beans", 100], ["tomato", 90], ["corn", 60]], prepEn: "Cook the turkey and fill lettuce cups with beans, tomato and corn.", prepHe: "Cook turkey and fill lettuce cups with beans, tomato and corn." },
  { id: "turkey-white-bean-kale-soup", en: "Turkey White Bean Kale Soup", he: "Turkey White Bean Kale Soup", slots: ["lunch", "dinner"], diet: "omnivore", items: [["turkey-breast", 150], ["white-beans", 170], ["kale", 80], ["carrots", 80], ["tomato", 120]], prepEn: "Simmer turkey, beans, kale, carrots and tomato until tender.", prepHe: "Simmer turkey, beans, kale, carrots and tomato until tender." },
  { id: "beef-kofta-bulgur-tabbouleh", en: "Beef Kofta Bulgur Tabbouleh", he: "Beef Kofta Bulgur Tabbouleh", slots: ["lunch", "dinner"], diet: "omnivore", items: [["lean-beef", 160], ["bulgur", 180], ["herbs", 15], ["tomato", 100], ["cucumber", 80]], prepEn: "Shape and cook the kofta, then serve with bulgur, tomato and cucumber salad.", prepHe: "Shape and cook kofta, then serve with bulgur and tomato cucumber salad." },
  { id: "beef-mushroom-barley-stew", en: "Beef Mushroom Barley Stew", he: "Beef Mushroom Barley Stew", slots: ["lunch", "dinner"], diet: "omnivore", items: [["lean-beef", 160], ["farro", 170], ["mushrooms", 120], ["carrots", 80], ["celery", 60]], prepEn: "Simmer beef, grain, mushrooms, carrots and celery into a hearty stew.", prepHe: "Simmer beef, grain, mushrooms, carrots and celery into a hearty stew." },
  { id: "sesame-beef-lettuce-wraps", en: "Sesame Beef Lettuce Wraps", he: "Sesame Beef Lettuce Wraps", slots: ["lunch", "dinner"], diet: "omnivore", items: [["lean-beef", 160], ["lettuce", 100], ["carrots", 80], ["bell-pepper", 80], ["tahini", 18]], prepEn: "Cook the beef and vegetables, spoon into lettuce leaves and finish with tahini.", prepHe: "Cook beef and vegetables, spoon into lettuce leaves and finish with tahini." },
  { id: "lamb-chickpea-couscous-bowl", en: "Lamb Chickpea Couscous Bowl", he: "Lamb Chickpea Couscous Bowl", slots: ["lunch", "dinner"], diet: "omnivore", items: [["lamb", 150], ["chickpeas", 120], ["couscous", 170], ["tomato", 100], ["herbs", 8]], prepEn: "Brown the lamb and serve with chickpeas, couscous, tomato and herbs.", prepHe: "Brown lamb and serve with chickpeas, couscous, tomato and herbs." },
  { id: "cod-tomato-olive-stew", en: "Cod Tomato Olive Stew", he: "Cod Tomato Olive Stew", slots: ["lunch", "dinner"], diet: "pescatarian", items: [["cod", 180], ["tomato", 150], ["olives", 25], ["bell-pepper", 80], ["potato", 180]], prepEn: "Simmer the vegetables and olives, then gently poach the cod until flaky.", prepHe: "Simmer vegetables and olives, then gently poach cod until flaky." },
  { id: "haddock-pea-potato-plate", en: "Haddock Pea Potato Plate", he: "Haddock Pea Potato Plate", slots: ["lunch", "dinner"], diet: "pescatarian", items: [["haddock", 180], ["potato", 220], ["peas", 100], ["spinach", 70], ["lemon", 15]], prepEn: "Bake the haddock and serve with potato, peas, spinach and lemon.", prepHe: "Bake haddock and serve with potato, peas, spinach and lemon." },
  { id: "sardine-tomato-white-bean-toast", en: "Sardine Tomato White Bean Toast", he: "Sardine Tomato White Bean Toast", slots: ["lunch"], diet: "pescatarian", items: [["sardines", 100], ["whole-wheat-bread", 60], ["white-beans", 120], ["tomato", 100], ["herbs", 8]], prepEn: "Mash beans onto toast and top with sardines, tomato and herbs.", prepHe: "Mash beans onto toast and top with sardines, tomato and herbs." },
  { id: "mackerel-beet-potato-salad", en: "Mackerel Beet Potato Salad", he: "Mackerel Beet Potato Salad", slots: ["lunch"], diet: "pescatarian", items: [["mackerel", 120], ["beetroot", 120], ["potato", 180], ["cucumber", 80], ["greek-yogurt", 60]], prepEn: "Combine cooked potato and beetroot with cucumber, yogurt and mackerel.", prepHe: "Combine potato and beetroot with cucumber, yogurt and mackerel." },
  { id: "prawn-mango-quinoa-salad", en: "Prawn Mango Quinoa Salad", he: "Prawn Mango Quinoa Salad", slots: ["lunch"], diet: "pescatarian", items: [["shrimp", 180], ["quinoa", 170], ["mango", 100], ["cucumber", 80], ["bell-pepper", 70]], prepEn: "Cook the prawns and toss with quinoa, mango, cucumber and peppers.", prepHe: "Cook prawns and toss with quinoa, mango, cucumber and peppers." },
  { id: "shrimp-corn-avocado-salad", en: "Shrimp Corn Avocado Salad", he: "Shrimp Corn Avocado Salad", slots: ["lunch"], diet: "pescatarian", items: [["shrimp", 180], ["corn", 80], ["avocado", 70], ["tomato", 100], ["lettuce", 70]], prepEn: "Combine cooked shrimp with corn, avocado, tomato and lettuce.", prepHe: "Combine shrimp with corn, avocado, tomato and lettuce." },
  { id: "salmon-lentil-beet-salad", en: "Salmon Lentil Beet Salad", he: "Salmon Lentil Beet Salad", slots: ["lunch", "dinner"], diet: "pescatarian", items: [["salmon", 150], ["lentils", 170], ["beetroot", 100], ["spinach", 70], ["lemon", 15]], prepEn: "Roast the salmon and serve over lentils, beetroot, spinach and lemon.", prepHe: "Roast salmon and serve over lentils, beetroot, spinach and lemon." },
  { id: "trout-barley-green-bean-bowl", en: "Trout Barley Green Bean Bowl", he: "Trout Barley Green Bean Bowl", slots: ["lunch", "dinner"], diet: "pescatarian", items: [["trout", 170], ["farro", 180], ["green-beans", 100], ["tomato", 80], ["herbs", 8]], prepEn: "Bake the trout and build a bowl with grain, green beans, tomato and herbs.", prepHe: "Bake trout and build a bowl with grain, green beans, tomato and herbs." },
  { id: "mussel-tomato-wholegrain-pasta", en: "Mussel Tomato Wholegrain Pasta", he: "Mussel Tomato Wholegrain Pasta", slots: ["lunch", "dinner"], diet: "pescatarian", items: [["mussels", 180], ["whole-wheat-pasta", 200], ["tomato", 130], ["spinach", 60], ["herbs", 6]], prepEn: "Steam the mussels and toss with wholegrain pasta, tomato and spinach.", prepHe: "Steam mussels and toss with pasta, tomato and spinach." },
  { id: "tempeh-lettuce-cups-peanut-lime", en: "Tempeh Lettuce Cups with Peanut Lime", he: "Tempeh Lettuce Cups with Peanut Lime", slots: ["lunch", "dinner"], diet: "vegan", items: [["tempeh", 170], ["lettuce", 100], ["carrots", 80], ["cucumber", 80], ["peanut-butter", 18], ["lemon", 15]], prepEn: "Crisp the tempeh and spoon it into lettuce cups with vegetables and peanut dressing.", prepHe: "Crisp tempeh and spoon into lettuce cups with vegetables and peanut dressing." },
  { id: "seitan-fajita-bowl", en: "Seitan Fajita Bowl", he: "Seitan Fajita Bowl", slots: ["lunch", "dinner"], diet: "vegan", items: [["seitan", 170], ["bell-pepper", 100], ["onion", 60], ["black-beans", 100], ["corn", 60], ["lettuce", 60]], prepEn: "Sauté seitan, peppers and onion, then serve with beans, corn and lettuce.", prepHe: "Sauté seitan, peppers and onion, then serve with beans, corn and lettuce." },
  { id: "tofu-miso-soba-soup", en: "Tofu Miso Soba Soup", he: "Tofu Miso Soba Soup", slots: ["lunch", "dinner"], diet: "vegan", items: [["tofu", 170], ["soba-noodles", 170], ["mushrooms", 100], ["spinach", 70], ["miso", 20]], prepEn: "Simmer miso broth, add noodles and mushrooms, then finish with tofu and spinach.", prepHe: "Simmer miso broth, add noodles and mushrooms, then finish with tofu and spinach." },
  { id: "tofu-greek-salad-pita", en: "Tofu Greek Salad Pita", he: "Tofu Greek Salad Pita", slots: ["lunch"], diet: "vegan", items: [["tofu", 170], ["pita", 60], ["cucumber", 100], ["tomato", 120], ["olives", 20]], prepEn: "Warm the tofu and fill pita with cucumber, tomato and olives.", prepHe: "Warm tofu and fill pita with cucumber, tomato and olives." },
  { id: "lentil-walnut-bolognese", en: "Lentil Walnut Bolognese", he: "Lentil Walnut Bolognese", slots: ["lunch", "dinner"], diet: "vegan", items: [["lentils", 180], ["walnuts", 25], ["whole-wheat-pasta", 200], ["tomato", 120], ["mushrooms", 100]], prepEn: "Simmer lentils, walnuts, mushrooms and tomato, then spoon over pasta.", prepHe: "Simmer lentils, walnuts, mushrooms and tomato, then spoon over pasta." },
  { id: "white-bean-spinach-tomato-stew", en: "White Bean Spinach Tomato Stew", he: "White Bean Spinach Tomato Stew", slots: ["lunch", "dinner"], diet: "vegan", items: [["white-beans", 190], ["spinach", 100], ["tomato", 160], ["carrots", 80], ["herbs", 8]], prepEn: "Simmer beans, tomato and carrots, then fold in spinach and herbs.", prepHe: "Simmer beans, tomato and carrots, then fold in spinach and herbs." },
  { id: "black-bean-stuffed-sweet-potatoes", en: "Black Bean Stuffed Sweet Potatoes", he: "Black Bean Stuffed Sweet Potatoes", slots: ["lunch", "dinner"], diet: "vegan", items: [["sweet-potato", 250], ["black-beans", 150], ["corn", 70], ["tomato", 90], ["avocado", 50]], prepEn: "Bake the sweet potato and fill it with warm beans, corn, tomato and avocado.", prepHe: "Bake sweet potato and fill with beans, corn, tomato and avocado." },
  { id: "chickpea-quinoa-patties-yogurt", en: "Chickpea Quinoa Patties with Yogurt", he: "Chickpea Quinoa Patties with Yogurt", slots: ["lunch", "dinner"], diet: "vegetarian", items: [["chickpeas", 150], ["quinoa", 130], ["eggs", 50], ["herbs", 8], ["greek-yogurt", 70]], prepEn: "Shape chickpea quinoa patties, pan-cook and serve with yogurt.", prepHe: "Shape chickpea quinoa patties, pan-cook and serve with yogurt." },
  { id: "cauliflower-lentil-shepherds-pie", en: "Cauliflower Lentil Shepherd's Pie", he: "Cauliflower Lentil Shepherd's Pie", slots: ["lunch", "dinner"], diet: "vegan", items: [["lentils", 180], ["cauliflower", 220], ["carrots", 80], ["peas", 80], ["tomato", 120]], prepEn: "Cook the lentil filling, top with mashed cauliflower and bake until golden.", prepHe: "Cook lentil filling, top with mashed cauliflower and bake until golden." },
  { id: "halloumi-roasted-vegetable-couscous", en: "Halloumi Roasted Vegetable Couscous", he: "Halloumi Roasted Vegetable Couscous", slots: ["lunch", "dinner"], diet: "vegetarian", items: [["halloumi", 80], ["couscous", 180], ["zucchini", 100], ["bell-pepper", 90], ["tomato", 100]], prepEn: "Roast the vegetables, grill the halloumi and serve over couscous.", prepHe: "Roast vegetables, grill halloumi and serve over couscous." },

  { id: "baked-apple-cinnamon-quark-cup", en: "Baked Apple Cinnamon Quark Cup", he: "Baked Apple Cinnamon Quark Cup", slots: ["snack"], diet: "vegetarian", items: [["apple", 160], ["quark", 170], ["cinnamon", 1], ["walnuts", 15]], prepEn: "Bake the apple with cinnamon and serve with quark and walnuts.", prepHe: "Bake apple with cinnamon and serve with quark and walnuts." },
  { id: "cocoa-banana-cottage-cheese-mousse", en: "Cocoa Banana Cottage Cheese Mousse", he: "Cocoa Banana Cottage Cheese Mousse", slots: ["snack"], diet: "vegetarian", items: [["cottage-cheese", 180], ["banana", 100], ["cocoa", 8], ["cinnamon", 1]], prepEn: "Blend cottage cheese, banana and cocoa until smooth.", prepHe: "Blend cottage cheese, banana and cocoa until smooth." },
  { id: "spicy-roasted-broad-beans", en: "Spicy Roasted Broad Beans", he: "Spicy Roasted Broad Beans", slots: ["snack"], diet: "vegan", items: [["broad-beans", 160], ["olive-oil", 8], ["herbs", 5]], prepEn: "Toss broad beans with oil and herbs and roast until crisp.", prepHe: "Toss broad beans with oil and herbs and roast until crisp." },
  { id: "mini-caprese-chickpea-cups", en: "Mini Caprese Chickpea Cups", he: "Mini Caprese Chickpea Cups", slots: ["snack"], diet: "vegetarian", items: [["chickpeas", 130], ["tomato", 100], ["mozzarella", 45], ["basil", 8]], prepEn: "Spoon chickpeas into cups and top with tomato, mozzarella and basil.", prepHe: "Spoon chickpeas into cups and top with tomato, mozzarella and basil." },
  { id: "skyr-cucumber-herb-dip-plate", en: "Skyr Cucumber Herb Dip Plate", he: "Skyr Cucumber Herb Dip Plate", slots: ["snack"], diet: "vegetarian", items: [["skyr", 180], ["cucumber", 120], ["herbs", 8], ["carrots", 80], ["bell-pepper", 70]], prepEn: "Stir herbs into skyr and serve as a dip with fresh vegetables.", prepHe: "Stir herbs into skyr and serve as a dip with fresh vegetables." },
  { id: "turkey-cucumber-rollups", en: "Turkey Cucumber Rollups", he: "Turkey Cucumber Rollups", slots: ["snack"], diet: "omnivore", items: [["turkey-breast", 120], ["cucumber", 100], ["cream", 35], ["herbs", 5]], prepEn: "Spread the turkey with cream cheese, add cucumber and roll with herbs.", prepHe: "Spread turkey with cream cheese, add cucumber and roll with herbs." },
  { id: "smoked-salmon-cucumber-bites", en: "Smoked Salmon Cucumber Bites", he: "Smoked Salmon Cucumber Bites", slots: ["snack"], diet: "pescatarian", items: [["salmon", 110], ["cucumber", 120], ["greek-yogurt", 50], ["dill", 5]], prepEn: "Top cucumber slices with yogurt, salmon and dill.", prepHe: "Top cucumber slices with yogurt, salmon and dill." },
  { id: "chia-cocoa-raspberry-pudding", en: "Chia Cocoa Raspberry Pudding", he: "Chia Cocoa Raspberry Pudding", slots: ["snack"], diet: "vegetarian", items: [["chia-seeds", 25], ["milk", 220], ["cocoa", 8], ["raspberries", 90]], prepEn: "Stir chia and cocoa into milk, chill until thick and top with raspberries.", prepHe: "Stir chia and cocoa into milk, chill until thick and top with raspberries." },
  { id: "crunchy-lupin-bean-salad-cup", en: "Crunchy Lupin Bean Salad Cup", he: "Crunchy Lupin Bean Salad Cup", slots: ["snack"], diet: "vegan", items: [["lupin-beans", 150], ["cucumber", 80], ["tomato", 90], ["lemon", 15], ["herbs", 8]], prepEn: "Toss lupin beans with cucumber, tomato, lemon and herbs.", prepHe: "Toss lupin beans with cucumber, tomato, lemon and herbs." },
  { id: "watermelon-feta-mint-cup", en: "Watermelon Feta Mint Cup", he: "Watermelon Feta Mint Cup", slots: ["snack"], diet: "vegetarian", items: [["watermelon", 220], ["feta", 45], ["mint", 6], ["cucumber", 80]], prepEn: "Cube the watermelon and cucumber, then finish with feta and mint.", prepHe: "Cube watermelon and cucumber, then finish with feta and mint." },
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
    image: "/images/meals/turkey-sweet-potato-hash.png",
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
    image: "/images/meals/edamame-snack-bowl.png",
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

// The expansion is authored in English for reviewability, but the public
// builder must never fall back to English meal titles when Hebrew is active.
// Keep canonical ids and ingredient keys English while translating only the
// display copy here.
const HEBREW_MEAL_NAMES = Object.freeze({
  "turkey-spinach-breakfast-muffins": "מאפינס הודו ותרד לארוחת בוקר",
  "savory-cottage-cheese-herb-pancakes": "פנקייק גבינה וקוטג׳ עם עשבי תיבול",
  "ricotta-berry-wholegrain-toast": "טוסט דגנים מלאים עם ריקוטה ופירות יער",
  "egg-black-bean-breakfast-tacos": "טאקוס ביצה ושעועית שחורה",
  "smoked-mackerel-rye-breakfast-plate": "צלחת בוקר עם מקרל מעושן ולחם שיפון",
  "buckwheat-banana-protein-pancakes": "פנקייק חלבון עם כוסמת ובננה",
  "quinoa-egg-stuffed-peppers": "פלפלים ממולאים בקינואה וביצה",
  "labneh-cucumber-zaatar-toast": "טוסט לבנה, מלפפון וזעתר",
  "high-protein-french-toast-berries": "פרנץ׳ טוסט עשיר בחלבון עם פירות יער",
  "kefir-mango-chia-cup": "כוס קפיר, מנגו וצ׳יה",
  "lemon-garlic-chicken-orzo-bowl": "קערת עוף, אורזו, לימון ושום",
  "chicken-caprese-farro-salad": "סלט פארו, עוף וקפרזה",
  "chicken-tzatziki-souvlaki-box": "קופסת סופלקי עוף עם צזיקי",
  "chicken-peanut-satay-noodle-salad": "סלט אטריות עוף ורוטב בוטנים",
  "turkey-zucchini-meatballs-polenta": "קציצות הודו וקישואים עם פולנטה",
  "turkey-lettuce-taco-cups": "כוסות חסה עם הודו בסגנון טאקו",
  "turkey-white-bean-kale-soup": "מרק הודו, שעועית לבנה וקייל",
  "beef-kofta-bulgur-tabbouleh": "קופטה בקר עם בורגול וטאבולה",
  "beef-mushroom-barley-stew": "נזיד בקר, פטריות וגריסים",
  "sesame-beef-lettuce-wraps": "עלי חסה עם בקר ושומשום",
  "lamb-chickpea-couscous-bowl": "קערת טלה, חומוס וקוסקוס",
  "cod-tomato-olive-stew": "נזיד בקלה, עגבניות וזיתים",
  "haddock-pea-potato-plate": "צלחת האדוק עם אפונה ותפוחי אדמה",
  "sardine-tomato-white-bean-toast": "טוסט סרדינים, עגבניות ושעועית לבנה",
  "mackerel-beet-potato-salad": "סלט מקרל, סלק ותפוחי אדמה",
  "prawn-mango-quinoa-salad": "סלט שרימפס, מנגו וקינואה",
  "shrimp-corn-avocado-salad": "סלט שרימפס, תירס ואבוקדו",
  "salmon-lentil-beet-salad": "סלט סלמון, עדשים וסלק",
  "trout-barley-green-bean-bowl": "קערת פורל, גריסים ושעועית ירוקה",
  "mussel-tomato-wholegrain-pasta": "פסטה מלאה עם מולים ועגבניות",
  "tempeh-lettuce-cups-peanut-lime": "כוסות חסה עם טמפה, בוטנים וליים",
  "seitan-fajita-bowl": "קערת סייטן בסגנון פחיטה",
  "tofu-miso-soba-soup": "מרק טופו, מיסו ואטריות סובה",
  "tofu-greek-salad-pita": "פיתה עם טופו וסלט יווני",
  "lentil-walnut-bolognese": "בולונז עדשים ואגוזי מלך",
  "white-bean-spinach-tomato-stew": "נזיד שעועית לבנה, תרד ועגבניות",
  "black-bean-stuffed-sweet-potatoes": "בטטות ממולאות בשעועית שחורה",
  "chickpea-quinoa-patties-yogurt": "קציצות חומוס וקינואה עם יוגורט",
  "cauliflower-lentil-shepherds-pie": "פאי רועים של עדשים וכרובית",
  "halloumi-roasted-vegetable-couscous": "קוסקוס עם חלומי וירקות צלויים",
  "baked-apple-cinnamon-quark-cup": "כוס קווארק עם תפוח וקינמון",
  "cocoa-banana-cottage-cheese-mousse": "מוס קוטג׳, בננה וקקאו",
  "spicy-roasted-broad-beans": "פול רחב צלוי ומתובל",
  "mini-caprese-chickpea-cups": "כוסות קפרזה קטנות עם חומוס",
  "skyr-cucumber-herb-dip-plate": "צלחת מטבל סקיר, מלפפון ועשבי תיבול",
  "turkey-cucumber-rollups": "גלילות הודו ומלפפון",
  "smoked-salmon-cucumber-bites": "ביסי מלפפון עם סלמון מעושן",
  "chia-cocoa-raspberry-pudding": "פודינג צ׳יה, קקאו ופטל",
  "crunchy-lupin-bean-salad-cup": "כוס סלט שעועית תורמוס פריכה",
  "watermelon-feta-mint-cup": "כוס אבטיח, פטה ונענע"
});

MEALS.forEach(meal => {
  if (HEBREW_MEAL_NAMES[meal.id]) meal.he = HEBREW_MEAL_NAMES[meal.id];
});

const round5 = value => Math.max(5, Math.round(value / 5) * 5);

// Fiber is kept in the same per-100g ingredient model as the existing
// macros. The original catalog did not expose fiber, so missing entries are
// deliberately zero rather than inferred from a meal title.
const FIBER_PER_100G = {
  oats: 10.1, quinoa: 2.8, couscous: 1.4, bulgur: 4.5,
  "whole-wheat-pasta": 6.3, pasta: 1.8, "sweet-potato": 3, potato: 1.8,
  "whole-wheat-bread": 6.5, bread: 2.7, pita: 2.2, tortilla: 3.6,
  "rice-cakes": 3, cornflakes: 3, granola: 7,
  banana: 2.6, apple: 2.4, orange: 2.4, pear: 3.1, grapes: 0.9,
  strawberries: 2, blueberries: 2.4, raspberries: 6.5, kiwi: 3,
  pineapple: 1.4, mango: 1.6, melon: 0.9, peach: 1.5, dates: 6.7,
  broccoli: 2.6, cauliflower: 2, carrots: 2.8, cucumber: 0.5,
  tomato: 1.2, lettuce: 1.3, spinach: 2.2, kale: 4.1, zucchini: 1,
  "bell-pepper": 2.1, onion: 1.7, mushrooms: 1, avocado: 6.7,
  cabbage: 2.5, "green-beans": 3.4, peas: 5.4, corn: 2.7,
  asparagus: 2.1, almonds: 12.5, walnuts: 6.7, cashews: 3.3,
  "peanut-butter": 6, "almond-butter": 10, tahini: 9.3,
  lentils: 7.9, chickpeas: 7.6, "black-beans": 8.7,
  "kidney-beans": 6.4, edamame: 5.2, tofu: 2.3, tempeh: 5,
  seitan: 0.6, "buckwheat-flour": 10, "whole-grain-flour": 10,
  "corn-tortilla": 5.5, "chia-seeds": 34.4, farro: 3.8,
  "white-beans": 6.3, celery: 1.6, beetroot: 2.8, "soba-noodles": 1.5,
  "broad-beans": 5.4, "lupin-beans": 3.3, watermelon: 0.4,
  mint: 6.8, dill: 2.1, herbs: 2.5, cocoa: 29
};

function fiberFor(key, grams) {
  return (FIBER_PER_100G[key] || 0) * (grams / 100);
}

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
    fatGrams: food.f * factor,
    fiberGrams: fiberFor(key, grams)
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
      totals.fiberGrams += macros.fiberGrams;
      return totals;
    },
    { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 }
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
    baseFiber: Number(totals.fiberGrams.toFixed(1)),
    imageKey: meal.id,
    image: resolveMealImage(meal.id)
  };
});

const EXPLICIT_CATEGORY_TAGS = {
  "buckwheat-banana-protein-pancakes": ["pre-workout"],
  "high-protein-french-toast-berries": ["post-workout"],
  "turkey-spinach-breakfast-muffins": ["pre-workout"],
  "chicken-caprese-farro-salad": ["balanced"],
  "trout-barley-green-bean-bowl": ["balanced"]
};

const CATEGORY_DEFINITIONS = {
  "high-protein": { labelEn: "High Protein", labelHe: "חלבון גבוה", rule: meal => meal.baseProtein >= 25 },
  "low-calorie": { labelEn: "Low Calorie", labelHe: "דל קלוריות", rule: meal => meal.baseCalories <= 450 },
  balanced: { labelEn: "Balanced", labelHe: "מאוזן", rule: meal => meal.baseProtein >= 20 && meal.baseCarbs >= 25 && meal.baseCarbs <= 70 && meal.baseFat <= 30 },
  "high-fiber": { labelEn: "High Fiber", labelHe: "עשיר בסיבים", rule: meal => meal.baseFiber >= 8 },
  "lower-carb": { labelEn: "Lower Carb", labelHe: "דל יחסית בפחמימות", rule: meal => meal.baseCarbs <= 35 },
  "pre-workout": { labelEn: "Pre-Workout", labelHe: "לפני אימון" },
  "post-workout": { labelEn: "Post-Workout", labelHe: "אחרי אימון" }
};

function categoriesFor(meal) {
  const categories = new Set([...(meal.slots || []), meal.diet]);
  for (const [key, definition] of Object.entries(CATEGORY_DEFINITIONS)) {
    if (definition.rule?.(meal)) categories.add(key);
  }
  for (const key of EXPLICIT_CATEGORY_TAGS[meal.id] || []) categories.add(key);
  return [...categories];
}

for (const meal of CATALOG) {
  const ingredientAliases = meal.items.flatMap(([key]) => [
    key.replaceAll("-", " "),
    FOODS[key].en,
    FOODS[key].he
  ]);
  meal.aliases = [...new Set([
    ...(meal.aliases || []),
    meal.id.replaceAll("-", " "),
    ...ingredientAliases
  ])];
  meal.categories = categoriesFor(meal);
}

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

// Foods that have no dedicated photo yet. Any meal using one is withheld from
// public selection rather than shipping an ingredient row on the placeholder:
// the alternative would be routing it to a different vegetable's photo, which
// would be inaccurate. Delete the entry once the real image lands in
// public/images/foods/ and the meals return automatically -- nothing else
// needs changing.
const FOODS_PENDING_IMAGE = new Set();

/** Meals withheld from selection because an ingredient has no photo yet. */
const MEALS_PENDING_IMAGE = CATALOG.filter(meal =>
  meal.items.some(([key]) => FOODS_PENDING_IMAGE.has(key))
).map(meal => meal.id);

const MEALS_PENDING_IMAGE_SET = new Set(MEALS_PENDING_IMAGE);

function filterMeals({ diet = "omnivore", excludeAllergens = [], slot = null } = {}) {
  const allowedDiets = DIET_ALLOWS[String(diet).toLowerCase()] || DIET_ALLOWS.omnivore;
  return CATALOG.filter(meal => {
    if (MEALS_PENDING_IMAGE_SET.has(meal.id)) return false;
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
      // The catalog key this row came from. Needed so the portion balancer can
      // recompute an adjusted amount with this module's own arithmetic rather
      // than trying to reverse-engineer the food from its display name.
      catalogKey: key,
      imageKey: food.img,
      // Resolve through the shared map so a catalog `img` key can never
      // silently miss (cinnamon had a photo on disk but no mapping entry).
      // An explicitly injected foodImages map still wins, for tests.
      imageUrl:
        foodImages[food.img] || resolveFoodImage(food.img) || FOOD_PLACEHOLDER_IMAGE,
      amount: formatAmount(key, grams, isHebrew),
      grams,
      calories: Math.round(macros.calories),
      proteinGrams: Math.round(macros.proteinGrams),
      carbsGrams: Math.round(macros.carbsGrams),
      fatGrams: Math.round(macros.fatGrams),
      fiberGrams: Number(macros.fiberGrams.toFixed(1))
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
    optionFatGrams: sumOf("fatGrams"),
    optionFiberGrams: Number(sumOf("fiberGrams").toFixed(1))
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
function selectMeals({
  pool,
  slot,
  targetCalories,
  targetProteinGrams = 0,
  targetCarbsGrams = 0,
  targetFatGrams = 0,
  macroAware = false,
  count = 3,
  exclude = [],
  preferNutrients = []
} = {}) {
  const excluded = new Set(exclude);
  return pool
    .filter(meal => meal.slots.includes(slot) && !excluded.has(meal.id))
    .map(meal => {
      const calorieGap = Math.abs(meal.baseCalories - targetCalories) / Math.max(1, targetCalories);
      const macroScore = macroAware
        ? (
          Math.abs(meal.baseProtein - targetProteinGrams) / Math.max(1, targetProteinGrams) * 1.5 +
          Math.abs(meal.baseCarbs - targetCarbsGrams) / Math.max(1, targetCarbsGrams) * 0.75 +
          Math.abs(meal.baseFat - targetFatGrams) / Math.max(1, targetFatGrams)
        )
        : 0;
      const nutrientHits = preferNutrients.filter(nutrient => meal.nutrients.includes(nutrient)).length;
      const calorieWeight = macroAware ? 1.5 : 1;
      return { meal, score: calorieGap * calorieWeight + macroScore - nutrientHits * 0.25 };
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
  CONDITION_NUTRIENTS,
  CATEGORY_DEFINITIONS,
  FOODS_PENDING_IMAGE,
  MEALS_PENDING_IMAGE,
  // Exported so lib/nutrition-portion-balancer.js can adjust an ingredient's
  // grams and rebuild its macros and display amount with exactly the same
  // arithmetic and snapping this module used to build it. Recomputing a row
  // any other way is how a header stops matching its ingredient list.
  macrosFor,
  snapAmount,
  formatAmount
};
