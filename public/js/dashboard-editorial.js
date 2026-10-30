import { auth, db } from './firebase-config.js';
import { guardProtectedPage } from './verification-gate.js';
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { disassociateCurrentInstallation } from './push-notifications.js';
import { loadDailyLog, normalizeLog } from './daily-nutrition-store.mjs?v=20261013-nutrition-recovery-1';
import { loadDashboardDay } from './dashboard-diary.mjs';
import { mountDashboard, dateKey, asDate } from './dashboard-editorial-view.mjs?v=20261030-compact-1';
import { dashboardCopy, dashboardLanguages } from './dashboard-editorial-i18n.mjs?v=20261030-focus-1';
import { trackEvent, trackPageView } from './analytics.js?v=20261020-guest-dashboard-1';
import { loadDashboardSections } from './dashboard-load.mjs';
let language='en';
try { const saved=localStorage.getItem('ofek-ai-language');if(dashboardLanguages.includes(saved))language=saved; } catch {}
const copy=dashboardCopy(language);
const root=document.querySelector('#dashboardRoot');
root.querySelector('[role="status"]').textContent=copy.loading;
let dashboard;
let dashboardRequest=0;
let dashboardIsGuest=false;
function showGuestDashboard() {
 ++dashboardRequest;
 document.body.style.visibility='visible';
 try {
  if (sessionStorage.getItem('fp_guest_dashboard_seen') !== '1') {
   sessionStorage.setItem('fp_guest_dashboard_seen','1');
   trackEvent('guest_started',{source:'dashboard'});
  }
 } catch { trackEvent('guest_started',{source:'dashboard'}); }
 const model={name:'',workouts:[],meals:[],logs:[],diary:null,activeWorkoutId:null,activeMealId:null,error:''};
 dashboard=mountDashboard(root,model,{language,guest:true});
 dashboardIsGuest=true;
}
const loadVisibleDay = (uid, key) => loadDashboardDay({
  uid, dateKey: key,
  loadClient: () => loadDailyLog(db, uid, key),
  loadServer: async () => {
    const user = auth.currentUser;
    if (user?.uid !== uid) throw new Error('User changed during food-log read.');
    const response = await fetch(`/api/daily-nutrition/day/${key}`, {
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw new Error(`DIARY_HTTP_${response.status}`);
    const { log } = await response.json();
    return normalizeLog(key, log);
  }
});
async function load(user) {
 const request=++dashboardRequest;
 const results=await loadDashboardSections({
  profile:()=>getDoc(doc(db,'users',user.uid)),settings:()=>getDoc(doc(db,'users',user.uid,'settings','main')),
  workouts:()=>getDocs(query(collection(db,'users',user.uid,'workoutPlans'),limit(30))),
  meals:()=>getDocs(query(collection(db,'users',user.uid,'nutritionPlans'),limit(30))),
  logs:()=>getDocs(query(collection(db,'users',user.uid,'workoutLogs'),orderBy('completedAt','desc'),limit(30))),
  diary:()=>loadVisibleDay(user.uid,dateKey(new Date()))
 });
 if(request!==dashboardRequest||auth.currentUser?.uid!==user.uid)return;
 const data=key=>results[key].status==='fulfilled'?results[key].value:null;
 const failures=Object.entries(results).filter(([,result])=>result.status==='rejected').map(([section,result])=>({section,code:result.code}));
 // No profile values, document bodies, tokens or raw SDK messages in diagnostics.
 if(failures.length)console.warn('[dashboard] section reads failed',failures);
 const profile=data('profile')?.data()||{}, settings=data('settings')?.data()||{};
 const docs=key=>(data(key)?.docs||[]).map(d=>({...d.data(),id:d.id})).sort((a,b)=>(asDate(key==='logs'?b.completedAt:b.createdAt)?.getTime()||0)-(asDate(key==='logs'?a.completedAt:a.createdAt)?.getTime()||0));
 const model={name:settings.displayName||user.displayName||'',photoURL:user.photoURL||'',workouts:docs('workouts'),meals:docs('meals'),
  logs:docs('logs'),activeWorkoutId:profile.activeWorkoutPlanId,activeMealId:profile.activeNutritionPlanId,
  diary:data('diary'),workoutsFailed:!data('workouts'),mealsFailed:!data('meals'),logsFailed:!data('logs'),diaryFailed:!data('diary'),loadFailures:failures,error:''};
 // Active plans may be older than the first page of saved plans.
 await Promise.all([['workouts','workoutPlans',model.activeWorkoutId],['meals','nutritionPlans',model.activeMealId]].map(async([key,folder,id])=>{
  if(!id||model[key].some(p=>p.id===id))return;
  const active=await loadDashboardSections({[key]:()=>getDoc(doc(db,'users',user.uid,folder,id))});
  if(active[key].status==='fulfilled'){const snap=active[key].value;if(snap.exists())model[key].unshift({...snap.data(),id:snap.id});}
  else {model.loadFailures.push({section:key,code:active[key].code});if(!model[key].length)model[key+'Failed']=true;}
 }));
 if(request!==dashboardRequest||auth.currentUser?.uid!==user.uid)return;
 const options={language,workoutUser:user,loadDay:key=>loadVisibleDay(user.uid,key),onRetry:()=>load(user),onLogout:async()=>{
  try{await disassociateCurrentInstallation();await signOut(auth);window.location.assign('/auth.html');}
  catch{root.querySelector('.status').textContent=copy.error;}
 }};
 if(dashboard&&!dashboardIsGuest)dashboard.update(model);
 else dashboard=mountDashboard(root,model,options);
 dashboardIsGuest=false;
 // The social avatar is optional and should never delay the dashboard.
 void (async()=>{
  try {
   const response=await fetch('/api/social/identity',{headers:{Authorization:`Bearer ${await user.getIdToken()}`},signal:AbortSignal.timeout(6000)});
   if(!response.ok)return;
   const social=await response.json(), photo=social.profile?.photoURL;
   if(photo&&request===dashboardRequest&&auth.currentUser?.uid===user.uid&&!dashboardIsGuest){model.photoURL=photo;dashboard.update(model);}
  } catch {}
 })();
}
guardProtectedPage({onSignedOut:showGuestDashboard,onAuthenticated:async(user)=>{
 try{
  await load(user);
  if(auth.currentUser?.uid!==user.uid||!dashboard)return;
  document.documentElement.dataset.pwaInstallAllowed='true';
  window.dispatchEvent(new Event('fuelphysique:dashboard-authenticated'));
 }catch{root.textContent=copy.error;}
}});
trackPageView({page:'dashboard'});
