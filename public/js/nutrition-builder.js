import { auth, db } from "./firebase-config.js";
import { trackEvent, trackPageView } from "./analytics.js";
import { setupPlanSharing } from "./plan-sharing.js";
import { addDoc, collection, getDocs, limit, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const form = document.querySelector("#nutrition-builder-form");
const button = document.querySelector("#generate-button");
const statusElement = document.querySelector("#builder-status");
const resultElement = document.querySelector("#nutrition-result");
const currentLanguage =
  localStorage.getItem("ofek-ai-language") || "en";
async function authHeaders(contentType = "application/json") {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required.");
  return {
    Authorization: `Bearer ${await user.getIdToken()}`,
    "Content-Type": contentType
  };
}
const ageInput = document.querySelector("#age");
const youthConsentField = document.querySelector("#youth-consent-field");
const youthGuardianConsent = document.querySelector("#youthGuardianConsent");
const shoppingListModal = document.querySelector("#shoppingListModal");
const shoppingListBody = document.querySelector("#shoppingListBody");
const shoppingListTitle = document.querySelector("#shoppingListTitle");
const shoppingListSubtitle = document.querySelector("#shoppingListSubtitle");
const copyShoppingListButton = document.querySelector("#copyShoppingListButton");
const shoppingListCloseButtons = document.querySelectorAll("[data-close-shopping-modal]");

function updateYouthMode() {
  const isYouth = Number(ageInput?.value) >= 15 && Number(ageInput?.value) < 18;
  youthConsentField?.classList.toggle("hidden", !isYouth);
  if (youthGuardianConsent) {
    youthGuardianConsent.required = isYouth;
    if (!isYouth) youthGuardianConsent.checked = false;
  }
}

ageInput?.addEventListener("input", updateYouthMode);
updateYouthMode();

const isHebrew = currentLanguage === "he";
const ui = isHebrew
  ? {
      pageTitle: "בונה תוכניות תזונה AI",
      pageDescription:
        "בנה תוכנית תזונה אישית לפי המטרה, הנתונים שלך, רמת הפעילות והעדפות האכילה.",

      goal: "מטרה עיקרית",
      age: "גיל",
      gender: "מין",
      height: "גובה בסנטימטרים",
      weight: "משקל בקילוגרמים",
      activity: "רמת פעילות יומית",
      trainingDays: "מספר אימונים בשבוע",
      meals: "מספר ארוחות ביום",
      diet: "העדפה תזונתית",
      favorites: "מזונות מועדפים",
      avoid: "מזונות להימנע מהם",
      allergies: "אלרגיות או מגבלות תזונתיות",
      notes: "הערות נוספות",

      favoritesPlaceholder:
        "רשום מזונות שאתה אוהב ותרצה לכלול בתפריט.",
      avoidPlaceholder:
        "רשום מזונות שאינך אוהב או שאינך רוצה בתפריט.",
      allergiesPlaceholder:
        "תאר אלרגיות, רגישויות או מגבלות תזונתיות.",
      notesPlaceholder:
        "הוסף העדפות לזמני ארוחות, תקציב, בישול או מידע רלוונטי נוסף.",

      generate: "צור את תוכנית התזונה שלי",
      generating: "יוצר תוכנית...",
      generatingStatus: "יוצר את תוכנית התזונה שלך...",

      calories: "קלוריות",
      protein: "חלבון",
      carbs: "פחמימות",
      fat: "שומן",
      water: "מים",
      meal: "ארוחה",
      foods: "מזונות",
      amount: "כמות",
      print: "הדפס / שמור"
    }
  : {
      pageTitle: "AI Nutrition Builder",
      pageDescription:
        "Build a personalized nutrition plan based on your goal, body measurements, activity level, food preferences, and dietary limitations.",

      goal: "Primary goal",
      age: "Age",
      gender: "Gender",
      height: "Height in centimeters",
      weight: "Weight in kilograms",
      activity: "Daily activity level",
      trainingDays: "Training days per week",
      meals: "Meals per day",
      diet: "Dietary preference",
      favorites: "Preferred foods",
      avoid: "Foods to avoid",
      allergies: "Allergies or dietary restrictions",
      notes: "Additional notes",

      favoritesPlaceholder:
        "List foods you enjoy and would like included.",
      avoidPlaceholder:
        "List foods you dislike or do not want included.",
      allergiesPlaceholder:
        "Describe allergies, intolerances, or dietary restrictions.",
      notesPlaceholder:
        "Add meal timing, budget, cooking preferences, or other relevant details.",

      generate: "Generate My Nutrition Plan",
      generating: "Generating...",
      generatingStatus:
        "Generating your nutrition plan...",

      calories: "Calories",
      protein: "Protein",
      carbs: "Carbs",
      fat: "Fat",
      water: "Water",
      meal: "Meal",
      foods: "Foods",
      amount: "Amount",
      print: "Print / Save"
    };
        function setText(selector, text) {
  const element = document.querySelector(selector);

  if (element) {
    element.textContent = text;
  }
}

function translateBuilderInterface() {
  document.title = isHebrew
    ? "FuelPhysique בונה תוכניות תזונה"
    : "FuelPhysique Nutrition Builder";

  setText("h1", ui.pageTitle);
  setText(".builder-description", ui.pageDescription);

  setText('label[for="goal"]', ui.goal);
  setText('label[for="age"]', ui.age);
  setText('label[for="gender"]', ui.gender);
  setText('label[for="height"]', ui.height);
  setText('label[for="weight"]', ui.weight);
  setText('label[for="activityLevel"]', ui.activity);
  setText('label[for="trainingDays"]', ui.trainingDays);
  setText('label[for="mealsPerDay"]', ui.meals);
  setText(
    'label[for="dietaryPreference"]',
    ui.diet
  );
  setText(
    'label[for="favoriteFoods"]',
    ui.favorites
  );
  setText(
    'label[for="foodsToAvoid"]',
    ui.avoid
  );
  setText('label[for="allergies"]', ui.allergies);
  setText(
    'label[for="additionalNotes"]',
    ui.notes
  );

  const favoriteFoodsInput =
    document.querySelector("#favoriteFoods");

  const foodsToAvoidInput =
    document.querySelector("#foodsToAvoid");

  const allergiesInput =
    document.querySelector("#allergies");

  const notesInput =
    document.querySelector("#additionalNotes");

  if (favoriteFoodsInput) {
    favoriteFoodsInput.placeholder =
      ui.favoritesPlaceholder;
  }

  if (foodsToAvoidInput) {
    foodsToAvoidInput.placeholder =
      ui.avoidPlaceholder;
  }

  if (allergiesInput) {
    allergiesInput.placeholder =
      ui.allergiesPlaceholder;
  }

  if (notesInput) {
    notesInput.placeholder =
      ui.notesPlaceholder;
  }

  button.textContent = ui.generate;
}

translateBuilderInterface();
const hebrewOptionLabels = {
  loseFat: "ירידה באחוזי שומן",
  buildMuscle: "בניית שריר",
  maintainWeight: "שמירה על המשקל",
  improvePerformance: "שיפור ביצועים",

  male: "זכר",
  female: "נקבה",

  sedentary: "יושבני",
  lightlyActive: "פעילות קלה",
  moderatelyActive: "פעילות בינונית",
  veryActive: "פעילות גבוהה",
  extremelyActive: "פעילות גבוהה מאוד",

  balanced: "תזונה מאוזנת",
  highProtein: "תזונה עשירה בחלבון",
  vegetarian: "צמחוני",
  vegan: "טבעוני",
  pescatarian: "פסקטריאני",
  lowCarb: "דל פחמימות",
  mediterranean: "תזונה ים־תיכונית"
};

function translateFormOptions() {
  if (!isHebrew) {
    return;
  }

  document.querySelectorAll("select option").forEach((option) => {
    const translation = hebrewOptionLabels[option.value];

    if (translation) {
      option.textContent = translation;
    }
  });

  const placeholderTranslations = {
    goal: "בחר מטרה",
    gender: "בחר מין",
    activityLevel: "בחר רמת פעילות"
  };

  Object.entries(placeholderTranslations).forEach(
    ([selectId, translation]) => {
      const select = document.querySelector(`#${selectId}`);
      const emptyOption = select?.querySelector('option[value=""]');

      if (emptyOption) {
        emptyOption.textContent = translation;
      }
    }
  );
}

translateFormOptions();
trackPageView({ page: "nutrition-builder" });
trackEvent("builder_open", { builder: "nutrition" });

document.documentElement.lang = isHebrew ? "he" : "en";
document.documentElement.dir = isHebrew ? "rtl" : "ltr";
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  setLoading(true);
  setStatus(ui.generatingStatus);
  hideResult();

  const formData = new FormData(form);

  const payload = {
    goal: formData.get("goal"),
    age: Number(formData.get("age")),
    gender: formData.get("gender"),
    height: Number(formData.get("height")),
    weight: Number(formData.get("weight")),
    activityLevel: formData.get("activityLevel"),
    trainingDays: Number(formData.get("trainingDays")),
    mealsPerDay: Number(formData.get("mealsPerDay")),
    dietaryPreference: formData.get("dietaryPreference"),
    diagnosedConditions: formData.getAll("diagnosedConditions"),
    youthGuardianConsent: formData.get("youthGuardianConsent") === "on",

    favoriteFoods:
      formData.get("favoriteFoods")?.trim() ||
      (isHebrew ? "אין העדפה" : "No preference"),

    foodsToAvoid:
      formData.get("foodsToAvoid")?.trim() ||
      (isHebrew ? "ללא" : "None"),

    allergies:
      formData.get("allergies")?.trim() ||
      (isHebrew ? "ללא" : "None"),

    additionalNotes:
      formData.get("additionalNotes")?.trim() ||
      (isHebrew ? "ללא הערות נוספות" : "No additional notes"),

    language: currentLanguage
  };

  try {
    const response = await fetch("/api/nutrition-builder", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await response.json();
console.log(data);
    if (!response.ok) {
      throw new Error(
        data.error ||
          (isHebrew
            ? "לא ניתן היה ליצור את תוכנית התזונה"
            : "Could not generate the nutrition plan")
      );
    }

setStatus("");

if (data.plan) {
  window.currentNutritionPlan = data.plan;
  renderNutritionPlan(data.plan);
  return;
}
  } catch (error) {
    console.error(
      "Nutrition builder request failed:",
      error
    );

    setStatus(error.message, true);
  } finally {
    setLoading(false);
  }
});
function setLoading(isLoading) {
  button.disabled = isLoading;
  button.textContent = isLoading
    ? ui.generating
    : ui.generate;
}
function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
}

