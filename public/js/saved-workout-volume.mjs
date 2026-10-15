import { workoutVolumeCatalog as catalog, workoutVolumeAliases as aliases } from './workout-volume-data.mjs';
const slug = value => String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const manualAliases = {'hip-thrust':'barbell-hip-thrust','walking-lunge':'dumbbell-walking-lunge'};
const muscleKeys = ['chest','back','delts','rear_delts','biceps','triceps','quads','hamstrings','glutes','calves','core','traps','adductors','abductors'];
// Identical catalog credits to the server. Counting runs immediately on the
// saved program, so manual plans don't depend on an authenticated API roundtrip.
export function calculateSavedWeeklySets(program = {}) {
  const perMuscle = Object.fromEntries(muscleKeys.map(key=>[key,{direct:0,fractional:0,total:0}]));
  let totalHardSets=0,mappedExercises=0,unknownExercises=0;
  const sessions=(program.sessions||[]).map(session=>({...session,exercises:(session.exercises||[]).map(exercise=>{
    const legacyBack = [exercise.name,exercise.exerciseName,exercise.exercise].map(slug).some(name=>['back-extension','hyperextension'].includes(name)) && (!exercise.exerciseId || exercise.exerciseId==='good-morning');
    const candidates=[legacyBack?'back-extension':exercise.exerciseId,exercise.demoName,exercise.name,exercise.exerciseName,exercise.exercise]
      .map(slug).map(id=>aliases[id]||id).map(id=>manualAliases[id]||id);
    const id=candidates.find(id=>catalog[id])||Object.keys(catalog).find(id=>candidates.includes(String(catalog[id].image||'').replace(/\.(png|webp)$/,'')))||'';
    const sets=Math.max(0,Number(exercise.sets)||0);totalHardSets+=sets;
    const credits=catalog[id]?.credits;
    if(!credits||!Object.keys(credits).length) unknownExercises++;
    else {
      mappedExercises++;
      for(const [muscle,credit] of Object.entries(credits)){
        const count=perMuscle[muscle]||(perMuscle[muscle]={direct:0,fractional:0,total:0});
        count[credit===1?'direct':'fractional']+=sets*credit;count.total+=sets*credit;
      }
    }
    return {...exercise,exerciseId:id,demoName:id||exercise.demoName};
  })}));
  return {program:{...program,sessions},weeklyVolume:{perMuscle,totalHardSets,mappedExercises,unknownExercises}};
}
