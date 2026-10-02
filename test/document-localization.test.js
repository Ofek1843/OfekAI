const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

// A deliberately small DOM fixture exercises the runtime, not its source text.
function fixture(key = 'save') {
  const observers = [];
  const root = { nodeType: 1, isConnected: true };
  function element(text, data = {}) {
    const attributes = new Map();
    const node = {nodeType: 3, nodeValue: text, isConnected: true};
    const el = {nodeType: 1, isConnected: true, dataset: data, firstChild: node, childNodes:[node], parentElement:root,
      closest:()=>null, matches:()=>Boolean(data.i18n), querySelectorAll:()=>[],
      getAttribute:name=>attributes.get(name)||null, setAttribute:(name,value)=>attributes.set(name,value)};
    node.parentElement = el;
    return el;
  }
  const label = element('Save', {i18n:key});
  const generic = element('Loading');
  root.querySelectorAll = ()=>[label, generic];
  const document = {documentElement:root,
    querySelectorAll:()=>[label],
    createTreeWalker:target=>{const nodes=target===root?[label.firstChild,generic.firstChild]:target.childNodes||[];let i=0;return {nextNode(){this.currentNode=nodes[i++];return Boolean(this.currentNode);}};}};
  const context = vm.createContext({document, Node:{TEXT_NODE:3,ELEMENT_NODE:1},NodeFilter:{SHOW_TEXT:4},localStorage:{getItem:()=>null,setItem:()=>{}},queueMicrotask,
    MutationObserver:class {constructor(callback){this.callback=callback;observers.push(this);}disconnect(){}observe(){}}});
  const source=fs.readFileSync(path.join(__dirname,'../public/js/i18n.js'),'utf8').replace(/^export /gm,'');
  vm.runInContext(source+'\nthis.apply=applyDocumentTranslations; this.strings=translations;',context);
  return {context,label,generic,element,observers};
}
test('keyed and generic UI restore English after every supported locale',()=>{
  for(const lang of ['he','ar','es','fr','de','zh']){
    const f=fixture();f.context.apply(lang);
    assert.equal(f.label.firstChild.nodeValue,f.context.strings[lang].save);
    f.context.apply('en');assert.equal(f.label.firstChild.nodeValue,'Save');assert.equal(f.generic.firstChild.nodeValue,'Loading');
  }
});
test('dynamic keyed root elements translate without requiring a wrapper',async()=>{
  const f=fixture();f.context.apply('he');const added=f.element('Save',{i18n:'save'});
  f.observers.at(-1).callback([{type:'childList',addedNodes:[added]}]);
  await new Promise(resolve=>queueMicrotask(resolve));
  assert.equal(added.firstChild.nodeValue,f.context.strings.he.save);
});
test('in-place text changes translate and queued old-language work cannot leak',async()=>{
  const f=fixture();f.context.apply('he');f.generic.firstChild.nodeValue='Save';
  f.observers.at(-1).callback([{type:'characterData',target:f.generic.firstChild}]);
  await new Promise(resolve=>queueMicrotask(resolve));
  assert.equal(f.generic.firstChild.nodeValue,f.context.strings.he.save);
  f.generic.firstChild.nodeValue='Save';
  f.observers.at(-1).callback([{type:'characterData',target:f.generic.firstChild}]);
  f.context.apply('en');await new Promise(resolve=>queueMicrotask(resolve));
  assert.equal(f.label.firstChild.nodeValue,'Save');
  assert.doesNotMatch(f.generic.firstChild.nodeValue,/[\u0590-\u05ff]/);
});
test('user-provided content is never translated by the shared observer',async()=>{
  const f=fixture();f.context.apply('he');const user=f.element('Save');user.closest=()=>user;
  f.observers.at(-1).callback([{type:'childList',addedNodes:[user]}]);
  await new Promise(resolve=>queueMicrotask(resolve));assert.equal(user.firstChild.nodeValue,'Save');
});
