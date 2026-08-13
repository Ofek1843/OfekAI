/**
 * FuelPhysique V4.1 illustration scenes: Coach + Social.
 *
 * Both scenes are built entirely from the shared anatomy system in
 * public/js/athlete-figure.js -- tapered filled capsules (seg), a real
 * cranium/jaw head, a spanned torso, and articulated joint groups. The V4
 * versions of these two cards were the weakest in the set (Coach was a
 * stick figure next to a clipboard, Social was two circle-and-blob people)
 * which is why both figures here are rebuilt from the proportion table.
 *
 * Class prefixes: co- (coach) and so- (social), so joint groups cannot
 * collide with the other V4.1 scenes being authored in parallel.
 */
(() => {
  "use strict";
  const S = (window.FuelPhysiqueScenes = window.FuelPhysiqueScenes || {});

  // --- local helpers ---------------------------------------------------
  const A = () => window.FuelPhysiqueAthlete;
  const limb = (a, x1, y1, x2, y2, w1, w2, cls = "") =>
    `<path class="fa-limb ${cls}" d="${a.seg(x1, y1, x2, y2, w1, w2)}"/>`;

  /**
   * Standing legs. Front-view figures need both legs to read as a person,
   * but a planted stance needs no articulation, so these are plain segs
   * rather than leg() groups -- three nodes per leg instead of five, which
   * is what keeps a two-figure scene inside the node budget.
   */
  function stance(a, hip, knee, ankle, facing, cls) {
    const F = a.P;
    return `${limb(a, hip.x, hip.y, knee.x, knee.y, F.wThigh[0], F.wThigh[1], cls)}
      ${limb(a, knee.x, knee.y, ankle.x, ankle.y, F.wShin[0], F.wShin[1], cls)}
      ${a.foot(ankle.x, ankle.y, facing)}`;
  }

  /* ────────────────────────────────────────────────────────────────────
     COACH -- "here is your next step"
     Athlete stands at the left and points into a training plan board.
     The board carries a completed row, ONE highlighted recommendation
     row with a next-step chevron, and a check that resolves onto it.
     The board is drawn BEFORE the athlete so the pointing hand overlaps
     the board edge -- the hand must never be painted over.
     ──────────────────────────────────────────────────────────────────── */
  S.coach = () => {
    const a = A();
    const F = a.P;
    const sh = { x: 66, y: 80 };
    const pv = { x: 66, y: 132 };
    const neck = { x: sh.x + 1.5, y: sh.y - F.neck };
    // pointing arm: shoulder -> elbow -> wrist, ending ON the highlighted row
    const pSh = { x: 85, y: 86 };
    const pEl = { x: 105, y: 100 };
    const pWr = { x: 141, y: 113 };
    return `<g class="co-scene">
      <path class="v4-ground co-ground" d="M24 192H298"/>
      <g class="co-board">
        <rect class="co-frame" x="132" y="34" width="166" height="138" rx="12"/>
        <path class="co-title" d="M154 58H208"/>
        <path class="co-row" d="M168 86H270"/>
        <path class="co-check co-check--done" d="M143 86L148 91L157 79"/>
        <rect class="co-band" x="138" y="101" width="152" height="28" rx="8"/>
        <path class="co-row co-row--rec" d="M168 115H254"/>
        <path class="co-next" d="M266 108L274 115L266 122"/>
        <path class="co-check co-check--resolve" d="M143 115L148 120L157 108"/>
        <path class="co-row" d="M168 146H238"/>
      </g>
      <g class="co-athlete">
        ${stance(a, { x: 57, y: 130 }, { x: 53, y: 160 }, { x: 52, y: 190 }, 1, "fa-far")}
        ${limb(a, 48, 86, 42, 114, F.wUpperArm[0], F.wUpperArm[1], "fa-far")}
        ${limb(a, 42, 114, 45, 143, F.wForeArm[0], F.wForeArm[1], "fa-far")}
        ${a.torso(sh.x, sh.y, pv.x, pv.y, 1, "front")}
        ${limb(a, sh.x, sh.y, neck.x, neck.y, 6.4, 5.4)}
        ${a.head(neck.x + 2.5, neck.y - F.head * 0.42, 1)}
        ${stance(a, { x: 76, y: 130 }, { x: 79, y: 160 }, { x: 80, y: 190 }, 1, "")}
        <g class="co-arm" style="transform-origin:${pSh.x}px ${pSh.y}px">
          ${limb(a, pSh.x, pSh.y, pEl.x, pEl.y, F.wUpperArm[0], F.wUpperArm[1])}
          <g class="co-forearm" style="transform-origin:${pEl.x}px ${pEl.y}px">
            ${limb(a, pEl.x, pEl.y, pWr.x, pWr.y, F.wForeArm[0], F.wForeArm[1])}
            ${a.hand(pWr.x, pWr.y, 28)}
          </g>
        </g>
      </g>
    </g>`;
  };

  /* ────────────────────────────────────────────────────────────────────
     SOCIAL -- two athletes exchanging FuelPhysique content
     Both figures come from the same proportion table as the deadlift
     hero. A (left) sends a workout card; B (right) answers with a music
     card and a message card. Each card carries a distinct glyph so the
     three read apart at card size without any text.
     ──────────────────────────────────────────────────────────────────── */
  function socialPerson(a, cx, facing, armCls, elbow, wrist) {
    const F = a.P;
    const sh = { x: cx, y: 82 };
    const pv = { x: cx, y: 134 };
    const neck = { x: cx + facing * 1.5, y: sh.y - F.neck };
    const s = facing;                       // +1 faces right, -1 faces left
    const nearSh = { x: cx + s * 17, y: 86 };
    const farSh = { x: cx - s * 20, y: 88 };
    // No wrapper group: nothing transforms the whole person, and two
    // full figures plus three cards has to stay inside the node budget.
    return `
      ${stance(a, { x: cx - s * 9, y: 132 }, { x: cx - s * 12, y: 161 }, { x: cx - s * 13, y: 190 }, s, "fa-far")}
      ${limb(a, farSh.x, farSh.y, farSh.x - s * 5, 116, F.wUpperArm[0], F.wUpperArm[1], "fa-far")}
      ${limb(a, farSh.x - s * 5, 116, farSh.x - s * 3, 144, F.wForeArm[0], F.wForeArm[1], "fa-far")}
      ${a.torso(sh.x, sh.y, pv.x, pv.y, s, "front")}
      ${limb(a, sh.x, sh.y, neck.x, neck.y, 6.4, 5.4)}
      ${a.head(neck.x + s * 2.5, neck.y - F.head * 0.42, s)}
      ${stance(a, { x: cx + s * 9, y: 132 }, { x: cx + s * 11, y: 161 }, { x: cx + s * 12, y: 190 }, s, "")}
      <g class="${armCls}" style="transform-origin:${nearSh.x}px ${nearSh.y}px">
        ${limb(a, nearSh.x, nearSh.y, elbow.x, elbow.y, F.wUpperArm[0], F.wUpperArm[1])}
        ${limb(a, elbow.x, elbow.y, wrist.x, wrist.y, F.wForeArm[0], F.wForeArm[1])}
        ${a.hand(wrist.x, wrist.y, facing > 0 ? -18 : 18)}
      </g>`;
  }

  S.social = () => {
    const a = A();
    return `<g class="so-scene">
      <path class="v4-ground so-ground" d="M18 192H302"/>
      ${socialPerson(a, 44, 1, "so-arm so-arm--a", { x: 76, y: 80 }, { x: 95, y: 68 })}
      ${socialPerson(a, 276, -1, "so-arm so-arm--b", { x: 244, y: 88 }, { x: 227, y: 99 })}
      <g class="so-card so-card--workout">
        <rect class="so-frame" x="100" y="38" width="82" height="36" rx="8"/>
        <path class="so-glyph" d="M118 56H164M126 48V64M156 48V64"/>
      </g>
      <g class="so-card so-card--music">
        <rect class="so-frame" x="146" y="86" width="76" height="36" rx="8"/>
        <path class="so-glyph" d="M172 112V95L192 90V107"/>
        <circle class="so-note" cx="168" cy="112" r="5"/>
        <circle class="so-note" cx="188" cy="107" r="5"/>
      </g>
      <g class="so-card so-card--message">
        <rect class="so-frame" x="106" y="132" width="80" height="34" rx="8"/>
        <path class="so-glyph" d="M120 144H172M120 154H152"/>
      </g>
    </g>`;
  };
})();
