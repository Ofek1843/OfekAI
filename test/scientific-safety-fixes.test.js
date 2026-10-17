"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createHarness,nutritionProfile:N,workoutProfile:W,lib}=require("../audit/scientific-safety-20261015/harness.cjs");
const {FOODS,CATALOG,REQUIRED_ALLERGENS,detectAllergens,validateAllergyInput,assertPlanAllergenExclusions}=lib("meal-catalog");
const {assessSafety}=lib("health-safety");

test("allergen taxonomy is inherited by every affected recipe",()=>{
  for(const [key,allergens] of Object.entries(REQUIRED_ALLERGENS)){
    for(const allergen of allergens){assert.ok(FOODS[key].alg.includes(allergen));
      for(const meal of CATALOG.filter(m=>m.items.some(([k])=>k===key)))assert.ok(meal.allergens.includes(allergen),meal.id);
    }
  }
});
for(const text of ["mango allergy","peanut allergy, mango allergy","peanut and mango","אלרגיה למנגו"])
  test("unknown or partly understood allergy asks for clarification: "+text,async()=>{
    assert.throws(()=>validateAllergyInput(text),e=>e.status===422);
    const r=await createHarness().request("/api/nutrition-builder",{...N,allergies:text});assert.equal(r.status,422);
  });
for(const [text,key] of [["אלרגיה לבוטנים","peanuts"],["almonds","nuts"],["walnuts","nuts"],["mustard","mustard"],["celery","celery"],["תורמוס","lupin"]])
  test("supported allergen recognition: "+text,()=>{assert.ok(detectAllergens(text).includes(key));assert.doesNotThrow(()=>validateAllergyInput(text));});
test("final ingredient gate rejects a tampered excluded ingredient",()=>{
  assert.throws(()=>assertPlanAllergenExclusions({excludeAllergens:["eggs"],meals:[{options:[{foods:[{catalogKey:"eggs"}]}]}]}),e=>e.status===422);
});
test("present urgent symptoms outrank pregnancy and past unrelated injury",()=>{
  for(const text of ["I have severe chest pain right now","I had a fracture years ago and I have severe chest pain right now","יש לי כאבים בחזה עכשיו"])
    assert.equal(assessSafety({text,profile:{pregnant:true},route:"nutrition"}).action,"URGENT_SAFETY_RESPONSE");
});
test("nutrition reroll cannot bypass a new unsupported context",async()=>{
  const {body:{plan}}=await createHarness().request("/api/nutrition-builder",N);
  const r=await createHarness().request("/api/nutrition-builder/reroll-meal",{plan,mealNumber:1,optionNumber:1,screeningStatus:"none",breastfeeding:true});assert.equal(r.status,422);
});
test("explicit negative pregnancy statement is not treated as a positive flag",()=>assert.equal(assessSafety({text:"I am not pregnant",route:"nutrition"}).allowed,true));
test("overlong safety context cannot hide a pregnancy statement beyond the text limit",()=>assert.equal(assessSafety({text:"x".repeat(4001)+" I am pregnant",route:"nutrition"}).allowed,false));
for(const profile of [{pregnant:true},{breastfeeding:true},{severeFoodAllergy:true},{diagnosedConditions:["renalDisease"]},{medications:"insulin"}])
  test("manual target endpoint cannot bypass unsupported context: "+JSON.stringify(profile),async()=>{
    const r=await createHarness().request("/api/nutrition/manual/targets",{...N,...profile});assert.equal(r.status,422);
  });
for(const url of ["/api/nutrition-builder","/api/nutrition/manual/targets","/api/workout-builder"])
  test("explicit suitability confirmation required on "+url,async()=>{
    const body=url.includes("workout")?W:N;
    for(const screeningStatus of [undefined,"review","not-a-value"]){
      const h=createHarness(),r=await h.request(url,{...body,screeningStatus});assert.ok([400,422].includes(r.status));assert.equal(h.calls.length,0);
    }
  });
