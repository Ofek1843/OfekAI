/**
 * FuelPhysique V4.1 Progress domain scenes.
 *
 *   progress  — athlete standing on a digital scale, progress chart behind.
 *   benchPr   — bench press, athlete lying on a real bench, gripping a
 *               round-plate barbell, restrained PR tick.
 *
 * Both are built entirely from the shared anatomy API in
 * public/js/athlete-figure.js: every limb is a tapered FILLED capsule via
 * seg(), joints are nested groups with an explicit transform-origin, and
 * equipment the athlete grips is emitted BEFORE the athlete so the hands
 * visibly land on top of it.
 *
 * Node budget: progress 38, benchPr 36 (ceiling 45).
 */
(() => {
  "use strict";

  window.FuelPhysiqueScenes = window.FuelPhysiqueScenes || {};

  /* ── Scene 1: body progress on a scale ────────────────────────────────
     Front view. The figure is compressed to ~0.85 of the canonical
     7.4-head stack so the head clears the top of the card and the chart
     has somewhere to live. Widths stay at table value, which keeps the
     silhouette athletic rather than lanky at card size.

     Kinematics: pelvis group settles down, thighs rotate a couple of
     degrees at the hips, shins counter-rotate AND counter-translate at
     the knees so the feet stay planted on the platform. Nothing
     translates as a single block.                                       */
  window.FuelPhysiqueScenes.progress = () => {
    const A = window.FuelPhysiqueAthlete;
    const F = A.P;

    const cx = 149;
    const shoulderY = 58;
    const hipY = 102;
    const kneeY = 138;
    const ankleY = 170;

    const hipL = { x: 140, y: hipY };
    const hipR = { x: 158, y: hipY };
    const kneeL = { x: 137, y: kneeY };
    const kneeR = { x: 161, y: kneeY };
    const ankL = { x: 135, y: ankleY };
    const ankR = { x: 163, y: ankleY };

    const shL = { x: 129, y: shoulderY };
    const shR = { x: 169, y: shoulderY };
    const elL = { x: 121, y: 86 };
    const elR = { x: 177, y: 86 };
    const wrL = { x: 117, y: 114 };
    const wrR = { x: 181, y: 114 };
    const neck = { x: cx + 1.5, y: shoulderY - F.neck };

    // Leg chain: hip group carries the thigh, knee group carries shin+foot.
    const legChain = (side, hip, knee, ankle, facing) => `
      <g class="pr-thigh pr-thigh--${side}" style="transform-origin:${hip.x}px ${hip.y}px">
        <path class="fa-limb" d="${A.seg(hip.x, hip.y, knee.x, knee.y, F.wThigh[0], F.wThigh[1])}"/>
        <g class="pr-shin pr-shin--${side}" style="transform-origin:${knee.x}px ${knee.y}px">
          <path class="fa-limb" d="${A.seg(knee.x, knee.y, ankle.x, ankle.y, F.wShin[0], F.wShin[1])}"/>
          ${A.foot(ankle.x, ankle.y, facing)}
        </g>
      </g>`;

    return `
      <g class="v4-ground"><path d="M20 194H300"/></g>
      <g class="pr-chart" style="opacity:.62">
        <path class="pr-chart-axis" d="M206,152V66M206,152H298" style="stroke-width:3;opacity:.42"/>
        <path class="fa-accent pr-chart-line" d="M212,142L234,124L252,130L272,100L292,78" style="stroke-width:5"/>
        <circle class="fa-plate pr-chart-dot" cx="292" cy="78" r="4.5"/>
      </g>
      <g class="pr-scale">
        <rect class="pr-scale-deck" x="98" y="170" width="104" height="14" rx="3"/>
        <rect class="pr-scale-base" x="108" y="184" width="84" height="8" rx="2"/>
        <rect class="fa-plate pr-scale-screen" x="150" y="173" width="44" height="9" rx="2"/>
        <g class="pr-readout">
          <rect x="156" y="175.5" width="6" height="4.5" rx="1"/>
          <rect x="166" y="175.5" width="6" height="4.5" rx="1"/>
          <rect x="176" y="175.5" width="6" height="4.5" rx="1"/>
        </g>
      </g>
      <g class="pr-hips">
        ${legChain("l", hipL, kneeL, ankL, -1)}
        ${legChain("r", hipR, kneeR, ankR, 1)}
        <g class="pr-torso">
          <path class="fa-limb fa-far" d="${A.seg(shL.x, shL.y, elL.x, elL.y, F.wUpperArm[0], F.wUpperArm[1])}"/>
          <path class="fa-limb fa-far" d="${A.seg(elL.x, elL.y, wrL.x, wrL.y, F.wForeArm[0], F.wForeArm[1])}"/>
          ${A.hand(wrL.x, wrL.y, 0)}
          ${A.torso(cx, shoulderY, cx, hipY, 1, "front")}
          <path class="fa-limb" d="${A.seg(cx, shoulderY, neck.x, neck.y, 6.4, 5.4)}"/>
          ${A.head(neck.x + 1.5, neck.y - F.head * 0.42, 1)}
          <path class="fa-accent" d="M136,74Q149,82 162,74" style="opacity:.7"/>
          <g class="pr-uarm pr-uarm--stand" style="transform-origin:${shR.x}px ${shR.y}px">
            <path class="fa-limb" d="${A.seg(shR.x, shR.y, elR.x, elR.y, F.wUpperArm[0], F.wUpperArm[1])}"/>
            <g class="pr-farm pr-farm--stand" style="transform-origin:${elR.x}px ${elR.y}px">
              <path class="fa-limb" d="${A.seg(elR.x, elR.y, wrR.x, wrR.y, F.wForeArm[0], F.wForeArm[1])}"/>
              ${A.hand(wrR.x, wrR.y, 0)}
            </g>
          </g>
        </g>
      </g>`;
  };

  /* ── Scene 2: bench press ─────────────────────────────────────────────
     Profile athlete on a real bench (pad + splayed legs), feet planted on
     the floor, both hands gripping a round-plate barbell. Drawn in the
     order ground -> bench -> barbell -> athlete, so the hands land ON the
     bar instead of the bar painting over the knuckles.

     Torso uses view "profile" (span 25 = body DEPTH). Front-view breadth
     on a lying figure produces a slab that swallows the arms.            */
  window.FuelPhysiqueScenes.benchPr = () => {
    const A = window.FuelPhysiqueAthlete;
    const F = A.P;

    const shoulder = { x: 122, y: 129 };
    const hip = { x: 190, y: 134 };
    const neck = { x: 108, y: 125 };

    // Knees bend over planted feet instead of extending into an impossible
    // straight-leg press. The near foot tucks slightly behind the knee.
    const legHip = { x: 190, y: 137 };
    const legKnee = { x: 224, y: 158 };
    const legAnkle = { x: 211, y: 188 };
    const farHip = { x: 183, y: 139 };
    const farKnee = { x: 214, y: 161 };
    const farAnkle = { x: 228, y: 188 };

    // Arm chain at LOCKOUT. The grip is above the shoulder line; the
    // animated descent travels down and slightly toward the lower chest.
    const armS = { x: 128, y: 126 };
    const armE = { x: 151, y: 96 };
    const armW = { x: 168, y: 68 };
    const farS = { x: 121, y: 129 };
    const farE = { x: 133, y: 98 };
    const farW = { x: 141, y: 68 };

    const armChain = (mod, s, e, w, far) => `
      <g class="pr-uarm pr-uarm--${mod}" style="transform-origin:${s.x}px ${s.y}px">
        <path class="fa-limb${far}" d="${A.seg(s.x, s.y, e.x, e.y, F.wUpperArm[0], F.wUpperArm[1])}"/>
        <g class="pr-farm pr-farm--${mod}" style="transform-origin:${e.x}px ${e.y}px">
          <path class="fa-limb${far}" d="${A.seg(e.x, e.y, w.x, w.y, F.wForeArm[0], F.wForeArm[1])}"/>
          ${A.hand(w.x, w.y, 0)}
        </g>
      </g>`;

    return `
      <g class="v4-ground"><path d="M18 192H302"/></g>
      <g class="pr-bench">
        <rect class="pr-bench-pad" x="76" y="140" width="162" height="14" rx="4"/>
        <rect class="pr-head-pad" x="76" y="135" width="52" height="9" rx="4"/>
        <path class="pr-bench-frame" d="M112,154L102,190M214,154L224,190M90,190H116M210,190H238" style="stroke-width:6"/>
      </g>
      <g class="pr-bar">${A.barbellRound(155, 68, 82, 22)}</g>
      <g class="pr-athlete">
        <path class="fa-limb fa-far" d="${A.seg(farHip.x, farHip.y, farKnee.x, farKnee.y, F.wThigh[0], F.wThigh[1])}"/>
        <path class="fa-limb fa-far" d="${A.seg(farKnee.x, farKnee.y, farAnkle.x, farAnkle.y, F.wShin[0], F.wShin[1])}"/>
        ${A.foot(farAnkle.x, farAnkle.y, -1)}
        ${armChain("far", farS, farE, farW, " fa-far")}
        <g class="pr-torso pr-torso--bench">
          ${A.torso(shoulder.x, shoulder.y, hip.x, hip.y, -1, "profile")}
          <path class="fa-limb" d="${A.seg(shoulder.x, shoulder.y, neck.x, neck.y, 6.4, 5.4)}"/>
          ${A.head(neck.x - 11, neck.y + 1, -1)}
          <path class="fa-accent pr-chest" d="M126,124Q147,116 169,126"/>
        </g>
        <path class="fa-limb" d="${A.seg(legHip.x, legHip.y, legKnee.x, legKnee.y, F.wThigh[0], F.wThigh[1])}"/>
        <path class="fa-limb" d="${A.seg(legKnee.x, legKnee.y, legAnkle.x, legAnkle.y, F.wShin[0], F.wShin[1])}"/>
        ${A.foot(legAnkle.x, legAnkle.y, -1)}
        ${armChain("bench", armS, armE, armW, "")}
      </g>
      <g class="pr-cue">
        <path class="fa-accent" d="M26,50L36,61L56,34" style="stroke-width:5"/>
        <path class="fa-accent" d="M26,72H58" style="stroke-width:4;opacity:.5"/>
      </g>`;
  };
})();
