"use strict";

// Public editorial content only. Never read account records while rendering.
const ORIGIN = "https://fuelphysique.com";
const features = [
  {
    id: "workout-plan-generator",
    route: "/workout-plan-generator.html",
    file: "workout-plan-generator.html",
    label: "Workout planning",
    keyword: "AI workout plan generator",
    title: "Free Workout Plan Generator: Gym & Home | FuelPhysique",
    description: "Build a beginner-friendly workout plan for your training days and equipment. Explore a 3-day gym example or plan home dumbbell workouts. Free with sign-in.",
    h1: "Build your workout plan for the gym or home.",
    eyebrow: "AI workout plan generator",
    intro: "Starting with three gym days a week, or a pair of dumbbells at home? Choose your training days, available equipment, goal and experience. Generate a routine with exercises, sets, reps and rest times, then review it before you train.",
    choices: [
      ["Your week", "Choose 1–7 training days per week"],
      ["Your equipment", "Bodyweight, free weights or machines"],
      ["Your goal", "Build muscle, lose fat or maintain muscle"],
      ["Your experience", "Beginner through advanced training"]
    ],
    connections: [
      ["training-volume", "Review the week’s planned sets", "Open Weekly Sets in your plan to see direct and fractional contributions by muscle. These totals describe your plan, not completed workouts."],
      ["workout-tracker", "Take your plan into a session", "Save your plan, make it active and record your completed sets with the workout tracker and rest timer."],
      ["meal-plan-generator", "Plan what you will eat", "Create a separate one-day meal plan with portions, calories and protein estimates. Training and meal preferences stay under your control."],
      ["nutrition-tracker", "Log what you actually ate", "An active nutrition plan supplies diary targets. Log food separately to compare your intake with those targets."]
    ],
    cta: "Build my workout plan",
    destination: "/workout-builder.html?lang=en",
    access: "Free to use. Explore the form first; sign in to generate and save. Your answers stay with you.",
    preview: "workout",
    previewTitle: "From your preferences to a structured session",
    problemTitle: "Choose your training days, equipment and experience.",
    problem: "A saved workout from a video may assume equipment you do not have or more training days than you can manage. Writing your own also means deciding which movements belong together and how much work to schedule.",
    solution: "FuelPhysique's personalized workout builder uses your training preferences to suggest a routine. You can inspect the exercise selection and planned weekly workload before making it your active plan. It is a starting point to review, not a promise of results or a substitute for professional coaching.",
    steps: [
      ["Describe your training", "Set your goal and experience, then select the equipment you can use."],
      ["Fit it to your week", "Select your available training days. Add a muscle focus when relevant."],
      ["Generate and review", "Sign in when you are ready to generate. Review the exercises, sets, repetitions, rest and effort guidance."],
      ["Save and use your plan", "Save a suitable plan to your account, make it active and use it in the workout tracker."]
    ],
    benefits: [
      ["Gym or home dumbbells", "Select only the equipment you can use. For home dumbbell workouts, leave unavailable barbells and machines unselected and check whether suggested exercises need a bench."],
      ["A usable session structure", "See working sets and rest guidance together, rather than a disconnected list of exercise names."],
      ["A view of the whole week", "Review planned sets by muscle group to understand how your routine distributes work."]
    ],
    detail: {
      id: "calisthenics",
      title: "Prefer calisthenics or a mix of training styles?",
      text: "Select bodyweight and any available equipment, such as a pull-up bar or rings. You can also combine bodyweight and gym equipment in the same plan.",
      note: "The builder is not designed to adapt plans for active injuries or medical conditions requiring professional guidance. Stop movements that cause pain and seek qualified guidance when needed."
    },
    faqs: [
      ["Can I see the builder before creating an account?", "Yes. You can explore the form and enter your preferences as a guest. Signing in is required when you generate; the guest flow preserves your answers so you can continue."],
      ["Can I build a home dumbbell workout plan?", "Yes. Select dumbbells and any other equipment you actually have. Review the exercises for setup requirements, including a bench or floor space; the gym example below is not a dumbbell-only routine."],
      ["Can a beginner choose a 3-day gym workout plan?", "Yes. Choose beginner experience, three training days and your available gym equipment. The illustrative week on this page shows one possible structure, not a guaranteed generated result. You can choose a different number of days in the same builder."],
      ["Is the plan generated by AI?", "The builder uses AI-assisted planning with the app's exercise catalog and validation. Always review the output; personalization does not make it medical advice."],
      ["Can I track the plan afterward?", "Save the plan and set it as active, then open the workout tracker to record sessions. The exercise library is also available without an account."]
    ],
    related: ["training-volume", "workout-tracker", "meal-plan-generator"]
  },
  {
    id: "meal-plan-generator",
    route: "/features/meal-plan-generator",
    file: "features/meal-plan-generator.html",
    label: "Meal planning",
    keyword: "personalized meal plan generator",
    title: "Free One-Day Meal Plan Generator with Macros | FuelPhysique",
    description: "Plan one day of meals with ingredient portions, estimated calories and protein. Choose food preferences, review servings and replace meals. Free with sign-in.",
    h1: "Plan one day of meals, with portions, calories and protein.",
    eyebrow: "Personalized meal plan generator",
    intro: "Turn your food preferences into a personalized one-day meal plan. See what to prepare, ingredient quantities for each serving and estimated calories and protein for each meal and the day. Choose your dietary style and meal count, then review or replace meals before saving.",
    choices: [
      ["One day at a time", "Meals and a shopping list for the day"],
      ["Your preferences", "Dietary style, avoided foods and prep needs"],
      ["Clear portions", "Ingredient quantities and nutrition estimates"],
      ["Room to adjust", "Replace suitable meals from the catalog"]
    ],
    connections: [
      ["nutrition-tracker", "Turn a plan into daily targets", "Save and activate your nutrition plan to supply the diary’s calorie and protein targets. Log what you eat separately; generating meals does not log them."],
      ["workout-plan-generator", "Build the training side of your routine", "Choose your training days, equipment and experience in the workout builder. Save a workout plan alongside your meal plan."],
      ["training-volume", "Understand your planned training", "Review weekly sets by muscle in your workout plan. This shows planned exercise workload; it does not automatically change your meal targets."]
    ],
    cta: "Build my meal plan",
    destination: "/nutrition-builder.html?lang=en",
    access: "Free to use. Fill in your preferences first; sign in to generate and save your plan.",
    preview: "nutrition",
    previewTitle: "Meals with amounts, not just ideas",
    problemTitle: "A calorie target is not a shopping list.",
    problem: "Knowing a daily number still leaves you deciding what to eat, how much to prepare and how the meals fit together. A generic menu may also ignore the foods you avoid or the time you have for cooking.",
    solution: "FuelPhysique combines AI-assisted meal selection with a curated food and meal catalog. The result includes ingredient quantities and estimated totals. Review your plan, replace suitable alternatives and use its shopping list to prepare for the day.",
    steps: [
      ["Set your preferences", "Choose your nutrition goal, dietary style, meal count and preparation preferences."],
      ["Include important restrictions", "Enter allergies and foods to avoid. Check the ingredients yourself before preparing any suggested meal."],
      ["Generate a day of meals", "Sign in to generate from your saved form answers. Review portions, calories and protein across the day."],
      ["Make it practical", "Replace meals as needed, review the shopping list and save or activate the plan."]
    ],
    benefits: [
      ["Ingredient-level clarity", "See amounts alongside each meal instead of guessing a serving size from a food photograph."],
      ["Preferences in one place", "Plan with dietary style, avoided foods and preparation needs together."],
      ["Planning meets logging", "An active nutrition plan supplies calorie and protein targets to your food diary; actual food intake is logged separately."]
    ],
    detail: {
      id: "portions",
      title: "Serving sizes guide your day’s calorie and protein estimates.",
      text: "Meal photos help identify the dish, but they are illustrative. Follow the listed quantities and check product labels: food brands, preparation and substitutions can change nutrition values. A generated meal plan is a proposal; it does not mean those meals have been eaten or logged.",
      note: "Nutrition estimates are not medical treatment. If you have a condition requiring a prescribed diet, seek advice from a qualified professional."
    },
    faqs: [
      ["Does the generator create a full week of meals?", "It creates a day of meals. You can save plans and generate alternatives, but this feature does not promise an automatically scheduled seven-day menu."],
      ["Can I replace a meal?", "Yes. The plan supports meal replacements from the available catalog, subject to your dietary restrictions and other constraints. The number of suitable choices varies."],
      ["Are the calories exact?", "No. Calories and macros are estimates calculated from food quantities. Check labels and actual serving weights when precision matters; a photo is not a portion measurement."],
      ["Do I need to register before filling out the form?", "No. Explore the form first. When you generate, the sign-in flow preserves your answers. An account lets you save the result and set an active plan."]
    ],
    related: ["nutrition-tracker", "workout-plan-generator", "progress-tracking"]
  },
  {
    id: "nutrition-tracker",
    connections: [
      ["meal-plan-generator", "Give your diary a target", "Save and activate a one-day nutrition plan to set calorie and protein targets. The diary still records only the food you enter."],
      ["workout-plan-generator", "Keep training in the same routine", "Build a workout plan around your schedule and equipment, then save it to use in the workout tracker."],
      ["training-volume", "Review planned sets alongside food intake", "Weekly Sets describes your planned training. Diary totals describe logged food. Keep that distinction when reviewing your routine."]
    ],
    route: "/features/nutrition-tracker",
    file: "features/nutrition-tracker.html",
    label: "Food diary",
    keyword: "food diary and nutrition tracker",
    title: "Food Diary & Nutrition Tracker — Log Your Meals | FuelPhysique",
    description: "Log food, review portions and track estimated calories and macros. Try three guest entries, then sign in to save your FuelPhysique nutrition diary.",
    h1: "Log your food. See what is left.",
    eyebrow: "Food diary and nutrition tracker",
    intro: "Keep an editable food log with estimated calories, protein, carbs and fat. With an active nutrition plan, see your daily targets and remaining amounts alongside what you have logged.",
    cta: "Try the food diary",
    destination: "/daily-nutrition.html?guest=1&lang=en",
    access: "Try up to three food entries as a guest. Sign in to add more and save your diary.",
    preview: "diary",
    previewTitle: "Your day, summarized in one place",
    problemTitle: "Remembering meals is not the same as seeing your day.",
    problem: "A meal plan shows what you intended to eat. Real days include changed portions, snacks and substitutions. Without a food log, it is hard to compare that intake with your plan.",
    solution: "Enter the foods you actually ate, review the interpreted portions and correct estimates when needed. FuelPhysique totals the diary and shows your macro split. Calorie and protein targets come from an active nutrition plan, so remaining amounts have a clear reference.",
    steps: [
      ["Try a food entry", "Open the guest diary and describe a food or meal. Use the free three-entry trial to explore the process."],
      ["Review the interpretation", "Check foods and quantities. Resolve any clarification and edit portions rather than assuming the first estimate is exact."],
      ["Check your daily totals", "See estimated calories and macros. Activate a nutrition plan if you want calorie and protein targets."],
      ["Keep a saved history", "Sign in to save and continue adding food. Use the calendar to revisit dates and their logged calorie totals."]
    ],
    benefits: [
      ["An editable food list", "Correct an entry, duplicate a repeated food or remove something you did not eat."],
      ["Totals connected to a plan", "Compare logged calories and protein with your active plan rather than an unexplained default target."],
      ["A date-by-date view", "Use the diary calendar to see logged calorie totals and open a previous day."]
    ],
    detail: {
      id: "logging",
      title: "A useful log is a reviewed log.",
      text: "Descriptions such as “a sandwich” can mean very different portions. Include amounts where you know them and review the result before treating it as your intake. The diary estimates nutrition; it does not independently measure a meal.",
      note: "Guest entries are a local trial, not a durable account backup. Sign in to save your diary; browser storage can be cleared."
    },
    faqs: [
      ["Can I try the tracker without registering?", "Yes. Continue as a guest and add up to three food entries. You will be asked to sign in to add more or save your diary."],
      ["Why might my calorie target be missing?", "Targets come from your active nutrition plan. Build and save a nutrition plan, then activate it. You can still view the totals of foods you log without a target."],
      ["Can I change a food after adding it?", "Yes. You can review and edit entries. The food row also provides duplicate and delete actions, so you can correct the log as your day changes."],
      ["Does an empty calendar date mean I ate nothing?", "No. It only means there is no logged intake for that date. The diary records what you enter, not every meal automatically."]
    ],
    related: ["meal-plan-generator", "progress-tracking", "workout-plan-generator"]
  },
  {
    id: "workout-tracker",
    route: "/features/workout-tracker",
    file: "features/workout-tracker.html",
    label: "Workout tracking",
    keyword: "workout tracker",
    title: "Workout Tracker — Log Sets & Review Sessions | FuelPhysique",
    description: "Follow an active workout plan, record sets and use a rest timer. Save completed sessions and revisit workout history with FuelPhysique's workout tracker.",
    h1: "Bring your plan to the session. Keep the record.",
    eyebrow: "Workout tracker",
    intro: "Open a session from your active plan, follow the exercises and record completed sets. A built-in rest timer helps you move through the workout; saved history keeps the session available afterward.",
    cta: "Open workout tracker",
    destination: "/auth.html?next=workout-tracker.html&lang=en",
    access: "Free with an account. You need a saved, active workout plan to start a session.",
    preview: "tracker",
    previewTitle: "A planned session, with rest timing built in",
    problemTitle: "The useful details are easy to lose between workouts.",
    problem: "A routine tells you what to train, but it cannot remind you what you actually recorded unless you keep a log. Notes scattered across your phone make it harder to review a previous session.",
    solution: "FuelPhysique links workout logging to your active saved plan. Follow the current exercise, record sets and save the completed session. Workout history and exercise progress give you a place to review the records instead of reconstructing them from memory.",
    steps: [
      ["Make a plan active", "Create or save a workout plan in your account and set it as your active routine."],
      ["Choose a session", "Open the tracker and select the session you want to perform."],
      ["Work through your sets", "Follow the exercise guidance, record your sets and use the rest timer between efforts."],
      ["Finish and save", "Save the completed workout. Open workout history or exercise progress to review your recorded sessions."]
    ],
    benefits: [
      ["Less switching between tools", "Keep the plan, current exercise and rest timing within the workout workflow."],
      ["A session you can revisit", "Completed workout records preserve the sets you logged instead of only the original prescription."],
      ["Context for your next session", "Exercise progress lets you review recorded performance. Decide future loads based on your readiness, not an automatic promise of progression."]
    ],
    detail: {
      id: "plan-versus-log",
      title: "Your plan and your workout log are different records.",
      text: "The plan describes intended training. A saved workout records what you completed in the tracker. Skipping a session does not turn planned sets into completed sets, and viewing a plan is not the same as logging a workout.",
      note: "The preview shows a sample plan and the tracker's initial rest-timer component. It is not a saved workout or a performance claim."
    },
    faqs: [
      ["Why do I need an active plan?", "The tracker starts sessions from your active workout plan. If you do not have one yet, use the workout builder, review the result, save it and make it active."],
      ["Is there a rest timer?", "Yes. The tracker includes rest timing within the session workflow, alongside the current exercise and set."],
      ["Where do completed sessions go?", "Use Finish & Save Workout to store the completed session in your account. Workout history lets you revisit recorded sessions."],
      ["Will the tracker decide when I should lift more?", "This page describes logging and reviewing your recorded performance, not an automatic progression coach. Use the records as context and adjust training responsibly."]
    ],
    related: ["workout-plan-generator", "training-volume", "progress-tracking"]
  },
  {
    id: "training-volume",
    connections: [
      ["workout-plan-generator", "Start with a workout plan", "Generate a routine from your days, equipment and experience. Open Weekly Sets to see how that plan distributes work."],
      ["meal-plan-generator", "Plan a day of meals too", "Create a separate meal plan with ingredient quantities and estimated nutrition. Weekly training sets do not automatically determine food targets."],
      ["nutrition-tracker", "Keep a record of actual intake", "Activate your nutrition plan to see diary targets, then log the food you eat. Planned meals and logged meals remain separate."]
    ],
    route: "/features/training-volume",
    file: "features/training-volume.html",
    label: "Weekly training volume",
    keyword: "weekly training volume calculator",
    title: "Weekly Training Volume — Planned Sets by Muscle | FuelPhysique",
    description: "Review planned weekly sets by muscle in your FuelPhysique workout plan, including direct and fractional contributions. Understand your routine's workload.",
    h1: "See where your weekly training sets go.",
    eyebrow: "Weekly training volume calculator",
    intro: "Look beyond a long exercise list. FuelPhysique summarizes planned weekly work by muscle group, using direct sets and fractional contributions from exercises that involve multiple muscles.",
    cta: "Plan my weekly sets",
    destination: "/workout-builder.html?lang=en",
    access: "Explore the free workout builder. Sign in to generate and save a plan, then open Weekly Sets.",
    preview: "workout",
    previewTitle: "Weekly sets alongside your workout plan",
    problemTitle: "Counting exercises can hide how work is distributed.",
    problem: "A split may have different numbers of exercises on different days. Compound movements also involve more than one muscle, so simply counting exercise names does not explain each muscle group's planned workload.",
    solution: "FuelPhysique calculates a weekly set summary from the program's sessions and exercise mappings. Direct contributions and fractional secondary contributions are combined by muscle. This gives you a consistent way to inspect the plan without presenting every secondary contribution as a full direct set.",
    steps: [
      ["Build a weekly routine", "Choose your training days, equipment and preferences in the workout builder."],
      ["Review the generated plan", "Check the exercises and scheduled working sets before saving."],
      ["Open Weekly Sets", "Use the plan's Weekly Sets disclosure to inspect the summary by muscle group."],
      ["Check the context", "Consider the exercise mapping and training schedule. Use the tracker separately to record completed workouts."]
    ],
    benefits: [
      ["Muscle-level visibility", "See how the scheduled work is distributed rather than evaluating the plan by length alone."],
      ["Secondary work acknowledged", "Fractional contributions account for secondary muscle involvement without labeling it identical to direct work."],
      ["A clear planning reference", "Use the same summary when reviewing a generated or saved routine, alongside the actual exercises and sets."]
    ],
    detail: {
      id: "volume-definition",
      title: "Here, volume means planned weekly sets.",
      text: "This is not a weight × repetitions calculator, and it does not count only sessions you have completed. The summary depends on the saved program and the exercise catalog's muscle mappings. Unmapped exercises may not contribute to the muscle totals. Fractional credit is a planning model, not a measurement of your individual muscle stimulus.",
      note: "A target band is guidance within the planner, not a medical limit or a guarantee of recovery or muscle growth. Your tolerance and actual training can differ."
    },
    faqs: [
      ["Does this show what I actually trained this week?", "No. It summarizes the planned weekly program. Use workout logs to review completed sessions; planned and completed work should not be treated as interchangeable."],
      ["What are fractional sets?", "An exercise can give full credit to a primary muscle and partial credit to another involved muscle. The app uses its catalog mappings to calculate those contributions consistently."],
      ["Why might an exercise be missing from a muscle total?", "The calculation needs a recognized exercise mapping. Unmapped exercises are tracked separately and may not be counted toward a muscle's total."],
      ["Is this a separate spreadsheet tool?", "No. The weekly set summary is part of the workout planning workflow. Generate a plan and open Weekly Sets to inspect it."]
    ],
    related: ["workout-plan-generator", "workout-tracker", "progress-tracking"]
  },
  {
    id: "progress-tracking",
    route: "/features/progress-tracking",
    file: "features/progress-tracking.html",
    label: "Progress tracking",
    keyword: "fitness progress tracker",
    title: "Fitness Progress Tracker — Weight & Measurements | FuelPhysique",
    description: "Record body weight and measurements, review weight trends and compare optional private progress photos. Keep your FuelPhysique progress history in one place.",
    h1: "Keep a history, not just a single measurement.",
    eyebrow: "Fitness progress tracker",
    intro: "Record dated body-weight measurements, review your recent trend and keep body measurements together. Add private progress photos only if they are useful to you.",
    cta: "Start tracking progress",
    destination: "/auth.html?next=progress.html&lang=en",
    access: "Free with an account. Measurements and optional photos belong to your private progress history.",
    preview: "progress",
    previewTitle: "The starting view of your weight history",
    problemTitle: "One reading has very little context.",
    problem: "A number remembered from last month is hard to compare with today's measurement. Scattered notes and photos also make it difficult to know which dates or conditions you are comparing.",
    solution: "FuelPhysique keeps dated records and shows recent weight measurements together with a seven-day average and a comparison to the preceding period. You can also record waist, chest, arm and thigh measurements or compare selected photo dates.",
    steps: [
      ["Sign in to your account", "Open Progress Tracking to work with your own records."],
      ["Record a dated measurement", "Add body weight and, if helpful, body measurements. Use comparable measuring conditions."],
      ["Review the trend", "Check your latest weight, seven-day average and chart of the most recent 30 measurements."],
      ["Compare at your own pace", "Revisit measurement history or add optional front, side and back photos for a date-based comparison."]
    ],
    benefits: [
      ["Dates stay attached", "Measurements remain tied to their recorded dates so you do not have to rely on memory."],
      ["Recent averages for context", "Review a short-term average alongside individual entries instead of treating a single reading as the whole story."],
      ["More than one kind of record", "Use body measurements and optional photos alongside weight. None of these records automatically diagnoses health or body composition."]
    ],
    detail: {
      id: "measurement-context",
      title: "Consistency matters more than a dramatic comparison.",
      text: "The chart shows your most recent 30 measurements, not necessarily 30 consecutive days. The seven-day summary is based on recorded entries around your latest measurement. Missing days are not invented measurements. Take readings under similar conditions and use the records as context rather than a verdict.",
      note: "The preview reuses the actual progress page's empty summary. No personal measurements, photos or account data are shown on this public page."
    },
    faqs: [
      ["Do I have to upload photos?", "No. Progress photos are optional. You can use body-weight history and measurements without adding pictures."],
      ["Which body measurements can I record?", "The progress form includes waist, chest, arm and thigh measurements, together with the date."],
      ["Does the chart always show a full month?", "It shows the most recent 30 measurements. If you do not measure every day, those entries can cover a longer period."],
      ["Can visitors see my progress?", "This public page contains only an empty interface preview. Your actual progress records require your account. Sharing is a separate action; nothing is published by viewing this page."]
    ],
    related: ["workout-tracker", "nutrition-tracker", "meal-plan-generator"]
  }
];

const existingSitemapRoutes = [
  "/", "/about.html", "/people/ofek-zehavi.html", "/people/ofek-zehavi-he.html", "/exercise-library", "/pricing.html", "/faq.html",
  "/contact.html", "/terms.html", "/privacy.html", "/refund-policy.html",
  "/subscription-policy.html", "/accessibility.html", "/community-guidelines.html",
  "/copyright.html", "/subprocessors.html"
];
const hub = {
  id: "features", route: "/features", file: "features/index.html",
  label: "Features",
  title: "Fitness & Nutrition Tools — Explore FuelPhysique",
  description: "Explore FuelPhysique's workout planning, meal planning and tracking tools. See how each feature works before choosing where to start.",
  h1: "Plan your next step. Keep track of what follows."
};

module.exports = { ORIGIN, features, hub, existingSitemapRoutes };