async function saveNutritionPlan(plan) {
  const user = auth.currentUser;
  if (!user) throw new Error("USER_NOT_SIGNED_IN");
  const plansRef = collection(db, "users", user.uid, "nutritionPlans");
  const existingPlans = await getDocs(query(plansRef, limit(5)));
  if (existingPlans.size >= 5) throw new Error("NUTRITION_PLAN_LIMIT_REACHED");
  return addDoc(plansRef, {
    name: plan.planName || "Nutrition Plan",
    plan,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

function normaliseFoodName(name = "") {
  return String(name)
    .replace(/\s+/g, " ")
    .trim();
}

function categorizeFood(name = "") {
  const value = String(name).toLowerCase();
  if (/(chicken|beef|turkey|fish|salmon|tuna|egg|eggs|yogurt|yoghurt|cottage cheese|protein|whey|tofu|lentil|beans|meat)/.test(value)) return "Protein";
  if (/(rice|pasta|bread|oat|potato|sweet potato|quinoa|cereal|wrap|pita|bagel|granola|corn|noodle)/.test(value)) return "Carbs";
  if (/(avocado|nuts|peanut|almond|olive oil|oil|butter|seeds|chia|flax|salmon|tahini)/.test(value)) return "Fats";
  if (/(apple|banana|orange|berries|berry|grape|tomato|cucumber|lettuce|spinach|broccoli|carrot|pepper|onion|fruit|vegetable)/.test(value)) return "Produce";
  if (/(milk|cheese|cottage|cream|kefir|lassi)/.test(value)) return "Dairy";
  return "Other";
}

function buildShoppingList(plan = {}) {
  const items = new Map();
  const meals = Array.isArray(plan.meals) ? plan.meals : [];

  for (const meal of meals) {
    const options = Array.isArray(meal.options) ? meal.options : [];
    for (const option of options) {
      const foods = Array.isArray(option.foods) ? option.foods : [];
      for (const food of foods) {
        const rawName = normaliseFoodName(food?.name || "");
        if (!rawName) continue;
        const amount = normaliseFoodName(food?.amount || "");
        const key = `${rawName.toLowerCase()}|${amount.toLowerCase()}`;
        if (items.has(key)) continue;
        items.set(key, {
          name: rawName,
          amount,
          category: categorizeFood(rawName)
        });
      }
    }
  }

  const grouped = new Map([
    ["Protein", []],
    ["Carbs", []],
    ["Produce", []],
    ["Fats", []],
    ["Dairy", []],
    ["Other", []]
  ]);

  for (const item of items.values()) {
    grouped.get(item.category)?.push(item);
  }

  return grouped;
}

function renderShoppingList(plan = {}) {
  const grouped = buildShoppingList(plan);
  const planName = plan.planName || (isHebrew ? "׳×׳•׳›׳ ׳™׳× ׳×׳–׳•׳ ׳”" : "Nutrition Plan");
  shoppingListTitle.textContent = isHebrew ? "׳¨׳©׳™׳׳× ׳§׳ ׳™׳•׳×" : "Shopping list";
  shoppingListSubtitle.textContent = isHebrew
    ? `׳׳•׳¦׳¨׳™׳ ׳׳×׳•׳ ${planName}`
    : `Ingredients pulled from ${planName}`;

  const sections = [...grouped.entries()]
    .filter(([, items]) => items.length)
    .map(([category, items]) => `
      <section class="shopping-section">
        <h3>${escapeHtml(category)}</h3>
        <ul>
          ${items
            .map((item) => `<li>${escapeHtml(item.name)}${item.amount ? ` <span style="color:#94a3b8">(${escapeHtml(item.amount)})</span>` : ""}</li>`)
            .join("")}
        </ul>
      </section>
    `)
    .join("");

  shoppingListBody.innerHTML = sections || `<p class="shopping-empty">${isHebrew ? "׳׳™׳ ׳‘׳™׳׳•׳™ ׳׳–׳•׳ ׳‘׳×׳•׳›׳ ׳™׳× ׳”׳–׳•." : "No food items were found in this plan."}</p>`;
  shoppingListModal.classList.remove("hidden");
  shoppingListModal.setAttribute("aria-hidden", "false");
  trackEvent("nutrition_shopping_list", { plan: planName });
}

function closeShoppingList() {
  shoppingListModal.classList.add("hidden");
  shoppingListModal.setAttribute("aria-hidden", "true");
}

copyShoppingListButton?.addEventListener("click", async () => {
  const lines = [...shoppingListBody.querySelectorAll("li")].map((item) => item.textContent?.trim()).filter(Boolean);
  if (!lines.length) return;
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    copyShoppingListButton.textContent = isHebrew ? "׳—׳•׳¤׳©׳” ׳׳׳•׳—׳‘׳" : "Copied";
    window.setTimeout(() => {
      copyShoppingListButton.textContent = isHebrew ? "׳¡׳¤׳¨ ׳׳× ׳”׳¨׳©׳™׳׳”" : "Copy list";
    }, 1200);
  } catch (error) {
    console.error("Could not copy shopping list:", error);
  }
});

shoppingListCloseButtons.forEach((button) => button.addEventListener("click", closeShoppingList));
shoppingListModal?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeShoppingList();
});
shoppingListModal?.addEventListener("click", (event) => {
  if (event.target === shoppingListModal || event.target?.dataset?.closeShoppingModal !== undefined) closeShoppingList();
});

