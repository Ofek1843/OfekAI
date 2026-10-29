import {accountPreference, accountPlanningDefaults, accountIsSignedIn,
  onDemonstrationChange, startDemonstrationPreference} from './exercise-demo-preference.js';

// Account defaults initialize a new session only. Restored drafts and edits win.
const touched = new WeakSet();
const initialized = new WeakSet();
const params = new URLSearchParams(location.search);
const restoring = ['resumeGuest', 'edit', 'planId', 'id'].some(key => params.has(key));
document.addEventListener('input', event => touched.add(event.target), true);
document.addEventListener('change', event => touched.add(event.target), true);
const copy = new Map([
  ['איך אתה מעדיף להתאמן?', ['איך את מעדיפה להתאמן?', 'איך אתה מעדיף להתאמן?', 'מה סגנון האימון המועדף?']],
  ['כמה אתה פעיל?', ['כמה את פעילה?', 'כמה אתה פעיל?', 'מה רמת הפעילות?']],
  ['באילו ימים אתה פנוי?', ['באילו ימים את פנויה?', 'באילו ימים אתה פנוי?', 'אילו ימים זמינים לאימון?']],
  ['בחר מטרה', ['בחרי מטרה', 'בחר מטרה', 'בחירת מטרה']],
  ['בחר רמת פעילות', ['בחרי רמת פעילות', 'בחר רמת פעילות', 'בחירת רמת פעילות']],
  ['בחר את התוצאה שהתוכנית צריכה להציב בראש סדר העדיפויות.', ['בחרי את התוצאה שהתוכנית צריכה להציב בראש סדר העדיפויות.', 'בחר את התוצאה שהתוכנית צריכה להציב בראש סדר העדיפויות.', 'מה התוצאה הרצויה מהתוכנית?']],
  ['בחר את סביבת וסגנון האימון שאתה נהנה מהם יותר.', ['בחרי את סביבת וסגנון האימון שאת נהנית מהם יותר.', 'בחר את סביבת וסגנון האימון שאתה נהנה מהם יותר.', 'בחירת סביבת האימון וסגנון התנועה המועדפים.']],
  ['התאם את התוכנית לשבוע שלך', ['התאימי את התוכנית לשבוע שלך', 'התאם את התוכנית לשבוע שלך', 'התאמת התוכנית לשבוע שלך']],
  ['ציין כמה פעמים, כמה זמן ובאילו ימים אתה יכול להתאמן.', ['צייני כמה פעמים, כמה זמן ובאילו ימים את יכולה להתאמן.', 'ציין כמה פעמים, כמה זמן ובאילו ימים אתה יכול להתאמן.', 'תדירות, משך וימי האימון הזמינים.']],
  ['מתאמן באופן עקבי עם טכניקה טובה', ['מתאמנת באופן עקבי עם טכניקה טובה', 'מתאמן באופן עקבי עם טכניקה טובה', 'אימון עקבי וטכניקה טובה']]
]);
function refresh() {
  const preference = accountIsSignedIn() ? accountPreference() : 'default';
  const index = preference === 'female' ? 0 : preference === 'male' ? 1 : 2;
  document.querySelectorAll('[data-he][data-en]').forEach(element => {
    const variants = copy.get(element.dataset.he);
    if (variants && !element.children.length) element.textContent = document.documentElement.lang === 'he' ? variants[index] : element.dataset.en;
  });
  if (!accountIsSignedIn() || restoring) return;
  const defaults = accountPlanningDefaults();
  const form = document.querySelector('#workout-builder-form, #nutrition-builder-form, #targetForm');
  if (!form) return;
  const fields = {...defaults};
  // The nutrition coefficient is intentionally excluded: address is not physiology.
  if (form.id === 'workout-builder-form' && preference !== 'default') fields.gender = preference;
  for (const [name, value] of Object.entries(fields)) {
    const field = form.querySelector(`#${name}`);
    if (!field || touched.has(field) || initialized.has(field)) continue;
    const untouchedExample = form.id === 'targetForm' && field.value === field.defaultValue;
    if (field.value !== '' && !untouchedExample) continue;
    field.value = String(value);
    initialized.add(field);
    if (form.id !== 'targetForm') field.dispatchEvent(new Event('change', {bubbles:true}));
  }
}
onDemonstrationChange(refresh);
new MutationObserver(refresh).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
startDemonstrationPreference();
refresh();
