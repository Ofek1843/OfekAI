// Homepage environment only. No analytics or account changes.
(() => {
  if (navigator.connection?.saveData) document.documentElement.dataset.gymSaveData = 'true';
  const desktop = matchMedia('(min-width: 600px)');
  function prepareBackground() {
    if (navigator.connection?.saveData || matchMedia('(prefers-reduced-data: reduce)').matches) return;
    const show = () => { document.documentElement.dataset.gymBackgroundReady = 'true'; };
    if ('requestIdleCallback' in window) requestIdleCallback(show, {timeout:1200});
    else setTimeout(show, 300);
  }
  // Give the real product imagery and functional page the first network turn.
  if (document.readyState === 'complete') prepareBackground();
  else window.addEventListener('load', prepareBackground, {once:true});
  desktop.addEventListener('change', prepareBackground);
  // Entry actions and translations belong to the existing landing UI layer.
  // The shell changes only the environment; it must not mount duplicate CTAs.
})();
