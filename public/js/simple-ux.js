/* Small, synchronous UI layer: no network dependency, no auth bypass. */
(() => {
  'use strict';
  const keys = ['title','intro','choose','workout','workoutText','nutrition','nutritionText','diary','diaryText','open','more','advanced','basics','routine','safety','simpleFood','daysHint','gym','home','custom','gymText','homeText','example','next','back','createWorkout','createNutrition'];
  const translations = {
    en: ['Your fitness. Made simple.','Create a workout plan, get a simple meal plan, or log what you ate. Choose one tool to start.','What would you like to do?','Create a workout plan','A plan for your goal, experience and available equipment.','Create a meal plan','Familiar foods, short preparation and portions for your goal.','Log today’s food','Write what you ate. See your totals. Your entries save automatically.','Open food diary','More tools','Optional preferences','Your goal & profile','Your routine','Safety & finish','Quick, familiar meals are selected by default. You can change this below.','Choose your available training days.','Gym equipment','Bodyweight','Choose my equipment','Machines, dumbbells, barbell and cables. Choose this only if all are available.','No weights or apparatus. For bars or rings, choose your equipment.','Example only — your plan is personalized.','Continue','Back','Create my workout plan','Create my meal plan'],
    he: ['הכושר שלך. פשוט יותר.','צרו תוכנית אימון, קבלו תפריט פשוט או רשמו מה אכלתם. בחרו כלי אחד כדי להתחיל.','מה תרצו לעשות?','יצירת תוכנית אימון','תוכנית לפי המטרה, הניסיון והציוד שיש לכם.','יצירת תפריט','מאכלים מוכרים, הכנה קצרה וכמויות שמתאימות למטרה שלכם.','יומן תזונה','כתבו מה אכלתם, ראו את הסיכום. הרישומים נשמרים אוטומטית.','פתיחת יומן התזונה','כלים נוספים','העדפות נוספות — לא חובה','המטרה והפרטים שלכם','השגרה שלכם','בטיחות ויצירה','ברירת המחדל היא ארוחות מהירות עם מאכלים מוכרים. אפשר לשנות למטה.','אנחנו מציעים ימי אימון. אפשר לשנות אותם בהעדפות הנוספות.','ציוד חדר כושר','משקל גוף','בחירת הציוד שלי','מכונות, דאמבלים, מוט וכבלים. בחרו רק אם כל הציוד זמין לכם.','ללא משקולות או מתקנים. למתח או טבעות, בחרו את הציוד שלכם.','דוגמה בלבד — התוכנית שלכם מותאמת אישית.','המשך','חזרה','יצירת תוכנית האימון שלי','יצירת התפריט שלי'],
    ar: ['لياقتك. ببساطة.','أنشئ خطة تمارين أو خطة وجبات بسيطة أو سجّل ما أكلت. اختر أداة للبدء.','ماذا تريد أن تفعل؟','إنشاء خطة تمارين','خطة لهدفك وخبرتك والمعدات المتاحة لك.','إنشاء خطة وجبات','أطعمة مألوفة وتحضير سريع وحصص تناسب هدفك.','سجل الطعام','اكتب ما أكلت وشاهد المجموع. تُحفظ الإدخالات تلقائيًا.','فتح سجل الطعام','أدوات إضافية','تفضيلات اختيارية','هدفك وبياناتك','روتينك','السلامة والإنشاء','وجبات سريعة ومألوفة افتراضيًا. يمكنك تغيير ذلك أدناه.','نقترح أيام التدريب. يمكنك تغييرها في التفضيلات الاختيارية.','معدات النادي','وزن الجسم','اختيار معداتي','أجهزة ودمبل وبار وكابلات. اختر فقط إذا كانت كلها متاحة.','بدون أوزان أو أجهزة. للعقلة أو الحلقات، اختر معداتك.','مثال فقط — خطتك مخصصة لك.','متابعة','رجوع','إنشاء خطة تماريني','إنشاء خطة وجباتي'],
    es: ['Tu fitness. Más sencillo.','Crea un plan de entrenamiento, consigue comidas sencillas o registra lo que comiste. Elige una herramienta.','¿Qué quieres hacer?','Crear un plan de entrenamiento','Un plan para tu objetivo, experiencia y equipo disponible.','Crear un plan de comidas','Alimentos familiares, poca preparación y porciones para tu objetivo.','Diario de alimentos','Escribe lo que comiste y consulta los totales. Se guarda automáticamente.','Abrir diario de alimentos','Más herramientas','Preferencias opcionales','Objetivo y perfil','Tu rutina','Seguridad y finalizar','Comidas rápidas y familiares por defecto. Puedes cambiarlo abajo.','Sugerimos los días de entrenamiento. Puedes cambiarlos en las preferencias opcionales.','Equipo de gimnasio','Solo peso corporal','Elegir mi equipo','Máquinas, mancuernas, barra y poleas. Elige solo si tienes todo disponible.','Sin pesas ni aparatos. Para barras o anillas, elige tu equipo.','Solo un ejemplo: tu plan es personalizado.','Continuar','Atrás','Crear mi entrenamiento','Crear mi plan de comidas'],
    fr: ['Votre forme. En toute simplicité.','Créez un programme, obtenez des repas simples ou notez ce que vous avez mangé. Choisissez un outil.','Que souhaitez-vous faire ?','Créer un programme sportif','Un programme pour votre objectif, votre niveau et votre matériel.','Créer un plan alimentaire','Des aliments familiers, peu de préparation et des portions adaptées.','Journal alimentaire','Notez vos aliments et consultez les totaux. Enregistrement automatique.','Ouvrir le journal alimentaire','Autres outils','Préférences facultatives','Objectif et profil','Votre routine','Sécurité et création','Des repas rapides et familiers par défaut. Vous pouvez modifier ce choix ci-dessous.','Nous proposons les jours d’entraînement. Modifiez-les dans les préférences facultatives.','Matériel de salle','Poids du corps uniquement','Choisir mon matériel','Machines, haltères, barre et poulies. Choisissez uniquement si tout est disponible.','Sans poids ni appareils. Pour une barre de traction ou des anneaux, choisissez votre matériel.','Exemple uniquement : votre programme est personnalisé.','Continuer','Retour','Créer mon programme','Créer mon plan alimentaire'],
    ru: ['Ваш фитнес. Проще.','Создайте тренировку, получите простой план питания или запишите съеденное. Выберите инструмент.','Что вы хотите сделать?','Создать план тренировок','План с учётом цели, опыта и доступного оборудования.','Создать план питания','Знакомые продукты, быстрое приготовление и подходящие порции.','Дневник питания','Запишите съеденное и проверьте итоги. Записи сохраняются автоматически.','Открыть дневник питания','Другие инструменты','Дополнительные настройки','Цель и профиль','Ваш режим','Безопасность и создание','По умолчанию — быстрые блюда из знакомых продуктов. Выбор можно изменить ниже.','Мы предлагаем дни тренировок. Их можно изменить в дополнительных настройках.','Оборудование зала','Только вес тела','Выбрать оборудование','Тренажёры, гантели, штанга и блоки. Выбирайте, только если всё доступно.','Без весов и снарядов. Для турника или колец выберите оборудование.','Только пример — ваш план будет персональным.','Продолжить','Назад','Создать мои тренировки','Создать мой план питания'],
    de: ['Deine Fitness. Ganz einfach.','Erstelle einen Trainingsplan, plane einfache Mahlzeiten oder erfasse dein Essen. Wähle ein Werkzeug.','Was möchtest du tun?','Trainingsplan erstellen','Ein Plan für dein Ziel, deine Erfahrung und deine Ausrüstung.','Ernährungsplan erstellen','Vertraute Lebensmittel, wenig Vorbereitung und passende Portionen.','Ernährungstagebuch','Schreibe auf, was du gegessen hast. Einträge werden automatisch gespeichert.','Ernährungstagebuch öffnen','Weitere Werkzeuge','Optionale Einstellungen','Ziel und Profil','Dein Alltag','Sicherheit und Abschluss','Standardmäßig schnelle Mahlzeiten mit vertrauten Lebensmitteln. Unten kannst du das ändern.','Wir schlagen Trainingstage vor. Du kannst sie in den optionalen Einstellungen ändern.','Fitnessstudio-Ausrüstung','Nur Körpergewicht','Ausrüstung wählen','Geräte, Kurzhanteln, Langhantel und Kabelzüge. Nur wählen, wenn alles verfügbar ist.','Ohne Gewichte oder Geräte. Für Klimmzugstange oder Ringe wähle deine Ausrüstung.','Nur ein Beispiel – dein Plan wird individuell erstellt.','Weiter','Zurück','Meinen Trainingsplan erstellen','Meinen Ernährungsplan erstellen']
  };
  const disclosureLabels = {
    en: { focus: 'Choose target muscles (optional)', schedule: 'Change training days or profile (optional)', style: 'Training style: gym, bodyweight, or both', equipment: 'Choose equipment beyond the quick presets', review: 'Review your plan details', foodPreferences: 'Choose favorite foods or foods to avoid (optional)', mealsPerDay: 'Choose how many meals to plan (optional)', notes: 'Add a note for your meal plan (optional)' },
    he: { focus: 'בחירת שרירים למיקוד (לא חובה)', schedule: 'שינוי ימי האימון או פרטי הפרופיל (לא חובה)', style: 'סגנון אימון: חדר כושר, משקל גוף או שילוב', equipment: 'בחירת ציוד מעבר לאפשרויות המהירות', review: 'בדיקת פרטי התוכנית', foodPreferences: 'מאכלים מועדפים או כאלה להימנע מהם (לא חובה)', mealsPerDay: 'בחירת מספר הארוחות בתפריט (לא חובה)', notes: 'הוספת הערה לתפריט (לא חובה)' },
    es: { focus: 'Elegir músculos prioritarios (opcional)', schedule: 'Cambiar días de entrenamiento o perfil (opcional)', style: 'Estilo: gimnasio, peso corporal o ambos', equipment: 'Elegir equipo fuera de las opciones rápidas', review: 'Revisar los detalles del plan', foodPreferences: 'Elegir alimentos favoritos o a evitar (opcional)', mealsPerDay: 'Elegir cuántas comidas incluir (opcional)', notes: 'Añadir una nota al plan (opcional)' },
    fr: { focus: 'Choisir les muscles prioritaires (facultatif)', schedule: 'Modifier les jours ou le profil (facultatif)', style: 'Style : salle, poids du corps ou les deux', equipment: 'Choisir du matériel hors des options rapides', review: 'Vérifier les détails du programme', foodPreferences: 'Aliments préférés ou à éviter (facultatif)', mealsPerDay: 'Choisir le nombre de repas (facultatif)', notes: 'Ajouter une note au plan (facultatif)' },
    de: { focus: 'Zielmuskeln auswählen (optional)', schedule: 'Trainingstage oder Profil ändern (optional)', style: 'Trainingsstil: Studio, Körpergewicht oder beides', equipment: 'Weitere Geräte außerhalb der Schnellauswahl wählen', review: 'Trainingsplandetails prüfen', foodPreferences: 'Lieblingsspeisen oder zu vermeidende Speisen (optional)', mealsPerDay: 'Anzahl der Mahlzeiten wählen (optional)', notes: 'Eine Notiz zum Ernährungsplan hinzufügen (optional)' },
    ar: { focus: 'اختيار العضلات المستهدفة (اختياري)', schedule: 'تغيير أيام التدريب أو الملف الشخصي (اختياري)', style: 'الأسلوب: النادي أو وزن الجسم أو كلاهما', equipment: 'اختيار معدات خارج الخيارات السريعة', review: 'مراجعة تفاصيل الخطة', foodPreferences: 'اختيار الأطعمة المفضلة أو التي يجب تجنبها (اختياري)', mealsPerDay: 'اختيار عدد الوجبات (اختياري)', notes: 'إضافة ملاحظة لخطة الطعام (اختياري)' },
    zh: { focus: '选择重点训练肌群（可选）', schedule: '更改训练日或个人资料（可选）', style: '训练方式：健身房、自重或两者结合', equipment: '选择快捷选项以外的器材', review: '查看计划详情', foodPreferences: '选择喜欢或要避免的食物（可选）', mealsPerDay: '选择计划中的餐数（可选）', notes: '为饮食计划添加备注（可选）' }
  };
  translations.zh = ['健身，更简单。','创建训练计划、获取简单食谱，或记录今天吃了什么。选择一个工具开始。','你想做什么？','创建训练计划','根据你的目标、经验和器材制定计划。','创建饮食计划','常见食材、简单准备以及适合目标的份量。','饮食日记','写下吃过的食物，查看总量。记录会自动保存。','打开饮食日记','更多工具','可选偏好','目标与个人信息','日常安排','安全与完成','默认选择简单、快速的家常食物。可在下方更改。','我们推荐训练日期。可在可选偏好中修改。','健身房器材','仅自重','选择我的器材','器械、哑铃、杠铃和绳索。仅在全部可用时选择。','无需负重或器械。使用单杠或吊环时，请选择器材。','仅为示例，实际计划会个性化。','继续','返回','创建我的训练计划','创建我的饮食计划'];
  const language = localStorage.getItem('ofek-ai-language') || 'en';
  const copy = key => (translations[language] || translations.en)[keys.indexOf(key)] || key;
  const text = (tag, key, className) => {
    const node = document.createElement(tag);
    node.textContent = copy(key);
    if (className) node.className = className;
    return node;
  };
  const details = (nodes, key = 'advanced') => {
    const box = document.createElement('details');
    box.className = 'simple-options';
    const summary = document.createElement('summary');
    summary.textContent = disclosureLabels[language]?.[key] || copy(key);
    box.append(summary);
    nodes.filter(Boolean).forEach(node => box.append(node));
    return box;
  };
  const wrap = (node, key = 'advanced', extra = []) => {
    const box = details([],key);
    node.before(box);
    box.append(node,...extra.filter(Boolean));
    return box;
  };
  const toolDefinitions = [
    ['workout','workoutText','workout-builder.html','barbell'],
    ['nutrition','nutritionText','nutrition-builder.html','salad'],
    ['diary','diaryText','daily-nutrition.html','clipboard']
  ];
  function tools() {
    const region = document.createElement('section');
    region.className = 'simple-tools';
    region.id = 'simpleTools';
    region.append(text('h2','choose'));
    const grid = document.createElement('div');
    grid.className = 'simple-tools-grid';
    toolDefinitions.forEach(([title,description,href,icon], index) => {
      const link = document.createElement('a');
      link.className = 'simple-tool';
      link.dataset.toolIndex = String(index);
      link.href = `/${href}`;
      const marker = text('span', title, 'simple-tool-icon');
      marker.textContent = String(index+1).padStart(2,'0');
      marker.setAttribute('aria-hidden','true');
      link.append(marker,text('h3',title),text('p',description));
      const action = text('span','next','simple-tool-action');
      action.setAttribute('aria-hidden','true');
      link.append(action);
      grid.append(link);
    });
    region.append(grid);
    return region;
  }
  function groupWizard(form, groups) {
    if (!form) return;
    form.classList.add('simple-builder');
    const original = [...form.querySelectorAll('.wizard-step')];
    const anchor = original[0];
    groups.forEach(([title, names], index) => {
      const step = document.createElement('section');
      step.className = `wizard-step${index === 0 ? ' is-active' : ''}`;
      step.dataset.wizardStep = names.join(',');
      step.dataset.stepTitleEn = translations.en[keys.indexOf(title)];
      step.dataset.stepTitleHe = translations.he[keys.indexOf(title)];
      step.dataset.simpleTitle = title;
      step.append(text('h2',title,'simple-step-title'));
      names.forEach(name => {
        const source = original.find(node => node.dataset.wizardStep === name);
        if (!source) return;
        source.classList.remove('wizard-step','is-active');
        source.classList.add('simple-question');
        step.append(source);
      });
      form.insertBefore(step,anchor.isConnected && anchor.parentNode === form ? anchor : form.querySelector('#wizardError'));
    });
  }
  const workoutForm = document.querySelector('#workout-builder-form');
  if (workoutForm) {
    groupWizard(workoutForm,[['basics',['goal','experience']],['routine',['style','equipment','schedule']],['safety',['limitations','muscleFocus']]]);
    const focus = workoutForm.querySelector('[data-wizard-step="muscleFocus"]');
    if (focus) wrap(focus, 'focus');
    const schedule = workoutForm.querySelector('[data-wizard-step="schedule"]');
    const gender = document.querySelector('#gender')?.closest('label');
    const weekdays = schedule.querySelector('.available-days-fieldset');
    schedule.append(details([gender],'schedule'),weekdays);
    const review = document.querySelector('#wizardReview');
    if (review) wrap(review,'review');
    const gear = workoutForm.querySelector('[data-wizard-step="equipment"]');
    const gearGrid = gear.querySelector('.visual-choice-grid');
    const gearPictures = {bodyweight:'/images/workout-builder/equipment/bodyweight-preview.webp',pullupbar:'/images/workout-builder/equipment/pullup-preview.webp',rings:'/images/workout-builder/equipment/rings.webp',dumbbell:'/images/workout-builder/equipment/dumbbells.webp',barbell:'/images/workout-builder/equipment/barbell.webp',machine:'/images/workout-builder/equipment/machines.webp',kettlebell:'/images/workout-builder/equipment/kettlebell-preview.webp',parallelbar:'/images/workout-builder/equipment/parallelbar-preview.webp',romanchair:'/images/workout-builder/equipment/romanchair-preview.webp',cable:'/images/workout-builder/equipment/cable-preview.webp'};
    const cable = document.createElement('label');
    cable.className = 'visual-choice-card';
    cable.innerHTML = '<input type="checkbox" name="equipment" value="cable"><span class="visual-choice-content"><strong data-en="Cables" data-he="כבלים">Cables</strong></span>';
    gearGrid.append(cable);
    gearGrid.querySelectorAll('input[name="equipment"]').forEach(input => {
      const image = input.parentElement.querySelector('.visual-choice-image') || document.createElement('span');
      image.className = 'visual-choice-image'; image.setAttribute('aria-hidden','true');
      if (gearPictures[input.value]) image.style.setProperty('background-image', `url('${gearPictures[input.value]}')`, 'important');
      if (!image.isConnected) input.after(image);
    });
    const presets = document.createElement('div');
    presets.className = 'simple-equipment-presets';
    [['gym','gymText'],['home','homeText']].forEach(([key,description]) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio'; input.name = 'equipmentPreset'; input.value = key;
      label.append(input,text('strong',key),text('small',description));
      input.addEventListener('change',event => {
        const ids = key === 'gym' ? ['machine','dumbbell','barbell','cable'] : ['bodyweight'];
        if (event.isTrusted) {
          workoutForm.dataset.userEquipmentPreset = '1';
          // Do not let the old calisthenics constraint re-check bodyweight
          // while the preset is being applied one control at a time.
          document.querySelector('#trainingStyle').value = 'gym';
        }
        gearGrid.querySelectorAll('input').forEach(box => {
          box.checked = ids.includes(box.value);
          box.dispatchEvent(new Event('change',{bubbles:true}));
        });
        delete workoutForm.dataset.userEquipmentPreset;
        if (event.isTrusted) {
          const select = document.querySelector('#trainingStyle');
          select.value = key === 'gym' ? 'gym' : 'calisthenics';
          select.dispatchEvent(new Event('change',{bubbles:true}));
        }
        const style = document.querySelector(`input[name="visualStyle"][value="${key==='gym'?'gym':'calisthenics'}"]`);
        // In the explicit workout journey, a gear preset must not silently
        // overwrite an already chosen Hybrid/Gym/Calisthenics preference.
        if (!workoutForm.hasAttribute('data-native-controls') || !document.querySelector('#trainingStyle').value) {
          style.checked = true;
          style.dispatchEvent(new Event('change',{bubbles:true}));
        }
      });
      presets.append(label);
    });
    gearGrid.querySelectorAll('input').forEach(box => box.addEventListener('change',event => {
      if (event.isTrusted) presets.querySelectorAll('input').forEach(input => { input.checked = false; });
      if (workoutForm.dataset.userEquipmentPreset === '1' || !event.isTrusted) return;
      const chosen = [...gearGrid.querySelectorAll('input[name="equipment"]:checked')].map(input=>input.value);
      const weighted = chosen.some(value=>['machine','dumbbell','barbell','cable','kettlebell'].includes(value));
      const body = chosen.some(value=>['bodyweight','pullupbar','rings','parallelbar'].includes(value));
      document.querySelector('#trainingStyle').value = weighted && body ? 'hybrid' : weighted ? 'gym' : 'calisthenics';
    }));
    gearGrid.before(presets);
    const customEquipment = wrap(gearGrid,'equipment');
    const style = workoutForm.querySelector('[data-wizard-step="style"]');
    const styleOptions = wrap(style,'style');
    customEquipment.addEventListener('toggle',() => {
      if (customEquipment.open) styleOptions.open = true;
    });
    // Suggested days are visible as a documented default, never an inferred constraint.
    const countInput = document.querySelector('#daysPerWeek');
    let customDays = false;
    const patterns = {1:[0],2:[0,3],3:[0,2,4],4:[0,1,3,4],5:[0,1,2,3,4],6:[0,1,2,3,4,5],7:[0,1,2,3,4,5,6]};
    const boxes = [...workoutForm.querySelectorAll('input[name="availableDays"]')];
    const suggest = () => {
      if (customDays) return;
      boxes.forEach((box,index) => { box.checked = (patterns[countInput.value] || []).includes(index); });
    };
    boxes.forEach(box => box.addEventListener('change',() => { customDays = true; }));
    countInput.addEventListener('change',suggest);
    suggest();
  }
  const nutritionForm = document.querySelector('#nutrition-builder-form');
  if (nutritionForm) {
    groupWizard(nutritionForm,[['basics',['goal','about','body']],['routine',['activity','diet']],['safety',['restrictions']]]);
    const diet = nutritionForm.querySelector('[data-wizard-step="diet"]');
    const mealPrefs = diet.querySelector('.meal-practicality-fieldset');
    mealPrefs.before(text('p','simpleFood','simple-note'));
    wrap(mealPrefs,'foodPreferences',[document.querySelector('#favoriteFoods')?.parentNode,document.querySelector('#foodsToAvoid')?.parentNode]);
    nutritionForm.querySelector('input[name="mealFormatPreference"][value="quick"]').checked = true;
    const activity = nutritionForm.querySelector('[data-wizard-step="activity"]');
    activity.append(details([document.querySelector('#mealsPerDay')?.closest('label')],'mealsPerDay'));
    const notes = document.querySelector('#additionalNotes')?.parentNode;
    if (notes) wrap(notes,'notes');
  }
  if (document.querySelector('#landingHeroTitle')) {
    document.body.classList.add('landing-page');
    const hero = document.querySelector('.hero-shell');
    hero.classList.add('simple-hero');
    const social=hero.querySelector('.hero-social-links');
    if(social){
      social.classList.add('editorial-social-rail');
      const desktop=matchMedia('(min-width: 901px)');
      const placeSocial=()=>desktop.matches?document.body.append(social):hero.prepend(social);
      placeSocial();desktop.addEventListener('change',placeSocial);
    }
    const heroTitle = hero.querySelector('#landingHeroTitle');
    const landingCopy = {
      en: ['Your workout and meal plans. Built for you. Free.', 'Create a personalized workout plan and a one-day meal plan. Track your training and food in one place.', 'Build my workout', 'Plan my meals', 'See an illustrative workout example', 'Choose where to start'],
      he: ['תוכנית אימון ותפריט. מותאמים לך. בחינם.', 'יוצרים תוכנית אימון אישית ותפריט ליום אחד. עוקבים אחרי האימונים והתזונה במקום אחד.', 'בניית תוכנית אימון', 'בניית תפריט', 'לצפייה בתוכנית אימון לדוגמה', 'בוחרים מאיפה להתחיל'],
      ar: ['خطط تمارين ووجبات. مخصصة لك. مجاناً.', 'أنشئ خطة تمارين مخصصة وخطة وجبات ليوم واحد. تابع تدريبك وطعامك في مكان واحد.', 'أنشئ خطة تماريني', 'خطط وجباتي', 'شاهد مثالاً توضيحياً لخطة تمارين', 'اختر من أين تبدأ'],
      es: ['Tus planes de ejercicio y comidas. A tu medida. Gratis.', 'Crea un plan de entrenamiento personalizado y un plan de comidas para un día. Registra tu entrenamiento y alimentación en un solo lugar.', 'Crear mi entrenamiento', 'Planificar mis comidas', 'Ver un ejemplo ilustrativo de entrenamiento', 'Elige por dónde empezar'],
      fr: ['Sport et repas. Des programmes pour vous. Gratuits.', 'Créez un programme sportif personnalisé et un plan de repas pour une journée. Suivez votre entraînement et votre alimentation au même endroit.', 'Créer mon programme', 'Planifier mes repas', 'Voir un exemple de programme sportif', 'Choisissez par où commencer'],
      de: ['Deine Trainings- und Essenspläne. Für dich. Kostenlos.', 'Erstelle einen persönlichen Trainingsplan und einen Essensplan für einen Tag. Verfolge Training und Ernährung an einem Ort.', 'Training erstellen', 'Mahlzeiten planen', 'Einen beispielhaften Trainingsplan ansehen', 'Wähle deinen Einstieg'],
      zh: ['你的训练与饮食计划。为你定制。免费。', '制定个性化训练计划和一日饮食计划。在同一处记录训练与饮食。', '制定训练计划', '规划我的饮食', '查看训练计划示例', '选择从哪里开始']
    };
    const words = landingCopy[language] || landingCopy.en;
    heroTitle.textContent = words[0];
    const lede = hero.querySelector('.hero-lede');
    lede.removeAttribute('data-i18n');
    lede.textContent = words[1];
    const toolActions = document.createElement('nav');
    toolActions.className = 'landing-tool-actions';
    toolActions.setAttribute('aria-label', words[5]);
    ['/workout-builder.html', '/nutrition-builder.html'].forEach((href, index) => {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = words[index + 2];
      toolActions.append(link);
    });
    const sampleLink = document.createElement('a');
    sampleLink.className = 'landing-sample-link';
    sampleLink.href = '/workout-plan-generator.html#example';
    sampleLink.textContent = words[4];
    lede.after(toolActions, sampleLink);
    const entryCopy = {
      en: ['Continue with Google', 'Sign up with email', 'Continue as a Guest', 'Log in', 'Explore the dashboard and try a tool. Sign up only when you are ready to generate or save.'],
      he: ['ממשיכים עם Google', 'הרשמה עם אימייל', 'המשך כאורח', 'כניסה לחשבון', 'אפשר לראות את הדשבורד ולנסות כלי. נרשמים רק כשרוצים ליצור או לשמור.'],
      ar: ['المتابعة باستخدام Google', 'التسجيل بالبريد الإلكتروني', 'المتابعة كضيف', 'تسجيل الدخول', 'جرّب لوحة التحكم أولاً. سجّل عندما تريد الإنشاء أو الحفظ.'],
      es: ['Continuar con Google', 'Registrarse con correo', 'Continuar como invitado', 'Iniciar sesión', 'Explora el panel y prueba una herramienta. Regístrate para crear o guardar.'],
      fr: ['Continuer avec Google', 'S’inscrire par e-mail', 'Continuer en invité', 'Se connecter', 'Explorez le tableau de bord. Inscrivez-vous pour créer ou enregistrer.'],
      de: ['Mit Google fortfahren', 'Mit E-Mail registrieren', 'Als Gast fortfahren', 'Anmelden', 'Erkunde das Dashboard. Registriere dich zum Erstellen oder Speichern.'],
      zh: ['使用 Google 继续', '使用邮箱注册', '以访客身份继续', '登录', '先浏览控制面板。生成或保存时再注册。']
    }[language] || ['Continue with Google', 'Sign up with email', 'Continue as a Guest', 'Log in', 'Explore the dashboard and try a tool. Sign up only when you are ready to generate or save.'];
    const entryActions = document.createElement('div');
    entryActions.className = 'landing-entry-actions';
    const startLink = document.createElement('a');
    startLink.className = 'landing-entry-link landing-entry-link--primary landing-entry-link--google';
    startLink.id = 'continueGoogleCta';
    startLink.href = 'auth.html?provider=google';
    const googleIcon = hero.querySelector('#continueGoogleCta svg')?.cloneNode(true);
    if (googleIcon) startLink.append(googleIcon);
    const googleLabel = document.createElement('span');
    googleLabel.textContent = entryCopy[0];
    startLink.append(googleLabel);
    const emailLink = document.createElement('a');
    emailLink.className = 'landing-entry-link landing-entry-link--secondary';
    emailLink.href = 'auth.html?mode=signup';
    emailLink.textContent = entryCopy[1];
    const guestLink = document.createElement('a');
    guestLink.className = 'landing-entry-link landing-entry-link--secondary';
    guestLink.href = '/dashboard.html';
    guestLink.textContent = entryCopy[2];
    const loginLink = document.createElement('a');
    loginLink.className = 'landing-entry-login';
    loginLink.href = 'auth.html';
    loginLink.textContent = entryCopy[3];
    const entryHint = document.createElement('small');
    entryHint.className = 'landing-entry-hint';
    entryHint.textContent = entryCopy[4];
    entryActions.append(startLink, emailLink, guestLink, loginLink, entryHint);
    sampleLink.after(entryActions);
    const editorialMedia = document.createElement('figure');
    editorialMedia.className = 'editorial-landing-media';
    const editorialPhoto = document.createElement('img');
    editorialPhoto.src = '/assets/dashboard/landing-training.webp';
    editorialPhoto.alt = 'Athlete performing a standing cable row';
    editorialPhoto.width = 608;
    editorialPhoto.height = 648;
    editorialPhoto.decoding = 'async';
    const editorialCaption = document.createElement('figcaption');
    editorialCaption.textContent = language === 'he' ? 'התוכנית שלך. ההתקדמות שלך.' : 'Your plan. Your progress.';
    editorialMedia.append(editorialPhoto, editorialCaption);
    hero.querySelector('.hero-content').after(editorialMedia);
    editorialMedia.after(tools());
    ['.hero-subcopy','.hero-support','.hero-meta','.hero-cta-row','.feature-pills','.builder-chooser','.eyebrow'].forEach(selector => hero.querySelector(selector)?.remove());
    hero.querySelector('.landing-plan-guide-link')?.remove();
    const aside = hero.querySelector('.hero-panel');
    aside.className = 'simple-preview';
    aside.replaceChildren(text('p','example','simple-note'));
    const examples = [['workout'], ['nutrition'], ['diary']];
    examples.forEach(([key,...rows],index) => {
      const card = document.createElement('div'); card.className = 'simple-preview-card simple-tool-preview';
      card.dataset.toolIndex = String(index);
      card.id = `simpleToolPreview${index + 1}`;
      card.setAttribute('aria-hidden','true');
      card.classList.add('product-preview');
      const he=language==='he';
      const label=(en,hebrew)=>he?hebrew:en;
      const previewTitles = {
        en: ['Sample workout plan', 'Sample meal plan', 'Sample food diary'],
        he: ['דוגמה לתוכנית אימון', 'דוגמה לתפריט', 'דוגמה ליומן תזונה'],
        ar: ['مثال لخطة تمارين', 'مثال لخطة وجبات', 'مثال لسجل الطعام'],
        es: ['Ejemplo de entrenamiento', 'Ejemplo de comidas', 'Ejemplo de diario'],
        fr: ['Exemple de programme', 'Exemple de repas', 'Exemple de journal'],
        de: ['Beispiel-Trainingsplan', 'Beispiel-Ernährungsplan', 'Beispiel-Ernährungstagebuch'],
        zh: ['训练计划示例', '饮食计划示例', '饮食日记示例']
      }[language] || ['Sample workout plan', 'Sample meal plan', 'Sample food diary'];
      const note=text('small','example','preview-example-note');
      card.append(note);
      const previewTitle = document.createElement('strong');
      previewTitle.textContent = previewTitles[index];
      card.append(previewTitle);
      const demo=document.createElement('div');demo.className='product-preview-body';
      if(index===0) demo.innerHTML=`<span class="preview-profile">${label('Build muscle · 4 days · Gym','בניית שריר · 4 ימים · חדר כושר')}</span><div class="preview-split"><b>${label('Upper / Lower','פלג גוף עליון / תחתון')}</b><small>${label('8-week plan · Upper A','תוכנית ל־8 שבועות · עליון א׳')}</small></div><div class="preview-exercise"><img src="/images/exercises/bench-press.png" alt="" loading="lazy"><span><b>${label('Bench press','לחיצת חזה')}</b><small>3 ${label('sets','סטים')} · 8–12 ${label('reps','חזרות')}<br>${label('Rest','מנוחה')} 120 ${label('sec','שניות')} · RIR 2</small></span></div><div class="preview-exercise"><img src="/images/exercises/seated-cable-row.png" alt="" loading="lazy"><span><b>${label('Seated cable row','חתירה בכבל בישיבה')}</b><small>3 ${label('sets','סטים')} · 8–12 ${label('reps','חזרות')}<br>${label('Rest','מנוחה')} 90 ${label('sec','שניות')} · RIR 2</small></span></div><div class="preview-volume"><span>${label('Chest · weekly sets','חזה · סטים שבועיים')}</span><b>12 <small>${label('Within target','בטווח היעד')}</small></b><i></i></div>`;
      if(index===1) demo.innerHTML=`<div class="preview-targets"><b>2,400 <small>kcal</small></b><b>150 g <small>${label('protein','חלבון')}</small></b></div><div class="preview-meal"><img src="/images/meals/banana-oat-protein-smoothie.webp" alt="" loading="lazy"><span><b>${label('Breakfast · protein smoothie','בוקר · שייק חלבון')}</b><small>${label('Milk 250 ml · oats 40 g · banana 100 g · protein powder 25 g','חלב 250 מ״ל · שיבולת שועל 40 ג׳ · בננה 100 ג׳ · אבקת חלבון 25 ג׳')}</small></span></div><div class="preview-meal-totals"><b>468 kcal</b><b>37 g ${label('protein','חלבון')}</b><span>5 ${label('min prep','דקות הכנה')}</span></div><div class="preview-alternative"><b>${label('Lunch','צהריים')}</b><span>${label('Chicken 150 g · rice 200 g · vegetables','עוף 150 ג׳ · אורז 200 ג׳ · ירקות')}</span></div><div class="preview-alternative"><b>${label('Dinner','ערב')}</b><span>${label('Eggs · cottage cheese · bread · salad','ביצים · קוטג׳ · לחם · סלט')}</span></div>`;
      if(index===2) demo.innerHTML=`<div class="preview-diary"><div class="preview-calorie-ring"><div><b>1,650</b><small>${label('kcal eaten','קלוריות שנאכלו')}</small></div></div><div class="preview-diary-stats"><span><i class="eaten-dot"></i>${label('Eaten','נאכלו')} <b>1,650 kcal</b></span><span><i class="remaining-dot"></i>${label('Remaining','נותרו')} <b>750 kcal</b></span><span class="preview-protein">${label('Protein','חלבון')} <b>112 / 150 g</b><i></i></span></div></div><div class="preview-log-entry">${label('“Chicken sandwich and an apple”','״כריך עוף ותפוח״')}<small>${label('Review portions · edit estimates · track your day','בדיקת כמויות · עריכת אומדנים · מעקב יומי')}</small></div>`;
      card.append(demo);
      aside.append(card);
    });
    // Tell a literal three-step product story. The selected action and its
    // matching example move together, so this cannot read as decoration.
    const previewCards = [...aside.querySelectorAll('.simple-preview-card')];
    const toolCards = [...hero.querySelectorAll('.simple-tool')];
    toolCards.forEach((card,index) => card.setAttribute('aria-describedby', previewCards[index]?.id || ''));
    const toolsRegion = hero.querySelector('.simple-tools');
    previewCards.forEach((card,index) => {
      const action = toolCards[index]?.querySelector('.simple-tool-action');
      if (action) action.before(card);
    });
    aside.remove();
    let activePreview = 0;
    let previewTimer = 0;
    let previewVisible = true;
    const canAnimatePreview = 'IntersectionObserver' in window && typeof window.matchMedia === 'function' && typeof window.setInterval === 'function';
    const showPreview = index => {
      activePreview = (index + previewCards.length) % previewCards.length;
      previewCards.forEach((card,position) => card.classList.toggle('is-active',position === activePreview));
      toolCards.forEach((card,position) => {
        card.classList.toggle('is-preview-active',position === activePreview);
      });
    };
    const stopPreview = () => {
      if (previewTimer) window.clearInterval(previewTimer);
      previewTimer = 0;
    };
    const startPreview = () => {
      stopPreview();
      if (!canAnimatePreview || !previewVisible || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      previewTimer = window.setInterval(() => showPreview(activePreview + 1),2400);
    };
    toolCards.forEach((card,index) => {
      card.addEventListener('pointerenter',() => { stopPreview(); showPreview(index); });
      card.addEventListener('pointerleave',startPreview);
      card.addEventListener('focusin',() => { stopPreview(); showPreview(index); });
      card.addEventListener('focusout',startPreview);
    });
    showPreview(0);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      previewVisible = Boolean(entries[0]?.isIntersecting);
      toolsRegion?.classList.toggle('is-playing',previewVisible);
      startPreview();
    },{threshold:.1}).observe(toolsRegion || hero);
    else toolsRegion?.classList.add('is-playing');
    document.addEventListener('visibilitychange',() => {
      toolsRegion?.classList.toggle('is-paused',document.hidden);
      startPreview();
    });
    startPreview();
    const feature = document.querySelector('#features');
    const loop = document.querySelector('.product-loop-section');
    if (feature) wrap(feature,'more',[loop]);
  }
  const studio = document.querySelector('.dashboard-primary-actions');
  // The dashboard has its own plan-first layout. The generic three-tool
  // chooser belongs on the public landing page, not inside the signed-in
  // dashboard where it pushes the actual plan cards below the fold.
  if (studio && !document.body.classList.contains('dashboard-design-v2')) {
    const extra = details([...studio.querySelectorAll('.capability-card')],'more');
    const core = tools();
    studio.before(core);
    studio.replaceWith(extra);
    // Keep IDs for localized/dashboard state updates, but put secondary tools after the core actions.
    const focus = document.querySelector('.daily-focus');
    if (focus) core.after(focus);
    document.querySelector('.daily-nutrition-spotlight')?.remove();
  }
  // A stable three-tool navigation also makes it easy to switch workflows.
  // The nutrition builder already has destination links above its wizard.
  // Avoid a second three-tool strip that duplicates them and crowds the page.
  if (workoutForm) {
    const nav = document.createElement('nav'); nav.className='simple-tool-nav';
    nav.setAttribute('aria-label',copy('choose'));
    toolDefinitions.forEach(([key,,href]) => { const link=text('a',key);link.href=`/${href}`; if (location.pathname.endsWith(href)) link.setAttribute('aria-current','page');nav.append(link); });
    document.querySelector('main')?.prepend(nav);
  }
  window.FuelSimpleUI = {copy};
})();
