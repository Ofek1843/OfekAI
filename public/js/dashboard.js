import {
 auth, db }
 from "./firebase-config.js";
import {
 normalizeSubscription }
 from "./subscription-plans.js";
import {
 trackPageView }
 from "./analytics.js";
import {
  createWeeklyScheduleDays,  getWeekdayLabels,  normalizeDayIndex,  shiftWeeklyScheduleDays}
 from "./schedule-utils.js";
import {
 collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc }
 from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
 getIdToken, onAuthStateChanged, signOut }
 from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { guardProtectedPage } from "./verification-gate.js";
import { disassociateCurrentInstallation } from "./push-notifications.js";
const $ = selector => document.querySelector(selector);
const SUPPORTED_DASHBOARD_LANGUAGES = new Set(["en", "he", "es", "fr", "de", "ar", "zh"]);
const selectedLanguage = localStorage.getItem("ofek-ai-language") || "en";
const language = SUPPORTED_DASHBOARD_LANGUAGES.has(selectedLanguage) ? selectedLanguage : "en";
const he = language === "he";
const rtl = language === "he" || language === "ar";
let activeNutritionPlanForQuickFood = null;
const dailyFocusCopy = {
  en: { kicker: "TODAY'S FOCUS", title: "Your next best move", workout: "Start today's workout", workoutText: "Your next session is ready. One focused session keeps the week moving.", nutrition: "Log today's food", nutritionText: "Keep your nutrition picture current with one quick check-in.", progress: "Review your progress", progressText: "You completed today's action. Take a look at what is changing.", setup: "Set up your plan", setupText: "Choose your goal and equipment so FuelPhysique can build your first clear step.", start: "Start here", workouts: n => `${n} workout${n === 1 ? "" : "s"} this week`, streak: n => `${n} day${n === 1 ? "" : "s"} streak` },
  he: { kicker: "המיקוד של היום", title: "הצעד הבא שלך", workout: "התחלת האימון של היום", workoutText: "האימון הבא מוכן. אימון ממוקד אחד מקדם את השבוע.", nutrition: "תיעוד התזונה של היום", nutritionText: "שמרו על תמונת התזונה מעודכנת בבדיקה קצרה.", progress: "בדיקת ההתקדמות", progressText: "השלמתם את הפעולה של היום. זה הזמן לראות מה משתנה.", setup: "הגדרת התוכנית", setupText: "בחרו יעד וציוד כדי ש־FuelPhysique יבנה לכם צעד ראשון ברור.", start: "מתחילים כאן", workouts: n => `${n} אימונים השבוע`, streak: n => `רצף של ${n} ימים` },
  es: { kicker: "ENFOQUE DE HOY", title: "Tu próximo paso", workout: "Empieza el entrenamiento de hoy", workoutText: "Tu próxima sesión está lista. Una sesión mantiene la semana en marcha.", nutrition: "Registra la comida de hoy", nutritionText: "Mantén tu nutrición actualizada con un registro rápido.", progress: "Revisa tu progreso", progressText: "Completaste la acción de hoy. Mira qué está cambiando.", setup: "Configura tu plan", setupText: "Elige tu objetivo y equipo para crear tu primer paso.", start: "Empieza aquí", workouts: n => `${n} entrenamientos esta semana`, streak: n => `${n} días seguidos` },
  fr: { kicker: "OBJECTIF DU JOUR", title: "Votre prochaine étape", workout: "Commencer l'entraînement du jour", workoutText: "Votre prochaine séance est prête. Une séance ciblée fait avancer la semaine.", nutrition: "Noter l'alimentation du jour", nutritionText: "Gardez votre suivi nutritionnel à jour en quelques secondes.", progress: "Voir vos progrès", progressText: "Vous avez réalisé l'action du jour. Voyez ce qui évolue.", setup: "Configurer votre plan", setupText: "Choisissez votre objectif et votre équipement pour commencer.", start: "Commencer", workouts: n => `${n} entraînement${n === 1 ? "" : "s"} cette semaine`, streak: n => `${n} jour${n === 1 ? "" : "s"} consécutif${n === 1 ? "" : "s"}` },
  de: { kicker: "HEUTE IM FOKUS", title: "Dein nächster Schritt", workout: "Heutiges Training starten", workoutText: "Deine nächste Einheit ist bereit und hält die Woche in Bewegung.", nutrition: "Heutiges Essen eintragen", nutritionText: "Halte deinen Ernährungsüberblick mit einem kurzen Check-in aktuell.", progress: "Fortschritt ansehen", progressText: "Du hast die heutige Aktion erledigt. Sieh, was sich verändert.", setup: "Plan einrichten", setupText: "Wähle Ziel und Ausrüstung für deinen ersten klaren Schritt.", start: "Hier starten", workouts: n => `${n} Training${n === 1 ? "" : "s"} diese Woche`, streak: n => `${n} Tage Serie` },
  ar: { kicker: "تركيز اليوم", title: "خطوتك التالية", workout: "ابدأ تمرين اليوم", workoutText: "جلستك التالية جاهزة. جلسة مركزة تحافظ على تقدم الأسبوع.", nutrition: "سجل طعام اليوم", nutritionText: "حافظ على صورة تغذيتك بتسجيل سريع.", progress: "راجع تقدمك", progressText: "أنجزت مهمة اليوم. شاهد ما الذي يتغير.", setup: "إعداد خطتك", setupText: "اختر هدفك ومعداتك لبناء خطوتك الأولى.", start: "ابدأ من هنا", workouts: n => `${n} تمارين هذا الأسبوع`, streak: n => `سلسلة ${n} أيام` },
  zh: { kicker: "今日重点", title: "你的下一步", workout: "开始今天的训练", workoutText: "下一次训练已准备好。一次专注训练就能推动本周进度。", nutrition: "记录今天的饮食", nutritionText: "用一次快速记录保持营养数据最新。", progress: "查看你的进度", progressText: "你完成了今天的行动。看看有哪些变化。", setup: "设置你的计划", setupText: "选择目标和器械，开始清晰的第一步。", start: "从这里开始", workouts: n => `本周 ${n} 次训练`, streak: n => `连续 ${n} 天` }
};
const dailyFocusUi = dailyFocusCopy[language] || dailyFocusCopy.en;

function dashboardGreeting(name, locale) {
  const cleanName = String(name || "").trim();
  const hour = new Date().getHours();
  const greetings = {
    en: hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
    he: hour < 12 ? "בוקר טוב" : hour < 18 ? "צהריים טובים" : "ערב טוב",
    es: hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches",
    fr: hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir",
    de: hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend",
    ar: hour < 12 ? "صباح الخير" : hour < 18 ? "مساء الخير" : "مساء الخير",
    zh: hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好"
  };
  const greeting = greetings[locale] || greetings.en;
  return cleanName ? `${greeting}, ${cleanName}` : greeting;
}

