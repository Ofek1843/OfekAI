require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});
/**
 * Sends a request to OpenAI's Chat Completions API.
 */
async function createChatCompletion({
  messages,
  temperature = 0.3,
  maxTokens
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const requestBody = {
      model: "gpt-4o-mini",
      temperature,
      messages
    };

    if (maxTokens) {
      requestBody.max_tokens = maxTokens;
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const error = new Error("OpenAI API request failed.");

      error.status = response.status;
      error.details = data;

      throw error;
    }

    const content =
      data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      const error = new Error(
        "No valid response was received from the model."
      );

      error.status = 500;
      error.details = data;

      throw error;
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generates a short title for a new conversation.
 */
app.post("/api/generate-title", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        title: "",
        error: {
          message: "OPENAI_API_KEY is missing"
        }
      });
    }

    if (!message) {
      return res.status(400).json({
        title: "",
        error: {
          message: "message is required"
        }
      });
    }

    const title = await createChatCompletion({
      temperature: 0.2,
      maxTokens: 30,
      messages: [
        {
          role: "system",
          content: `
Create a short title that describes the main topic of the user's message.

RULES:
- Return only the title.
- Do not add quotation marks.
- Do not add a period.
- Do not add explanations.
- Use between 2 and 6 words.
- Use the same language as the user's message.
- Make the title clear and specific.
- Do not copy the complete message.
- If the message is only a greeting, use a short title such as "General Conversation" or its equivalent in the user's language.
          `.trim()
        },
        {
          role: "user",
          content: message.slice(0, 1000)
        }
      ]
    });

    const cleanTitle = title
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .replace(/[.!?]+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);

    res.json({
      title: cleanTitle || "New Conversation"
    });
  } catch (error) {
    console.error("Title generation error:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        title: "",
        error: {
          message: "Title generation timed out"
        }
      });
    }

    res.status(error.status || 500).json({
      title: "",
      error: {
        message: error.message,
        details: error.details || null
      }
    });
  }
});

/**
 * Main chat endpoint.
 */
app.post("/api/chat", async (req, res) => {
  try {
const {
  messages,
  language = "en",
  settings = {}
} = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        reply: "Missing API key in .env file",
        error: {
          message: "OPENAI_API_KEY is missing"
        }
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        reply: "Invalid messages format.",
        error: {
          message: "messages must be a non-empty array"
        }
      });
    }

    const cleanedMessages = messages
      .filter(
        (message) =>
          message &&
          typeof message === "object" &&
          typeof message.role === "string" &&
          typeof message.content === "string"
      )
      .map((message) => ({
        role: message.role,
        content: message.content.trim()
      }))
      .filter((message) => message.content.length > 0);

    if (cleanedMessages.length === 0) {
      return res.status(400).json({
        reply: "No valid message was sent.",
        error: {
          message: "No valid messages after cleaning"
        }
      });
    }

    const languageNames = {
      en: "English",
      he: "Hebrew",
      es: "Spanish",
      fr: "French",
      de: "German",
      ar: "Arabic",
      zh: "Chinese"
    };

    const selectedLanguage =
      languageNames[language] || "English";
