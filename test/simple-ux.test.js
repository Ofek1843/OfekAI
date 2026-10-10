'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {parseHTML} = require('linkedom');
const {filterMeals,buildMealOption,getMealById} = require('../lib/meal-catalog');
const root = path.join(__dirname,'..');
const source = fs.readFileSync(path.join(root,'public/js/simple-ux.js'),'utf8');
function render(page,language='en') {
  const {document,window} = parseHTML(fs.readFileSync(path.join(root,'public',page),'utf8'));
  vm.runInNewContext(source,{document,window,Event:window.Event,localStorage:{getItem:()=>language},location:{pathname:`/${page}`}});
  return {document,window};
}
test('landing exposes three direct tools before secondary features, without a chooser click',() => {
  const {document}=render('index.html');
  const cards=[...document.querySelectorAll('.simple-tool')];
  assert.equal(cards.length,3);
  assert.deepEqual(cards.map(node=>node.getAttribute('href')),['auth.html?next=workout-builder.html','auth.html?next=nutrition-builder.html','auth.html?next=daily-nutrition.html']);
  assert.equal(document.querySelector('#builderChooser'),null);
  assert.equal(document.querySelector('#buildProgramCta'),null);
  assert.equal(document.querySelector('#features').closest('details').hasAttribute('open'),false);
  assert.deepEqual(cards.map(node=>node.dataset.toolIndex),['0','1','2']);
  assert.deepEqual([...document.querySelectorAll('.simple-preview-card')].map(node=>node.dataset.toolIndex),['0','1','2']);
  assert.equal(document.querySelectorAll('.simple-preview-card.is-active').length,1);
  assert.equal(document.querySelector('.simple-preview-card.is-active').dataset.toolIndex,'0');
  assert.doesNotMatch(fs.readFileSync(path.join(root,'public/index.html'),'utf8'),/preload" as="image" href="\/assets\/athlete-motion/);
});
test('the new landing layout overrides the legacy forced grid and remains visible on mobile',() => {
  const css=fs.readFileSync(path.join(root,'public/css/landing-editorial.css'),'utf8');
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  assert.match(css,/body\.landing-page\.fp-v45-deep-ocean\.fp-route-index \.hero-shell\.simple-hero\s*\{[\s\S]*?display: grid !important/);
  assert.match(css,/@media \(max-width: 900px\)[\s\S]*?grid-template-columns: 1fr !important/);
  assert.match(css,/\.editorial-landing-media img[\s\S]*?object-fit: cover !important/);
  assert.match(css,/\.logo,[\s\S]*?\.footer-wordmark\s*\{[\s\S]*?direction: ltr !important/);
  assert.match(html,/assets\/dashboard\/landing-training\.webp/);
  assert.match(source,/assets\/dashboard\/landing-training\.webp/);
  assert.doesNotMatch(source,/editorialPhoto\.src = '\/assets\/dashboard\/training\.webp'/);
});
test('editorial landing neutralizes every legacy deep-ocean content surface',() => {
  const css=fs.readFileSync(path.join(root,'public/css/landing-editorial.css'),'utf8');
  for(const selector of ['product-loop-panel','result-story','transformation-invite','platform-step']) {
    assert.match(css,new RegExp(`body\\.landing-page[\\s\\S]{0,180}\\.${selector}\\s*\\{[\\s\\S]{0,260}background(?:-image)?: (?:#fff|var\\(--ed-blue-soft\\)|none) !important`),selector);
  }
  assert.match(css,/\.landing-page \.site-feedback-trigger\s*\{[\s\S]{0,260}background: var\(--ed-paper-strong\) !important/);
  assert.match(css,/\.landing-section \.premium-card\s*\{[\s\S]{0,180}background: var\(--ed-paper-strong\) !important/);
});
test('landing animation explicitly links each action to its matching example',() => {
  const {document}=render('index.html');
  const cards=[...document.querySelectorAll('.simple-tool')];
  const previews=[...document.querySelectorAll('.simple-preview-card')];
  assert.deepEqual(cards.map(card=>card.dataset.toolIndex),previews.map(card=>card.dataset.toolIndex));
  assert.deepEqual(cards.map(card=>card.getAttribute('aria-describedby')),previews.map(card=>card.id));
  assert.deepEqual(cards.map(card=>card.querySelector('h3').textContent),[
    'Create a workout plan','Create a meal plan','Log today’s food'
  ]);
  assert.match(source,/showPreview\(activePreview \+ 1\)/);
  assert.match(source,/prefers-reduced-motion: reduce/);
});
test('all seven supported locales have their own primary labels and no Hebrew in English',() => {
  const labels=new Set();
  for(const language of ['en','he','ar','es','fr','de','zh']) {
    const {document}=render('index.html',language);
    const title=document.querySelector('#landingHeroTitle').textContent;
    labels.add(title);
    assert.ok(!title.includes('undefined'));
    if(language!=='he') assert.doesNotMatch(document.querySelector('#simpleTools').textContent,/[א-ת]/);
    if(language==='zh') assert.match(title,/[\u4e00-\u9fff]/);
  }
  assert.equal(labels.size,7);
});
test('workout phases retain every answer, safety control and optional muscle focus',() => {
  const {document}=render('workout-builder.html');
  const steps=[...document.querySelectorAll('.wizard-step')];
  assert.deepEqual(steps.map(s=>s.dataset.wizardStep),['goal,experience','style,equipment,schedule','limitations,muscleFocus']);
  for(const id of ['goal','experience','trainingStyle','age','sessionDuration','daysPerWeek','gender','limitations','muscleFocusPicker','wizardReview']) {
    assert.equal(document.querySelectorAll(`#${id}`).length,1,id);
    assert.ok(document.querySelector(`#${id}`).closest('form'),id);
  }
  assert.equal(document.querySelector('#limitations').closest('details'),null);
  assert.ok(document.querySelector('#muscleFocusPicker').closest('details'));
  assert.ok(document.querySelector('input[name="equipment"][value="cable"]'));
});
test('suggested schedules have exactly the requested number of days; explicit edits remain unchanged',() => {
  const {document,window}=render('workout-builder.html');
  const days=document.querySelector('#daysPerWeek');
  const boxes=[...document.querySelectorAll('input[name="availableDays"]')];
  // linkedom has a getter-only select.value; use selected attributes as the browser does.
  for(const count of [1,2,3,4,5,6,7]) {
    [...days.options].forEach(option=>option.toggleAttribute('selected',Number(option.value)===count));
    days.dispatchEvent(new window.Event('change'));
    assert.equal(boxes.filter(box=>box.checked).length,count);
  }
  boxes[0].checked=false;
  boxes[0].dispatchEvent(new window.Event('change'));
  days.dispatchEvent(new window.Event('change'));
  assert.equal(boxes[0].checked,false);
});
test('nutrition phases preserve required profile and visible allergy/medical fields',() => {
  const {document}=render('nutrition-builder.html');
  assert.deepEqual([...document.querySelectorAll('.wizard-step')].map(s=>s.dataset.wizardStep),['goal,about,body','activity,diet','restrictions']);
  for(const id of ['age','gender','height','weight','activityLevel','allergies','youthGuardianConsent']) assert.equal(document.querySelectorAll(`#${id}`).length,1,id);
  assert.equal(document.querySelector('#allergies').closest('details'),null);
  assert.ok(document.querySelector('#favoriteFoods').closest('details'));
  assert.ok(document.querySelector('#mealsPerDay').closest('details'));
  for(const id of ['age','height','weight']) assert.equal(document.querySelector(`#${id}`).value,'');
  assert.equal(document.querySelector('input[name="mealFormatPreference"][value="quick"]').hasAttribute('checked'),true);
  assert.equal(document.querySelector('input[name="mealFormatPreference"][value="mix"]').hasAttribute('checked'),false);
});
test('dashboard keeps the three primary workflows in its editorial navigation',() => {
  const {document}=render('dashboard.html');
  assert.equal(document.querySelectorAll('.simple-tool').length,0);
  assert.ok(document.querySelector('script[src*="dashboard-editorial.js"]'));
  const view=fs.readFileSync(path.join(root,'public/js/dashboard-editorial-view.mjs'),'utf8');
  for(const route of ['workout-builder.html','nutrition-builder.html','daily-nutrition.html'])
    assert.ok(view.includes(route),route);
});
test('the quick/simple default has at least three distinct valid alternatives in each slot for every diet',() => {
  for(const diet of ['omnivore','vegetarian','vegan','pescatarian']) for(const slot of ['breakfast','lunch','dinner','snack']) {
    const pool=filterMeals({diet,slot,mealFormatPreference:'quick',prepTimePreference:'five',foodStylePreference:'supermarket',mealComplexityPreference:'simple'});
    assert.ok(pool.length>=3,`${diet}/${slot}`);
    assert.equal(new Set(pool.map(m=>m.id)).size,pool.length);
    for(const meal of pool) {
      assert.ok(meal.items.length<=5);
      assert.ok(meal.prepMinutes<=5);
      assert.notEqual(meal.mealFormat,'cook');
      if(diet==='vegan') assert.equal(meal.diet,'vegan');
    }
  }
});
test('simple meals keep allergen/avoid exclusions and their displayed arithmetic',() => {
  const pool=filterMeals({mealComplexityPreference:'simple',excludeAllergens:['soy','peanuts'],avoidTerms:['tuna']});
  assert.ok(pool.length>0);
  assert.ok(pool.every(m=>!m.allergens.includes('soy')&&!m.allergens.includes('peanuts')&&!m.id.includes('tuna')));
  for(const id of ['simple-tofu-ready-rice','simple-soy-oats-banana']) {
    const meal=buildMealOption(id,{targetCalories:500});
    assert.equal(meal.optionCalories,meal.foods.reduce((s,f)=>s+f.calories,0));
    assert.equal(meal.optionProteinGrams,meal.foods.reduce((s,f)=>s+f.proteinGrams,0));
    assert.equal(getMealById(id).prepMinutes,5);
  }
});
test('all generation/recovery/reroll catalog filters carry the simple ingredient limit',() => {
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  const nutrition=server.slice(server.indexOf('app.post("/api/nutrition-builder/reroll-meal"'));
  const filters=nutrition.match(/filterMeals\(\{[\s\S]*?\}\)/g);
  assert.equal(filters.length,3);
  for(const filter of filters) assert.match(filter,/mealComplexityPreference/);
});