const dashboardCopy = {
  en: {
    today: "TODAY",  welcome: name => dashboardGreeting(name, "en"),  intro: "Choose one clear move — train, fuel, track, or ask your coach.",  chat: "Ask your coach",  loading: "Loading your dashboard...",  week: "Workouts this week",  streak: "Current streak",  weight: "Latest weight",  sets: "Sets completed",  update: "Update progress",  next: "NEXT WORKOUT",  noneWorkout: "No active workout plan",  start: "Start workout",  nutrition: "ACTIVE NUTRITION",  noneNutrition: "No active nutrition plan",  calories: "Calories",  protein: "Protein",  manageNutrition: "Manage nutrition plans",  recent: "LAST WORKOUT",  noWorkouts: "No workouts yet",  history: "Workout history",  progress: "PROGRESS",  momentum: "Keep building momentum",  analytics: "Exercise analytics",  goal: (done, target) => target ? `${done} of ${target} planned workouts` : "Set a goal in Athlete Core",  streakHint: n => n ? "consecutive active days" : "Your first workout starts the streak",  setsHint: "Across your last 30 workouts",  exerciseMore: n => `and ${n} more`,  minutes: "minutes",  completed: "sets completed",  progressMessage: n => n ? `You have completed ${n} workouts. Every logged session improves your progress insights.` : "Finish your first workout to begin measuring progress.",  error: "Could not load your dashboard.",  quickFoodLabel: "Quick check-in",  quickFoodTitle: "Did you stray from the plan today?",  quickFoodText: "Write roughly what you ate today, and don't forget drinks. This is only an estimate.",  quickFoodEstimate: "Estimate calories",  quickFoodClear: "Clear",  quickFoodEmpty: "Approximate calories and macros will appear here.",  quickFoodPlaceholder: "Example: 2 eggs, chicken breast, rice, salad, milk, coffee",  quickFoodLow: "That does not look too dramatic — a light walk is enough.",  quickFoodMid: "This looks like a moderate deviation. Get back on track tomorrow.",  quickFoodHigh: "This looks like a higher-calorie day. No drama — just return to the routine tomorrow.",  scheduleLabel: "WEEKLY PLAN",  scheduleTitle: "Training days this week",  scheduleHint: "Drag a workout card to another day and the whole week slides together.",  scheduleShift: "Shift +1 day",  buildWorkout: "Build workout plan",  buildNutrition: "Build nutrition plan",  trackProgress: "Track progress",  heroHistory: "Workout history",  drawerCoach: "Chat with your coach",  drawerPrimary: "Start here",  drawerTraining: "Training tools",  drawerSupport: "Progress & account",  missedLabel: "MISSED TRACKING?",  missedTitle: "Missed a workout? Log it here",  missedText: "Add the workout later so your history and progress charts stay complete.",  missedAction: "Log a past workout",  manualLabel: "YOUR OWN PROGRAM",  manualTitle: "Build a plan manually",  manualText: "Search exercises, set your sets and rest times, and build or duplicate workout days at your pace.",  manualAction: "Create my plan",  manualNav: "Build a plan manually",  toolsKicker: "MORE TOOLS",  toolsSummary: "Open advanced tools",  toolsText: "History, manual planning, and nutrition check-ins live here so the main screen stays simple and easy to use.",  logout: "Log out",  logoutConfirm: "Log out of your account?",  logoutWorking: "Logging out...",  logoutError: "Could not log out. Please try again.", dailyNutrition: "Daily nutrition"
  },
  he: {
    today: "היום",  welcome: name => dashboardGreeting(name, "he"),  intro: "בחרו צעד ברור אחד — אימון, תזונה, התקדמות או מאמן.",  chat: "שאלו את המאמן שלכם",  loading: "טוען את הדשבורד שלכם...",  week: "אימונים השבוע",  streak: "רצף נוכחי",  weight: "משקל אחרון",  sets: "סטים שהושלמו",  update: "עדכון התקדמות",  next: "האימון הבא",  noneWorkout: "אין תוכנית אימון פעילה",  start: "התחלת אימון",  nutrition: "תזונה פעילה",  noneNutrition: "אין תוכנית תזונה פעילה",  calories: "קלוריות",  protein: "חלבון",  manageNutrition: "ניהול תוכניות תזונה",  recent: "האימון האחרון",  noWorkouts: "עדיין אין אימונים",  history: "היסטוריית אימונים",  progress: "התקדמות",  momentum: "ממשיכים לצבור תנופה",  analytics: "ניתוח תרגילים",  goal: (done, target) => target ? `${done} מתוך ${target} אימונים מתוכננים` : "הגדירו יעד ב־Athlete Core",  streakHint: n => n ? "ימים רצופים עם פעילות" : "האימון הראשון מתחיל את הרצף",  setsHint: "ב־30 האימונים האחרונים",  exerciseMore: n => `ועוד ${n}`,  minutes: "דקות",  completed: "סטים הושלמו",  progressMessage: n => n ? `השלמתם ${n} אימונים. כל אימון מתועד משפר את ניתוח ההתקדמות שלכם.` : "סיימו את האימון הראשון כדי להתחיל למדוד התקדמות.",  error: "לא ניתן לטעון את הדשבורד.",  quickFoodLabel: "בדיקה מהירה",  quickFoodTitle: "חרגתם מהתפריט היום?",  quickFoodText: "כתבו בקירוב מה אכלתם היום. אל תשכחו משקאות. זה חישוב משוער בלבד.",  quickFoodEstimate: "חשב קירוב",  quickFoodClear: "נקה",  quickFoodEmpty: "כאן יופיעו קלוריות ומאקרו משוערים.",  quickFoodPlaceholder: "לדוגמה: 2 ביצים, חזה עוף, אורז, סלט, חלב, קפה",  quickFoodLow: "נראה שהיום לא היה דרמטי במיוחד — אפשר לסגור אותו עם הליכה קלה.",  quickFoodMid: "יש כאן חריגה מתונה. חזרה למסלול מחר תספיק.",  quickFoodHigh: "נראה שהיום היה גבוה יותר קלורית. עדיף לחזור לשגרה ולא להילחץ.",  scheduleLabel: "תצוגת השבוע",  scheduleTitle: "ימי האימון של השבוע",  scheduleHint: "גררו אימון ליום אחר כדי להזיז את כל השבוע קדימה בלי לפגוע במנוחה.",  scheduleShift: "הזז יום קדימה",  buildWorkout: "בניית תוכנית אימון",  buildNutrition: "בניית תוכנית תזונה",  trackProgress: "מעקב התקדמות",  heroHistory: "היסטוריית אימונים",  drawerCoach: "שיחה עם המאמן",  drawerPrimary: "התחלה מהירה",  drawerTraining: "כלי אימון",  drawerSupport: "התקדמות וחשבון",  missedLabel: "פספסתם אימון?",  missedTitle: "הזינו אותו כאן",  missedText: "הוסיפו את האימון עכשיו כדי שההיסטוריה וגרפי ההתקדמות יישארו מלאים.",  missedAction: "הזנת אימון שבוצע",  manualLabel: "תוכנית עצמית",  manualTitle: "בניית תוכנית בעצמכם",  manualText: "בחרו תרגילים, קבעו סטים ומנוחות, ובנו או שכפלו ימי אימון בקצב שלכם.",  manualAction: "יצירת תוכנית עצמית",  manualNav: "בניית תוכנית עצמית",  toolsKicker: "כלים מתקדמים",  toolsSummary: "פתיחת כלים נוספים",  toolsText: "היסטוריה, בנייה ידנית ובדיקת חריגה נשמרים כאן כדי שהמסך הראשי יישאר פשוט וברור.",  logout: "התנתקות",  logoutConfirm: "להתנתק מהחשבון?",  logoutWorking: "מתנתק...",  logoutError: "לא הצלחנו להתנתק. נסו שוב.", dailyNutrition: "יומן תזונה יומי"
  },
  es: {
    today: "HOY", welcome: name => dashboardGreeting(name, "es"), intro: "Elige un siguiente paso claro: entrenar, comer, medir o preguntar al coach.", chat: "Pregunta a tu coach", loading: "Cargando tu panel...", week: "Entrenamientos esta semana", streak: "Racha actual", weight: "Último peso", sets: "Series completadas", update: "Actualizar progreso", next: "PRÓXIMO ENTRENAMIENTO", noneWorkout: "No hay plan de entrenamiento activo", start: "Iniciar entrenamiento", nutrition: "NUTRICIÓN ACTIVA", noneNutrition: "No hay plan nutricional activo", calories: "Calorías", protein: "Proteína", manageNutrition: "Gestionar planes de nutrición", recent: "ÚLTIMO ENTRENAMIENTO", noWorkouts: "Aún no hay entrenamientos", history: "Historial de entrenamientos", progress: "PROGRESO", momentum: "Sigue construyendo impulso", analytics: "Análisis de ejercicios", goal: (done, target) => target ? `${done} de ${target} entrenamientos planificados` : "Define un objetivo en Athlete Core", streakHint: n => n ? "días activos consecutivos" : "Tu primer entrenamiento inicia la racha", setsHint: "En tus últimos 30 entrenamientos", exerciseMore: n => `y ${n} más`, minutes: "minutos", completed: "series completadas", progressMessage: n => n ? `Has completado ${n} entrenamientos. Cada sesión registrada mejora tus datos de progreso.` : "Termina tu primer entrenamiento para empezar a medir el progreso.", error: "No se pudo cargar tu panel.", quickFoodLabel: "Registro rápido", quickFoodTitle: "¿Te saliste del plan hoy?", quickFoodText: "Escribe aproximadamente qué comiste hoy, incluyendo bebidas. Es solo una estimación.", quickFoodEstimate: "Estimar calorías", quickFoodClear: "Limpiar", quickFoodEmpty: "Aquí aparecerán calorías y macros aproximados.", quickFoodPlaceholder: "Ejemplo: 2 huevos, pechuga de pollo, arroz, ensalada, leche, café", quickFoodLow: "No parece muy dramático; una caminata ligera alcanza.", quickFoodMid: "Parece una desviación moderada. Vuelve al plan mañana.", quickFoodHigh: "Parece un día alto en calorías. Sin drama: vuelve a la rutina mañana.", scheduleLabel: "PLAN SEMANAL", scheduleTitle: "Días de entrenamiento esta semana", scheduleHint: "Arrastra un entrenamiento a otro día y toda la semana se ajustará.", scheduleShift: "Mover +1 día", buildWorkout: "Crear plan de entrenamiento", buildNutrition: "Crear plan de nutrición", trackProgress: "Ver progreso", heroHistory: "Historial de entrenamientos", drawerCoach: "Chatear con tu coach", drawerPrimary: "Inicio rápido", drawerTraining: "Herramientas de entrenamiento", drawerSupport: "Progreso y cuenta", missedLabel: "¿FALTA REGISTRAR?", missedTitle: "¿Olvidaste un entrenamiento? Regístralo aquí", missedText: "Añádelo luego para mantener completo tu historial y tus gráficos.", missedAction: "Registrar entrenamiento pasado", manualLabel: "TU PROPIO PROGRAMA", manualTitle: "Crear un plan manualmente", manualText: "Busca ejercicios, ajusta series y descansos, y crea o duplica días.", manualAction: "Crear mi plan", manualNav: "Crear plan manual", toolsKicker: "MÁS HERRAMIENTAS", toolsSummary: "Abrir herramientas avanzadas", toolsText: "Historial, planificación manual y registros rápidos viven aquí para mantener simple la pantalla principal.", logout: "Cerrar sesión", logoutConfirm: "¿Cerrar sesión?", logoutWorking: "Cerrando sesión...", logoutError: "No se pudo cerrar sesión. Inténtalo de nuevo.", dailyNutrition: "Nutrición diaria"
  },
  fr: {
    today: "AUJOURD'HUI", welcome: name => dashboardGreeting(name, "fr"), intro: "Choisissez une action claire : entraînement, nutrition, progrès ou coach.", chat: "Demander au coach", loading: "Chargement de votre tableau de bord...", week: "Entraînements cette semaine", streak: "Série actuelle", weight: "Dernier poids", sets: "Séries terminées", update: "Mettre à jour les progrès", next: "PROCHAIN ENTRAÎNEMENT", noneWorkout: "Aucun programme d'entraînement actif", start: "Démarrer l'entraînement", nutrition: "NUTRITION ACTIVE", noneNutrition: "Aucun plan nutritionnel actif", calories: "Calories", protein: "Protéines", manageNutrition: "Gérer les plans nutritionnels", recent: "DERNIER ENTRAÎNEMENT", noWorkouts: "Aucun entraînement pour le moment", history: "Historique des entraînements", progress: "PROGRÈS", momentum: "Continuez à avancer", analytics: "Analyse des exercices", goal: (done, target) => target ? `${done} sur ${target} entraînements prévus` : "Définissez un objectif dans Athlete Core", streakHint: n => n ? "jours actifs consécutifs" : "Votre premier entraînement lance la série", setsHint: "Sur vos 30 derniers entraînements", exerciseMore: n => `et ${n} de plus`, minutes: "minutes", completed: "séries terminées", progressMessage: n => n ? `Vous avez terminé ${n} entraînements. Chaque séance enregistrée améliore vos analyses.` : "Terminez votre premier entraînement pour commencer à mesurer vos progrès.", error: "Impossible de charger le tableau de bord.", quickFoodLabel: "Point rapide", quickFoodTitle: "Vous vous êtes éloigné du plan aujourd'hui ?", quickFoodText: "Écrivez approximativement ce que vous avez mangé aujourd'hui, boissons incluses. Ceci reste une estimation.", quickFoodEstimate: "Estimer les calories", quickFoodClear: "Effacer", quickFoodEmpty: "Les calories et macros approximatives apparaîtront ici.", quickFoodPlaceholder: "Exemple : 2 œufs, blanc de poulet, riz, salade, lait, café", quickFoodLow: "Cela ne semble pas trop important ; une marche légère suffit.", quickFoodMid: "C'est un écart modéré. Revenez au plan demain.", quickFoodHigh: "La journée semble plus calorique. Pas de panique : reprenez la routine demain.", scheduleLabel: "PLAN HEBDOMADAIRE", scheduleTitle: "Jours d'entraînement cette semaine", scheduleHint: "Déplacez une séance vers un autre jour et toute la semaine suivra.", scheduleShift: "Décaler d'un jour", buildWorkout: "Créer un programme", buildNutrition: "Créer un plan nutritionnel", trackProgress: "Voir les progrès", heroHistory: "Historique d'entraînement", drawerCoach: "Discuter avec le coach", drawerPrimary: "Démarrage rapide", drawerTraining: "Outils d'entraînement", drawerSupport: "Progrès et compte", missedLabel: "SUIVI MANQUÉ ?", missedTitle: "Séance oubliée ? Ajoutez-la ici", missedText: "Ajoutez-la plus tard pour garder l'historique et les graphiques complets.", missedAction: "Ajouter une ancienne séance", manualLabel: "VOTRE PROGRAMME", manualTitle: "Créer un plan manuellement", manualText: "Cherchez des exercices, réglez les séries et les repos, puis créez ou dupliquez des jours.", manualAction: "Créer mon plan", manualNav: "Créer un plan manuel", toolsKicker: "OUTILS AVANCÉS", toolsSummary: "Ouvrir les outils avancés", toolsText: "Historique, planification manuelle et point nutrition restent ici pour garder l'écran principal simple.", logout: "Déconnexion", logoutConfirm: "Vous déconnecter ?", logoutWorking: "Déconnexion...", logoutError: "Impossible de se déconnecter. Réessayez.", dailyNutrition: "Nutrition quotidienne"
  },
  de: {
    today: "HEUTE", welcome: name => dashboardGreeting(name, "de"), intro: "Wähle einen klaren nächsten Schritt: Training, Ernährung, Fortschritt oder Coach.", chat: "Coach fragen", loading: "Dashboard wird geladen...", week: "Trainings diese Woche", streak: "Aktuelle Serie", weight: "Letztes Gewicht", sets: "Abgeschlossene Sätze", update: "Fortschritt aktualisieren", next: "NÄCHSTES TRAINING", noneWorkout: "Kein aktiver Trainingsplan", start: "Training starten", nutrition: "AKTIVE ERNÄHRUNG", noneNutrition: "Kein aktiver Ernährungsplan", calories: "Kalorien", protein: "Protein", manageNutrition: "Ernährungspläne verwalten", recent: "LETZTES TRAINING", noWorkouts: "Noch keine Trainings", history: "Trainingsverlauf", progress: "FORTSCHRITT", momentum: "Dranbleiben", analytics: "Übungsanalyse", goal: (done, target) => target ? `${done} von ${target} geplanten Trainings` : "Ziel in Athlete Core festlegen", streakHint: n => n ? "aufeinanderfolgende aktive Tage" : "Dein erstes Training startet die Serie", setsHint: "Aus deinen letzten 30 Trainings", exerciseMore: n => `und ${n} weitere`, minutes: "Minuten", completed: "Sätze abgeschlossen", progressMessage: n => n ? `Du hast ${n} Trainings abgeschlossen. Jede protokollierte Einheit verbessert deine Auswertung.` : "Beende dein erstes Training, um Fortschritt zu messen.", error: "Dashboard konnte nicht geladen werden.", quickFoodLabel: "Schnellcheck", quickFoodTitle: "Heute vom Plan abgewichen?", quickFoodText: "Schreibe ungefähr auf, was du heute gegessen hast, Getränke eingeschlossen. Nur eine Schätzung.", quickFoodEstimate: "Kalorien schätzen", quickFoodClear: "Leeren", quickFoodEmpty: "Geschätzte Kalorien und Makros erscheinen hier.", quickFoodPlaceholder: "Beispiel: 2 Eier, Hähnchenbrust, Reis, Salat, Milch, Kaffee", quickFoodLow: "Das wirkt nicht dramatisch; ein leichter Spaziergang reicht.", quickFoodMid: "Das ist eine moderate Abweichung. Morgen wieder in die Routine.", quickFoodHigh: "Das wirkt kalorienreicher. Kein Stress: morgen zurück zur Routine.", scheduleLabel: "WOCHENPLAN", scheduleTitle: "Trainingstage diese Woche", scheduleHint: "Ziehe ein Training auf einen anderen Tag und die ganze Woche verschiebt sich.", scheduleShift: "+1 Tag verschieben", buildWorkout: "Trainingsplan erstellen", buildNutrition: "Ernährungsplan erstellen", trackProgress: "Fortschritt ansehen", heroHistory: "Trainingsverlauf", drawerCoach: "Mit dem Coach chatten", drawerPrimary: "Schnellstart", drawerTraining: "Trainingstools", drawerSupport: "Fortschritt und Konto", missedLabel: "TRACKING VERPASST?", missedTitle: "Training verpasst? Hier eintragen", missedText: "Trage es später ein, damit Verlauf und Diagramme vollständig bleiben.", missedAction: "Vergangenes Training eintragen", manualLabel: "EIGENER PLAN", manualTitle: "Plan manuell erstellen", manualText: "Suche Übungen, setze Sätze und Pausen und erstelle oder dupliziere Trainingstage.", manualAction: "Meinen Plan erstellen", manualNav: "Plan manuell erstellen", toolsKicker: "WEITERE TOOLS", toolsSummary: "Erweiterte Tools öffnen", toolsText: "Verlauf, manuelle Planung und Ernährungschecks bleiben hier, damit die Hauptansicht einfach bleibt.", logout: "Abmelden", logoutConfirm: "Vom Konto abmelden?", logoutWorking: "Abmeldung...", logoutError: "Abmelden fehlgeschlagen. Bitte erneut versuchen.", dailyNutrition: "Tägliche Ernährung"
  },
  ar: {
    today: "اليوم", welcome: name => dashboardGreeting(name, "ar"), intro: "اختر خطوة واضحة: تدريب، تغذية، تقدم، أو سؤال المدرب.", chat: "اسأل مدربك", loading: "جارٍ تحميل لوحة التحكم...", week: "تمارين هذا الأسبوع", streak: "السلسلة الحالية", weight: "آخر وزن", sets: "المجموعات المكتملة", update: "تحديث التقدم", next: "التمرين التالي", noneWorkout: "لا توجد خطة تدريب نشطة", start: "بدء التمرين", nutrition: "التغذية النشطة", noneNutrition: "لا توجد خطة تغذية نشطة", calories: "السعرات", protein: "البروتين", manageNutrition: "إدارة خطط التغذية", recent: "آخر تمرين", noWorkouts: "لا توجد تمارين بعد", history: "سجل التمارين", progress: "التقدم", momentum: "استمر في بناء الزخم", analytics: "تحليل التمارين", goal: (done, target) => target ? `${done} من ${target} تمارين مخططة` : "حدد هدفًا في Athlete Core", streakHint: n => n ? "أيام نشاط متتالية" : "أول تمرين يبدأ السلسلة", setsHint: "ضمن آخر 30 تمرينًا", exerciseMore: n => `و ${n} أخرى`, minutes: "دقائق", completed: "مجموعات مكتملة", progressMessage: n => n ? `أكملت ${n} تمارين. كل تمرين مسجل يحسن تحليل تقدمك.` : "أنه أول تمرين لتبدأ قياس التقدم.", error: "تعذر تحميل لوحة التحكم.", quickFoodLabel: "تسجيل سريع", quickFoodTitle: "هل خرجت عن الخطة اليوم؟", quickFoodText: "اكتب تقريبًا ما أكلته اليوم، ولا تنس المشروبات. هذا تقدير فقط.", quickFoodEstimate: "تقدير السعرات", quickFoodClear: "مسح", quickFoodEmpty: "ستظهر هنا السعرات والماكروز التقريبية.", quickFoodPlaceholder: "مثال: بيضتان، صدر دجاج، أرز، سلطة، حليب، قهوة", quickFoodLow: "لا يبدو الأمر كبيرًا؛ مشي خفيف يكفي.", quickFoodMid: "هذا انحراف متوسط. عد إلى الخطة غدًا.", quickFoodHigh: "يبدو اليوم أعلى بالسعرات. لا مشكلة، عد للروتين غدًا.", scheduleLabel: "الخطة الأسبوعية", scheduleTitle: "أيام التدريب هذا الأسبوع", scheduleHint: "اسحب التمرين إلى يوم آخر وسيتحرك الأسبوع كله معه.", scheduleShift: "تحريك يوم واحد", buildWorkout: "إنشاء خطة تدريب", buildNutrition: "إنشاء خطة تغذية", trackProgress: "عرض التقدم", heroHistory: "سجل التمارين", drawerCoach: "الدردشة مع المدرب", drawerPrimary: "ابدأ هنا", drawerTraining: "أدوات التدريب", drawerSupport: "التقدم والحساب", missedLabel: "فاتك التسجيل؟", missedTitle: "فاتك تمرين؟ سجله هنا", missedText: "أضف التمرين لاحقًا حتى يبقى السجل والرسوم مكتملة.", missedAction: "تسجيل تمرين سابق", manualLabel: "برنامجك الخاص", manualTitle: "إنشاء خطة يدويًا", manualText: "ابحث عن التمارين وحدد المجموعات والراحة وأنشئ أو انسخ أيام التدريب.", manualAction: "إنشاء خطتي", manualNav: "إنشاء خطة يدويًا", toolsKicker: "أدوات إضافية", toolsSummary: "فتح الأدوات المتقدمة", toolsText: "السجل والتخطيط اليدوي وفحص التغذية تبقى هنا حتى تظل الشاشة الرئيسية بسيطة.", logout: "تسجيل الخروج", logoutConfirm: "تسجيل الخروج من الحساب؟", logoutWorking: "جارٍ تسجيل الخروج...", logoutError: "تعذر تسجيل الخروج. حاول مرة أخرى.", dailyNutrition: "التغذية اليومية"
  },
  zh: {
    today: "今天", welcome: name => dashboardGreeting(name, "zh"), intro: "选择一个清晰的下一步：训练、饮食、进度或询问教练。", chat: "询问教练", loading: "正在加载仪表板...", week: "本周训练", streak: "当前连续天数", weight: "最新体重", sets: "已完成组数", update: "更新进度", next: "下一次训练", noneWorkout: "没有启用的训练计划", start: "开始训练", nutrition: "当前营养计划", noneNutrition: "没有启用的营养计划", calories: "卡路里", protein: "蛋白质", manageNutrition: "管理营养计划", recent: "最近训练", noWorkouts: "还没有训练记录", history: "训练历史", progress: "进度", momentum: "继续积累进展", analytics: "动作分析", goal: (done, target) => target ? `${done}/${target} 次计划训练` : "在 Athlete Core 中设置目标", streakHint: n => n ? "连续活跃天数" : "第一次训练会开启连续记录", setsHint: "最近 30 次训练", exerciseMore: n => `另外 ${n} 个`, minutes: "分钟", completed: "组已完成", progressMessage: n => n ? `你已完成 ${n} 次训练。每次记录都会让进度分析更准确。` : "完成第一次训练后即可开始跟踪进度。", error: "无法加载仪表板。", quickFoodLabel: "快速记录", quickFoodTitle: "今天偏离计划了吗？", quickFoodText: "大致写下今天吃了什么，也包括饮品。这只是估算。", quickFoodEstimate: "估算卡路里", quickFoodClear: "清除", quickFoodEmpty: "估算的卡路里和宏量营养会显示在这里。", quickFoodPlaceholder: "例如：2 个鸡蛋、鸡胸肉、米饭、沙拉、牛奶、咖啡", quickFoodLow: "看起来不算严重，轻松散步即可。", quickFoodMid: "这是中等偏离，明天回到计划就好。", quickFoodHigh: "今天热量可能偏高。别紧张，明天回到规律即可。", scheduleLabel: "周计划", scheduleTitle: "本周训练日", scheduleHint: "把训练拖到另一天，整周安排会一起移动。", scheduleShift: "后移一天", buildWorkout: "生成训练计划", buildNutrition: "生成营养计划", trackProgress: "查看进度", heroHistory: "训练历史", drawerCoach: "和教练聊天", drawerPrimary: "从这里开始", drawerTraining: "训练工具", drawerSupport: "进度与账户", missedLabel: "漏记了吗？", missedTitle: "漏掉训练？在这里补记", missedText: "稍后添加训练，让历史和进度图保持完整。", missedAction: "补记过去训练", manualLabel: "自定义计划", manualTitle: "手动创建计划", manualText: "搜索动作、设置组数和休息，并创建或复制训练日。", manualAction: "创建我的计划", manualNav: "手动创建计划", toolsKicker: "更多工具", toolsSummary: "打开高级工具", toolsText: "历史、手动计划和营养快速记录放在这里，让主屏保持简单。", logout: "退出登录", logoutConfirm: "要退出账户吗？", logoutWorking: "正在退出...", logoutError: "退出失败，请重试。", dailyNutrition: "每日营养"
  }
};
const rawUi = dashboardCopy[language] || dashboardCopy.en;
const v4Copy = {
  en: {
    capabilityStudioTitle: "Start with one clear move",
    date: "DATE",
    streak: "STREAK",
    days: "days",
    day: "day",
    lastDate: "Date",
    lastDuration: "Duration",
    lastSets: "Sets",
    lastExercises: "Exercises",
    weekOnTrack: "Your training week is on track.",
    weekReady: "Your next move is ready to choose.",
    studioTrainingKicker: "TRAINING STUDIO",
    studioTrainingTitle: "Build your next session",
    studioTrainingText: "Generate a plan, shape it manually, or reopen a saved session.",
    studioManualWorkoutLink: "Build manually",
    studioSavedWorkoutLink: "Saved plans",
    studioNutritionKicker: "FUEL",
    studioNutritionTitle: "Plan what powers you",
    studioNutritionText: "Turn your target and preferences into meals you can actually follow.",
    studioManualNutritionLink: "Build manually",
    studioSavedNutritionLink: "Saved plans",
    studioProgressKicker: "PROGRESS",
    studioProgressTitle: "See whether it is working",
    studioProgressText: "Log body metrics, inspect trends, and keep personal records visible.",
    studioExerciseProgressLink: "Exercise progress",
    studioCoachKicker: "COACH",
    studioCoachTitle: "Turn a question into action",
    studioCoachText: "Ask about the plan you are following and get a practical next step.",
    studioSocialKicker: "SOCIAL",
    studioSocialTitle: "Share the work",
    studioSocialText: "Message friends and exchange plans, progress, voice, and music safely."
  },
  he: {
  capabilityStudioTitle: "מתחילים מצעד ברור אחד",
  date: "תאריך",
  streak: "רצף",
  days: "ימים",
  day: "יום",
  lastDate: "תאריך",
  lastDuration: "משך",
  lastSets: "סטים",
  lastExercises: "תרגילים",
  weekOnTrack: "שבוע האימונים שלך מתקדם לפי התוכנית.",
  weekReady: "הצעד הבא שלך מוכן לבחירה.",
  studioTrainingKicker: "מרכז אימונים",
  studioTrainingTitle: "בונים את האימון הבא",
  studioTrainingText: "צרו תוכנית, עצבו אותה ידנית או פתחו אימון שמור להמשך.",
  studioManualWorkoutLink: "בנייה ידנית",
  studioSavedWorkoutLink: "תוכניות שמורות",
  studioNutritionKicker: "תדלוק",
  studioNutritionTitle: "מתכננים מה שייתן לכם כוח",
  studioNutritionText: "הפכו את היעד וההעדפות לארוחות שאפשר באמת לעקוב אחריהן.",
  studioManualNutritionLink: "בנייה ידנית",
  studioSavedNutritionLink: "תוכניות שמורות",
  studioProgressKicker: "התקדמות",
  studioProgressTitle: "רואים אם זה עובד",
  studioProgressText: "תעדו מדדי גוף, בדקו מגמות ושמרו שיאים אישיים במקום אחד.",
  studioExerciseProgressLink: "התקדמות בתרגילים",
  studioCoachKicker: "מאמן",
  studioCoachTitle: "הופכים שאלה לפעולה",
  studioCoachText: "שאלו על התוכנית הפעילה וקבלו צעד מעשי שאפשר לבצע עכשיו.",
  studioSocialKicker: "חברים",
  studioSocialTitle: "משתפים את העבודה",
  studioSocialText: "שלחו הודעות ושתפו תוכניות, התקדמות, קול ומוזיקה בבטחה."
  },
  es: {
    capabilityStudioTitle: "Empieza con una acción clara", date: "FECHA", streak: "RACHA", days: "días", day: "día", lastDate: "Fecha", lastDuration: "Duración", lastSets: "Series", lastExercises: "Ejercicios", weekOnTrack: "Tu semana de entrenamiento va según el plan.", weekReady: "Tu siguiente paso está listo.", studioTrainingKicker: "ESTUDIO DE ENTRENAMIENTO", studioTrainingTitle: "Construye tu próxima sesión", studioTrainingText: "Genera un plan, edítalo manualmente o abre una sesión guardada.", studioManualWorkoutLink: "Crear manualmente", studioSavedWorkoutLink: "Planes guardados", studioNutritionKicker: "COMBUSTIBLE", studioNutritionTitle: "Planifica lo que te da energía", studioNutritionText: "Convierte tu objetivo y preferencias en comidas que puedas seguir.", studioManualNutritionLink: "Crear manualmente", studioSavedNutritionLink: "Planes guardados", studioProgressKicker: "PROGRESO", studioProgressTitle: "Comprueba si funciona", studioProgressText: "Registra métricas, revisa tendencias y guarda marcas personales.", studioExerciseProgressLink: "Progreso por ejercicio", studioCoachKicker: "COACH", studioCoachTitle: "Convierte una pregunta en acción", studioCoachText: "Pregunta sobre tu plan y recibe un siguiente paso práctico.", studioSocialKicker: "SOCIAL", studioSocialTitle: "Comparte el trabajo", studioSocialText: "Envía mensajes y comparte planes, progreso, voz y música con seguridad."
  },
  fr: {
    capabilityStudioTitle: "Commencez par une action claire", date: "DATE", streak: "SÉRIE", days: "jours", day: "jour", lastDate: "Date", lastDuration: "Durée", lastSets: "Séries", lastExercises: "Exercices", weekOnTrack: "Votre semaine d'entraînement suit le plan.", weekReady: "Votre prochaine action est prête.", studioTrainingKicker: "STUDIO D'ENTRAÎNEMENT", studioTrainingTitle: "Construisez votre prochaine séance", studioTrainingText: "Générez un programme, ajustez-le manuellement ou rouvrez une séance sauvegardée.", studioManualWorkoutLink: "Créer manuellement", studioSavedWorkoutLink: "Plans sauvegardés", studioNutritionKicker: "ÉNERGIE", studioNutritionTitle: "Planifiez ce qui vous nourrit", studioNutritionText: "Transformez votre objectif et vos préférences en repas faciles à suivre.", studioManualNutritionLink: "Créer manuellement", studioSavedNutritionLink: "Plans sauvegardés", studioProgressKicker: "PROGRÈS", studioProgressTitle: "Voyez si cela fonctionne", studioProgressText: "Enregistrez vos mesures, suivez les tendances et gardez vos records.", studioExerciseProgressLink: "Progrès par exercice", studioCoachKicker: "COACH", studioCoachTitle: "Transformez une question en action", studioCoachText: "Demandez conseil sur votre plan et repartez avec une étape concrète.", studioSocialKicker: "SOCIAL", studioSocialTitle: "Partagez le travail", studioSocialText: "Échangez messages, plans, progrès, voix et musique en sécurité."
  },
  de: {
    capabilityStudioTitle: "Starte mit einem klaren Schritt", date: "DATUM", streak: "SERIE", days: "Tage", day: "Tag", lastDate: "Datum", lastDuration: "Dauer", lastSets: "Sätze", lastExercises: "Übungen", weekOnTrack: "Deine Trainingswoche läuft nach Plan.", weekReady: "Dein nächster Schritt ist bereit.", studioTrainingKicker: "TRAININGSSTUDIO", studioTrainingTitle: "Baue deine nächste Einheit", studioTrainingText: "Erstelle einen Plan, passe ihn manuell an oder öffne eine gespeicherte Einheit.", studioManualWorkoutLink: "Manuell erstellen", studioSavedWorkoutLink: "Gespeicherte Pläne", studioNutritionKicker: "ENERGIE", studioNutritionTitle: "Plane, was dich antreibt", studioNutritionText: "Mache aus Ziel und Vorlieben Mahlzeiten, denen du folgen kannst.", studioManualNutritionLink: "Manuell erstellen", studioSavedNutritionLink: "Gespeicherte Pläne", studioProgressKicker: "FORTSCHRITT", studioProgressTitle: "Sieh, ob es funktioniert", studioProgressText: "Protokolliere Körperdaten, erkenne Trends und behalte Rekorde im Blick.", studioExerciseProgressLink: "Übungsfortschritt", studioCoachKicker: "COACH", studioCoachTitle: "Aus Fragen werden Schritte", studioCoachText: "Frag zu deinem aktiven Plan und erhalte einen praktischen nächsten Schritt.", studioSocialKicker: "SOZIAL", studioSocialTitle: "Teile die Arbeit", studioSocialText: "Nachrichten, Pläne, Fortschritt, Sprache und Musik sicher teilen."
  },
  ar: {
    capabilityStudioTitle: "ابدأ بخطوة واضحة", date: "التاريخ", streak: "السلسلة", days: "أيام", day: "يوم", lastDate: "التاريخ", lastDuration: "المدة", lastSets: "المجموعات", lastExercises: "التمارين", weekOnTrack: "أسبوع تدريبك يسير حسب الخطة.", weekReady: "خطوتك التالية جاهزة.", studioTrainingKicker: "استوديو التدريب", studioTrainingTitle: "ابنِ جلستك التالية", studioTrainingText: "أنشئ خطة أو عدلها يدويًا أو افتح جلسة محفوظة.", studioManualWorkoutLink: "إنشاء يدوي", studioSavedWorkoutLink: "الخطط المحفوظة", studioNutritionKicker: "التغذية", studioNutritionTitle: "خطط لما يمنحك الطاقة", studioNutritionText: "حوّل هدفك وتفضيلاتك إلى وجبات يمكنك الالتزام بها.", studioManualNutritionLink: "إنشاء يدوي", studioSavedNutritionLink: "الخطط المحفوظة", studioProgressKicker: "التقدم", studioProgressTitle: "اعرف إن كان يعمل", studioProgressText: "سجل مقاييس الجسم وراجع الاتجاهات واحفظ أرقامك الشخصية.", studioExerciseProgressLink: "تقدم التمارين", studioCoachKicker: "المدرب", studioCoachTitle: "حوّل السؤال إلى فعل", studioCoachText: "اسأل عن خطتك واحصل على خطوة عملية.", studioSocialKicker: "اجتماعي", studioSocialTitle: "شارك العمل", studioSocialText: "شارك الرسائل والخطط والتقدم والصوت والموسيقى بأمان."
  },
  zh: {
    capabilityStudioTitle: "从一个清晰动作开始", date: "日期", streak: "连续", days: "天", day: "天", lastDate: "日期", lastDuration: "时长", lastSets: "组数", lastExercises: "动作", weekOnTrack: "你的训练周正在按计划进行。", weekReady: "你的下一步已经准备好。", studioTrainingKicker: "训练工作室", studioTrainingTitle: "构建下一次训练", studioTrainingText: "生成计划、手动调整，或重新打开已保存训练。", studioManualWorkoutLink: "手动创建", studioSavedWorkoutLink: "已保存计划", studioNutritionKicker: "能量", studioNutritionTitle: "规划你的饮食动力", studioNutritionText: "把目标和偏好变成真正能执行的餐食。", studioManualNutritionLink: "手动创建", studioSavedNutritionLink: "已保存计划", studioProgressKicker: "进度", studioProgressTitle: "看看是否有效", studioProgressText: "记录身体数据、查看趋势，并保存个人记录。", studioExerciseProgressLink: "动作进度", studioCoachKicker: "教练", studioCoachTitle: "把问题变成行动", studioCoachText: "询问当前计划，并获得实际下一步。", studioSocialKicker: "社交", studioSocialTitle: "分享训练过程", studioSocialText: "安全分享消息、计划、进度、语音和音乐。"
  }
};
const v4Ui = v4Copy[language] || v4Copy.en;
const navCopy = {
  en: {
    dashboard: "Dashboard",
    programs: "Workout Plans",
    workouts: "Workout Tracker",
    nutrition: "Nutrition",
    social: "Friends & Messages",
    progress: "Progress",
    settings: "Settings",
    plans: "Plans",
    history: "History"
  },
  he: {
  dashboard: "דשבורד",
  programs: "תוכניות אימון",
  workouts: "מעקב אימון",
  nutrition: "תזונה",
  social: "חברים והודעות",
  progress: "התקדמות",
  settings: "הגדרות",
  plans: "מסלולים",
  history: "היסטוריה"
  },
  es: { dashboard: "Panel", programs: "Planes de entrenamiento", workouts: "Registro de entrenamiento", nutrition: "Nutrición", social: "Amigos y mensajes", progress: "Progreso", settings: "Configuración", plans: "Planes", history: "Historial" },
  fr: { dashboard: "Tableau de bord", programs: "Programmes", workouts: "Suivi d'entraînement", nutrition: "Nutrition", social: "Amis et messages", progress: "Progrès", settings: "Paramètres", plans: "Offres", history: "Historique" },
  de: { dashboard: "Dashboard", programs: "Trainingspläne", workouts: "Trainingstracker", nutrition: "Ernährung", social: "Freunde & Nachrichten", progress: "Fortschritt", settings: "Einstellungen", plans: "Tarife", history: "Verlauf" },
  ar: { dashboard: "لوحة التحكم", programs: "خطط التدريب", workouts: "متابعة التدريب", nutrition: "التغذية", social: "الأصدقاء والرسائل", progress: "التقدم", settings: "الإعدادات", plans: "الخطط", history: "السجل" },
  zh: { dashboard: "仪表板", programs: "训练计划", workouts: "训练记录", nutrition: "营养", social: "好友与消息", progress: "进度", settings: "设置", plans: "方案", history: "历史" }
};
const navLabels = navCopy[language] || navCopy.en;
const drawerSearchTranslations = {
  en: {
    topbar: "Search dashboard",
    placeholder: "Search pages or tools...",
    open: "Open search",
    noResults: "No results found"
  },
  he: {
      topbar: "חיפוש מהיר",
      placeholder: "חפש עמוד או כלי...",
      open: "פתח חיפוש",
      noResults: "לא נמצאו תוצאות"
  },
  es: { topbar: "Buscar", placeholder: "Buscar páginas o herramientas...", open: "Abrir búsqueda", noResults: "No se encontraron resultados" },
  fr: { topbar: "Recherche", placeholder: "Rechercher des pages ou outils...", open: "Ouvrir la recherche", noResults: "Aucun résultat" },
  de: { topbar: "Suchen", placeholder: "Seiten oder Tools suchen...", open: "Suche öffnen", noResults: "Keine Ergebnisse gefunden" },
  ar: { topbar: "بحث", placeholder: "ابحث عن صفحات أو أدوات...", open: "فتح البحث", noResults: "لا توجد نتائج" },
  zh: { topbar: "搜索", placeholder: "搜索页面或工具...", open: "打开搜索", noResults: "未找到结果" }
};
const drawerSearchCopy = drawerSearchTranslations[language] || drawerSearchTranslations.en;
const searchableItems = [
  {
    id: "dashboard",
    title: "Dashboard",
    titleHe: "דשבורד",
    route: "/dashboard.html",
    keywords: ["dashboard", "home", "overview", "main", "דשבורד", "בית", "ראשי", "סקירה"]
  },
  {
    id: "coach",
    title: "Coach",
    titleHe: "המאמן שלך",
    route: "/app.html",
    keywords: ["coach", "chat", "assistant", "ask coach", "personal coach", "מאמן", "צאט", "צ'אט", "שיחה", "שאל את המאמן"]
  },
  {
    id: "workout-builder",
    title: "Workout plan builder",
    titleHe: "בניית תוכנית אימון",
    route: "/workout-builder.html",
    keywords: ["workout builder", "workout plan", "program builder", "build workout", "training plan", "תוכנית אימון", "בניית תוכנית", "מחולל אימון", "מחולל תוכנית", "אימון"]
  },
  {
    id: "workout-tracker",
    title: "Workout Tracker",
    titleHe: "מעקב אימונים",
    route: "/workout-tracker.html",
    keywords: ["workout tracker", "workout track", "workout", "track workout", "training log", "workout log", "sets", "reps", "מעקב אימון", "מעקב אימונים", "מעקב אימ", "אימונים", "יומן אימונים", "רישום אימון", "סטים", "חזרות"]
  },
  {
    id: "manual-workout-builder",
    title: "Build a plan manually",
    titleHe: "בניית תוכנית בעצמך",
    route: "/manual-workout-builder.html",
    keywords: ["manual plan", "manual workout", "custom workout", "build manually", "create own program", "תוכנית עצמית", "בניית תוכנית בעצמך", "בנייה ידנית", "תוכנית ידנית", "תוכנית משלי"]
  },
  {
    id: "workout-history",
    title: "Workout history",
    titleHe: "היסטוריית אימונים",
    route: "/workout-history.html",
    keywords: ["history", "workout history", "logs", "past workouts", "יומן", "היסטוריה", "היסטוריית אימונים", "אימונים קודמים", "אימון קודם"]
  },
  {
    id: "missed-workout",
    title: "Missed a workout? Log it here",
    titleHe: "פספסת אימון? תעד אותו כאן",
    route: "/log-workout.html",
    keywords: ["missed workout", "missed a workout", "log it here", "missed tracking", "log workout", "past workout", "פספסת אימון", "החמצת אימון", "תעד אותו", "אימון שבוצע", "הזנת אימון"]
  },
  {
    id: "nutrition-builder",
    title: "Nutrition plan builder",
    titleHe: "בניית תפריט תזונה",
    route: "/nutrition-builder.html",
    keywords: ["nutrition builder", "meal plan", "diet plan", "food plan", "nutrition", "תפריט", "תזונה", "מחולל תפריט", "בניית תפריט", "דיאטה"]
  },
  {
    id: "nutrition-plans",
    title: "My nutrition plans",
    titleHe: "תוכניות התזונה שלי",
    route: "/my-nutrition-plans.html",
    keywords: ["nutrition plans", "saved meal plans", "my nutrition", "meal plans", "תוכניות תזונה", "תפריטים שמורים", "התפריטים שלי", "תזונה שמורה"]
  },
  {
    id: "workout-plans",
    title: "My workout plans",
    titleHe: "תוכניות האימון שלי",
    route: "/my-workout-plans.html",
    keywords: ["workout plans", "saved workouts", "my programs", "programs", "תוכניות אימון", "תוכניות שמורות", "התוכניות שלי", "אימונים שמורים"]
  },
  {
    id: "progress",
    title: "Progress",
    titleHe: "התקדמות",
    route: "/progress.html",
    keywords: ["progress", "analytics", "charts", "weight", "measurements", "graphs", "התקדמות", "גרפים", "מדדים", "משקל", "מדידות", "ניתוח"]
  },
  {
    id: "social",
    title: "Friends & Messages",
    titleHe: "חברים והודעות",
    route: "/social.html",
    keywords: ["friends", "messages", "social", "chat", "share plan", "חברים", "הודעות", "שיתוף", "צאט"]
  },
  {
    id: "settings",
    title: "Settings",
    titleHe: "הגדרות",
    route: "/app.html?settings=open",
    keywords: ["settings", "profile", "athlete core", "account", "preferences", "הגדרות", "פרופיל", "אטלט קור", "חשבון", "העדפות"]
  },
  {
    id: "pricing",
    title: "Plans",
    titleHe: "מסלולים",
    route: "/pricing.html",
    keywords: ["pricing", "plans", "pro", "upgrade", "subscription", "מחיר", "מסלולים", "פרו", "שדרוג", "מנוי"]
  }
];
const repairText = value => {
  if (typeof value !== "string" || !/[׳³׳’]/.test(value)) return value;
  try {
    return decodeURIComponent(escape(value));
  }
 catch {
    return value;
  }
}
;
const ui = new Proxy(rawUi, {
  get(target, property) {
    const value = target[property];
    if (typeof value === "function") {
      return (...args) => repairText(value(...args));
    }
    return repairText(value);
  }
}
);
const esc = value => String(value ?? "").replace(/[&<>"\x27]/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#039;"
}[char]));

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function itemSearchHaystack(item) {
  return [
    item.title,
    item.titleHe,
    item.id,
    item.route,
    ...(item.keywords || [])
  ].map(normalizeSearchText);
}

