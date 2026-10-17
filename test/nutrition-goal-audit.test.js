const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {calculateNutritionTargets,ACTIVITY_MULTIPLIERS}=require('../lib/nutrition-targets');
test('calorie audit: every accepted adult profile has cut < maintenance < gain, independent of equation coefficient',()=>{
  let accepted=0,review=0;
  for(const age of [18,22,30,50,65,85])for(const gender of ['female','male'])for(const activityLevel of Object.keys(ACTIVITY_MULTIPLIERS))for(const [height,weight] of [[155,50],[165,60],[180,80],[190,100]]){
    const profile={age,gender,activityLevel,height,weight},results=[];
    for(const goal of ['fat-loss','maintenance','muscle-gain']){
      try{results.push(calculateNutritionTargets({...profile,goal}));}
      catch(error){assert.equal(error.status,422);assert.match(error.message,/underweight|protein estimate|feasible/);results.push(null);review++;}
    }
    const [cut,maintain,gain]=results;
    if(cut&&maintain)assert.ok(cut.dailyCalories<maintain.dailyCalories,JSON.stringify(profile));
    if(maintain&&gain)assert.ok(maintain.dailyCalories<gain.dailyCalories,JSON.stringify(profile));
    for(const target of results.filter(Boolean)){
      accepted++;assert.ok(Object.values(target).filter(v=>typeof v==='number').every(Number.isFinite));
      assert.ok(target.carbsGrams>=0);assert.equal(target.dailyCalories%50,0);
      assert.ok(Math.abs(target.proteinGrams*4+target.carbsGrams*4+target.fatGrams*9-target.dailyCalories)<=3);
    }
    assert.equal(new Set(results.filter(Boolean).map(t=>t.tdee)).size,1,'maintenance depends on body/activity, not goal');
  }
  assert.ok(accepted>600);assert.ok(review>0);
});
test('female regression example distinguishes a rejected cut from a valid gain rather than reusing its calories',()=>{
  const profile={age:30,gender:'female',height:180,weight:80,activityLevel:'sedentary'};
  assert.throws(()=>calculateNutritionTargets({...profile,goal:'fat-loss'}),e=>e.status===422&&/protein estimate/.test(e.message));
  assert.equal(calculateNutritionTargets({...profile,goal:'maintenance'}).dailyCalories,1950);
  assert.equal(calculateNutritionTargets({...profile,goal:'muscle-gain'}).dailyCalories,2150);
});
test('manual controls stay compact and native; result copy distinguishes menu portions, goal, maintenance and targets',()=>{
  const read=p=>fs.readFileSync(require('node:path').join(__dirname,'../public',p),'utf8');
  assert.match(read('manual-nutrition-builder.html'),/id="targetForm"[^>]*data-native-controls/);
  assert.match(read('js/product-motion-v47.js'),/select\.closest\('\[data-native-controls\]'\)/);
  assert.match(read('css/manual-nutrition-builder.css'),/height:46px/);
  assert.match(read('js/manual-nutrition-builder.js'),/\$\("#targetSummary"\)\.innerHTML = ''/);
  for(const label of ['Calculated goal','Maintenance estimate','Goal calorie target','menu / target','No new target was calculated'])assert.ok(read('js/manual-nutrition-builder.js').includes(label),label);
});
