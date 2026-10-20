// Current-route contracts, shared by historical design regressions. The
// editorial dashboard intentionally owns its own shell; do not restore the
// removed animated dashboard just to satisfy a historical class-name test.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const publicRoot=path.join(__dirname,'../../public');
const read=p=>fs.readFileSync(path.join(publicRoot,p),'utf8');
const editorialPages=new Set(['dashboard.html','dashboard-preview.html']);
function assertCurrentCache(source) {
  assert.equal(source.match(/const CACHE_NAME = ['"]([^'"]+)['"]/)[1],'fuelphysique-guest-trial-20261020-1');
  assert.match(source,/NETWORK_ONLY_PREFIXES/);
  assert.match(source,/AUTH_PROXY_PREFIX/);
}
function assertPageShell(page) {
  const html=read(page);
  if(editorialPages.has(page)) {
    assert.match(html,/dashboard-editorial\.css\?v=/);
    assert.match(html,/dashboard-editorial(?:-preview)?\.js\?v=/);
    assert.doesNotMatch(html,/redesign-shell\.js|image-sequence-v43\.js/);
  } else {
    assert.equal((html.match(/\/css\/redesign-v1\.css/g)||[]).length,1,page);
    assert.equal((html.match(/\/js\/redesign-shell\.js/g)||[]).length,1,page);
    assert.ok(html.indexOf('/css/theme.css')<html.indexOf('/css/redesign-v1.css'),page);
  }
  for(const url of [...html.matchAll(/(?:src|href)="(\/(?:css|js)\/[^"?]+)(?:\?[^" ]*)?"/g)].map(m=>m[1]))
    assert.ok(fs.existsSync(path.join(publicRoot,url)),`${page}: missing ${url}`);
}
function assertCachedAsset(source,asset) {
  const base=asset.split('?')[0];
  assert.ok(source.includes(`'${base}'`)||source.includes(`'${base}?`),`cache missing ${base}`);
  assert.ok(fs.existsSync(path.join(publicRoot,base)),`missing file ${base}`);
}
async function dashboard(language='en',model={}) {
  const {parseHTML}=require('linkedom');
  const {document}=parseHTML('<html><body><div id="root"></div></body></html>');
  const {mountDashboard}=await import('../../public/js/dashboard-editorial-view.mjs');
  const previous=global.document;global.document=document;
  try {const view=mountDashboard(document.querySelector('#root'),model,{language,today:new Date('2026-10-16T09:00:00')});return {document,view};}
  finally {global.document=previous;}
}
function landing(language='en') {
  const {parseHTML}=require('linkedom'),vm=require('node:vm');
  const {document,window}=parseHTML(read('index.html'));
  const matchMedia=()=>({matches:false,addEventListener(){}});window.matchMedia=matchMedia;
  vm.runInNewContext(read('js/simple-ux.js'),{document,window,matchMedia,Event:window.Event,localStorage:{getItem:()=>language},location:{pathname:'/index.html'}});
  return document;
}
module.exports={assertCurrentCache,assertCachedAsset,assertPageShell,editorialPages,dashboard,landing,read};
