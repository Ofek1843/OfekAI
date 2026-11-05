import { fetchWithDeadline } from './request-deadline.mjs';
import { builderErrorMessage } from './builder-errors.mjs';
import { mountHealthScreening } from './health-screening.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const planFingerprint = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object'
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

// This module never identifies a document from API output or a shared-plan owner.
// Firestore rules still enforce ownership; the transaction also rejects stale tabs.
export async function persistSavedPlan({ kind, saved, user, previousPlan, nextPlan }) {
  const [{ auth, db }, firestore] = await Promise.all([
    import('./firebase-config.js'), import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js')
  ]);
  return commitSavedPlan({ kind, saved, user, previousPlan, nextPlan }, { auth, db, ...firestore });
}

export async function commitSavedPlan({ kind, saved, user, previousPlan, nextPlan }, { auth, db, doc, runTransaction, serverTimestamp }) {
  if (!user?.uid || auth.currentUser?.uid !== user.uid || !saved.id || !['workout', 'nutrition'].includes(kind)) throw new Error('SESSION_CHANGED');
  const ref = doc(db, 'users', user.uid, kind === 'workout' ? 'workoutPlans' : 'nutritionPlans', saved.id);
  await runTransaction(db, async transaction => {
    if (auth.currentUser?.uid !== user.uid) throw new Error('SESSION_CHANGED');
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists() || planFingerprint(snapshot.data().plan) !== planFingerprint(previousPlan)) throw new Error('PLAN_CHANGED');
    transaction.update(ref, { plan: nextPlan, updatedAt: serverTimestamp() });
  });
}

