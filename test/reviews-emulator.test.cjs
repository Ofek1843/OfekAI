const {test,after}=require('node:test');const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const {randomUUID}=require('node:crypto');const {initializeApp,deleteApp}=require('firebase-admin/app');const {getFirestore}=require('firebase-admin/firestore');const {getAuth}=require('firebase-admin/auth');
const {TERMS_VERSION,PRIVACY_VERSION}=require('../lib/legal-policy');
const firestoreHost=process.env.FIRESTORE_EMULATOR_HOST;
const authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST;
if(![firestoreHost,authHost].every(host=>/^127\.0\.0\.1:\d+$/.test(host || '')))throw Error('Local emulators required');
const app=initializeApp({projectId:'demo-fuelphysique'});const db=getFirestore(app);const port=3459;let server;
after(async()=>{if(server)server.kill();await deleteApp(app)});
test('a private review can be submitted, exported and removed with its account',async()=>{
 const email=`review-${randomUUID()}@example.test`;
 const account=await getAuth(app).createUser({email,password:'example-password-123',displayName:'Review Test'});
 await db.doc(`users/${account.uid}`).set({termsAccepted:true,termsVersion:TERMS_VERSION,privacyVersion:PRIVACY_VERSION});
 const login=await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'example-password-123',returnSecureToken:true})}).then(r=>r.json());assert.ok(login.idToken);
 server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),SERVER_BIND_HOST:'127.0.0.1',FIREBASE_PROJECT_ID:'demo-fuelphysique',NODE_ENV:'test'},stdio:'ignore',windowsHide:true});
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert.ok(ready,'server started');
 const send=(body,token=login.idToken)=>fetch(`http://127.0.0.1:${port}/api/reviews`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
 assert.equal((await send({rating:5,message:'Helpful',publicationConsent:true},'')).status,401);
 assert.equal((await send({rating:6,message:'Helpful',publicationConsent:true})).status,400);
 assert.equal((await send({rating:4,message:'Helpful plan',publicationConsent:true})).status,201);
 const review=(await db.doc(`userReviews/${account.uid}`).get()).data();assert.equal(review.message,'Helpful plan');assert.equal(review.rating,4);assert.equal(review.status,'pending');assert.equal(review.publicationConsent,true);assert.equal(review.displayName,'Review Test');
 const authorization=`Bearer ${login.idToken}`;
 const exported=await fetch(`http://127.0.0.1:${port}/api/account/export`,{headers:{authorization}});
 assert.equal(exported.status,200);
 assert.equal((await exported.json()).review.message,'Helpful plan');
 const deleted=await fetch(`http://127.0.0.1:${port}/api/account`,{method:'DELETE',headers:{authorization,'content-type':'application/json'},body:JSON.stringify({confirmation:'DELETE'})});
 assert.equal(deleted.status,200,await deleted.text());
 assert.equal((await db.doc(`userReviews/${account.uid}`).get()).exists,false);
});


test('clients cannot read or write private reviews directly',async()=>{
 const fs=require('node:fs');const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');const {doc,getDoc,setDoc}=require('firebase/firestore');
 const env=await initializeTestEnvironment({projectId:'demo-fuelphysique',firestore:{host:'127.0.0.1',port:Number(firestoreHost.split(':')[1]),rules:fs.readFileSync('firestore.rules','utf8')}});
 try{const client=env.authenticatedContext('review-user').firestore();await assertFails(getDoc(doc(client,'userReviews','review-user')));await assertFails(setDoc(doc(client,'userReviews','review-user'),{rating:5}));}finally{await env.cleanup()}
});
