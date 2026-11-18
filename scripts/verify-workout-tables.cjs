const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let chromium;
try { ({chromium}=require('playwright')); }
catch { ({chromium}=require(path.join(process.env.USERPROFILE||process.env.HOME,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const root=path.resolve(__dirname,'../public'),out=path.resolve(__dirname,'../outputs/workout-tables-review');fs.mkdirSync(out,{recursive:true});
const exercises=[{exerciseId:'barbell-bench-press',name:'Barbell Bench Press',sets:3,reps:'8–12',rir:'2-3',restSeconds:90},{exerciseId:'lat-pulldown',name:'Lat Pulldown',sets:2,reps:'10–15',rir:'2',restSeconds:90}];
const plan={name:'תוכנית גוף מלא',plan:{programName:'Full body',sessions:[{name:'אימון גוף מלא',exercises}]}};
const prior={id:'prior',data:{sessionName:'אימון קודם',workoutPlanName:'תוכנית גוף מלא',completedAt:'2026-11-11T17:00:00Z',durationSeconds:1800,completedSets:3,totalSets:3,notes:'<img src=x onerror="window.historyInjected=true">',exercises:[{name:exercises[0].name,sets:[{setNumber:1,weightKg:67.5,reps:8,completed:true},{setNumber:2,weightKg:65,reps:9,completed:true},{setNumber:3,weightKg:0,reps:null,completed:true}]}]}};
let logs=[structuredClone(prior)],failSave=false;const writes=[];
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/__test_store'){
  let raw='';for await(const b of req)raw+=b;const op=JSON.parse(raw);let result={};
  if(op.op==='getDoc')result={id:op.path.split('/').at(-1),data:op.path.endsWith('/settings/main')?{demonstrationModel:'male'}:op.path.includes('/workoutPlans/')?plan:{activeWorkoutPlanId:'test-plan'}};
  if(op.op==='getDocs')result={docs:[...logs].reverse()};
  if(op.op==='addDoc'){
   assert.equal(op.path,'users/table-test/workoutLogs');
   await new Promise(resolve=>setTimeout(resolve,250));
   if(failSave){res.writeHead(503);return res.end('{}');}
   const id='saved-'+writes.length;writes.push(op.data);logs.push({id,data:{...op.data,completedAt:new Date().toISOString()}});result={id};
  }
  if(op.op==='deleteDoc'){logs=logs.filter(l=>l.id!==op.path.split('/').at(-1));}
  res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(result));
 }
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
const firebase=`
const ref=(...a)=>({path:a.slice(1).join('/')});
const send=async op=>{const r=await fetch('/__test_store',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(op)});if(!r.ok)throw Error('Test write unavailable');return r.json()};
const revive=d=>{for(const k of ['completedAt','startedAt'])if(typeof d[k]==='string'){const v=d[k];d[k]={toDate:()=>new Date(v)}}return d};
export const doc=ref,collection=ref,query=r=>r,limit=x=>x,orderBy=(...a)=>a;
export const getDoc=async r=>{const x=await send({op:'getDoc',path:r.path});return{id:x.id,exists:()=>true,data:()=>x.data}};
export const getDocs=async r=>{const x=await send({op:'getDocs',path:r.path});return{docs:x.docs.map(d=>({id:d.id,data:()=>revive(d.data)}))}};
export const addDoc=(r,data)=>send({op:'addDoc',path:r.path,data}),deleteDoc=r=>send({op:'deleteDoc',path:r.path}),serverTimestamp=()=>0,setDoc=async()=>{};
`;
const report=[];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_EXECUTABLE||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined)});
 try{
 for(const lang of ['he','en']){
 logs=[structuredClone(prior)];
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'reduce'});
 await context.addInitScript(l=>{localStorage.setItem('ofek-ai-language',l);localStorage.setItem('ofek-ai-language-welcome-complete','1');localStorage.setItem('fp_analytics_consent_v1','denied');},lang);
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url()),js=body=>route.fulfill({contentType:'text/javascript',body});
  if(u.pathname==='/js/firebase-config.js')return js('export const app={},db={},storage={},auth={currentUser:{uid:"table-test",getIdToken:async()=>"test"}};');
  if(u.pathname==='/js/verification-gate.js')return js('import{auth}from"./firebase-config.js";export const guardProtectedPage=c=>queueMicrotask(()=>c.onAuthenticated(auth.currentUser));');
  if(u.pathname.endsWith('firebase-firestore.js'))return js(firebase);
  if(u.pathname.endsWith('firebase-auth.js'))return js('export const onAuthStateChanged=(a,f)=>{queueMicrotask(()=>f(a.currentUser));return()=>{}},signOut=async()=>{},sendEmailVerification=async()=>{};');
  if(['/js/site-feedback.js','/js/push-notifications.js'].includes(u.pathname))return js('export const disassociateCurrentInstallation=async()=>{};');
  if(u.pathname.startsWith('/api/notifications/'))return route.fulfill({json:{ok:true}});
  if(u.origin!==base)return route.abort();return route.continue();
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/workout-tracker.html');await page.locator('#startWorkoutButton').click();
 const card=page.locator('.exercise-card').first(),row=i=>card.locator('.set-row').nth(i);
 await card.locator('.weight-input').first().waitFor({state:'visible'});
 assert.match(await page.evaluate(()=>getComputedStyle(document.body).background),/247, 245, 241/);
 assert.equal(await card.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
 assert.equal(await page.locator('#focusPanel').isVisible(),false);
 assert.equal(await page.locator('#focusNextButton').isVisible(),false);
 assert.equal(await page.locator('#finishWorkoutButton').isDisabled(),true);
 await card.locator('.exercise-guide-preview').click();
 assert.equal(await page.locator('.workout-exercise-lightbox').isVisible(),true);
 assert.equal(await page.locator('.workout-exercise-lightbox img').evaluate(async img=>{await img.decode();return img.naturalWidth>0;}),true);
 await page.keyboard.press('Escape');
 await page.locator('.workout-exercise-lightbox').waitFor({state:'detached'});
 assert.equal(await page.locator('.workout-exercise-lightbox').count(),0);
 await card.locator('.table-fill-options > summary').click();
 await card.locator('[data-copy-previous]').click();
 assert.equal(await row(0).locator('.weight-input').inputValue(),'67.5');
 assert.equal(await row(2).locator('.weight-input').inputValue(),'0');
 assert.equal(await row(2).locator('.reps-input').inputValue(),'');
 await row(0).locator('.weight-input').fill('70');await row(0).locator('.reps-input').fill('10');
 await row(0).locator('.set-complete').check();
 await row(1).locator('.weight-input').fill('72.5');
 await card.locator('[data-copy-previous]').click();assert.equal(await row(1).locator('.weight-input').inputValue(),'72.5');
 await row(1).locator('.weight-input').fill('');await row(1).locator('.reps-input').fill('');
 await card.locator('[data-fill-empty]').click();
 assert.equal(await row(1).locator('.weight-input').inputValue(),'70');assert.equal(await row(1).locator('.reps-input').inputValue(),'10');
 // Users can edit later rows directly, without advancing through earlier sets.
 await row(2).locator('.weight-input').fill('75');await row(2).locator('.reps-input').fill('7');await row(2).locator('.set-complete').check();
 await row(1).locator('.weight-input').fill('-1');await row(1).locator('.set-complete').click();
 assert.equal(await row(1).locator('.set-complete').isChecked(),false);
 await row(1).locator('.weight-input').fill('70');await row(1).locator('.set-complete').check();
 assert.match(await page.locator('#tableProgressText').textContent(),/3/);
 await page.locator('#workoutNotes').fill('טקסט בדיקה / saved notes');
 await page.reload();await card.locator('.weight-input').first().waitFor({state:'visible'});
 assert.equal(await row(2).locator('.weight-input').inputValue(),'75');assert.equal(await row(2).locator('.reps-input').inputValue(),'7');assert.equal(await row(2).locator('.set-complete').isChecked(),true);
 assert.equal(await page.locator('#workoutNotes').inputValue(),'טקסט בדיקה / saved notes');
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:950});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`tracker overflow ${lang} ${width}`);
  if(width!==320){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,`tracker-${lang}-${width}.png`),fullPage:true});}
 }
 failSave=true;await page.locator('#finishWorkoutButton').click();
 assert.equal(await row(0).locator('.weight-input').isDisabled(),true);
 assert.equal(await page.locator('#discardWorkoutToolbarButton').isDisabled(),true);
 await page.locator('#trackerStatus.error').waitFor();
 assert.equal(await row(2).locator('.weight-input').inputValue(),'75');assert.equal(await page.locator('#finishWorkoutButton').isEnabled(),true);
 failSave=false;await page.locator('#finishWorkoutButton').click();await page.locator('#successPanel').waitFor({state:'visible'});
 const saved=writes.at(-1);assert.equal(saved.completedSets,3);assert.equal(saved.totalSets,5);assert.equal(saved.exercises[0].sets[2].weightKg,75);assert.equal(saved.exercises[0].sets[2].reps,7);
 assert.equal(saved.exercises[1].sets[0].completed,false);
 await page.locator('#viewHistoryLink').click();await page.locator('.history-exercise').first().waitFor({state:'visible'});
 assert.match(await page.locator('.history-exercise').first().textContent(),/75/);
 await page.locator('.history-exercise').first().locator('.exercise-guide-preview').click();
 assert.equal(await page.locator('.workout-exercise-lightbox img').evaluate(async img=>{await img.decode();return img.naturalWidth>0;}),true);
 await page.locator('.exercise-preview-close').click();
 assert.equal(await page.locator('.history-exercise').first().locator('.sets-table tbody tr').count(),3);
 assert.match(await page.locator('.history-card').last().locator('.sets-table tbody tr').nth(2).locator('td').first().textContent(),/0/);
 assert.equal(await page.locator('.workout-notes img').count(),0);assert.equal(await page.evaluate(()=>window.historyInjected),undefined);
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:950});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)){
   await page.screenshot({path:path.join(out,`overflow-${lang}-${width}.png`),fullPage:true});
   console.log(await page.evaluate(()=>[...document.querySelectorAll('main *')].map(el=>({tag:el.tagName,cls:el.className,x:el.getBoundingClientRect().x,w:el.getBoundingClientRect().width,scroll:el.scrollWidth})).filter(x=>x.w>innerWidth||x.x< -1).slice(0,20)));
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`history overflow ${lang} ${width}`);
  if(width!==320){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,`history-${lang}-${width}.png`),fullPage:true});}
 }
 await page.locator('.details-button').first().click();assert.equal(await page.locator('.workout-details').first().isVisible(),false);
 await page.locator('.details-button').first().click();assert.equal(await page.locator('.workout-details').first().isVisible(),true);
 assert.deepEqual(errors,[]);report.push({language:lang,viewports:[320,390,1440],exerciseIllustrationsLoaded:true,imagePreviewAndEscape:true,directEditing:true,draftRestored:true,failedSaveRetried:true,historyMatchesSavedData:true,noHorizontalOverflow:true,noScriptInjection:true});
 await context.close();
 }
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log('PASS: Hebrew/English; phone/desktop; direct set edits; blank-only copying; validation; draft restore; save retry; persisted values in history; no horizontal overflow or injected HTML.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
