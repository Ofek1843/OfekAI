// Pure selection/snapshot logic shared by the UI and isolated regressions.
export function prepareNutritionPlanForSave(plan, selection = plan?.selectedOptionNumbers || {}) {
  const copy = JSON.parse(JSON.stringify(plan));
  const totals = {calories:0,proteinGrams:0,carbsGrams:0,fatGrams:0};
  const fields = {calories:"optionCalories",proteinGrams:"optionProteinGrams",carbsGrams:"optionCarbsGrams",fatGrams:"optionFatGrams"};
  if (!Array.isArray(copy.meals) || !copy.meals.length) throw new Error("Missing meal selection.");
  for (const meal of copy.meals) {
    const index = meal.options.findIndex(o=>Number(o.optionNumber)===Number(selection[meal.mealNumber] ?? meal.options[0]?.optionNumber));
    const chosen = meal.options[index];
    if (!chosen || chosen.keepsPlanValid === false) throw new Error("This meal selection needs rebalancing before saving.");
    for (const [key,field] of Object.entries(fields)) {
      const value = Number(chosen[field]);
      const rows = (chosen.foods || []).reduce((sum,f)=>sum+Number(f[key]),0);
      if (!Number.isFinite(value) || value<0 || value!==rows) throw new Error("Meal ingredient totals cannot be verified.");
      totals[key] += value;
    }
    meal.options.splice(index,1); meal.options.unshift(chosen);
    meal.options.forEach((o,i)=>o.optionNumber=i+1);
  }
  const targets={calories:Number(copy.dailyCalories),proteinGrams:Number(copy.proteinGrams),carbsGrams:Number(copy.carbsGrams),fatGrams:Number(copy.fatGrams)};
  const tolerance={calories:targets.calories*.015,proteinGrams:5,carbsGrams:5,fatGrams:3};
  if (Object.keys(targets).some(k=>!Number.isFinite(targets[k]) || targets[k]<=0 || Math.abs(totals[k]-targets[k])>tolerance[k])) throw new Error("This selection is outside the daily targets. Please rebalance before saving.");
  copy.actualTotals=totals;
  copy.totalsSummary={...copy.totalsSummary,actual:totals,withinTolerance:true};
  delete copy.selectedOptionNumbers;
  return copy;
}
