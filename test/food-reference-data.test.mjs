import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {foodReferenceData} from '../public/js/food-reference-data.mjs';
import {FOOD_CATALOG,parseFoodText,rescaleEntrySnapshot} from '../public/js/daily-nutrition-domain.mjs';
const require=createRequire(import.meta.url);
const {FOODS,CATALOG,buildMealOption,macrosFor}=require('../lib/meal-catalog');
const {buildFoodProvenanceInventory}=require('../lib/food-provenance');
test('browser reference data is an exact mirror of the versioned canonical JSON',()=>{
  assert.deepEqual(foodReferenceData,JSON.parse(fs.readFileSync(new URL('../data/food-reference-v1.json',import.meta.url),'utf8')));
  assert.match(foodReferenceData.source.archiveSha256,/^[a-f0-9]{64}$/);
});
test('all 12 matched records preserve identity, preparation, 100g basis and exact macros in both catalogs',()=>{
  assert.equal(Object.keys(foodReferenceData.foods).length,12);
  for(const [key,record] of Object.entries(foodReferenceData.foods)){
    const generator=FOODS[key],diary=FOOD_CATALOG.find(f=>f.id===(key==='carrots'?'carrot':key));
    assert.ok(generator,key);assert.ok(diary,key);
    assert.equal(record.reference.recordId,record.fdcId);assert.equal(record.reference.url,record.sourceUrl);
    assert.equal(record.reference.version,foodReferenceData.dataVersion);
    assert.equal(record.reference.state,record.preparationState);
    assert.equal(record.reference.basisAmount,100);assert.equal(record.reference.basisUnit,'g');
    assert.equal(record.reference.ediblePortion,true);assert.match(record.sourceRecordSha256,/^[a-f0-9]{64}$/);
    assert.deepEqual(generator.reference,record.reference);assert.deepEqual(diary.reference,record.reference);
    const n=record.nutrientsPer100g;
    assert.deepEqual([generator.kcal,generator.p,generator.c,generator.f,generator.fiber],[n.calories,n.proteinGrams,n.carbsGrams,n.fatGrams,n.fiberGrams]);
    assert.deepEqual([diary.macros.calories,diary.macros.protein,diary.macros.carbs,diary.macros.fat],[n.calories,n.proteinGrams,n.carbsGrams,n.fatGrams]);
  }
});
test('numeric or reference tampering cannot retain a source-matched audit status',()=>{
  for(const changed of [{...FOODS.oats,kcal:400},{...FOODS.oats,fiber:20},{...FOODS.oats,reference:{...FOODS.oats.reference,recordId:123}}]){
    const row=buildFoodProvenanceInventory({oats:changed}).ingredients[0];
    assert.equal(row.source.status,'unverified-legacy');
    assert.ok(row.flags.includes('external-source-required'));
  }
});
test('generated recipe ingredients retain source snapshots and sum the newly sourced values',()=>{
  const meal=CATALOG.find(row=>row.items.some(([key])=>key==='oats'));
  const option=buildMealOption(meal.id),row=option.foods.find(f=>f.catalogKey==='oats');
  assert.deepEqual(row.reference,foodReferenceData.foods.oats.reference);
  assert.equal(row.calories,Math.round(379*row.grams/100));
  assert.equal(row.fiberGrams,Number((10.1*row.grams/100).toFixed(1)));
  assert.equal(option.optionCalories,option.foods.reduce((sum,food)=>sum+food.calories,0));
  assert.equal(macrosFor('oats',100).fiberGrams,10.1);
  row.reference.version='mutated copy';assert.equal(FOODS.oats.reference.version,foodReferenceData.dataVersion);
});
test('new generic oats use the pinned 379kcal reference without certifying or changing Quaker',()=>{
  const entry=parseFoodText('50g oats').entries[0];
  assert.equal(entry.calories,189.5);assert.equal(entry.reference.recordId,173904);
  const brand=FOOD_CATALOG.find(f=>f.id==='oats-quaker-original');
  assert.equal(brand.macros.calories,375);assert.notEqual(brand.reference.status,'source-matched');
});
test('editing legacy and new snapshots preserves their own composition and provenance without mutation',()=>{
  const legacy={id:'old',foodId:'oats',name:{en:'Oats'},amount:50,unit:'g',calories:187.5,proteinGrams:6.6,carbsGrams:33.9,fatGrams:3.3};
  const fresh=parseFoodText('50g oats').entries[0],before=structuredClone(fresh);
  assert.equal(rescaleEntrySnapshot(legacy,100).calories,375);
  assert.equal(rescaleEntrySnapshot(legacy,100).reference,undefined);
  const scaled=rescaleEntrySnapshot(fresh,100);assert.equal(scaled.calories,379);assert.deepEqual(scaled.reference,fresh.reference);
  assert.notEqual(scaled.reference,fresh.reference);assert.equal(legacy.calories,187.5);assert.deepEqual(fresh,before);
  for(const amount of [0,0.001,-1,NaN,Infinity,10001])assert.throws(()=>rescaleEntrySnapshot(fresh,amount),/INVALID_AMOUNT/);
  assert.throws(()=>rescaleEntrySnapshot({...fresh,calories:NaN},100),/INVALID_ENTRY/);
});
