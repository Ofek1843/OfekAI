import{auth,db}from"./firebase-config.js";import{addDoc,collection,serverTimestamp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";import{guardProtectedPage}from"./verification-gate.js";import{createWeeklyScheduleDays}from"./schedule-utils.js";import{exerciseImageUrl,fallbackExerciseImageUrl}from"./exercise-image.js";
const $=s=>document.querySelector(s),he=(localStorage.getItem("ofek-ai-language")||"en")==="he",esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);let user;
const exercises=[
  ["Back Squat","Barbell","Quads"],["Front Squat","Barbell","Quads"],["Hack Squat","Machine","Quads"],["Smith Machine Squat","Smith Machine","Quads"],["Leg Press","Machine","Quads"],["Leg Extension","Machine","Quads"],["Seated Leg Curl","Machine","Hamstrings"],["Lying Leg Curl","Machine","Hamstrings"],["Romanian Deadlift","Barbell","Hamstrings"],["Conventional Deadlift","Barbell","Back"],["Hip Thrust","Barbell","Glutes"],["Bulgarian Split Squat","Dumbbells","Quads"],["Walking Lunge","Dumbbells","Quads"],["Step-up","Dumbbells","Quads"],["Cable Glute Kickback","Cable","Glutes"],["Hip Abductor Machine","Machine","Hip Abductors"],["Hip Adductor Machine","Machine","Hip Adductors"],["Standing Calf Raise","Machine","Calves"],["Seated Calf Raise","Machine","Calves"],
  ["Bench Press","Barbell","Chest"],["Incline Bench Press","Barbell","Chest"],["Dumbbell Bench Press","Dumbbells","Chest"],["Incline Dumbbell Press","Dumbbells","Chest"],["Chest Press Machine","Machine","Chest"],["Pec Deck","Machine","Chest"],["Cable Fly","Cable","Chest"],["Push-up","Bodyweight","Chest"],["Dip","Bodyweight","Chest"],
  ["Pull-up","Pull-up Bar","Back"],["Chin-up","Pull-up Bar","Back"],["One-arm Pull-up","Pull-up Bar","Back"],["Assisted One-arm Pull-up","Pull-up Bar","Back"],["Archer Pull-up","Pull-up Bar","Back"],["Lat Pulldown","Cable Machine","Back"],["Neutral-grip Lat Pulldown","Cable Machine","Back"],["Seated Cable Row","Cable Machine","Back"],["Chest-supported Row","Machine","Back"],["T-bar Row","Machine","Back"],["Barbell Row","Barbell","Back"],["One-arm Dumbbell Row","Dumbbell","Back"],["Straight-arm Pulldown","Cable","Back"],["Back Extension","Roman Chair","Lower Back"],
  ["Overhead Press","Barbell","Shoulders"],["Dumbbell Shoulder Press","Dumbbells","Shoulders"],["Machine Shoulder Press","Machine","Shoulders"],["Lateral Raise","Dumbbells","Shoulders"],["Cable Lateral Raise","Cable","Shoulders"],["Rear Delt Fly","Dumbbells","Rear Delts"],["Reverse Pec Deck","Machine","Rear Delts"],["Face Pull","Cable","Rear Delts"],
  ["Barbell Curl","Barbell","Biceps"],["EZ-bar Curl","EZ Bar","Biceps"],["Dumbbell Curl","Dumbbells","Biceps"],["Incline Dumbbell Curl","Dumbbells","Biceps"],["Hammer Curl","Dumbbells","Biceps"],["Preacher Curl","EZ Bar","Biceps"],["Machine Preacher Curl","Machine","Biceps"],["Cable Curl","Cable","Biceps"],
  ["Triceps Pushdown","Cable","Triceps"],["Rope Triceps Pushdown","Cable","Triceps"],["Overhead Triceps Extension","Cable","Triceps"],["Skull Crusher","EZ Bar","Triceps"],["Close-grip Bench Press","Barbell","Triceps"],
  ["Plank","Bodyweight","Core"],["Hanging Leg Raise","Pull-up Bar","Core"],["Cable Crunch","Cable","Core"],["Ab Wheel Rollout","Ab Wheel","Core"],["Russian Twist","Bodyweight","Core"],["Muscle-up","Pull-up Bar","Full Body"],["Ring Row","Gymnastic Rings","Back"],["Pistol Squat","Bodyweight","Quads"],["Nordic Curl","Bodyweight","Hamstrings"]
].map(([name,equipment,muscleGroup])=>({name,equipment,muscleGroup}));
const ui=he?{title:"יצירת תוכנית אימון בעצמך",intro:"כבר יש לך תוכנית? בנה אותה כאן כדי לקבל מעקב חי, זמני מנוחה, היסטוריה וגרפי התקדמות.",name:"שם התוכנית",days:"מספר אימונים בשבוע",addDay:"+ הוספת יום",save:"שמירת תוכנית",day:"אימון",duplicate:"שכפול יום",remove:"מחיקה",addExercise:"+ הוספת תרגיל",exercise:"תרגיל — אפשר לחפש באנגלית",suggestLabel:"הצעות תרגילים",equipment:"ציוד",sets:"סטים",reps:"חזרות יעד",rest:"מנוחה בשניות",saving:"שומר...",saved:"התוכנית נשמרה. אפשר לבחור אותה כתוכנית הפעילה.",limit:"ניתן לשמור עד 5 תוכניות.",invalid:"יש לתת שם לתוכנית ולהוסיף לפחות תרגיל אחד בכל יום.",error:"לא ניתן לשמור את התוכנית."}:{title:"Build your own workout plan",intro:"Already have a program? Rebuild it here to unlock live tracking, rest guidance, history and progress charts.",name:"Plan name",days:"Training days per week",addDay:"+ Add day",save:"Save plan",day:"Workout",duplicate:"Duplicate day",remove:"Remove",addExercise:"+ Add exercise",exercise:"Exercise — type to search",suggestLabel:"Exercise suggestions",equipment:"Equipment",sets:"Sets",reps:"Target reps",rest:"Rest seconds",saving:"Saving...",saved:"Plan saved. You can now make it your active plan.",limit:"You can save up to 5 plans.",invalid:"Name the plan and add at least one exercise to every day.",error:"Could not save the plan."};
function localize(){document.documentElement.lang=he?"he":"en";document.documentElement.dir=he?"rtl":"ltr";[["pageTitle","title"],["pageIntro","intro"],["nameLabel","name"],["daysLabel","days"],["addDay","addDay"],["savePlan","save"]].forEach(([id,key])=>$("#"+id).textContent=ui[key])}
// FUTURE (not in scope here): the Manual Builder stores rir:"1-3" silently in
// readExercise() below and never shows it, so a user cannot set their own
// effort target. A visible Effort/RIR control belongs in exerciseRow() as a
// fifth <label> beside sets/reps/rest (class "rir"), read back in
// readExercise() to replace the hardcoded literal, with the ui table gaining
// effort/rirHelp copy in both languages to match public/js/workout-builder.js.
// Deliberately left alone: adding it now would change what manual plans
// store, which is a schema change this task must not make.
function exerciseRow(data={}){return`<div class="exercise-row"><label>${ui.exercise}<input class="exercise-name" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="exerciseSuggest" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(data.name||"")}" placeholder="Leg extension"></label><label>${ui.equipment}<input class="equipment" value="${esc(data.equipment||"")}" placeholder="Machine"></label><label>${ui.sets}<input class="sets" type="number" min="1" max="20" value="${Number(data.sets)||3}"></label><label>${ui.reps}<input class="reps" value="${esc(data.reps||"8-12")}"></label><label>${ui.rest}<input class="rest" type="number" min="15" max="600" value="${Number(data.restSeconds)||90}"></label><button class="remove-exercise" type="button">×</button></div>`}
function dayCard(data={}){const card=document.createElement("section");card.className="day-card";card.innerHTML=`<div class="day-head"><input class="day-name" maxlength="60" value="${esc(data.name||`${ui.day} ${$("#days").children.length+1}`)}"><button class="duplicate-day" type="button">${ui.duplicate}</button><button class="remove-day" type="button">${ui.remove}</button></div><div class="exercise-list">${(data.exercises?.length?data.exercises:[{}]).map(exerciseRow).join("")}</div><button class="add-exercise" type="button">${ui.addExercise}</button>`;return card}
function addDay(data){$("#days").append(dayCard(data));syncDays()}
function findExercise(name){return exercises.find(item=>item.name.toLowerCase()===name.trim().toLowerCase())}
function readExercise(row){const name=row.querySelector(".exercise-name").value.trim();const known=findExercise(name);return{name,demoName:name,muscleGroup:known?.muscleGroup||"General",equipment:row.querySelector(".equipment").value.trim()||known?.equipment||"Other",sets:Number(row.querySelector(".sets").value)||3,reps:row.querySelector(".reps").value.trim()||"8-12",restSeconds:Number(row.querySelector(".rest").value)||90,rir:"1-3",notes:""}}
function readDay(card,index){return{day:index+1,name:card.querySelector(".day-name").value.trim()||`${ui.day} ${index+1}`,exercises:[...card.querySelectorAll(".exercise-row")].map(readExercise).filter(e=>e.name)}}
function syncDays(){$("#daysPerWeek").value=$("#days").children.length;[...$("#days").children].forEach((card,index)=>{if(!card.querySelector(".day-name").value.trim())card.querySelector(".day-name").value=`${ui.day} ${index+1}`})}
async function save(){const name=$("#planName").value.trim(),sessions=[...$("#days").children].map(readDay);if(!name||!sessions.length||sessions.some(s=>!s.exercises.length)){show(ui.invalid,true);return}const button=$("#savePlan");button.disabled=true;button.textContent=ui.saving;try{const ref=collection(db,"users",user.uid,"workoutPlans");await addDoc(ref,{name,active:false,source:"manual",plan:{programName:name,daysPerWeek:sessions.length,durationWeeks:8,goal:he?"תוכנית אישית":"Custom plan",sessions,weeklyScheduleDays:createWeeklyScheduleDays(sessions.length)},createdAt:serverTimestamp(),updatedAt:serverTimestamp()});show(ui.saved);button.textContent="✓ "+ui.saved}catch(error){show(ui.error,true);button.disabled=false;button.textContent=ui.save}}
function show(message,error=false){$("#status").textContent=message;$("#status").classList.toggle("error",error)}
$("#days").addEventListener("input",event=>{if(!event.target.classList.contains("exercise-name"))return;const known=findExercise(event.target.value);if(!known)return;const row=event.target.closest(".exercise-row");row.querySelector(".equipment").value=known.equipment;row.dataset.muscleGroup=known.muscleGroup});

