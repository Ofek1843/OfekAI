import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import {savedNutritionMarkup} from '../public/js/saved-nutrition-view.mjs';
const food={name:'Dry oats',amount:'50 g',calories:190,proteinGrams:7,carbsGrams:34,fatGrams:3};
const saved={name:'My plan',plan:{dailyCalories:2100,meals:[{mealNumber:1,name:'Breakfast',options:[{optionNumber:1,mealName:'Yogurt bowl',foods:[food],optionCalories:190,optionProteinGrams:7,optionCarbsGrams:34,optionFatGrams:3},{optionNumber:2,name:'Alternative',foods:[{...food,name:'Bread',calories:250}],optionCalories:250}]}]}};
test('generated saved menus expose foods, amounts, macros and preserved alternatives without mutation',()=>{
  const before=structuredClone(saved),html=savedNutritionMarkup(saved),{document}=parseHTML(html);
  assert.equal(document.querySelector('.saved-food-name').textContent,'Dry oats');
  assert.deepEqual([...document.querySelector('tbody tr').querySelectorAll('td')].map(cell=>cell.textContent),['50 g','190 kcal','7 g','34 g','3 g']);
  assert.match(document.querySelector('details').textContent,/Bread/);
  assert.match(document.querySelector('.saved-nutrition-summary').textContent,/Menu calories190 kcal/);
  assert.deepEqual(saved,before);
});
test('manually saved menus use scaled foods, not base foods or target calories',()=>{
  const html=savedNutritionMarkup({sourceType:'manual',targetSummary:{dailyCalories:2250},plan:{meals:[{name:'Dinner',options:[{servings:2,baseFoods:[food],foods:[{...food,amount:'100 g',calories:380}],optionCalories:380}]}]}});
  assert.match(parseHTML(html).document.querySelector('.saved-summary-target dd').textContent,/2250 kcal/);assert.match(parseHTML(html).document.querySelector('.saved-summary-calories dd').textContent,/380 kcal/);assert.match(html,/100 g/);
});
test('explicit saved option selection is honored and missing historical ingredients are not invented',()=>{
  const copy=structuredClone(saved);copy.plan.selectedOptionNumbers={1:2};
  assert.match(parseHTML(savedNutritionMarkup(copy)).document.querySelector('.saved-summary-calories dd').textContent,/250 kcal/);
  const empty=savedNutritionMarkup({plan:{dailyCalories:2000}});assert.match(empty,/contains no meals/);
  assert.match(parseHTML(empty).document.querySelector('.saved-summary-calories dd').textContent,/—/);
  assert.match(savedNutritionMarkup({plan:{meals:[{title:'Old lunch',calories:500}]}}),/no ingredient breakdown/);
});

test('meal navigation shows one panel while daily totals retain every selected meal',()=>{
  const copy=structuredClone(saved);
  copy.plan.meals.push({mealNumber:2,name:'Lunch',options:[{optionNumber:1,mealId:'simple-peanut-banana-bread',mealName:'Second meal',foods:[{...food,calories:300,proteinGrams:20}]}]});
  const original=structuredClone(copy);
  const {document}=parseHTML(savedNutritionMarkup(copy,'en',true,1));
  assert.equal(document.querySelectorAll('.saved-meal:not([hidden])').length,1);
  assert.equal(document.querySelector('.saved-meal:not([hidden])').id,'saved-meal-1');
  assert.equal(document.querySelector('[aria-selected="true"]').getAttribute('aria-controls'),'saved-meal-1');
  assert.match(document.querySelector('.saved-summary-calories dd').textContent,/490 kcal/);
  assert.match(document.querySelector('.saved-summary-protein dd').textContent,/27 g/);
  assert.ok(document.querySelector('#saved-meal-1 .saved-meal-image[src]'));
  assert.ok(document.querySelector('#saved-meal-0 [data-meal-step="-1"]').hasAttribute('disabled'));
  assert.ok(document.querySelector('#saved-meal-1 [data-meal-step="1"]').hasAttribute('disabled'));
  assert.equal(document.querySelector('#saved-meal-1 [data-replace-meal]').dataset.replaceMeal,'2');
  assert.deepEqual(copy,original);
});

