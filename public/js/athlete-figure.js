/**
 * FuelPhysique premium athletic figure system (V4.1).
 *
 * Replaces the V4 stick construction (circle head + quad torso + polyline
 * limbs) with a single shared anatomy language:
 *
 *   - every limb segment is a TAPERED FILLED CAPSULE, not a stroke, so arms
 *     and legs carry visual mass and read as an athlete rather than a wire
 *     diagram;
 *   - joints are real kinematic groups with an explicit transform-origin, so
 *     motion articulates at shoulder/elbow/hip/knee instead of rotating a
 *     whole stick;
 *   - one proportion table drives every scene, so Training, Nutrition,
 *     Progress, Coach and Social are visibly the same character.
 *
 * Documented in docs/premium-athletic-illustration-system.md.
 *
 * Deliberately dependency-free and node-frugal: one <path> per limb segment
 * keeps the DOM close to the previous illustration cost while adding volume.
 */
(() => {
  "use strict";

  // --- Proportion table (the shared DNA) -------------------------------
  // Expressed in viewBox units for a 320x220 canvas. HEAD is the module:
  // a full standing figure is ~7.4 HEAD tall, which reads athletic rather
  // than heroic (8+) or childlike (6).
  const P = Object.freeze({
    head: 22,          // cranium height
    headW: 17,         // cranium width (narrower than tall -> not a circle)
    neck: 6.5,
    shoulderW: 52,     // broad clavicle line, still shy of bodybuilder scale
    chestW: 46,
    waistW: 25,        // stronger shoulder-to-waist taper reads lean/athletic
    pelvisW: 32,
    torso: 52,         // shoulder line to hip line
    upperArm: 33,
    foreArm: 31,
    thigh: 42,
    shin: 38,
    // Limb half-widths, proximal -> distal. The step down at each joint is
    // what gives the limb its tapered, muscled read.
    wUpperArm: [8.3, 5.5],
    wForeArm: [5.8, 4.1],
    wThigh: [12.2, 7.8],
    wShin: [8, 4.8],
    hand: 4.6,
    foot: 11
  });

  const R = (deg) => (deg * Math.PI) / 180;
  const num = (n) => Math.round(n * 10) / 10;

  /**
   * Tapered capsule between two points with rounded joint caps.
   * This single primitive draws every arm and leg segment, which is why the
   * figures share a silhouette language across scenes.
   */
  function seg(x1, y1, x2, y2, w1, w2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;          // unit direction
    const uy = dy / len;
    const nx = -uy;               // left normal
    const ny = ux;
    // Cubic caps, NOT arc (A) commands. The arc version's sweep flags wound
    // the wrong way for some segment orientations, folding the cap back over
    // the body and punching visible holes in the limb. K approximates a
    // semicircle with one cubic.
    const K = 1.3333;
    const P0 = [x1 + nx * w1, y1 + ny * w1];
    const P1 = [x2 + nx * w2, y2 + ny * w2];
    const P2 = [x2 - nx * w2, y2 - ny * w2];
    const P3 = [x1 - nx * w1, y1 - ny * w1];
    // A subtle belly through the proximal half keeps long straight capsules
    // from reading as robot tubing. Ends stay identical, so every existing
    // joint origin and equipment grip remains stable.
    const mx = x1 + dx * 0.44;
    const my = y1 + dy * 0.44;
    const bulge = Math.max(0.7, (w1 + w2) * 0.13);
    const ML = [mx + nx * ((w1 + w2) * 0.54 + bulge), my + ny * ((w1 + w2) * 0.54 + bulge)];
    const MR = [mx - nx * ((w1 + w2) * 0.54 + bulge), my - ny * ((w1 + w2) * 0.54 + bulge)];
    const f = (p) => `${num(p[0])},${num(p[1])}`;
    const outD = [ux * w2 * K, uy * w2 * K];
    const outP = [-ux * w1 * K, -uy * w1 * K];
    const add = (p, o) => [p[0] + o[0], p[1] + o[1]];
    return `M${f(P0)}Q${f(ML)} ${f(P1)}C${f(add(P1, outD))} ${f(add(P2, outD))} ${f(P2)}Q${f(MR)} ${f(P3)}C${f(add(P3, outP))} ${f(add(P0, outP))} ${f(P0)}Z`;
  }

  /** Forward kinematics: project a point at an angle (deg, 0 = +x, 90 = down). */
  const project = (p, deg, len) => ({ x: p.x + Math.cos(R(deg)) * len, y: p.y + Math.sin(R(deg)) * len });

  /**
   * Head: cranium + jaw taper, no face. A pure circle is what made the V4
   * figure read as an icon; the flattened jaw and slight forward tilt give
   * it direction, which is most of what "this person is doing something"
   * depends on at card size.
   */
  function head(cx, cy, facing = 1) {
    const w = P.headW / 2;
    const h = P.head / 2;
    const x = (offset) => num(cx + facing * offset);
    const y = (offset) => num(cy + offset);
    // A restrained brow/nose/chin silhouette adds direction without drawing
    // facial features. Mirroring the x offsets gives both facing directions
    // the same editorial profile instead of a blank mannequin oval.
    return `<path class="fa-head" d="M${x(-w * 0.82)},${y(h * 0.52)}
      C${x(-w * 1.02)},${y(0)} ${x(-w * 0.88)},${y(-h * 0.76)} ${x(-w * 0.3)},${y(-h)}
      C${x(w * 0.24)},${y(-h * 1.08)} ${x(w * 0.7)},${y(-h * 0.72)} ${x(w * 0.72)},${y(-h * 0.34)}
      L${x(w * 1.03)},${y(-h * 0.05)}L${x(w * 0.72)},${y(h * 0.12)}
      C${x(w * 0.62)},${y(h * 0.54)} ${x(w * 0.34)},${y(h * 0.88)} ${x(w * 0.05)},${y(h * 0.92)}
      C${x(-w * 0.48)},${y(h * 0.92)} ${x(-w * 0.72)},${y(h * 0.72)} ${x(-w * 0.82)},${y(h * 0.52)}Z"/>`;
  }

  /**
   * Torso: shoulder yoke -> lat taper -> waist -> pelvis. Drawn as one filled
   * path so the chest/back structure and hip line are legible in silhouette.
   */
  /**
   * `view` selects the span table. This matters more than anything else in
   * the system: applying front-view shoulder BREADTH (46) to a profile
   * figure produces a giant angular kite that swallows the limbs. In
   * profile the perpendicular span is torso DEPTH, which is roughly half.
   */
  const SPANS = Object.freeze({
    front: { shoulder: P.shoulderW, chest: P.chestW, waist: P.waistW, pelvis: P.pelvisW },
    profile: { shoulder: 19, chest: 24, waist: 17, pelvis: 22 }
  });

  function torso(sx, sy, hx, hy, facing = 1, view = "front") {
    const span = SPANS[view] || SPANS.front;
    const ang = Math.atan2(hy - sy, hx - sx);
    const px = -Math.sin(ang);
    const py = Math.cos(ang);
    const sw = span.shoulder / 2;
    const ww = span.waist / 2;
    const pw = span.pelvis / 2;
    const at = (t, w) => ({ x: sx + (hx - sx) * t + px * w, y: sy + (hy - sy) * t + py * w });
    const L0 = at(0, sw);
    const L1 = at(0.42, span.chest / 2);  // lat sweep
    const L2 = at(0.72, ww);             // waist
    const L3 = at(1, pw);
    const R3 = at(1, -pw);
    const R2 = at(0.72, -ww);
    const R1 = at(0.42, -span.chest / 2);
    const R0 = at(0, -sw);
    const p = (o) => `${num(o.x)},${num(o.y)}`;
    // Walked as an explicit outline: shoulder -> lat -> waist -> hip down the
    // front, then back up the rear. Q curves smooth the lat sweep and the
    // waist only. (An earlier version fed these points to a cubic C, which
    // treats them as CONTROL points -- the outline was dragged into a hook
    // and the torso rendered as an angular kite that swallowed the limbs.)
    const chestL = at(0.27, span.chest * (view === "front" ? 0.31 : 0.38));
    const chestR = at(0.27, -span.chest * (view === "front" ? 0.31 : 0.2));
    const sternum = at(0.34, 0);
    const waistL = at(0.68, span.waist * 0.42);
    const waistR = at(0.68, -span.waist * 0.42);
    return `<g class="fa-torso-shell fa-torso-shell--${view}">
      <path class="fa-torso" d="M${p(L0)}Q${p(L1)} ${p(L2)}L${p(L3)}L${p(R3)}Q${p(R2)} ${p(R1)}L${p(R0)}Z"/>
      <path class="fa-definition fa-definition--chest" d="M${p(chestL)}Q${p(sternum)} ${p(chestR)}"/>
      <path class="fa-definition fa-definition--waist" d="M${p(waistL)}Q${p(at(0.73, 0))} ${p(waistR)}"/>
    </g>`;
  }

  /** Grip abstraction: a rounded mitt, oriented along the forearm. */
  const hand = (x, y, deg = 0) =>
    `<rect class="fa-hand" x="${num(x - P.hand)}" y="${num(y - P.hand * 0.8)}" width="${num(P.hand * 2)}" height="${num(P.hand * 1.6)}" rx="${num(P.hand * 0.7)}" transform="rotate(${num(deg)} ${num(x)} ${num(y)})"/>`;

  /** Foot: wedge, not a line end. */
  const foot = (x, y, facing = 1) => {
    const heel = x - facing * 4.5;
    const toe = x + facing * P.foot;
    return `<path class="fa-foot" d="M${num(heel)},${num(y - 4)}Q${num(x + facing * 1.5)},${num(y - 2.5)} ${num(toe)},${num(y - 1)}L${num(toe)},${num(y + 3)}Q${num(x + facing * 1.5)},${num(y + 4)} ${num(heel)},${num(y + 2.5)}Z"/>`;
  };

  /**
   * Arm chain: upper arm rotates at the shoulder, forearm at the elbow.
   * `depth` selects the near/far plane class, which is the whole depth model
   * (no blur, no glow) -- far limbs sit back via opacity and a darker plane.
   */
  function arm({ shoulder, elbow, wrist, depth = "near", cls = "", gripDeg = 0 }) {
    return `<g class="fa-arm fa-arm--${depth} ${cls}" style="transform-origin:${num(shoulder.x)}px ${num(shoulder.y)}px">
      <path class="fa-limb fa-upperarm" d="${seg(shoulder.x, shoulder.y, elbow.x, elbow.y, P.wUpperArm[0], P.wUpperArm[1])}"/>
      <g class="fa-forearm-group" style="transform-origin:${num(elbow.x)}px ${num(elbow.y)}px">
        <path class="fa-limb fa-forearm" d="${seg(elbow.x, elbow.y, wrist.x, wrist.y, P.wForeArm[0], P.wForeArm[1])}"/>
        ${hand(wrist.x, wrist.y, gripDeg)}
      </g>
    </g>`;
  }

  /** Leg chain: thigh rotates at the hip, shin at the knee. */
  function leg({ hip, knee, ankle, depth = "near", cls = "", facing = 1 }) {
    return `<g class="fa-leg fa-leg--${depth} ${cls}" style="transform-origin:${num(hip.x)}px ${num(hip.y)}px">
      <path class="fa-limb fa-thigh" d="${seg(hip.x, hip.y, knee.x, knee.y, P.wThigh[0], P.wThigh[1])}"/>
      <g class="fa-shin-group" style="transform-origin:${num(knee.x)}px ${num(knee.y)}px">
        <path class="fa-limb fa-shin" d="${seg(knee.x, knee.y, ankle.x, ankle.y, P.wShin[0], P.wShin[1])}"/>
        ${foot(ankle.x, ankle.y, facing)}
      </g>
    </g>`;
  }

  /**
   * Assemble a full athlete from a pose description. Far-side limbs are
   * emitted first so near-side limbs overlap them -- overlapping limbs are
   * the cheapest honest depth cue available in flat vector.
   */
  function athlete(pose) {
    const { pelvis, shoulders, facing = 1, farArm, nearArm, farLeg, nearLeg, cls = "", accent = "" } = pose;
    const neckTop = { x: shoulders.x + facing * 1.5, y: shoulders.y - P.neck };
    return `<g class="fa-athlete ${cls}">
      ${farLeg ? leg({ ...farLeg, depth: "far", facing }) : ""}
      ${farArm ? arm({ ...farArm, depth: "far" }) : ""}
      <g class="fa-body" style="transform-origin:${num(pelvis.x)}px ${num(pelvis.y)}px">
        ${torso(shoulders.x, shoulders.y, pelvis.x, pelvis.y, facing)}
        <path class="fa-limb fa-neck" d="${seg(shoulders.x, shoulders.y, neckTop.x, neckTop.y, 6.4, 5.4)}"/>
        ${head(neckTop.x + facing * 1.5, neckTop.y - P.head * 0.42, facing)}
        ${accent}
      </g>
      ${nearLeg ? leg({ ...nearLeg, depth: "near", facing }) : ""}
      ${nearArm ? arm({ ...nearArm, depth: "near" }) : ""}
    </g>`;
  }

  // --- Equipment primitives (shared language) --------------------------
  const barbell = (cx, y, halfSpan, cls = "") => `
    <g class="fa-equip fa-barbell ${cls}">
      <path class="fa-bar" d="M${num(cx - halfSpan)},${y}H${num(cx + halfSpan)}"/>
      <rect class="fa-plate" x="${num(cx - halfSpan - 13)}" y="${num(y - 21)}" width="11" height="42" rx="3"/>
      <rect class="fa-plate fa-plate--inner" x="${num(cx - halfSpan - 1)}" y="${num(y - 14)}" width="7" height="28" rx="2.5"/>
      <rect class="fa-plate" x="${num(cx + halfSpan + 2)}" y="${num(y - 21)}" width="11" height="42" rx="3"/>
      <rect class="fa-plate fa-plate--inner" x="${num(cx + halfSpan - 6)}" y="${num(y - 14)}" width="7" height="28" rx="2.5"/>
    </g>`;

  const dumbbell = (x, y, deg = 0) => `
    <g class="fa-equip fa-dumbbell" transform="rotate(${deg} ${x} ${y})">
      <path class="fa-bar" d="M${num(x - 11)},${y}H${num(x + 11)}"/>
      <rect class="fa-plate" x="${num(x - 20)}" y="${num(y - 11)}" width="9" height="22" rx="3"/>
      <rect class="fa-plate" x="${num(x + 11)}" y="${num(y - 11)}" width="9" height="22" rx="3"/>
    </g>`;

  /**
   * Loaded barbell seen from the side. Circular plates are what make a
   * barbell instantly identifiable; the rectangular version reads as two
   * blocks on a stick, which is most of why the V4 deadlift was ambiguous.
   */
  const barbellRound = (cx, y, halfSpan, r = 26) => `
    <g class="fa-equip fa-barbell">
      <path class="fa-bar" d="M${num(cx - halfSpan)},${y}H${num(cx + halfSpan)}"/>
      <circle class="fa-plate" cx="${num(cx - halfSpan)}" cy="${y}" r="${r}"/>
      <circle class="fa-plate fa-plate--inner" cx="${num(cx - halfSpan)}" cy="${y}" r="${num(r * 0.42)}"/>
      <circle class="fa-plate" cx="${num(cx + halfSpan)}" cy="${y}" r="${r}"/>
      <circle class="fa-plate fa-plate--inner" cx="${num(cx + halfSpan)}" cy="${y}" r="${num(r * 0.42)}"/>
    </g>`;

  window.FuelPhysiqueAthlete = Object.freeze({
    P, SPANS, seg, project, head, torso, hand, foot, arm, leg, athlete, barbell, barbellRound, dumbbell, num
  });
})();