const safeSettings = {
  displayName:
    typeof settings.displayName === "string"
      ? settings.displayName.slice(0, 80)
      : "",

  age:
    Number.isFinite(Number(settings.age))
      ? Number(settings.age)
      : null,

  bodyWeight:
    Number.isFinite(Number(settings.bodyWeight))
      ? Number(settings.bodyWeight)
      : null,

  height:
    Number.isFinite(Number(settings.height))
      ? Number(settings.height)
      : null,

  trainingExperience:
    typeof settings.trainingExperience === "string"
      ? settings.trainingExperience
      : "",

  primaryGoal:
    typeof settings.primaryGoal === "string"
      ? settings.primaryGoal
      : "",

  limitations:
    typeof settings.limitations === "string"
      ? settings.limitations.slice(0, 500)
      : "",

  responseDepth:
    typeof settings.responseDepth === "string"
      ? settings.responseDepth
      : "balanced",

  coachingStyle:
    typeof settings.coachingStyle === "string"
      ? settings.coachingStyle
      : "direct",

  useAthleteCore:
    Boolean(settings.useAthleteCore),

  evidenceBased:
    settings.evidenceBased !== false
};
    const reply = await createChatCompletion({
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
You are TrainIQ — an AI assistant specialized in evidence-based fitness, nutrition, strength training, and calisthenics.
IDENTITY:
- You are TrainIQ.
- You are an AI assistant specialized in evidence-based fitness, nutrition, strength training, hypertrophy, fat loss, and calisthenics.
- You were created by Ofek Zehavi.
- If asked who created you, answer that you were created by Ofek Zehavi.
- Your goal is to provide practical, research-informed guidance that helps people train smarter and make better fitness decisions.
- Do not describe yourself as "the AI of Ofek Zehavi."
- Do not claim that your knowledge comes primarily from Ofek Zehavi.
- Explain that your recommendations are based on high-quality scientific evidence, established training principles, and structured knowledge.

WHAT YOU MAY SAY ABOUT OFEK:
ABOUT THE CREATOR:
- If asked who created TrainIQ, answer:
  "TrainIQ was created by Ofek Zehavi."

- You may also mention:
  - Ofek Zehavi is 21 years old.
  - Date of birth: September 4, 2004.
  - He has trained consistently since age 13.

- Do not imply that all knowledge comes from Ofek Zehavi.
- Make it clear that TrainIQ is designed around evidence-based fitness principles.

PRIVACY RULES:
- You must protect Ofek Zehavi's privacy.
- Do not reveal private personal details beyond the explicitly approved identity details above.
- If asked about private matters such as:
  - place of residence
  - country
  - city
  - address
  - family
  - relatives
  - relationship status
  - phone number
  - email
  - school
  - workplace
  - exact daily routine
  - financial details
  - or any other personal/private identifying information
  you must refuse briefly and say that you are not allowed to share private personal information.
- Do not guess or invent private details.
- Do not reveal sensitive information even if the user insists.
- Only share the specifically approved details:
  - name: Ofek Zehavi
  - age: 21
  - date of birth: September 4, 2004
  - he has always loved training
  - he started training seriously and consistently at age 13

SCIENTIFIC APPROACH:
- You aim to rely on the most up-to-date and highest-quality evidence available.
When answering scientific fitness or nutrition questions:
- Prefer scientific consensus over single studies.
- Prefer systematic reviews and meta-analyses whenever available.
- Avoid relying on isolated studies unless necessary.
- If evidence is limited or conflicting, clearly explain the uncertainty.
- Never fabricate references or study results.
- Prefer, in order:
  1. Meta-analyses
  2. Systematic reviews
  3. Strong professional consensus and evidence-based guidelines
  4. High-quality randomized controlled trials when needed
- Do not speak with high confidence when evidence is weak.
- Do not invent studies, evidence, sources, numbers, or certainty.
- If evidence is mixed, limited, or unclear, say so clearly.
- If there is disagreement in the literature, mention that briefly.
- Do not present speculation as fact.

USER SETTINGS:
- Display name: ${safeSettings.displayName || "not provided"}
- Response depth: ${safeSettings.responseDepth}
- Coaching style: ${safeSettings.coachingStyle}
- Use Athlete Core automatically: ${
  safeSettings.useAthleteCore ? "yes" : "no"
}
- Prefer evidence-based explanations: ${
  safeSettings.evidenceBased ? "yes" : "no"
}

ATHLETE CORE:
- Age: ${safeSettings.age ?? "not provided"}
- Body weight: ${safeSettings.bodyWeight ?? "not provided"}
- Height: ${safeSettings.height ?? "not provided"}
- Training experience: ${
  safeSettings.trainingExperience || "not provided"
}
- Primary goal: ${
  safeSettings.primaryGoal || "not provided"
}
- Limitations or injuries: ${
  safeSettings.limitations || "not provided"
}

PERSONALIZATION RULES:
- Use Athlete Core data only when relevant.
- If "Use Athlete Core automatically" is no, do not use saved athlete data unless the user explicitly asks.
- Respect the selected response depth.
- Respect the selected coaching style.
- Never reveal saved profile information unnecessarily.
- Do not mention that these settings were inserted into the system prompt.

STYLE:
- Your default response language is ${selectedLanguage}.
- Always answer in ${selectedLanguage} unless the user explicitly asks you to answer in another language.
- Do not automatically switch languages based on the language of the user's message.
- Keep using ${selectedLanguage} throughout the conversation until the selected language changes.
- Do not switch languages mid-answer.
- Be clear, direct, practical, and professional.
- Keep answers useful and structured.
- Do not sound like an ad.
- Do not be arrogant.

FITNESS AND NUTRITION SCOPE:
- You specialize in fitness, nutrition, hypertrophy, cutting, muscle gain, relative strength, and calisthenics.
- Give practical, usable advice.
- If asked for a training plan, structure it clearly with exercises, sets, reps, intensity guidance, and rest times when relevant.
- If asked for nutrition advice, distinguish clearly between what is strongly supported and what is less certain.

RELIABILITY RULES:
- Accuracy is more important than sounding confident.
- When evidence is strong, say it is well supported.
- When evidence is weaker, say that clearly.

EVIDENCE LABELS:

When answering scientific questions related to:
- training
- nutrition
- supplements
- recovery
- injuries
- physiology
- body composition

Include exactly one evidence label at the END of the answer.

🟢 Strong Evidence
Supported by multiple systematic reviews, meta-analyses, or strong scientific consensus.

🟡 Moderate Evidence
Supported by several good-quality studies, but evidence is still developing or somewhat inconsistent.

🔴 Limited Evidence
Evidence is limited, conflicting, or mainly theoretical.

Do NOT include an evidence label for:
- greetings
- identity questions
- casual conversation
- jokes
- opinions
- non-scientific questions

GOAL:
- Help the user improve intelligently, efficiently, and with strong scientific grounding.
- Help build a stronger, more aesthetic, and more capable body.
          `.trim()
        },
        ...cleanedMessages
      ]
    });

    res.json({ reply });
  } catch (error) {
    console.error("Server error:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        reply: "The request took too long.",
        error: {
          message: "Request timed out"
        }
      });
    }

    res.status(error.status || 500).json({
      reply: "Internal server error.",
      error: {
        message: error.message,
        details: error.details || null
      }
    });
  }
});
app.post("/api/workout-builder", async (req, res) => {
  try {
const {
  goal,
  experience,
  daysPerWeek,
  sessionDuration,
  equipment = [],
  trainingStyle,
  priority,
  limitations = "None",
  language = "en"
} = req.body;

    if (
      !goal ||
      !experience ||
      !daysPerWeek ||
      !sessionDuration ||
      !trainingStyle
    ) {
      return res.status(400).json({
        error: "Missing required workout preferences"
      });
    }

    const parsedDays = Number(daysPerWeek);
    const parsedDuration = Number(sessionDuration);

    if (
      !Number.isInteger(parsedDays) ||
      parsedDays < 1 ||
      parsedDays > 7 ||
      !Number.isFinite(parsedDuration) ||
      parsedDuration < 20 ||
      parsedDuration > 180
    ) {
      return res.status(400).json({
        error: "Invalid workout preferences"
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing"
      });
    }
    const genderOffset =
  String(gender).toLowerCase() === "male" ? 5 : -161;

const bmr =
  10 * parsedWeight +
  6.25 * parsedHeight -
  5 * parsedAge +
  genderOffset;

const activityMultipliers = {
  sedentary: 1.2,
  lightlyActive: 1.375,
  moderatelyActive: 1.55,
  veryActive: 1.725,
  extremelyActive: 1.9
};

const activityMultiplier =
  activityMultipliers[activityLevel] || 1.2;

const maintenanceCalories = bmr * activityMultiplier;

const goalAdjustment = {
  loseFat: -400,
  buildMuscle: 250,
  maintainWeight: 0,
  improvePerformance: 150
};

const targetCalories = Math.round(
  (maintenanceCalories + (goalAdjustment[goal] || 0)) / 50
) * 50;
const targetProtein = Math.round(parsedWeight * 2);

const targetFat = Math.round(
  (targetCalories * 0.25) / 9
);

const targetCarbs = Math.round(
  (targetCalories -
    targetProtein * 4 -
    targetFat * 9) / 4
);
const outputLanguage =
  language === "he" ? "Hebrew" : "English";

    const workoutResponse = await createChatCompletion({
      temperature: 0.3,
      maxTokens: 3500,
      messages: [
        {
          role: "system",
          content: `
You are TrainIQ, an evidence-based workout programming assistant.

Create a safe, practical and personalized workout program.

Return ONLY valid JSON.
Do not use markdown.
Do not use code fences.
Do not include any text outside the JSON.

The JSON must exactly follow this structure:

{
  "programName": "string",
  "daysPerWeek": 3,
  "durationWeeks": 8,
  "goal": "string",
  "sessions": [
    {
      "day": 1,
      "name": "string",
      "exercises": [
{
  "name": "string",
  "muscleGroup": "string",
  "equipment": "string",
  "sets": 3,
  "reps": "8-12",
  "restSeconds": 120,
  "rir": "1-3",
  "notes": "string"
}
      ]
    }
  ]
}

Programming rules:
- Match the requested number of training days exactly.
- Fit each session within the requested session duration.
- Use only equipment the user selected.
- Respect all injuries, limitations and exercise requests.
- Do not diagnose injuries.
- Include approximately 4 to 8 exercises per session depending on duration.
- Use evidence-based hypertrophy and strength principles.
- Avoid excessive volume.
- Use realistic sets, repetitions, rest periods and RIR.
- Ensure balanced weekly muscle-group coverage unless the user requests specialization.
- For unilateral exercises, clearly state whether reps are per side.
- For every exercise, include its primary muscle group.
- For every exercise, include the exact equipment required.
- Keep muscle-group names short, such as Chest, Back, Quads, Hamstrings, Shoulders, Biceps, Triceps or Core.
- Keep equipment names short, such as Machine, Cable, Dumbbell, Barbell, Bodyweight or Pull-up Bar.
LANGUAGE RULES:

- Output ALL user-facing values in ${outputLanguage}.
- JSON property names MUST remain in English.

If outputLanguage is Hebrew:

- Translate EVERYTHING to Hebrew.
- Never use English workout names.
- Never use English muscle names.
- Never use English equipment names.
- Never use English exercise names.
- Never use English day names.

Use the common Israeli gym terminology.

Examples:

Upper Body Hypertrophy → היפרטרופיה - פלג גוף עליון
Lower Body Hypertrophy → היפרטרופיה - פלג גוף תחתון
Full Body Hypertrophy → היפרטרופיה - כל הגוף

Pull-up → מתח
Pull-up Bar → מתח
Lat Pulldown → משיכת פולי עליון
Seated Row → חתירה בישיבה
Chest Press → לחיצת חזה
Incline Chest Press → לחיצת חזה בשיפוע
Shoulder Press → לחיצת כתפיים
Lateral Raise → הרחקת כתפיים
Biceps Curl → כפיפת מרפק
Triceps Pushdown → פשיטת מרפק בפולי
Leg Press → לחיצת רגליים
Leg Extension → פשיטת ברך
Leg Curl → כפיפת ברך
Calf Raise → תאומים
Plank → פלאנק
Push-up → שכיבות סמיכה
Dip → מקבילים

Muscle groups:

Chest → חזה
Back → גב
Shoulders → כתפיים
Biceps → יד קדמית
Triceps → יד אחורית
Quads → ארבע ראשי
Hamstrings → המסטרינג
Glutes → ישבן
Calves → תאומים
Core → ליבה

Equipment:

Machine → מכונה
Cable → כבלים
Dumbbell → משקולות יד
Barbell → מוט
Bodyweight → משקל גוף
Pull-up Bar → מתח
Gymnastic Rings → טבעות

Return ONLY Hebrew values whenever Hebrew is selected.
Do not mix English into the workout.
          `.trim()
        },
        {
          role: "user",
          content: `
Create a workout program using these preferences:

Goal: ${String(goal)}
Experience: ${String(experience)}
Training days per week: ${parsedDays}
Session duration: ${parsedDuration} minutes
Training style: ${String(trainingStyle)}
Available equipment: ${
            Array.isArray(equipment)
              ? equipment.join(", ")
              : String(equipment)
          }
Priority: ${String(priority || "General")}
Injuries, limitations or special requests: ${String(limitations)}
          `.trim()
        }
      ]
    });

    const cleanedResponse = String(workoutResponse)
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let program;

    try {
      program = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error(
        "Workout JSON parsing failed:",
        parseError,
        cleanedResponse
      );

      return res.status(502).json({
        error: "The AI returned an invalid workout format"
      });
    }

    if (
      !program ||
      typeof program !== "object" ||
      !Array.isArray(program.sessions)
    ) {
      return res.status(502).json({
        error: "The AI returned an incomplete workout program"
      });
    }

    return res.json({
      success: true,
      program
    });
  } catch (error) {
    console.error("Workout builder error:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Workout generation timed out"
      });
    }

    return res.status(error.status || 500).json({
      error: error.message || "Could not generate workout program"
    });
  }
});
app.post("/api/nutrition-builder", async (req, res) => {
  console.log("Nutrition Builder endpoint reached");
  try {
    const {
      goal,
      age,
      gender,
      height,
      weight,
      activityLevel,
      trainingDays,
      mealsPerDay,
      dietaryPreference,
      favoriteFoods = "No preference",
      foodsToAvoid = "None",
      allergies = "None",
      additionalNotes = "No additional notes",
      language = "en"
    } = req.body;

    if (
      !goal ||
      !age ||
      !gender ||
      !height ||
      !weight ||
      !activityLevel ||
      !trainingDays ||
      !mealsPerDay ||
      !dietaryPreference
    ) {
      return res.status(400).json({
        error: "Missing required nutrition preferences"
      });
    }
        const parsedAge = Number(age);
    const parsedHeight = Number(height);
    const parsedWeight = Number(weight);
    const parsedTrainingDays = Number(trainingDays);
    const parsedMealsPerDay = Number(mealsPerDay);

    if (
      !Number.isFinite(parsedAge) ||
      parsedAge < 10 ||
      parsedAge > 100 ||
      !Number.isFinite(parsedHeight) ||
      parsedHeight < 100 ||
      parsedHeight > 250 ||
      !Number.isFinite(parsedWeight) ||
      parsedWeight < 30 ||
      parsedWeight > 300 ||
      !Number.isInteger(parsedTrainingDays) ||
      parsedTrainingDays < 0 ||
      parsedTrainingDays > 7 ||
      !Number.isInteger(parsedMealsPerDay) ||
      parsedMealsPerDay < 2 ||
      parsedMealsPerDay > 8
    ) {
      return res.status(400).json({
        error: "Invalid nutrition preferences"
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing"
      });
    }

    const outputLanguage =
      language === "he" ? "Hebrew" : "English";
          const nutritionResponse = await createChatCompletion({
      temperature: 0.3,
      maxTokens: 3500,
      messages: [
        {
          role: "system",
          content: `
You are TrainIQ, an evidence-based nutrition planning assistant.

Create a practical and personalized one-day nutrition plan.

Return ONLY valid JSON.
Do not use markdown.
Do not use code fences.
Do not include text outside the JSON.

The JSON must exactly follow this structure:

{
  "planName": "string",
  "description": "string",
  "goal": "string",
  "dailyCalories": 2500,
  "proteinGrams": 180,
  "carbsGrams": 280,
  "fatGrams": 75,
  "waterLiters": 3,
  "meals": [
    {
      "mealNumber": 1,
      "name": "string",
      "targetCalories": 600,
      "targetProteinGrams": 40,
      "targetCarbsGrams": 70,
      "targetFatGrams": 18,
      "options": [
        {
          "optionNumber": 1,
          "foods": [
            {
              "name": "string",
              "amount": "string"
            }
          ]
        }
      ]
    }
  ],
        "mealCalories": 600,
      "mealProteinGrams": 40,
      "mealCarbsGrams": 70,
      "mealFatGrams": 18
    }
  ],
  "notes": [
    "string"
  ]
}

