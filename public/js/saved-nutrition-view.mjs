import { gramUnit, localizeGramAmount } from './nutrition-units.mjs';
import { openShoppingList } from './shopping-list.mjs';
import { mountSavedReplacement, replaceSavedPlan } from './saved-plan-replacement.mjs';
import { mealPhotoFor } from './meal-photo.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric = value => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const display = value => numeric(value) === null ? '—' : String(Math.round(Number(value) * 10) / 10);
function text(value, he) { return typeof value === 'object' && value ? value[he?'he':'en'] || value.en || value.he || '' : value || ''; }
function mealOptions(meal) { return Array.isArray(meal.options) && meal.options.length ? meal.options : [meal]; }
function chosenOption(meal, plan) { const options=mealOptions(meal);return options.find(option=>Number(option.optionNumber)===Number(plan.selectedOptionNumbers?.[meal.mealNumber])) || options[0]; }
function mealLabel(meal, index, he) {
  const name=text(meal.name || meal.title, he);
  const labels={breakfast:'ארוחת בוקר',lunch:'ארוחת צהריים',dinner:'ארוחת ערב',snack:'ארוחת ביניים'};
  return (he && labels[String(name).trim().toLowerCase()]) || name || (he?'ארוחה ':'Meal ')+(index+1);
}
const icon = name => '<img src="/icons/tabler/'+name+'.svg" alt="" width="22" height="22">';

