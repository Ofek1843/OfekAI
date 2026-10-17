"use strict";
// Audit specifications, including intentionally RED safety regressions.
// Expected behavior is asserted; failures are NOT marked todo or disguised as passes.
const test = require("node:test");
const assert = require("node:assert/strict");
const {lib,createHarness,nutritionProfile:N,workoutProfile:W} = require("./harness.cjs");
const {calculateNutritionTargets:targets,ACTIVITY_MULTIPLIERS} = lib("nutrition-targets");
const {FOODS,CATALOG,macrosFor,buildMealOption,buildMealSlots,filterMeals,detectAllergens} = lib("meal-catalog");
const {evaluatePlanTotals,verifyDisplayedArithmetic,sumSelectedOptions} = lib("nutrition-totals");
const {buildLocalWorkoutProgram} = lib("local-demo-generators");
const {assessSafety} = lib("health-safety");
const macroEnergy = (p,f,c) => 4*p + 9*f + 4*c; // Independent mathematical oracle, not a production export.
const manual = input => createHarness().request("/api/nutrition/manual/targets",input);
const nutrition = (input=N,output="{}") => createHarness({aiOutput:output}).request("/api/nutrition-builder",input);
const workout = (input=W,mutate=()=>{}) => {
  const program=buildLocalWorkoutProgram(W); mutate(program);
  return createHarness({aiOutput:JSON.stringify(program)}).request("/api/workout-builder",input);
};
const exercises = r => r.body.program?.sessions.flatMap(s=>s.exercises)||[];
const blocks = r => r.status>=400 && r.status<500;

test("A: female MSJ uses unrounded 1360.25 for TDEE, rounded BMR display",()=>{
  const expected=10*60+6.25*165-5*22-161;
  assert.equal(expected,1360.25); const t=targets(N);
  assert.equal(t.bmr,1360); assert.equal(t.tdee,Math.round(expected*1.55)); assert.equal(t.dailyCalories,2100);
});
test("B: male MSJ 1526.25, coefficient difference exactly 166",()=>{
  const t=targets({...N,gender:"male"}); assert.equal(10*60+6.25*165-5*22+5,1526.25);
  assert.equal(t.bmr,1526); assert.equal(t.tdee,2366); assert.equal(t.bmr-targets(N).bmr,166);
});
test("C: hypothetical multiplier 1.8 is a reference, real app has 1.725/1.9; no female ceiling",async()=>{
  assert.equal(1722.75*1.8,3100.9500000000003);
  assert.equal(ACTIVITY_MULTIPLIERS.veryActive,1.725); assert.equal(ACTIVITY_MULTIPLIERS.extremelyActive,1.9);
  const r=await manual({...N,height:175,weight:90,activityLevel:"extremelyActive"});
  assert.equal(r.status,200); assert.ok(JSON.stringify(r.body).includes("3250"));
});
test("D: active woman can exceed small sedentary man's target",()=>{
  const f=targets({...N,height:175,weight:90,activityLevel:"extremelyActive"});
  const m=targets({...N,gender:"male",weight:55,height:160,activityLevel:"sedentary"});
  assert.ok(f.dailyCalories>m.dailyCalories); assert.equal(f.dailyCalories,3250); assert.equal(m.dailyCalories,1750);
});
test("E: ordinary adult bulking target uses TDEE +250 then rounding, no doubled exercise calories",async()=>{
  const p={...N,age:30,gender:"male",weight:80,height:180,goal:"buildMuscle"};
  const t=targets(p); assert.equal(t.tdee,2759); assert.equal(t.dailyCalories,3000);
  const r=await nutrition(p); assert.equal(r.status,200); assert.equal(r.body.plan.dailyCalories,3000);
  assert.ok(evaluatePlanTotals(r.body.plan).withinTolerance); assert.ok(verifyDisplayedArithmetic(r.body.plan).exact);
});
test("F stress extension / SAF-04: underweight active fat-loss request must be referred, not ordinary diet",async t=>{
  const p={...N,age:30,height:165,weight:45,activityLevel:"veryActive",goal:"loseFat"};
  assert.throws(()=>targets(p),error=>error.status===422);
  const r=await manual(p); t.diagnostic(JSON.stringify({BMI:45/1.65**2,response:r}));
  assert.ok(blocks(r),"unsupported underweight cutting request received ordinary targets");
});
test("F: small active adult reporting leanness: arithmetic verified, individual energy availability not inferred",async t=>{
  const p={...N,weight:55,activityLevel:"veryActive",goal:"loseFat",additionalNotes:"I am lean and physically active."};
  const c=targets(p);assert.equal(c.bmr,1310);assert.equal(c.tdee,2260);assert.equal(c.dailyCalories,1900); // expenditure-scaled starting adjustment, no longer a fixed -400
  const r=await nutrition(p);assert.equal(r.status,200);assert.ok(evaluatePlanTotals(r.body.plan).withinTolerance);
  t.diagnostic(JSON.stringify({reportedLean:true,BMI:55/1.65**2,targets:c,status:r.status,energyAvailability:"NOT VERIFIED: FFM and exercise expenditure not provided"}));
});
test("G: independent conventional 4/9/4 oracle gives 1930; inverse production residual reconstructs carbs",()=>{
  assert.equal(macroEnergy(120,50,250),1930);
  // G itself is the oracle, not falsely attributed to a production macro-energy function.
  for(const gender of ["female","male"]) for(const goal of ["loseFat","maintainWeight","buildMuscle"]){
    const t=targets({...N,gender,goal});
    assert.equal(t.carbsGrams,Math.round((t.dailyCalories-4*t.proteinGrams-9*t.fatGrams)/4));
    assert.ok(Math.abs(macroEnergy(t.proteinGrams,t.fatGrams,t.carbsGrams)-t.dailyCalories)<=2);
  }
});
test("H: changing sex alone changes neither actual workout prompt nor weekly volume",async()=>{
  const payload=JSON.stringify(buildLocalWorkoutProgram(W));
  const m=createHarness({aiOutput:payload}),f=createHarness({aiOutput:payload});
  const a=await m.request("/api/workout-builder",W),b=await f.request("/api/workout-builder",{...W,gender:"female"});
  assert.equal(a.status,200);assert.equal(b.status,200); assert.deepEqual(a.body.weeklyVolume,b.body.weeklyVolume);
  assert.equal(JSON.stringify(m.calls[0].messages),JSON.stringify(f.calls[0].messages));
});

