// ridge.js: scene 2, the ridge trail at pre-dawn (everything except the camps themselves).
//
// The grassy ridge runs east along the valley rim: grass tufts along the path, stones in
// four different shapes, a few soft trees around the camps, and mist gathering low in the
// valley below, so the snowy range across the valley rises out of it in painted layers.

import * as THREE from 'three';
import { groundHeight, trailPointAt, trailDirectionAt, trailDistanceAt, seededRandom } from './terrain.js';
import { createNearTrees, createStoneVariety } from './forest.js';
import { makeMistMaterial } from './mist.js';
import { createGrass, RIDGE_GRASS } from './grass.js';
import { CAMPS } from './journey.js';

export function createRidge(scene) {
  const rand = seededRandom(717);
  const [, kingsGarden, trinetra] = CAMPS;
  // Nothing grows right under a screen and its tent, or right in front of a camera spot.
  const nearCamp = (x, z) => CAMPS.slice(1).some((c) => Math.hypot(x - c.sheet[0], z - c.sheet[1]) < 4.5 || Math.hypot(x - c.view[0], z - c.view[1]) < 5);

  // ---------- Grass along the ridge, from just past DERMAÉ to where the meadow begins ----------
  const ridgeStart = trailDistanceAt(4, -164);
  const meadowStart = trailDistanceAt(152, -208);
  createGrass(scene, { from: ridgeStart, to: meadowStart, width: 18, perMetre: 110, colors: RIDGE_GRASS, seed: 21, skip: nearCamp });

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

  // ---------- A few soft trees around the camps ----------
  // Trinetra stands on a knoll among a small group of pines (behind its screen, never in front).
  // King's Garden has only a lone pine and an oak on the slope below it: its backdrop is the valley.
  const tree = (x, z, scale, tint = 1) => ({ x, z, y: groundHeight(x, z), scale, rot: rand() * 6.28, tint: tint * (0.92 + rand() * 0.14) });
  const [tx, tz] = trinetra.sheet;
  createNearTrees(scene, {
    pine: [
      tree(tx + 4.5, tz + 6, 6.5), tree(tx - 2.5, tz + 7.5, 7.5), tree(tx + 8.5, tz + 2, 5.5),
      tree(tx - 6.5, tz + 4.5, 5), tree(tx + 1.5, tz + 11, 8.5, 0.95),
      tree(kingsGarden.sheet[0] - 9, kingsGarden.sheet[1] - 4, 5.5),
    ],
    oak: [tree(kingsGarden.sheet[0] + 10, kingsGarden.sheet[1] - 6, 4.2)],
  });

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
