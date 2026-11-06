import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { calculateSavedWeeklySets } from '../public/js/saved-workout-volume.mjs';

const source = fs.readFileSync(new URL('../public/js/workout-builder.js', import.meta.url), 'utf8');
const renderSource = source.slice(source.indexOf('function renderWeeklyVolumeSummary('), source.indexOf('\nfunction volumeStatusForAdjustment('));
const savedSource = fs.readFileSync(new URL('../public/js/saved-workout-view.mjs', import.meta.url), 'utf8');
// Execute the actual render functions independently of browser-only .js imports
// in this CommonJS project, just as the existing builder render tests do.
const savedRenderSource = savedSource.slice(savedSource.indexOf('const esc ='), savedSource.indexOf('export async function openSavedWorkout(')).replace('export function ', 'function ');
const muscleNames = vm.runInNewContext('({' + source.match(/const MUSCLE_DISPLAY_NAMES = \{([\s\S]*?)\};/)[1] + '})');
const entry = (total, direct = total) => ({total, direct, fractional: total - direct, status: 'secondary'});
const fixture = () => ({totalHardSets: 15, unknownExercises: 0, perMuscle: {
  chest: entry(12), triceps: entry(6, 0), core: entry(0.5, 0), adductors: entry(0), abductors: entry(0)
}});
function builderMarkup(volume, language) {
  const ui = new Proxy({}, {get: (_, key) => ['weeklyVolumeSets','weeklyVolumeProgrammingRange','weeklyVolumeTargetRange','weeklyVolumeRecommendedRange','weeklyVolumeDetails'].includes(key)
    ? (...values) => values.join(' / ') : key === 'weeklyVolumeUnmapped' ? 'Incomplete mapping' : String(key)});
  return vm.runInNewContext(renderSource + ';renderWeeklyVolumeSummary(volume)', {
    volume, ui, isHebrew: language === 'he', MUSCLE_DISPLAY_NAMES: muscleNames,
    escapeHtml: value => String(value), translateWorkoutValue: value => value,
    formatVolumeNumber: value => String(value), muscleAnatomySvg: () => ''
  });
}
const viewers = {
  builder: builderMarkup,
  saved: (volume, language) => vm.runInNewContext(savedRenderSource + ';workoutReviewMarkup({sessions:[]},volume,language,"volume")', {
    volume, language, muscleAnatomySvg: () => ''
  })
};
for (const [name, render] of Object.entries(viewers)) {
  for (const language of ['en','he']) test(`${name}, ${language}: hide zero-set muscles; retain fractional and indirect work without changing data`, () => {
    const volume = fixture(), before = structuredClone(volume);
    const {document} = parseHTML(render(volume, language));
    assert.deepEqual([...document.querySelectorAll('[data-muscle]')].map(el => el.dataset.muscle), ['chest','triceps','core']);
    assert.deepEqual(volume, before);
  });
  test(`${name}: an unmapped workout still reports incomplete mapping, without inventing muscle work`, () => {
    const volume = calculateSavedWeeklySets({sessions: [{exercises: [{name:'Unmapped custom exercise',sets:3}]}]}).weeklyVolume;
    const {document} = parseHTML(render(volume, 'en'));
    assert.equal(document.querySelectorAll('[data-muscle]').length, 0);
    assert.match(document.toString(), /Incomplete mapping|Partial calculation/);
    assert.equal(volume.totalHardSets, 3);
  });
  test(`${name}: an empty known workout has no zero-set muscle cards`, () => {
    const volume = fixture(); Object.keys(volume.perMuscle).forEach(key => {volume.perMuscle[key] = entry(0);});
    assert.equal(parseHTML(render(volume, 'en')).document.querySelectorAll('[data-muscle]').length, 0);
  });
}
