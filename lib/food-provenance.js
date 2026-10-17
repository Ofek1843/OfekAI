"use strict";

// Source matching is numerical traceability, not clinical certification.
// Explicit wording can describe preparation, but cannot verify nutrient data,
// edible yield, allergy absence, a brand or a clinical adequacy claim.
const {createHash}=require('node:crypto');
const referenceData=require('../data/food-reference-v1.json');
function matchedSource(key,reference,nutrients,basis) {
  const record=referenceData.foods[key==='carrot'?'carrots':key];
  if(!record||!reference||basis.amount!==100||basis.unit!=='g')return null;
  if(Object.entries(record.reference).some(([field,value])=>reference[field]!==value))return null;
  if(Object.entries(nutrients).some(([field,value])=>value!==record.nutrientsPer100g[field]))return null;
  return {status:'source-matched',provider:reference.source,recordId:record.fdcId,url:record.sourceUrl,
    version:reference.version,retrievedAt:reference.retrievedAt,dataType:reference.dataType,
    publicationDate:reference.publicationDate,sourceRecordSha256:record.sourceRecordSha256};
}
function preparationFromLabel(label) {
  const text=String(label||'').toLowerCase();
  if (/\b(dry|dried)\b/.test(text)) return 'dry';
  if (/\b(cooked|grilled|baked|boiled|roasted|steamed|fried)\b/.test(text)) return 'cooked';
  if (/\braw\b/.test(text)) return 'raw';
  return 'unspecified';
}

function buildFoodProvenanceInventory(foods,meals=[]) {
  const ingredients=Object.entries(foods).sort(([a],[b])=>a.localeCompare(b)).map(([key,food])=>{
    const nutrientsPer100g={calories:food.kcal,proteinGrams:food.p,carbsGrams:food.c,fatGrams:food.f};
    const source=matchedSource(key,food.reference,{...nutrientsPer100g,fiberGrams:food.fiber},{amount:100,unit:'g'});
    const preparationState=source?food.reference.state:preparationFromLabel(food.en);
    const usedIn=meals.filter(meal=>meal.items.some(([id])=>id===key)).map(meal=>meal.id).sort();
    const missingOrInvalidMacros=Object.values(nutrientsPer100g).some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0);
    const flags=[...(!source?['external-source-required','edible-portion-unverified']:[]),'micronutrients-unverified','allergen-label-and-cross-contact-unverified'];
    if(preparationState==='unspecified')flags.push('preparation-state-required');
    if(/canned/i.test(food.en)&&!/drained/i.test(food.en))flags.push('drained-weight-unspecified');
    if(missingOrInvalidMacros)flags.push('invalid-macro-value');
    const macroEnergy=4*Number(food.p)+4*Number(food.c)+9*Number(food.f);
    if(Number.isFinite(macroEnergy)&&food.kcal>0&&Math.abs(macroEnergy-food.kcal)/food.kcal>0.15) flags.push('macro-energy-difference-review');
    return {key,name:{en:food.en,he:food.he},basis:{amount:100,unit:'g'},preparationState,
      preparationEvidence:preparationState==='unspecified'?null:{type:source?'external-source-description':'internal-label-only',text:source?referenceData.foods[key==='carrot'?'carrots':key].description:food.en},
      source:source||{status:'unverified-legacy',provider:null,recordId:null,url:null,version:null,reviewedAt:null},
      legacyFingerprint:createHash('sha256').update(JSON.stringify({key,label:food.en,...nutrientsPer100g})).digest('hex'),
      nutrientsPer100g,declaredAllergens:[...(food.alg||[])],usedIn,flags};
  });
  return {schemaVersion:1,scope:'meal-generator-ingredients',
    notice:'Source-matched means the specified 100g preparation matches a pinned external record, not clinical, brand or allergen certification. Missing information is unknown, never zero. Numeric energy differences are review prompts, not proof of an error.',
    summary:{ingredients:ingredients.length,recipes:meals.length,sourceMatched:ingredients.filter(f=>f.source.status==='source-matched').length,
      unspecifiedPreparation:ingredients.filter(f=>f.preparationState==='unspecified').length,
      invalidMacros:ingredients.filter(f=>f.flags.includes('invalid-macro-value')).length,
      macroEnergyReview:ingredients.filter(f=>f.flags.includes('macro-energy-difference-review')).length},
    reviewPriority:ingredients.filter(f=>f.preparationState==='unspecified').sort((a,b)=>b.usedIn.length-a.usedIn.length||a.key.localeCompare(b.key)).map(f=>({key:f.key,recipes:f.usedIn.length})),ingredients};
}
function buildDiaryProvenanceInventory(foods) {
  return foods.map(food=>{
    const nutrients={calories:food.macros.calories,proteinGrams:food.macros.protein,carbsGrams:food.macros.carbs,fatGrams:food.macros.fat};
    const source=matchedSource(food.id,food.reference,nutrients,{amount:food.baseAmount,unit:food.baseUnit});
    return {key:food.id,name:food.name,basis:{amount:food.baseAmount,unit:food.baseUnit},
    nutrients,
    declaredReference:food.reference||null,preparationState:food.reference?.state||preparationFromLabel(food.name?.en),
    source:source||{status:'unverified-legacy',recordId:null,url:null},
    flags:[...(!source?['external-source-required']:[]),...(food.baseUnit==='g'?[]:['unit-weight-or-product-label-required'])]};});
}
function crossCatalogReviewCandidates(generator,diary) {
  // Exact ids are candidates, NOT an assertion of identical preparation,
  // variety, product or brand. Do not overwrite either catalog automatically.
  return generator.ingredients.flatMap(food=>{
    const other=diary.find(row=>row.key===food.key&&row.basis.unit==='g'&&row.basis.amount===100);
    if(!other)return [];
    const differences=Object.keys(food.nutrientsPer100g).filter(k=>food.nutrientsPer100g[k]!==other.nutrients[k]);
    return differences.length?[{key:food.key,generator:food.nutrientsPer100g,diary:other.nutrients,generatorState:food.preparationState,diaryState:other.preparationState,differences,action:'review-identity-and-source-before-unifying'}]:[];
  });
}
module.exports={preparationFromLabel,buildFoodProvenanceInventory,buildDiaryProvenanceInventory,crossCatalogReviewCandidates};
