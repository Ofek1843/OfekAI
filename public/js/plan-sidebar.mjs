import { dashboardCopy } from './dashboard-editorial-i18n.mjs';

// The saved-workout page keeps the same destinations and order as Dashboard.
export const planNavigation = [
  ['dashboard', '/dashboard.html', 'home'],
  ['workouts', '/my-workout-plans.html', 'barbell'],
  ['meals', '/my-nutrition-plans.html', 'tools-kitchen-2'],
  ['diary', '/daily-nutrition.html', 'clipboard'],
  ['exercises', '/exercise-library', 'player-play'],
  ['progress', '/progress.html', 'chart-bar'],
  ['messages', '/social.html', 'message-circle'],
  ['guides', '/faq.html', 'book'],
  ['settings', '/app.html?settings=open', 'settings'],
];

export function mountPlanSidebar(language = 'en') {
  if (document.querySelector('.plan-navigation')) return;
  const root = document.createElement('div');
  root.className = 'plan-navigation';
  root.innerHTML = `<header class="plan-navigation-header">
    <button class="plan-navigation-toggle" type="button" aria-controls="planSidebar" aria-expanded="false"><img src="/icons/tabler/menu-2.svg" alt=""></button>
    <a class="plan-navigation-brand" href="/dashboard.html" aria-label="FuelPhysique">Fuel<span>Physique</span></a>
  </header>
  <button class="plan-navigation-backdrop" type="button" tabindex="-1" hidden></button>
  <aside class="plan-navigation-sidebar" id="planSidebar"><nav></nav></aside>`;
  const sidebar = root.querySelector('aside');
  const nav = sidebar.querySelector('nav');
  const toggle = root.querySelector('.plan-navigation-toggle');
  const backdrop = root.querySelector('.plan-navigation-backdrop');
  const mobile = window.matchMedia('(max-width: 760px)');
  let open = false;
  let copy = dashboardCopy(language);
  for (const [key, href, icon] of planNavigation) {
    const link = document.createElement('a');
    link.href = href;
    link.className = 'plan-navigation-link';
    link.dataset.navKey = key;
    if (key === 'workouts') link.setAttribute('aria-current', 'page');
    const image = document.createElement('img');
    image.src = `/icons/tabler/${icon}.svg`;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    link.append(image, document.createElement('span'));
    nav.append(link);
  }
  function updateLanguage(value) {
    language = value || language;
    copy = dashboardCopy(language);
    root.dir = ['he', 'ar'].includes(language) ? 'rtl' : 'ltr';
    nav.setAttribute('aria-label', copy.dashboard);
    for (const link of nav.querySelectorAll('[data-nav-key]')) link.querySelector('span').textContent = copy[link.dataset.navKey];
    toggle.setAttribute('aria-label', open ? copy.close : copy.more);
    backdrop.setAttribute('aria-label', copy.close);
  }
  function setOpen(value, restoreFocus = false) {
    open = mobile.matches && value;
    sidebar.hidden = mobile.matches && !open;
    backdrop.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? copy.close : copy.more);
    document.body.classList.toggle('plan-navigation-open', open);
    if (open) nav.querySelector('[aria-current="page"]').focus();
    else if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => setOpen(!open, open));
  backdrop.addEventListener('click', () => setOpen(false, true));
  nav.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', event => {
    if (!open) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false, true); }
    if (event.key === 'Tab') {
      const last = nav.lastElementChild;
      if (event.shiftKey && document.activeElement === toggle) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); toggle.focus(); }
    }
  });
  mobile.addEventListener('change', () => setOpen(false));
  for (const event of ['fuelphysique:languagechange', 'ofekai:settings-saved']) {
    window.addEventListener(event, e => updateLanguage(e.detail?.language));
  }
  document.body.prepend(root);
  document.body.classList.add('has-plan-sidebar');
  updateLanguage(language);
  setOpen(false);
}