for(const [name,change] of [
  ["null numeric fields",{age:null,height:null,weight:null}],
  ["empty numeric strings",{age:"",height:"",weight:""}],
  ["zero weight",{weight:0}],["negative weight",{weight:-20}],
  ["zero height",{height:0}],["negative height",{height:-165}],
  ["age 14 below supported range",{age:14}],["age -1",{age:-1}],["age 101",{age:101}],
  ["missing sex",{gender:undefined}],["unknown sex coefficient",{gender:"nonbinary"}],
  ["missing activity",{activityLevel:undefined}],["invalid extreme activity",{activityLevel:"ultraActive"}],
  ["contradictory goal",{goal:"loseFat+buildMuscle"}]
]) test("SAF-02/03: manual route must reject or clarify "+name,async t=>{
  const r=await manual({...N,...change}); t.diagnostic(JSON.stringify(r)); assert.ok(blocks(r));
});
for(const [name,change] of [["undefined age",{age:undefined}],["NaN",{weight:NaN}],["Infinity",{weight:Infinity}]])
  test("manual finite-input positive control: "+name,async()=>assert.ok(blocks(await manual({...N,...change}))));
test("manual route numeric strings and decimal mass have predictable metric interpretation",async()=>{
  const p={...N,age:"22",height:"165",weight:"60.5"};const r=await manual(p);assert.equal(r.status,200);
  assert.equal(targets(p).bmr,1365);
});
for(const [name,change] of [["age14",{age:14}],["negative mass",{weight:-5}],["height in metres",{height:1.65}],
  ["invalid frequency",{trainingDays:8}],["decimal frequency",{trainingDays:2.5}],["zero meals",{mealsPerDay:0}],
  ["youth without consent",{age:16}],["missing sex",{gender:undefined}],["null weight",{weight:null}]])
  test("nutrition main route valid blocking control: "+name,async()=>assert.ok(blocks(await nutrition({...N,...change}))));
for(const [name,change] of [["unknown sex",{gender:"other"}],["unknown activity",{activityLevel:"ultraActive"}],
  ["contradictory goal",{goal:"loseFat+buildMuscle"}]])
  test("SAF-03: main route enum clarification: "+name,async t=>{
    const r=await nutrition({...N,...change});t.diagnostic(JSON.stringify({status:r.status,target:r.body.plan?.dailyCalories}));assert.ok(blocks(r));
  });