function searchDashboardItems(query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];
  const queryParts = normalizedQuery.split(" ").filter(Boolean);

  return searchableItems
    .map(item => {
      const haystack = itemSearchHaystack(item);
      const exactish = haystack.some(text => text.includes(normalizedQuery));
      const allParts = queryParts.every(part => haystack.some(text => text.includes(part)));
      const startsWith = haystack.some(text => text.startsWith(normalizedQuery));
      const score = startsWith ? 3 : exactish ? 2 : allParts ? 1 : 0;
      return { item, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .map(result => result.item);
}

function debounce(callback, delay = 240) {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
}

function renderSearchResults(root, results, query) {
  const resultsBox = root.querySelector("[data-search-results]");
  if (!resultsBox) return;

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    resultsBox.hidden = true;
    resultsBox.innerHTML = "";
    return;
  }

  resultsBox.hidden = false;
  if (!results.length) {
    resultsBox.innerHTML = `<div class="dashboard-search-empty">${esc(drawerSearchCopy.noResults)}</div>`;
    return;
  }

  resultsBox.innerHTML = results.slice(0, 7).map(item => `
    <a class="dashboard-search-result" href="${esc(item.route)}" data-search-result-id="${esc(item.id)}">
      <span>${esc(he ? item.titleHe : item.title)}</span>
      ${he ? `<small>${esc(item.title)}</small>` : ''}
    </a>
  `).join("");
}

function closeSearchResults(exceptRoot = null) {
  document.querySelectorAll("[data-dashboard-search]").forEach(root => {
    if (root === exceptRoot) return;
    const resultsBox = root.querySelector("[data-search-results]");
    if (resultsBox) {
      resultsBox.hidden = true;
      resultsBox.innerHTML = "";
    }
  });
}

function initDashboardSearch() {
  const searchRoots = [...document.querySelectorAll("[data-dashboard-search]")];
  if (!searchRoots.length) return;

  searchRoots.forEach(root => {
    const input = root.querySelector("input[type='search']");
    if (!input) return;

    const runSearch = () => {
      const results = searchDashboardItems(input.value);
      renderSearchResults(root, results, input.value);
    };
    const debouncedSearch = debounce(runSearch);

    input.addEventListener("input", debouncedSearch);
    input.addEventListener("focus", runSearch);
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        input.value = "";
        closeSearchResults();
        input.blur();
      }
    });
    root.addEventListener("click", event => {
      const result = event.target.closest("[data-search-result-id]");
      if (result) {
        closeSearchResults();
      }
    });
  });

  document.addEventListener("click", event => {
    const activeRoot = event.target.closest("[data-dashboard-search]");
    if (!activeRoot) closeSearchResults();
  });
}

