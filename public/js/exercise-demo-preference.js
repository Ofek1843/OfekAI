// Presentation preference only. No sex, health answers or plan changes are
// stored here. Signed-in settings reuse users/{uid}/settings/main.
const allowed = new Set(['male', 'female', 'default']);
let choice = null;
let account = null;
let cloud = null;
let started = false;
let authResolved = false;
let pendingInitialChoice = null;
let revision = 0;
let profileDefaults = {};
const listeners = new Set();
const key = () => `fp_demo_model_v1:${account?.uid || 'guest'}`;
function readLocal() {
  try { const value = localStorage.getItem(key()); return allowed.has(value) ? value : null; }
  catch { return null; }
}
function notify() { for (const fn of listeners) { try { fn(); } catch { /* view may have closed */ } } }
export function demonstrationModel(context = '') {
  return allowed.has(context) ? context : (choice || 'default');
}
export function accountPreference() { return choice || 'default'; }
export function accountIsSignedIn() { return !!account && !account.isAnonymous; }
export function accountPreferenceUserId() { return accountIsSignedIn() ? account.uid : null; }
export function accountPlanningDefaults() { return accountIsSignedIn() ? {...profileDefaults} : {}; }
export function hasDemonstrationPreference() { return choice !== null; }
export function onDemonstrationChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export async function chooseDemonstrationModel(value) {
  if (!allowed.has(value)) return false;
  choice = value;
  if (!authResolved) pendingInitialChoice = value;
  revision++;
  try { localStorage.setItem(key(), value); } catch { /* memory-only */ }
  if (!account) { try { sessionStorage.setItem('fp_visual_handoff', value); } catch {} }
  notify();
  if (account && cloud) {
    try { await cloud.setDoc(cloud.doc(cloud.db, 'users', account.uid, 'settings', 'main'),
      { demonstrationModel: value }, { merge: true }); }
    catch { return false; } // Current view and local preference still work.
  }
  return true;
}
export async function startDemonstrationPreference() {
  if (started) return;
  started = true;
  choice = readLocal();
  notify();
  try {
    const [{auth, db}, authApi, store] = await Promise.all([
      import('./firebase-config.js'),
      import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js')
    ]);
    cloud = {...store, db};
    authApi.onAuthStateChanged(auth, async user => {
      const pending = !authResolved ? pendingInitialChoice : null;
      authResolved = true;
      pendingInitialChoice = null;
      const sameAccount = account?.uid === user?.uid;
      account = user;
      profileDefaults = {};
      if (!sameAccount) choice = readLocal();
      if (pending) choice = pending;
      const version = ++revision;
      notify();
      if (!user) return;
      if (pending) {
        try { sessionStorage.removeItem('fp_visual_handoff'); } catch {}
        await chooseDemonstrationModel(pending); return;
      }
      try {
        const snapshot = await store.getDoc(store.doc(db, 'users', user.uid, 'settings', 'main'));
        if (revision !== version || account?.uid !== user.uid) return;
        const data = snapshot.data() || {};
        const core = data.athleteCore || data;
        for (const field of ['age','height','weight']) {
          const n = Number(core[field]);
          if (Number.isFinite(n) && n > 0) profileDefaults[field] = n;
        }
        const saved = data.demonstrationModel;
        let handoff = null;
        try { handoff = sessionStorage.getItem('fp_visual_handoff'); sessionStorage.removeItem('fp_visual_handoff'); } catch {}
        if (allowed.has(saved)) {
          choice = saved;
          try { localStorage.setItem(key(), saved); } catch {}
          notify();
        } else if (allowed.has(handoff)) { await chooseDemonstrationModel(handoff); }
        notify();
      } catch { /* Offline/local preferences remain usable. */ }
    });
  } catch { /* Optional preference sync cannot interrupt the product. */ }
}

export function mountDemonstrationChoice(host, {context = '', onChange = () => {}, presentation = false} = {}) {
  if (!document.querySelector('link[data-demonstration-style]')) {
    const style = document.createElement('link'); style.rel = 'stylesheet';
    style.href = '/css/exercise-demo-preference.css'; style.dataset.demonstrationStyle = '';
    document.head.append(style);
  }
  const he = document.documentElement.lang === 'he';
  const label = document.createElement('label');
  label.className = 'demonstration-choice';
  const title = document.createElement('span');
  title.textContent = he ? 'דמות בהדגמת התרגיל' : 'Exercise demonstration model';
  if (presentation) title.textContent = he ? 'העדפת פנייה ותצוגה בחשבון' : 'Account address and visual preference';
  const select = document.createElement('select');
  for (const [value, text] of [['default', he ? 'ללא העדפה' : 'No preference'], ['male', he ? 'גבר' : 'Male'], ['female', he ? 'אישה' : 'Female']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
  }
  const note = document.createElement('small');
  note.textContent = he ? 'הבחירה משנה רק את ההדגמה. כשאין תמונה נשית, מוצגת ההדגמה הקיימת.' : 'Changes demonstrations only. Existing guides are shown when female media is unavailable.';
  if (presentation) note.textContent = he ? 'ברירת מחדל לפנייה, לתמונות ולתוכניות חדשות. אפשר לשנות את הנמען בכל תוכנית בנפרד. אין בכך קביעה של נתונים פיזיולוגיים.' : 'Defaults for how we address you, visuals and new plans. Each plan can describe someone else. This does not determine physiological inputs.';
  label.append(title, select, note); host.append(label);
  let localChoice = allowed.has(context) ? context : null;
  const update = () => { select.value = presentation ? accountPreference() : demonstrationModel(localChoice); onChange(select.value); };
  const dispose = onDemonstrationChange(update);
  select.addEventListener('change', async () => {
    if (!presentation) { localChoice = select.value; onChange(localChoice); return; }
    const saved = await chooseDemonstrationModel(select.value);
    if (!saved) note.textContent = he ? 'הבחירה נשמרה בדפדפן בלבד; סנכרון החשבון לא זמין.' : 'Applied in this browser; account sync is unavailable.';
  });
  if (!started) choice = readLocal();
  update(); startDemonstrationPreference();
  return dispose;
}
