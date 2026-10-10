/* Small, synchronous UI layer: no network dependency, no auth bypass. */
(() => {
  'use strict';
  const keys = ['title','intro','choose','workout','workoutText','nutrition','nutritionText','diary','diaryText','open','more','advanced','basics','routine','safety','simpleFood','daysHint','gym','home','custom','gymText','homeText','example','next','back','createWorkout','createNutrition'];
  const translations = {
    en: ['Your fitness. Made simple.','Create a workout plan, get a simple meal plan, or log what you ate. Choose one tool to start.','What would you like to do?','Create a workout plan','A plan for your goal, experience and available equipment.','Create a meal plan','Familiar foods, short preparation and portions for your goal.','Log today’s food','Write what you ate. See your totals. Your entries save automatically.','Open food diary','More tools','Optional preferences','Your goal & profile','Your routine','Safety & finish','Quick, familiar meals are selected by default. You can change this below.','We suggest training days for you. Open the optional preferences to change them.','Gym equipment','Bodyweight only','Choose my equipment','Machines, dumbbells, barbell and cables. Choose this only if all are available.','No weights or apparatus. For bars or rings, choose your equipment.','Example only — your plan is personalized.','Continue','Back','Create my workout plan','Create my meal plan'],
    he: ['הכושר שלך. פשוט יותר.','צרו תוכנית אימון, קבלו תפריט פשוט או רשמו מה אכלתם. בחרו כלי אחד כדי להתחיל.','מה תרצו לעשות?','יצירת תוכנית אימון','תוכנית לפי המטרה, הניסיון והציוד שיש לכם.','יצירת תפריט','מאכלים מוכרים, הכנה קצרה וכמויות שמתאימות למטרה שלכם.','יומן תזונה','כתבו מה אכלתם, ראו את הסיכום. הרישומים נשמרים אוטומטית.','פתיחת יומן התזונה','כלים נוספים','העדפות נוספות — לא חובה','המטרה והפרטים שלכם','השגרה שלכם','בטיחות ויצירה','ברירת המחדל היא ארוחות מהירות עם מאכלים מוכרים. אפשר לשנות למטה.','אנחנו מציעים ימי אימון. אפשר לשנות אותם בהעדפות הנוספות.','ציוד חדר כושר','משקל גוף בלבד','בחירת הציוד שלי','מכונות, דאמבלים, מוט וכבלים. בחרו רק אם כל הציוד זמין לכם.','ללא משקולות או מתקנים. למתח או טבעות, בחרו את הציוד שלכם.','דוגמה בלבד — התוכנית שלכם מותאמת אישית.','המשך','חזרה','יצירת תוכנית האימון שלי','יצירת התפריט שלי'],
    ar: ['لياقتك. ببساطة.','أنشئ خطة تمارين أو خطة وجبات بسيطة أو سجّل ما أكلت. اختر أداة للبدء.','ماذا تريد أن تفعل؟','إنشاء خطة تمارين','خطة لهدفك وخبرتك والمعدات المتاحة لك.','إنشاء خطة وجبات','أطعمة مألوفة وتحضير سريع وحصص تناسب هدفك.','سجل الطعام','اكتب ما أكلت وشاهد المجموع. تُحفظ الإدخالات تلقائيًا.','فتح سجل الطعام','أدوات إضافية','تفضيلات اختيارية','هدفك وبياناتك','روتينك','السلامة والإنشاء','وجبات سريعة ومألوفة افتراضيًا. يمكنك تغيير ذلك أدناه.','نقترح أيام التدريب. يمكنك تغييرها في التفضيلات الاختيارية.','معدات النادي','وزن الجسم فقط','اختيار معداتي','أجهزة ودمبل وبار وكابلات. اختر فقط إذا كانت كلها متاحة.','بدون أوزان أو أجهزة. للعقلة أو الحلقات، اختر معداتك.','مثال فقط — خطتك مخصصة لك.','متابعة','رجوع','إنشاء خطة تماريني','إنشاء خطة وجباتي'],
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
  function tools(publicPage) {
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
      link.href = publicPage ? `auth.html?next=${href}` : `/${href}`;
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
    schedule.append(text('p','daysHint','simple-note'),details([gender,weekdays],'schedule'));
    const review = document.querySelector('#wizardReview');
    if (review) wrap(review,'review');
    const gear = workoutForm.querySelector('[data-wizard-step="equipment"]');
    const gearGrid = gear.querySelector('.visual-choice-grid');
    const cable = document.createElement('label');
    cable.className = 'visual-choice-card';
    cable.innerHTML = '<input type="checkbox" name="equipment" value="cable"><span class="visual-choice-content"><strong data-en="Cables" data-he="כבלים">Cables</strong></span>';
    gearGrid.append(cable);
    const presets = document.createElement('div');
    presets.className = 'simple-equipment-presets';
    [['gym','gymText'],['home','homeText']].forEach(([key,description]) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio'; input.name = 'equipmentPreset'; input.value = key;
      label.append(input,text('strong',key),text('small',description));
      input.addEventListener('change',() => {
        const ids = key === 'gym' ? ['machine','dumbbell','barbell','cable'] : ['bodyweight'];
        gearGrid.querySelectorAll('input').forEach(box => {
          box.checked = ids.includes(box.value);
          box.dispatchEvent(new Event('change',{bubbles:true}));
        });
        const style = document.querySelector(`input[name="visualStyle"][value="${key==='gym'?'gym':'calisthenics'}"]`);
        style.checked = true;
        style.dispatchEvent(new Event('change',{bubbles:true}));
      });
      presets.append(label);
    });
    gearGrid.querySelectorAll('input').forEach(box => box.addEventListener('change',event => {
      if (event.isTrusted) presets.querySelectorAll('input').forEach(input => { input.checked = false; });
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
    hero.querySelector('#landingHeroTitle').replaceChildren(text('span','title'));
    const lede = hero.querySelector('.hero-lede');
    lede.removeAttribute('data-i18n'); lede.textContent = copy('intro');
    const editorialMedia = document.createElement('figure');
    editorialMedia.className = 'editorial-landing-media';
    const editorialPhoto = document.createElement('img');
    editorialPhoto.src = '/assets/dashboard/landing-training.webp';
    editorialPhoto.alt = 'Athlete performing a standing cable row';
    editorialPhoto.width = 608;
    editorialPhoto.height = 648;
    editorialPhoto.decoding = 'async';
    const editorialCaption = document.createElement('figcaption');
    editorialCaption.textContent = 'Your plan. Your progress.';
    editorialMedia.append(editorialPhoto, editorialCaption);
    hero.querySelector('.hero-content').after(editorialMedia);
    editorialMedia.after(tools(true));
    ['.hero-subcopy','.hero-support','.hero-meta','.hero-cta-row','.feature-pills','.builder-chooser','.eyebrow'].forEach(selector => hero.querySelector(selector)?.remove());
    hero.querySelector('.landing-plan-guide-link')?.remove();
    const aside = hero.querySelector('.hero-panel');
    aside.className = 'simple-preview';
    aside.replaceChildren(text('p','example','simple-note'));
    const examples = [
      ['workout','Squat · 3 × 8','Push-up · 3 × 10','Row · 3 × 10'],
      ['nutrition','Yogurt + oats','Eggs + bread','Tuna + ready rice'],
      ['diary','150 g yogurt','1 banana','✓']
    ];
    const exampleCopy = {
      he:[['סקוואט · 3 × 8','שכיבות סמיכה · 3 × 10','חתירה · 3 × 10'],['יוגורט + שיבולת שועל','ביצים + לחם','טונה + אורז מוכן'],['150 גרם יוגורט','בננה אחת','✓']],
      ar:[['قرفصاء · 3 × 8','ضغط · 3 × 10','تجديف · 3 × 10'],['زبادي + شوفان','بيض + خبز','تونة + أرز جاهز'],['150 غ زبادي','موزة واحدة','✓']],
      es:[['Sentadilla · 3 × 8','Flexiones · 3 × 10','Remo · 3 × 10'],['Yogur + avena','Huevos + pan','Atún + arroz preparado'],['150 g de yogur','1 plátano','✓']],
      fr:[['Squat · 3 × 8','Pompes · 3 × 10','Tirage · 3 × 10'],['Yaourt + avoine','Œufs + pain','Thon + riz prêt'],['150 g de yaourt','1 banane','✓']],
      ru:[['Присед · 3 × 8','Отжимания · 3 × 10','Тяга · 3 × 10'],['Йогурт + овсянка','Яйца + хлеб','Тунец + готовый рис'],['150 г йогурта','1 банан','✓']],
      de:[['Kniebeuge · 3 × 8','Liegestütz · 3 × 10','Rudern · 3 × 10'],['Joghurt + Haferflocken','Eier + Brot','Thunfisch + fertiger Reis'],['150 g Joghurt','1 Banane','✓']],
      zh:[['深蹲 · 3 × 8','俯卧撑 · 3 × 10','划船 · 3 × 10'],['酸奶 + 燕麦','鸡蛋 + 面包','金枪鱼 + 即食米饭'],['150 克酸奶','1 根香蕉','✓']]
    };
    const workflowStages = {
      en:[['Goal','Plan','Train'],['Choose','Portion','Prepare'],['Enter','Add','Track']],
      he:[['מטרה','תוכנית','אימון'],['בחירה','כמות','הכנה'],['הזנה','הוספה','מעקב']],
      ar:[['الهدف','الخطة','التمرين'],['اختيار','الكمية','التحضير'],['إدخال','إضافة','متابعة']],
      es:[['Objetivo','Plan','Entrenar'],['Elegir','Porción','Preparar'],['Escribir','Añadir','Registrar']],
      fr:[['Objectif','Plan','Entraîner'],['Choisir','Portion','Préparer'],['Saisir','Ajouter','Suivre']],
      de:[['Ziel','Plan','Trainieren'],['Wählen','Portion','Zubereiten'],['Eingeben','Hinzufügen','Verfolgen']],
      zh:[['目标','计划','训练'],['选择','份量','准备'],['输入','添加','记录']]
    };
    examples.forEach(([key,...rows],index) => {
      const card = document.createElement('div'); card.className = 'simple-preview-card simple-tool-preview';
      card.dataset.toolIndex = String(index);
      card.id = `simpleToolPreview${index + 1}`;
      card.setAttribute('aria-hidden','true');
      const image = document.createElement('img');
      image.className = 'simple-preview-image';
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.src = [
        '/images/workout-builder/goals/build-muscle.webp',
        '/images/meals/banana-oat-protein-smoothie.webp',
        '/images/foods/banana.webp'
      ][index];
      card.append(image);
      card.append(text('strong',key));
      (exampleCopy[language]?.[index] || rows).forEach((value,i) => {
        const row=document.createElement('span');
        row.className='simple-preview-row';
        row.style.setProperty('--row',i);
        const stage=document.createElement('small');
        stage.className='simple-preview-stage';
        stage.textContent=workflowStages[language]?.[index]?.[i] || workflowStages.en[index][i];
        const example=document.createElement('span');
        example.textContent=value;
        row.append(stage,example);
        card.append(row);
      });
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
    const core = tools(false);
    studio.before(core);
    studio.replaceWith(extra);
    // Keep IDs for localized/dashboard state updates, but put secondary tools after the core actions.
    const focus = document.querySelector('.daily-focus');
    if (focus) core.after(focus);
    document.querySelector('.daily-nutrition-spotlight')?.remove();
  }
  // A stable three-tool navigation also makes it easy to switch workflows.
  if (workoutForm || nutritionForm || document.querySelector('.daily-nutrition-route')) {
    const nav = document.createElement('nav'); nav.className='simple-tool-nav';
    nav.setAttribute('aria-label',copy('choose'));
    toolDefinitions.forEach(([key,,href]) => { const link=text('a',key);link.href=`/${href}`; if (location.pathname.endsWith(href)) link.setAttribute('aria-current','page');nav.append(link); });
    document.querySelector('main')?.prepend(nav);
  }
  window.FuelSimpleUI = {copy};
})();