// Opening and changing the visible meal are read-only. All totals still include
// the selected option from EVERY meal, even while only one meal is visible.
export function savedNutritionMarkup(saved, language = 'en', editable = false, selectedMeal = 0) {
  const he=language==='he', plan=saved.plan||{}, meals=Array.isArray(plan.meals)?plan.meals:[];
  selectedMeal=Math.max(0,Math.min(meals.length-1,Number.isInteger(selectedMeal)?selectedMeal:0));
  const labels=he?['קלוריות','חלבון','פחמימות','שומן']:['Calories','Protein','Carbs','Fat'];
  const keys=['calories','proteinGrams','carbsGrams','fatGrams'];
  const unit=i=>i?gramUnit(language):(he?'קלוריות':'kcal');
  const totals=[0,0,0,0], complete=[true,true,true,true];
  const cards=meals.map((meal,index)=>{
    const options=mealOptions(meal), chosen=chosenOption(meal,plan), active=index===selectedMeal;
    const optionMarkup=(option,main=false)=>{
      const foods=Array.isArray(option.foods)?option.foods:[];
      const values=keys.map(key=>{
        const declared=numeric(option[{calories:'optionCalories',proteinGrams:'optionProteinGrams',carbsGrams:'optionCarbsGrams',fatGrams:'optionFatGrams'}[key]]??option[key]);
        return foods.length?(foods.every(food=>numeric(food[key])!==null)?foods.reduce((sum,food)=>sum+Number(food[key]),0):null):declared;
      });
      if(option===chosen)values.forEach((value,i)=>{if(value===null)complete[i]=false;else totals[i]+=value;});
      const photo=mealPhotoFor(option,meal), declared=numeric(option.optionCalories??option.calories);
      const differs=foods.length&&values[0]!==null&&declared!==null&&Math.abs(values[0]-declared)>0.1;
      const dish=text(option.mealName||option.name||meal.title||meal.name||(he?'ארוחה':'Meal')+' '+(index+1),he);
      const preparation=text(option.preparation||meal.preparation,he);
      return '<div class="saved-meal-option">'+
        (photo?'<figure class="saved-meal-photo"><img class="saved-meal-image" '+(active&&main?'src="'+esc(photo)+'"':'data-src="'+esc(photo)+'"')+' alt="'+esc(dish)+'" loading="'+(active&&main?'eager':'lazy')+'" decoding="async"></figure>':'')+
        '<div class="saved-meal-details"><h4 class="saved-meal-title">'+esc(dish)+'</h4>'+
        '<div class="saved-meal-macros" aria-label="'+(he?'ערכי הארוחה':'Meal nutrition')+'">'+values.map((value,i)=>'<span class="saved-macro saved-macro-'+i+'"><span class="saved-macro-label">'+labels[i]+'</span><strong>'+display(value)+' <small>'+unit(i)+'</small></strong></span>').join('')+'</div>'+
        (differs?'<p class="saved-nutrition-notice" role="status">'+(he?'הסיכום השמור שונה מסכום הרכיבים. מוצג סכום הרכיבים; הרשומה המקורית לא שונתה.':'The saved summary differs from the ingredient sum. Ingredient totals are shown; the original snapshot is unchanged.')+'</p>':'')+
        (option.keepsPlanValid===false?'<p class="saved-nutrition-notice" role="status">'+(he?'החלופה השמורה הזאת אינה מאוזנת ליעד היומי.':'This saved alternative is not balanced for the daily target.')+'</p>':'')+
        '<div class="saved-ingredients-heading"><h5>'+(he?'מה יש בארוחה':'What’s in this meal')+'</h5><span>'+foods.length+' '+(he?'רכיבים':'ingredients')+'</span></div>'+
        (foods.length?'<div class="saved-food-table" tabindex="0" role="region" aria-label="'+(he?'רכיבי הארוחה וערכים תזונתיים':'Meal ingredients and nutrition')+'"><table><thead><tr><th>'+(he?'מזון':'Food')+'</th><th>'+(he?'כמות':'Amount')+'</th>'+labels.map((label,i)=>'<th'+(i>1?' class="saved-table-secondary"':'')+'>'+label+'</th>').join('')+'</tr></thead><tbody>'+foods.map(food=>{
          const amount=localizeGramAmount(food.amount??(numeric(food.grams)!==null?food.grams+' g':'—'),language)+(typeof food.amount==='number'&&food.unit?' '+(he&&/^(?:g|grams?)$/i.test(food.unit)?gramUnit(language):food.unit):'');
          return '<tr><th scope="row"><span class="saved-food-name">'+esc(text(food.name||food.foodName,he))+'</span><small class="saved-food-mobile-macros">'+labels[2]+': '+display(food.carbsGrams)+' '+unit(2)+' · '+labels[3]+': '+display(food.fatGrams)+' '+unit(3)+'</small></th><td>'+esc(amount)+'</td>'+keys.map((key,i)=>'<td'+(i>1?' class="saved-table-secondary"':'')+'>'+display(food[key])+' '+unit(i)+'</td>').join('')+'</tr>';
        }).join('')+'</tbody></table></div>':'<p class="saved-nutrition-notice" role="status">'+(he?'ברשומה הישנה לא נשמר פירוט רכיבים. מוצגים הפרטים שנשמרו בלבד.':'This older snapshot has no ingredient breakdown. Only saved details are shown.')+'</p>')+
        (preparation?'<details class="saved-meal-preparation"><summary>'+(he?'איך מכינים':'How to prepare')+'</summary><p>'+esc(preparation)+'</p></details>':'')+'</div></div>';
    };
    return '<section class="saved-meal" role="tabpanel" id="saved-meal-'+index+'" aria-labelledby="saved-meal-tab-'+index+'" tabindex="0" data-meal-index="'+index+'"'+(active?'':' hidden')+'><header class="saved-meal-header"><button type="button" class="saved-meal-prev" data-meal-step="-1" aria-label="'+(he?'הארוחה הקודמת':'Previous meal')+'"'+(index===0?' disabled':'')+'>'+icon('chevron-right')+'</button><div><span class="saved-meal-position">'+(he?'ארוחה ':'Meal ')+(index+1)+' / '+meals.length+'</span><h3>'+esc(mealLabel(meal,index,he))+'</h3></div><button type="button" class="saved-meal-next" data-meal-step="1" aria-label="'+(he?'הארוחה הבאה':'Next meal')+'"'+(index===meals.length-1?' disabled':'')+'>'+icon('chevron-right')+'</button></header>'+optionMarkup(chosen,true)+
      (editable&&chosen.optionNumber&&meal.mealNumber?'<div class="saved-meal-actions"><button type="button" class="saved-replace-button" data-replace-meal="'+esc(meal.mealNumber)+'" data-option-number="'+esc(chosen.optionNumber)+'">'+icon('refresh')+(he?'החלפת ארוחה':'Replace meal')+'</button><small>'+(he?'ההחלפה תישמר בתפריט שלך':'Your replacement is saved to this plan')+'</small></div>':'')+
      options.filter(option=>option!==chosen).map((option,i)=>'<details class="saved-meal-alternative"><summary>'+(he?'חלופה שמורה':'Saved alternative')+' '+(i+1)+'</summary>'+optionMarkup(option)+'</details>').join('')+'</section>';
  }).join('');
  const target=saved.targetSummary||plan;
  const sameCalories=meals.length>0&&complete[0]&&numeric(target.dailyCalories)!==null&&display(target.dailyCalories)===display(totals[0]);
  const summary=(label,value,i,kind)=>'<div class="saved-summary-card saved-summary-'+kind+'">'+icon(i?'barbell':'flame')+'<dt>'+label+'</dt><dd>'+display(value)+' <small>'+unit(i)+'</small></dd></div>';
  const navigation=meals.map((meal,index)=>'<button type="button" role="tab" id="saved-meal-tab-'+index+'" aria-controls="saved-meal-'+index+'" aria-selected="'+(index===selectedMeal)+'" tabindex="'+(index===selectedMeal?'0':'-1')+'" data-meal-tab="'+index+'"><span class="saved-meal-number">'+String(index+1).padStart(2,'0')+'</span><span>'+esc(mealLabel(meal,index,he))+'</span></button>').join('');
  return '<dl class="saved-nutrition-summary">'+
    (sameCalories?'':summary(he?'יעד קלורי יומי':'Daily calorie target',target.dailyCalories,0,'target'))+
    summary(he?'קלוריות יומיות':sameCalories?'Daily calories':'Menu calories',meals.length&&complete[0]?totals[0]:null,0,'calories')+
    summary(he?'חלבון יומי':'Daily protein',meals.length&&complete[1]?totals[1]:null,1,'protein')+'</dl>'+
    (meals.length?'<div class="saved-nutrition-layout"><aside class="saved-meal-sidebar"><span class="saved-meal-nav-label">'+(he?'הארוחות שלך':'Your meals')+'</span><nav class="saved-meal-navigation" role="tablist" aria-orientation="vertical" aria-label="'+(he?'בחירת ארוחה בתפריט':'Choose a meal')+'">'+navigation+'</nav></aside><div class="saved-meal-panels">'+cards+'</div></div>':'<p class="saved-nutrition-notice" role="status">'+(he?'ברשומה הזו לא נשמרו ארוחות. לא ניתן לשחזר מאכלים מכותרת וסיכום בלבד.':'This snapshot contains no meals. Foods cannot be reconstructed from a title and totals alone.')+'</p>')+
    '<p class="saved-nutrition-footnote">'+(he?'הרכיבים והכמויות הם מהתפריט השמור שלך. הערכים התזונתיים הם אומדנים.':'Ingredients and portions are from your saved plan. Nutrition values are estimates.')+'</p>';
}

