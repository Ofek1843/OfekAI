const test=require('node:test'),assert=require('node:assert/strict');
const {FOODS,CATALOG}=require('../lib/meal-catalog');
const {buildFoodProvenanceInventory,preparationFromLabel}=require('../lib/food-provenance');
test('every generator ingredient has an honest, complete provenance inventory without altering values',()=>{
  const before=JSON.stringify(FOODS),report=buildFoodProvenanceInventory(FOODS,CATALOG);
  assert.equal(report.ingredients.length,Object.keys(FOODS).length);assert.equal(report.summary.invalidMacros,0);
  assert.equal(report.summary.sourceMatched,12);
  for(const row of report.ingredients){
    if(row.source.status==='source-matched'){assert.ok(row.source.recordId);assert.match(row.source.url,/^https:\/\/fdc.nal.usda.gov\/food-details\//);}
    else {assert.equal(row.source.status,'unverified-legacy');assert.equal(row.source.recordId,null);}
    assert.equal(row.basis.unit,'g');assert.equal(row.basis.amount,100);assert.match(row.legacyFingerprint,/^[a-f0-9]{64}$/);assert.ok(row.flags.includes('micronutrients-unverified'));
  }
  assert.equal(JSON.stringify(FOODS),before);
});
test('ambiguous salmon/chicken labels do not become verified cooked ingredients',()=>{
  assert.equal(preparationFromLabel('Salmon fillet'),'unspecified');
  assert.equal(preparationFromLabel('Chicken thigh (skinless)'),'unspecified');
  assert.equal(preparationFromLabel('White rice (cooked)'),'cooked');
  assert.equal(preparationFromLabel('Oats (dry)'),'dry');
});
test('invalid data is reported and missing nutrient fields are not imputed as zero',()=>{
  const report=buildFoodProvenanceInventory({bad:{en:'Food',he:'מזון',kcal:0,p:-1,c:NaN}},[]);
  assert.equal(report.summary.invalidMacros,1);assert.ok(report.ingredients[0].flags.includes('invalid-macro-value'));
  assert.equal(report.ingredients[0].nutrientsPer100g.fatGrams,undefined);
});
test('the explicit verification gate fails while external sources remain unverified',()=>{
  const {spawnSync}=require('node:child_process');
  const run=spawnSync(process.execPath,['scripts/audit-food-provenance.js','--summary','--require-verified'],{cwd:require('node:path').join(__dirname,'..'),encoding:'utf8'});
  assert.equal(run.status,1);assert.equal(JSON.parse(run.stdout).sourceMatched,12);
});
test('diary references without record ids stay unverified and cross-catalog differences are not silently unified',async()=>{
  const {buildDiaryProvenanceInventory,crossCatalogReviewCandidates}=require('../lib/food-provenance');
  const {FOOD_CATALOG}=await import('../public/js/daily-nutrition-domain.mjs');
  const generator=buildFoodProvenanceInventory(FOODS,CATALOG),diary=buildDiaryProvenanceInventory(FOOD_CATALOG);
  assert.equal(diary.length,FOOD_CATALOG.length);assert.equal(diary.filter(row=>row.source.status==='source-matched').length,12);
  assert.equal(diary.find(row=>row.key==='oats-quaker-original').source.status,'unverified-legacy');
  const differences=crossCatalogReviewCandidates(generator,diary),oats=differences.find(row=>row.key==='oats');
  assert.equal(oats,undefined,'both catalogs now use the same pinned dry regular/quick oats reference');
  assert.ok(differences.length>0,'unreviewed foods are not automatically unified');
  assert.equal(differences.some(row=>row.key==='rice-cake'),false,'counted portions cannot be compared to 100g without conversion evidence');
});
