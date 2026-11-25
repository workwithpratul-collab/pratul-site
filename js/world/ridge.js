// ridge.js: scene 2, the ridge trail at pre-dawn (everything except the camps themselves).
//
// The grassy ridge runs east along the valley rim: grass tufts along the path, stones in
// four different shapes, a few soft trees around the camps, and mist gathering low in the
// valley below, so the snowy range across the valley rises out of it in painted layers.

import * as THREE from 'three';
import { groundHeight, trailPointAt, trailDirectionAt, trailDistanceAt, nearestTrail, seededRandom } from './terrain.js';
import { createNearTrees, createStoneVariety } from './forest.js';
import { makeMistMaterial } from './mist.js';
import { createGrass, RIDGE_GRASS } from './grass.js';
import { CAMPS } from './journey.js';

// How far (x, z) is from the straight line between points a and b (on the map).
function toSegment(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.min(Math.max(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0), 1);
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
}

// pause (optional): an async function called between the pieces (see createGrass).
export async function createRidge(scene, { pause = null } = {}) {
  const rand = seededRandom(717);
  const [, kingsGarden, trinetra] = CAMPS;
  // Nothing grows right under a screen and its tent, or right in front of a camera spot.
  const nearCamp = (x, z) => CAMPS.slice(1).some((c) => Math.hypot(x - c.screen[0], z - c.screen[1]) < 5.5 || Math.hypot(x - c.view[0], z - c.view[1]) < 3);

  // ---------- Grass along the ridge, from just past DERMAÉ to where the meadow begins ----------
  const ridgeStart = trailDistanceAt(4, -164);
  const meadowStart = trailDistanceAt(152, -208);
  createGrass(scene, { from: ridgeStart, to: meadowStart, width: 26, perMetre: 150, colors: RIDGE_GRASS, seed: 21, skip: nearCamp, pause });
  if (pause) await pause();

  // ---------- Stones: small clusters beside the path, each a mix of shapes ----------
  const stones = [];
  const p = new THREE.Vector3(), dir = new THREE.Vector3();
  for (let along = ridgeStart + 12; along < meadowStart; along += 14 + rand() * 12) {
    trailPointAt(along, p);
    trailDirectionAt(along, dir);
    const side = rand() < 0.55 ? 1 : -1;
    const off = side * (4 + rand() * 9);
    const cx = p.x - dir.z * off, cz = p.z + dir.x * off;
    if (nearCamp(cx, cz)) continue;
    const n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const x = cx + (rand() - 0.5) * 3, z = cz + (rand() - 0.5) * 3;
      stones.push({ x, z, s: (i === 0 ? 0.55 : 0.25) + rand() * 0.45 });
    }
  }
  // A couple of bigger boulders on the valley side near King's Garden, framing its view.
  stones.push({ x: 33, z: -189, s: 1.1, shape: 0 }, { x: 34.6, z: -189.6, s: 0.5, shape: 3 });
  stones.push({ x: 49, z: -186, s: 0.8, shape: 1 });
  createStoneVariety(scene, stones, rand);
  if (pause) await pause();

  const tree = (x, z, scale, tint = 1) => ({ x, z, y: groundHeight(x, z), scale, rot: rand() * 6.28, tint: tint * (0.92 + rand() * 0.14) });

  // ---------- The hillside above the path: loose groups of pines, and low bushes by the path ----------
  // So the slope above the trail (behind THE KING'S GARDEN and between the landmarks) is never a
  // big empty pale lawn. Nothing grows in a landmark's view: between the camera spot and its
  // screen, or close round the screen.
  const inView = (x, z) => CAMPS.some((c) => Math.hypot(x - c.screen[0], z - c.screen[1]) < 9 || toSegment(x, z, c.view, c.screen) < 6);
  const hillside = { pine: [], oak: [] };
  // (from a little before the ridge proper: the climb out of DERMAÉ's hollow has open slopes too)
  for (let along = ridgeStart - 40; along < meadowStart - 10; along += 8 + rand() * 9) {
    trailPointAt(along, p);
    trailDirectionAt(along, dir);
    const nx = -dir.z, nz = dir.x;   // sideways from the path
    // Which side is uphill?
    const up = groundHeight(p.x + nx * 14, p.z + nz * 14) > groundHeight(p.x - nx * 14, p.z - nz * 14) ? 1 : -1;
    // A group of one to four pines on the slope above.
    const off = up * (11 + rand() * 26);
    const cx = p.x + nx * off, cz = p.z + nz * off;
    const n = 1 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const x = cx + (rand() - 0.5) * 8, z = cz + (rand() - 0.5) * 8;
      // (9 m clear of the path: the camera never strays more than ~2 m from it)
      if (inView(x, z) || nearestTrail(x, z).distance < 9) continue;
      hillside.pine.push(tree(x, z, 4.2 + rand() * 4.5, 0.9 + rand() * 0.15));
    }
    // Now and then a low bush close to the path (a small oak), on either side.
    if (rand() < 0.55) {
      const side = (rand() < 0.5 ? 1 : -1) * (5 + rand() * 8);
      const x = p.x + nx * side, z = p.z + nz * side;
      if (!inView(x, z) && !nearCamp(x, z) && nearestTrail(x, z).distance > 4) hillside.oak.push(tree(x, z, 1.4 + rand() * 1.0, 0.95));
    }
  }

  // The rounded hilltop inside the trail's bend after DERMAÉ (the uphill test above can't see it:
  // it's on the inside of the curve): a loose group of pines, which also backs the lake's view.
  for (const [x, z, s] of [[16, -156, 6], [20, -150, 7.5], [22, -159, 5.5], [26, -153, 8], [24, -146, 6.5], [13.5, -155, 4.6], [29, -159, 6],
    [18, -160.5, 5.2], [21, -163, 6.8], [24.5, -164.5, 4.8], [27, -161, 7.4]]) {
    if (!inView(x, z)) hillside.pine.push(tree(x, z, s, 0.92 + rand() * 0.1));
  }

  // ---------- A few soft trees around the camps ----------
  // Trinetra stands on a knoll among a small group of pines (behind its screen, never in front).
  // King's Garden has only a lone pine and an oak on the slope below it: its backdrop is the valley.
  const [tx, tz] = trinetra.screen;
  createNearTrees(scene, {
    pine: [
      tree(tx + 4.5, tz + 6, 6.5), tree(tx - 2.5, tz + 7.5, 7.5), tree(tx + 8.5, tz + 2, 5.5),
      tree(tx - 6.5, tz + 4.5, 5), tree(tx + 1.5, tz + 11, 8.5, 0.95),
      tree(kingsGarden.screen[0] - 9, kingsGarden.screen[1] - 4, 5.5),
      ...hillside.pine,
    ],
    oak: [tree(kingsGarden.screen[0] + 10, kingsGarden.screen[1] - 6, 4.2), ...hillside.oak],
  });

  if (pause) await pause();

  // ---------- Mist in the valley below the rim ----------
  // Long soft strips hanging along the valley side, below the path: seen from the ridge they
  // fill the gap between the near slope and the far range with pale vapour.
  const strips = [
    { from: [-20, -212], to: [90, -222], bottom: -6, height: 16, seed: 2.7 },
    { from: [60, -222], to: [170, -232], bottom: -2, height: 18, seed: 5.3 },
  ];
  for (const s of strips) {
    const geo = new THREE.PlaneGeometry(1, 1, 60, 1);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const t = pos.getX(k) + 0.5;                 // 0..1 along the strip
      const up = (pos.getY(k) + 0.5) * s.height;   // 0..height
      pos.setXYZ(k, s.from[0] + (s.to[0] - s.from[0]) * t, s.bottom + up, s.from[1] + (s.to[1] - s.from[1]) * t);
    }
    const strip = new THREE.Mesh(geo, makeMistMaterial({ opacity: 0.55, scale: [14, 1.3], speed: 0.012, softness: [0.36, 0.64], nearFade: [20, 60], seed: s.seed }));
    strip.name = 'ridge-mist';
    scene.add(strip);
  }
}
