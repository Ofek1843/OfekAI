import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import {savedNutritionMarkup} from '../public/js/saved-nutrition-view.mjs';
const food={name:'Dry oats',amount:'50 g',calories:190,proteinGrams:7,carbsGrams:34,fatGrams:3};
const saved={name:'My plan',plan:{dailyCalories:2100,meals:[{mealNumber:1,name:'Breakfast',options:[{optionNumber:1,mealName:'Yogurt bowl',foods:[food],optionCalories:190,optionProteinGrams:7,optionCarbsGrams:34,optionFatGrams:3},{optionNumber:2,name:'Alternative',foods:[{...food,name:'Bread',calories:250}],optionCalories:250}]}]}};
test('generated saved menus expose foods, amounts, macros and preserved alternatives without mutation',()=>{
  const before=structuredClone(saved),html=savedNutritionMarkup(saved),{document}=parseHTML(html);
  assert.match(document.querySelector('table').textContent,/Dry oats50 g190 kcal7 g/);
  assert.match(document.querySelector('details').textContent,/Bread/);
  assert.match(document.querySelector('.saved-nutrition-summary').textContent,/Saved menu calories190 kcal/);
  assert.deepEqual(saved,before);
});
test('manually saved menus use scaled foods, not base foods or target calories',()=>{
  const html=savedNutritionMarkup({sourceType:'manual',targetSummary:{dailyCalories:2250},plan:{meals:[{name:'Dinner',options:[{servings:2,baseFoods:[food],foods:[{...food,amount:'100 g',calories:380}],optionCalories:380}]}]}});
  assert.match(html,/2250 kcal/);assert.match(html,/Saved menu calories<\/dt><dd>380 kcal/);assert.match(html,/100 g/);
});
test('explicit saved option selection is honored and missing historical ingredients are not invented',()=>{
  const copy=structuredClone(saved);copy.plan.selectedOptionNumbers={1:2};
  assert.match(savedNutritionMarkup(copy),/Saved menu calories<\/dt><dd>250 kcal/);
  const empty=savedNutritionMarkup({plan:{dailyCalories:2000}});assert.match(empty,/contains no meals/);assert.doesNotMatch(empty,/Saved menu calories<\/dt><dd>0 kcal/);
  assert.match(savedNutritionMarkup({plan:{meals:[{title:'Old lunch',calories:500}]}}),/no ingredient breakdown/);
});
test('ingredient arithmetic wins over a stale saved summary with a visible discrepancy notice',()=>{
  const copy=structuredClone(saved);copy.plan.meals[0].options[0].optionCalories=999;
  const html=savedNutritionMarkup(copy);assert.match(html,/Saved menu calories<\/dt><dd>190 kcal/);
  assert.match(html,/saved summary differs/);assert.equal(copy.plan.meals[0].options[0].optionCalories,999);
});
test('stored content is escaped and untrusted image schemes/remote endpoints are not loaded',()=>{
  const copy=structuredClone(saved);copy.plan.meals[0].options[0].foods[0].name='<img src=x onerror=alert(1)>';
  copy.plan.meals[0].options[0].image='https://untrusted.example/track';
  const {document}=parseHTML(savedNutritionMarkup(copy));assert.equal(document.querySelectorAll('img').length,0);
  assert.match(document.querySelector('tbody').textContent,/<img src=x/);
});
test('older saved meals gain a newly added photo by catalog ID without changing their food snapshot',()=>{
  const copy=structuredClone(saved);
  copy.plan.meals[0].options[0].mealId='simple-peanut-banana-bread';
  const before=structuredClone(copy);
  const {document}=parseHTML(savedNutritionMarkup(copy));
  assert.equal(document.querySelector('.saved-meal-image')?.getAttribute('src'),'/images/meals/simple-peanut-banana-bread.webp');
  assert.deepEqual(copy,before);
});
test('Hebrew labels and both owner-facing entry points use the same full saved-menu viewer',()=>{
  assert.match(savedNutritionMarkup(saved,'he'),/קלוריות בארוחות השמורות/);
  for(const file of ['my-nutrition-plans.js','dashboard-editorial-view.mjs'])assert.match(fs.readFileSync(new URL('../public/js/'+file,import.meta.url),'utf8'),/openSavedNutrition/);
  const page=fs.readFileSync(new URL('../public/js/my-nutrition-plans.js',import.meta.url),'utf8');assert.match(page,/view-nutrition-button/);
});
