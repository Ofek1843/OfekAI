// Presentation helpers for the existing workout wizard. No auth, telemetry,
// storage, or generation requests belong in this module.
export function prepareWorkoutJourney(form, language = "en") {
  if (!form) return;
  const he = language === "he";
  const stages = [...form.querySelectorAll(".wizard-step")];
  const titles = he ? ["המטרה שלך", "שגרת האימון שלך", "התאמה וסיכום"] : ["Your goal", "Your training setup", "Personalize & review"];
  stages.forEach((stage, index) => {
    stage.dataset.stepTitleEn = ["Your goal", "Your training setup", "Personalize & review"][index];
    stage.dataset.stepTitleHe = ["המטרה שלך", "שגרת האימון שלך", "התאמה וסיכום"][index];
    delete stage.dataset.simpleTitle;
    const title = stage.querySelector(".simple-step-title");
    if (title) { title.textContent = titles[index]; title.tabIndex = -1; }
    stage.querySelectorAll(".wizard-step-heading h2").forEach((heading, n) => {
      heading.id = `workout-question-${index}-${n}`;
      const question = heading.closest(".simple-question");
      const group = question?.querySelector(".visual-choice-grid");
      if (group) {
        group.setAttribute("role", group.hasAttribute("data-sync-select") ? "radiogroup" : "group");
        group.setAttribute("aria-labelledby", heading.id);
      }
    });
  });
  // Required style and equipment must not be concealed as optional settings.
  for (const selector of ['[data-wizard-step="style"]', '[data-wizard-step="equipment"] .visual-choice-grid', '#wizardReview']) {
    const node = form.querySelector(selector);
    const disclosure = node?.parentElement;
    if (disclosure?.matches("details.simple-options")) disclosure.replaceWith(node);
  }
  const finalStage = stages.at(-1);
  const age = form.querySelector("#age")?.closest("label");
  const gender = form.querySelector("#gender")?.closest("label");
  const screening = form.querySelector(".builder-health-screening");
  if (finalStage && age && screening) {
    const profile = form.ownerDocument.createElement("div");
    profile.className = "journey-profile wizard-fields-grid";
    profile.append(age);
    if (gender) profile.append(gender);
    finalStage.querySelector(".simple-step-title").after(profile, screening);
  }
  // Keep suggested weekdays visible, including the exact-count requirement.
  const weekdays = form.querySelector(".available-days-fieldset");
  const disclosure = weekdays?.parentElement;
  if (disclosure?.matches("details")) disclosure.replaceWith(weekdays);
  const schedule = form.querySelector('[data-wizard-step="schedule"]');
  schedule?.querySelector(".simple-note")?.remove();
  if (schedule) {
    schedule.dataset.wizardStep = "schedule";
    // Age is validated with suitability in the final stage, not with schedule.
    finalStage.dataset.wizardStep += ",suitability";
  }
  const review = form.querySelector("#wizardReview");
  if (review && finalStage) finalStage.append(review);
  const limitations = form.querySelector('[data-wizard-step="limitations"] .wizard-step-heading');
  if (limitations) {
    const title = limitations.querySelector('h2');
    title.dataset.en = "Any injuries or movement limitations?";
    title.dataset.he = "האם יש פציעות או מגבלות תנועה?";
    const note = limitations.querySelector('p');
    note.classList.add('journey-safety-note');
    note.dataset.en = "Optional if none. Injury information or movement limitations require individual professional review; this builder cannot safely adapt a plan for them.";
    note.dataset.he = "לא חובה אם אין. מידע על פציעות או מגבלות תנועה דורש בדיקה מקצועית אישית; הבונה אינו יכול להתאים להן תוכנית בבטחה.";
  }
  form.querySelectorAll("select.visually-hidden-select").forEach(select => {
    select.hidden = true;
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;
  });
  const progress = form.querySelector(".wizard-progress");
  if (progress) {
    const list = form.ownerDocument.createElement("ol");
    list.className = "journey-stages";
    list.setAttribute("aria-label", he ? "שלבי התוכנית" : "Plan stages");
    titles.forEach((title, index) => {
      const item = form.ownerDocument.createElement("li");
      const button = form.ownerDocument.createElement("button");
      button.type = "button";
      button.dataset.journeyStage = String(index);
      const number = form.ownerDocument.createElement("span");
      number.textContent = String(index + 1);
      number.setAttribute("aria-hidden", "true");
      const label = form.ownerDocument.createElement("span");
      label.textContent = title;
      button.append(number, label);
      item.append(button); list.append(item);
    });
    progress.append(list);
  }
}

export function revealWorkoutControl(control) {
  if (!control) return;
  for (let node = control.parentElement; node; node = node.parentElement) {
    if (node.tagName === "DETAILS") node.open = true;
  }
  control.focus?.({ preventScroll: true });
  control.scrollIntoView?.({ block: "center", behavior: "auto" });
}

// Mirror the server's existing adult/screening policy before a guest handoff.
// Backend validation remains authoritative and unchanged.
export function workoutSuitabilityError({ age, screeningStatus }, language = "en") {
  const he = language === "he";
  if (!Number.isInteger(Number(age)) || Number(age) < 18 || Number(age) > 100) return he
    ? "תכנון אימון אוטומטי מיועד למבוגרים בגיל 18–100. לצעירים יותר נדרש מסלול בליווי מקצועי."
    : "Automated workout planning is for adults aged 18–100. Younger users need a qualified supervised pathway.";
  if (screeningStatus === "review") return he
    ? "במצב הזה נדרשת בדיקה אישית של איש מקצוע מוסמך במקום תוכנית אוטומטית."
    : "This situation needs individual professional review instead of an automated personalized plan.";
  if (screeningStatus !== "none") return he
    ? "יש לענות במפורש על שאלת ההתאמה לתכנון אוטומטי."
    : "Please answer the suitability question before continuing.";
  return "";
}

export function workoutDraftFields(fields, focus) {
  return [...fields, ...(focus.selectedMuscles || []).map(value => ({ name: "selectedMuscles", type: "hidden", value }))];
}

export function restoreWorkoutAnswers(form, fields, restoreForm) {
  restoreForm(form, fields);
  // Change handlers for presets/weekdays can overwrite values while restoring.
  // Reapply the saved values after those handlers, then let the controller sync
  // derived state once. This does not dispatch a second round of UI events.
  for (const saved of fields) {
    const grouped = saved.type === "radio" || saved.type === "checkbox";
    const control = [...form.elements].find(node => node.name === saved.name && node.type === saved.type && (!grouped || node.value === saved.value));
    if (!control) continue;
    if (grouped) control.checked = Boolean(saved.checked);
    else control.value = saved.value;
  }
}