test("SAF-11: zero training days should not depend on number/string transport representation",async()=>{
  const a=await nutrition({...N,trainingDays:0}),b=await nutrition({...N,trainingDays:"0"});assert.equal(a.status,b.status);
});
test("JSON serialization turns NaN into null; manual route must still reject it",async()=>{
  assert.ok(blocks(await manual(JSON.parse(JSON.stringify({...N,age:NaN,height:NaN,weight:NaN})))));
});

test("safety positive control: explicit current English pregnancy blocks",async()=>{
  const r=await nutrition({...N,additionalNotes:"I am pregnant"}); assert.equal(r.status,422);
});
for(const [name,extra] of [["Hebrew pregnancy",{additionalNotes:"אני בהריון"}],
  ["breastfeeding",{additionalNotes:"I am breastfeeding"}],
  ["structured pregnancy flag",{pregnant:true}],
  ["gestational age in wording",{additionalNotes:"I am 12 weeks pregnant"}],
  ["pregnancy with general word",{additionalNotes:"I am pregnant and want general healthy meals for myself"}]])
  test("SAF-05: restrict unsupported "+name,async t=>{
    const r=await nutrition({...N,...extra}); t.diagnostic(JSON.stringify({status:r.status,notes:r.body.plan?.notes}));assert.ok(blocks(r));
  });
test("SAF-05: past injury clause must not suppress a different current urgent symptom",()=>{
  const r=assessSafety({text:"I had a fracture years ago. I have severe chest pain right now.",route:"workout"});
  assert.equal(r.action,"URGENT_SAFETY_RESPONSE");
});
test("youth: consented 16-year-old has no automatic cutting deficit (arithmetic, not clinical validation)",()=>{
  const t=targets({...N,age:16,goal:"loseFat"}),m=targets({...N,age:16,goal:"maintainWeight"});
  assert.equal(t.isYouth,true);assert.equal(t.dailyCalories,m.dailyCalories);assert.equal(t.proteinGrams,90);
});
test("SAF-09: youth output must retain deterministic supervision warning even with empty model notes",async t=>{
  const r=await nutrition({...N,age:16,youthGuardianConsent:true});t.diagnostic(JSON.stringify({status:r.status,notes:r.body.plan?.notes}));
  assert.ok(blocks(r)||r.body.plan.notes.some(s=>/parent|guardian|dietitian|clinician|supervis|הור|תזונאי/.test(s)));
});

function allergyModel(key){
  return JSON.stringify({selections:buildMealSlots(4,false).map(slot=>({mealNumber:slot.mealNumber,
    mealIds:filterMeals({slot:slot.slot}).sort((a,b)=>Number(b.items.some(x=>x[0]===key))-Number(a.items.some(x=>x[0]===key))).slice(0,3).map(m=>m.id)})),notes:[]});
}
for(const [key,allergy] of [["eggs","egg allergy"],["salmon","fish allergy"],["shrimp","shellfish allergy"],["peanut-butter","אלרגיה לבוטנים"]])
  test("SAF-01: actual final nutrition output must exclude allergen: "+allergy,async t=>{
    const r=await nutrition({...N,age:30,gender:"male",height:180,weight:80,goal:"loseFat",allergies:allergy},allergyModel(key));
    assert.equal(r.status,200,"fixture should reach final route gate to test allergen leak");
    const leaks=r.body.plan.meals.flatMap(m=>m.options.filter(o=>o.keepsPlanValid&&o.foods.some(f=>f.catalogKey===key)).map(o=>({meal:m.mealNumber,id:o.mealId})));
    t.diagnostic(JSON.stringify({status:r.status,leaks}));assert.deepEqual(leaks,[]);
  });
test("allergen positive control: English peanuts excludes tagged peanut butter from pool",()=>{
  assert.deepEqual(detectAllergens("peanut allergy"),["peanuts"]);
  assert.ok(filterMeals({excludeAllergens:detectAllergens("peanut allergy")}).every(m=>!m.items.some(x=>x[0]==="peanut-butter")));
});
test("SAF-01: plural almonds should retain nut exclusion",()=>assert.ok(detectAllergens("allergic to almonds").includes("nuts")));

