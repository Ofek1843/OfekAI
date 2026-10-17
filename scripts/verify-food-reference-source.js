#!/usr/bin/env node
'use strict';
// Offline verification against the official downloaded archive and extracted JSON.
// No credentials, network calls, mutations or missing-as-zero coercion.
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const assert=require('node:assert/strict');
const data=require('../data/food-reference-v1.json');
const [archivePath,jsonPath]=process.argv.slice(2);
if(!archivePath||!jsonPath){
  console.error('Usage: node scripts/verify-food-reference-source.js <official-zip> <extracted-json>');
  process.exitCode=1;
}else{
  const hash=value=>createHash('sha256').update(value).digest('hex');
  assert.equal(hash(fs.readFileSync(archivePath)),data.source.archiveSha256,'archive SHA256');
  const all=JSON.parse(fs.readFileSync(jsonPath,'utf8')).SRLegacyFoods;
  const fields={calories:[1008,'kcal'],proteinGrams:[1003,'g'],carbsGrams:[1005,'g'],fatGrams:[1004,'g'],fiberGrams:[1079,'g']};
  for(const [key,record] of Object.entries(data.foods)){
    const raw=all.find(food=>food.fdcId===record.fdcId);
    assert.ok(raw,`${key}: source record exists`);
    assert.equal(hash(JSON.stringify(raw)),record.sourceRecordSha256,`${key}: immutable record hash`);
    assert.equal(raw.description,record.description,`${key}: exact identity`);
    assert.equal(raw.publicationDate,record.publicationDate,`${key}: publication date`);
    assert.equal(raw.dataType,data.source.dataType,`${key}: dataset type`);
    for(const [field,[id,unit]] of Object.entries(fields)){
      const nutrient=raw.foodNutrients.find(n=>n.nutrient.id===id);
      assert.ok(nutrient,`${key}: ${field} present`);
      assert.equal(nutrient.nutrient.unitName.toLowerCase(),unit,`${key}: ${field} units`);
      assert.equal(record.nutrientsPer100g[field],nutrient.amount,`${key}: ${field} value`);
    }
  }
  console.log(JSON.stringify({status:'PASS',records:Object.keys(data.foods).length,dataVersion:data.dataVersion,archiveSha256:data.source.archiveSha256,verified:'archive hash, record hashes, exact identity, dates, nutrient ids, units and values'},null,2));
}
