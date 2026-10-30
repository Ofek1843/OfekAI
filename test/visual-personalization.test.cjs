const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
test('hero integration includes the image rebuilt by the existing landing UI',()=>{
 assert.match(fs.readFileSync('public/js/simple-ux.js','utf8'),/editorialMedia.className = 'editorial-landing-media'/);
 assert.match(fs.readFileSync('public/js/visual-personalization.js','utf8'),/\.editorial-landing-media img/);
});
test('hero selection, no preference, and bounded failure preserve dimensions',async()=>{
 const {personalizeImage}=await import('../public/js/visual-personalization-core.mjs');
 const image={dataset:{},src:'/assets/dashboard/training.webp',width:305,height:324,getAttribute(k){return this[k]}};
 image.alt='Athlete training';
 personalizeImage(image,'female');assert.match(image.src,/training-female-v4.webp$/);assert.equal(image.alt,'Athletic woman in a modern gym');
 image.onerror();assert.equal(image.src,'/assets/dashboard/training.webp');assert.equal(image.onerror,null);assert.equal(image.alt,'Athlete training');
 personalizeImage(image,'male');assert.equal(image.src,'/assets/dashboard/training.webp');
 personalizeImage(image,'female');personalizeImage(image,'default');assert.equal(image.src,'/assets/dashboard/training.webp');
 assert.equal(image.width,305);assert.equal(image.height,324);
 image.src='/untrusted.png';image.dataset={};personalizeImage(image,'female');assert.equal(image.src,'/untrusted.png');
});
test('new account receives explicit guest handoff; returning account retains saved selection; switching accounts isolates data',async()=>{
 const memory=new Map(),session=new Map([['fp_visual_handoff','female']]),writes=[];let callback;let data={};
 const scope=vm.createContext({localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},sessionStorage:{getItem:k=>session.get(k),removeItem:k=>session.delete(k),setItem:(k,v)=>session.set(k,v)},config:{auth:{},db:{}},mockAuth:{onAuthStateChanged:(_,fn)=>callback=fn},mockStore:{doc:(_, ...p)=>p.join('/'),getDoc:async()=>({data:()=>data}),setDoc:async(ref,d)=>writes.push({ref,d})}});
 let source=fs.readFileSync('public/js/exercise-demo-preference.js','utf8').replace(/^export /gm,'').replace("import('./firebase-config.js')",'Promise.resolve(config)').replace("import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js')",'Promise.resolve(mockAuth)').replace("import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js')",'Promise.resolve(mockStore)');
 vm.runInContext(source,scope);await scope.startDemonstrationPreference();await callback({uid:'new'});
 assert.equal(scope.demonstrationModel(),'female');assert.equal(writes[0].ref,'users/new/settings/main');assert.equal(session.size,0);
 await callback({uid:'existing'});assert.equal(scope.demonstrationModel(),'default');
 data={demonstrationModel:'male'};session.set('fp_visual_handoff','female');await callback({uid:'returning'});assert.equal(scope.demonstrationModel(),'male');assert.equal(writes.length,1);
 await callback(null);assert.equal(scope.demonstrationModel(),'default');
});
test('a guest choice carries through signup into the new account settings',async()=>{
 const memory=new Map(),session=new Map(),writes=[];let callback;
 const scope=vm.createContext({localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},sessionStorage:{getItem:k=>session.get(k),removeItem:k=>session.delete(k),setItem:(k,v)=>session.set(k,v)},config:{auth:{},db:{}},mockAuth:{onAuthStateChanged:(_,fn)=>callback=fn},mockStore:{doc:(_, ...p)=>p.join('/'),getDoc:async()=>({data:()=>({})}),setDoc:async(ref,d)=>writes.push({ref,d})}});
 const source=fs.readFileSync('public/js/exercise-demo-preference.js','utf8').replace(/^export /gm,'').replace("import('./firebase-config.js')",'Promise.resolve(config)').replace("import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js')",'Promise.resolve(mockAuth)').replace("import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js')",'Promise.resolve(mockStore)');
 vm.runInContext(source,scope);await scope.startDemonstrationPreference();await callback(null);
 await scope.chooseDemonstrationModel('female');assert.equal(session.get('fp_visual_handoff'),'female');
 await callback({uid:'new-user'});assert.equal(scope.demonstrationModel(),'female');
 assert.equal(writes[0].ref,'users/new-user/settings/main');assert.equal(writes[0].d.demonstrationModel,'female');
});
test('presentation assets exist and active exercise assets have exact human-approved hashes',async()=>{
 const {visualVariants}=await import('../public/js/visual-personalization-core.mjs');
 for(const [a,b]of Object.entries(visualVariants)){assert.ok(fs.existsSync('public'+a));assert.ok(fs.existsSync('public'+b));}
 const crypto=require('node:crypto');
 const manifest=JSON.parse(fs.readFileSync('docs/female-exercise-media-manifest.json','utf8'));
 const source=fs.readFileSync('public/js/exercise-media.js','utf8');
 const active=JSON.parse(source.match(/FEMALE_EXERCISE_MEDIA = Object.freeze\((\{[\s\S]*?\})\);/)[1]);
 assert.equal(manifest.approvedAssets.length,123);assert.equal(Object.keys(active).length,123);
 assert.equal(new Set(manifest.approvedAssets.flatMap(x=>x.exerciseIds)).size,129);
 for(const asset of manifest.approvedAssets){
  assert.equal(asset.approval,'explicit-human-approval');assert.equal(active[asset.slug],asset.path);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync('public'+asset.path)).digest('hex'),asset.sha256);
 }
});
