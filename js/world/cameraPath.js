// cameraPath.js: the camera rail, the one continuous shot from base camp to the ridge camp.
//
// Scroll progress (0 → 1) drives everything:
//   - the trekker walks along the trail (with gentle ease-in / ease-out),
//   - the camera rides a smooth curve that follows a few metres behind and above them,
//   - at the very start and end the camera blends into hand-placed "opening" and "arrival" shots.
// Every frame the camera *eases towards* its target instead of jumping there, which is what
// makes the movement feel slow and calm.

import * as THREE from 'three';
import { groundHeight, smoothstep } from './terrain.js';
import { RIDGE_CAMP, RIDGE_VIEWPOINT } from './camp.js';

// ---------- The story beats, as parts of the scroll (0 = top of page, 1 = bottom) ----------
export const BEATS = {
  walkStart: 0.06,    // the trekker starts walking (before this: the opening shot)
  walkEnd: 0.92,      // the trekker arrives at the ridge camp
};

// Hand-placed shots. pos = where the camera is, look = what it looks at.
const OPENING = { pos: new THREE.Vector3(3.2, 1.7, 9.2), look: new THREE.Vector3(-1.4, 1.25, -2.2) };
// Arrival: standing behind the trekker, looking at the project tent's screen, with the
// snowy range rising beyond it. Heights are measured from the ground, so they always fit.
const ARRIVAL = {
  pos: new THREE.Vector3(RIDGE_VIEWPOINT.x, 0, RIDGE_VIEWPOINT.z),
  look: new THREE.Vector3(RIDGE_CAMP.x - 2.2, 0, RIDGE_CAMP.z + 1),
};

// How the follow camera sits relative to the trekker.
const FOLLOW = {
  back: 6.5,       // metres behind along the trail
  height: 2.2,     // metres above the ground
  side: 1.5,       // metres to the side (three-quarter view)
  lookAhead: 5,    // the camera looks this far ahead of the trekker
  lookHeight: 1.2, // ...at about chest height
};

const TREKKER_END_U = 0.998; // where on the trail (0..1) the trekker stops, next to the ridge camp

export function createCameraPath(trailCurve) {
  const trailLength = trailCurve.getLength();
  ARRIVAL.pos.y = groundHeight(ARRIVAL.pos.x, ARRIVAL.pos.z) + 2.1;
  ARRIVAL.look.y = groundHeight(ARRIVAL.look.x, ARRIVAL.look.z) + 1.9;
  OPENING.pos.y = groundHeight(OPENING.pos.x, OPENING.pos.z) + 1.7;

  // Point on the trail at a distance (metres) from the start; extends straight past the ends.
  const pointAtDistance = (d, target = new THREE.Vector3()) => {
    const u = THREE.MathUtils.clamp(d / trailLength, 0, 1);
    trailCurve.getPointAt(u, target);
    if (d < 0 || d > trailLength) {
      const t = trailCurve.getTangentAt(u);
      target.addScaledVector(t, d < 0 ? d : d - trailLength);
    }
    return target;
  };

  // ---------- Build the two rails from the trail ----------
  // camRail: where the camera sits. lookRail: where it looks. Both are sampled, then smoothed,
  // so every bend in the trail becomes a soft, wide curve for the camera.
  const SAMPLES = 48;
  const camPoints = [];
  const lookPoints = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= SAMPLES; i++) {
    const u = (i / SAMPLES) * TREKKER_END_U;
    const s = u * trailLength;
    const behind = pointAtDistance(s - FOLLOW.back);
    const tangent = trailCurve.getTangentAt(THREE.MathUtils.clamp((s - FOLLOW.back) / trailLength, 0, 1));
    const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
    // The side offset drifts slowly from one side to the other: a gentle variety of angles.
    const sideAmount = FOLLOW.side * (0.7 + 0.5 * Math.sin(u * 5.5));
    const cam = behind.clone().addScaledVector(side, sideAmount);
    cam.y = Math.max(behind.y, groundHeight(cam.x, cam.z)) + FOLLOW.height;
    camPoints.push(cam);

    const ahead = pointAtDistance(s + FOLLOW.lookAhead);
    ahead.y = groundHeight(ahead.x, ahead.z) + FOLLOW.lookHeight;
    lookPoints.push(ahead);
  }
  smoothPoints(camPoints, 4);
  smoothPoints(lookPoints, 6);
  const camRail = new THREE.CatmullRomCurve3(camPoints, false, 'centripetal');
  const lookRail = new THREE.CatmullRomCurve3(lookPoints, false, 'centripetal');

  // A dense list of points along the camera's whole route (rail + opening + arrival),
  // so the forest can keep trees out of the way.
  const routePoints = camRail.getSpacedPoints(300).concat([OPENING.pos, ARRIVAL.pos]);
  function avoid(x, z) {
    for (const p of routePoints) {
      if ((p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < 5.5 * 5.5) return true;
    }
    return false;
  }

  // ---------- Progress → trekker position on the trail (0..1) ----------
  function trekkerU(progress) {
    const t = THREE.MathUtils.clamp((progress - BEATS.walkStart) / (BEATS.walkEnd - BEATS.walkStart), 0, 1);
    // Ease in and out: start walking slowly, stop slowly.
    const eased = t * t * (3 - 2 * t);
    return 0.004 + eased * (TREKKER_END_U - 0.004);
  }

  // ---------- The camera itself, eased every frame ----------
  const desiredPos = new THREE.Vector3();
  const desiredLook = new THREE.Vector3();
  const followPos = new THREE.Vector3();
  const followLook = new THREE.Vector3();
  const lookMatrix = new THREE.Matrix4();
  const desiredQuat = new THREE.Quaternion();

  function update(camera, progress, dt, snap = false) {
    const u = trekkerU(progress);
    const railT = THREE.MathUtils.clamp(u / TREKKER_END_U, 0, 1);
    camRail.getPoint(railT, followPos);
    lookRail.getPoint(railT, followLook);

    // Blend: opening shot → follow camera → arrival shot.
    const opening = 1 - smoothstep(0.015, BEATS.walkStart + 0.1, progress);
    const arrival = smoothstep(BEATS.walkEnd - 0.07, 0.995, progress);
    desiredPos.copy(followPos).lerp(OPENING.pos, opening).lerp(ARRIVAL.pos, arrival);
    desiredLook.copy(followLook).lerp(OPENING.look, opening).lerp(ARRIVAL.look, arrival);

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
    return u;
  }

  return { update, avoid, trekkerU, camRail, lookRail };
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
