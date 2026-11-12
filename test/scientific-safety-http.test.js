"use strict";
// Real Express HTTP, synthetic auth/model boundaries. No OpenAI/Firebase calls.
const test=require("node:test"),assert=require("node:assert/strict"),net=require("node:net"),path=require("node:path"),{spawn}=require("node:child_process");
const {nutritionProfile:N,workoutProfile:W}=require("../audit/scientific-safety-20261015/harness.cjs");
const {stopChildProcess}=require("./child-process-cleanup");
let child,base,counter=0;
test.before(async()=>{
  const probe=net.createServer();await new Promise(r=>probe.listen(0,"127.0.0.1",r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,[path.join(__dirname,"..","server.js")],{cwd:path.join(__dirname,".."),windowsHide:true,env:{...process.env,PORT:String(port),SERVER_BIND_HOST:"127.0.0.1",NODE_ENV:"test",MOCK_EXTERNAL_SERVICES:"true",MOCK_OPENAI_WORKOUT_RESPONSE_JSON:JSON.stringify(require("../lib/local-demo-generators").buildLocalWorkoutProgram(W)),FUELPHYSIQUE_LOCAL_DEMO:"0",OPENAI_API_KEY:"AUDIT_TEST_NOT_A_REAL_KEY",OTEL_EXPORTER_OTLP_ENDPOINT:""},stdio:["ignore","pipe","pipe"]});
  // Drain without logging configuration or environment contents.
  child.stdout.on("data",()=>{});child.stderr.on("data",()=>{});
  for(let i=0;i<100;i++){try{if((await fetch(base+"/health")).ok)return;}catch{}
    if(child.exitCode!==null)throw new Error("Mock HTTP server exited: "+child.exitCode);
    await new Promise(r=>setTimeout(r,100));}
  throw new Error("Mock HTTP server did not become ready");
});
test.after(()=>stopChildProcess(child));
async function post(url,body){const r=await fetch(base+url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer safety-audit-${++counter}`},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
test("HTTP rejects null and unknown coefficient rather than returning negative/default targets",async()=>{
  for(const change of [{age:null,height:null,weight:null},{gender:"unknown"},{activityLevel:"ultraActive"}])assert.equal((await post("/api/nutrition/manual/targets",{...N,...change})).status,400);
});
test('HTTP manual and generated menus honor different goals for the same adult female profile',async()=>{
  const expected=require('../lib/nutrition-targets').calculateNutritionTargets;
  const values=[];
  for(const goal of ['loseFat','maintainWeight','buildMuscle']){
    const input={...N,goal},calories=expected(input).dailyCalories;
    const manual=await post('/api/nutrition/manual/targets',input);assert.equal(manual.status,200,JSON.stringify(manual.body));assert.equal(manual.body.targets.dailyCalories,calories);
    const generated=await post('/api/nutrition-builder',input);assert.equal(generated.status,200,JSON.stringify(generated.body));assert.equal(generated.body.plan.dailyCalories,calories);
    values.push(calories);
  }
  assert.ok(values[0]<values[1]&&values[1]<values[2]);
});
test("HTTP blocks underweight cutting and unsupported current contexts",async()=>{
  for(const change of [{age:30,weight:45,goal:"loseFat"},{additionalNotes:"אני בהריון"},{breastfeeding:true},{screeningStatus:"review"}])assert.equal((await post("/api/nutrition-builder",{...N,...change})).status,422);
});
test("HTTP nutrition rejects incomplete allergy declarations even in the notes", async () => {
  const result = await post("/api/nutrition-builder", { ...N, additionalNotes: "I have a milk and kiwi allergy" });
  assert.equal(result.status, 422);
});
test("HTTP manual meal filtering uses a private request and rejects unknown allergies", async () => {
  const endpoint = "/api/nutrition/manual/meals";
  const response = await fetch(base + endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer audit-manual-meal", "Content-Type": "application/json" },
    body: JSON.stringify({ categories: ["breakfast"], allergies: ["milk"] })
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const { meals } = await response.json();
  const { FOODS } = require("../lib/meal-catalog");
  assert.ok(meals.length);
  assert.ok(meals.every(meal => meal.foods.every(row => FOODS[row.catalogKey] && !(FOODS[row.catalogKey].alg || []).includes("dairy"))));
  assert.equal((await post(endpoint, { categories: ["breakfast"], allergies: ["kiwi"] })).status, 422);
  assert.equal((await post(endpoint, { categories: ["breakfast"], allergies: { value: "milk" } })).status, 400);
});
test("HTTP Coach keeps an earlier urgent disclosure ahead of routine follow-up", async () => {
  const result = await post("/api/chat", {
    language: "he",
    messages: [
      { role: "user", content: "אין לי כאב בחזה, יש לי קוצר נשימה" },
      { role: "assistant", content: "Continue as usual" },
      { role: "user", content: "מה לעשות באימון?" }
    ]
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.code, "urgent_symptoms");
  assert.match(result.body.reply, /עזרה דחופה/);
  const title = await post("/api/generate-title", { language: "he", message: "יש לי קוצר נשימה עכשיו" });
  assert.deepEqual(title.body, { title: "שיחה עם המאמן" });
});
test("HTTP Coach distinguishes current risk from education and disabled profile personalization", async () => {
  const settings = { athleteCore: { pregnant: true }, aiPreferences: { useAthleteCore: true } };
  const messages = [{ role: "user", content: "Build me a personalized workout" }];
  assert.equal((await post("/api/chat", { settings, messages })).body.code, "pregnancy");
  settings.aiPreferences.useAthleteCore = false;
  const off = await post("/api/chat", { settings, messages });
  assert.equal(off.body.reply, "Mock reply for load testing.");
  const education = await post("/api/chat", { messages: [{ role: "user", content: "Explain pregnancy fitness generally." }] });
  assert.equal(education.body.reply, "Mock reply for load testing.");
});
test("HTTP can still generate an ordinary menu with exact visible totals",async()=>{
  const r=await post("/api/nutrition-builder",N);assert.equal(r.status,200,JSON.stringify(r.body));
  assert.equal(r.body.plan.totalsSummary.withinTolerance,true);assert.equal(r.body.plan.totalsSummary.displayedArithmeticExact,true);
});
test("HTTP blocks an explicit movement restriction before model generation",async()=>{
  const r=await post("/api/workout-builder",{...W,limitations:"No chest training because of shoulder pain"});assert.equal(r.status,422);
});
test("HTTP serves new client modules locally",async()=>{
  for(const url of ["/js/health-screening.mjs","/js/nutrition-selection.mjs"]){const r=await fetch(base+url);assert.equal(r.status,200);assert.match(await r.text(),/export function/);}
});
test("HTTP food-log fallback requires auth and rejects invalid dates",async()=>{
  assert.equal((await fetch(base+"/api/daily-nutrition/day/2026-10-17")).status,401);
  assert.equal((await fetch(base+"/api/daily-nutrition/day/not-a-date",{headers:{Authorization:"Bearer diary-date-check"}})).status,400);
  assert.equal((await fetch(base+"/api/daily-nutrition/day/2026-10-17",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({log:{entries:[],completed:false}})})).status,401);
  assert.equal((await fetch(base+"/api/daily-nutrition/day/2026-10-17",{method:"PUT",headers:{Authorization:"Bearer diary-date-check","Content-Type":"application/json"},body:JSON.stringify({log:{entries:[{id:"bad",calories:-1}],completed:false}})})).status,400);
});
test("HTTP food-log fallback returns only the authenticated user's saved day",{
  skip: !process.env.FIRESTORE_EMULATOR_HOST
},async()=>{
  const {getFuelPhysiqueFirestore}=require("../lib/firebase-admin");
  const db=getFuelPhysiqueFirestore();
  const token=`diary-${Date.now()}`;
  const uid=`mock-${token.slice(0,24)}`;
  const ref=db.doc(`users/${uid}/dailyNutritionLogs/2026-10-17`);
  await ref.set({dateKey:"2026-10-17",entries:[{id:"meal-a",calories:787,proteinGrams:33}]});
  try {
    const own=await fetch(base+"/api/daily-nutrition/day/2026-10-17",{headers:{Authorization:`Bearer ${token}`}});
    assert.equal(own.status,200);
    assert.match(own.headers.get("cache-control"),/no-store/);
    assert.equal((await own.json()).log.entries[0].calories,787);
    const other=await fetch(base+"/api/daily-nutrition/day/2026-10-17",{headers:{Authorization:"Bearer another-diary-user"}});
    assert.equal(other.status,200);
    assert.deepEqual((await other.json()).log,{updatedAt:null,createdAt:null,completedAt:null});
  } finally {await ref.delete();}
});
test("HTTP food-log write stores only the authenticated user's validated day",{
  skip: !process.env.FIRESTORE_EMULATOR_HOST
},async()=>{
  const {getFuelPhysiqueFirestore}=require("../lib/firebase-admin");
  const token=`diary-write-${Date.now()}`;
  const uid=`mock-${token.slice(0,24)}`;
  const reference=getFuelPhysiqueFirestore().doc(`users/${uid}/dailyNutritionLogs/2026-10-17`);
  const entry={id:"meal-a",name:{en:"Oats",he:"שיבולת שועל"},amount:100,unit:"g",calories:389,proteinGrams:17,carbsGrams:66,fatGrams:7};
  try {
    const saved=await fetch(base+"/api/daily-nutrition/day/2026-10-17",{method:"PUT",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({log:{entries:[entry],completed:false,totals:{calories:99999}}})});
    assert.equal(saved.status,200,await saved.text());
    const snapshot=await reference.get();
    assert.equal(snapshot.data().totals.calories,389);
    assert.equal(snapshot.data().entries[0].id,"meal-a");
    const other=await fetch(base+"/api/daily-nutrition/day/2026-10-17",{headers:{Authorization:"Bearer another-diary-user"}});
    assert.deepEqual((await other.json()).log,{updatedAt:null,createdAt:null,completedAt:null});
  } finally {await reference.delete();}
});
test("HTTP ordinary workout still passes final volume/equipment validation and preserves age",async()=>{
  const r=await post("/api/workout-builder",W);assert.equal(r.status,200,JSON.stringify(r.body));
  assert.equal(r.body.validationSummary.passed,true);assert.equal(r.body.validationSummary.volumePassed,true);assert.equal(r.body.program.age,22);
});
