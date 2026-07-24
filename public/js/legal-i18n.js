const he = (localStorage.getItem("ofek-ai-language") || "en") === "he";
if (!he) { /* nothing to do */ } else {

document.documentElement.lang = "he";
document.documentElement.dir = "rtl";

/* ── Common nav + footer ── */
const navLinks = { "FAQ": "שאלות נפוצות", "Contact": "יצירת קשר", "Terms": "תנאים", "Privacy": "פרטיות" };
document.querySelectorAll(".legal-nav-links a").forEach(a => {
  if (navLinks[a.textContent.trim()]) a.textContent = navLinks[a.textContent.trim()];
});
const ftTagline = document.querySelector(".site-footer-tagline");
if (ftTagline) ftTagline.textContent = "התאמן חכם. אכול טוב. עקוב אחר הכל.";
const ftCopy = document.querySelector(".site-footer-copy");
if (ftCopy) ftCopy.textContent = "© 2026 FuelPhysique. כל הזכויות שמורות.";
const ftLinks = document.querySelectorAll(".site-footer-links a");
const footerHe = ["שאלות נפוצות","יצירת קשר","תנאי שימוש","מדיניות פרטיות","מדיניות מנויים","מדיניות החזר כספי"];
ftLinks.forEach((a, i) => { if (footerHe[i]) a.textContent = footerHe[i]; });

const page = location.pathname.replace(/.*\//, "").replace(/\.html.*/, "");

/* ══════════════════════════════════════════
   FAQ
══════════════════════════════════════════ */
if (page === "faq") {
  setHero("שאלות נפוצות", "Support", "תמיכה");
  const metaEl = document.querySelector(".legal-hero-meta");
  if (metaEl) metaEl.innerHTML = 'לא מצאת תשובה? <a href="/contact.html">צור קשר עם הצוות</a>.';

  const faqs = [
    ["מהי FuelPhysique?",
     "FuelPhysique היא פלטפורמת כושר מותאמת אישית המשלבת בניית תוכניות אימון, בניית תפריט תזונה, מעקב אימונים בזמן אמת, ומעקב התקדמות — הכל במקום אחד."],
    ["האם FuelPhysique חינמית?",
     'כן — FuelPhysique מציעה מסלול חינמי הכולל גישה למחולל תוכניות האימון, מחולל התזונה ומעקב האימונים. מינוי Pro פותח תכונות נוספות. ראה את <a href="/pricing.html">דף המסלולים</a> לפרטים.'],
    ["איך עובד המאמן הדיגיטלי?",
     "המאמן הדיגיטלי הוא עוזר שיחה חכם המאומן לענות על שאלות בנושאי כושר, תזונה ואסטרטגיית אימון. הוא משתמש בנתוני ה-Athlete Core שלך לתשובות מותאמות אישית."],
    ["מהו Athlete Core?",
     "Athlete Core הוא הפרופיל האישי שלך — גיל, מין, גובה, משקל, רמת כושר, מטרות, העדפות תזונה ומגבלות. המידע הזה מאפשר להפוך כל תוכנית לאישית ומדויקת. ניתן לעדכן בכל עת מהגדרות."],
    ["איך עובד מחולל תוכניות האימון?",
     "המחולל מדריך אותך שלב אחר שלב: בחירת מטרה, סגנון אימון, ציוד זמין, לוח זמנים ועדיפויות. בהתבסס על הבחירות, נוצרת תוכנית אימון מלאה עם תרגילים, סטים, חזרות וזמני מנוחה."],
    ["איך עובד מחולל התזונה?",
     "בדומה למחולל האימון, המחולל אוסף את המטרה, מדדי הגוף, רמת הפעילות, העדפות מזון ומגבלות תזונתיות. לאחר מכן הוא יוצר תוכנית תזונה יומית מותאמת עם יעדי קלוריות ופירוט מאקרו."],
    ["מהו מעקב האימונים?",
     "מעקב האימונים הוא כלי בזמן אמת לתיעוד אימונים תוך כדי ביצועם. הוא מציג סט אחד בכל פעם, מאפשר בחירת משקל, תיעוד חזרות ו-RPE, וכולל טיימר מנוחה מוגדר. כל האימונים שנשמרים מופיעים בהיסטוריה ובגרפי ההתקדמות."],
    ["מה אם פספסתי אימון ולא תיעדתי בזמן אמת?",
     'ניתן להשתמש בכלי <a href="/log-workout.html">תיעוד אימון קודם</a>. הוא משתמש באותו ממשק שלב-אחר-שלב, מאפשר הזנת משקלים וחזרות לכל סט, ושומר את האימון להיסטוריה.'],
    ["איך עובדת השוואת תמונות ההתקדמות?",
     'בדף <a href="/progress.html">התקדמות</a> ניתן להעלות תמונות חזית, צד וגב עם חותמת תאריך. לאורך הזמן ניתן לבחור שני תאריכים ולהשוות את התמונות זו לצד זו.'],
    ["האם הייעוץ של המאמן הוא ייעוץ רפואי?",
     "לא. FuelPhysique היא כלי כושר ובריאות, לא שירות רפואי. כל התוכן והמלצות הבינה המלאכותית הם למטרות מידע כללי בלבד ואינם מהווים ייעוץ רפואי. יש להתייעץ עם איש מקצוע לפני שינויים משמעותיים בתזונה או אימון."],
    ["האם ניתן להשתמש ב-FuelPhysique אם אני מתחת לגיל 18?",
     "משתמשים בגילאי 15–17 יכולים להשתמש ב-FuelPhysique במצב נוער, הדורש הצהרת הסכמת הורה או אפוטרופוס. משתמשים מתחת לגיל 15 אינם יכולים ליצור חשבון."],
    ["כיצד אני מבטל את המינוי?",
     'ניתן לנהל או לבטל את המינוי בכל עת מדף <a href="/app.html?settings=open">הגדרות</a> תחת "חיוב". הגישה לתכונות Pro נמשכת עד סוף תקופת החיוב הנוכחית.'],
    ["השאלה שלי לא ענית עליה — מה אעשה?",
     'פנה לצוות התמיכה בכתובת <a href="mailto:fuelphysiquesupport@gmail.com">fuelphysiquesupport@gmail.com</a> או בקר בדף <a href="/contact.html">יצירת קשר</a>. אנו מגיבים בדרך כלל תוך 1–2 ימי עסקים.'],
  ];
  document.querySelectorAll(".faq-item").forEach((item, i) => {
    if (!faqs[i]) return;
    const s = item.querySelector("summary");
    const a = item.querySelector(".faq-answer");
    if (s) s.innerHTML = faqs[i][0] + '<span style="float:left">+</span>';
    if (a) a.innerHTML = faqs[i][1];
  });
}

/* ══════════════════════════════════════════
   TERMS
══════════════════════════════════════════ */
if (page === "terms") {
  setHero("תנאי שימוש", "Legal", "משפטי");
  setMeta('עודכן לאחרונה: 20 ביולי 2026 · שאלות? <a href="/contact.html">צור קשר</a>');
  setHighlight("אנא קרא תנאים אלה בעיון לפני השימוש ב-FuelPhysique. יצירת חשבון או שימוש בפלטפורמה מהווים הסכמה לתנאים אלה.");
  const toc = document.querySelector(".legal-toc h2");
  if (toc) toc.textContent = "תוכן עניינים";
  const tocLinks = ["קבלת התנאים","זכאות","החשבון שלך","תיאור השירות","הצהרת בריאות","תוכן מבינה מלאכותית","שימוש מותר","קניין רוחני","סיום","הגבלת אחריות","שינויים בתנאים","יצירת קשר"];
  document.querySelectorAll(".legal-toc a").forEach((a, i) => { if (tocLinks[i]) a.textContent = tocLinks[i]; });
  translateSections([
    ["1. קבלת התנאים", 'בכניסה לשירות FuelPhysique או שימוש בו, אתה מסכים לתנאי שירות אלה ול<a href="/privacy.html">מדיניות הפרטיות</a> שלנו. אם אינך מסכים, אינך רשאי להשתמש בשירות.'],
    ["2. זכאות", "עליך להיות בן 15 לפחות על מנת להשתמש ב-FuelPhysique. משתמשים בגילאי 15–17 רשאים להשתמש בשירות במצב נוער בלבד, הדורש הצהרת הסכמת הורה או אפוטרופוס. משתמשים מתחת לגיל 15 אינם רשאים ליצור חשבון."],
    ["3. החשבון שלך", 'אתה אחראי על שמירת סודיות פרטי ההתחברות שלך ועל כל הפעילות המתרחשת תחת החשבון. עליך להודיע לנו מיידית בכתובת <a href="mailto:fuelphysiquesupport@gmail.com">fuelphysiquesupport@gmail.com</a> אם אתה חושד בשימוש בלתי מורשה. אין לשתף או למכור גישה לחשבונך.'],
    ["4. תיאור השירות", "<p>FuelPhysique מציעה:</p><ul><li>עוזר אימון מבוסס בינה מלאכותית</li><li>מחולל תוכניות אימון מותאמות אישית</li><li>מחולל תוכניות תזונה מותאמות אישית</li><li>מעקב אימונים בזמן אמת ויומן היסטוריה</li><li>מעקב התקדמות עם השוואת תמונות ואנליטיקה</li></ul><p>חלק מהתכונות דורשות מינוי Pro. אנו שומרים לעצמנו את הזכות לשנות את התכונות בכל מסלול עם הודעה סבירה.</p>"],
    ["5. הצהרת בריאות ורפואה", "<p><strong>FuelPhysique אינה שירות רפואי.</strong> כל התוכן וההמלצות הם למטרות מידע כללי ורווחה בלבד — ולא ייעוץ רפואי, אבחנה או טיפול.</p><p>לפני תחילת כל תוכנית אימון או תזונה, ובמיוחד אם יש לך מצב בריאותי קיים, התייעץ עם רופא מורשה או תזונאי קליני. אתה נוטל על עצמך אחריות מלאה לכל פעילות גופנית או שינוי תזונתי שאתה מבצע בהתבסס על השירות."],
    ["6. תוכן מבינה מלאכותית", "FuelPhysique משתמשת בבינה מלאכותית לצורך יצירת תוכניות ותשובות. תוכן שנוצר ע\"י AI עשוי להכיל שגיאות או הצעות שאינן מתאימות לכל אדם. יש להפעיל שיקול דעת עצמאי. FuelPhysique אינה אחראית לתוצאות שליליות הנובעות מהסתמכות על תוכן AI."],
    ["7. שימוש מותר", "<p>אתה מסכים לא:</p><ul><li>להשתמש בשירות למטרה בלתי חוקית</li><li>לנסות לבצע הנדסה לאחור, גרידת נתונים או העתקת השירות</li><li>להפריע לפעולת השירות</li><li>להפיץ ספאם, תוכנות זדוניות או תוכן מזיק</li><li>לייצג זהות כוזבת</li><li>לשתף, למכור או להעניק רישיון לגישה לחשבונך</li></ul><p>הפרת כללים אלה עלולה לגרום להשעיית החשבון מיידית ללא החזר כספי.</p>"],
    ["8. קניין רוחני", "כל התוכן, המיתוג, העיצוב והתוכנה של FuelPhysique הם רכושנו ומוגנים בחוקי קניין רוחני. אינך רשאי להעתיק או להפיץ חלק כלשהו מהשירות ללא אישור בכתב.<br><br>תוכן שאתה מעלה (כגון תמונות התקדמות) נשאר רכושך. בהעלאתו אתה מעניק ל-FuelPhysique רישיון מוגבל לאחסן ולהציג אותו אך ורק לצורך מתן השירות."],
    ["9. סיום", "ניתן למחוק את חשבונך בכל עת דרך ההגדרות. FuelPhysique שומרת לעצמה את הזכות להשעות או לסיים חשבונות המפרים את התנאים. עם סיום החשבון, הגישה לשירות מפסיקה מיידית."],
    ["10. הגבלת אחריות", "במידה המרבית המותרת על פי דין, FuelPhysique ומפעיליה לא יהיו אחראים לנזקים עקיפים, מקריים, מיוחדים או תוצאתיים הנובעים משימושך בשירות. השירות מסופק \"כפי שהוא\" ללא כל אחריות."],
    ["11. שינויים בתנאים", "אנו עשויים לעדכן תנאים אלה מעת לעת. שימוש מתמשך בשירות לאחר שינויים מהווה הסכמה לתנאים המעודכנים."],
    ["12. יצירת קשר", 'לשאלות בנוגע לתנאים אלה, פנה אלינו בכתובת <a href="mailto:fuelphysiquesupport@gmail.com">fuelphysiquesupport@gmail.com</a> או בקר ב<a href="/contact.html">דף יצירת קשר</a>.'],
  ]);
}

/* ══════════════════════════════════════════
   PRIVACY
══════════════════════════════════════════ */
if (page === "privacy") {
  setHero("מדיניות פרטיות", "Legal", "משפטי");
  setMeta('עודכן לאחרונה: 20 ביולי 2026 · שאלות? <a href="/contact.html">צור קשר</a>');
  setHighlight("הפרטיות שלך חשובה לנו. מדיניות זו מסבירה אילו נתונים אנו אוספים, כיצד אנו משתמשים בהם וכיצד ניתן לשלוט בהם.");
  translateSections([
    ["1. נתונים שאנו אוספים", "<h3>נתוני חשבון</h3><p>כתובת הדוא\"ל שלך ופרטי ההזדהות, המנוהלים בצורה מאובטחת דרך Firebase Authentication.</p><h3>נתוני פרופיל (Athlete Core)</h3><p>גיל, מין, גובה, משקל, מטרות כושר, רמת פעילות, העדפות תזונה ומצבים בריאותיים שתבחר לחשוף — כולם אופציונליים וניתנים לעריכה בכל עת.</p><h3>נתוני אימון ותזונה</h3><p>תוכניות אימון, אימונים מתועדים (תרגילים, סטים, משקלים, חזרות, RPE), תוכניות תזונה ופתקים.</p><h3>נתוני התקדמות</h3><p>מדדי גוף, יומן משקל ותמונות התקדמות שתעלה.</p>"],
    ["2. כיצד אנו משתמשים בנתונים שלך", "<ul><li>לצורך יצירת תוכניות אימון ותזונה מותאמות אישית ותשובות מאמן</li><li>לצורך אכלוס גרפי ההתקדמות והאנליטיקה שלך</li><li>לצורך שמירת היסטוריית האימונים והשוואת תמונות</li><li>לצורך תקשורת בנוגע לחשבון ובקשות תמיכה</li><li>לצורך שיפור איכות השירות</li></ul><p>אנו לא מוכרים, משכירים או משתפים את הנתונים האישיים שלך עם צדדים שלישיים לצורכי שיווק.</p>"],
    ["3. אחסון ואבטחת נתונים", "הנתונים שלך מאוחסנים בצורה מאובטחת ב-Google Firebase (Firestore ו-Firebase Storage), מוגנים על ידי הצפנת TLS בזמן העברה ובזמן מנוחה. כללי אבטחת Firebase מגבילים גישה לחשבון המאומת שלך בלבד."],
    ["4. שירותי צד שלישי", "<ul><li><strong>Google Firebase</strong> — הזדהות, מסד נתונים ואחסון קבצים.</li><li><strong>ספקי API של AI</strong> — לצורך הפעלת המאמן הדיגיטלי ויצירת תוכניות. רק נתוני פרופיל כושר נשלחים — ללא מידע מזהה מלא.</li><li><strong>Stripe</strong> — עיבוד תשלומים מאובטח. FuelPhysique לעולם לא שומרת פרטי כרטיס אשראי.</li></ul>"],
    ["5. תמונות התקדמות", "תמונות ההתקדמות שאתה מעלה מאוחסנות בתיקיית Firebase Storage הפרטית שלך ואינן נגישות לציבור. הן גלויות אליך בלבד כאשר אתה מחובר. אנו לא משתמשים בתמונות שלך לכל מטרה אחרת מלבד הצגתן בשירות."],
    ["6. הזכויות שלך", "<p>יש לך את הזכות:</p><ul><li>לגשת לנתונים שאנו מחזיקים עליך</li><li>לתקן נתונים שגויים (דרך הגדרות)</li><li>למחוק את חשבונך וכל הנתונים הקשורים אליו</li><li>לייצא את הנתונים שלך — פנה אלינו לבקשת ייצוא</li></ul><p>לצורך מימוש זכויות אלה, פנה אלינו בכתובת <a href=\"mailto:fuelphysiquesupport@gmail.com\">fuelphysiquesupport@gmail.com</a>.</p>"],
    ["7. קטינים", "FuelPhysique לא אוספת ביודעין נתונים ממשתמשים מתחת לגיל 15. משתמשים בגילאי 15–17 רשאים להשתמש בשירות עם הסכמת הורה. אם אתה סבור שקטין נרשם ללא הסכמה, פנה אלינו ואנו נמחק את החשבון."],
    ["8. יצירת קשר", 'לשאלות פרטיות: <a href="mailto:fuelphysiquesupport@gmail.com">fuelphysiquesupport@gmail.com</a>'],
  ]);
}

/* ══════════════════════════════════════════
   SUBSCRIPTION POLICY
══════════════════════════════════════════ */
if (page === "subscription-policy") {
  setHero("מדיניות מנויים", "Legal", "משפטי");
  setMeta("עודכן לאחרונה: 20 ביולי 2026");
  translateSections([
    ["1. מסלולים ותמחור", "<h3>מסלול חינמי</h3><ul><li>גישה למחולל תוכניות האימון והתזונה</li><li>מעקב אימונים בזמן אמת</li><li>מעקב התקדמות בסיסי</li><li>מספר מוגבל של הודעות מאמן AI בחודש</li></ul><h3>מסלול Pro</h3><ul><li>יצירת תוכניות אימון ותזונה ללא הגבלה</li><li>הודעות מאמן AI ללא הגבלה</li><li>העלאת תמונות התקדמות והשוואה זו לצד זו</li><li>אנליטיקה וגרפי התקדמות מתקדמים</li><li>תמיכה מועדפת</li></ul><p>התמחור הנוכחי מופיע ב<a href='/pricing.html'>דף המסלולים</a>. מחירים עשויים להשתנות עם הודעה של 30 יום למנויים קיימים.</p>"],
    ["2. חיוב", "מנויי Pro מחויבים על בסיס חוזר (חודשי או שנתי, בהתאם למסלול שנבחר). התשלום מעובד בצורה מאובטחת דרך Stripe. המינוי מתחדש אוטומטית בסוף כל תקופת חיוב."],
    ["3. ביטול", 'ניתן לבטל את מינוי ה-Pro בכל עת דרך <a href="/app.html?settings=open">הגדרות</a> תחת "חיוב". הביטול נכנס לתוקף בסוף תקופת החיוב הנוכחית. לא מוחזרים כספים על זמן שלא נוצל, למעט כמפורט ב<a href="/refund-policy.html">מדיניות ההחזרים</a>.'],
    ["4. שדרוג לאחור", "כאשר מינוי ה-Pro שלך מסתיים, חשבונך חוזר למסלול החינמי. הנתונים שלך נשמרים לפחות 90 יום ונגישים כאשר אתה מחדש את המינוי."],
    ["5. תשלומים שנכשלו", "אם תשלום נכשל, ננסה לחייב שוב. אם לא ניתן לגבות את התשלום, הגישה לתכונות Pro תושהה עד לפתרון הבעיה. תקבל הודעה בדוא\"ל על כל תשלום שנכשל."],
    ["6. שינויים במסלולים", "FuelPhysique שומרת לעצמה את הזכות לשנות, להוסיף או להסיר תכונות ממסלול כלשהו. מנויים קיימים יקבלו הודעה מוקדמת של 30 יום לפחות על שינויים מהותיים."],
    ["7. יצירת קשר", 'לשאלות חיוב: <a href="mailto:fuelphysiquesupport@gmail.com">fuelphysiquesupport@gmail.com</a>'],
  ]);
}

/* ══════════════════════════════════════════
   REFUND POLICY
══════════════════════════════════════════ */
if (page === "refund-policy") {
  setHero("מדיניות החזר כספי", "Legal", "משפטי");
  setMeta("עודכן לאחרונה: 20 ביולי 2026");
  setHighlight("אנו רוצים שתהיה מרוצה מ-FuelPhysique. אם לא, כך פועל תהליך ההחזר שלנו.");
  translateSections([
    ["1. אחריות החזרת כסף של 7 ימים", 'אם נרשמת ל-FuelPhysique Pro ואינך מרוצה מכל סיבה שהיא, תוכל לבקש החזר מלא תוך <strong>7 ימים</strong> מהרכישה הראשונה. ההצעה חלה על מנויים חדשים ב-Pro בלבד.<br><br>לבקשת החזר שלח דוא"ל ל<a href="mailto:fuelphysiquesupport@gmail.com">fuelphysiquesupport@gmail.com</a> עם הנושא "בקשת החזר כספי" וכלול את כתובת הדוא"ל של חשבונך.'],
    ["2. חיובי חידוש", "חיובי חידוש מנוי אינם ניתנים להחזר בדרך כלל. אם התכוונת לבטל לפני חידוש וחויבת, פנה אלינו תוך 48 שעות מהחיוב ונבחן את הבקשה."],
    ["3. נסיבות אחרות", "<p>אנו עשויים להנפיק החזרים בנסיבות מיוחדות, כולל:</p><ul><li>שגיאת חיוב או שגיאה טכנית מצדנו</li><li>הפסקת שירות ממושכת של יותר מ-72 שעות</li><li>חיוב כפול</li></ul><p>לא יוחזרו כספים בגין חוסר שביעות רצון מתוכן שנוצר ע\"י AI בלבד.</p>"],
    ["4. תהליך ההחזר", "החזרים מאושרים מעובדים דרך Stripe ומופיעים בדרך כלל תוך 5–10 ימי עסקים, בהתאם לבנק או לחברת האשראי. המינוי יבוטל בעת מתן ההחזר."],
    ["5. יצירת קשר", 'לבקשות החזר: <a href="mailto:fuelphysiquesupport@gmail.com">fuelphysiquesupport@gmail.com</a>'],
  ]);
}

/* ══════════════════════════════════════════
   CONTACT
══════════════════════════════════════════ */
if (page === "contact") {
  setHero("יצירת קשר", "Support", "תמיכה");
  const metaEl = document.querySelector(".legal-hero-meta");
  if (metaEl) metaEl.textContent = "הצוות שלנו מגיב בדרך כלל תוך 1–2 ימי עסקים.";

  const emailCard = document.querySelector(".contact-email-text strong");
  if (emailCard) emailCard.textContent = "דוא\"ל תמיכה";
  const contactNote = document.querySelector(".contact-note");
  if (contactNote) contactNote.textContent = "הצוות ישיב להודעתך בהקדם האפשרי.";

  // Section heading
  const sectionH2 = document.querySelector(".legal-section h2");
  if (sectionH2) sectionH2.textContent = "שלח לנו הודעה";

  // Form labels
  const labels = { "cn": "שמך", "ce": "כתובת דוא\"ל", "cs": "נושא", "cm": "הודעה" };
  Object.entries(labels).forEach(([id, text]) => {
    const input = document.getElementById(id);
    if (input && input.previousElementSibling) input.previousElementSibling.textContent = text;
  });

  // Select options
  const sel = document.getElementById("cs");
  if (sel) {
    const opts = ["בחר נושא...","שאלה כללית","חיוב או מינוי","בקשת החזר כספי","בעיה טכנית / באג","בקשת תכונה","מחיקת חשבון","אחר"];
    [...sel.options].forEach((o, i) => { if (opts[i]) o.text = opts[i]; });
  }

  // Placeholder
  const cm = document.getElementById("cm");
  if (cm) cm.placeholder = "תאר את שאלתך או הבעיה שלך בפירוט...";

  const csbtn = document.getElementById("csbtn");
  if (csbtn) csbtn.textContent = "שלח הודעה";
  const cres = document.getElementById("cres");
  if (cres) cres.textContent = "ההודעה נפתחה באפליקציית הדוא\"ל שלך. ניצור איתך קשר בקרוב.";

  // Before you write section
  const sections = document.querySelectorAll(".legal-section");
  if (sections[1]) {
    const h2 = sections[1].querySelector("h2");
    if (h2) h2.textContent = "לפני שאתה כותב";
    const p = sections[1].querySelector("p");
    if (p) p.innerHTML = 'תשובות לשאלות נפוצות רבות ניתן למצוא ב<a href="/faq.html">שאלות נפוצות</a>. ראה גם:<br><a href="/terms.html">תנאי שימוש</a> · <a href="/privacy.html">מדיניות פרטיות</a> · <a href="/subscription-policy.html">מדיניות מנויים</a> · <a href="/refund-policy.html">מדיניות החזר כספי</a>';
  }
}

/* ── Helpers ── */
function setHero(title, badgeEn, badgeHe) {
  const h1 = document.querySelector(".legal-hero h1");
  if (h1) h1.textContent = title;
  const badge = document.querySelector(".legal-badge");
  if (badge && badge.textContent.trim() === badgeEn) badge.textContent = badgeHe;
}
function setMeta(html) {
  const el = document.querySelector(".legal-hero-meta");
  if (el) el.innerHTML = html;
}
function setHighlight(text) {
  const el = document.querySelector(".legal-highlight");
  if (el) el.textContent = text;
}
function translateSections(pairs) {
  const sections = document.querySelectorAll(".legal-section");
  sections.forEach((section, i) => {
    if (!pairs[i]) return;
    const [title, content] = pairs[i];
    const h2 = section.querySelector("h2");
    if (h2) h2.innerHTML = h2.innerHTML.replace(/\d+\.\s.*/, title);
    // Replace content: everything after h2
    const contentEls = [...section.children].filter(el => el.tagName !== "H2");
    if (contentEls.length) {
      contentEls.forEach(el => el.remove());
      const div = document.createElement("div");
      div.innerHTML = content;
      section.appendChild(div);
    }
  });
}

} // end if(he)
