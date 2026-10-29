import {accountPreferenceUserId, chooseDemonstrationModel, onDemonstrationChange,
  startDemonstrationPreference} from './exercise-demo-preference.js';

const key = 'fp_personalization_onboarding_uid';
let dialog, owner, completedLocally;
function pending(uid) {
  try { return !!uid && sessionStorage.getItem(key) === uid; } catch { return false; }
}
function refresh() {
  const uid = accountPreferenceUserId();
  if (dialog && uid !== owner) { dialog.close(); dialog.remove(); dialog = null; }
  if (dialog || uid === completedLocally || !pending(uid)) return;
  owner = uid;
  if (!document.querySelector('link[data-onboarding-style]')) {
    const link = document.createElement('link'); link.rel = 'stylesheet';
    link.href = '/css/personalization-onboarding.css'; link.dataset.onboardingStyle = '';
    document.head.append(link);
  }
  const he = document.documentElement.lang === 'he';
  dialog = document.createElement('dialog'); dialog.className = 'personalization-onboarding';
  dialog.dir = he ? 'rtl' : 'ltr'; dialog.setAttribute('aria-labelledby', 'personalizationTitle');
  dialog.innerHTML = `<form><p class="onboarding-brand">FUELPHYSIQUE</p>
    <h2 id="personalizationTitle">${he ? 'כדי שנתחיל, מהו המגדר שלך?' : 'To get started, what is your gender?'}</h2>
    <p>${he ? 'נתאים לך את התמונות ואת הפנייה באתר. אפשר לשנות זאת בהגדרות בכל עת.' : 'We’ll personalize your visuals and how we address you. You can change this in Settings anytime.'}</p>
    <fieldset><legend class="onboarding-sr-only">${he ? 'בחירת מגדר' : 'Gender selection'}</legend>
    <div class="onboarding-options">${[['male',he?'גבר':'Male'],['female',he?'אישה':'Female']].map(([value,label])=>`
      <label class="onboarding-option"><input type="radio" name="preference" value="${value}">
      <span class="onboarding-photo"><img src="/assets/onboarding/${value}.webp" alt="" width="480" height="640"><span class="onboarding-check" aria-hidden="true">✓</span></span><strong>${label}</strong></label>`).join('')}</div>
    <label class="onboarding-neutral"><input type="radio" name="preference" value="default">${he?'ללא העדפה':'No preference'}</label></fieldset>
    <button class="onboarding-continue" type="submit" disabled>${he?'המשך':'Continue'}</button>
    <p class="onboarding-status" role="status"></p></form>`;
  const current = dialog;
  current.addEventListener('cancel', event => event.preventDefault());
  const form = current.querySelector('form'), submit = form.querySelector('button');
  form.addEventListener('change', () => { submit.disabled = false; });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (submit.disabled || accountPreferenceUserId() !== uid) return;
    const value = new FormData(form).get('preference');
    if (!['male','female','default'].includes(value)) return;
    submit.disabled = true;
    current.querySelectorAll('input').forEach(input => { input.disabled = true; });
    // Firestore may queue an offline write indefinitely. Apply locally first,
    // but never leave the mandatory dialog locked on an unavailable network.
    let timer;
    const saved = await Promise.race([
      chooseDemonstrationModel(value),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), 6000); })
    ]).finally(() => clearTimeout(timer));
    completedLocally = uid;
    if (saved) { try { if (sessionStorage.getItem(key) === uid) sessionStorage.removeItem(key); } catch {} }
    if (!saved && uid === accountPreferenceUserId()) {
      const notice = document.createElement('p'); notice.setAttribute('role','status');
      notice.className = 'onboarding-sync-notice';
      notice.textContent = he ? 'הבחירה הוחלה בדפדפן. סנכרון החשבון אינו זמין כרגע; ניתן לעדכן בהגדרות.' : 'Applied in this browser. Account sync is unavailable; you can update it in Settings.';
      document.querySelector('main')?.prepend(notice);
    }
    current.close(); current.remove(); if (dialog === current) dialog = null;
  });
  document.body.append(current); current.showModal();
}
onDemonstrationChange(refresh);
startDemonstrationPreference();
refresh();