for(const url of ["/api/workout-builder/adjust-volume","/api/workout-builder/reroll-exercise"])
  test("workout mutations recheck context instead of trusting a saved program: "+url,async()=>{
    const program=lib("local-demo-generators").buildLocalWorkoutProgram(W);program.age=22;
    const r=await createHarness().request(url,{...W,program,sessionIndex:0,exerciseIndex:0,muscle:"chest",delta:1,pregnant:true});assert.equal(r.status,422);
  });
test("all alternative combinations remain valid across multiple ordinary profiles",async()=>{
  for(const p of [N,{...N,gender:"male",age:30,height:180,weight:80,goal:"loseFat"},{...N,dietaryPreference:"vegan"}]){
    const r=await createHarness().request("/api/nutrition-builder",p);assert.equal(r.status,200);
    const plan=r.body.plan;let checked=0;
    function visit(i,s){if(i===plan.meals.length){checked++;assert.ok(lib("nutrition-totals").evaluatePlanTotals(plan,s).withinTolerance);return;}
      const m=plan.meals[i];m.options.forEach((o,j)=>{if(o.keepsPlanValid)visit(i+1,{...s,[m.mealNumber]:j});});}
    visit(0,{});assert.ok(checked>0);
  }
});
test("save snapshot preserves the shown choice, exact totals and original source data",async()=>{
  const {prepareNutritionPlanForSave}=await import("../public/js/nutrition-selection.mjs");
  const {body:{plan}}=await createHarness().request("/api/nutrition-builder",N);
  const before=JSON.stringify(plan),selection={};
  for(const m of plan.meals){const o=m.options.filter(o=>o.keepsPlanValid).at(-1);selection[m.mealNumber]=o.optionNumber;}
  const saved=prepareNutritionPlanForSave(plan,selection);
  for(const m of plan.meals){const expected=m.options.find(o=>o.optionNumber===selection[m.mealNumber]);assert.equal(saved.meals.find(s=>s.mealNumber===m.mealNumber).options[0].mealId,expected.mealId);}
  assert.equal(JSON.stringify(plan),before);assert.ok(lib("nutrition-totals").verifyDisplayedArithmetic(saved).exact);
  assert.ok(lib("nutrition-totals").evaluatePlanTotals(saved).withinTolerance);
  const changed=JSON.parse(before);changed.meals[0].options[0].optionCalories++;
  assert.throws(()=>prepareNutritionPlanForSave(changed),/ingredient totals/);
});
test("carousel rerender captures original option indices after invalid options are filtered",()=>{
  const fs=require("node:fs"),vm=require("node:vm"),{parseHTML}=require("linkedom");
  const source=fs.readFileSync(require.resolve("../public/js/nutrition-builder.js"),"utf8");
  const start=source.indexOf("function captureActiveOptions() {");
  const end=source.indexOf('\nresultElement.querySelectorAll(".nutrition-reroll-meal-button")',start);
  assert.ok(start>=0 && end>start);
  const {document}=parseHTML('<div id="r"><div class="meal-options-carousel" data-meal-number="1"><div class="carousel-option" data-option-number="1"></div><div class="carousel-option active" data-option-number="3"></div></div></div>');
  const context={resultElement:document.querySelector("#r"),meals:[{mealNumber:1,options:[{optionNumber:1},{optionNumber:2,keepsPlanValid:false},{optionNumber:3}]}]};
  vm.createContext(context);vm.runInContext(source.slice(start,end)+";captured=captureActiveOptions();",context);
  assert.equal(context.captured.get(1),2);
});

test("DOM suitability question has explicit choices and is collected without UI control",async()=>{
  const {parseHTML}=require("linkedom"),{document}=parseHTML('<html><body><form id="f"></form></body></html>');
  const previous=global.document;global.document=document;
  try {
    const {mountHealthScreening,healthScreeningPayload}=await import("../public/js/health-screening.mjs");
    const form=document.querySelector("form");mountHealthScreening(form,"he");mountHealthScreening(form,"he");
    const select=form.querySelector("select");assert.equal(form.querySelectorAll("select").length,1);assert.equal(select.required,true);
    select.querySelector('option[value="none"]').selected=true;assert.equal(healthScreeningPayload(form).screeningStatus,"none");
    assert.match(form.textContent,/היריון/);
  } finally {global.document=previous;}
});