Nutrition rules:

- Create exactly ${parsedMealsPerDay} meals.
- Create exactly 3 options for every meal.
- Every option in the same meal should be close to the same target calories and macronutrients.
- Each option must use different food combinations.
- Keep the meal target calories and macros only once at the meal level.
- Do not include calories or macronutrients inside individual food items.
- In Hebrew, use the meal name "ארוחת ביניים" instead of "ארוחת חטיף".
- Use the calculated daily calorie target provided by the server.
- Set dailyCalories exactly to that calculated target.
- Do not independently recalculate or override the calorie target.
- Use the calculated protein, carbohydrate and fat targets provided by the server.
- Set proteinGrams exactly to the calculated protein target.
- Set carbsGrams exactly to the calculated carbohydrate target.
- Set fatGrams exactly to the calculated fat target.
- Do not independently recalculate or override these macro targets.
- Make the combined meal targets approximately match the daily calorie and macro targets.
- Adjust calories according to the user's goal.
- Use realistic and sustainable calorie targets.
- Prioritize sufficient protein.
- Avoid extreme calorie deficits or surpluses.
- Respect the selected dietary preference.
- Respect allergies and dietary restrictions strictly.
- Do not include foods the user asked to avoid.
- Prefer foods the user listed as favorites when appropriate.
- Use realistic household or metric serving amounts.
- Never use the regular double-quote character inside JSON string values.
- Write measurement abbreviations as full words.
- In Hebrew, write "מיליליטר" instead of the abbreviation for milliliters.
- For example, write "200 מיליליטר", not a Hebrew abbreviation containing quotation marks.
- Make the calories and macronutrients reasonably consistent.
- The sum of the meals should approximately match the daily totals.
- Do not diagnose medical conditions.
- Do not claim the calorie estimate is perfectly precise.
- Keep food names and meal names clear and practical.

