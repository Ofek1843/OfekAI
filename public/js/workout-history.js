import { db } from './firebase-config.js';
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { guardProtectedPage } from './verification-gate.js';
import { exerciseImageUrl } from './exercise-image.js';
import { installWorkoutExercisePreview } from './workout-exercise-preview.mjs';

const $ = selector => document.querySelector(selector);
const he = (localStorage.getItem('ofek-ai-language') || 'en') === 'he';
const ui = he ? {
  title:'היסטוריית אימונים', description:'מה עשית בפעם הקודמת? כל התרגילים, המשקלים והסטים במקום אחד.',
  back:'חזרה ל־FuelPhysique ←', start:'+ התחלת אימון', workouts:'אימונים', sets:'סטים שבוצעו', time:'זמן אימונים',
  loading:'טוען את האימונים שלך…', empty:'האימון הבא שלך מתחיל כאן', emptyText:'שמור אימון ראשון כדי לחזור למשקלים ולסטים שלך בפעם הבאה.',
  details:'פתיחת האימון', hide:'סגירת האימון', remove:'מחיקה', confirm:'למחוק את האימון הזה? לא ניתן לבטל פעולה זו.',
  loadError:'לא ניתן לטעון את היסטוריית האימונים.', deleteError:'לא ניתן למחוק את האימון.', minutes:'דקות',
  weight:'משקל', reps:'חזרות', done:'בוצע', notes:'הערות', unknownDate:'תאריך לא זמין', kg:'ק״ג', set:'סט', manual:'תיעוד ידני', missing:'לא תועד', completed:'סטים שבוצעו', exercise:'תרגיל'
} : {
  title:'Workout history', description:'What did you lift last time? Your exercises, weights and sets in one place.',
  back:'← Back to FuelPhysique', start:'+ Start workout', workouts:'Workouts', sets:'Completed sets', time:'Training time',
  loading:'Loading your workouts…', empty:'Your next workout starts here', emptyText:'Save your first workout to find your weights and sets here next time.',
  details:'Open workout', hide:'Close workout', remove:'Delete', confirm:'Delete this workout? This cannot be undone.',
  loadError:'Could not load workout history.', deleteError:'Could not delete the workout.', minutes:'min',
  weight:'Weight', reps:'Reps', done:'Done', notes:'Notes', unknownDate:'Date unavailable', kg:'kg', set:'Set', manual:'Manual entry', missing:'Not recorded', completed:'completed sets', exercise:'Exercise'
};
let user, logs = [];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const number = value => numeric(value) ? new Intl.NumberFormat(he ? 'he-IL' : 'en-US', {maximumFractionDigits:2}).format(Number(value)) : '—';