test("actual opening plan has exact ingredient arithmetic and meets declared tolerances",async()=>{
  const r=await nutrition();assert.equal(r.status,200);assert.ok(verifyDisplayedArithmetic(r.body.plan).exact);assert.ok(evaluatePlanTotals(r.body.plan).withinTolerance);
});
test("SAF-08: all alternatives labelled valid must actually fit the returned opening plan",async t=>{
  const {body:{plan:p}}=await nutrition();const bad=[];
  p.meals.forEach(m=>m.options.forEach((o,j)=>{
    if(o.keepsPlanValid){const e=evaluatePlanTotals(p,{[m.mealNumber]:j});if(!e.withinTolerance)bad.push({meal:m.mealNumber,index:j,actual:e.actual,failures:e.failures});}
  }));t.diagnostic(JSON.stringify(bad));assert.deepEqual(bad,[]);
});
test("SAF-08: every combination of visible valid alternatives must meet target",async t=>{
  const {body:{plan:p}}=await nutrition();let total=0,bad=0;
  function visit(i,s){if(i===p.meals.length){total++;if(!evaluatePlanTotals(p,s).withinTolerance)bad++;return;}
    const m=p.meals[i];m.options.forEach((o,j)=>{if(o.keepsPlanValid)visit(i+1,{...s,[m.mealNumber]:j});});}
  visit(0,{});t.diagnostic(JSON.stringify({total,bad}));assert.equal(bad,0);
});
for(const output of ["not JSON",JSON.stringify({dailyCalories:1,proteinGrams:-99,selections:[{mealNumber:1,mealIds:["invented-meal"]}],notes:[]})])
  test("adversarial nutrition model values cannot replace deterministic targets: "+output.slice(0,12),async()=>{
    const r=await nutrition(N,output);assert.equal(r.status,200);assert.equal(r.body.plan.dailyCalories,2100);
    assert.ok(evaluatePlanTotals(r.body.plan).withinTolerance);assert.ok(verifyDisplayedArithmetic(r.body.plan).exact);
  });
test("catalog property: every enabled meal's displayed ingredient sums are exact",()=>{
  assert.ok(CATALOG.length>100);
  for(const m of CATALOG){const option=buildMealOption(m.id,{targetCalories:m.baseCalories});assert.ok(option);assert.ok(verifyDisplayedArithmetic({meals:[{mealNumber:1,options:[option]}]}).exact,m.id);}
});
test("raw/cooked positive control: rice is explicitly cooked, oats dry, scale is per100g",()=>{
  assert.match(FOODS["white-rice"].en,/cooked/);assert.match(FOODS.oats.en,/dry/);
  assert.equal(macrosFor("white-rice",200).calories,260);assert.equal(macrosFor("oats",50).calories,194.5);
});
test("recipe arithmetic includes specified oil, not only main ingredient",()=>{
  const meal=CATALOG.find(m=>m.items.some(([k])=>k==="olive-oil"));assert.ok(meal);
  const o=buildMealOption(meal.id,{targetCalories:meal.baseCalories});const oil=o.foods.find(f=>f.catalogKey==="olive-oil");
  assert.ok(oil?.calories>0);assert.equal(o.optionCalories,o.foods.reduce((s,f)=>s+f.calories,0));
});
test("adult formula grid: 2 sexes x 4 goals x 5 activity levels x 3 weights, residual energy bounded by rounding",()=>{
  let n=0;for(const gender of ["male","female"])for(const goal of ["loseFat","buildMuscle","maintainWeight","improvePerformance"])
    for(const activityLevel of Object.keys(ACTIVITY_MULTIPLIERS))for(const weight of [50,80,120]){
      const input={...N,age:30,height:175,gender,goal,activityLevel,weight};n++;
      let t;
      try { t=targets(input); } catch(error) {
        // The fixed calculator now explicitly refers unsupported cut/macro
        // profiles instead of returning the old misleading numbers.
        assert.equal(error.status,422);assert.match(error.message,/underweight|protein|feasible/);continue;
      }
      assert.ok([t.dailyCalories,t.proteinGrams,t.carbsGrams,t.fatGrams].every(Number.isFinite));
      assert.ok(Math.abs(macroEnergy(t.proteinGrams,t.fatGrams,t.carbsGrams)-t.dailyCalories)<=2);
    }assert.equal(n,120);
});
test("SAF-04: accepted anthropometric boundary must not yield negative carbohydrate target",async t=>{
  const p={...N,age:64,height:120,weight:35,activityLevel:"sedentary",goal:"loseFat"};
  const r=await manual(p);t.diagnostic(JSON.stringify({r}));
  if(blocks(r))assert.throws(()=>targets(p),error=>error.status===422);
  else assert.ok(targets(p).carbsGrams>=0);
});

