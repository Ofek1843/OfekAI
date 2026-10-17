import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseFoodText, parseAmountPrefix, resolveFoodChoice, rescaleEntrySnapshot } from '../public/js/daily-nutrition-domain.mjs';
import { preparationIdentity, cachedWeighedFood, cacheInterpretedFood } from '../public/js/food-preparation.mjs';

const fixture = (calories = 140, preparationState = 'cooked') => ({ food: { name: { en: 'Ramen', he: 'ראמן' }, aliases: ['ramen noodles'] },
  nutritionPer100g: { calories, proteinGrams: 5, carbsGrams: 20, fatGrams: 3 }, preparationState });

test('105g ramen in either language asks the same state question without adding food', () => {
  const inputs = ['105g ramen', '105 גרם ראמן', 'ראמן 105 גרם', '0.105 kg ramen'];
  for (const input of inputs) {
    const result = parseFoodText(input);
    assert.equal(result.entries.length, 0, input);
    assert.equal(result.ambiguities[0].kind, 'preparation', input);
    assert.deepEqual(result.ambiguities[0].choices.map(item => item.choiceId), ['dry', 'cooked', 'soup']);
    assert.equal(result.ambiguities[0].choices.some(item => item.isEstimateFallback), false);
    const next = parseAmountPrefix(result.ambiguities[0].choices[0].query);
    assert.equal(next.amount * (next.unit === 'kg' ? 1000 : 1), 105);
    assert.deepEqual(preparationIdentity(next.foodText), { key: 'ramen', state: 'dry', states: ['dry', 'cooked', 'soup'] });
  }
});

test('staples and raw meat ask before choosing composition, but explicit state does not', () => {
  for (const name of ['rice', 'אורז', 'pasta', 'פסטה', 'lentils', 'עדשים', 'quinoa', 'קינואה', 'bulgur', 'בורגול', 'couscous', 'קוסקוס', 'chickpeas', 'גרגירי חומוס', 'chicken breast', 'חזה עוף']) {
    const result = parseFoodText(`105g ${name}`);
    assert.equal(result.ambiguities[0].kind, 'preparation', name);
    const entries = result.ambiguities[0].choices.map(choice => parseFoodText(choice.query).entries[0]);
    assert.equal(entries.length, 2);
    assert.ok(entries.every(entry => entry?.amount === 105), name);
    assert.notEqual(entries[0].calories, entries[1].calories, name);
  }
  assert.equal(parseFoodText('105g dry rice').entries[0].reference.state, 'dry');
  assert.equal(parseFoodText('105 גרם אורז מבושל').entries[0].reference.state, 'cooked');
  assert.equal(preparationIdentity('אורז לא מבושל').state, 'dry');
  assert.equal(parseFoodText('105g cottage cheese 5%').entries.length, 1);
});

test('the same prepared food shares a composition across aliases, never across states', () => {
  let { food, foods } = cacheInterpretedFood([], fixture(), parseAmountPrefix('105g cooked ramen'), '105g cooked ramen');
  for (const input of ['105g cooked ramen', '105 גרם ראמן מבושל', '0.105 kg boiled ramen']) {
    const parsed = parseAmountPrefix(input), found = cachedWeighedFood(foods, parsed);
    assert.equal(found.id, food.id, input);
    const entry = resolveFoodChoice(found.id, { amount: parsed.amount, unit: parsed.unit, customFoods: foods });
    assert.equal(entry.calories, 147);
    assert.equal(entry.amount, 105);
    assert.equal(entry.reference.state, 'cooked');
    assert.equal(entry.source, 'ai-estimate');
  }
  assert.equal(cachedWeighedFood(foods, parseAmountPrefix('105g dry ramen')), null);
  assert.equal(cachedWeighedFood(foods, parseAmountPrefix('105g ramen soup')), null);
  assert.equal(cachedWeighedFood(foods, parseAmountPrefix('105g ramen')), null);
  assert.equal(cachedWeighedFood(foods, parseAmountPrefix('ramen')), null, 'never infer a 100g portion');
  const same = cacheInterpretedFood(foods, fixture(130), parseAmountPrefix('105 גרם ראמן מבושל'), '105 גרם ראמן מבושל');
  assert.equal(same.food.macros.calories, 140, 'a second language cannot overwrite the original composition');
  assert.equal(same.food.id, food.id);
  assert.equal(same.foods.length, 1);
  const dry = cacheInterpretedFood(same.foods, fixture(440, 'dry'), parseAmountPrefix('105g dry ramen'), '105g dry ramen');
  assert.equal(dry.food.macros.calories, 440);
  assert.equal(dry.foods.length, 2);
});

