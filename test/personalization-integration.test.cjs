const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function client(database) {
 const local=new Map(),session=new Map();let authChanged;
 const storage=m=>({getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)});
 const scope=vm.createContext({localStorage:storage(local),sessionStorage:storage(session),config:{auth:{},db:{}},mockAuth:{onAuthStateChanged:(_,fn)=>authChanged=fn},mockStore:{doc:(_, ...parts)=>parts.join('/'),getDoc:async ref=>({data:()=>database.get(ref)}),setDoc:async(ref,data)=>database.set(ref,{...database.get(ref),...data})}});
 const source=fs.readFileSync('public/js/exercise-demo-preference.js','utf8').replace(/^export /gm,'').replace("import('./firebase-config.js')",'Promise.resolve(config)').replace("import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js')",'Promise.resolve(mockAuth)').replace("import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js')",'Promise.resolve(mockStore)');
 vm.runInContext(source,scope);
 return {scope,login:user=>authChanged(user)};
}
test('mocked private store: logout/login and independent client restore account preference, legacy account is neutral',async()=>{
 const database=new Map(),a=client(database),b=client(database);
 await a.scope.startDemonstrationPreference();await a.login({uid:'synthetic'});
 assert.equal(a.scope.accountPreference(),'default');
 assert.equal(await a.scope.chooseDemonstrationModel('female'),true);
 await a.login(null);assert.equal(a.scope.accountPreference(),'default');
 await a.login({uid:'synthetic'});assert.equal(a.scope.accountPreference(),'female');
 await b.scope.startDemonstrationPreference();await b.login({uid:'synthetic'});
 assert.equal(b.scope.accountPreference(),'female');
 assert.equal(b.scope.demonstrationModel('male'),'male');
 assert.equal(database.get('users/synthetic/settings/main').demonstrationModel,'female');
 await b.login({uid:'legacy'});assert.equal(b.scope.accountPreference(),'default');
 assert.equal(database.has('users/legacy/settings/main'),false);
});
test('saved-plan normalization and serialization preserve recipient and media independently',async()=>{
 const {calculateSavedWeeklySets}=await import('../public/js/saved-workout-volume.mjs');
 const saved={recipientGender:'male',demonstrationModel:'female',sessions:[]};
 const reopened=calculateSavedWeeklySets(JSON.parse(JSON.stringify(saved))).program;
 assert.equal(reopened.recipientGender,'male');assert.equal(reopened.demonstrationModel,'female');
 reopened.demonstrationModel='male';assert.equal(saved.demonstrationModel,'female');
 assert.doesNotThrow(()=>calculateSavedWeeklySets({sessions:[]}));
});