test("workout positive control: baseline real deterministic repair passes final volume gate",async()=>{
  const r=await workout();assert.equal(r.status,200);assert.equal(r.body.validationSummary.passed,true);
});
for(const rir of ["-2","99","--","3-1"])
  test("SAF-07: invalid numeric RIR must not be labelled validated: "+rir,async t=>{
    const r=await workout(W,p=>p.sessions.forEach(s=>s.exercises.forEach(e=>e.rir=rir)));
    const survived=exercises(r).filter(e=>e.rir===rir).length;t.diagnostic(JSON.stringify({status:r.status,survived,validation:r.body.validationSummary}));
    assert.ok(blocks(r)||survived===0);
  });
test("SAF-06: model and deterministic repair must respect declared movement exclusions",async t=>{
  const r=await workout({...W,limitations:"Do not prescribe any chest exercise or fly because of shoulder pain."});
  const forbidden=exercises(r).filter(e=>/chest|fly|bench|incline.*press/i.test([e.exerciseId,e.name,e.muscleGroup].join(" ")));
  t.diagnostic(JSON.stringify({status:r.status,forbidden:forbidden.map(e=>e.exerciseId)}));assert.ok(blocks(r)||forbidden.length===0);
});
for(const age of [-1,999,undefined])test("SAF-06: workout unsupported/missing age must be clarified: "+age,async()=>assert.ok(blocks(await workout({...W,age}))));
test("workout invalid JSON fails closed, never creates fake validated plan",async()=>{
  const r=await createHarness({aiOutput:"not JSON"}).request("/api/workout-builder",W);assert.ok(r.status>=400);assert.equal(r.body.program,undefined);
});
test("workout excessive model sets are repaired or blocked, not returned as100 sets per exercise",async()=>{
  const r=await workout(W,p=>p.sessions.forEach(s=>s.exercises.forEach(e=>e.sets=100)));
  assert.ok(blocks(r)||exercises(r).every(e=>e.sets<100));
  if(r.status===200)assert.equal(r.body.validationSummary.passed,true);
});
test("weekly volume exact direct/indirect credit arithmetic, no invented unknown mapping",()=>{
  const p={sessions:[{exercises:[{exerciseId:"known",sets:3},{exerciseId:"unknown",sets:4}]}]};
  const v=lib("workout-volume").calculateWeeklyVolume(p,{known:{chest:1,triceps:0.5}});
  assert.equal(v.perMuscle.chest.total,3);assert.equal(v.perMuscle.triceps.total,1.5);assert.equal(v.unknownExercises,1);
  assert.ok(v.warnings.length);assert.equal(v.mappingCoveragePercent,50);
});
test("experience affects volume policy without sex multiplier",()=>{
  const {targetRangeForMuscle}=lib("workout-volume-targets");
  const beginner=targetRangeForMuscle("chest",{...W,experience:"beginner"});
  const advanced=targetRangeForMuscle("chest",{...W,experience:"advanced"});assert.notDeepEqual(beginner,advanced);
});

