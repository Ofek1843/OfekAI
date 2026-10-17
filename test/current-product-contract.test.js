const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {assertCurrentCache,dashboard}=require('./helpers/current-product.cjs');
test('current cache generation precaches all shipped recovery modules with real paths',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../public/sw.js'),'utf8');assertCurrentCache(source);
  const match=source.match(/const urlsToCache = (\[[\s\S]*?\]);/);assert.ok(match);
  const urls=vm.runInNewContext(match[1]);assert.equal(new Set(urls).size,urls.length,'duplicate cache keys');
  for(const url of urls)assert.ok(fs.existsSync(path.join(__dirname,'../public',url.split('?')[0])),url);
  for(const asset of ['/js/daily-nutrition-recovery.mjs','/js/dashboard-load.mjs','/js/saved-nutrition-view.mjs','/css/saved-nutrition-view.css','/js/food-reference-data.mjs','/js/health-screening.mjs','/js/nutrition-selection.mjs','/js/equipment-i18n.mjs','/js/dashboard-editorial-view.mjs?v=20261015-plan-tabs-1'])assert.ok(urls.includes(asset),asset);
  assert.doesNotMatch(source,/'\/api\/[^']+'/);
});
test('editorial mobile menu has a real controls relationship and Escape resets its state',async()=>{
  const {document}=await dashboard();const button=document.querySelector('[data-action="menu"]');
  const sidebar=document.getElementById(button.getAttribute('aria-controls'));assert.ok(sidebar);
  const Event=document.defaultView.Event;
  button.dispatchEvent(new Event('click',{bubbles:true}));
  assert.equal(button.getAttribute('aria-expanded'),'true');assert.ok(sidebar.classList.contains('open'));
  const escape=new Event('keydown',{bubbles:true});escape.key='Escape';button.dispatchEvent(escape);
  assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(sidebar.classList.contains('open'),false);
});
test('messages navigation is localized in all supported dashboard languages',async()=>{
  const expected={en:'Messages',he:'הודעות',ar:'الرسائل',es:'Mensajes',fr:'Messages',de:'Nachrichten',zh:'消息'};
  for(const language of Object.keys(expected)){
    const {document}=await dashboard(language);const a=document.querySelector('.sidebar a[href="/social.html"]');
    assert.ok(a);assert.ok(a.querySelector('img'));assert.equal(a.getAttribute('target'),null);
    assert.equal(a.textContent.trim(),expected[language]);
  }
});
