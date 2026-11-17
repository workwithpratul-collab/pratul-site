// cameraPath.js: the camera rail, one continuous shot from base camp to the summit.
//
// Scroll progress (0 → 1) drives everything:
//   - the trekker walks along the trail, easing to a stop at every place in journey.js,
//   - the camera rides a smooth curve that follows a few metres behind and above them,
//   - at each stop the camera melts into a hand-placed shot (the opening, each camp's screen,
//     the gear-check mat, the summit), then melts back into following when we walk on.
// Every frame the camera *eases towards* its target instead of jumping there, which is what
// makes the movement feel slow and calm.

import * as THREE from 'three';
import { groundHeight, smoothstep, trailDistanceAt, trailPointAt, trailDirectionAt, TRAIL_LENGTH, legacy } from './terrain.js';
import { CAMPS, MEADOW, SUMMIT, STOPS } from './journey.js';

// Hand-placed shots. pos = where the camera is, look = what it looks at. Heights are
// measured from the ground when the rail is built, so they always fit the land.
const OPENING = { pos: new THREE.Vector3(3.4, 1.7, 9.6), look: new THREE.Vector3(-2.0, 1.55, -2.4) };

// How the follow camera sits relative to the trekker, changing gently along the trail
// (s = metres along the trail). Higher and further back on the open ridge and meadow, so the
// big landscape opens up and the ground near the camera never rushes past.
//   back: metres behind, height: above the ground, side: to the right (three-quarter view),
//   lookAhead: how far ahead of the trekker it looks, lookHeight: ...at about this height
const FOLLOW_KEYS = [
  { s: 0, back: 6.5, height: 2.2, side: 1.5, lookAhead: 5, lookHeight: 1.2 },     // base camp (Phase 1)
  { s: 90, back: 7.5, height: 2.6, side: 1.6, lookAhead: 6, lookHeight: 1.2 },    // the forest climb
  // Leaving DERMAÉ the trail runs round behind its screen, so the camera swaps to the trekker's
  // left (away from the screen) and rises, then moves back to the uphill side on the open ridge.
  { s: 150, back: 8.5, height: 3.6, side: -2.6, lookAhead: 7, lookHeight: 1.1 },
  { s: 176, back: 9.5, height: 4.4, side: -1.6, lookAhead: 6, lookHeight: 1.3 },
  { s: 205, back: 9.5, height: 4.6, side: 2.6, lookAhead: 6.5, lookHeight: 1.3 },   // the open ridge: look down over the trekker
  { s: 330, back: 10, height: 3.8, side: 2.2, lookAhead: 9, lookHeight: 1.2 },    // the meadow
  { s: 425, back: 10, height: 5, side: 2, lookAhead: 5, lookHeight: 1.5 },        // the summit climb: just over the trekker's head
];
function followAt(s) {
  let i = 0;
  while (i < FOLLOW_KEYS.length - 2 && s > FOLLOW_KEYS[i + 1].s) i++;
  const a = FOLLOW_KEYS[i], b = FOLLOW_KEYS[i + 1];
  const t = smoothstep(a.s, b.s, s);
  const out = {};
  for (const k of Object.keys(a)) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

// How quickly the trekker speeds up and slows down between stops (0..0.5 of each walk).
const EASE = 0.35;

export function createCameraPath() {
  const trailLength = TRAIL_LENGTH;   // metres, measured along the trail on the map
  const up = new THREE.Vector3(0, 1, 0);
  const atGround = (x, z, h) => new THREE.Vector3(x, groundHeight(x, z) + h, z);
  OPENING.pos.y = groundHeight(OPENING.pos.x, OPENING.pos.z) + 1.7;

  // ---------- 1. Where each stop is on the trail, and its camera shot ----------
  const campById = Object.fromEntries(CAMPS.map((c) => [c.id, c]));
  const stops = STOPS.map((st) => {
    const stop = { ...st, arrive: st.p, leave: st.p + st.hold };
    if (st.at === 'start') {
      stop.s = trailLength * 0.004;
      stop.shot = { pos: OPENING.pos, look: OPENING.look, blendIn: 0, blendOut: 0.055 };
    } else if (campById[st.at]) {
      const camp = campById[st.at];
      stop.camp = camp;
      stop.s = trailDistanceAt(camp.stop[0], camp.stop[1]);
      stop.shot = {
        pos: atGround(camp.view[0], camp.view[1], 2.1),
        look: atGround(camp.look[0], camp.look[1], 1.9),
        blendIn: camp.blendIn ?? 0.045, blendOut: 0.04,
      };
    } else if (st.at === 'meadow') {
      stop.s = trailDistanceAt(MEADOW.stop[0], MEADOW.stop[1]);
      // Arrive looking down past the trekker at the mat on the grass, then slowly lift the
      // gaze up the slope towards the summit before walking on.
      const summitLook = atGround(SUMMIT.top[0], SUMMIT.top[1], -38);
      const mat = atGround(MEADOW.mat[0], MEADOW.mat[1], 0.15);
      stop.shot = {
        pos: atGround(MEADOW.view[0], MEADOW.view[1], 4.6),
        look: mat,
        look2: mat.clone().lerp(summitLook, 0.2),
        // A short blend-in: the camera spot is on the trail behind the stop, so the shot only
        // takes over once the trekker has walked past it.
        blendIn: 0.03, blendOut: 0.05,
      };
    } else if (st.at === 'summit') {
      stop.s = trailLength - 0.4;
      stop.shot = summitShot();
    }
    return stop;
  });
  const endS = stops[stops.length - 1].s;

  // The last shot: from just below the top, looking past the trekker towards the sunrise.
  // The summit, the trekker and the flag sit right of centre with the sun beyond them, so the
  // left half of the frame (open sky over the sea of clouds) is free for the final words.
  function summitShot() {
    const [tx, tz] = SUMMIT.top;
    const sun = new THREE.Vector3(0.62, 0, -0.78).normalize();   // where the sun rises (sky.js)
    const right = new THREE.Vector3(-sun.z, 0, sun.x);           // to the right of facing the sun
    // Stand 9 m back from the top, 2.5 m to the right of the line to the sun...
    const pos = new THREE.Vector3(tx - sun.x * 9 + right.x * 2.5, groundHeight(tx, tz) + 2.4, tz - sun.z * 9 + right.z * 2.5);
    // ...and look about 24° left of the sun: it sits on the right, the trekker just right of centre.
    const turn = THREE.MathUtils.degToRad(24);
    const dir = sun.clone().applyAxisAngle(up, turn);
    const look = pos.clone().addScaledVector(dir, 40);
    look.y = groundHeight(tx, tz) - 1.5;
    return { pos, look, blendIn: 0.06, blendOut: 0 };
  }

  // ---------- 2. Progress → metres along the trail ----------
  // Between two stops the trekker walks with a gentle start and stop: speed rises steadily,
  // cruises, then falls back to zero (a "trapezoid" of speed, calmer than a plain S-curve).
  function easeWalk(t) {
    const a = EASE, v = 1 / (1 - a);
    if (t < a) return (v * t * t) / (2 * a);
    if (t < 1 - a) return v * (a / 2 + (t - a));
    return 1 - (v * (1 - t) * (1 - t)) / (2 * a);
  }
  function trekkerS(progress) {
    if (progress <= stops[0].leave) return stops[0].s;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      if (progress <= b.arrive) {
        const t = THREE.MathUtils.clamp((progress - a.leave) / (b.arrive - a.leave), 0, 1);
        return a.s + (b.s - a.s) * easeWalk(t);
      }
      if (progress <= b.leave) return b.s;
    }
    return endS;
  }

  // ---------- 3. Build the two rails from the trail ----------
  // camRail: where the camera sits. lookRail: where it looks. Both are sampled every 3 m,
  // then smoothed, so every bend in the trail becomes a soft, wide curve for the camera.
  // A point on the trail d metres from the start; past either end it carries on straight.
  const pointAtDistance = (d, target = new THREE.Vector3()) => {
    trailPointAt(d, target);
    if (d < 0 || d > trailLength) {
      target.addScaledVector(trailDirectionAt(d), d < 0 ? d : d - trailLength);
      target.y = groundHeight(target.x, target.z);
    }
    return target;
  };
  const SAMPLES = Math.round(endS / 3);
  const camPoints = [];
  const lookPoints = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const s = (i / SAMPLES) * endS;
    const f = followAt(s);
    const behind = pointAtDistance(s - f.back);
    const tangent = trailDirectionAt(s - f.back);
    const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
    // The side offset drifts slowly between a little and a lot: a gentle variety of angles.
    const sideAmount = f.side * (0.7 + 0.5 * Math.sin(s * 0.0367));
    const cam = behind.clone().addScaledVector(side, sideAmount);
    cam.y = Math.max(behind.y, groundHeight(cam.x, cam.z)) + f.height;
    camPoints.push(cam);

    const ahead = pointAtDistance(s + f.lookAhead);
    ahead.y = groundHeight(ahead.x, ahead.z) + f.lookHeight;
    lookPoints.push(ahead);
  }
  smoothPoints(camPoints, 4);
  smoothPoints(lookPoints, 6);
  const camRail = new THREE.CatmullRomCurve3(camPoints, false, 'centripetal');
  const lookRail = new THREE.CatmullRomCurve3(lookPoints, false, 'centripetal');

  // A dense list of points along the camera's whole route (rail + every hand-placed shot),
  // so the forest can keep trees out of the way.
  const routePoints = camRail.getSpacedPoints(Math.round(endS)).concat(stops.map((st) => st.shot.pos));
  function routeDistance(x, z) {
    let best = Infinity;
    for (const p of routePoints) {
      const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  // ---------- 4. The camera itself, eased every frame ----------
  const desiredPos = new THREE.Vector3();
  const desiredLook = new THREE.Vector3();
  const shotLook = new THREE.Vector3();
  const lookMatrix = new THREE.Matrix4();
  const desiredQuat = new THREE.Quaternion();

  // How much a stop's shot takes over the camera at this progress (0..1).
  function shotWeight(st, progress) {
    const { blendIn, blendOut } = st.shot;
    const inW = blendIn > 0 ? smoothstep(st.arrive - blendIn, st.arrive, progress) : 1;
    const outW = blendOut > 0 ? 1 - smoothstep(st.leave, st.leave + blendOut, progress) : 1;
    return Math.min(inW, outW);
  }

  function update(camera, progress, dt, snap = false) {
    const s = trekkerS(progress);
    const railT = THREE.MathUtils.clamp(s / endS, 0, 1);
    camRail.getPoint(railT, desiredPos);
    lookRail.getPoint(railT, desiredLook);

    // Melt into the shot of whichever stop we're at (at most one is active at a time).
    for (const st of stops) {
      const w = shotWeight(st, progress);
      if (w <= 0) continue;
      shotLook.copy(st.shot.look);
      if (st.shot.look2) shotLook.lerp(st.shot.look2, smoothstep(st.arrive + st.hold * 0.55, st.leave + 0.03, progress));
      desiredPos.lerp(st.shot.pos, w);
      desiredLook.lerp(shotLook, w);
    }

    // Never dip into the ground.
    desiredPos.y = Math.max(desiredPos.y, groundHeight(desiredPos.x, desiredPos.z) + 1.1);

    // A very slow "breathing" drift, like a hand-held camera on a tripod. Barely noticeable.
    const time = performance.now() / 1000;
    desiredPos.y += Math.sin(time * 0.35) * 0.04;
    desiredPos.x += Math.sin(time * 0.23) * 0.05;

    // Which way to face: build a rotation that looks from desiredPos to desiredLook.
    lookMatrix.lookAt(desiredPos, desiredLook, up);
    desiredQuat.setFromRotationMatrix(lookMatrix);

    if (snap) {
      camera.position.copy(desiredPos);
      camera.quaternion.copy(desiredQuat);
    } else {
      // Ease towards the target. Smaller numbers = lazier, smoother camera.
      const follow = 1 - Math.exp(-dt * 2.6);
      const turn = 1 - Math.exp(-dt * 2.2);
      camera.position.lerp(desiredPos, follow);
      camera.quaternion.slerp(desiredQuat, turn);
    }
    return s;   // metres along the trail where the trekker is
  }

  // Which stop we're at or nearest to (for the trekker's turns and each camp's "near" value).
  function stopInfo(progress) {
    const s = trekkerS(progress);
    return stops.map((st) => ({
      stop: st,
      // 1 while standing at this stop, falling to 0 a few metres away.
      here: 1 - smoothstep(0.4, 6, Math.abs(s - st.s)),
      shot: shotWeight(st, progress),
    }));
  }

  return { update, routeDistance, legacyRouteDistance: buildLegacyRoute(), trekkerS, stopInfo, stops, camRail, lookRail, trailLength };
}

// Average each point with its neighbours a few times: sharp corners become soft curves.
function smoothPoints(points, passes) {
  for (let pass = 0; pass < passes; pass++) {
    const copy = points.map((p) => p.clone());
    for (let i = 1; i < points.length - 1; i++) {
      points[i].copy(copy[i - 1]).add(copy[i]).add(copy[i]).add(copy[i + 1]).multiplyScalar(0.25);
    }
  }
}

// ---------- Phase 1's camera route, rebuilt exactly ----------
// The forest was planted around this route (trees keep a few metres away from where the camera
// goes). Rebuilding it lets forest.js plant base camp's trees exactly as before; the new parts
// of the route then clear their own way (see forest.js).
function buildLegacyRoute() {
  const curve = legacy.trailCurve;
  const length = curve.getLength();
  const F = { back: 6.5, side: 1.5, lookAhead: 5 };
  const END_U = 0.998;
  const up = new THREE.Vector3(0, 1, 0);
  const pointAtDistance = (d) => {
    const u = THREE.MathUtils.clamp(d / length, 0, 1);
    const p = curve.getPointAt(u);
    if (d < 0 || d > length) p.addScaledVector(curve.getTangentAt(u), d < 0 ? d : d - length);
    return p;
  };
  const points = [];
  for (let i = 0; i <= 48; i++) {
    const u = (i / 48) * END_U;
    const s = u * length;
    const behind = pointAtDistance(s - F.back);
    const tangent = curve.getTangentAt(THREE.MathUtils.clamp((s - F.back) / length, 0, 1));
    const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const cam = behind.clone().addScaledVector(side, F.side * (0.7 + 0.5 * Math.sin(u * 5.5)));
    cam.y = Math.max(behind.y, legacy.height(cam.x, cam.z)) + 2.2;
    points.push(cam);
  }
  smoothPoints(points, 4);
  const rail = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const dermae = CAMPS[0];
  const routePoints = rail.getSpacedPoints(300).concat([OPENING.pos, new THREE.Vector3(dermae.view[0], 0, dermae.view[1])]);
  return (x, z) => {
    let best = Infinity;
    for (const p of routePoints) {
      const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };
}