function localize() {
  document.documentElement.lang = language;
  document.documentElement.dir = rtl ? "rtl" : "ltr";
  const socialQuickAction = navLabels.social;
  const socialLink = $("#heroSocialLink");
  if (socialLink) {
    const label = socialLink.querySelector(".dashboard-action-label");
    if (label) label.textContent = socialQuickAction;
    socialLink.setAttribute("aria-label", socialQuickAction);
  }
  for (const [id, key] of [["todayLabel", "today"], ["welcomeText", "intro"], ["weekLabel", "week"], ["streakLabel", "streak"], ["weightLabel", "weight"], ["setsLabel", "sets"], ["weightLink", "update"], ["nextLabel", "next"], ["startWorkoutLink", "start"], ["nutritionLabel", "nutrition"], ["caloriesLabel", "calories"], ["proteinLabel", "protein"], ["nutritionLink", "manageNutrition"], ["recentLabel", "recent"], ["historyAction", "history"], ["missedLabel", "missedLabel"], ["missedTitle", "missedTitle"], ["missedText", "missedText"], ["missedAction", "missedAction"], ["progressLabel", "progress"], ["progressTitle", "momentum"], ["analyticsAction", "analytics"], ["scheduleLabel", "scheduleLabel"], ["scheduleTitle", "scheduleTitle"], ["scheduleHint", "scheduleHint"], ["shiftScheduleButton", "scheduleShift"], ["quickFoodLabel", "quickFoodLabel"], ["quickFoodTitle", "quickFoodTitle"], ["quickFoodText", "quickFoodText"], ["quickFoodEstimate", "quickFoodEstimate"], ["quickFoodClear", "quickFoodClear"], ["heroHistoryLink", "heroHistory"], ["drawerCoachLink", "drawerCoach"], ["drawerPrimaryLabel", "drawerPrimary"], ["drawerTrainingLabel", "drawerTraining"], ["drawerSupportLabel", "drawerSupport"], ["manualLabel", "manualLabel"], ["manualTitle", "manualTitle"], ["manualText", "manualText"], ["manualAction", "manualAction"], ["drawerManualBuilderLink", "manualNav"], ["toolsKicker", "toolsKicker"], ["toolsSummary", "toolsSummary"], ["toolsText", "toolsText"], ["dashboardLogoutButton", "logout"]]) {
    const node = $("#" + id);
    if (node) node.textContent = ui[key];
  }
  for (const id of ["dailyNutritionLink", "studioDailyNutritionLink"]) {
    const node = $("#" + id);
    if (node) node.textContent = ui.dailyNutrition;
  }
  const dailyNutritionSpotlightKicker = $("#dailyNutritionSpotlightKicker");
  const dailyNutritionSpotlightTitle = $("#dailyNutritionSpotlightTitle");
  const dailyNutritionSpotlightText = $("#dailyNutritionSpotlightText");
  if (dailyNutritionSpotlightKicker) dailyNutritionSpotlightKicker.textContent = ui.dailyNutrition;
  if (dailyNutritionSpotlightTitle) dailyNutritionSpotlightTitle.textContent = dailyFocusUi.nutrition;
  if (dailyNutritionSpotlightText) dailyNutritionSpotlightText.textContent = dailyFocusUi.nutritionText;
  for (const [id, key] of [["chatLink", "chat"], ["heroWorkoutBuilderLink", "buildWorkout"], ["heroNutritionBuilderLink", "buildNutrition"], ["heroProgressLink", "trackProgress"]]) {
    const label = $("#" + id + " .dashboard-action-label");
    if (label) label.textContent = ui[key];
  }
  $("#dashboardStatus").textContent = ui.loading;
  const input = $("#quickFoodInput");
  const result = $("#quickFoodResult");
  if (input) input.placeholder = ui.quickFoodPlaceholder;
  if (result) result.textContent = ui.quickFoodEmpty;
  document.querySelectorAll("[data-nav-key]").forEach(node => {
    const key = node.dataset.navKey;
    if (key && navLabels[key]) node.textContent = navLabels[key];
  });
  const menuOpenLabels = {
    en: "Open menu",
    he: "פתח תפריט",
    es: "Abrir menú",
    fr: "Ouvrir le menu",
    de: "Menü öffnen",
    ar: "فتح القائمة",
    zh: "打开菜单"
  };
  const menuCloseLabels = {
    en: "Close menu",
    he: "סגור תפריט",
    es: "Cerrar menú",
    fr: "Fermer le menu",
    de: "Menü schließen",
    ar: "إغلاق القائمة",
    zh: "关闭菜单"
  };
  const settingsOpenLabels = {
    en: "Open settings",
    he: "פתח הגדרות",
    es: "Abrir configuración",
    fr: "Ouvrir les paramètres",
    de: "Einstellungen öffnen",
    ar: "فتح الإعدادات",
    zh: "打开设置"
  };
  const menuOpenLabel = menuOpenLabels[language] || menuOpenLabels.en;
  const menuCloseLabel = menuCloseLabels[language] || menuCloseLabels.en;
  $("#mobileMenuButton")?.setAttribute("aria-label", menuOpenLabel);
  $("#sidebarClose")?.setAttribute("aria-label", menuCloseLabel);
  $("#mobileProfileButton")?.setAttribute("aria-label", settingsOpenLabels[language] || settingsOpenLabels.en);
  $("#mobileSearchButton")?.setAttribute("aria-label", drawerSearchCopy.open);
  const searchLabel = $("#mobileSearchButton .mobile-search-label");
  if (searchLabel) searchLabel.textContent = drawerSearchCopy.topbar;
  const drawerSearch = $("#drawerSearchInput");
  if (drawerSearch) drawerSearch.placeholder = drawerSearchCopy.placeholder;
  const desktopSearch = $("#desktopSearchInput");
  if (desktopSearch) desktopSearch.placeholder = drawerSearchCopy.placeholder;
  for (const [id, value] of Object.entries(v4Ui)) {
    const element = $("#" + id);
    if (element && typeof value === "string") element.textContent = value;
  }
  const contextDateLabel = $("#dashboardContextDateLabel");
  if (contextDateLabel) contextDateLabel.textContent = v4Ui.date;
  const contextStreakLabel = $("#dashboardContextStreakLabel");
  if (contextStreakLabel) contextStreakLabel.textContent = v4Ui.streak;
  const manualNutritionLink = $("#manualNutritionLink");
  if (manualNutritionLink) manualNutritionLink.textContent = v4Ui.studioManualNutritionLink;
  const date = $("#dashboardContextDate");
  const dateLocale = {
    en: "en-US",
    he: "he-IL",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
    ar: "ar",
    zh: "zh-CN"
  }[language] || "en-US";
  if (date) date.textContent = new Intl.DateTimeFormat(dateLocale, { weekday: "short", month: "short", day: "numeric" }).format(new Date());
}

