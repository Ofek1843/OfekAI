// Presentation only: retain stored quantities and English formatting verbatim.
export const gramUnit = language => language === 'he' ? 'גרם' : 'g';
export function localizeGramAmount(value, language) {
  const amount = String(value ?? '');
  return language === 'he' ? amount.replace(/(\d[\d.,]*)\s*(?:g|grams?)\b/gi, '$1 גרם') : amount;
}
