// Presentation only: no requests, storage, analytics, timers for fake progress,
// or changes to form values. The controllers own success, failure and saving.
const numbers = new WeakMap(), rings = new WeakMap(), panels = new WeakMap();
const reduced = () => globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
const clock = () => globalThis.window?.performance?.now?.() ?? performance.now();
const frame = callback => globalThis.window?.requestAnimationFrame?.(callback);
const cancel = id => { if (id !== undefined) globalThis.window?.cancelAnimationFrame?.(id); };
const ease = t => 1 - (1 - t) ** 3;
const supported = () => !reduced() && typeof globalThis.window?.requestAnimationFrame === 'function';
const copy = {
  en: ['Building your workout', 'Putting your meal plan together', 'Your personalized plan will appear here as soon as it is ready.'],
  he: ['בונים את תוכנית האימון שלך', 'מרכיבים את התפריט שלך', 'התוכנית האישית תופיע כאן ברגע שתהיה מוכנה.'],
  ar: ['نعد خطة تمرينك', 'نعد خطة وجباتك', 'ستظهر خطتك الشخصية هنا عندما تصبح جاهزة.'],
  es: ['Preparando tu entrenamiento', 'Preparando tu plan de comidas', 'Tu plan personalizado aparecerá aquí cuando esté listo.'],
  fr: ['Création de votre entraînement', 'Création de votre menu', 'Votre programme personnalisé apparaîtra ici dès qu’il sera prêt.'],
  de: ['Dein Trainingsplan entsteht', 'Dein Ernährungsplan entsteht', 'Dein persönlicher Plan erscheint hier, sobald er bereit ist.'],
  zh: ['正在制定你的训练计划', '正在制定你的饮食计划', '个性化计划准备好后会显示在这里。']
};

export function setGenerating({anchor, kind, language = 'en', loading}) {
  if (!anchor) return;
  let panel = panels.get(anchor);
  if (!panel && !loading) return;
  if (!panel) {
    const words = copy[language] || copy.en;
    panel = anchor.ownerDocument.createElement('div');
    panel.className = 'fp-generation-feedback';
    // The existing builder status is the live announcement. This is its
    // decorative visual companion, not a second competing live region.
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `<div class="fp-generation-orbit"><span class="fp-generation-halo"></span><img src="/icons/tabler/${kind === 'workout' ? 'barbell' : 'salad'}.svg" alt="" width="38" height="38"><i></i></div><div class="fp-generation-copy"><strong></strong><p></p><div class="fp-generation-preview"><span></span><span></span><span></span></div></div>`;
    panel.querySelector('strong').textContent = words[kind === 'workout' ? 0 : 1];
    panel.querySelector('p').textContent = words[2];
    panel.hidden = true;
    anchor.after(panel);
    panels.set(anchor, panel);
  }
  panel.hidden = !loading;
}

export function animateValue(element, value, {format = n => String(Math.round(n)), context = '', duration = 680} = {}) {
  if (!element || !Number.isFinite(Number(value))) return;
  const target = Number(value), prior = numbers.get(element);
  cancel(prior?.frame);
  const state = {value: prior?.value ?? target, context, frame: undefined};
  numbers.set(element, state);
  const paint = n => { state.value = n; element.textContent = format(n); };
  if (!prior || prior.context !== context || prior.value === target || !supported()) { paint(target); return; }
  const start = prior.value, began = clock();
  paint(start);
  const tick = now => {
    if (numbers.get(element) !== state) return;
    const progress = Math.min(1, Math.max(0, (now - began) / duration));
    paint(start + (target - start) * ease(progress));
    if (progress < 1) state.frame = frame(tick);
    else state.frame = undefined;
  };
  state.frame = frame(tick);
}

export function animateMacroRing(element, macro, {context = '', duration = 760} = {}) {
  if (!element) return;
  let target = macro?.macroCalories > 0
    ? ['protein','carbs','fat'].map(key => Math.max(0, Math.min(100, Number(macro[key]) || 0))) : [0,0,0];
  const sum = target.reduce((total,n) => total+n,0);
  if (sum) target = target.map(n => n / sum * 100);
  const prior = rings.get(element);
  cancel(prior?.frame);
  const state = {value: prior?.value || target, context, frame: undefined};
  rings.set(element, state);
  const paint = values => {
    state.value = values;
    const p = Math.min(100, values[0]), c = Math.min(100, p + values[1]);
    const end = Math.min(100, c + values[2]), f = Math.abs(100 - end) < 1e-9 ? 100 : end;
    // The neutral remainder makes the first food fill the ring progressively;
    // fat must not jump instantly to 100% while the other wedges animate.
    element.style.setProperty('background', `conic-gradient(var(--daily-blue) 0 ${p}%, var(--daily-amber) ${p}% ${c}%, var(--daily-purple) ${c}% ${f}%, var(--daily-ring-empty, #e4edf6) ${f}% 100%)`, 'important');
  };
  if (!prior || prior.context !== context || !supported() || prior.value.every((n,i) => n === target[i])) { paint(target); return; }
  const start = [...prior.value], began = clock();
  paint(start);
  const tick = now => {
    if (rings.get(element) !== state) return;
    const progress = Math.min(1, Math.max(0, (now - began) / duration));
    paint(progress === 1 ? target : start.map((n,i) => n + (target[i] - n) * ease(progress)));
    if (progress < 1) state.frame = frame(tick);
    else state.frame = undefined;
  };
  state.frame = frame(tick);
}

function play(element, frames, options) {
  if (!element || reduced() || typeof element.animate !== 'function') return;
  try { element.animate(frames, options); } catch { /* Optional visuals never block a product action. */ }
}

export function revealResult(element) {
  play(element, [{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'translateY(0)'}], {duration:480,easing:'cubic-bezier(.2,.8,.2,1)'});
}

export function acknowledgeFood(container, ids, ring) {
  const added = new Set(ids);
  const rows = [...(container?.children || [])].filter(row => added.has(row.dataset.entryRow));
  if (!rows.length) return;
  rows.forEach((row,index) => {
    play(row, [{opacity:0,transform:'translateY(12px)',backgroundColor:'#dbeeff'},{opacity:1,transform:'translateY(0)',backgroundColor:'transparent'}],
      {duration:540,delay:Math.min(index*65,260),easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'});
  });
  play(ring?.closest('.macro-card'), [{transform:'translateY(0)'},{transform:'translateY(-5px)',offset:.4},{transform:'translateY(0)'}],
    {duration:640,easing:'cubic-bezier(.2,.8,.2,1)'});
}

if (typeof window !== 'undefined') window.fpFeedback = {setGenerating,animateValue,animateMacroRing,revealResult,acknowledgeFood};