test('a provider cannot relabel a dry composition as cooked or omit a requested state', () => {
  for (const state of ['dry', 'raw', 'ready', undefined]) {
    const interpretation = { ...fixture(), preparationState: state };
    assert.throws(() => cacheInterpretedFood([], interpretation, parseAmountPrefix('105g cooked ramen'), '105g cooked ramen'), /PREPARATION_MISMATCH/);
  }
});

test('legacy cache, other ingredients and missing quantity never become a new canonical match', () => {
  const { foods } = cacheInterpretedFood([], fixture(), parseAmountPrefix('105g cooked ramen'), '105g cooked ramen');
  assert.equal(cachedWeighedFood([{ ...foods[0], cacheVersion: 1 }], parseAmountPrefix('105g cooked ramen')), null);
  assert.equal(cachedWeighedFood(foods, parseAmountPrefix('105g chicken with cooked ramen')), null);
  const compound = cacheInterpretedFood(foods, fixture(), parseAmountPrefix('105g cooked ramen with chicken'), '105g cooked ramen with chicken');
  assert.notEqual(compound.food.id, foods[0].id, 'a broad AI name cannot collapse a dish into one of its ingredients');
  assert.equal(compound.foods.length, 2);
  const history = { amount: 105, unit: 'g', calories: 136.5, proteinGrams: 5.3, carbsGrams: 21, fatGrams: 3.2, reference: { state: 'unknown' } };
  const before = structuredClone(history);
  rescaleEntrySnapshot(history, 210);
  assert.deepEqual(history, before, 'old entry snapshots are never migrated to the new cache');
});

test('UI submission asks again despite remembered state, and reuses a cached weighed interpretation without API calls', async () => {
  const source = fs.readFileSync(new URL('../public/js/daily-nutrition.js', import.meta.url), 'utf8');
  const state = { user: { uid: 'synthetic' }, dateKey: '2026-10-16', dateLoadRequest: 1, log: {}, customFoods: [],
    smartFoods: cacheInterpretedFood([], fixture(), parseAmountPrefix('105g cooked ramen'), '105g cooked ramen').foods };
  let questions = 0, calls = 0; const entries = [];
  const ctx = { state, language: 'he', parseFoodText, parseAmountPrefix, resolveFoodChoice, cachedWeighedFood,
    localStorage: { getItem: () => 'cooked' }, availableFoods: () => state.smartFoods,
    renderClarification: () => { questions++; }, requestSmartFoodInterpretation: async () => { calls++; throw Error('NO_LIVE_API'); },
    setComposerMessage() {}, addEntries: items => entries.push(...items), $: () => ({ hidden: false }) };
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('async function submitFoodText('), source.indexOf('function bindEvents')), ctx);
  await ctx.submitFoodText('105 גרם ראמן');
  assert.equal(questions, 1); assert.equal(entries.length, 0); assert.equal(calls, 0);
  await ctx.submitFoodText('105 גרם ראמן מבושל');
  await ctx.submitFoodText('105g cooked ramen');
  assert.equal(calls, 0); assert.equal(entries.length, 2);
  assert.equal(entries[0].calories, 147); assert.equal(entries[1].calories, 147);
  assert.ok(entries.every(entry => entry.estimated && entry.approximate));
});
