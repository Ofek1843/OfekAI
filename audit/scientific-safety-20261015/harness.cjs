"use strict";
// Audit-only. Executes the repository's unchanged route bodies in an isolated VM.
// Auth/rate-limit/model boundaries are synthetic; business calculations are real.
// No server startup, dotenv, real API key, HTTP request, or database access.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(ROOT, "server.js"), "utf8").replace(/\r\n/g, "\n");
const lib = name => require(path.join(ROOT, "lib", name));
function block(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error("Audit extraction marker not found: " + start);
  return source.slice(a, b);
}
function createHarness({ aiOutput = "{}", localDemoMode = false } = {}) {
  const routes = new Map(), calls = [], logs = [];
  const catalog = lib("workout-exercise-catalog");
  const sandbox = {
    ...lib("nutrition-targets"), ...lib("nutrition-totals"),
    ...lib("nutrition-portion-balancer"), ...lib("meal-catalog"),
    ...lib("health-safety"), ...lib("manual-nutrition"),
    ...lib("plan-output-policy"),
    ...lib("workout-volume"), ...lib("workout-duration"),
    ...lib("workout-validator"), ...catalog, ...lib("exercise-suitability"),
    ...lib("workout-priority"), ...lib("workout-focus"),
    ...lib("workout-volume-targets"), ...lib("workout-volume-ledger"),
    ...lib("workout-equipment-policy"), ...lib("workout-program-identity"),
    ...lib("workout-language-sanitizer"), ...lib("local-demo-generators"),
    ...lib("workout-volume-adjustment"), ...lib("workout-split-policy"),
    EXERCISE_SETCREDITS: lib("workout-setcredits-map").EXERCISE_SETCREDITS,
    repairGeneratedWorkoutProgram: lib("workout-repair").repairWorkoutProgram,
    diagnoseVolumeGateFailure: lib("workout-repair").diagnoseVolumeGateFailure,
    localFoodImages: lib("food-image-map").FOOD_IMAGE_MAP,
    WORKOUT_DISABLED_EXERCISE_PROMPT_LIST: catalog.MISSING_DEDICATED_IMAGE_EXERCISES.map(x=>x.title).join(", "),
    app: { post: (url, handler) => routes.set(url, handler) },
    console: Object.fromEntries(["info","warn","error","log","time","timeEnd"].map(key=>[key,(...args)=>logs.push({key,args})])),
    process: { env: { OPENAI_API_KEY: "AUDIT_STUB_NOT_A_REAL_KEY" } },
    requireFirebaseUser: async () => ({uid:"audit-synthetic-user"}),
    rateLimiters: { ai() {}, nutritionReroll() {} }, rejectIfDuplicateAi: () => "audit",
    inFlight: { finish() {} }, localDemoMode,
    resolveWorkoutModel: () => "audit-mock-model",
    createChatCompletion: async options => {
      calls.push(options);
      return typeof aiOutput === "function" ? aiOutput(options) : aiOutput;
    },
    // The model correction boundary returns no correction by default.
    repairWorkoutProgramWithAi: async () => null,
    isUpstreamProviderError: () => false,
    fetch: () => { throw new Error("LIVE NETWORK FORBIDDEN IN AUDIT"); }
  };
  vm.createContext(sandbox);
  vm.runInContext(block("function hardVolumeLedgerIssues(", "// The single AI correction"), sandbox);
  vm.runInContext(block("function volumeFailureMessage(", 'app.post("/api/workout-plans/review"'), sandbox);
  for (const [start,end] of [
    ['app.post("/api/nutrition/manual/targets",','app.get("/api/nutrition/manual/meals",'],
    ['app.post("/api/nutrition-builder",','app.use((error, req, res, next)'],
    ['app.post("/api/workout-builder",','app.post("/api/workout-builder/adjust-volume",']
    ,['app.post("/api/workout-builder/adjust-volume",','app.post("/api/workout-builder/reroll-exercise",']
    ,['app.post("/api/workout-builder/reroll-exercise",','app.post("/api/nutrition-builder/reroll-food",']
    ,['app.post("/api/nutrition-builder/reroll-meal",','app.post("/api/nutrition/manual/targets",']
  ]) vm.runInContext(block(start,end), sandbox);
  return {
    calls, logs,
    async request(url, body) {
      let status = 200, payload;
      const res = { status(code) {status=code;return this;}, json(data){payload=data;return this;} };
      await routes.get(url)({body,headers:{},requestId:"audit"}, res);
      return {status,body:JSON.parse(JSON.stringify(payload))};
    }
  };
}
const nutritionProfile = {goal:"maintainWeight",age:22,gender:"female",height:165,weight:60,activityLevel:"moderatelyActive",trainingDays:3,mealsPerDay:4,dietaryPreference:"balanced",mealFormatPreference:"mix",prepTimePreference:"any",foodStylePreference:"mix",allergies:"None",foodsToAvoid:"None",favoriteFoods:"None",additionalNotes:"None",language:"en"};
const workoutProfile = {goal:"buildMuscle",experience:"intermediate",gender:"male",age:22,daysPerWeek:3,sessionDuration:60,equipment:["dumbbell","machine","cable"],trainingStyle:"gym",availableDays:["sunday","tuesday","thursday"],limitations:"None",language:"en",muscleFocusMode:"balanced",selectedMuscles:[]};
nutritionProfile.screeningStatus = "none";
workoutProfile.screeningStatus = "none";
module.exports = {ROOT,lib,source,createHarness,nutritionProfile,workoutProfile};
