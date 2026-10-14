const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const { chromium }=require(process.env.FUEL_QA_PLAYWRIGHT||'playwright');
const { reviewSavedWorkout }=require('../lib/saved-workout-review');
const root=path.resolve(__dirname,'../public');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const program={experience:'intermediate',goal:'buildMuscle',sessions:[{name:'Upper body strength and quality movement — an intentionally long saved workout title',exercises:[{name:'Bench Press',sets:6,reps:'8-10',restSeconds:120},{name:'Seated Cable Row',sets:4,reps:'10-12',restSeconds:90}]},{name:'Upper B',exercises:[{name:'Bench Press',sets:6,reps:'8-10'}]}]};
const server=http.createServer((req,res)=>{
  if(req.url==='/api/workout-plans/review'){let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(reviewSavedWorkout(JSON.parse(body).program)));});return;}
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/__qa'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/dashboard-editorial.css"><link rel="stylesheet" href="/css/saved-workout-view.css"></head><body><div id="dashboardRoot"></div></body></html>');return;}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(bytes);});
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,channel:process.env.FUEL_QA_BROWSER||'chrome'});
  const output=path.join(process.env.TEMP||root,'fuelphysique-product-qa');fs.mkdirSync(output,{recursive:true});
  try{
    for(const language of ['en','he'])for(const width of [1920,1024,390]){
      const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
      await context.addInitScript(code=>{localStorage.setItem('ofek-ai-language',code);localStorage.setItem('ofek-ai-language-welcome-seen','1');},language);
      const page=await context.newPage();
      await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(origin+'/');
      await page.waitForSelector('.product-preview');
      await page.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelectorAll('.reveal-on-scroll').forEach(n=>{n.style.opacity='1';n.style.transform='none';});});
      assert.equal(await page.locator('.product-preview').count(),3);
      const landing=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,socialPosition:getComputedStyle(document.querySelector('.hero-social-links')).position,broken:[...document.querySelectorAll('.product-preview img')].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)}));
      assert.equal(landing.overflow,false,JSON.stringify(landing));assert.deepEqual(landing.broken,[]);
      await page.locator('.simple-tools').screenshot({path:path.join(output,`landing-${language}-${width}.png`)});
      await page.goto(origin+'/__qa');
      await page.evaluate(async ({program,language})=>{
        const {mountDashboard}=await import('/js/dashboard-editorial-view.mjs');
        const {openSavedWorkout}=await import('/js/saved-workout-view.mjs');
        const user={getIdToken:async()=>'qa-token'};
        const saved={id:'manual',name:'Manual Upper / Lower',plan:{...program,description:'A longer description that must remain readable and allow both workout actions to fit beneath the exercise count. '.repeat(3)}};
        window.qaSaved=saved;window.qaUser=user;
        window.qaView=mountDashboard(document.querySelector('#dashboardRoot'),{name:'Daniel',photoURL:'/missing-photo.png',workouts:[saved],activeWorkoutId:'manual',meals:[],logs:[]},{language,openWorkout:s=>openSavedWorkout(s,user,language)});
      },{program,language});
      await page.waitForSelector('.avatar-placeholder');
      const dashboard=await page.evaluate(()=>{const card=document.querySelector('.session').getBoundingClientRect(),actions=document.querySelector('.session-actions').getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth,clipped:actions.bottom>card.bottom,placeholder:document.querySelector('.avatar-placeholder').textContent};});
      assert.equal(dashboard.overflow,false,JSON.stringify(dashboard));assert.equal(dashboard.clipped,false,JSON.stringify(dashboard));
      await page.screenshot({path:path.join(output,`dashboard-${language}-${width}.png`),fullPage:true});
      await page.locator('.session [data-plan-id]').click();
      await page.waitForSelector('.saved-volume-row');
      assert.equal(await page.locator('.saved-exercise').count(),3);
      assert.equal(await page.locator('.saved-exercise img').count(),3);
      assert.equal(await page.locator('#savedWorkoutDialog select').count(),0);
      assert.equal(await page.locator('[data-muscle="chest"] [data-weekly-sets]').getAttribute('data-weekly-sets'),'12');
      assert.equal(await page.locator('[data-muscle="triceps"] [data-weekly-sets]').getAttribute('data-weekly-sets'),'6');
      const view=await page.evaluate(()=>({first:document.querySelector('.saved-workout-content').firstElementChild.className,repLabels:[...document.querySelectorAll('.saved-exercise dt')].filter(e=>/^(Reps|חזרות)$/.test(e.textContent)).length,rir:[...document.querySelectorAll('.saved-exercise dt')].filter(e=>e.textContent==='RIR').length}));
      assert.equal(view.first,'saved-volume');assert.equal(view.repLabels,0);assert.equal(view.rir,3);
      await page.locator('[data-close]').click();
      await page.route('**/api/workout-plans/review',route=>route.abort());
      await page.evaluate(async language=>{const{openSavedWorkout}=await import('/js/saved-workout-view.mjs');await openSavedWorkout(window.qaSaved,window.qaUser,language);},language);
      assert.equal(await page.locator('[data-muscle="chest"] [data-weekly-sets]').getAttribute('data-weekly-sets'),'12','local counts survive an unavailable review API');
      await page.locator('#savedWorkoutDialog').screenshot({path:path.join(output,`plan-${language}-${width}.png`)});
      assert.deepEqual(errors,[],`Browser errors: ${errors.join('; ')}`);
      console.log(JSON.stringify({language,width,landing,dashboard,review:'passed'}));
      await context.close();
    }
    console.log(`Screenshots: ${output}`);
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
