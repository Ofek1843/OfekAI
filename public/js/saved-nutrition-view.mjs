import { openShoppingList } from "./shopping-list.mjs";
// Read-only rendering of the saved snapshot. Never regenerate or replace meals.
import {mealPhotoFor} from './meal-photo.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric = value => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const display = value => numeric(value) === null ? '—' : String(Math.round(Number(value) * 10) / 10);
function text(value, he) { return typeof value === 'object' && value ? value[he?'he':'en'] || value.en || value.he || '' : value || ''; }
export function savedNutritionMarkup(saved, language = 'en') {
  const he = language === 'he', plan = saved.plan || {}, meals = Array.isArray(plan.meals) ? plan.meals : [];
  const labels = he ? ['קלוריות','חלבון','פחמימות','שומן'] : ['Calories','Protein','Carbohydrates','Fat'];
  const keys = ['calories','proteinGrams','carbsGrams','fatGrams'];
  const totals = [0,0,0,0], complete = [true,true,true,true];
  const cards = meals.map((meal,index) => {
    const options = Array.isArray(meal.options) && meal.options.length ? meal.options : [meal];
    const chosen = options.find(option=>Number(option.optionNumber)===Number(plan.selectedOptionNumbers?.[meal.mealNumber])) || options[0];
    const optionMarkup = option => {
      const foods = Array.isArray(option.foods) ? option.foods : [];
      const values = keys.map(key => {
        const declared = numeric(option[{calories:'optionCalories',proteinGrams:'optionProteinGrams',carbsGrams:'optionCarbsGrams',fatGrams:'optionFatGrams'}[key]] ?? option[key]);
        return foods.length ? (foods.every(food=>numeric(food[key])!==null) ? foods.reduce((sum,food)=>sum+Number(food[key]),0) : null) : declared;
      });
      if(option===chosen) values.forEach((value,i)=>{if(value===null)complete[i]=false;else totals[i]+=value;});
      const photo=mealPhotoFor(option,meal);
      const declaredCalories=numeric(option.optionCalories ?? option.calories);
      const differs=foods.length&&values[0]!==null&&declaredCalories!==null&&Math.abs(values[0]-declaredCalories)>0.1;
      return `${photo?`<img class="saved-meal-image" src="${esc(photo)}" alt="" loading="lazy">`:''}
        <h4>${esc(text(option.mealName || option.name || meal.title || meal.name || `${he?'ארוחה':'Meal'} ${index+1}`,he))}</h4>
        <p class="saved-meal-macros">${values.map((value,i)=>`${labels[i]}: ${display(value)} ${i?'g':'kcal'}`).join(' · ')}</p>
        ${differs?`<p role="status">${he?'הסיכום השמור שונה מסכום הרכיבים. מוצג סכום הרכיבים; הרשומה המקורית לא שונתה.':'The saved summary differs from the ingredient sum. Ingredient totals are shown; the original snapshot is unchanged.'}</p>`:''}
        ${option.keepsPlanValid===false?`<p role="status">${he?'החלופה השמורה הזאת אינה מאוזנת ליעד היומי.':'This saved alternative is not balanced for the daily target.'}</p>`:''}
        ${foods.length?`<div class="saved-food-table"><table><thead><tr><th>${he?'מזון':'Food'}</th><th>${he?'כמות':'Amount'}</th>${labels.map(label=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${foods.map(food=>`<tr><th scope="row">${esc(text(food.name || food.foodName,he))}</th><td>${esc(food.amount ?? (numeric(food.grams)!==null?`${food.grams} g`:'—'))}${typeof food.amount==='number'&&food.unit?' '+esc(food.unit):''}</td>${keys.map((key,i)=>`<td>${display(food[key])} ${i?'g':'kcal'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:`<p role="status">${he?'ברשומה הישנה לא נשמר פירוט רכיבים. מוצגים הפרטים שנשמרו בלבד.':'This older snapshot has no ingredient breakdown. Only saved details are shown.'}</p>`}
        ${option.preparation||meal.preparation?`<p>${esc(text(option.preparation||meal.preparation,he))}</p>`:''}`;
    };
    return `<section class="saved-meal"><h3>${index+1}. ${esc(text(meal.name || meal.title || chosen.mealName || chosen.name || (he?'ארוחה':'Meal'),he))}</h3>${optionMarkup(chosen)}${options.filter(o=>o!==chosen).map((option,i)=>`<details><summary>${he?'חלופה שמורה':'Saved alternative'} ${i+1}</summary>${optionMarkup(option)}</details>`).join('')}</section>`;
  }).join('');
  const target=saved.targetSummary || plan;
  return `<p>${he?'תצוגת התפריט השמור — פתיחה אינה משנה את התוכנית הפעילה או את הכמויות.':'Your saved menu — viewing does not change the active plan or portions.'}</p>
    <dl class="saved-nutrition-summary"><div><dt>${he?'יעד קלורי יומי':'Daily calorie target'}</dt><dd>${display(target.dailyCalories)} kcal</dd></div><div><dt>${he?'קלוריות בארוחות השמורות':'Saved menu calories'}</dt><dd>${meals.length&&complete[0]?display(totals[0]):'—'} kcal</dd></div><div><dt>${he?'חלבון בארוחות השמורות':'Saved menu protein'}</dt><dd>${meals.length&&complete[1]?display(totals[1]):'—'} g</dd></div></dl>
    ${cards||`<p role="status">${he?'ברשומה הזו לא נשמרו ארוחות. לא ניתן לשחזר מאכלים מכותרת וסיכום בלבד.':'This snapshot contains no meals. Foods cannot be reconstructed from a title and totals alone.'}</p>`}`;
}
export function openSavedNutrition(saved, language = 'en') {
  document.querySelector('#savedNutritionDialog')?.remove();
  const dialog=document.createElement('dialog'), he=language==='he';
  dialog.id='savedNutritionDialog'; dialog.className='saved-nutrition-dialog'; dialog.dir=he?'rtl':'ltr';
  const name=saved.name||saved.plan?.planName||(he?'תוכנית תזונה':'Nutrition plan');
  dialog.setAttribute('aria-label',name);
  dialog.innerHTML=`<header><h2>${esc(name)}</h2><button type="button" data-close aria-label="${he?'סגירה':'Close'}">×</button></header><div class="saved-nutrition-body"><button type="button" class="saved-shopping-button">${he?"רשימת קניות":"Shopping list"}</button>${savedNutritionMarkup(saved,language)}</div>`;
  document.body.append(dialog);
  dialog.querySelector('.saved-shopping-button').addEventListener('click',()=>openShoppingList(saved.plan || {},language));
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.showModal(); dialog.querySelector('[data-close]').focus();
  return dialog;
}