const DRAWER_MAX_WIDTH = 1100;

function initMobileDrawer() {
  const body = document.body;
  const menuButton = $("#mobileMenuButton");
  const searchButton = $("#mobileSearchButton");
  const closeButton = $("#sidebarClose");
  const backdrop = $("#mobileBackdrop");
  const sidebar = $("#mobileDrawerPanel");
  const searchInput = $("#drawerSearchInput");
  if (!menuButton || !closeButton || !backdrop || !sidebar) return;

  const setOpen = open => {
    body.classList.toggle("drawer-open", open);
    menuButton.setAttribute("aria-expanded", open ? "true" : "false");
    if (open && searchInput) {
      requestAnimationFrame(() => searchInput.focus());
    }
  };

  menuButton.addEventListener("click", () => {
    setOpen(!body.classList.contains("drawer-open"));
  });
  searchButton?.addEventListener("click", () => {
    setOpen(true);
  });
  closeButton.addEventListener("click", () => setOpen(false));
  backdrop.addEventListener("click", () => setOpen(false));
  sidebar.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => setOpen(false));
  });
  // Must match the drawer's CSS breakpoint in public/css/dashboard.css.
  // Above it the sidebar is a permanent sticky column, so a drawer left
  // "open" would keep body scroll locked with no visible way to close it.
  window.addEventListener("resize", () => {
    if (window.innerWidth > DRAWER_MAX_WIDTH) setOpen(false);
  });
}

