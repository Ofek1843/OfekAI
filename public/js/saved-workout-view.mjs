import { muscleAnatomySvg } from './muscle-anatomy.mjs';
import { exerciseImageUrl, fallbackExerciseImageUrl } from './exercise-image.js';
import { setExerciseMedia } from './exercise-media.js';
import { demonstrationModel } from './exercise-demo-preference.js';
import { calculateSavedWeeklySets } from './saved-workout-volume.mjs?v=20261015-plan-tabs-1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const genericNotes = new Set([
  'Choose a load allowing controlled technique at the prescribed RIR. Stop and seek appropriate advice for pain or unusual symptoms.',
  'בחרו עומס שמאפשר תנועה מבוקרת ועמידה ביעד ה־RIR. אם מופיעים כאב או תסמינים חריגים, עצרו ופנו לייעוץ מתאים.'
]);
const visibleExerciseNote = note => typeof note === 'string' && !genericNotes.has(note.trim()) ? note.trim() : '';
const muscles = { chest:'חזה',back:'גב',delts:'כתפיים',rear_delts:'כתף אחורית',biceps:'יד קדמית',triceps:'יד אחורית',quads:'ארבע ראשי',hamstrings:'ירך אחורית',glutes:'ישבן',calves:'תאומים',core:'ליבה',traps:'טרפז',adductors:'מקרבים',abductors:'מרחיקים' };
export function workoutReviewMarkup(program, weeklyVolume, language = 'en', selected = 'day-0') {
  const he = language === 'he';
  const sessions = program.sessions || [];
  const volume = weeklyVolume ? `<section class="saved-volume"><h3>${he?'סטים שבועיים לפי שריר':'Weekly sets by muscle'}</h3>
    <p>${he?'מחושב מכל ימי התוכנית: סטים ישירים בתוספת תרומה חלקית מתרגילים מורכבים.':'Calculated from every session in this plan: direct sets plus partial contributions from compound exercises.'}</p>
    <p>${he?'הקרדיטים וטווחי הסטים הם אומדני תכנון, לא מדידת התאוששות או אישור בטיחות אישי.':'Set credits and ranges are planning estimates, not measured recovery or individual medical clearance.'}</p>
    <p class="saved-volume-total"><strong>${esc(weeklyVolume.totalHardSets)} ${he?'סטים בתוכנית השבועית':'working sets in the weekly plan'}</strong></p>
    ${weeklyVolume.unknownExercises?`<p role="status">${he?'החישוב חלקי: יש תרגילים ללא מיפוי שריר.':'Partial calculation: some exercises have no muscle mapping.'}</p>`:''}
    ${weeklyVolume.unknownExercises?`<p>${esc(sessions.flatMap(s=>s.exercises||[]).filter(e=>!e.exerciseId).map(e=>e.name||e.exerciseName||e.exercise).join(', '))}</p>`:''}
    <div class="saved-volume-grid">${Object.entries(weeklyVolume.perMuscle).map(([key, entry]) => {
      const within = entry.total >= entry.preferredMin && entry.total <= entry.preferredMax;
      const showTarget = Number.isFinite(entry.preferredMin)&&!weeklyVolume.assumedExperience&&!weeklyVolume.assumedGoal;
      const status = weeklyVolume.unknownExercises ? (he?'חלקי':'Incomplete') : within ? (he?'בטווח היעד':'Within target') : entry.total < entry.preferredMin ? (he?'מתחת ליעד':'Below target') : (he?'מעל ליעד':'Above target');
      return `<article class="saved-volume-row" data-muscle="${esc(key)}"><header><span class="saved-volume-muscle">${muscleAnatomySvg(key)}<strong>${esc(he?muscles[key]||key:key.replaceAll('_',' '))}</strong></span>${showTarget?`<span class="volume-status ${within&&!weeklyVolume.unknownExercises?'within':''}">${status}</span>`:''}</header><b data-weekly-sets="${esc(entry.total)}">${esc(Math.round(entry.total*10)/10)} ${he?'סטים בשבוע':'sets / week'}</b>${showTarget?`<span>${he?'טווח יעד':'Target'}: ${esc(entry.preferredMin)}–${esc(entry.preferredMax)}</span>`:''}<small>${esc(entry.direct)} ${he?'ישירים':'direct'} + ${esc(entry.fractional)} ${he?'עקיפים משוקללים':'weighted indirect'}</small></article>`;
    }).join('')}</div></section>` : '';
  const tabs = sessions.map((session,index) => ({key:`day-${index}`,label:session.name||session.title||`${he?'אימון':'Session'} ${index+1}`,detail:`${(session.exercises||[]).length} ${he?'תרגילים':'exercises'}`}));
  tabs.push({key:'volume',label:he?'סטים שבועיים':'Weekly sets',detail:he?'סיכום לפי שריר':'Muscle breakdown'});
  if (!tabs.some(tab=>tab.key===selected)) selected=tabs[0].key;
  return `<div class="saved-workout-content"><nav class="saved-workout-nav" role="tablist" aria-orientation="vertical" aria-label="${he?'ימי התוכנית וסיכום':'Plan days and summary'}">${tabs.map((tab,index)=>`<button type="button" role="tab" id="saved-tab-${tab.key}" aria-controls="saved-workout-panel" aria-selected="${tab.key===selected}" tabindex="${tab.key===selected?0:-1}" data-workout-tab="${tab.key}"><span class="saved-tab-number">${tab.key==='volume'?'Σ':index+1}</span><span><strong>${esc(tab.label)}</strong><small>${esc(tab.detail)}</small></span></button>`).join('')}</nav><div class="saved-workout-pane" role="tabpanel" id="saved-workout-panel" aria-labelledby="saved-tab-${selected}" tabindex="0">${selected==='volume'?volume:sessions.filter((_,index)=>selected===`day-${index}`).map((session,index) => `<section class="saved-session"><h3>${esc(session.name||session.title||tabs.find(tab=>tab.key===selected)?.label)}</h3><div class="saved-exercises">${(session.exercises||[]).map(exercise => `<article class="saved-exercise"><figure><img src="${esc(exerciseImageUrl(exercise))}" data-fallback-src="${fallbackExerciseImageUrl()}" alt="${esc(exercise.name||exercise.exerciseName||exercise.exercise)} — ${he?'תנוחת התחלה וסיום':'start and end positions'}" loading="lazy"></figure><div><h4>${esc(exercise.name||exercise.exerciseName||exercise.exercise)}</h4><p>${esc(exercise.muscleGroup||'')} ${exercise.equipment?' · '+esc(exercise.equipment):''}</p><dl><div><dt>${he?'סטים':'Sets'}</dt><dd>${esc(exercise.sets)}</dd></div><div><dt>RIR</dt><dd>${esc(exercise.rir??'1–3')}</dd></div><div><dt>${he?'מנוחה':'Rest'}</dt><dd>${esc(exercise.restSeconds||exercise.rest||'—')} ${exercise.restSeconds?'s':''}</dd></div></dl>${visibleExerciseNote(exercise.notes)?'<p>'+esc(visibleExerciseNote(exercise.notes))+'</p>':''}</div></article>`).join('')}</div></section>`).join('')}</div></div>`;
}
export async function openSavedWorkout(saved, user, language = 'en') {
  const he = language === 'he';
  document.querySelector('#savedWorkoutDialog')?.remove();
  const dialog = document.createElement('dialog');
  dialog.id = 'savedWorkoutDialog'; dialog.className = 'saved-workout-dialog';
  const name = saved.name || saved.plan?.programName || (he?'תוכנית אימון':'Workout plan');
  dialog.setAttribute('aria-label', name);
  const local = calculateSavedWeeklySets(saved.plan||{});
  let selected=local.program.sessions?.length?'day-0':'volume';
  let displayedVolume=local.weeklyVolume;
  const render=()=>{
    const content=dialog.querySelector('[data-content]');
    const focused=document.activeElement?.dataset?.workoutTab;
    const sameTab=content.querySelector('[aria-selected="true"]')?.dataset.workoutTab===selected;
    const scroll=content.querySelector('.saved-workout-pane')?.scrollTop||0;
    content.innerHTML=workoutReviewMarkup(local.program,displayedVolume,language,selected);
    const session = local.program.sessions?.[Number(selected.replace('day-', ''))];
    const recipient = ['male','female'].includes(local.program.recipientGender)
      ? local.program.recipientGender
      : (['male','female'].includes(local.program.demonstrationModel) ? local.program.demonstrationModel : '');
    content.querySelectorAll('.saved-exercise img').forEach((image, index) => {
      delete image.dataset.fallbackSrc;
      setExerciseMedia(image, session?.exercises[index], demonstrationModel(recipient));
    });
    if(sameTab)content.querySelector('.saved-workout-pane').scrollTop=scroll;
    if(focused)content.querySelector(`[data-workout-tab="${focused}"]`)?.focus();
  };
  dialog.dir=he?'rtl':'ltr';
  dialog.innerHTML = `<header class="saved-workout-header"><h2>${esc(name)}</h2><button type="button" data-close aria-label="${he?'סגירה':'Close'}">×</button></header><div data-content>${workoutReviewMarkup(local.program,local.weeklyVolume,language)}</div>`;
  document.body.append(dialog); dialog.showModal();
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { dialog.remove(); }, {once:true});
  dialog.addEventListener('error', event => {
    if(event.target.matches('img[data-fallback-src]')) { event.target.src = event.target.dataset.fallbackSrc; delete event.target.dataset.fallbackSrc; }
  }, true);
  dialog.addEventListener('click',event=>{
    const tab=event.target.closest('[data-workout-tab]');
    if(!tab)return;
    selected=tab.dataset.workoutTab;render();
    dialog.querySelector(`[data-workout-tab="${selected}"]`).focus();
  });
  dialog.addEventListener('keydown',event=>{
    if(!event.target.matches('[data-workout-tab]'))return;
    const tabs=[...dialog.querySelectorAll('[data-workout-tab]')],index=tabs.indexOf(event.target);
    let next;
    if(event.key==='ArrowDown')next=(index+1)%tabs.length;
    if(event.key==='ArrowUp')next=(index-1+tabs.length)%tabs.length;
    if(event.key==='Home')next=0;
    if(event.key==='End')next=tabs.length-1;
    if(next===undefined)return;
    event.preventDefault();tabs[next].click();
  });
  let requestId=0;
  async function loadReview(){
   const id=++requestId;
   try {
    const token = await user.getIdToken();
    const program=saved.plan;
    const response = await fetch('/api/workout-plans/review', {method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({program}),signal:AbortSignal.timeout(15000)});
    if(!response.ok) throw new Error('Review unavailable');
    const data = await response.json();
    // The program's own counts stay authoritative even if an older API or
    // incomplete response supplies different metadata. The API only adds ranges.
    const weeklyVolume={...data.weeklyVolume,...local.weeklyVolume,perMuscle:Object.fromEntries(
      Object.entries(local.weeklyVolume.perMuscle).map(([key,counts])=>[key,{...data.weeklyVolume?.perMuscle?.[key],...counts}])
    )};
    if(dialog.isConnected&&id===requestId){displayedVolume=weeklyVolume;render();}
  } catch {
    if(dialog.isConnected&&id===requestId){
      render();
    }
  }
  }
  await loadReview();
}
