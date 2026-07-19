const form = document.querySelector("#nutrition-builder-form");
const button = document.querySelector("#generate-button");
const statusElement = document.querySelector("#builder-status");
const resultElement = document.querySelector("#nutrition-result");
const currentLanguage =
  localStorage.getItem("ofek-ai-language") || "en";

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
    ? "TrainIQ בונה תוכניות תזונה"
    : "TrainIQ Nutrition Builder";

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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

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
    (food) => `
      <div class="meal-food">
        <span class="food-name">
          ${escapeHtml(food.name || "")}
        </span>

        <span class="food-amount">
          ${escapeHtml(food.amount || "")}
        </span>
      </div>
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
      ${foodsText}
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
            TrainIQ AI Nutrition Plan
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

        <button
          type="button"
          class="print-program-button"
          onclick="window.print()"
        >
          ${ui.print}
        </button>
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

  resultElement.classList.remove("hidden");

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