function initLogout() {
  const button = $("#dashboardLogoutButton");
  if (!button) return;

  button.addEventListener("click", async () => {
    if (!window.confirm(ui.logoutConfirm)) return;

    button.disabled = true;
    button.textContent = ui.logoutWorking;

    try {
      sessionStorage.removeItem("fuelphysique-athlete-core-prompt-dismissed");
      await disassociateCurrentInstallation();
      await signOut(auth);
      window.location.replace("/");
    } catch (error) {
      console.error("Dashboard logout failed:", error);
      button.disabled = false;
      button.textContent = ui.logout;
      window.alert(ui.logoutError);
    }
  });
}

window.addEventListener("pageshow", event => {
  if (!event.persisted) return;
  let unsubscribe = () => {};
  unsubscribe = onAuthStateChanged(auth, user => {
    unsubscribe();
    if (!user) window.location.replace("/auth.html");
  });
});

function isAthleteCoreComplete(settings) {
  const core = settings?.athleteCore || {};
  const hasNumber = value => Number.isFinite(Number(value)) && Number(value) > 0;
  return (
    hasNumber(core.age) &&
    hasNumber(core.weight) &&
    hasNumber(core.height) &&
    Boolean(String(core.experience || "").trim()) &&
    Boolean(String(core.goal || "").trim())
  );
}

function showAthleteCorePromptIfNeeded(settings) {
  if (isAthleteCoreComplete(settings)) return;
  if (sessionStorage.getItem("fuelphysique-athlete-core-prompt-dismissed") === "true") return;

  const prompt = $("#athleteCorePrompt");
  if (!prompt) return;

  const title = $("#athleteCorePromptTitle");
  const text = $("#athleteCorePromptText");
  const action = $("#athleteCorePromptAction");
  const later = $("#athleteCorePromptLater");

  if (he) {
    if (title) title.textContent = "השלימו את פרופיל Athlete Core";
    if (text) {
      text.textContent = "כמה פרטים בסיסיים יעזרו ל־FuelPhysique לבנות אימונים, תזונה ותשובות מאמן שמתאימים אליך באמת.";
    }
    if (action) action.textContent = "השלמת הפרופיל";
    if (later) later.textContent = "מאוחר יותר";
  }

  prompt.classList.remove("hidden");
  later?.addEventListener("click", () => {
    sessionStorage.setItem("fuelphysique-athlete-core-prompt-dismissed", "true");
    prompt.classList.add("hidden");
  }, { once: true });
}

