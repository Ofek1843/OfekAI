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
test("HTTP ordinary workout still passes final volume/equipment validation and preserves age",async()=>{
  const r=await post("/api/workout-builder",W);assert.equal(r.status,200,JSON.stringify(r.body));
  assert.equal(r.body.validationSummary.passed,true);assert.equal(r.body.validationSummary.volumePassed,true);assert.equal(r.body.program.age,22);
});