function localize() {
  document.documentElement.classList.add('workout-log-route');
  document.documentElement.lang = he ? 'he' : 'en'; document.documentElement.dir = he ? 'rtl' : 'ltr';
  for (const [id,key] of [['pageTitle','title'],['pageDescription','description'],['backLink','back'],['trackerLink','start'],['workoutsLabel','workouts'],['setsLabel','sets'],['timeLabel','time']]) $('#'+id).textContent = ui[key];
  $('#historyStatus').textContent = ui.loading;
}
function dateOf(log) {
  const date = log.completedAt?.toDate?.() || log.startedAt?.toDate?.() || (log.startedAt instanceof Date ? log.startedAt : null);
  return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(he?'he-IL':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(date) : ui.unknownDate;
}
function exerciseHtml(exercise, index) {
  const sets = exercise.sets || [], completed = sets.filter(set => set.completed);
  const weights = completed.filter(set => numeric(set.weightKg)).map(set => Number(set.weightKg));
  const best = weights.length ? Math.max(...weights) : null;
  const image = exerciseImageUrl(exercise), name = exercise.name || ui.exercise;
  return `<details class="history-exercise" ${index===0?'open':''}><summary><img class="history-exercise-thumbnail" src="${esc(image)}" alt="" loading="lazy"><span class="history-exercise-heading"><strong dir="auto">${esc(name)}</strong><small><bdi>${completed.length} / ${sets.length}</bdi> ${ui.completed}</small></span><span class="history-best-weight">${best!==null?`<bdi>${number(best)} ${ui.kg}</bdi>`:'—'}</span><span class="exercise-chevron" aria-hidden="true">⌄</span></summary>
    <div class="history-exercise-workspace"><figure class="exercise-guide"><button class="exercise-guide-preview" type="button" data-exercise-preview data-exercise-name="${esc(name)}" aria-label="${esc((he?'הגדלת ההמחשה: ':'Enlarge demonstration: ')+name)}"><img src="${esc(image)}" alt="${esc(name)}" loading="lazy"><span class="exercise-image-expand" aria-hidden="true">↗</span></button><figcaption><strong>${he?'המחשת התרגיל':'Exercise demonstration'}</strong><span>${he?'לחצו על התמונה לתצוגה גדולה':'Select the image for a closer look'}</span></figcaption></figure><div class="history-record-table"><h4>${he?'מה עשית באימון':'Your recorded sets'}</h4>
    <table class="sets-table" aria-label="${esc(exercise.name || ui.exercise)}"><thead><tr><th scope="col">${ui.set}</th><th scope="col">${ui.weight}</th><th scope="col">${ui.reps}</th><th scope="col">${ui.done}</th></tr></thead>
    <tbody>${sets.map((set,i)=>`<tr class="${set.completed?'completed':''}"><th scope="row">${number(set.setNumber ?? i+1)}${set.targetRir!=null?`<small class="history-set-effort">RIR <bdi>${esc(set.targetRir)}</bdi></small>`:''}</th><td><bdi>${numeric(set.weightKg)?`${number(set.weightKg)} ${ui.kg}`:'—'}</bdi></td><td>${number(set.reps)}${numeric(set.rpe)?`<small class="history-set-effort">RPE ${number(set.rpe)}</small>`:''}</td><td class="${set.completed?'set-done':'set-missed'}"><span aria-label="${set.completed?ui.done:ui.missing}">${set.completed?'✓':'—'}</span></td></tr>`).join('')}</tbody></table></div></div></details>`;
}
function cardHtml(log, index) {
  const minutes=Math.max(1,Math.round((Number(log.durationSeconds)||0)/60)),open=index===0;
  return `<article class="history-card" data-log-id="${esc(log.id)}"><div class="workout-summary"><div><span class="workout-date">${esc(dateOf(log))}</span><h2 dir="auto">${esc(log.sessionName || 'Workout')}</h2><p class="plan-name" dir="auto">${esc(log.workoutPlanName || '')}</p></div><div class="summary-meta">${log.manuallyEntered?`<span class="manual-entry">${ui.manual}</span>`:''}<span>${minutes} ${ui.minutes}</span><span>${Number(log.completedSets)||0}/${Number(log.totalSets)||0} ${ui.completed}</span></div></div>
    <div class="card-actions"><button class="details-button" type="button" aria-expanded="${open}" aria-controls="history-details-${index}">${open?ui.hide:ui.details}</button><button class="delete-button" type="button">${ui.remove}</button></div>
    <div id="history-details-${index}" class="workout-details" ${open?'':'hidden'}>${(log.exercises||[]).map(exerciseHtml).join('')}${log.notes?`<p class="workout-notes"><strong>${ui.notes}:</strong> ${esc(log.notes)}</p>`:''}</div></article>`;
}
function render() {
  $('#workoutCount').textContent=logs.length; $('#completedSets').textContent=logs.reduce((sum,log)=>sum+(Number(log.completedSets)||0),0);
  const seconds=logs.reduce((sum,log)=>sum+(Number(log.durationSeconds)||0),0); $('#trainingTime').textContent=seconds>=3600?`${(seconds/3600).toFixed(1)}h`:`${Math.round(seconds/60)}m`;
  $('#historyStatus').textContent=''; $('#historyList').innerHTML=logs.length?logs.map(cardHtml).join(''):`<div class="empty-state"><h2>${ui.empty}</h2><p>${ui.emptyText}</p><a class="primary-link" href="/workout-tracker.html">${ui.start}</a></div>`;
}
$('#historyList').addEventListener('click',async event=>{
  const card=event.target.closest('.history-card');if(!card)return;
  const toggle=event.target.closest('.details-button');
  if(toggle){const details=card.querySelector('.workout-details'),open=details.hidden;details.hidden=!open;toggle.textContent=open?ui.hide:ui.details;toggle.setAttribute('aria-expanded',String(open));return;}
  const button=event.target.closest('.delete-button');if(!button||!confirm(ui.confirm))return;button.disabled=true;
  try{await deleteDoc(doc(db,'users',user.uid,'workoutLogs',card.dataset.logId));logs=logs.filter(log=>log.id!==card.dataset.logId);render();}
  catch(error){console.error(error);$('#historyStatus').textContent=ui.deleteError;$('#historyStatus').classList.add('error');button.disabled=false;}
});
localize();installWorkoutExercisePreview();guardProtectedPage({onAuthenticated:async current=>{
  user=current;
  try{const result=await getDocs(query(collection(db,'users',user.uid,'workoutLogs'),orderBy('completedAt','desc'),limit(100)));logs=result.docs.map(item=>({id:item.id,...item.data()}));render();}
  catch(error){console.error(error);$('#historyStatus').textContent=ui.loadError;$('#historyStatus').classList.add('error');}
}});
