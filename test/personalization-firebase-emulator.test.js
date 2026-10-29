const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const {initializeApp,deleteApp}=require('firebase/app');
const authApi=require('firebase/auth'),store=require('firebase/firestore');
const projectId='demo-fuelphysique';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await sleep(30);}throw Error('Preference state did not settle');}
test('isolated Firebase: account preference survives logout, second client and male-recipient saved plan; other user denied',async()=>{
 assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST||'',/^127\.0\.0\.1:/);
 assert.match(process.env.FIRESTORE_EMULATOR_HOST||'',/^127\.0\.0\.1:/);
 const env=await initializeTestEnvironment({projectId,firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});
 const apps=[],stops=[];
 function client(name){
  const app=initializeApp({projectId,apiKey:'demo-key'},name+'-'+Date.now());apps.push(app);
  const auth=authApi.getAuth(app),db=store.getFirestore(app);
  authApi.connectAuthEmulator(auth,'http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST,{disableWarnings:true});
  const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');store.connectFirestoreEmulator(db,host,Number(port));
  const local=new Map(),session=new Map(),storage=m=>({getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)});
  // VM objects have another prototype; normalize at the test adapter boundary.
  // The browser loads both modules in one realm and does not need this adapter.
  const writes=[],reads=[];
  const realStore={...store,getDoc:async ref=>{const result=await store.getDoc(ref);reads.push(ref.path);return result;},
   setDoc:(ref,data,options)=>{writes.push({path:ref.path,data:JSON.parse(JSON.stringify(data))});return store.setDoc(ref,JSON.parse(JSON.stringify(data)),JSON.parse(JSON.stringify(options)));}};
  const scope=vm.createContext({localStorage:storage(local),sessionStorage:storage(session),config:{auth,db},realStore,
   realAuth:{onAuthStateChanged:(...args)=>{const stop=authApi.onAuthStateChanged(...args);stops.push(stop);return stop;}}});
  const source=fs.readFileSync('public/js/exercise-demo-preference.js','utf8').replace(/^export /gm,'')
   .replace("import('./firebase-config.js')",'Promise.resolve(config)')
   .replace("import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js')",'Promise.resolve(realAuth)')
   .replace("import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js')",'Promise.resolve(realStore)');
  vm.runInContext(source,scope);return {auth,db,scope,writes,reads};
 }
 try{
  const a=client('personalization-a'),email='personalization-'+Date.now()+'@example.test',password='Synthetic-local-only-349!';
  const {user}=await authApi.createUserWithEmailAndPassword(a.auth,email,password);
  await a.scope.startDemonstrationPreference();await until(()=>a.scope.accountIsSignedIn());
  await until(()=>a.reads.length===1);
  assert.equal(await a.scope.chooseDemonstrationModel('female'),true);
  assert.deepEqual(a.writes,[{path:'users/'+user.uid+'/settings/main',data:{demonstrationModel:'female'}}]);
  const pref=store.doc(a.db,'users',user.uid,'settings','main');
  assert.equal((await store.getDocFromServer(pref)).data().demonstrationModel,'female');
  const plan={recipientGender:'male',demonstrationModel:'male',sessions:[{name:'Day 1',exercises:[{exerciseId:'barbell-squat',sets:3,restSeconds:90}]}]};
  await store.setDoc(store.doc(a.db,'users',user.uid,'workoutPlans','recipient-test'),{plan});
  assert.equal((await store.getDocFromServer(pref)).data().demonstrationModel,'female');
  await authApi.signOut(a.auth);await until(()=>!a.scope.accountIsSignedIn());assert.equal(a.scope.accountPreference(),'default');
  await authApi.signInWithEmailAndPassword(a.auth,email,password);await until(()=>a.scope.accountPreference()==='female');
  const b=client('personalization-b');await authApi.signInWithEmailAndPassword(b.auth,email,password);
  await b.scope.startDemonstrationPreference();await until(()=>b.scope.accountPreference()==='female');
  assert.deepEqual((await store.getDoc(store.doc(b.db,'users',user.uid,'workoutPlans','recipient-test'))).data().plan,plan);
  assert.equal(b.scope.demonstrationModel(plan.demonstrationModel),'male');
  await b.scope.chooseDemonstrationModel('male');assert.equal((await store.getDocFromServer(pref)).data().demonstrationModel,'male');
  const legacy=client('personalization-legacy');await authApi.createUserWithEmailAndPassword(legacy.auth,'legacy-'+Date.now()+'@example.test',password);
  await legacy.scope.startDemonstrationPreference();await until(()=>legacy.scope.accountIsSignedIn());assert.equal(legacy.scope.accountPreference(),'default');
  await assert.rejects(store.getDoc(store.doc(legacy.db,'users',user.uid,'settings','main')),e=>e.code==='permission-denied');
 }finally{stops.forEach(fn=>fn());await Promise.all(apps.map(async a=>{await store.terminate(store.getFirestore(a));await deleteApp(a)}));await env.cleanup();}
});
