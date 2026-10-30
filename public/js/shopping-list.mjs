const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localized = (value, he) => typeof value === 'object' && value ? value[he?'he':'en'] || value.en || value.he || '' : value || '';
export function shoppingItems(plan = {}, language = 'en') {
  const he = language === 'he', rows = [];
  for (const meal of Array.isArray(plan.meals) ? plan.meals : []) {
    const options = Array.isArray(meal.options) && meal.options.length ? meal.options : [meal];
    const chosen = options.find(o => Number(o.optionNumber) === Number(plan.selectedOptionNumbers?.[meal.mealNumber])) || options[0];
    for (const food of Array.isArray(chosen?.foods) ? chosen.foods : []) {
      const name = String(localized(food.name || food.foodName, he)).trim();
      if (!name) continue;
      const amount = food.amount != null && food.amount !== '' ? `${food.amount}${typeof food.amount === 'number' && food.unit ? ' '+food.unit : ''}` : (Number.isFinite(Number(food.grams)) && food.grams != null ? `${food.grams} g` : '');
      rows.push({name, amount});
    }
  }
  return rows;
}
export function openShoppingList(plan, language = 'en') {
  const he = language === 'he', items = shoppingItems(plan, language), d = document.createElement('dialog');
  d.className='fp-shopping-dialog'; d.dir=he?'rtl':'ltr';
  d.setAttribute('aria-labelledby','fp-shopping-title');
  d.innerHTML=`<header class="fp-shopping-header"><div><span class="fp-shopping-eyebrow">FUELPHYSIQUE</span><h2 id="fp-shopping-title">${he?'רשימת קניות':'Shopping list'}</h2><p>${he?'הרכיבים לארוחות שנבחרו בתפריט':'Ingredients for the meals selected in your plan'}</p></div><button type="button" class="fp-shopping-close" aria-label="${he?'סגירה':'Close'}">×</button></header><div class="fp-shopping-items">${items.length ? items.map(i=>`<div class="fp-shopping-item"><span>${escape(i.name)}</span><strong>${escape(i.amount || '—')}</strong></div>`).join('') : `<p>${he?'לא נשמרו רכיבים בתוכנית הזאת.':'No ingredients were saved in this plan.'}</p>`}</div><footer><button type="button" class="fp-shopping-copy">${he?'העתקת הרשימה':'Copy list'}</button><button type="button" class="fp-shopping-done">${he?'סגירה':'Close'}</button></footer><p class="fp-shopping-status" role="status"></p>`;
  document.body.append(d); d.querySelector('.fp-shopping-close').onclick=()=>d.close(); d.querySelector('.fp-shopping-done').onclick=()=>d.close();
  d.querySelector('.fp-shopping-copy').onclick=async()=>{try {await navigator.clipboard.writeText(items.map(i=>`${i.name}${i.amount?' — '+i.amount:''}`).join('\n'));d.querySelector('.fp-shopping-status').textContent=he?'הרשימה הועתקה':'List copied';} catch {d.querySelector('.fp-shopping-status').textContent=he?'לא ניתן להעתיק את הרשימה':'Could not copy the list';}};
  d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();d.querySelector('.fp-shopping-close').focus();return d;
}
