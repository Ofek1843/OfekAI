/** Visibility-aware image playback. Enable only after the frame set passes visual QA. */
export const CURL_TIMELINE = Object.freeze([
  [0, 200], [1, 180], [2, 180], [3, 180], [4, 180], [5, 180], [6, 180],
  [7, 300], [6, 215], [5, 215], [4, 215], [3, 215], [2, 215], [1, 215], [0, 215]
].map(([frame, duration]) => Object.freeze({ frame, duration })));

export function validateFrames(frames) {
  if (!Array.isArray(frames) || frames.length !== 8 || new Set(frames).size !== 8) {
    throw new Error('Coach motion requires eight distinct, approved frames.');
  }
  if (frames.some(url => typeof url !== 'string' || !/^\/images\/coach\/[\w-]+\.webp\?v=[\w-]+$/.test(url))) {
    throw new Error('Coach frames must use local, versioned WebP URLs.');
  }
  return frames;
}

export function mountCoachSequence(img, frames, env = globalThis) {
  validateFrames(frames);
  const document = img.ownerDocument;
  const motion = env.matchMedia('(prefers-reduced-motion: reduce)');
  const fallback = img.getAttribute('src');
  let visible = false;
  let ready = false;
  let loading = false;
  let disposed = false;
  let timer = null;
  let position = 0;
  let generation = 0;
  const stop = () => { if (timer !== null) env.clearTimeout(timer); timer = null; };
  const active = () => !disposed && visible && !document.hidden && !motion.matches && ready;
  const advance = () => {
    timer = null;
    if (!active()) return;
    img.src = frames[CURL_TIMELINE[position].frame];
    timer = env.setTimeout(() => {
      position = (position + 1) % CURL_TIMELINE.length;
      advance();
    }, CURL_TIMELINE[position].duration);
  };
  const sync = () => {
    stop();
    if (motion.matches) {
      img.src = fallback;
      return;
    }
    if (active()) advance();
    else if (visible && !document.hidden && !loading && !ready && !disposed) preload();
  };
  const preload = async () => {
    loading = true;
    const current = ++generation;
    try {
      await Promise.all(frames.map(src => new Promise((resolve, reject) => {
        const image = new env.Image();
        image.onload = async () => {
          try { if (image.decode) await image.decode(); resolve(); } catch (error) { reject(error); }
        };
        image.onerror = reject;
        image.src = src;
      })));
      if (disposed || current !== generation) return;
      ready = true;
      sync();
    } catch {
      // Keep the approved static image; never partially play a failed sequence.
      ready = false;
      img.src = fallback;
    }
  };
  const observer = new env.IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    sync();
  }, { threshold: 0.05 });
  observer.observe(img);
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  return () => {
    disposed = true;
    generation++;
    stop();
    observer.disconnect();
    document.removeEventListener('visibilitychange', sync);
    motion.removeEventListener('change', sync);
  };
}
