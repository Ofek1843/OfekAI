#!/usr/bin/env node
"use strict";
const {FOODS,CATALOG}=require('../lib/meal-catalog');
const {buildFoodProvenanceInventory,buildDiaryProvenanceInventory,crossCatalogReviewCandidates}=require('../lib/food-provenance');
(async()=>{
  const report=buildFoodProvenanceInventory(FOODS,CATALOG);
  const {FOOD_CATALOG}=await import('../public/js/daily-nutrition-domain.mjs');
  const diary=buildDiaryProvenanceInventory(FOOD_CATALOG);
  const comparisons=crossCatalogReviewCandidates(report,diary);
  const full={...report,diary,crossCatalogReviewCandidates:comparisons};
  console.log(JSON.stringify(process.argv.includes('--summary')?{...report.summary,diaryFoods:diary.length,diarySourceMatched:diary.filter(f=>f.source.status==='source-matched').length,crossCatalogReviewCandidates:comparisons.map(row=>row.key),reviewPriority:report.reviewPriority.slice(0,15)}:full,null,2));
  if(report.summary.invalidMacros)process.exitCode=1;
  if(process.argv.includes('--require-verified')&&(report.summary.sourceMatched!==report.summary.ingredients||diary.some(f=>f.source.status!=='source-matched')))process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