function hideResult() {
  resultElement.classList.add("hidden");
  resultElement.innerHTML = "";
}
function renderNutritionPlan(plan) {
  const meals = Array.isArray(plan.meals)
    ? plan.meals
    : [];

  const notes = Array.isArray(plan.notes)
    ? plan.notes
    : [];

  const mealsHtml = meals
    .map((meal) => {
const options = Array.isArray(meal.options)
  ? meal.options
  : [];

const optionsHtml = options
  .map((option) => {
    const foods = Array.isArray(option.foods)
      ? option.foods
      : [];

const foodsText = foods
.map(
  (food, foodIndex) => `
        <tr>
<td class="food-cell">
  <img
    class="food-image"
    src="${food.imageUrl || "/images/food-placeholder.png"}"
    alt="${escapeHtml(food.name || "")}"
    loading="lazy"
  />

  <span>
    ${escapeHtml(food.name || "")}
  </span>
</td>
<td>${escapeHtml(food.amount || "")}</td>

<td>
  <button
    type="button"
    class="nutrition-reroll-food-button"
    data-meal-number="${meal.mealNumber}"
    data-option-number="${option.optionNumber}"
    data-food-index="${foodIndex}"
  >
    🔄
  </button>
</td>
      </tr>
    `
  )
  .join("");
  return `
  <article
  class="meal-option-card"
  role="button"
  tabindex="0"
  data-meal-number="${escapeHtml(meal.mealNumber ?? "")}"
  data-option-number="${escapeHtml(option.optionNumber ?? "")}"
>
    <div class="meal-option-header">
      <span class="option-label">
        ${isHebrew ? "אפשרות" : "Option"}
      </span>

      <strong class="option-number">
        ${escapeHtml(option.optionNumber ?? "")}
      </strong>
    </div>

<div class="option-foods">
  <table class="nutrition-food-table">
    <thead>
      <tr>
        <th>${isHebrew ? "מזון" : "Food"}</th>
        <th>${isHebrew ? "כמות" : "Amount"}</th>
      </tr>
    </thead>

    <tbody>
      ${foodsText}
    </tbody>
  </table>
</div>
  </article>
`;
  })
  .join("");
      return `
        <section class="meal-card">
<div class="meal-header">
  <h3>
    🍽️
    ${escapeHtml(
      meal.name ||
        `${ui.meal} ${meal.mealNumber || ""}`
    )}
  </h3>

  <span>
    🔥 ${escapeHtml(meal.targetCalories ?? "-")}
    ${ui.calories}
  </span>
</div>
<div class="meal-macros">
  <span>💪 ${escapeHtml(meal.targetProteinGrams ?? "-")}g ${ui.protein}</span>

  <span>🍚 ${escapeHtml(meal.targetCarbsGrams ?? "-")}g ${ui.carbs}</span>

  <span>🥑 ${escapeHtml(meal.targetFatGrams ?? "-")}g ${ui.fat}</span>
</div>
<div class="nutrition-options">
  <h4>
    ${isHebrew ? "אפשרויות לארוחה" : "Meal Options"}
  </h4>

  <div class="meal-options-title">
  <span class="meal-options-title-main">Meal alternatives</span>
  <span class="meal-options-title-sub">Choose one option</span>
</div>
    ${optionsHtml}
  </div>
</div>
        </section>
      `;
    })
    .join("");

  const notesHtml = notes.length
    ? `
      <section class="nutrition-notes">
        <h3>
          ${isHebrew ? "הערות לתוכנית" : "Plan Notes"}
        </h3>

        <ul>
          ${notes
            .map(
              (note) =>
                `<li>${escapeHtml(note)}</li>`
            )
            .join("")}
        </ul>
      </section>
    `
    : "";

  resultElement.innerHTML = `
    <section class="program-card">
      <header class="program-header">
        <div>
          <span class="program-eyebrow">
            FuelPhysique AI Nutrition Plan
          </span>

          <h2>
            ${escapeHtml(
              plan.planName ||
                (isHebrew
                  ? "תוכנית תזונה אישית"
                  : "Personal Nutrition Plan")
            )}
          </h2>

          <p class="program-description">
            ${escapeHtml(
              plan.description ||
                (isHebrew
                  ? "תוכנית תזונה מותאמת אישית."
                  : "A personalized nutrition plan.")
            )}
          </p>
        </div>

        <div class="program-actions">
          <button type="button" class="share-program-button" id="share-nutrition-button">↗ ${isHebrew ? "שיתוף" : "Share"}</button>
          <button type="button" class="shopping-list-button" id="shopping-list-button">
            ${isHebrew ? "Shopping list" : "Shopping list"}
          </button>
          <button type="button" class="save-program-button" id="save-nutrition-button">
            💾 ${isHebrew ? "שמירת תפריט" : "Save Nutrition Plan"}
          </button>
        </div>
      </header>

      <section class="nutrition-summary">
        <div>
          <strong>
            ${escapeHtml(plan.dailyCalories ?? "-")}
          </strong>
          <span>${ui.calories}</span>
        </div>

        <div>
          <strong>
            ${escapeHtml(plan.proteinGrams ?? "-")}g
          </strong>
          <span>${ui.protein}</span>
        </div>

        <div>
          <strong>
            ${escapeHtml(plan.carbsGrams ?? "-")}g
          </strong>
          <span>${ui.carbs}</span>
        </div>

        <div>
          <strong>
            ${escapeHtml(plan.fatGrams ?? "-")}g
          </strong>
          <span>${ui.fat}</span>
        </div>

        <div>
          <strong>
            ${escapeHtml(plan.waterLiters ?? "-")}L
          </strong>
          <span>${ui.water}</span>
        </div>
      </section>

      <section class="meals-list">
        ${mealsHtml}
      </section>

      ${notesHtml}
    </section>
  `;

  const saveButton = resultElement.querySelector("#save-nutrition-button");
  const shoppingListButton = resultElement.querySelector("#shopping-list-button");
  setupPlanSharing(resultElement.querySelector("#share-nutrition-button"), { type: "nutrition", getPlan: () => window.currentNutritionPlan });
  shoppingListButton?.addEventListener("click", () => renderShoppingList(window.currentNutritionPlan));
  saveButton?.addEventListener("click", async () => {
    saveButton.disabled = true;
    saveButton.textContent = isHebrew ? "שומר..." : "Saving...";
    try {
      await saveNutritionPlan(window.currentNutritionPlan);
      trackEvent("plan_saved", { type: "nutrition" });
      saveButton.textContent = isHebrew ? "✓ התפריט נשמר" : "✓ Nutrition Plan Saved";
      setStatus(isHebrew ? "תוכנית התזונה נשמרה בהצלחה." : "Nutrition plan saved successfully.");
    } catch (error) {
      console.error("Could not save nutrition plan:", error);
      saveButton.disabled = false;
      saveButton.textContent = isHebrew ? "💾 שמירת תפריט" : "💾 Save Nutrition Plan";
      const atLimit = error.message === "NUTRITION_PLAN_LIMIT_REACHED";
      setStatus(atLimit
        ? (isHebrew ? "ניתן לשמור עד 5 תוכניות תזונה. מחק אחת כדי לשמור חדשה." : "You can save up to 5 nutrition plans. Delete one to save a new plan.")
        : (isHebrew ? "לא ניתן היה לשמור את תוכנית התזונה. ודא שאתה מחובר." : "Could not save the nutrition plan. Make sure you are signed in."), true);
    }
  });

  resultElement.classList.remove("hidden");

resultElement
  .querySelectorAll(".nutrition-reroll-food-button")
    .forEach((rerollButton) => {
rerollButton.addEventListener("click", async () => {
  try {

  const mealNumber = Number(
    rerollButton.dataset.mealNumber
  );

const optionNumber = Number(
  rerollButton.dataset.optionNumber
);

const foodIndex = Number(rerollButton.dataset.foodIndex);

rerollButton.disabled = true;
rerollButton.classList.add("is-rerolling");

const response = await fetch(
    "/api/nutrition-builder/reroll-food",
    {
      method: "POST",
      headers: await authHeaders(),
body: JSON.stringify({
  mealNumber,
  optionNumber,
  foodIndex,
  plan: window.currentNutritionPlan
})
    }
  );

const data = await response.json();

console.log(data);

const meal = window.currentNutritionPlan.meals.find(
  (meal) => meal.mealNumber === mealNumber
);

const optionIndex = meal.options.findIndex(
  (option) => option.optionNumber === optionNumber
);

meal.options[optionIndex].foods[foodIndex] = data.food;

renderNutritionPlan(window.currentNutritionPlan);

} finally {
  rerollButton.disabled = false;
  rerollButton.classList.remove("is-rerolling");
}

});  });

  resultElement.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}
function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