async function requestReplacement({ kind, payload, user, language, signal }) {
  const response = await fetchWithDeadline(`/api/${kind}-builder/reroll-${kind === 'workout' ? 'exercise' : 'meal'}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(payload), signal
  }, { language });
  const data = await response.json();
  if (!response.ok) throw new Error(builderErrorMessage({ status: response.status, data, language }));
  return data;
}

export async function replaceSavedPlan({ kind, saved, user, target, context, language = 'en', program, signal,
  request = requestReplacement, persist = persistSavedPlan }) {
  if (!user?.uid || !saved?.id) throw new Error('SESSION_CHANGED');
  if (signal?.aborted) throw new DOMException('Closed', 'AbortError');
  const previousPlan = clone(saved.plan), current = clone(program || previousPlan);
  // Consent/suitability is answered explicitly in the open dialog, never inferred
  // from having a saved plan. No new health answers are stored in the document.
  if (context?.screeningStatus !== 'none') throw new Error(language === 'he'
    ? 'במצב הזה נדרשת בדיקה אישית של איש מקצוע מוסמך.' : 'Individual professional review is required for this situation.');
  let payload;
  if (kind === 'workout') {
    const exercise = current.sessions?.[target.sessionIndex]?.exercises?.[target.exerciseIndex];
    if (!exercise || !Number.isInteger(context.age) || context.age < 18 || context.age > 100 || !context.equipment?.length) throw new Error('INVALID_REPLACEMENT_SETTINGS');
    payload = { ...context, ...target, program: current, language,
      muscleFocusMode: current.muscleFocusMode, selectedMuscles: current.selectedMuscles };
  } else if (kind === 'nutrition') {
    const meal = current.meals?.find(item => item.mealNumber === target.mealNumber);
    if (!meal?.options?.some(item => item.optionNumber === target.optionNumber)) throw new Error('INVALID_MEAL');
    // The server balances option #1. Promote and renumber explicit selections
    // before requesting a swap, so a hidden alternative is never balanced instead.
    const chosen = meal.options.find(option => Number(option.optionNumber) === Number(current.selectedOptionNumbers?.[meal.mealNumber])) || meal.options[0];
    if (chosen.optionNumber !== target.optionNumber) throw new Error('INVALID_MEAL');
    for (const item of current.meals) {
      const index = item.options?.findIndex(option => Number(option.optionNumber) === Number(current.selectedOptionNumbers?.[item.mealNumber]));
      if (index > 0) item.options.unshift(...item.options.splice(index, 1));
      item.options?.forEach((option, i) => { option.optionNumber = i + 1; });
    }
    delete current.selectedOptionNumbers;
    payload = { screeningStatus: context.screeningStatus, mealNumber: target.mealNumber, optionNumber: 1, plan: current, language };
  } else throw new Error('INVALID_PLAN_KIND');
  const data = await request({ kind, payload: clone(payload), user, language, signal });
  if (signal?.aborted) throw new DOMException('Closed', 'AbortError');
  let nextPlan;
  if (kind === 'workout') {
    const old = current.sessions[target.sessionIndex].exercises[target.exerciseIndex];
    if (!data.exercise?.exerciseId || data.exercise.exerciseId === old.exerciseId) throw new Error('NO_ALTERNATIVE');
    // Save only the requested exercise; normalization for API review must not
    // silently rewrite other exercises, recipient information or programming.
    nextPlan = clone(previousPlan);
    nextPlan.sessions[target.sessionIndex].exercises[target.exerciseIndex] = data.exercise;
    nextPlan.replacementPreferences = { equipment: [...context.equipment], trainingStyle: context.trainingStyle,
      goal: context.goal, experience: context.experience };
  } else {
    if (!Array.isArray(data.plan?.meals) || !data.option) throw new Error('INVALID_MEAL_RESPONSE');
    const original = current.meals.find(item => item.mealNumber === target.mealNumber).options[0];
    if ((original.mealId && original.mealId === data.option.mealId) || planFingerprint(original) === planFingerprint(data.option)) throw new Error('NO_ALTERNATIVE');
    // The balanced response may change portions in other meals. Persist it as
    // a whole, retaining selections and all recipient/dietary metadata.
    nextPlan = { ...previousPlan, ...data.plan };
    delete nextPlan.selectedOptionNumbers;
  }
  await persist({ kind, saved, user, previousPlan, nextPlan });
  saved.plan = nextPlan;
  return { plan: nextPlan, weeklyVolume: data.weeklyVolume };
}

// Shared, short confirmation UI. Settings live only for the lifetime of this
// viewer. Opening a saved plan alone never starts generation or a Firestore write.
export function mountSavedReplacement(dialog, { kind, saved, user, language = 'en', replace, onSaved = () => {} }) {
  if (!user?.uid || !saved?.id) return null;
  if (!document.querySelector('link[data-saved-replacement-style]')) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/css/saved-plan-replacement.css';
    link.dataset.savedReplacementStyle = ''; document.head.append(link);
  }
  const he = language === 'he', controller = new AbortController();
  const panel = document.createElement('section'); panel.className = 'saved-replacement-panel'; panel.hidden = true;
  const prefs = saved.plan.replacementPreferences || saved.plan;
  const equipmentAliases = { dumbbells:'dumbbell', machines:'machine', cables:'cable', kettlebells:'kettlebell', 'pull-upbar':'pullupbar', parallelbars:'parallelbar' };
  const selectedEquipment = new Set((Array.isArray(prefs.equipment) ? prefs.equipment : []).map(value => {
    const key = String(value).toLowerCase().replace(/[\s/_]/g, ''); return equipmentAliases[key] || key;
  }));
  const equipment = [
    ['bodyweight','Bodyweight','משקל גוף'],['dumbbell','Dumbbells','משקולות יד'],['barbell','Barbell','מוט'],
    ['machine','Machines','מכשירים'],['cable','Cables','כבלים'],['pullupbar','Pull-up bar','מתח'],
    ['rings','Rings','טבעות'],['kettlebell','Kettlebells','קטלבל'],['parallelbar','Parallel bars','מקבילים'],['romanchair','Back extension bench','ספסל פשיטת גב']
  ];
  const select = (name, label, items, value) => `<label>${label}<select required name="${name}"><option value="">${he?'בחרו':'Choose'}</option>${items.map(([key,en,iw]) => `<option value="${key}"${key === value?' selected':''}>${he?iw:en}</option>`).join('')}</select></label>`;
  panel.innerHTML = `<form><h3>${he?'החלפה בתוכנית השמורה':'Replace in your saved plan'}</h3><p data-replacement-target></p>
    ${kind === 'workout' ? `<div class="saved-replacement-fields"><label>${he?'גיל מקבל/ת התוכנית':'Plan recipient age'}<input name="age" type="number" min="18" max="100" step="1" required value="${Number.isInteger(saved.plan.age)?esc(saved.plan.age):''}"></label>
      ${select('goal',he?'מטרה':'Goal',[['buildMuscle','Build muscle','בניית שריר'],['loseFat','Lose fat','חיטוב'],['maintainPerformance','Maintain muscle','שימור שריר'],['increaseStrength','Strength','כוח'],['improveSkills','Calisthenics','קליסטניקס']],prefs.goal)}
      ${select('experience',he?'רמת ניסיון':'Experience',[['beginner','Beginner','מתחילים'],['intermediate','Intermediate','בינוני'],['advanced','Advanced','מתקדמים'],['professional','Professional athlete','ספורטאים מקצועיים']],prefs.experience)}</div>
      <fieldset class="saved-replacement-equipment"><legend>${he?'ציוד שזמין כעת — אפשר להסיר מכשיר תפוס':'Equipment available now — uncheck a busy machine'}</legend>${equipment.map(([value,en,iw])=>`<label><input type="checkbox" name="equipment" value="${value}"${selectedEquipment.has(value)?' checked':''}> ${he?iw:en}</label>`).join('')}</fieldset>
      <label>${he?'מגבלות תנועה (אם יש)':'Movement limitations (if any)'}<input name="limitations" value="${esc(saved.plan.limitations || '')}" maxlength="1000"></label>` : `<p>${he?'הארוחות והכמויות עשויות להתאזן מחדש כדי לשמור על היעדים וההעדפות השמורים.':'Meals and portions may be rebalanced to keep your saved targets and dietary preferences.'}</p>`}
    <div class="saved-replacement-actions"><button type="submit">${he?'החלפה ושמירה':'Replace and save'}</button><button type="button" data-cancel-replacement>${he?'ביטול':'Cancel'}</button></div></form>`;
  mountHealthScreening(panel.querySelector('form'), language);
  const content = dialog.querySelector('[data-content], .saved-nutrition-body');
  // An overlay inside the existing dialog keeps the plan layout and scrolling intact.
  dialog.append(panel);
  const status = document.createElement('p'); status.className = 'saved-replacement-status'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  dialog.querySelector('header').after(status);
  let pending, trigger, busy = false;
  const setStatus = message => {
    status.textContent = message;
    if (panel.hidden) dialog.querySelector('header').after(status);
    else form.querySelector('h3').after(status);
  };
  const closePanel = () => {
    panel.hidden = true; content.inert = false; dialog.querySelector('header').after(status);
    if (trigger?.isConnected) trigger.focus();
    else if (trigger?.hasAttribute('data-replace-exercise')) content.querySelector(`[data-session-index="${trigger.dataset.sessionIndex}"][data-replace-exercise="${trigger.dataset.replaceExercise}"]`)?.focus();
    else content.querySelector(`[data-replace-meal="${trigger?.dataset.replaceMeal}"]`)?.focus();
  };
  panel.querySelector('[data-cancel-replacement]').onclick = closePanel;
  const form = panel.querySelector('form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    const fields = new FormData(form), chosen = fields.getAll('equipment');
    if (kind === 'workout' && !chosen.length) {
      setStatus(he?'בחרו לפחות סוג ציוד אחד.':'Choose at least one equipment type.'); return;
    }
    const context = { screeningStatus: fields.get('screeningStatus') };
    if (kind === 'workout') Object.assign(context, { age: Number(fields.get('age')), goal: fields.get('goal'),
      experience: fields.get('experience'), equipment: chosen, trainingStyle: 'hybrid', limitations: fields.get('limitations') || '' });
    busy = true; form.querySelectorAll('button,input,select').forEach(element => { element.disabled = true; });
    setStatus(he?'מחליף ושומר…':'Replacing and saving…');
    try {
      await replace(pending, context, controller.signal);
      if (!dialog.isConnected) return;
      closePanel();
      setStatus(he?'ההחלפה נשמרה בתוכנית.':'Replacement saved to your plan.');
      try { onSaved(); } catch { /* Parent summary refresh cannot undo a saved replacement. */ }
    } catch (error) {
      if (!dialog.isConnected) return;
      const messages = {
        PLAN_CHANGED: he?'התוכנית השתנתה בחלון אחר. סגרו ופתחו אותה מחדש לפני ניסיון נוסף.':'This plan changed in another tab. Close and reopen it before trying again.',
        SESSION_CHANGED: he?'החיבור השתנה. התחברו מחדש.':'Your session changed. Please sign in again.',
        NO_ALTERNATIVE: he?'לא נמצאה חלופה מתאימה. התוכנית לא שונתה.':'No suitable alternative was found. Your plan is unchanged.'
      };
      setStatus(messages[error.message] || (error.code === 'permission-denied' ? messages.SESSION_CHANGED
        : he?'לא ניתן היה לשמור את ההחלפה. התוכנית לא שונתה. בדקו את הפרטים ונסו שוב.':'Could not save the replacement. Your plan is unchanged. Check your settings and try again.'));
      // Show useful existing server validation/auth errors without exposing raw SDK details.
      if (!messages[error.message] && !error.code && !/^[A-Z_]+$/.test(error.message)) setStatus(error.message);
      panel.scrollTop = 0;
    } finally {
      busy = false; form.querySelectorAll('button,input,select').forEach(element => { element.disabled = false; });
    }
  });
  dialog.addEventListener('close', () => controller.abort(), { once: true });
  dialog.addEventListener('cancel', event => { if (!panel.hidden) { event.preventDefault(); if (!busy) closePanel(); } });
  return {
    open(target, button, label) {
      if (busy) return;
      pending = target; trigger = button;
      panel.querySelector('[data-replacement-target]').textContent = label;
      panel.hidden = false; content.inert = true; setStatus(''); form.querySelector('select,input,button')?.focus();
    }
  };
}
