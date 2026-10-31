import { macroEnergyPercentages } from './daily-nutrition-domain.mjs?v=20261013-nutrition-recovery-1';
import { dashboardCopy } from './dashboard-editorial-i18n.mjs?v=20261030-focus-1';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function asDate(value) {
 const d=value?.toDate ? value.toDate() : value?.seconds != null ? new Date(value.seconds*1000) : new Date(value);
 return Number.isFinite(d.getTime()) ? d : null;
}
export function dateKey(date) {
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
export function nextSession(workout, logs=[]) {
 const sessions=workout?.plan?.sessions || [];
 if (!sessions.length) return null;
 const latest=logs.filter(l=>l.workoutPlanId===workout.id).sort((a,b)=>(asDate(b.completedAt||b.startedAt)?.getTime()||0)-(asDate(a.completedAt||a.startedAt)?.getTime()||0))[0];
 const index=latest ? ((Number(latest.sessionIndex)||0)+1)%sessions.length : 0;
 return {session:sessions[index],index};
}
// Present stored schedules only. Legacy plans retain the existing next-session
// order; the dashboard must not invent training/rest dates for those plans.
export function dashboardSession(model, today=new Date()) {
 const workouts=model.workouts||[], workout=workouts.find(p=>p.id===model.activeWorkoutId);
 if(model.workoutsFailed||(model.loadFailures||[]).some(f=>f.section==='profile')||
    (model.activeWorkoutId&&(!workout||model.logsFailed))) return {state:'error'};
 if(!workout?.plan?.sessions?.length) return workouts.length ? {state:'saved',workout:workout||workouts[0]} : {state:'empty'};
 const plan=workout.plan, sessions=plan.sessions;
 const source=[plan.weeklyScheduleDays,plan.trainingDaysOfWeek,plan.scheduleDays].find(Array.isArray);
 const explicit=source?.length===sessions.length && source.every(day=>day!==null&&day!==''&&Number.isInteger(Number(day))&&Number(day)>=0&&Number(day)<=6) && new Set(source.map(Number)).size===source.length;
 if(!explicit) return {state:'next',workout,...nextSession(workout,model.logs)};
 const days=source.map(Number), index=days.indexOf(today.getDay());
 if(index<0) {
  const upcoming=days.map((day,index)=>({index,offset:(day-today.getDay()+7)%7})).sort((a,b)=>a.offset-b.offset)[0];
  const date=new Date(today);date.setDate(date.getDate()+upcoming.offset);
  return {state:'rest',workout,session:sessions[upcoming.index],index:upcoming.index,date};
 }
 const completed=(model.logs||[]).some(log=>log.workoutPlanId===workout.id&&log.sessionIndex!=null&&Number(log.sessionIndex)===index&&log.completedAt&&asDate(log.completedAt)&&dateKey(asDate(log.completedAt))===dateKey(today));
 return {state:completed?'completed':'today',workout,session:sessions[index],index};
}
export function diaryTotals(log) {
 return (log?.entries || []).reduce((acc,e) => {
  for(const key of Object.keys(acc)) acc[key]+=Math.max(0,Number(e[key])||0);
  return acc;
 },{calories:0,proteinGrams:0,carbsGrams:0,fatGrams:0});
}
function safeImage(value) { return typeof value==='string' && (/^https:\/\//.test(value)||/^\/(?!\/)/.test(value)) ? escapeHTML(value) : ''; }
const asset=name=>'/assets/dashboard/'+name+'.webp';
const icon=(name,cls='')=>'<img class="icon '+cls+'" src="/icons/tabler/'+name+'.svg" alt="" aria-hidden="true">';
const link=(url,label,cls='')=>'<a class="'+cls+'" href="'+escapeHTML(url)+'">'+label+'</a>';
const btn=(action,label,name,cls='')=>'<button type="button" class="icon-button '+cls+'" data-action="'+action+'"'+(action==='menu'?' aria-controls="dashboardSidebar" aria-expanded="false"':'')+' aria-label="'+escapeHTML(label)+'">'+icon(name)+'</button>';
export function mountDashboard(root, initial={}, options={}) {
 let model=initial, language=options.language||'en', t=dashboardCopy(language);
 const guest=options.guest===true;
 const guestLabels=()=>({name:t.guestName,title:t.guestTitle,body:t.guestBody,signup:t.signup,login:t.login});
 let today=options.today||new Date(), selectedDay=new Date(today), weekOffset=0, dayRequest=0;
 let diary=initial.diary||null, diaryFailed=!!initial.diaryFailed;
 const locale=()=>language==='zh'?'zh-CN':language;
 const number=v=>Math.round(Number(v)||0).toLocaleString(locale());
 const navItems=()=>[
  ['dashboard','/dashboard.html','home'],['workouts','/my-workout-plans.html','barbell'],
  ['meals','/my-nutrition-plans.html','tools-kitchen-2'],['diary','/daily-nutrition.html','clipboard'],
  ['exercises','/exercise-library','player-play'],['progress','/progress.html','chart-bar'],['messages','/social.html','message-circle'],['guides','/faq.html','book']
 ];
 function planName(saved,kind) {return saved.name||saved.plan?.programName||saved.plan?.planName||t[kind==='workout'?'workouts':'meals'];}
 function level(value) {return t[String(value).toLowerCase()]||value||'';}
 function panel(kind) {
  const workout=kind==='workout', plans=model[workout?'workouts':'meals']||[], active=model[workout?'activeWorkoutId':'activeMealId'];
  const create=workout?'/workout-builder.html':'/nutrition-builder.html';
  const sorted=[...plans].sort((a,b)=>Number(b.id===active)-Number(a.id===active));
  return '<section class="plan-panel '+(workout?'':'meal-panel')+'"><header class="section-heading"><div class="title-icon">'+icon(workout?'barbell':'tools-kitchen-2')+'<h2>'+t[workout?'workouts':'meals']+'</h2></div>'+link(create,icon('plus')+t.create,'button')+'</header>'+
   (model[workout?'workoutsFailed':'mealsFailed'] ? '<p class="empty-plans">'+t.error+'</p>' : !sorted.length ? '<div class="empty-plans"><p>'+t[workout?'emptyWorkout':'emptyMeal']+'</p>'+link(create,icon('plus')+t.createNow,'button')+'</div>' :
    sorted.slice(0,3).map((saved,index)=>{
     const p=saved.plan||{}, duration=p.durationWeeks||p.weeks||saved.durationWeeks;
     const meta=[duration ? escapeHTML(duration)+' '+t.weeks : '',workout?escapeHTML(level(p.experienceLevel||p.level||saved.level)):p.dailyCalories?'~'+number(p.dailyCalories)+' kcal':''].filter(Boolean).join('　|　');
     return '<article class="plan-row"><img src="'+asset((workout?'workout-':'meal-')+(index+1))+'" alt="" width="126" height="66" loading="lazy"><div class="plan-copy"><h3>'+escapeHTML(planName(saved,kind))+'</h3><p>'+meta+'</p></div><button class="button '+(saved.id===active?'primary':'')+'" data-plan-kind="'+kind+'" data-plan-id="'+escapeHTML(saved.id)+'">'+t[saved.id===active?'continue':'open']+'</button></article>';
    }).join(''))+'</section>';
 }
 function weekHTML() {
  const start=new Date(today); start.setDate(start.getDate()-((start.getDay()+6)%7)+weekOffset*7);
  const weekdays=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d;});
  return '<header class="section-heading"><h2>'+(weekOffset===0?t.week:new Intl.DateTimeFormat(locale(),{month:'short',day:'numeric'}).format(start))+'</h2><div class="week-nav">'+btn('week-back',t.previousWeek,'chevron-right','back')+btn('week-next',t.nextWeek,'chevron-right')+'</div></header><div class="week-days">'+weekdays.map(d=>{
   const trained=(model.logs||[]).some(log=>{const completed=asDate(log.completedAt||log.startedAt);return completed && dateKey(completed)===dateKey(d);});
   return '<div class="week-day '+(dateKey(d)===dateKey(today)?'today ':'')+(trained?'trained':'')+'" '+(dateKey(d)===dateKey(today)?'aria-current="date"':'')+'><span>'+new Intl.DateTimeFormat(locale(),{weekday:'short'}).format(d).toLocaleUpperCase(locale())+'</span><span class="week-date">'+new Intl.DateTimeFormat(locale(),{month:'short',day:'numeric'}).format(d)+'</span><span class="day-dot" aria-hidden="true"></span></div>';
  }).join('')+'</div>';
 }
 function diaryHTML() {
  const active=(model.meals||[]).find(p=>p.id===model.activeMealId)?.plan;
  const targets=diary?.targetSnapshot||active||{}, totals=diaryTotals(diary);
  const calories=Number(targets.dailyCalories||targets.calories), goal=Number.isFinite(calories)&&calories>0?calories:null;
  return '<header class="section-heading"><div class="title-icon">'+icon('tools-kitchen-2')+'<h2>'+t.diary+'</h2></div>'+(guest?'':'<div class="diary-nav">'+btn('day-back',t.previousDay,'chevron-right','back')+'<span>'+ (dateKey(selectedDay)===dateKey(today)?t.today:new Intl.DateTimeFormat(locale(),{month:'short',day:'numeric'}).format(selectedDay))+'</span>'+btn('day-next',t.nextDay,'chevron-right')+'</div>')+'</header>'+
   (diaryFailed?'<p class="activity-empty" role="status">'+t.error+'</p>':'<div class="diary-data"><div class="ring" role="img" aria-label="'+escapeHTML(number(totals.calories)+(goal?' / '+number(goal):'')+' kcal')+'"><canvas width="256" height="256" aria-hidden="true"></canvas><div class="ring-label"><strong>'+number(totals.calories)+'</strong><small>'+(goal?'/ '+number(goal)+' kcal':t.noTarget)+'</small></div></div><div class="macros">'+[['protein','proteinGrams'],['carbs','carbsGrams'],['fats','fatGrams']].map(([label,key])=>{
    const target=Number(targets[key]);
    return '<div class="macro"><strong>'+number(totals[key])+'g</strong><small>'+t[label]+'</small>'+(Number.isFinite(target)&&target>0?'<progress max="'+target+'" value="'+totals[key]+'" aria-label="'+t[label]+'"></progress>':'')+'</div>';
   }).join('')+'</div></div>'+(!goal?'<p class="diary-target-note">'+(model.mealsFailed?t.error:t.nutritionNoTarget+' '+link('/nutrition-builder.html',t.nutritionNoTargetLink))+'</p>':''))+
   (diary?.pendingSync ? '<p role="status">'+(language==='he'?'מוצגים הנתונים שנשמרו במכשיר; הסנכרון לענן ממתין.':'Showing entries saved on this device; cloud sync is pending.')+'</p>' : '')+
   link('/daily-nutrition.html',t.log+icon('arrow-right'),'button primary');
 }
 function quickCards() {
  const workout=(model.workouts||[]).find(p=>p.id===model.activeWorkoutId);
  const meal=(model.meals||[]).find(p=>p.id===model.activeMealId);
  const target=Number(meal?.plan?.dailyCalories || meal?.plan?.calories);
  const diaryError=!!model.diaryFailed, todayLog=model.diary||null;
  const workoutInfo=model.workoutsFailed?t.error:workout?planName(workout,'workout'):t.emptyWorkout;
  const mealInfo=model.mealsFailed?t.error:meal?(Number.isFinite(target)&&target>0?number(target)+' kcal':planName(meal,'meal')):t.emptyMeal;
  const diaryInfo=diaryError?t.error:number(diaryTotals(todayLog).calories)+' / '+(Number.isFinite(target)&&target>0?number(target)+' kcal':t.noTarget);
  const macro=macroEnergyPercentages(diaryTotals(todayLog));
  const macroAvailable=!diaryError && macro.macroCalories>0;
  const pct=v=>new Intl.NumberFormat(locale(),{maximumFractionDigits:1}).format(v)+'%';
  const macroLegend=macroAvailable?'<span class="quick-macro-legend">'+[['protein','protein'],['carbs','carbs'],['fats','fat']].map(([label,key])=>'<span class="quick-macro-'+key+'">'+escapeHTML(t[label])+' '+pct(macro[key])+'</span>').join('')+'</span>':'';
  const pie=macroAvailable?'<span class="quick-macro-pie" role="img" aria-label="'+escapeHTML([t.protein+' '+pct(macro.protein),t.carbs+' '+pct(macro.carbs),t.fats+' '+pct(macro.fat)].join(', '))+'" style="--protein:'+macro.protein+'%;--carbs-end:'+Math.min(100,macro.protein+macro.carbs)+'%"></span>':'<span class="quick-macro-pie is-empty" aria-hidden="true"></span>';
  const card=(kind,label,info,image,href,plan)=>{
   const inner=(image?'<img class="quick-card-image" src="'+asset(image)+'" alt="" loading="lazy">':'<span class="quick-card-art">'+(kind==='diary'?pie:icon('chart-bar'))+'</span>')+'<span class="quick-card-body">'+(kind==='diary'?'':'<span class="quick-card-icon">'+icon(kind==='workout'?'barbell':kind==='meal'?'tools-kitchen-2':'chart-bar')+'</span>')+'<span class="quick-card-copy"><strong>'+escapeHTML(label)+'</strong><small>'+escapeHTML(info)+'</small>'+(kind==='diary'?macroLegend:'')+'</span>'+icon('chevron-right','quick-card-chevron')+'</span>';
   return plan?'<button type="button" class="quick-card" data-plan-kind="'+kind+'" data-plan-id="'+escapeHTML(plan.id)+'">'+inner+'</button>':link(href,inner,'quick-card');
  };
  return '<section class="quick-actions" aria-label="'+escapeHTML(t.yourPlans)+'"><h2>'+t.yourPlans+'</h2><div class="quick-card-list">'+card('workout',t.workouts,workoutInfo,'workout-1',model.workoutsFailed?'/my-workout-plans.html':'/workout-builder.html',workout)+card('meal',t.meals,mealInfo,'meal-1',model.mealsFailed?'/my-nutrition-plans.html':'/nutrition-builder.html',meal)+card('diary',t.diary,diaryInfo,'','/daily-nutrition.html',null)+card('progress',t.progress,t.viewLog,'','/progress.html',null)+'</div></section>';
 }
 function paintRing() {
  const canvas=root.querySelector('.ring canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const target=diary?.targetSnapshot||(model.meals||[]).find(p=>p.id===model.activeMealId)?.plan||{};
  const ratio=Math.max(0,Math.min(1,diaryTotals(diary).calories/(Number(target.dailyCalories||target.calories)||Infinity)));
  ctx.clearRect(0,0,256,256);ctx.lineWidth=17;ctx.lineCap='round';
  ctx.beginPath();ctx.strokeStyle='#dedcd6';ctx.arc(128,128,107,0,Math.PI*2);ctx.stroke();
  if(ratio){ctx.beginPath();ctx.strokeStyle='#095399';ctx.arc(128,128,107,-Math.PI/2,-Math.PI/2+ratio*Math.PI*2);ctx.stroke();}
 }
 function render() {
  document.documentElement.lang=language;document.documentElement.dir=['he','ar'].includes(language)?'rtl':'ltr';
  const name=String(model.name||'').trim().split(/\s+/)[0];
  const greeting=t[today.getHours()<12?'morning':today.getHours()<18?'afternoon':'evening'];
  const focus=dashboardSession(model,today), workout=focus.workout;
  const next=['today','next'].includes(focus.state)?focus:null;
  const session=next?.session, plan=workout?.plan||{};
  const title=focus.state==='rest'?t.restDay:focus.state==='completed'?t.completedWorkout:focus.state==='saved'?t.savedWorkout:focus.state==='error'?t.workoutUnavailable:session?.name||session?.title||t.emptyWorkout;
  const duration=next?(session?.estimatedDurationMinutes||session?.durationMinutes||plan.sessionDurationMinutes||plan.sessionDuration):null;
  const detail=focus.state==='rest'?t.restDescription+' '+(focus.session.name||focus.session.title||t.next)+' · '+new Intl.DateTimeFormat(locale(),{weekday:'long',month:'short',day:'numeric'}).format(focus.date):focus.state==='completed'?t.completedDescription:focus.state==='saved'?t.savedDescription:focus.state==='error'?t.error:next?(plan.description||plan.goalDescription||t.ready):t.setup;
  const tracking=next?'/workout-tracker.html?plan='+encodeURIComponent(workout.id)+'&session='+encodeURIComponent(session.id??next.index):'/workout-builder.html';
  const focusLabel=focus.state==='today'?t.todayWorkout:focus.state==='next'?t.next:focus.state==='error'?t.workouts:['empty','saved'].includes(focus.state)?t.yourPlans:t.today;
  const safePhoto=safeImage(model.photoURL);
  const addPhoto=language==='he'?'הוספת תמונת פרופיל':'Add profile picture';
  const avatar='<span class="avatar avatar-placeholder">'+escapeHTML(addPhoto)+'</span>';
  const failedSections=(model.loadFailures||[]).map(f=>({workouts:t.workouts,meals:t.meals,logs:t.recent,diary:t.diary,profile:t.settings,settings:t.settings}[f.section]||t.dashboard));
  const failureMessage=failedSections.length?`${t.loadFailurePrefix}: ${[...new Set(failedSections)].join(', ')}.`:model.error||'';
  root.innerHTML='<header class="topbar">'+btn('menu',t.more,'menu-2','menu-toggle')+link('/dashboard.html','Fuel<span>Physique</span>','wordmark')+'<nav class="top-links" aria-label="'+t.home+'">'+[['home','/dashboard.html'],['plans','#plans'],['exercises','/exercise-library'],['nutrition','/daily-nutrition.html'],['guides','/faq.html']].map(([key,url])=>link(url,t[key])).join('')+btn('search',t.search,'search')+'</nav><div class="account-area">'+(guest?link('/auth.html?mode=signup',guestLabels().signup,'guest-account-link')+link('/auth.html',guestLabels().login,'guest-login-link'):link('/app.html?settings=open',safePhoto?'<img class="avatar" src="'+safePhoto+'" alt="'+escapeHTML(addPhoto)+'" data-profile-photo>':avatar,'avatar-link')+'<details class="account"><summary><span class="account-name">'+escapeHTML(name)+'</span>'+icon('chevron-right','chevron')+'</summary><div class="account-menu">'+link('/app.html?settings=open',t.settings)+link('/social.html',t.more)+'<button type="button" data-review-open>'+(language==='he'?'כתיבת ביקורת':'Write a review')+'</button><button data-action="language">Language</button><button data-action="logout">'+t.logout+'</button></div></details>')+'</div></header>'+
  '<button class="mobile-backdrop" data-action="menu-close" tabindex="-1" aria-label="'+t.close+'"></button><aside class="sidebar" id="dashboardSidebar"><nav aria-label="'+t.dashboard+'">'+navItems().map(([key,url,ic])=>link(url,icon(ic)+t[key],'side-link '+(key==='dashboard'?'active':''))).join('')+'<div class="side-divider"></div>'+link('/app.html?settings=open',icon('settings')+t.settings,'side-link')+'</nav><p class="side-motto">'+escapeHTML(t.motto).replaceAll(' ','<br>')+'</p></aside>'+
  '<main class="dashboard-main">'+(guest?'<section class="guest-dashboard-banner" role="note"><div><strong>'+escapeHTML(guestLabels().title)+'</strong><p>'+escapeHTML(guestLabels().body)+'</p></div>'+link('/auth.html?mode=signup',guestLabels().signup,'button primary')+'</section>':'')+'<div class="status" role="status">'+escapeHTML(failureMessage)+(failureMessage?'<button class="button" data-action="retry-dashboard">'+t.retry+'</button>':'')+'</div><div class="overview"><header class="greeting"><h1>'+greeting+(name?', '+escapeHTML(name):'')+'</h1><p>'+t.tagline+'</p></header>'+quickCards()+
  '<article class="session '+(!next?'empty':'')+'" data-session-state="'+focus.state+'"><img class="session-photo" src="'+asset('training')+'" alt="" width="305" height="324" fetchpriority="high"><div class="session-copy"><div class="session-topline"><span class="eyebrow">'+focusLabel+'</span>'+(plan.durationWeeks?link('/my-workout-plans.html',escapeHTML(plan.durationWeeks)+' '+t.weeks+icon('chevron-right'),'session-week'):'')+'</div><h2>'+escapeHTML(title)+'</h2><p class="session-description">'+escapeHTML(detail)+'</p><div class="session-meta">'+(duration?'<span>'+icon('clock')+escapeHTML(duration)+' '+t.minutes+'</span>':'')+(plan.experienceLevel||plan.level?'<span>'+icon('chart-bar')+escapeHTML(level(plan.experienceLevel||plan.level))+'</span>':'')+(session?'<span>'+icon('barbell')+(session.exercises||[]).length+' '+t.exerciseCount+'</span>':'')+'</div><div class="session-actions">'+(focus.state==='saved'||focus.state==='rest'?'<button class="button primary" data-plan-kind="workout" data-plan-id="'+escapeHTML(workout.id)+'">'+t.details+'</button>':focus.state==='error'?'<button class="button primary" data-action="retry-dashboard">'+t.retry+'</button>':focus.state==='completed'?link('/workout-history.html',t.viewLog,'button primary'):link(tracking,t[next?'start':'createNow']+icon('arrow-right'),'button primary'))+(next?'<button class="button" data-plan-kind="workout" data-plan-id="'+escapeHTML(workout.id)+'">'+t.details+'</button>':focus.state==='empty'?link('/nutrition-builder.html',t.meals,'button'):'')+'</div></div></article>'+
  '<section class="diary" aria-label="'+t.diary+'">'+diaryHTML()+'</section></div>'+
  '<section class="plans" id="plans" tabindex="-1"><header class="section-heading"><h2>'+t.yourPlans+'</h2>'+link('/my-workout-plans.html',t.viewAll+icon('arrow-right'),'text-link')+'</header><div class="plan-columns">'+panel('workout')+panel('meal')+'</div></section>'+
  '<section class="week" aria-label="'+t.week+'">'+weekHTML()+'</section><section class="activity"><header class="section-heading"><h2>'+t.recent+'</h2>'+link('/workout-history.html',t.viewLog+icon('arrow-right'),'text-link')+'</header>'+
  ((model.logs||[]).length?model.logs.slice(0,3).map(log=>{
   const date=asDate(log.completedAt||log.startedAt), exerciseCount=Array.isArray(log.exercises)?log.exercises.length:0;
   const minutes=Number(log.durationMinutes)||Math.round((Number(log.durationSeconds)||0)/60);
   return '<div class="activity-row"><span class="muted">'+(date?new Intl.DateTimeFormat(locale(),{month:'short',day:'numeric',year:'numeric'}).format(date):'—')+'</span><span>'+escapeHTML(log.sessionName||log.workoutPlanName||t.workouts)+'</span><span class="muted exercise-count">'+exerciseCount+' '+t.exerciseCount+'</span><span class="muted duration">'+(minutes||'—')+' '+t.minutes+'</span>'+icon('check')+'</div>';
  }).join(''):'<p class="activity-empty">'+(model.logsFailed?t.error:t.emptyActivity)+'</p>')+'</section></main><dialog class="search-dialog" id="dashboardDialog"></dialog>';
  paintRing();
  const photo=root.querySelector('[data-profile-photo]');
  if(photo) photo.addEventListener('error',()=>{photo.parentElement.innerHTML=avatar;},{once:true});
 }
 function closeMenu() {root.querySelector('.sidebar')?.classList.remove('open');root.querySelector('.mobile-backdrop')?.classList.remove('open');root.querySelector('[data-action="menu"]')?.setAttribute('aria-expanded','false');}
 function dialog(content) {
  const el=root.querySelector('dialog');el.innerHTML='<div class="section-heading"><span></span>'+btn('dialog-close',t.close,'plus')+'</div>'+content;
  el.showModal();el.querySelector('input,select,button')?.focus();
 }
 async function showPlan(kind,id) {
  const saved=(model[kind==='workout'?'workouts':'meals']||[]).find(p=>p.id===id);if(!saved)return;
  if(kind==='workout'){
   const {openSavedWorkout}=await import('./saved-workout-view.mjs?v=20261030-fullscreen-1');
   await openSavedWorkout(saved,options.workoutUser,language);
   return;
  }
  const {openSavedNutrition}=await import('./saved-nutrition-view.mjs?v=20261030-macros-1');
  openSavedNutrition(saved,language);
 }
 root.addEventListener('click',async event=>{
  const plansNav=event.target.closest('.top-links a[href="#plans"]');
  if(plansNav){
   const section=root.querySelector('#plans');
   if(section){event.preventDefault();section.scrollIntoView({behavior:'smooth',block:'start'});section.focus({preventScroll:true});}
   return;
  }
  const planButton=event.target.closest('[data-plan-id]');if(planButton){try{await showPlan(planButton.dataset.planKind,planButton.dataset.planId);}catch{root.querySelector('.status').textContent=t.error;}return;}
  const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
  if(action==='menu'){const opened=root.querySelector('.sidebar').classList.toggle('open');root.querySelector('.mobile-backdrop').classList.toggle('open',opened);event.target.closest('button').setAttribute('aria-expanded',String(opened));}
  if(action==='menu-close')closeMenu();
  if(action==='retry-dashboard'){
   const button=event.target.closest('button');button.disabled=true;button.textContent=t.loading;
   try{await options.onRetry?.();}catch{root.querySelector('.status').textContent=t.error;}
   finally{button.disabled=false;button.textContent=t.retry;}
  }
  if(action==='dialog-close')root.querySelector('dialog').close();
  if(action==='logout')options.onLogout?.();
  if(action==='search'){dialog('<h2>'+t.search+'</h2><input type="search" aria-label="'+t.search+'" placeholder="'+t.search+'"><nav class="search-results">'+navItems().map(([key,url])=>link(url,t[key])).join('')+'</nav>');root.querySelector('input').addEventListener('input',e=>{const q=e.target.value.toLocaleLowerCase();root.querySelectorAll('.search-results a').forEach(a=>a.hidden=!a.textContent.toLocaleLowerCase().includes(q));});}
  if(action==='language'){dialog('<h2>Language</h2><select aria-label="Language">'+[['en','English'],['ar','العربية'],['zh','中文'],['fr','Français'],['de','Deutsch'],['he','עברית'],['es','Español']].map(([code,name])=>'<option value="'+code+'" '+(code===language?'selected':'')+'>'+name+'</option>').join('')+'</select>');root.querySelector('dialog select').addEventListener('change',e=>{language=e.target.value;t=dashboardCopy(language);try{localStorage.setItem('ofek-ai-language',language);}catch{}render();});}
  if(action==='week-back'||action==='week-next'){weekOffset+=action==='week-next'?1:-1;root.querySelector('.week').innerHTML=weekHTML();}
  if(action==='day-back'||action==='day-next'){
   selectedDay.setDate(selectedDay.getDate()+(action==='day-next'?1:-1));
   const request=++dayRequest;diary=null;diaryFailed=false;
   root.querySelector('.diary').innerHTML='<p role="status">'+t.loading+'</p>';
   try {const result=await options.loadDay?.(dateKey(selectedDay));if(request!==dayRequest)return;diary=result||null;}
   catch {if(request!==dayRequest)return;diaryFailed=true;}
   root.querySelector('.diary').innerHTML=diaryHTML();paintRing();
  }
 });
 root.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
 render();
 return {update(next){model=next;diary=next.diary||null;diaryFailed=!!next.diaryFailed;render();},setLanguage(code){language=code;t=dashboardCopy(language);render();}};
}
