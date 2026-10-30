import test from 'node:test';
import assert from 'node:assert/strict';
import {muscleAnatomySvg} from '../public/js/muscle-anatomy.mjs';
test('all supported muscle groups show exactly one highlighted anatomical region',()=>{
 for(const key of ['chest','back','delts','rear_delts','biceps','triceps','quads','hamstrings','glutes','calves','core','traps','adductors','abductors']){
  const svg=muscleAnatomySvg(key);assert.match(svg,/<svg/);assert.equal((svg.match(/is-targeted/g)||[]).length,1,`${key} must be highlighted`);
 }
 assert.match(muscleAnatomySvg('back'),/data-anatomy-view="back"/);
 assert.match(muscleAnatomySvg('chest'),/data-anatomy-view="front"/);
});
