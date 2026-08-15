(() => {
  "use strict";

  const DURATIONS = Object.freeze({
    training: 1800,
    nutrition: 1800,
    progress: 1700,
    benchPr: 1700,
    coach: 1400,
    social: 1600,
    deadlift: 2400
  });

  const svg = (name, content) => `<svg class="v4-illustration v4-illustration--${name}" viewBox="0 0 320 220" role="presentation" aria-hidden="true" focusable="false">${content}</svg>`;

  /**
   * V4 poster art. Kept as the fallback for every domain so a missing or
   * broken scene module degrades to the previous illustration instead of an
   * empty card. Each of these is superseded by a V4.1 scene module when one
   * is loaded -- see SCENE_KEYS below.
   */
  const v4Templates = Object.freeze({
    training: () => svg("training", `
      <g class="v4-ground"><path d="M38 190H292"/></g>
      <g class="v4-barbell"><path d="M64 78H254"/><rect x="47" y="62" width="15" height="32" rx="3"/><rect x="256" y="62" width="15" height="32" rx="3"/></g>
      <g class="v4-athlete v4-athlete--squat">
        <circle class="v4-head" cx="164" cy="52" r="18"/>
        <path class="v4-torso" d="M140 73Q164 61 187 75L191 133Q164 143 137 130Z"/>
        <g class="v4-arm v4-arm--rear"><path d="M145 80L112 86L84 77"/></g>
        <g class="v4-arm v4-arm--front"><path d="M183 80L216 86L242 77"/></g>
        <g class="v4-leg v4-leg--rear"><path d="M150 130L119 153L96 188"/></g>
        <g class="v4-leg v4-leg--front"><path d="M178 132L206 154L229 188"/></g>
        <path class="v4-muscle-mark" d="M149 88Q164 97 180 87"/>
      </g>
      <text class="v4-poster-label" x="38" y="42">CONTROL THE REP</text>`),
    nutrition: () => svg("nutrition", `
      <g class="v4-ground"><path d="M34 190H292"/></g>
      <g class="v4-table"><path d="M154 150H286"/><path d="M178 150V190M264 150V190"/></g>
      <g class="v4-plate"><ellipse cx="226" cy="141" rx="42" ry="10"/><path d="M198 137Q226 116 254 137"/><circle cx="218" cy="130" r="5"/><circle cx="236" cy="128" r="6"/></g>
      <g class="v4-athlete v4-athlete--fuel">
        <circle class="v4-head" cx="106" cy="67" r="18"/>
        <path class="v4-torso" d="M79 91Q106 78 130 93L142 164H66Z"/>
        <g class="v4-arm v4-arm--meal"><path d="M124 99L162 114L199 99"/><path class="v4-utensil" d="M199 99L216 82M213 80L221 86"/></g>
        <g class="v4-arm v4-arm--rest"><path d="M86 102L64 137L74 163"/></g>
        <path class="v4-muscle-mark" d="M90 110Q106 119 124 109"/>
      </g>
      <g class="v4-macro-marks"><path d="M178 54H279"/><path d="M178 67H255"/><path d="M178 80H266"/></g>
      <text class="v4-poster-label" x="34" y="38">FUEL THE WORK</text>`),
    progress: () => svg("progress", `
      <g class="v4-ground"><path d="M32 190H292"/></g>
      <g class="v4-progress-scale-scene">
        <g class="v4-scale"><rect x="78" y="157" width="93" height="32" rx="8"/><rect x="109" y="164" width="32" height="12" rx="3"/><path class="v4-scale-needle" d="M125 171L135 167"/></g>
        <g class="v4-athlete v4-athlete--scale">
          <circle class="v4-head" cx="124" cy="53" r="18"/>
          <path class="v4-torso" d="M96 78Q124 64 151 79L145 137H101Z"/>
          <path class="v4-arm" d="M99 87L75 124M149 88L173 124"/>
          <path class="v4-leg" d="M111 136L108 161M137 136L141 161"/>
        </g>
        <g class="v4-progress-chart"><path class="v4-chart-axis" d="M194 158V78M194 158H286"/><path class="v4-chart-path" d="M202 147L220 132L238 138L258 108L281 88"/><circle cx="281" cy="88" r="5"/></g>
      </g>
      <g class="v4-bench-pr-scene">
        <path class="v4-bench" d="M62 151H225M91 151L78 187M202 151L215 187"/>
        <g class="v4-athlete v4-athlete--bench"><circle class="v4-head" cx="93" cy="126" r="15"/><path class="v4-torso" d="M109 117L184 125L179 151H105Z"/><path class="v4-leg" d="M178 140L222 160L243 186"/><path class="v4-arm" d="M128 119L143 82M165 122L178 82"/></g>
        <g class="v4-barbell v4-barbell--bench"><path d="M104 78H220"/><rect x="91" y="65" width="12" height="27" rx="3"/><rect x="221" y="65" width="12" height="27" rx="3"/></g>
        <g class="v4-pr-state"><rect x="228" y="38" width="52" height="28" rx="5"/><text x="254" y="57">PR</text></g>
      </g>
      <text class="v4-poster-label" x="32" y="35">MEASURE. ADJUST.</text>`),
    coach: () => svg("coach", `
      <g class="v4-ground"><path d="M32 190H292"/></g>
      <g class="v4-athlete v4-athlete--coach">
        <circle class="v4-head" cx="91" cy="72" r="18"/>
        <path class="v4-torso" d="M62 97Q91 82 118 98L126 178H53Z"/>
        <path class="v4-arm" d="M114 107L150 121L174 106"/>
      </g>
      <g class="v4-coach-board"><rect x="154" y="47" width="130" height="124" rx="8"/><path d="M179 81H254M179 110H254M179 139H254"/><g class="v4-check v4-check--one"><path d="M164 77L170 84L180 70"/></g><g class="v4-check v4-check--two"><path d="M164 106L170 113L180 99"/></g><g class="v4-check v4-check--three"><path d="M164 135L170 142L180 128"/></g></g>
      <text class="v4-poster-label" x="32" y="38">NEXT STEP: CLEAR</text>`),
    social: () => svg("social", `
      <g class="v4-ground"><path d="M28 190H294"/></g>
      <g class="v4-person v4-person--left"><circle cx="68" cy="93" r="18"/><path d="M37 167Q39 119 68 116Q98 120 101 167Z"/></g>
      <g class="v4-person v4-person--right"><circle cx="252" cy="93" r="18"/><path d="M219 167Q222 119 252 116Q281 120 284 167Z"/></g>
      <g class="v4-social-card v4-social-card--message"><rect x="112" y="48" width="95" height="34" rx="6"/><path d="M126 64H190"/></g>
      <g class="v4-social-card v4-social-card--workout"><rect x="105" y="93" width="110" height="34" rx="6"/><path d="M122 110H198M137 104V116M184 104V116"/></g>
      <g class="v4-social-card v4-social-card--music"><rect x="118" y="138" width="87" height="34" rx="6"/><path d="M139 160V148L153 144V157"/><circle cx="136" cy="161" r="4"/><circle cx="150" cy="158" r="4"/></g>
      <path class="v4-social-path" d="M91 90C121 24 199 24 230 90"/>
      <text class="v4-poster-label" x="28" y="35">SHARE THE MOMENT</text>`),
    /**
     * Deadlift hero, V4.1.
     *
     * Composition rules learned from rasterised review of the first attempt:
     *   - round plates sitting ON the ground are the barbell signal;
     *   - the athlete occupies ~110 of 320 units, not half the canvas, so the
     *     bar reads as long and loaded rather than as a prop;
     *   - profile torso spans are DEPTH (~22), never front-view breadth.
     *
     * Kinematics are rooted at the planted ankle and chain upward
     * (ankle -> knee -> hip -> shoulder -> elbow). V4 translated and rotated
     * the whole figure as one piece, which is why it read as a rocking stick.
     */
    deadlift: () => {
      const A = window.FuelPhysiqueAthlete;
      const F = A.P;
      const ankle = { x: 155, y: 194 };
      const knee = { x: 163, y: 165 };
      const hip = { x: 129, y: 142 };
      const shoulder = { x: 163, y: 114 };
      // Arms hang from the FRONT edge of the profile torso; hung from its
      // centre they are drawn inside the silhouette and vanish.
      const grip = { x: 168, y: 118 };
      const elbow = { x: 169, y: 143 };
      const wrist = { x: 170, y: 166 };
      const neck = { x: shoulder.x + 1.5, y: shoulder.y - F.neck };
      return svg("deadlift", `
      <g class="v4-ground"><path d="M20 196H302"/></g>
      <g class="dl-bar">${A.barbellRound(160, 170, 90, 26)}</g>
      <g class="dl-chain" style="transform-origin:${ankle.x}px ${ankle.y}px">
        <path class="fa-limb fa-far" d="${A.seg(ankle.x - 10, ankle.y - 1, knee.x - 10, knee.y, F.wShin[1], F.wShin[0])}"/>
        ${A.foot(ankle.x - 10, ankle.y - 1, 1)}
        ${A.foot(ankle.x, ankle.y, 1)}
        <path class="fa-limb fa-shin" d="${A.seg(ankle.x, ankle.y, knee.x, knee.y, F.wShin[1], F.wShin[0])}"/>
        <g class="dl-thigh" style="transform-origin:${knee.x}px ${knee.y}px">
          <path class="fa-limb fa-far" d="${A.seg(knee.x - 10, knee.y, hip.x - 10, hip.y, F.wThigh[1], F.wThigh[0])}"/>

          <path class="fa-limb fa-thigh" d="${A.seg(knee.x, knee.y, hip.x, hip.y, F.wThigh[1], F.wThigh[0])}"/>
          <g class="dl-torso" style="transform-origin:${hip.x}px ${hip.y}px">
            ${A.torso(shoulder.x, shoulder.y, hip.x, hip.y, 1, "profile")}
            <path class="fa-limb fa-neck" d="${A.seg(shoulder.x, shoulder.y, neck.x, neck.y, 6, 5)}"/>
            ${A.head(neck.x + 4, neck.y - F.head * 0.4, 1)}
            <path class="fa-accent" d="M${hip.x + 8},${hip.y - 12}L${shoulder.x - 8},${shoulder.y + 10}"/>
            <g class="dl-arm dl-arm--far" style="transform-origin:${grip.x - 9}px ${grip.y + 3}px">
              <path class="fa-limb fa-far" d="${A.seg(grip.x - 9, grip.y + 3, elbow.x - 9, elbow.y, F.wUpperArm[0], F.wUpperArm[1])}"/>
              <path class="fa-limb fa-far" d="${A.seg(elbow.x - 9, elbow.y, wrist.x - 9, wrist.y, F.wForeArm[0], F.wForeArm[1])}"/>
              ${A.hand(wrist.x - 9, wrist.y + 4, 0)}
            </g>
            <g class="dl-arm" style="transform-origin:${grip.x}px ${grip.y}px">
              <path class="fa-limb" d="${A.seg(grip.x, grip.y, elbow.x, elbow.y, F.wUpperArm[0], F.wUpperArm[1])}"/>
              <path class="fa-limb" d="${A.seg(elbow.x, elbow.y, wrist.x, wrist.y, F.wForeArm[0], F.wForeArm[1])}"/>
              ${A.hand(wrist.x, wrist.y + 4, 0)}
            </g>
          </g>
        </g>
      </g>
      <g class="v4-hero-readout"><text x="24" y="34">ATHLETIC SPECTRUM</text><text x="24" y="51">ONE CONTROLLED REP</text></g>`);
    }
  });

  /**
   * V4.1 scene modules (public/js/scenes/*.js) register themselves on
   * window.FuelPhysiqueScenes and return INNER markup only; the <svg>
   * wrapper, the domain class hook and the motion machinery below stay here
   * so a scene author never has to reproduce them.
   *
   * Resolution is deliberately done per call, not once at load: the scene
   * scripts are deferred siblings of this file, and a scene that fails to
   * parse must fall back to its V4 poster rather than blank the card.
   * `deadlift` is NOT in this list -- the hero is authored in this file.
   */
  const SCENE_KEYS = Object.freeze(["training", "nutrition", "progress", "benchPr", "coach", "social"]);
  const sceneFor = (name) => {
    const scene = window.FuelPhysiqueScenes && window.FuelPhysiqueScenes[name];
    return typeof scene === "function" ? scene : null;
  };
  const sourceOf = (name) => (sceneFor(name) ? "v4.1-scene" : (v4Templates[name] ? "v4-fallback" : "missing"));
  const templates = Object.freeze(Object.assign({}, v4Templates, Object.fromEntries(SCENE_KEYS.map((name) => [name, () => {
    const scene = sceneFor(name);
    if (scene) {
      try {
        return svg(name, scene());
      } catch (error) {
        console.warn(`[illustrated-v4] scene "${name}" failed, falling back to V4 art`, error);
      }
    }
    return v4Templates[name] ? v4Templates[name]() : "";
  }]))));

  function mountIllustrations() {
    const hosts = [...document.querySelectorAll("[data-v4-illustration]")];
    for (const host of hosts) {
      const name = host.dataset.v4Illustration;
      const template = templates[name];
      if (!template || host.querySelector(".v4-illustration, .v43-image-sequence")) continue;
      const markup = template();
      if (!markup) continue;
      host.innerHTML = markup;
      host.dataset.v4Duration = String(DURATIONS[name]);
      host.dataset.v4Source = name === "deadlift" ? "v4.1-hero" : sourceOf(name);
      const v43 = window.FuelPhysiqueImageSequenceV43;
      const v43Scene = name === "progress" ? "track" : name === "training" ? "session" : name === "nutrition" ? "plate" : name;
      if (v43?.isEnabled() && v43.mount(host, v43Scene)) {
        host.dataset.v4Source = "v4.3-real-athlete";
      }
    }
    return hosts;
  }

  function setupMotion(hosts) {
    hosts = hosts.filter((host) => host.dataset.v43Motion !== "prototype");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.documentElement.classList.toggle("v4-reduced-motion", reduced);
    if (reduced || !("IntersectionObserver" in window)) {
      hosts.forEach((host) => host.classList.add("is-illustration-complete"));
      return;
    }

    const finishTimers = new WeakMap();
    const playOnce = (host) => {
      host.classList.remove("is-illustration-paused");
      if (host.dataset.v4Played === "true") return;
      host.dataset.v4Played = "true";
      host.classList.add("is-illustration-active");
      const timer = window.setTimeout(() => {
        host.classList.remove("is-illustration-active", "is-illustration-paused");
        host.classList.add("is-illustration-complete");
      }, Number(host.dataset.v4Duration || 1800) + 120);
      finishTimers.set(host, timer);
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const host = entry.target;
        if (entry.isIntersecting) playOnce(host);
        else if (host.classList.contains("is-illustration-active")) host.classList.add("is-illustration-paused");
      }
    }, { threshold: 0.24, rootMargin: "0px 0px -4% 0px" });
    hosts.forEach((host) => observer.observe(host));

    const replay = (container) => {
      const host = container.querySelector("[data-v4-illustration]") || (container.matches?.("[data-v4-illustration]") ? container : null);
      if (!host || reduced) return;
      host.classList.remove("is-illustration-replay");
      void host.offsetWidth;
      host.classList.add("is-illustration-replay");
      window.setTimeout(() => host.classList.remove("is-illustration-replay"), Number(host.dataset.v4Duration || 1800) + 120);
    };
    document.querySelectorAll(".capability-card, .journey-card, .landing-hero-illustration").forEach((container) => {
      container.addEventListener("pointerenter", () => replay(container));
      container.addEventListener("focusin", () => replay(container));
      container.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "touch") replay(container);
      }, { passive: true });
    });
  }

  function boot() {
    const hosts = mountIllustrations();
    setupMotion(hosts);
    document.documentElement.classList.add("v4-illustrations-ready");
    // `templates` is exposed so the visual-QA harness can render a scene
    // headlessly and inspect the real markup instead of asserting on source text.
    window.__fuelPhysiqueIllustratedV4 = Object.freeze({
      durations: DURATIONS,
      hostCount: hosts.length,
      templates,
      // Which art each domain actually rendered, so integration checks can
      // prove a rebuilt scene did not silently fall back to the V4 poster.
      sources: Object.freeze(Object.fromEntries([...SCENE_KEYS, "deadlift"].map((name) => {
        const rendered = hosts.find((host) => host.dataset.v4Illustration === name)?.dataset.v4Source;
        return [name, rendered || (name === "deadlift" ? "v4.1-hero" : sourceOf(name))];
      }))),
      prototypeEnabled: Boolean(window.FuelPhysiqueImageSequenceV43?.isEnabled())
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
