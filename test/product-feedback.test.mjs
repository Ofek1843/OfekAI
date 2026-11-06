import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
import {animateValue,animateMacroRing,setGenerating,acknowledgeFood,revealResult} from '../public/js/product-feedback.mjs';
const require=createRequire(import.meta.url),{parseHTML}=require('linkedom');

function environment({reduce=false}={}) {
  const old=globalThis.window, frames=new Map();let time=0,id=0;
  globalThis.window={performance:{now:()=>time},matchMedia:()=>({matches:reduce}),
    requestAnimationFrame:callback=>{frames.set(++id,callback);return id;},cancelAnimationFrame:frame=>frames.delete(frame)};
  return {frames,tick(ms){time+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(time));},restore(){if(old===undefined)delete globalThis.window;else globalThis.window=old;}};
}
const markup=()=>parseHTML('<html><body><p id="status"></p><article class="macro-card"><div id="ring"></div></article><div id="rows"><details data-entry-row="old"></details><details data-entry-row="new"></details></div><span id="value"></span></body></html>').document;

test('generation feedback follows real loading state and reuses one decorative panel',()=>{
  const document=markup(),anchor=document.querySelector('#status');
  setGenerating({anchor,loading:false});assert.equal(document.querySelector('.fp-generation-feedback'),null);
  setGenerating({anchor,kind:'workout',language:'he',loading:true});
  const panel=document.querySelector('.fp-generation-feedback');
  assert.equal(panel.hidden,false);assert.equal(panel.getAttribute('aria-hidden'),'true');
  assert.match(panel.textContent,/תוכנית האימון/);assert.match(panel.querySelector('img').src,/barbell/);
  assert.doesNotMatch(panel.textContent,/\d+%/);
  setGenerating({anchor,loading:false});assert.equal(panel.hidden,true);
  setGenerating({anchor,kind:'workout',language:'he',loading:true});assert.equal(document.querySelectorAll('.fp-generation-feedback').length,1);
  setGenerating({anchor,loading:false});assert.equal(panel.hidden,true);
});

test('nutrition loading uses the correct icon and leaves form controls untouched',()=>{
  const document=markup(),anchor=document.querySelector('#status');
  setGenerating({anchor,kind:'nutrition',language:'en',loading:true});
  assert.match(document.querySelector('img').src,/salad/);assert.match(document.querySelector('strong').textContent,/meal plan/);
  assert.equal(document.querySelectorAll('button,input,progress').length,0);
});