// Execute the actual browser save function with synthetic Firestore boundaries.
// This does not import Firebase, open a browser, or read/write a real account.
function isolatedSave({readError,writeError,size=0}={}){
  const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
  const code=fs.readFileSync(path.join(require("./harness.cjs").ROOT,"public/js/nutrition-builder.js"),"utf8");
  const start=code.indexOf("async function saveNutritionPlan(plan) {");
  const end=code.indexOf("function normaliseFoodName",start);
  assert.ok(start>=0&&end>start);let writes=0;
  const sandbox={auth:{currentUser:{uid:"audit-synthetic-user"}},db:{},collection:()=>({}),
    prepareNutritionPlanForSave:p=>p, // snapshot helper tested independently; this boundary tests DB failures only
    query:x=>x,limit:()=>5,serverTimestamp:()=>"AUDIT_TIMESTAMP",
    getDocs:async()=>{if(readError)throw readError;return {size};},
    addDoc:async()=>{writes++;if(writeError)throw writeError;return {id:"audit-only"};}};
  vm.createContext(sandbox);vm.runInContext(code.slice(start,end),sandbox);
  return {save:sandbox.saveNutritionPlan,writes:()=>writes};
}
test("database read failure propagates and does not attempt a write (isolated real client save)",async()=>{
  const h=isolatedSave({readError:new Error("AUDIT_READ_FAILED")});
  await assert.rejects(h.save({}),/AUDIT_READ_FAILED/);assert.equal(h.writes(),0);
});
test("database write failure propagates rather than returning successful save",async()=>{
  const h=isolatedSave({writeError:new Error("AUDIT_WRITE_FAILED")});
  await assert.rejects(h.save({}),/AUDIT_WRITE_FAILED/);assert.equal(h.writes(),1);
});
test("saved plan limit blocks sixth plan without write",async()=>{
  const h=isolatedSave({size:5});await assert.rejects(h.save({}),/NUTRITION_PLAN_LIMIT_REACHED/);assert.equal(h.writes(),0);
});
test("arbitrary custom calorie targets cannot replace main route's computed target",async()=>{
  const r=await nutrition({...N,dailyCalories:100,targetCalories:9000});assert.equal(r.status,200);assert.equal(r.body.plan.dailyCalories,2100);
});
test("outdated incomplete main nutrition profile is rejected before model call",async()=>{
  const h=createHarness();const r=await h.request("/api/nutrition-builder",{goal:"buildMuscle",weight:80});
  assert.equal(r.status,400);assert.equal(h.calls.length,0);
});
test("SAF-04: underweight active cutting is also restricted on the full main menu route",async t=>{
  const r=await nutrition({...N,age:30,height:165,weight:45,activityLevel:"veryActive",goal:"loseFat"});
  t.diagnostic(JSON.stringify({status:r.status,calories:r.body.plan?.dailyCalories,notes:r.body.plan?.notes}));assert.ok(blocks(r));
});
test("main menu refuses mathematically infeasible low target instead of fabricating totals",async()=>{
  const r=await nutrition({...N,age:64,height:120,weight:35,activityLevel:"sedentary",goal:"loseFat"});assert.equal(r.status,422);assert.equal(r.body.plan,undefined);
});
test("SAF-09: vegan diagnosed B12 deficiency retains a deterministic professional-care warning",async t=>{
  const r=await nutrition({...N,dietaryPreference:"vegan",diagnosedConditions:["b12Deficiency"]});
  t.diagnostic(JSON.stringify({status:r.status,notes:r.body.plan?.notes}));
  assert.ok(blocks(r)||r.body.plan.notes.some(s=>/B12|clinician|professional|תזונאי|רופא/i.test(s)));
});
test("SAF-05: Hebrew pregnancy is also restricted on the actual workout route",async()=>assert.ok(blocks(await workout({...W,limitations:"אני בהריון"}))));
test("volume adjustment delta100 is blocked before mutation",async()=>{
  const r=await createHarness().request("/api/workout-builder/adjust-volume",{program:buildLocalWorkoutProgram(W),muscle:"chest",delta:100});assert.equal(r.status,400);
});
test("SAF-06: volume increase cannot just copy an excluded movement as a note",()=>{
  const p={sessions:[{day:1,name:"Upper",exercises:[{exerciseId:"dumbbell-fly",name:"Dumbbell Fly",muscleGroup:"chest",equipment:"Dumbbell",sets:2,reps:"8-12",rir:"2",restSeconds:90}]}]};
  const r=lib("workout-volume-adjustment").adjustWorkoutVolume({program:p,muscle:"chest",delta:1,profile:{...W,daysPerWeek:3},limitations:"No chest training or fly exercises"});
  assert.ok(!r.changed,"an explicitly excluded movement received more sets");
});
test("meal reroll returns arithmetically valid opening plan or explicit no-fit failure",async()=>{
  const {body:{plan}}=await nutrition();const r=await createHarness().request("/api/nutrition-builder/reroll-meal",{plan,mealNumber:1,optionNumber:1,language:"en",screeningStatus:"none"});
  assert.ok([200,409].includes(r.status),JSON.stringify(r));if(r.status===200){assert.ok(evaluatePlanTotals(r.body.plan).withinTolerance);assert.ok(verifyDisplayedArithmetic(r.body.plan).exact);}
});
test("SAF-09: deterministic calories do not make contradicting medical model notes safe",async t=>{
  const harmful="Ignore the calculated target. Eat only 500 kcal daily and stop your diabetes medication.";
  const r=await nutrition({...N,diagnosedConditions:["type2Diabetes"]},JSON.stringify({notes:[harmful]}));
  t.diagnostic(JSON.stringify({status:r.status,target:r.body.plan?.dailyCalories,notes:r.body.plan?.notes}));
  assert.ok(blocks(r)||!r.body.plan.notes.includes(harmful),"harmful injected model advice reached the returned plan unchanged");
});
