import { demonstrationModel, accountIsSignedIn,
  startDemonstrationPreference, onDemonstrationChange, mountDemonstrationChoice } from './exercise-demo-preference.js';
import { personalizeImage } from './visual-personalization-core.mjs';
import { personalizeDashboardAddress } from './dashboard-address.mjs';

// One existing presentation setting, shared with every exercise surface.
// No profile answers are sent to analytics or to the workout engine.
let host, dispose, mountedLanguage;
function refresh() {
  personalizeDashboardAddress(document.querySelector('#dashboardRoot'), accountIsSignedIn() ? demonstrationModel() : 'default');
  document.querySelectorAll('.session-photo, .editorial-hero-photo').forEach(image =>
    personalizeImage(image, accountIsSignedIn() ? demonstrationModel() : 'default'));
  const target = document.querySelector('.dashboard-main') || document.querySelector('#profileDescription')?.parentElement;
  if (!target) return;
  const language = document.documentElement.lang;
  if (host?.isConnected && mountedLanguage === language) return;
  dispose?.();
  host?.remove();
  host = document.createElement('div');
  host.className = 'visual-preference-host';
  host.style.cssText = 'max-width:100%;min-width:0;';
  target.prepend(host);
  mountedLanguage = language;
  dispose = mountDemonstrationChoice(host, { presentation: true });
}
onDemonstrationChange(refresh);
startDemonstrationPreference();
refresh();
// Dashboard replaces its children when dates/plans change; reuse its lifecycle.
const root = document.querySelector('#dashboardRoot');
if (root) new MutationObserver(refresh).observe(root, { childList:true, subtree:true });
new MutationObserver(refresh).observe(document.documentElement, { attributes:true, attributeFilter:['lang'] });