test('the nutrition controller restores its real button and busy state after either request outcome',()=>{
  const document=markup(),form=document.createElement('form'),button=document.createElement('button');
  form.append(button);
  const source=fs.readFileSync(new URL('../public/js/nutrition-builder.js',import.meta.url),'utf8');
  const loading=source.slice(source.indexOf('function setLoading('),source.indexOf('function setStatus('));
  const context=vm.createContext({form,button,statusElement:document.querySelector('#status'),currentLanguage:'en',ui:{generating:'Generating',generate:'Generate'},window:{fpFeedback:{setGenerating}}});
  vm.runInContext(loading,context);
  for(const fails of [false,true]) {
    vm.runInContext('setLoading(true)',context);
    assert.equal(button.disabled,true);assert.equal(form.getAttribute('aria-busy'),'true');
    assert.equal(document.querySelector('.fp-generation-feedback').hidden,false);
    try { if(fails)throw Error('simulated request failure'); } catch {} finally {vm.runInContext('setLoading(false)',context);}
    assert.equal(button.disabled,false);assert.equal(button.textContent,'Generate');assert.equal(form.getAttribute('aria-busy'),'false');
    assert.equal(document.querySelector('.fp-generation-feedback').hidden,true);
  }
  assert.match(source,/finally\s*\{\s*setLoading\(false\)/);
});

test('numbers count between actual totals, cancel stale frames and finish exactly',()=>{
  const env=environment();try{
    const el=markup().querySelector('#value');
    animateValue(el,0,{context:'today'});animateValue(el,500,{context:'today'});
    assert.equal(el.textContent,'0');env.tick(250);const middle=Number(el.textContent);assert.ok(middle>0&&middle<500);
    animateValue(el,120,{context:'today'});assert.equal(env.frames.size,1);env.tick(700);
    assert.equal(el.textContent,'120');assert.equal(env.frames.size,0);
    animateValue(el,250,{context:'today'});animateValue(el,80,{context:'yesterday'});assert.equal(el.textContent,'80');
    env.tick(1000);assert.equal(el.textContent,'80');
  }finally{env.restore();}
});

test('the first food fills the donut progressively and rapid changes settle on the latest real split',()=>{
  const env=environment();try{
    const ring=markup().querySelector('#ring'),macro=(p,c,f)=>({protein:p,carbs:c,fat:f,macroCalories:p+c+f});
    animateMacroRing(ring,macro(0,0,0),{context:'today'});
    animateMacroRing(ring,macro(40,40,20),{context:'today'});env.tick(200);
    assert.doesNotMatch(ring.style.background,/NaN|undefined/);
    assert.notEqual(ring.style.background.includes(' 80% 100%'),true,'the target must not paint instantly');
    animateMacroRing(ring,macro(20,30,50),{context:'today'});assert.equal(env.frames.size,1);env.tick(800);
    assert.match(ring.style.background,/0 20%/);assert.match(ring.style.background,/20% 50%/);assert.match(ring.style.background,/50% 100%/);
    animateMacroRing(ring,macro(0,0,0),{context:'today'});env.tick(800);assert.match(ring.style.background,/#e4edf6\) 0% 100%/);
    assert.equal(env.frames.size,0);
  }finally{env.restore();}
});

test('a different diary date paints its own split without animating the previous date into it',()=>{
  const env=environment();try{
    const ring=markup().querySelector('#ring');
    animateMacroRing(ring,{protein:33.3,carbs:33.3,fat:33.3,macroCalories:100},{context:'today'});
    assert.match(ring.style.background,/100% 100%/,'rounded percentages should still close the circle');
    animateMacroRing(ring,{protein:100,carbs:0,fat:0,macroCalories:100},{context:'tomorrow'});
    assert.equal(env.frames.size,0);assert.match(ring.style.background,/0 100%/);
  }finally{env.restore();}
});

test('reduced motion paints exact totals immediately and skips entry/result movement',()=>{
  const env=environment({reduce:true});try{
    const document=markup(),value=document.querySelector('#value'),ring=document.querySelector('#ring');let calls=0;
    for(const element of document.querySelectorAll('details,article'))element.animate=()=>{calls++;};
    animateValue(value,0);animateValue(value,250);animateMacroRing(ring,{protein:50,carbs:25,fat:25,macroCalories:400});
    acknowledgeFood(document.querySelector('#rows'),['new'],ring);revealResult(document.querySelector('article'));
    assert.equal(value.textContent,'250');assert.match(ring.style.background,/0 50%/);assert.equal(calls,0);assert.equal(env.frames.size,0);
  }finally{env.restore();}
});

test('only newly added rows animate and optional browser animation failures cannot interrupt actions',()=>{
  const env=environment();try{
    const document=markup(),calls=[];
    document.querySelector('[data-entry-row="old"]').animate=()=>calls.push('old');
    document.querySelector('[data-entry-row="new"]').animate=()=>{calls.push('new');throw new Error('Animation unavailable');};
    document.querySelector('article').animate=()=>calls.push('ring');
    assert.doesNotThrow(()=>acknowledgeFood(document.querySelector('#rows'),['new'],document.querySelector('#ring')));
    assert.deepEqual(calls,['new','ring']);
    acknowledgeFood(document.querySelector('#rows'),['not-saved'],document.querySelector('#ring'));assert.equal(calls.length,2);
    revealResult(document.querySelector('article'));assert.equal(calls.length,3);
  }finally{env.restore();}
});