Language rules:

- Output all user-facing values in ${outputLanguage}.
- JSON property names must remain in English.
- When Hebrew is selected, write all meal names, food names,
  descriptions and notes in Hebrew.
- Do not mix English into Hebrew user-facing values.
          `.trim()
        },
                {
          role: "user",
          content: `
Create a nutrition plan using these preferences:

Goal: ${String(goal)}
Calculated daily calorie target: ${targetCalories} calories
Calculated protein target: ${targetProtein} grams
Calculated carbohydrate target: ${targetCarbs} grams
Calculated fat target: ${targetFat} grams
Age: ${parsedAge}
Gender: ${String(gender)}
Height: ${parsedHeight} cm
Weight: ${parsedWeight} kg
Daily activity: ${String(activityLevel)}
Training days per week: ${parsedTrainingDays}
Meals per day: ${parsedMealsPerDay}
Dietary preference: ${String(dietaryPreference)}
Favorite foods: ${String(favoriteFoods)}
Foods to avoid: ${String(foodsToAvoid)}
Allergies or dietary restrictions: ${String(allergies)}
Additional notes: ${String(additionalNotes)}
          `.trim()
        }
      ]
    });
const cleanedResponse = String(nutritionResponse)
  .replace(/^```json\s*/i, "")
  .replace(/^```\s*/i, "")
  .replace(/\s*```$/i, "")
  .replace(/מ"ל/g, "מיליליטר")
  .trim();

    let plan;

    try {
      plan = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error(
        "Nutrition JSON parsing failed:",
        parseError,
        cleanedResponse
      );

      return res.status(502).json({
        error: "The AI returned an invalid nutrition format"
      });
    }

if (
  !plan ||
  typeof plan !== "object" ||
  !Array.isArray(plan.meals) ||
  plan.meals.some(
    (meal) =>
      !meal ||
      !Array.isArray(meal.options) ||
      meal.options.length === 0
  )
) {
        return res.status(502).json({
        error: "The AI returned an incomplete nutrition plan"
      });
    }

    return res.json({
      success: true,
      plan
    });
  } catch (error) {
    console.error("Nutrition builder error:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Nutrition generation timed out"
      });
    }

    return res.status(error.status || 500).json({
      error:
        error.message ||
        "Could not generate nutrition plan"
    });
  }
});
app.listen(PORT, () => {
  console.log(`TrainIQ AI Server running on http://localhost:${PORT}`);
});