// Rich exercise autocomplete for the manual builder: a single floating listbox
// (appended to <body> so it escapes any card overflow and layers above the
// page and the mobile keyboard). It searches the curated `exercises` catalog
// above and resolves each thumbnail through the shared exercise-image resolver
// (exercise-image.js) -- no second catalog, no external images. Selecting a
// suggestion fills the exercise name + equipment + target muscle only; sets,
// reps and rest are never touched, and a non-matching custom name is always
// allowed.
function normalizeQuery(value=""){return String(value).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim()}
function matchExercises(query,limit=8){
  const q=normalizeQuery(query);
  if(!q)return[];
  const scored=[];
  for(const item of exercises){
    const name=normalizeQuery(item.name);
    let score=0;
    if(name===q)score=1000;
    else if(name.startsWith(q))score=800-name.length;
    else if(name.split(" ").some(word=>word.startsWith(q)))score=600-name.length;
    else if(name.includes(q))score=400-name.length;
    else{
      const muscle=normalizeQuery(item.muscleGroup),equipment=normalizeQuery(item.equipment);
      if(muscle.startsWith(q)||equipment.startsWith(q))score=200-name.length;
    }
    if(score>0)scored.push({item,score});
  }
  return scored.sort((a,b)=>b.score-a.score||a.item.name.localeCompare(b.item.name)).slice(0,limit).map(entry=>entry.item);
}
function initExerciseAutocomplete(){
  const days=$("#days");
  const list=document.createElement("ul");
  list.id="exerciseSuggest";
  list.className="exercise-suggest";
  list.setAttribute("role","listbox");
  list.setAttribute("aria-label",ui.suggestLabel);
  list.dir="ltr";
  list.hidden=true;
  document.body.append(list);
  let activeInput=null,items=[],activeIndex=-1,blurTimer=0;
  const viewport=()=>{
    const vv=window.visualViewport;
    const width=(vv&&vv.width)||window.innerWidth||document.documentElement.clientWidth||360;
    const height=(vv&&vv.height)||window.innerHeight||document.documentElement.clientHeight||640;
    return{width,height,offsetLeft:(vv&&vv.offsetLeft)||0,offsetTop:(vv&&vv.offsetTop)||0};
  };
  function close(){
    if(list.hidden&&!activeInput)return;
    list.hidden=true;
    list.innerHTML="";
    items=[];activeIndex=-1;
    if(activeInput)activeInput.setAttribute("aria-expanded","false");
    activeInput=null;
  }
  function position(){
    if(list.hidden||!activeInput)return;
    const rect=activeInput.getBoundingClientRect();
    const view=viewport();
    const width=Math.max(220,Math.min(rect.width,view.width-16));
    let left=rect.left;
    left=Math.max(view.offsetLeft+8,Math.min(left,view.offsetLeft+view.width-width-8));
    const spaceBelow=(view.offsetTop+view.height)-rect.bottom;
    const spaceAbove=rect.top-view.offsetTop;
    const flipUp=spaceBelow<200&&spaceAbove>spaceBelow;
    const maxHeight=Math.max(120,Math.min(340,(flipUp?spaceAbove:spaceBelow)-12));
    list.style.width=`${width}px`;
    list.style.left=`${left}px`;
    list.style.maxHeight=`${maxHeight}px`;
    if(flipUp){list.style.top="auto";list.style.bottom=`${view.height-rect.top+6}px`;}
    else{list.style.bottom="auto";list.style.top=`${rect.bottom+6}px`;}
  }
  function render(matches){
    items=matches;activeIndex=-1;
    if(!matches.length){close();return;}
    list.innerHTML=matches.map((item,index)=>{
      const image=exerciseImageUrl({name:item.name,demoName:item.name});
      const meta=[item.muscleGroup,item.equipment].filter(Boolean).join(" · ");
      return`<li role="option" id="exerciseSuggest-${index}" data-index="${index}" aria-selected="false"><img src="${esc(image)}" alt="" loading="lazy" decoding="async" onerror="this.src='${esc(fallbackExerciseImageUrl())}'"><span class="exercise-suggest-text"><strong>${esc(item.name)}</strong>${meta?`<small>${esc(meta)}</small>`:""}</span></li>`;
    }).join("");
    list.hidden=false;
    activeInput.setAttribute("aria-expanded","true");
    position();
  }
  function highlight(index){
    activeIndex=index;
    [...list.children].forEach((node,nodeIndex)=>{
      const on=nodeIndex===index;
      node.classList.toggle("is-active",on);
      node.setAttribute("aria-selected",on?"true":"false");
      if(on)node.scrollIntoView({block:"nearest"});
    });
    if(activeInput)activeInput.setAttribute("aria-activedescendant",index>=0?`exerciseSuggest-${index}`:"");
  }
  function choose(item){
    if(!activeInput||!item)return;
    const row=activeInput.closest(".exercise-row");
    activeInput.value=item.name;
    if(row){
      const equipment=row.querySelector(".equipment");
      if(equipment&&item.equipment)equipment.value=item.equipment;
      row.dataset.muscleGroup=item.muscleGroup||"";
    }
    activeInput.dispatchEvent(new Event("input",{bubbles:true}));
    close();
    activeInput=null;
  }
  days.addEventListener("focusin",event=>{
    const input=event.target.closest(".exercise-name");
    if(!input)return;
    window.clearTimeout(blurTimer);
    activeInput=input;
    if(input.value.trim())render(matchExercises(input.value));
  });
  days.addEventListener("input",event=>{
    const input=event.target.closest(".exercise-name");
    if(!input)return;
    activeInput=input;
    render(matchExercises(input.value));
  });
  days.addEventListener("keydown",event=>{
    const input=event.target.closest(".exercise-name");
    if(!input)return;
    if(event.key==="Escape"){if(!list.hidden){event.stopPropagation();close();}return;}
    if(list.hidden||!items.length){
      if(event.key==="ArrowDown"&&input.value.trim()){render(matchExercises(input.value));event.preventDefault();}
      return;
    }
    if(event.key==="ArrowDown"){event.preventDefault();highlight((activeIndex+1)%items.length);}
    else if(event.key==="ArrowUp"){event.preventDefault();highlight((activeIndex-1+items.length)%items.length);}
    else if(event.key==="Enter"){if(activeIndex>=0){event.preventDefault();choose(items[activeIndex]);}else close();}
    else if(event.key==="Tab"&&activeIndex>=0){choose(items[activeIndex]);}
  });
  days.addEventListener("blur",event=>{
    if(!event.target.closest(".exercise-name"))return;
    blurTimer=window.setTimeout(close,140);
  },true);
  list.addEventListener("pointerdown",event=>{
    const option=event.target.closest("li[data-index]");
    if(!option)return;
    event.preventDefault();
    choose(items[Number(option.dataset.index)]);
  });
  list.addEventListener("pointermove",event=>{
    const option=event.target.closest("li[data-index]");
    if(option)highlight(Number(option.dataset.index));
  });
  document.addEventListener("pointerdown",event=>{
    if(list.hidden)return;
    if(event.target.closest("#exerciseSuggest")||event.target.closest(".exercise-name"))return;
    close();
  });
  window.addEventListener("scroll",()=>{if(!list.hidden)position();},true);
  window.addEventListener("resize",()=>{if(!list.hidden)position();});
  window.visualViewport?.addEventListener("resize",()=>{if(!list.hidden)position();});
  window.visualViewport?.addEventListener("scroll",()=>{if(!list.hidden)position();});
}
localize();for(let initialDay=0;initialDay<3;initialDay+=1)addDay();$("#addDay").addEventListener("click",()=>addDay());$("#days").addEventListener("click",event=>{const card=event.target.closest(".day-card");if(event.target.closest(".add-exercise"))card.querySelector(".exercise-list").insertAdjacentHTML("beforeend",exerciseRow());if(event.target.closest(".remove-exercise")){const rows=card.querySelectorAll(".exercise-row");if(rows.length>1)event.target.closest(".exercise-row").remove()}if(event.target.closest(".remove-day")&&$("#days").children.length>1){card.remove();syncDays()}if(event.target.closest(".duplicate-day")){const data=readDay(card,0);addDay({name:data.name+" · copy",exercises:data.exercises})}});$("#daysPerWeek").addEventListener("change",()=>{const target=Math.max(1,Math.min(7,Number($("#daysPerWeek").value)||1));while($("#days").children.length<target)addDay();while($("#days").children.length>target)$("#days").lastElementChild.remove();syncDays()});$("#savePlan").addEventListener("click",save);initExerciseAutocomplete();guardProtectedPage({onAuthenticated:current=>{user=current}});
