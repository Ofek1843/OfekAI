// Identity/clarification only: never derive cooked nutrition from dry weight.
const normalized = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\u0591-\u05c7]/gu, '').replace(/\s+/gu, ' ').trim();
const families = [
  ['ramen', /^(?:ramen(?: noodles)?|ראמן|רמן|ראמיין)$/u, ['dry', 'cooked', 'soup']],
  ['rice', /^(?:rice|white rice|אורז|אורז לבן)$/u],
  ['pasta', /^(?:pasta|פסטה)$/u],
  ['noodles', /^(?:noodles|אטריות|איטריות)$/u],
  ['lentils', /^(?:lentils|עדשים)$/u],
  ['chickpeas', /^(?:chickpeas|garbanzo beans|גרגרי חומוס|גרגירי חומוס)$/u],
  ['quinoa', /^(?:quinoa|קינואה)$/u],
  ['bulgur', /^(?:bulgur|בורגול)$/u],
  ['couscous', /^(?:couscous|קוסקוס)$/u],
  ['chicken breast', /^(?:chicken breast|חזה עוף)$/u, ['raw', 'cooked']]
];
const statePatterns = [
  ['dry', /\b(?:dry|dried|uncooked)\b|לא מבושל(?:ת|ים|ות)?|יבש(?:ה|ים|ות)?/giu],
  ['raw', /\braw\b|(?:^|\s)נא(?:ה|ים|ות)?(?=\s|$)/giu],
  ['soup', /\b(?:soup|broth)\b|מרק|ציר/giu],
  ['cooked', /\b(?:cooked|boiled|steamed|drained)\b|מבושל(?:ת|ים|ות)?|מאוד(?:ה|ים|ות)|מסוננ(?:ת|ים|ות)?/giu]
];
export function preparationIdentity(text) {
  let base = normalized(text), state = '';
  for (const [candidate, pattern] of statePatterns) {
    const next = base.replace(pattern, ' ');
    if (next !== base) { state ||= candidate; base = next.replace(/\s+/gu, ' ').trim(); }
  }
  const family = families.find(([, pattern]) => pattern.test(base));
  if (family && state === 'raw' && family[0] !== 'chicken breast') state = 'dry';
  return { key: family?.[0] || base, state, states: family?.[2] || (family ? ['dry', 'cooked'] : []) };
}
export const preparationLabels = {
  dry: { en: 'Dry / before cooking', he: 'יבש / לפני בישול' },
  raw: { en: 'Raw / before cooking', he: 'נא / לפני בישול' },
  cooked: { en: 'Cooked / drained, without broth', he: 'מבושל / מסונן, ללא מרק' },
  soup: { en: 'Whole soup, including broth and toppings', he: 'מרק שלם, כולל ציר ותוספות' }
};
export function preparationAmbiguity(parsed, segment) {
  const identity = preparationIdentity(parsed.foodText);
  if (!identity.states.length || identity.state) return null;
  return {
    kind: 'preparation', segment, amount: parsed.amount, unit: parsed.unit,
    choices: identity.states.map(state => ({
      choiceId: state, label: preparationLabels[state],
      query: `${parsed.amount || ''} ${parsed.unit || ''} ${state === 'soup' ? 'ramen soup' : `${state} ${identity.key}`}`.trim()
    }))
  };
}
// Exact aliases only. A cached sandwich must never match just its filling.
// Only new, explicitly state-aware records qualify; legacy estimates remain
// available for editing historical logs, not for silently choosing a state.
export function cachedWeighedFood(foods, parsed) {
  if (!['g', 'kg'].includes(parsed.unit) || !(parsed.amount > 0)) return null;
  const identity = preparationIdentity(parsed.foodText);
  return foods.find(food => food.cacheVersion === 2 && food.preparationState === (identity.state || 'ready') &&
    food.identityAliases?.includes(identity.key)) || null;
}
export function cacheInterpretedFood(foods, interpretation, parsed, rawText) {
  const identity = preparationIdentity(parsed.foodText);
  if (identity.state && identity.state !== interpretation.preparationState) {
    throw new Error('PREPARATION_MISMATCH');
  }
  const names = interpretation.food.name;
  const compound = /\b(?:with|pack|packet|package|bag|box|bottle)s?\b|(?:^|\s)עם\s|חביל|אריז|שקית|מארז|[+]/iu.test(parsed.foodText);
  // For composite/package descriptions a model's broad name is not identity
  // evidence. In particular, never collapse a filled dish into its base food.
  const aliases = [...new Set([identity.key, ...(compound ? [] : Object.values(names))]
    .map(name => preparationIdentity(name).key).filter(Boolean))];
  const state = identity.state || interpretation.preparationState || 'ready';
  // A family alias connects languages, but never dry/cooked/soup variants.
  const existing = foods.find(food => food.cacheVersion === 2 && food.preparationState === state &&
    food.identityAliases?.some(alias => aliases.includes(alias)));
  const nutrition = interpretation.nutritionPer100g;
  const food = existing ? { ...existing, identityAliases: [...new Set([...existing.identityAliases, ...aliases])], aliases: [...new Set([...existing.aliases, rawText, ...Object.values(names)])] } : {
    id: `ai-food-${globalThis.crypto.randomUUID()}`, cacheVersion: 2, preparationState: state, identityAliases: aliases,
    name: names, aliases: [rawText, ...Object.values(names), ...(interpretation.food.aliases || [])],
    baseAmount: 100, baseUnit: 'g', specificity: 'custom', source: 'ai-estimate',
    macros: { calories: nutrition.calories, protein: nutrition.proteinGrams, carbs: nutrition.carbsGrams, fat: nutrition.fatGrams },
    reference: { source: 'AI-assisted representative estimate', policy: 'estimated-not-brand', state }
  };
  return { food, foods: [...foods.filter(item => item.id !== food.id), food].slice(-60) };
}