test('hidden meal and alternative photos wait for interaction, and meal indices are bounded',()=>{
  const copy=structuredClone(saved);
  copy.plan.meals[0].options[1].mealId='simple-peanut-banana-bread';
  copy.plan.meals.push({mealNumber:2,name:'Dinner',options:[{...copy.plan.meals[0].options[1],optionNumber:1}]});
  const {document}=parseHTML(savedNutritionMarkup(copy,'en',false,99));
  assert.equal(document.querySelector('.saved-meal:not([hidden])').id,'saved-meal-1');
  assert.equal(document.querySelector('#saved-meal-0 .saved-meal-image').hasAttribute('src'),false);
  assert.ok(document.querySelector('#saved-meal-0 .saved-meal-image').dataset.src);
  assert.equal(document.querySelectorAll('[data-replace-meal]').length,0);
});

test('Hebrew quantities, slot names and all four nutrients are readable without Latin gram units',()=>{
  const {document}=parseHTML(savedNutritionMarkup(saved,'he'));
  assert.equal(document.querySelector('h3').textContent,'ארוחת בוקר');
  assert.equal(document.querySelector('tbody td').textContent,'50 גרם');
  assert.equal(document.querySelector('.saved-meal-macros').children.length,4);
  assert.match(document.querySelector('.saved-food-mobile-macros').textContent,/פחמימות: 34 גרם · שומן: 3 גרם/);
});
test('ingredient arithmetic wins over a stale saved summary with a visible discrepancy notice',()=>{
  const copy=structuredClone(saved);copy.plan.meals[0].options[0].optionCalories=999;
  const html=savedNutritionMarkup(copy);assert.match(parseHTML(html).document.querySelector('.saved-summary-calories dd').textContent,/190 kcal/);
  assert.match(html,/saved summary differs/);assert.equal(copy.plan.meals[0].options[0].optionCalories,999);
});
test('stored content is escaped and untrusted image schemes/remote endpoints are not loaded',()=>{
  const copy=structuredClone(saved);copy.plan.meals[0].options[0].foods[0].name='<img src=x onerror=alert(1)>';
  copy.plan.meals[0].options[0].image='https://untrusted.example/track';
  const {document}=parseHTML(savedNutritionMarkup(copy));assert.equal(document.querySelectorAll('.saved-meal-image').length,0);assert.equal(document.querySelector('[onerror]'),null);
  assert.match(document.querySelector('tbody').textContent,/<img src=x/);
});
test('older saved meals gain a newly added photo by catalog ID without changing their food snapshot',()=>{
  const copy=structuredClone(saved);
  copy.plan.meals[0].options[0].mealId='simple-peanut-banana-bread';
  const before=structuredClone(copy);
  const {document}=parseHTML(savedNutritionMarkup(copy));
  assert.equal(new URL(document.querySelector('.saved-meal-image')?.getAttribute('src'),'https://fuelphysique.com').pathname,'/images/meals/simple-peanut-banana-bread.webp');
  assert.deepEqual(copy,before);
});
test('Hebrew labels and both owner-facing entry points use the same full saved-menu viewer',()=>{
  assert.match(savedNutritionMarkup(saved,'he'),/קלוריות יומיות/);
  for(const file of ['my-nutrition-plans.js','dashboard-editorial-view.mjs'])assert.match(fs.readFileSync(new URL('../public/js/'+file,import.meta.url),'utf8'),/openSavedNutrition/);
  const page=fs.readFileSync(new URL('../public/js/my-nutrition-plans.js',import.meta.url),'utf8');assert.match(page,/view-nutrition-button/);
});
test('equal displayed calorie target and menu totals appear once, while distinct totals remain separate',()=>{
 const equal=structuredClone(saved); equal.plan.dailyCalories=190;
 const html=savedNutritionMarkup(equal); const {document}=parseHTML(html);
 assert.equal(document.querySelectorAll('.saved-nutrition-summary > div').length,2);
 assert.match(document.querySelector('.saved-nutrition-summary').textContent,/Daily calories190 kcal/);
 const different=parseHTML(savedNutritionMarkup(saved)).document;
 assert.equal(different.querySelectorAll('.saved-nutrition-summary > div').length,3);
 const incomplete=parseHTML(savedNutritionMarkup({plan:{dailyCalories:190}})).document;
 assert.equal(incomplete.querySelectorAll('.saved-nutrition-summary > div').length,3);
});
