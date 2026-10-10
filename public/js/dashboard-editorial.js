import { auth, db } from './firebase-config.js';
import { guardProtectedPage } from './verification-gate.js';
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { disassociateCurrentInstallation } from './push-notifications.js';
import { loadDailyLog } from './daily-nutrition-store.mjs?v=20260928-multilingual-food-1';
import { mountDashboard, dateKey, asDate } from './dashboard-editorial-view.mjs';
import { dashboardCopy, dashboardLanguages } from './dashboard-editorial-i18n.mjs';
import { trackPageView } from './analytics.js';
let language='en';
try { const saved=localStorage.getItem('ofek-ai-language');if(dashboardLanguages.includes(saved))language=saved; } catch {}
const copy=dashboardCopy(language);
const root=document.querySelector('#dashboardRoot');
root.querySelector('[role="status"]').textContent=copy.loading;
let dashboard;
async function load(user) {
 const tasks=[
  getDoc(doc(db,'users',user.uid)),getDoc(doc(db,'users',user.uid,'settings','main')),
  getDocs(query(collection(db,'users',user.uid,'workoutPlans'),limit(30))),
  getDocs(query(collection(db,'users',user.uid,'nutritionPlans'),limit(30))),
  getDocs(query(collection(db,'users',user.uid,'workoutLogs'),orderBy('completedAt','desc'),limit(30))),
  loadDailyLog(db,user.uid,dateKey(new Date()))
 ];
 const results=await Promise.allSettled(tasks);
 if(auth.currentUser?.uid!==user.uid)return;
 const data=i=>results[i].status==='fulfilled'?results[i].value:null;
 const profile=data(0)?.data()||{}, settings=data(1)?.data()||{};
 const docs=i=>(data(i)?.docs||[]).map(d=>({...d.data(),id:d.id})).sort((a,b)=>(asDate(b.createdAt)?.getTime()||0)-(asDate(a.createdAt)?.getTime()||0));
 const model={name:settings.displayName||user.displayName||'',photoURL:user.photoURL||'',workouts:docs(2),meals:docs(3),
  logs:(data(4)?.docs||[]).map(d=>({...d.data(),id:d.id})),activeWorkoutId:profile.activeWorkoutPlanId,activeMealId:profile.activeNutritionPlanId,
  diary:data(5),workoutsFailed:!data(2),mealsFailed:!data(3),logsFailed:!data(4),diaryFailed:!data(5),error:results.some(r=>r.status==='rejected')?copy.error:''};
 // Active plans may be older than the first page of saved plans.
 await Promise.all([['workouts','workoutPlans',model.activeWorkoutId],['meals','nutritionPlans',model.activeMealId]].map(async([key,folder,id])=>{
  if(!id||model[key].some(p=>p.id===id))return;
  try{const snap=await getDoc(doc(db,'users',user.uid,folder,id));if(snap.exists())model[key].unshift({...snap.data(),id:snap.id});}catch{model.error=copy.error;}
 }));
 if(auth.currentUser?.uid!==user.uid)return;
 const options={language,loadDay:key=>loadDailyLog(db,user.uid,key),onLogout:async()=>{
  try{await disassociateCurrentInstallation();await signOut(auth);window.location.assign('/auth.html');}
  catch{root.querySelector('.status').textContent=copy.error;}
 }};
 if(dashboard)dashboard.update(model);else dashboard=mountDashboard(root,model,options);
}
guardProtectedPage({onAuthenticated:async(user)=>{
 try{await load(user);}catch{root.textContent=copy.error;}
}});
trackPageView({page:'dashboard'});
