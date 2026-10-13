import { exerciseImageUrl, fallbackExerciseImageUrl } from './exercise-image.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const muscles = { chest:'חזה',back:'גב',delts:'כתפיים',rear_delts:'כתף אחורית',biceps:'יד קדמית',triceps:'יד אחורית',quads:'ארבע ראשי',hamstrings:'ירך אחורית',glutes:'ישבן',calves:'תאומים',core:'ליבה',traps:'טרפז',adductors:'מקרבים',abductors:'מרחיקים' };
export function workoutReviewMarkup(program, weeklyVolume, language = 'en') {
  const he = language === 'he';
  const sessions = program.sessions || [];
  const volume = weeklyVolume ? `<section class="saved-volume"><h3>${he?'סטים שבועיים לפי שריר':'Weekly sets by muscle'}</h3>
    <p>${he?'סטים ישירים בתוספת תרומה חלקית מתרגילים מורכבים. הטווח הוא יעד תכנוני, בהתאם לניסיון ולמטרה.':'Direct sets plus partial contributions from compound exercises. The target range depends on experience and goal.'}</p>
    ${weeklyVolume.assumedExperience?`<p>${he?'לא נשמרה רמת ניסיון; הטווחים מוצגים עבור מתאמן בינוני.':'No experience level was saved; ranges use an intermediate profile.'}</p>`:''}
    ${weeklyVolume.unknownExercises?`<p role="status">${he?'החישוב חלקי: יש תרגילים ללא מיפוי שריר.':'Partial calculation: some exercises have no muscle mapping.'}</p>`:''}
    ${weeklyVolume.unknownExercises?`<p>${esc(sessions.flatMap(s=>s.exercises||[]).filter(e=>!e.exerciseId).map(e=>e.name||e.exerciseName||e.exercise).join(', '))}</p>`:''}
    <div class="saved-volume-grid">${Object.entries(weeklyVolume.perMuscle).map(([key, entry]) => {
      const within = entry.total >= entry.preferredMin && entry.total <= entry.preferredMax;
      const status = weeklyVolume.unknownExercises ? (he?'חלקי':'Incomplete') : within ? (he?'בטווח היעד':'Within target') : entry.total < entry.preferredMin ? (he?'מתחת ליעד':'Below target') : (he?'מעל ליעד':'Above target');
      return `<article class="saved-volume-row"><header><strong>${esc(he?muscles[key]||key:key.replaceAll('_',' '))}</strong><span class="volume-status ${within&&!weeklyVolume.unknownExercises?'within':''}">${status}</span></header><b>${esc(Math.round(entry.total*10)/10)} ${he?'סטים בשבוע':'sets / week'}</b><span>${he?'טווח יעד':'Target'}: ${esc(entry.preferredMin)}–${esc(entry.preferredMax)}</span><meter min="0" max="${Math.max(entry.hardMaximum,entry.total,1)}" low="${entry.preferredMin}" high="${entry.preferredMax}" optimum="${(entry.preferredMin+entry.preferredMax)/2}" value="${entry.total}" aria-label="${esc(key)}"></meter><small>${esc(entry.direct)} ${he?'ישירים':'direct'} + ${esc(entry.fractional)} ${he?'עקיפים משוקללים':'weighted indirect'}</small></article>`;
    }).join('')}</div></section>` : '';
  return `<div class="saved-workout-content">${sessions.map((session,index) => `<section class="saved-session"><h3>${esc(session.name||session.title||`${he?'אימון':'Session'} ${index+1}`)}</h3><div class="saved-exercises">${(session.exercises||[]).map(exercise => `<article class="saved-exercise"><figure><img src="${esc(exerciseImageUrl(exercise))}" data-fallback-src="${fallbackExerciseImageUrl()}" alt="${esc(exercise.name||exercise.exerciseName||exercise.exercise)} — ${he?'תנוחת התחלה וסיום':'start and end positions'}" loading="lazy"><figcaption>${he?'הדגמת התנועה · התחלה וסיום':'Movement demonstration · start and finish'}</figcaption></figure><div><h4>${esc(exercise.name||exercise.exerciseName||exercise.exercise)}</h4><p>${esc(exercise.muscleGroup||'')} ${exercise.equipment?' · '+esc(exercise.equipment):''}</p><dl><div><dt>${he?'סטים':'Sets'}</dt><dd>${esc(exercise.sets)}</dd></div><div><dt>${he?'חזרות':'Reps'}</dt><dd>${esc(exercise.reps||'—')}</dd></div><div><dt>${he?'מנוחה':'Rest'}</dt><dd>${esc(exercise.restSeconds||exercise.rest||'—')} ${exercise.restSeconds?'s':''}</dd></div></dl>${exercise.notes?'<p>'+esc(exercise.notes)+'</p>':''}</div></article>`).join('')}</div></section>`).join('')}${volume}</div>`;
}
export async function openSavedWorkout(saved, user, language = 'en') {
  const he = language === 'he';
  document.querySelector('#savedWorkoutDialog')?.remove();
  const dialog = document.createElement('dialog');
  dialog.id = 'savedWorkoutDialog'; dialog.className = 'saved-workout-dialog';
  const name = saved.name || saved.plan?.programName || (he?'תוכנית אימון':'Workout plan');
  dialog.setAttribute('aria-label', name);
  const goals=he?{buildMuscle:'בניית שריר',increaseStrength:'כוח',loseFat:'חיטוב',maintainPerformance:'כושר כללי',improveSkills:'מיומנויות'}:{buildMuscle:'Build muscle',increaseStrength:'Strength',loseFat:'Fat loss',maintainPerformance:'General fitness',improveSkills:'Skills'};
  const levels=he?{beginner:'מתחיל',intermediate:'בינוני',advanced:'מתקדם'}:{beginner:'Beginner',intermediate:'Intermediate',advanced:'Advanced'};
  const selectedGoal=goals[saved.plan?.goal]?saved.plan.goal:'buildMuscle';
  const selectedLevel=String(saved.plan?.experience||saved.plan?.experienceLevel||saved.plan?.level||'intermediate').toLowerCase();
  dialog.innerHTML = `<header class="saved-workout-header"><h2>${esc(name)}</h2><button type="button" data-close aria-label="${he?'סגירה':'Close'}">×</button></header><div class="saved-review-settings"><p>${he?'טווחי הסטים תלויים במטרה ובניסיון. בחרו את הפרטים שלכם להשוואה; התוכנית השמורה לא משתנה.':'Set targets depend on your goal and experience. Choose your profile to compare; your saved plan stays unchanged.'}</p><label>${he?'מטרה':'Goal'} <select data-review-goal>${Object.entries(goals).map(([value,label])=>`<option value="${value}" ${value===selectedGoal?'selected':''}>${label}</option>`).join('')}</select></label><label>${he?'ניסיון':'Experience'} <select data-review-level>${Object.entries(levels).map(([value,label])=>`<option value="${value}" ${value===selectedLevel?'selected':''}>${label}</option>`).join('')}</select></label></div><div data-content>${workoutReviewMarkup(saved.plan||{},null,language)}<p role="status">${he?'מחשב סטים שבועיים…':'Calculating weekly sets…'}</p></div>`;
  document.body.append(dialog); dialog.showModal();
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => dialog.remove(), {once:true});
  dialog.addEventListener('error', event => {
    if(event.target.matches('img[data-fallback-src]')) { event.target.src = event.target.dataset.fallbackSrc; delete event.target.dataset.fallbackSrc; }
  }, true);
  let requestId=0;
  async function loadReview(){
   const id=++requestId;
   try {
    const token = await user.getIdToken();
    const program={...saved.plan,goal:dialog.querySelector('[data-review-goal]').value,experience:dialog.querySelector('[data-review-level]').value,priority:undefined};
    const response = await fetch('/api/workout-plans/review', {method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({program}),signal:AbortSignal.timeout(15000)});
    if(!response.ok) throw new Error('Review unavailable');
    const data = await response.json();
    if(dialog.isConnected&&id===requestId) dialog.querySelector('[data-content]').innerHTML = workoutReviewMarkup(data.program,data.weeklyVolume,language);
  } catch {
    if(dialog.isConnected&&id===requestId){
      dialog.querySelector('[data-content]').innerHTML=workoutReviewMarkup(saved.plan||{},null,language);
      const status=document.createElement('p');status.setAttribute('role','status');status.textContent=he?'לא ניתן לחשב כרגע את הסטים השבועיים. סגרו ופתחו שוב כדי לנסות.':'Weekly sets could not be calculated. Close and reopen to retry.';dialog.querySelector('[data-content]').append(status);
    }
  }
  }
  dialog.querySelectorAll('select').forEach(select=>select.addEventListener('change',loadReview));
  await loadReview();
}
