export function mountHealthScreening(form, language = "en") {
  if (!form || form.querySelector('[name="screeningStatus"]')) return;
  const he=language==="he", box=document.createElement("fieldset"), legend=document.createElement("legend"), label=document.createElement("label"), select=document.createElement("select"), help=document.createElement("p");
  box.className="builder-health-screening";
  box.style.cssText="padding:16px;margin:16px 0;border:1px solid currentColor;border-radius:12px;color:inherit;";
  legend.textContent=he?"התאמה לתכנון אוטומטי":"Suitability for automated planning";
  label.textContent=he?"האם מתקיים היריון, מצב לאחר לידה, הנקה, הפרעת אכילה, אלרגיה חמורה, פציעה פעילה או מצב רפואי/תרופה הדורשים התאמה מקצועית?":"Are you pregnant, postpartum, breastfeeding, dealing with an eating disorder, severe allergy, active injury, or a condition/medication needing professional adaptation?";
  select.name="screeningStatus";select.required=true;
  for(const [value,text] of [["",he?"בחרו במפורש":"Select explicitly"],["none",he?"לא — אף אחד מהמצבים":"No — none of these apply"],["review",he?"כן או לא בטוח/ה — נדרשת בדיקה אישית":"Yes or unsure — individual review needed"]]){
    const option=document.createElement("option");option.value=value;option.textContent=text;select.append(option);
  }
  help.textContent=he?"זו אינה אבחנה או בדיקה רפואית. מצב שאינו נתמך דורש ליווי של איש מקצוע מוסמך, לא תוכנית רגילה אוטומטית.":"This is not a diagnosis or medical clearance. Unsupported situations require qualified individual review, not an ordinary automated plan.";
  label.append(select);box.append(legend,label,help);form.prepend(box);
}
export function healthScreeningPayload(form) { return {screeningStatus:form.querySelector('[name="screeningStatus"]')?.value||""}; }