export function openSavedNutrition(saved, language = 'en', user = null, options = {}) {
  const previous=document.querySelector('#savedNutritionDialog');if(previous?.open)previous.close();previous?.remove();
  const dialog=document.createElement('dialog'),he=language==='he';
  dialog.id='savedNutritionDialog';dialog.className='saved-nutrition-dialog';dialog.dir=he?'rtl':'ltr';
  const name=saved.name||saved.plan?.planName||(he?'התפריט האישי שלך':'Your personal meal plan'),editable=!!user?.uid&&!!saved.id;
  let selectedMeal=0;
  dialog.setAttribute('aria-label',name);
  dialog.innerHTML='<header class="saved-nutrition-header"><div class="saved-nutrition-heading"><span class="saved-nutrition-emblem">'+icon('tools-kitchen-2')+'</span><div><span class="saved-nutrition-eyebrow">'+(he?'תפריט ליום אחד':'ONE-DAY MEAL PLAN')+'</span><h2 title="'+esc(name)+'">'+esc(name)+'</h2></div></div><button type="button" data-close aria-label="'+(he?'סגירה':'Close')+'">'+icon('x')+'</button></header><div class="saved-nutrition-body"><div class="saved-nutrition-toolbar"><span>'+(he?'יום אחד. כל הארוחות, במקום אחד.':'One day. All your meals, together.')+'</span><button type="button" class="saved-shopping-button">'+icon('shopping-cart')+(he?'רשימת קניות':'Shopping list')+'</button></div><div data-meals>'+savedNutritionMarkup(saved,language,editable,selectedMeal)+'</div></div>';
  document.body.append(dialog);
  const syncNavigation=()=>dialog.querySelector('[role="tablist"]')?.setAttribute('aria-orientation',matchMedia('(max-width:760px)').matches?'horizontal':'vertical');
  const hydrateImages=()=>dialog.querySelectorAll('.saved-meal:not([hidden]) details[open] img[data-src]').forEach(image=>{image.src=image.dataset.src;delete image.dataset.src;});
  const renderMeals=()=>{dialog.querySelector('[data-meals]').innerHTML=savedNutritionMarkup(saved,language,editable,selectedMeal);syncNavigation();};
  function selectMeal(index,focus=false){
    const count=saved.plan?.meals?.length||0;if(index<0||index>=count)return;
    selectedMeal=index;renderMeals();
    dialog.querySelector('.saved-meal:not([hidden])')?.scrollIntoView({block:'start',inline:'nearest'});
    if(focus){const tab=dialog.querySelector('[data-meal-tab="'+index+'"]');tab?.focus();tab?.scrollIntoView({block:'nearest',inline:'nearest'});}
  }
  dialog.querySelector('.saved-shopping-button').addEventListener('click',()=>openShoppingList(saved.plan||{},language));
  const replacement=mountSavedReplacement(dialog,{kind:'nutrition',saved,user,language,replace:async(target,context,signal)=>{
    await replaceSavedPlan({...options.replacement,kind:'nutrition',saved,user,target,context,language,signal});renderMeals();
  },onSaved:options.onSaved});
  dialog.addEventListener('click',event=>{
    const tab=event.target.closest('[data-meal-tab]');if(tab){selectMeal(Number(tab.dataset.mealTab),true);return;}
    const step=event.target.closest('[data-meal-step]');if(step){selectMeal(selectedMeal+Number(step.dataset.mealStep));dialog.querySelector('.saved-meal:not([hidden])')?.focus({preventScroll:true});return;}
    const button=event.target.closest('[data-replace-meal]');if(button)replacement?.open({mealNumber:Number(button.dataset.replaceMeal),optionNumber:Number(button.dataset.optionNumber)},button,button.closest('.saved-meal').querySelector('h4')?.textContent||'');
  });
  dialog.addEventListener('keydown',event=>{
    const tab=event.target.closest('[data-meal-tab]');if(!tab)return;
    const count=saved.plan?.meals?.length||0;let next;
    if(event.key==='Home')next=0;if(event.key==='End')next=count-1;
    if(event.key==='ArrowDown'||event.key===(he?'ArrowLeft':'ArrowRight'))next=(selectedMeal+1)%count;
    if(event.key==='ArrowUp'||event.key===(he?'ArrowRight':'ArrowLeft'))next=(selectedMeal-1+count)%count;
    if(next!==undefined){event.preventDefault();selectMeal(next,true);}
  });
  dialog.addEventListener('toggle',hydrateImages,true);
  const resize=()=>syncNavigation();window.addEventListener('resize',resize);
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{window.removeEventListener('resize',resize);dialog.remove();},{once:true});
  const heading=dialog.querySelector('h2');heading.id=dialog.id+'Title';dialog.setAttribute('aria-labelledby',heading.id);dialog.showModal();syncNavigation();dialog.querySelector('[data-close]').focus();
  return dialog;
}
