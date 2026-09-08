(() => {
  "use strict";

  const VERSION = "20260822-v45-rtl-hebrew-animation-fix-1";
  // Per-scene asset cache tokens. Bump a scene's entry only when that scene's
  // normalized frames are re-authored, so a long-lived image cache (webp is
  // served max-age=604800) cannot keep serving a stale frame after deploy.
  const SCENE_ASSET_VERSIONS = Object.freeze({
    plate: "20260907-v45-plate-bulk-female-leg-repair-1",
    connect: "20260908-v46-connect-phone-review-fix-1"
  });
  const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
  const PRODUCTION_HOSTS = new Set(["fuelphysique.com", "www.fuelphysique.com"]);
  const ROOT = "/assets/athlete-motion/v43";
  const FRAME_DIRECTORIES = Object.freeze({ session: "normalized-clean" });

  const frame = (scene, number, duration) => Object.freeze({
    url: `${ROOT}/${scene}/${FRAME_DIRECTORIES[scene] || "normalized"}/frame-${String(number).padStart(2, "0")}.webp?v=${SCENE_ASSET_VERSIONS[scene] || VERSION}`,
    duration
  });

  const SCENES = Object.freeze({
    training: Object.freeze({
      frames: Object.freeze([
        frame("training", 1, 360),
        frame("training", 2, 230),
        frame("training", 3, 440),
        frame("training", 4, 300),
        frame("training", 5, 340),
        frame("training", 1, 360)
      ]),
      reducedFrame: frame("training", 3, 0)
    }),
    deadlift: Object.freeze({
      frames: Object.freeze([
        frame("deadlift", 1, 380),
        frame("deadlift", 2, 240),
        frame("deadlift", 3, 470),
        frame("deadlift", 4, 320),
        frame("deadlift", 5, 340),
        frame("deadlift", 1, 360)
      ]),
      reducedFrame: frame("deadlift", 3, 0)
    }),
    benchPr: Object.freeze({
      frames: Object.freeze([
        frame("bench", 1, 380),
        frame("bench", 2, 300),
        frame("bench", 3, 380),
        frame("bench", 4, 340),
        frame("bench", 1, 380)
      ]),
      reducedFrame: frame("bench", 1, 0)
    }),
    nutrition: Object.freeze({
      frames: Object.freeze([
        frame("nutrition", 1, 300),
        frame("nutrition", 2, 220),
        frame("nutrition", 3, 250),
        frame("nutrition", 4, 450),
        frame("nutrition", 5, 300),
        frame("nutrition", 1, 320)
      ]),
      reducedFrame: frame("nutrition", 4, 0)
    }),
    plate: Object.freeze({
      frames: Object.freeze([
        frame("plate", 1, 520),
        frame("plate", 2, 520),
        frame("plate", 3, 620),
        frame("plate", 4, 620)
      ]),
      reducedFrame: frame("plate", 4, 0)
    }),
    session: Object.freeze({
      frames: Object.freeze([
        frame("session", 1, 520),
        frame("session", 2, 620),
        frame("session", 3, 520),
        frame("session", 4, 620),
        frame("session", 1, 420)
      ]),
      reducedFrame: frame("session", 1, 0)
    }),
    track: Object.freeze({
      frames: Object.freeze([
        frame("track", 1, 360),
        frame("track", 2, 360),
        frame("track", 3, 420),
        frame("track", 4, 420),
        frame("track", 1, 360)
      ]),
      reducedFrame: frame("track", 3, 0)
    }),
    social: Object.freeze({
      frames: Object.freeze([
        frame("connect", 1, 420),
        frame("connect", 2, 360),
        frame("connect", 3, 420),
        frame("connect", 4, 420),
        frame("connect", 1, 360)
      ]),
      reducedFrame: frame("connect", 4, 0)
    }),
    coach: Object.freeze({
      frames: Object.freeze([
        frame("coach", 1, 380),
        frame("coach", 2, 320),
        frame("coach", 3, 420),
        frame("coach", 4, 420),
        frame("coach", 1, 360)
      ]),
      reducedFrame: frame("coach", 4, 0)
    })
  });

  function isEnabled() {
    if (PRODUCTION_HOSTS.has(window.location.hostname)) return true;
    if (!LOCAL_HOSTS.has(window.location.hostname)) return false;
    return new URLSearchParams(window.location.search).get("athleteMotion") !== "v42";
  }

  function preloadFrames(frames) {
    const unique = [...new Set(frames.map((item) => item.url))];
    return Promise.all(unique.map((url) => new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (typeof image.decode !== "function") return resolve(image);
        image.decode().then(() => resolve(image), reject);
      };
      image.onerror = reject;
      image.src = url;
    })));
  }

  function mount(host, sceneName) {
    const scene = SCENES[sceneName];
    if (!scene || !isEnabled()) return null;

    const fallbackMarkup = host.innerHTML;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const initial = reduced ? scene.reducedFrame : scene.frames[0];
    const root = document.createElement("div");
    const image = document.createElement("img");
    root.className = `v43-image-sequence v43-image-sequence--${sceneName}`;
    root.dataset.v43Scene = sceneName;
    root.setAttribute("aria-hidden", "true");
    image.className = "v43-image-sequence__frame";
    image.alt = "";
    image.decoding = "async";
    image.draggable = false;
    image.src = initial.url;
    root.append(image);
    host.replaceChildren(root);
    host.dataset.v43Motion = "prototype";
    host.dataset.v4Source = "v4.3-real-athlete";

    let observer = null;
    let timer = null;
    let frameIndex = 0;
    let played = false;
    let visible = false;
    let destroyed = false;
    let loading = null;
    let dueAt = 0;
    let remaining = 0;
    const listeners = [];

    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };

    const fail = () => {
      if (destroyed) return;
      clearTimer();
      observer?.disconnect();
      listeners.forEach(([target, type, handler, options]) => target.removeEventListener(type, handler, options));
      delete host.dataset.v43Motion;
      host.dataset.v4Source = sceneName === "deadlift" ? "v4.1-hero" : "v4.1-scene";
      host.innerHTML = fallbackMarkup;
      host.classList.add("v43-fallback-restored");
    };

    const show = (index) => {
      frameIndex = index;
      image.src = scene.frames[index].url;
      root.dataset.v43Frame = String(index + 1);
    };

    const schedule = (delay = scene.frames[frameIndex].duration) => {
      clearTimer();
      remaining = delay;
      dueAt = performance.now() + delay;
      timer = window.setTimeout(() => {
        timer = null;
        if (!visible || destroyed) return;
        const next = frameIndex + 1;
        if (next >= scene.frames.length) {
          root.classList.remove("is-v43-playing");
          root.classList.add("is-v43-complete");
          return;
        }
        show(next);
        schedule();
      }, delay);
    };

    const play = async ({ replay = false } = {}) => {
      if (destroyed || reduced || (!replay && played)) return;
      if (replay) {
        clearTimer();
        show(0);
        root.classList.remove("is-v43-complete");
      }
      played = true;
      root.classList.add("is-v43-loading");
      try {
        loading ||= preloadFrames(scene.frames);
        await loading;
      } catch {
        fail();
        return;
      }
      if (!visible || destroyed) return;
      root.classList.remove("is-v43-loading");
      root.classList.add("is-v43-ready", "is-v43-playing");
      schedule();
    };

    const pause = () => {
      if (timer === null) return;
      remaining = Math.max(40, dueAt - performance.now());
      clearTimer();
      root.classList.add("is-v43-paused");
    };

    const resume = () => {
      if (!played || reduced || frameIndex >= scene.frames.length - 1) return;
      root.classList.remove("is-v43-paused");
      root.classList.add("is-v43-playing");
      schedule(remaining || scene.frames[frameIndex].duration);
    };

    const on = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      listeners.push([target, type, handler, options]);
    };

    if (reduced) {
      root.dataset.v43ReducedMotion = "true";
      root.classList.add("is-v43-ready", "is-v43-complete");
    } else if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          visible = entry.isIntersecting;
          if (visible) {
            if (played) resume();
            else play();
          } else {
            pause();
          }
        }
      }, { threshold: 0.24, rootMargin: "0px 0px -4% 0px" });
      observer.observe(host);

      const container = host.closest(".capability-card, .journey-card, .landing-hero-illustration") || host;
      const replay = () => {
        visible = true;
        play({ replay: true });
      };
      on(container, "pointerenter", replay);
      on(container, "focusin", replay);
      on(container, "pointerdown", (event) => {
        if (event.pointerType === "touch") replay();
      }, { passive: true });
    } else {
      root.classList.add("is-v43-ready", "is-v43-complete");
    }

    const teardown = () => {
      destroyed = true;
      clearTimer();
      observer?.disconnect();
      listeners.forEach(([target, type, handler, options]) => target.removeEventListener(type, handler, options));
    };

    return Object.freeze({ scene: sceneName, play, pause, teardown });
  }

  window.FuelPhysiqueImageSequenceV43 = Object.freeze({
    version: VERSION,
    scenes: SCENES,
    isEnabled,
    mount
  });
})();
