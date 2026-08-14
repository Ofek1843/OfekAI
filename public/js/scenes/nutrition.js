/**
 * FuelPhysique V4.1 -- NUTRITION scene: an athlete eating a meal.
 *
 * The V4 version was a stick figure whose "arm" was a single polyline and
 * whose utensil floated free of the hand. This rebuild uses the shared
 * anatomy API: every limb is a tapered filled capsule, and the utensil is a
 * child of the forearm group, so it is physically carried by the hand
 * through the whole shoulder -> elbow -> wrist -> fork chain.
 *
 * Composition notes from rasterised review:
 *   - a seated profile figure at a table with real geometry (top + legs +
 *     chair) is what makes "meal" read; a bowl alone reads as a prop;
 *   - a BOWL with a food mound reads at card size where a flat plate
 *     ellipse does not -- the mound is the accent-coloured mass;
 *   - the fork is drawn along the forearm axis with its own small counter
 *     -rotation group, which is what a real wrist does between plate and
 *     mouth. Without it the fork points at the ceiling at the mouth pose.
 *   - profile torso spans (DEPTH ~25), never front breadth.
 */
(() => {
  "use strict";

  window.FuelPhysiqueScenes = window.FuelPhysiqueScenes || {};

  window.FuelPhysiqueScenes.nutrition = () => {
    const A = window.FuelPhysiqueAthlete;
    const F = A.P;

    // --- Skeleton anchors (base pose = utensil in the food) ------------
    const shoulders = { x: 86, y: 100 };
    const pelvis = { x: 76, y: 152 };
    const neck = { x: shoulders.x + 1.5, y: shoulders.y - F.neck };

    // Eating arm hangs off the FRONT edge of the profile torso; hung from
    // its centre it would be drawn inside the silhouette and vanish.
    const nS = { x: 92, y: 102 };
    const nE = { x: 111.2, y: 128.9 };   // elbow, upper arm at 54.5deg
    const nW = { x: 141.9, y: 125.6 };   // wrist, forearm at -6deg
    const FORK_DEG = -6;                  // fork lies along the forearm

    // Support arm resting on the table.
    const fS = { x: 80, y: 106 };
    const fE = { x: 103, y: 130 };
    const fW = { x: 133, y: 144 };

    const hip = { x: 76, y: 152 };
    const knee = { x: 118, y: 155 };
    const ankle = { x: 122, y: 192 };

    // Fork: grip at local origin, tines toward +x. One path -- handle,
    // shoulder flare, then three tines cut by two notches.
    const fork = `M-11,1.7L8,2.3L10.5,6L17.5,6L17.5,3.4L12,3.4L12,1.3L17.5,1.3L17.5,-1.3L12,-1.3L12,-3.4L17.5,-3.4L17.5,-6L10.5,-6L8,-2.3L-11,-1.7Z`;

    return `<g class="nu-scene">
      <g class="v4-ground"><path d="M18 194H302"/></g>
      <g class="nu-stage" transform="translate(-18 -23.28) scale(1.12)">
      <g class="nu-chair">
        <rect x="52" y="104" width="7" height="90" rx="3"/>
        <rect x="54" y="156" width="48" height="7" rx="3"/>
        <rect x="93" y="163" width="6" height="31" rx="3"/>
      </g>
      <g class="nu-legs">
        <path class="fa-limb fa-far" d="${A.seg(hip.x - 9, hip.y, knee.x - 9, knee.y + 2, F.wThigh[0], F.wThigh[1])}"/>
        <path class="fa-limb fa-far" d="${A.seg(knee.x - 9, knee.y + 2, ankle.x - 9, ankle.y, F.wShin[0], F.wShin[1])}"/>
        <path class="fa-limb" d="${A.seg(hip.x, hip.y, knee.x, knee.y, F.wThigh[0], F.wThigh[1])}"/>
        <path class="fa-limb" d="${A.seg(knee.x, knee.y, ankle.x, ankle.y, F.wShin[0], F.wShin[1])}"/>
        ${A.foot(ankle.x, ankle.y, 1)}
      </g>
      <g class="nu-table">
        <rect x="118" y="147" width="162" height="7" rx="2"/>
        <rect x="134" y="154" width="7" height="40" rx="2"/>
        <rect x="266" y="154" width="7" height="40" rx="2"/>
      </g>
      <g class="nu-meal">
        <path class="fa-plate" d="M143,134C144,121 153,113 162,119C169,109 180,110 185,121C192,120 196,127 195,134Z"/>
        <path class="fa-limb nu-bowl" d="M139,133Q169,160 199,133Z"/>
      </g>
      <g class="nu-torso" style="transform-origin:${pelvis.x}px ${pelvis.y}px">
        ${A.torso(shoulders.x, shoulders.y, pelvis.x, pelvis.y, 1, "profile")}
        <g class="nu-head" style="transform-origin:${shoulders.x}px ${shoulders.y}px">
          <path class="fa-limb fa-neck" d="${A.seg(shoulders.x, shoulders.y, neck.x, neck.y, 6.4, 5.4)}"/>
          ${A.head(neck.x + 1.5, neck.y - F.head * 0.42, 1)}
        </g>
        <g class="nu-armrest">
          <path class="fa-limb fa-far" d="${A.seg(fS.x, fS.y, fE.x, fE.y, F.wUpperArm[0], F.wUpperArm[1])}"/>
          <path class="fa-limb fa-far" d="${A.seg(fE.x, fE.y, fW.x, fW.y, F.wForeArm[0], F.wForeArm[1])}"/>
          ${A.hand(fW.x, fW.y, 22).replace("fa-hand", "fa-hand fa-far")}
        </g>
        <g class="nu-uarm" style="transform-origin:${nS.x}px ${nS.y}px">
          <path class="fa-limb" d="${A.seg(nS.x, nS.y, nE.x, nE.y, F.wUpperArm[0], F.wUpperArm[1])}"/>
          <g class="nu-farm" style="transform-origin:${nE.x}px ${nE.y}px">
            <path class="fa-limb" d="${A.seg(nE.x, nE.y, nW.x, nW.y, F.wForeArm[0], F.wForeArm[1])}"/>
            ${A.hand(nW.x, nW.y, FORK_DEG)}
            <g class="nu-fork" style="transform-origin:${nW.x}px ${nW.y}px">
              <path class="fa-limb nu-utensil" d="${fork}" transform="translate(${nW.x} ${nW.y}) rotate(${FORK_DEG})"/>
            </g>
          </g>
        </g>
      </g>
      </g>
    </g>`;
  };
})();