function timestampDate(value) {
  return value?.toDate?.() || (value instanceof Date ? value : null);
}
function startOfWeek() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  return start;
}
function calculateStreak(logs) {
  const days = [...new Set(logs.map(log => timestampDate(log.completedAt) || timestampDate(log.startedAt)).filter(Boolean).map(date => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
  }
))].sort((a, b) => b - a);
  if (!days.length) return 0;
  const oneDay = 86400000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today.getTime() - days[0] > oneDay) return 0;
  let streak = 1;
  for (let index = 1;
 index < days.length;
 index += 1) {
    const difference = Math.round((days[index - 1] - days[index]) / oneDay);
    if (difference === 1) streak += 1;
    else if (difference > 1) break;
  }
  return streak;
}
function dateText(value) {
  const date = timestampDate(value);
  return date ? new Intl.DateTimeFormat(he ? "he-IL" : "en-US", {
 dateStyle: "medium" }
).format(date) : "";
}
function renderWorkout(planDoc, logs) {
  const action = $("#startWorkoutLink");
  if (!planDoc) {
    $("#nextWorkoutName").textContent = ui.noneWorkout;
    $("#workoutPlanName").textContent = "";
    $("#exercisePreview").innerHTML = "";
    action.href = "/workout-builder.html";
    action.textContent = he ? "יצירת תוכנית אימון" : "Create workout plan";
    return;
  }
  action.href = "/workout-tracker.html";
  action.textContent = ui.start;
  const plan = planDoc.plan || {
}
;
  const sessions = Array.isArray(plan.sessions) ? plan.sessions : [];
  const latest = logs.find(log => log.workoutPlanId === planDoc.id);
  const index = sessions.length ? (latest ? ((Number(latest.sessionIndex) || 0) + 1) % sessions.length : 0) : 0;
  const session = sessions[index] || {
}
;
  $("#nextWorkoutName").textContent = session.name || plan.programName || planDoc.name || "Workout";
  $("#workoutPlanName").textContent = planDoc.name || plan.programName || "";
  const exercises = Array.isArray(session.exercises) ? session.exercises : [];
  $("#exercisePreview").innerHTML = exercises.slice(0, 5).map(item => `<span>${esc(item.name || "Exercise")}</span>`).join("") + (exercises.length > 5 ? `<span>+ ${ui.exerciseMore(exercises.length - 5)}</span>` : "");
}
function renderNutrition(saved) {
  const action = $("#nutritionLink");
  if (!saved) {
    activeNutritionPlanForQuickFood = null;
    $("#nutritionPlanName").textContent = ui.noneNutrition;
    $("#caloriesValue").textContent = "—";
    $("#proteinValue").textContent = "—";
    action.href = "/nutrition-builder.html";
    action.textContent = he ? "יצירת תוכנית תזונה" : "Create nutrition plan";
    return;
  }
  action.href = "/my-nutrition-plans.html";
  action.textContent = ui.manageNutrition;
  const plan = saved.plan || {
}
function renderDailyFocus({ workout, nutrition, logs, weekly, streak }) {
  const title = $("#dailyFocusTitle");
  const text = $("#dailyFocusText");
  const action = $("#dailyFocusAction");
  const kicker = $("#dailyFocusKicker");
  const workoutStatus = $("#dailyFocusWorkoutStatus");
  const streakStatus = $("#dailyFocusStreakStatus");
  if (!title || !text || !action) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedToday = logs.some(log => {
    const date = timestampDate(log.completedAt) || timestampDate(log.startedAt);
    if (!date) return false;
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized.getTime() === today.getTime();
  });
  const state = !workout ? "setup" : completedToday && nutrition ? "progress" : completedToday ? "nutrition" : "workout";
  const content = { workout: [dailyFocusUi.workout, dailyFocusUi.workoutText, "/workout-tracker.html"], nutrition: [dailyFocusUi.nutrition, dailyFocusUi.nutritionText, "/daily-nutrition.html"], progress: [dailyFocusUi.progress, dailyFocusUi.progressText, "/progress.html"], setup: [dailyFocusUi.setup, dailyFocusUi.setupText, "/workout-builder.html"] }[state];
  if (kicker) kicker.textContent = dailyFocusUi.kicker;
  title.textContent = content[0];
  text.textContent = content[1];
  action.href = content[2];
  action.textContent = dailyFocusUi.start;
  if (workoutStatus) workoutStatus.textContent = dailyFocusUi.workouts(weekly);
  if (streakStatus) streakStatus.textContent = dailyFocusUi.streak(streak);
}
;
  activeNutritionPlanForQuickFood = {
    name: saved.name || plan.planName || "Nutrition Plan",    dailyCalories: Number(plan.dailyCalories) || null,    proteinGrams: Number(plan.proteinGrams) || null,    carbsGrams: Number(plan.carbsGrams) || null,    fatGrams: Number(plan.fatGrams) || null  }
;
  $("#nutritionPlanName").textContent = saved.name || plan.planName || "Nutrition Plan";
  $("#caloriesValue").textContent = plan.dailyCalories ? Number(plan.dailyCalories).toLocaleString() : "—";
  $("#proteinValue").textContent = plan.proteinGrams ? `${plan.proteinGrams}g` : "—";
}
function renderRecent(log) {
  const details = $("#lastWorkoutDetails");
  if (!log) {
    $("#lastWorkoutName").textContent = ui.noWorkouts;
    details.innerHTML = "";
    return;
  }
  $("#lastWorkoutName").textContent = log.workoutName || log.planName || "Workout";
  const duration = Number(log.durationMinutes) || 0;
  const sets = Number(log.completedSets) || 0;
  const exerciseCount = Array.isArray(log.exerciseLogs) ? log.exerciseLogs.length : 0;
  details.innerHTML = [
    [v4Ui.lastDate, dateText(log.completedAt)],
    [v4Ui.lastDuration, duration ? `${duration} ${ui.minutes}` : "—"],
    [v4Ui.lastSets, sets || "—"],
    [v4Ui.lastExercises, exerciseCount || "—"]
  ].map(([label, val]) => `<div><span>${label}</span><strong>${val}</strong></div>`).join("");
}
const FOOD_RULES = [  {
 match: /(oats?|שיבולת שועל)/i, cal: 150, p: 5, c: 27, f: 3, unit: "serving" }
,  {
 match: /(milk|חלב)/i, cal: 50, p: 2.7, c: 4.0, f: 2.7, unit: "100ml" }
,  {
 match: /(egg|eggs|ביצה|ביצים)/i, cal: 72, p: 6, c: 0.4, f: 5, unit: "1" }
,  {
 match: /(chicken breast|chicken|חזה עוף|עוף)/i, cal: 165, p: 31, c: 0, f: 4, unit: "100g" }
,  {
 match: /(rice|אורז)/i, cal: 130, p: 2.5, c: 28, f: 0.3, unit: "100g cooked" }
,  {
 match: /(apple|תפוח)/i, cal: 95, p: 0.5, c: 25, f: 0.3, unit: "1 medium" }
,  {
 match: /(banana|בננה)/i, cal: 105, p: 1.3, c: 27, f: 0.4, unit: "1 medium" }
,  {
 match: /(salad|סלט|vegetable|ירקות)/i, cal: 35, p: 1.5, c: 7, f: 0.5, unit: "serving" }
,  {
 match: /(beer|בירה)/i, cal: 150, p: 1.5, c: 13, f: 0, unit: "330ml" }
,  {
 match: /(coffee|קפה)/i, cal: 20, p: 0.5, c: 3, f: 0.5, unit: "cup" }
,  {
 match: /(water|מים)/i, cal: 0, p: 0, c: 0, f: 0, unit: "glass" }
,  {
 match: /(cheese|גבינה)/i, cal: 110, p: 7, c: 1, f: 9, unit: "30g" }
,  {
 match: /(yogurt|יוגורט)/i, cal: 100, p: 9, c: 10, f: 3, unit: "cup" }
,  {
 match: /(protein powder|אבקת חלבון|whey)/i, cal: 120, p: 24, c: 3, f: 2, unit: "scoop" }
,  {
 match: /(peanut butter|חמאת בוטנים)/i, cal: 190, p: 8, c: 7, f: 16, unit: "2 tbsp" }
];
const NUMBER_WORDS = new Map([  ["zero", 0], ["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5], ["six", 6],  ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10], ["eleven", 11], ["twelve", 12]]);
function parseQuantity(raw) {
  const match = raw.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gram|grams|ml|milliliter|milliliters|cup|cups|tbsp|tablespoon|tablespoons|scoop|scoops|piece|pieces|slice|slices|egg|eggs|serving|servings)?/i);
  if (!match) return null;
  const n = Number(match[1].replace(",", "."));
  const unit = (match[2] || "").toLowerCase();
  if (!Number.isFinite(n)) return null;
  return {
 n, unit }
;
}
function estimateFood(text) {
  const items = text.split(/\n|,|\u2022|\|/).map(part => part.trim()).filter(Boolean);
  if (!items.length) return null;
  const total = {
 cal: 0, p: 0, c: 0, f: 0, count: 0 }
;
  for (const item of items) {
    const lower = item.toLowerCase();
    const rule = FOOD_RULES.find(entry => entry.match.test(item));
    if (!rule) continue;
    let factor = 1;
    const qty = parseQuantity(item);
    if (qty) {
      const {
 n, unit }
 = qty;
      if (rule.unit === "100g" && unit === "kg") factor = n * 10;
      else if (rule.unit === "100g" && ["g", "gram", "grams"].includes(unit)) factor = n / 100;
      else if (rule.unit === "100ml" && unit === "ml") factor = n / 100;
      else if (rule.unit === "100ml" && ["cup", "cups"].includes(unit)) factor = (n * 240) / 100;
      else if (rule.unit === "330ml" && unit === "ml") factor = n / 330;
      else if (rule.unit === "30g" && unit === "g") factor = n / 30;
      else if (rule.unit === "2 tbsp" && ["tbsp", "tablespoon", "tablespoons"].includes(unit)) factor = n / 2;
      else if (rule.unit === "1" && ["piece", "pieces", "slice", "slices", "egg", "eggs", "serving", "servings"].includes(unit)) factor = n;
      else if (rule.unit === "cup" && ["cup", "cups"].includes(unit)) factor = n;
      else if (rule.unit === "scoop" && ["scoop", "scoops"].includes(unit)) factor = n;
      else if (rule.unit === "serving") factor = n;
      else factor = n;
    }
 else if (/pizza/.test(lower) && /family size|large|xl/.test(lower)) {
      factor = /three|3/.test(lower) ? 3 : 1;
      total.cal += 1800 * factor;
      total.p += 72 * factor;
      total.c += 216 * factor;
      total.f += 72 * factor;
      total.count += 1;
      continue;
    }
 else if (/pizza/.test(lower)) {
      const wordCount = [...NUMBER_WORDS.entries()].find(([word]) => new RegExp(`\\b${word}\\b`).test(lower));
      factor = wordCount ? wordCount[1] : (/(\d+)/.test(lower) ? Number(lower.match(/(\d+)/)[1]) : 1);
      total.cal += 900 * factor;
      total.p += 36 * factor;
      total.c += 108 * factor;
      total.f += 36 * factor;
      total.count += 1;
      continue;
    }
 else {
      const wordCount = [...NUMBER_WORDS.entries()].find(([word]) => new RegExp(`\\b${word}\\b`).test(lower));
      if (wordCount && /egg|ביצה|ביצים/.test(lower)) factor = wordCount[1];
    }
    total.cal += rule.cal * factor;
    total.p += rule.p * factor;
    total.c += rule.c * factor;
    total.f += rule.f * factor;
    total.count += 1;
  }
  if (!total.count) return null;
  return total;
}
function recommendation(calories) {
  if (calories < 900) return ui.quickFoodLow;
  if (calories < 1700) return ui.quickFoodMid;
  return ui.quickFoodHigh;
}
function quickFoodComparison(totals) {
  const plan = activeNutritionPlanForQuickFood;
  const calories = Math.round(Number(totals.calories) || 0);
  const protein = Math.round(Number(totals.proteinGrams) || 0);
  const carbs = Math.round(Number(totals.carbsGrams) || 0);
  const fat = Math.round(Number(totals.fatGrams) || 0);
  const macroLine = `${protein}g ${he ? "\u05d7\u05dc\u05d1\u05d5\u05df" : "protein"} · ${carbs}g ${he ? "\u05e4\u05d7\u05de\u05d9\u05de\u05d5\u05ea" : "carbs"} · ${fat}g ${he ? "\u05e9\u05d5\u05de\u05df" : "fat"}`;
  if (!plan?.dailyCalories) {
    return he      ? `\u05d0\u05d9\u05df \u05ea\u05e4\u05e8\u05d9\u05d8 \u05de\u05d5\u05d2\u05d3\u05e8 \u05dc\u05db\u05df \u05d0\u05e0\u05d9 \u05dc\u05d0 \u05d9\u05d5\u05d3\u05e2 \u05d0\u05dd \u05d7\u05e8\u05d2\u05ea \u05d0\u05d5 \u05dc\u05d0, \u05d0\u05d1\u05dc \u05d6\u05d4 \u05d4\u05de\u05e6\u05d1 \u05e9\u05dc\u05da: ${calories} \u05e7\u05dc\u05d5\u05e8\u05d9\u05d5\u05ea, ${macroLine}.`      : `No active nutrition plan is set, so I cannot tell whether you went over or not. Your estimated intake is: ${calories} calories, ${macroLine}.`;
  }
  const target = Number(plan.dailyCalories);
  const delta = calories - target;
  const absDelta = Math.abs(Math.round(delta));
  if (delta > 250) {
    return he      ? `\u05d1\u05d9\u05d7\u05e1 \u05dc\u05ea\u05e4\u05e8\u05d9\u05d8 \u05d4\u05e4\u05e2\u05d9\u05dc \u05e9\u05dc\u05da (${Math.round(target)} \u05e7\u05dc\u05d5\u05e8\u05d9\u05d5\u05ea), \u05d6\u05d4 \u05d1\u05e2\u05e8\u05da ${absDelta} \u05e7\u05dc\u05d5\u05e8\u05d9\u05d5\u05ea \u05de\u05e2\u05dc \u05d4\u05d9\u05e2\u05d3. \u05de\u05d5\u05de\u05dc\u05e5 \u05dc\u05e2\u05e9\u05d5\u05ea \u05d4\u05dc\u05d9\u05db\u05d4 \u05e7\u05dc\u05d4 \u05d0\u05dd \u05d6\u05d4 \u05de\u05ea\u05d0\u05d9\u05dd \u05dc\u05da, \u05d5\u05d1\u05e2\u05d9\u05e7\u05e8 \u05dc\u05d7\u05d6\u05d5\u05e8 \u05dc\u05e9\u05d2\u05e8\u05d4 \u05d1\u05d0\u05e8\u05d5\u05d7\u05d4 \u05d4\u05d1\u05d0\u05d4.`      : `Compared with your active plan (${Math.round(target)} calories), this is about ${absDelta} calories over target. A light walk can help if it fits your day, and the main move is getting back to the routine at the next meal.`;
  }
  if (delta < -250) {
    return he      ? `\u05d1\u05d9\u05d7\u05e1 \u05dc\u05ea\u05e4\u05e8\u05d9\u05d8 \u05d4\u05e4\u05e2\u05d9\u05dc \u05e9\u05dc\u05da, \u05d0\u05ea\u05d4 \u05d1\u05e2\u05e8\u05da ${absDelta} \u05e7\u05dc\u05d5\u05e8\u05d9\u05d5\u05ea \u05de\u05ea\u05d7\u05ea \u05dc\u05d9\u05e2\u05d3. \u05d0\u05dd \u05d4\u05d9\u05d5\u05dd \u05e2\u05d5\u05d3 \u05dc\u05d0 \u05e0\u05d2\u05de\u05e8, \u05db\u05d3\u05d0\u05d9 \u05dc\u05d4\u05e9\u05dc\u05d9\u05dd \u05d0\u05e8\u05d5\u05d7\u05d4 \u05de\u05d0\u05d5\u05d6\u05e0\u05ea \u05d1\u05de\u05e7\u05d5\u05dd \u05dc\u05e4\u05e6\u05d5\u05ea \u05d1\u05e6\u05d5\u05e8\u05d4 \u05e7\u05d9\u05e6\u05d5\u05e0\u05d9\u05ea.`      : `Compared with your active plan, you are about ${absDelta} calories under target. If the day is not over, complete it with a balanced meal instead of overcorrecting.`;
  }
  return he    ? "ביחס לתפריט הפעיל שלך, זה די קרוב ליעד. אין פה דרמה גדולה."    : "Compared with your active plan, this is fairly close to target. No major drama here.";
}
function renderWeeklyActivity(logs) {
  const chart = $("#weeklyActivityChart");
  if (!chart) return;
  const days = Array.from({
 length: 7 }
, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return date;
  }
);
  const counts = days.map(day => {
    const dayTime = day.getTime();
    const nextDayTime = dayTime + 86400000;
    return logs.filter(log => {
      const date = timestampDate(log.completedAt) || timestampDate(log.startedAt);
      if (!date) return false;
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      const time = normalized.getTime();
      return time >= dayTime && time < nextDayTime;
    }
).length;
  }
);
  const max = Math.max(1, ...counts);
  const dayLabel = new Intl.DateTimeFormat(he ? "he-IL" : "en-US", {
 weekday: "short" }
);
  chart.innerHTML = days.map((day, index) => {
    const value = counts[index];
    const height = Math.max(8, Math.round((value / max) * 100));
    return `      <div class="activity-bar">        <div class="activity-track">          <div class="activity-fill" style="height:${height}%"></div>        </div>        <div class="activity-value">${value}</div>        <div class="activity-label">${dayLabel.format(day)}</div>      </div>    `;
  }
).join("");
}
function getWeeklyScheduleDays(plan, sessionCount) {
  const source =    (Array.isArray(plan?.weeklyScheduleDays) && plan.weeklyScheduleDays) ||    (Array.isArray(plan?.trainingDaysOfWeek) && plan.trainingDaysOfWeek) ||    (Array.isArray(plan?.scheduleDays) && plan.scheduleDays) ||    [];
  if (source.length === sessionCount && source.every(day => Number.isFinite(Number(day)))) {
    return source.map(normalizeDayIndex);
  }
  return createWeeklyScheduleDays(sessionCount, Number(plan?.scheduleAnchorDay) || 0);
}
async function updateWeeklySchedule(planDoc, nextDays) {
  if (!planDoc?.id || !auth.currentUser) return;
  await updateDoc(doc(db, "users", auth.currentUser.uid, "workoutPlans", planDoc.id), {
    "plan.weeklyScheduleDays": nextDays,    "plan.scheduleAnchorDay": nextDays[0] ?? 0,    updatedAt: serverTimestamp()  }
);
}
function renderWeeklySchedule(planDoc) {
  const board = $("#weeklyScheduleBoard");
  const hint = $("#scheduleHint");
  const shiftButton = $("#shiftScheduleButton");
  const label = $("#scheduleLabel");
  const title = $("#scheduleTitle");
  if (!board) return;
  if (label) label.textContent = ui.scheduleLabel;
  if (title) title.textContent = ui.scheduleTitle;
  if (hint) hint.textContent = ui.scheduleHint;
  if (shiftButton) shiftButton.textContent = ui.scheduleShift;
  if (!planDoc) {
    board.innerHTML = `<div class="schedule-empty">${he ? "כדי להציג את לוח האימונים השבועי צריך ליצור או לבחור תוכנית פעילה." : "Create or activate a workout plan to populate the weekly schedule."}</div>`;
    if (shiftButton) shiftButton.disabled = true;
    if (shiftButton) shiftButton.onclick = null;
    return;
  }
  const plan = planDoc.plan || {
}
;
  const sessions = Array.isArray(plan.sessions) ? plan.sessions : [];
  const sessionCount = sessions.length;
  const scheduleDays = getWeeklyScheduleDays(plan, sessionCount);
  const labels = getWeekdayLabels(he);
  const today = new Date().getDay();
  if (shiftButton) {
    shiftButton.disabled = !sessionCount;
    shiftButton.onclick = async () => {
      if (!sessionCount) return;
      const nextDays = shiftWeeklyScheduleDays(scheduleDays, 1);
      try {
        await updateWeeklySchedule(planDoc, nextDays);
        planDoc.plan = {
          ...planDoc.plan,          weeklyScheduleDays: nextDays,          scheduleAnchorDay: nextDays[0] ?? 0        }
;
        renderWeeklySchedule(planDoc);
      }
 catch (error) {
        console.error("Could not shift the weekly schedule.", error);
        if (hint) {
          hint.textContent = he            ? "לא ניתן היה להזיז את השבוע. נסה שוב."            : "Could not shift the weekly schedule. Please try again.";
        }
      }
    }
;
  }
  const sessionByDay = new Map();
  scheduleDays.forEach((dayIndex, sessionIndex) => {
    sessionByDay.set(normalizeDayIndex(dayIndex), {
 sessionIndex, session: sessions[sessionIndex] }
);
  }
);
  board.innerHTML = labels.map((dayLabel, dayIndex) => {
    const entry = sessionByDay.get(dayIndex);
    const isToday = dayIndex === today;
    return `      <section class="schedule-day${isToday ? " is-today" : ""}" data-day-index="${dayIndex}">        <div class="schedule-day-label">          <span>${esc(dayLabel)}</span>          <span class="schedule-day-number">${dayIndex + 1}</span>        </div>        <div class="schedule-slot">          ${            entry              ? `<button type="button" class="schedule-workout" draggable="true" data-session-index="${entry.sessionIndex}" data-source-day="${dayIndex}">                  <span class="schedule-workout-name">${
esc(entry.session?.name || entry.session?.title || `Session ${entry.sessionIndex + 1}`)}
</span>                  <span class="schedule-workout-meta">${
esc(entry.session?.exercises?.length || 0)}
 ${
he ? "תרגילים" : "exercises"}
</span>                </button>`              : `<div class="schedule-rest">${
he ? "יום מנוחה" : "Rest day"}
</div>`          }        </div>      </section>    `;
  }
).join("");
  board.querySelectorAll(".schedule-workout").forEach(button => {
    button.addEventListener("dragstart", event => {
      const sessionIndex = Number(button.dataset.sessionIndex);
      const sourceDay = Number(button.dataset.sourceDay);
      button.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify({
 sessionIndex, sourceDay }
));
    }
);
    button.addEventListener("dragend", () => {
      button.classList.remove("is-dragging");
      board.querySelectorAll(".schedule-day").forEach(day => day.classList.remove("is-drop-target"));
    }
);
  }
);
  board.querySelectorAll(".schedule-day").forEach(day => {
    day.addEventListener("dragover", event => {
      event.preventDefault();
      day.classList.add("is-drop-target");
    }
);
    day.addEventListener("dragleave", () => day.classList.remove("is-drop-target"));
    day.addEventListener("drop", async event => {
      event.preventDefault();
      day.classList.remove("is-drop-target");
      let payload;
      try {
        payload = JSON.parse(event.dataTransfer.getData("text/plain"));
      }
 catch {
        return;
      }
      const sourceDay = normalizeDayIndex(payload?.sourceDay);
      const targetDay = normalizeDayIndex(day.dataset.dayIndex);
      const delta = ((targetDay - sourceDay) % 7 + 7) % 7;
      if (!delta && sourceDay === targetDay) return;
      const nextDays = shiftWeeklyScheduleDays(scheduleDays, delta);
      try {
        await updateWeeklySchedule(planDoc, nextDays);
        planDoc.plan = {
          ...planDoc.plan,          weeklyScheduleDays: nextDays,          scheduleAnchorDay: nextDays[0] ?? 0        }
;
        renderWeeklySchedule(planDoc);
      }
 catch (error) {
        console.error("Could not update the weekly schedule.", error);
        if (hint) {
          hint.textContent = he            ? "לא ניתן היה לעדכן את השבוע. נסה שוב."            : "Could not update the weekly schedule. Please try again.";
        }
      }
    }
);
  }
);
}
function initQuickFood() {
  const input = $("#quickFoodInput");
  const estimate = $("#quickFoodEstimate");
  const clear = $("#quickFoodClear");
  const result = $("#quickFoodResult");
  if (!input || !estimate || !clear || !result) return;
  const update = async () => {
    const value = input.value.trim();
    if (!value) {
      result.textContent = ui.quickFoodEmpty;
      result.classList.add("muted");
      return;
    }
    estimate.disabled = true;
    estimate.textContent = he ? "\u05de\u05d7\u05e9\u05d1..." : "Estimating...";
    result.textContent = he ? "\u05de\u05e2\u05e8\u05d9\u05da \u05e7\u05dc\u05d5\u05e8\u05d9\u05d5\u05ea \u05d5\u05de\u05d0\u05e7\u05e8\u05d5..." : "Estimating calories and macros...";
    result.classList.add("muted");
    try {
      const token = await getIdToken(auth.currentUser);
      const response = await fetch("/api/quick-food-estimate", {
        method: "POST",        headers: {
          "Content-Type": "application/json",          Authorization: `Bearer ${token}`        }
,        body: JSON.stringify({
          text: value,          language: he ? "he" : "en",          activeNutritionPlan: activeNutritionPlanForQuickFood        }
)      }
);
      const data = await response.json().catch(() => ({
}
));
      if (!response.ok) throw new Error(data.error || "Could not estimate food.");
      const totals = data.totals || {
}
;
      result.classList.remove("muted");
      result.innerHTML = `<strong>${Math.round(totals.calories || 0)} ${he ? "\u05e7\u05dc\u05d5\u05e8\u05d9\u05d5\u05ea" : "calories"}</strong><span>${Math.round(totals.proteinGrams || 0)}g ${he ? "\u05d7\u05dc\u05d1\u05d5\u05df" : "protein"} · ${Math.round(totals.carbsGrams || 0)}g ${he ? "\u05e4\u05d7\u05de\u05d9\u05de\u05d5\u05ea" : "carbs"} · ${Math.round(totals.fatGrams || 0)}g ${he ? "\u05e9\u05d5\u05de\u05df" : "fat"}</span><p>${quickFoodComparison(totals)}</p>`;
      return;
    }
 catch (error) {
      console.warn("Quick food estimate failed; using local fallback.", error.message);
    }
 finally {
      estimate.disabled = false;
      estimate.textContent = ui.quickFoodEstimate;
    }
    const totals = estimateFood(value);
    if (!totals) {
      result.textContent = he ? "לא הצלחתי לזהות כאן מאכלים מוכרים. נסה לכתוב קצת יותר פשוט או להפריד בפסיקים." : "I could not recognize common foods here. Try simpler items or separate them with commas.";
      result.classList.add("muted");
      return;
    }
    result.classList.remove("muted");
    result.innerHTML = `<strong>${Math.round(totals.cal)} ${he ? "קלוריות" : "calories"}</strong><span>${Math.round(totals.p)}g ${he ? "חלבון" : "protein"} · ${Math.round(totals.c)}g ${he ? "פחמימות" : "carbs"} · ${Math.round(totals.f)}g ${he ? "שומן" : "fat"}</span><p>${recommendation(totals.cal)}</p>`;
  }
;
  estimate.addEventListener("click", update);
  clear.addEventListener("click", () => {
    input.value = "";
    result.textContent = ui.quickFoodEmpty;
    result.classList.add("muted");
    input.focus();
  }
);
  input.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      update();
    }
  }
);
}
async function load(user) {
  const [userSnap, settingsSnap, logsSnap, weightSnap] = await Promise.all([    getDoc(doc(db, "users", user.uid)),    getDoc(doc(db, "users", user.uid, "settings", "main")),    getDocs(query(collection(db, "users", user.uid, "workoutLogs"), orderBy("completedAt", "desc"), limit(30))),    getDocs(query(collection(db, "users", user.uid, "weightEntries"), orderBy("date", "desc"), limit(1)))  ]);
  const root = userSnap.exists() ? userSnap.data() : {
}
;
  const settings = settingsSnap.exists() ? settingsSnap.data() : {
}
;
  const logs = logsSnap.docs.map(item => ({
 id: item.id, ...item.data() }
));
  const activeWorkoutId = root.activeWorkoutPlanId;
  const activeNutritionId = root.activeNutritionPlanId;
  const subscription = normalizeSubscription(root.subscription);
  $("#dashboardPlanBadge").textContent = subscription.plan.name;
  const [workoutSnap, nutritionSnap] = await Promise.all([    activeWorkoutId ? getDoc(doc(db, "users", user.uid, "workoutPlans", activeWorkoutId)) : null,    activeNutritionId ? getDoc(doc(db, "users", user.uid, "nutritionPlans", activeNutritionId)) : null  ]);
  const workout = workoutSnap?.exists() ? {
 id: workoutSnap.id, ...workoutSnap.data() }
 : null;
  const nutrition = nutritionSnap?.exists() ? {
 id: nutritionSnap.id, ...nutritionSnap.data() }
 : null;
  const name = (settings.displayName || user.displayName || "").trim().split(/\s+/)[0];
  $("#welcomeTitle").textContent = ui.welcome(name);
  const weekStart = startOfWeek();
  const weekly = logs.filter(log => {
    const date = timestampDate(log.completedAt) || timestampDate(log.startedAt);
    return date && date >= weekStart;
  }
).length;
  const target = Number(settings.athleteCore?.trainingDays) || 0;
  const streak = calculateStreak(logs);
  const sets = logs.reduce((sum, log) => sum + (Number(log.completedSets) || 0), 0);
  const weight = weightSnap.docs[0]?.data()?.weight;
  $("#weeklyWorkouts").textContent = weekly;
  $("#weekGoal").textContent = ui.goal(weekly, target);
  $("#currentStreak").textContent = String(streak);
  $("#dashboardContextStreak").textContent = String(streak);
  $("#dashboardContextStreakUnit").textContent = streak === 1 ? v4Ui.day : v4Ui.days;
  $("#welcomeText").textContent = target > 0 && weekly >= target ? v4Ui.weekOnTrack : v4Ui.weekReady;
  $("#streakHint").textContent = ui.streakHint(streak);
  $("#completedSets").textContent = sets;
  $("#setsHint").textContent = ui.setsHint;
  $("#latestWeight").textContent = Number.isFinite(Number(weight)) ? `${Number(weight).toFixed(1)} kg` : "—";
  const progressMessage = $("#progressMessage");
  if (progressMessage) progressMessage.textContent = ui.progressMessage(logs.length);
  renderWeeklyActivity(logs);
  renderWorkout(workout, logs);
  renderWeeklySchedule(workout);
  renderNutrition(nutrition);
  renderRecent(logs[0]);
  renderDailyFocus({ workout, nutrition, logs, weekly, streak });
  $("#dashboardStatus").textContent = "";
  $("#dashboardContent").classList.remove("hidden");
  showAthleteCorePromptIfNeeded(settings);
}
localize();
initMobileDrawer();
initDashboardSearch();
initQuickFood();
initLogout();
trackPageView({
 page: "dashboard" }
);
async function loadSocialUnread(user) {
  try {
    const response = await fetch("/api/social/conversations", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    if (!response.ok) return;
    const data = await response.json();
    const unread = (data.conversations || []).reduce((sum, item) => sum + Number(item.unreadCount || 0), 0);
    const badge = $("#socialUnreadBadge");
    if (!badge) return;
    badge.hidden = unread === 0;
    badge.textContent = String(Math.min(99, unread));
  } catch {
    // Social setup is isolated from the rest of the dashboard.
  }
}
// Product policy: the dashboard exposes saved plans and progress, so it's
// blocked until the signed-in user's email is verified. guardProtectedPage
// resolves auth state -> verifies sign-in -> verifies the email policy ->
// only then calls onAuthenticated to load private data (see
// verification-gate.js for the shared implementation, including the "I've
// verified my email" recovery flow that restores this exact page in place).
guardProtectedPage({
  onAuthenticated: async (user) => {
    try {
      await Promise.all([load(user), loadSocialUnread(user)]);
    } catch (error) {
      console.error(error);
      $("#dashboardStatus").textContent = ui.error;
      $("#dashboardStatus").classList.add("error");
    }
  }
});
