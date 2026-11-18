// Shared image preview for live workout tables and recorded workouts.
export function installWorkoutExercisePreview(root = document) {
  root.addEventListener('click', event => {
    const trigger = event.target.closest('[data-exercise-preview]');
    if (!trigger) return;
    const source = trigger.querySelector('img');
    if (!source) return;
    const url = new URL(source.currentSrc || source.src, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/images/exercises/')) return;
    const he = document.documentElement.lang === 'he';
    const dialog = document.createElement('dialog');
    dialog.className = 'workout-exercise-lightbox';
    dialog.setAttribute('aria-labelledby', 'workout-exercise-preview-title');
    const header = document.createElement('header');
    const title = document.createElement('h2');
    title.id = 'workout-exercise-preview-title';
    title.dir = 'auto';
    title.textContent = trigger.dataset.exerciseName || source.alt;
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'exercise-preview-close';
    close.textContent = he ? 'סגירה ×' : 'Close ×';
    const image = document.createElement('img');
    image.src = url.href; image.alt = source.alt || title.textContent;
    header.append(title, close); dialog.append(header, image); document.body.append(dialog);
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { dialog.remove(); trigger.focus(); }, {once:true});
    dialog.showModal(); close.focus();
  });
}
