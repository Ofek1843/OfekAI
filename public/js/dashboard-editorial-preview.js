import { mountDashboard } from './dashboard-editorial-view.mjs';
const workouts=[
 {id:'sample-upper',name:'Upper Body Strength',plan:{programName:'Upper Body Strength',durationWeeks:4,experienceLevel:'Intermediate',sessionDurationMinutes:45,sessions:[{name:'Upper body',exercises:Array.from({length:6},(_,i)=>({name:['Bench press','Seated row','Shoulder press','Lat pulldown','Biceps curl','Triceps extension'][i],sets:3,reps:10}))}]}},
 {id:'sample-full',name:'Full Body Foundation',plan:{durationWeeks:6,experienceLevel:'Beginner',sessions:[{name:'Full body',exercises:[{name:'Squat',sets:3,reps:8}]}]}},
 {id:'sample-ppl',name:'Push Pull Legs',plan:{durationWeeks:12,experienceLevel:'Intermediate',sessions:[{name:'Push',exercises:[{name:'Bench press',sets:3,reps:8}]}]}}
];
const model={name:'Ofek',photoURL:'/assets/dashboard/profile-preview.webp',activeWorkoutId:'sample-upper',activeMealId:'sample-balanced',workouts,
 meals:[{id:'sample-balanced',name:'Balanced Performance',plan:{durationWeeks:4,dailyCalories:2800,proteinGrams:200,carbsGrams:320,fatGrams:80}},
 {id:'sample-lean',name:'Lean & Defined',plan:{durationWeeks:4,dailyCalories:2200}},{id:'sample-muscle',name:'Muscle Gain',plan:{durationWeeks:8,dailyCalories:3200}}],
 diary:{entries:[{calories:1870,proteinGrams:180,carbsGrams:220,fatGrams:60}]},
 logs:[{completedAt:'2025-06-01T12:00:00',sessionName:'Lower Body Strength',durationSeconds:48*60,exercises:Array(6).fill({})},{completedAt:'2025-05-29T12:00:00',sessionName:'Upper Body Hypertrophy',durationSeconds:52*60,exercises:Array(6).fill({})},{completedAt:'2025-05-27T12:00:00',sessionName:'Full Body Conditioning',durationSeconds:45*60,exercises:Array(8).fill({})}]};
const view=mountDashboard(document.querySelector('#dashboardRoot'),model,{today:new Date('2025-06-02T09:00:00'),language:'en',loadDay:async()=>({entries:[]})});
const toolbar=document.createElement('div');toolbar.className='preview-toolbar';
toolbar.innerHTML='<span>Design preview · sample data</span><button data-preview="filled">Saved plans</button><button data-preview="empty">New account</button><select aria-label="Preview language"><option value="en">English</option><option value="he">עברית</option><option value="ar">العربية</option><option value="de">Deutsch</option><option value="fr">Français</option><option value="es">Español</option><option value="zh">中文</option></select>';
document.body.append(toolbar);
if(new URLSearchParams(location.search).has('clean'))toolbar.hidden=true;
toolbar.addEventListener('click',event=>{const state=event.target.dataset.preview;if(state)view.update(state==='empty'?{name:'Ofek',workouts:[],meals:[],logs:[]}:model);});
toolbar.querySelector('select').addEventListener('change',event=>view.setLanguage(event.target.value));
