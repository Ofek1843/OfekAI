/**
 * Training scene, V4.1 -- STANDING DUMBBELL CURL.
 *
 * Reads as a curl (and NOT as the deadlift) because:
 *   - front view, so shoulder breadth and both planted legs are visible;
 *   - the upper arm is pinned to the ribs and only the FOREARM group
 *     rotates, which is the entire visual signature of a curl;
 *   - the dumbbell lives INSIDE the forearm group at the wrist and is drawn
 *     BEFORE the hand, so it travels with the hand and is gripped, not
 *     floating;
 *   - only ONE weight is in the scene. An earlier pass gave the support arm
 *     a dumbbell too; at the bottom of the rep the two merged into what read
 *     as a barbell across the thighs, i.e. the deadlift.
 *
 * Node budget: 28 elements.
 */
(() => {
  "use strict";
  window.FuelPhysiqueScenes = window.FuelPhysiqueScenes || {};

  /**
   * Dumbbell with ROUND plates. The shared rect-plate dumbbell reads as two
   * blue pills once the forearm rotates off the horizontal; circles are
   * rotation-invariant, so the weight stays a weight at every frame.
   */
  const dumbbell = (A, x, y) => `<g class="fa-equip tr-bell">
        <path class="fa-bar" d="M${A.num(x - 17)},${A.num(y)}H${A.num(x + 17)}"/>
        <circle class="fa-plate" cx="${A.num(x - 17)}" cy="${A.num(y)}" r="11.5"/>
        <circle class="fa-plate fa-plate--inner" cx="${A.num(x - 17)}" cy="${A.num(y)}" r="4.8"/>
        <circle class="fa-plate" cx="${A.num(x + 17)}" cy="${A.num(y)}" r="11.5"/>
        <circle class="fa-plate fa-plate--inner" cx="${A.num(x + 17)}" cy="${A.num(y)}" r="4.8"/>
      </g>`;

  window.FuelPhysiqueScenes.training = () => {
    const A = window.FuelPhysiqueAthlete;
    const F = A.P;

    // Front-view skeleton, built UP from the ground so the stance is planted.
    const pelvis = { x: 158, y: 110 };
    const shoulders = { x: 158, y: 59 };
    const neck = { x: shoulders.x + 1.5, y: shoulders.y - F.neck };

    // Far (support) side.
    const fHip = { x: 149, y: 111 };
    const fKnee = { x: 144, y: 153 };
    const fAnkle = { x: 142, y: 190 };
    const fSh = { x: 136, y: 62 };
    const fElbow = { x: 128, y: 94 };
    const fWrist = { x: 121, y: 125 };

    // Near (working) side.
    const nHip = { x: 167, y: 111 };
    const nKnee = { x: 172, y: 153 };
    const nAnkle = { x: 175, y: 190 };
    const sh = { x: 181, y: 62 };
    const elbow = { x: 189, y: 95 };   // rotation origin of the forearm group
    const wrist = { x: 197, y: 124 };  // start of rep: extended, not locked out

    return `<g class="tr-scene">
      <g class="v4-ground"><path d="M30 190H290"/></g>
      <path class="fa-limb fa-far" d="${A.seg(fHip.x, fHip.y, fKnee.x, fKnee.y, F.wThigh[0], F.wThigh[1])}"/>
      <path class="fa-limb fa-far" d="${A.seg(fKnee.x, fKnee.y, fAnkle.x, fAnkle.y, F.wShin[0], F.wShin[1])}"/>
      ${A.foot(fAnkle.x, fAnkle.y, -1)}
      <g class="tr-arm-far">
        <path class="fa-limb fa-far" d="${A.seg(fSh.x, fSh.y, fElbow.x, fElbow.y, F.wUpperArm[0], F.wUpperArm[1])}"/>
        <path class="fa-limb fa-far" d="${A.seg(fElbow.x, fElbow.y, fWrist.x, fWrist.y, F.wForeArm[0], F.wForeArm[1])}"/>
        ${A.hand(fWrist.x, fWrist.y + 3, 0)}
      </g>
      <g class="tr-torso" style="transform-origin:${pelvis.x}px ${pelvis.y}px">
        ${A.torso(shoulders.x, shoulders.y, pelvis.x, pelvis.y, 1, "front")}
        <path class="fa-limb fa-neck" d="${A.seg(shoulders.x, shoulders.y, neck.x, neck.y, 6.4, 5.4)}"/>
        ${A.head(neck.x + 1.5, neck.y - F.head * 0.42, 1)}
      </g>
      <path class="fa-limb" d="${A.seg(nHip.x, nHip.y, nKnee.x, nKnee.y, F.wThigh[0], F.wThigh[1])}"/>
      <path class="fa-limb" d="${A.seg(nKnee.x, nKnee.y, nAnkle.x, nAnkle.y, F.wShin[0], F.wShin[1])}"/>
      ${A.foot(nAnkle.x, nAnkle.y, 1)}
      <g class="tr-uarm" style="transform-origin:${sh.x}px ${sh.y}px">
        <path class="fa-limb" d="${A.seg(sh.x, sh.y, elbow.x, elbow.y, F.wUpperArm[0], F.wUpperArm[1])}"/>
        <g class="tr-farm" style="transform-origin:${elbow.x}px ${elbow.y}px">
          <path class="fa-limb" d="${A.seg(elbow.x, elbow.y, wrist.x, wrist.y, F.wForeArm[0], F.wForeArm[1])}"/>
          ${dumbbell(A, wrist.x, wrist.y + 7)}
          ${A.hand(wrist.x, wrist.y + 7, 0)}
        </g>
      </g>
    </g>`;
  };
})();
