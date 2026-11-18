// meadow.js: scene 3, the alpine meadow at first light (style-frame version).
//
// Rolling grassland that falls away to a misty valley, distant peaks catching the first sun,
// scattered wildflowers and stones, a few soft trees, and a faint trail the trekker walks.
// Built from the same pieces as base camp (sky, painted mountains, mist, painted trees and
// stones, the trekker) so the style stays one world. Colours come from palette.js
// (the "firstLight" preset).
//
// This is a style frame: enough to judge colour, light and mood, not the finished scene.

import * as THREE from 'three';
import { createSky } from './sky.js';
import { createMountains, noise2, smoothstep, seededRandom, groundHeight, nearestTrail, trailDistanceAt } from './terrain.js';
import { createNearTrees, createStones, createStoneVariety, setWarmLights } from './forest.js';
import { createGrass, MEADOW_GRASS } from './grass.js';
import { MEADOW } from './journey.js';
import { makeMistMaterial } from './mist.js';
import { createTrekker } from './trekker.js';
import { mood, MATERIALS } from './palette.js';

// The sun sits low on the right of the view; the camera looks out towards the valley (-Z).
const SUN_DIR = new THREE.Vector3(0.36, 0.1, -0.93).normalize();

// The camera for the style frame, and where the trekker stands (small in the frame).
export const MEADOW_SHOT = {
  pos: new THREE.Vector3(-7, 0, 30),        // y is set from the ground (+ eye height)
  look: new THREE.Vector3(10, 0, -90),
  trekker: { x: 1.5, z: 6, heading: Math.PI * 0.93 },
};

// ---------- The shape of the land ----------
// Rolling hills in receding rows, like the layered ridges of a painting: each row a
// little lower and (with the fog) a little paler than the one in front. The slopes rise
// on both sides, so the eye is led down the middle to the peaks.
export function meadowHeight(x, z) {
  const d = Math.max(-z, 0);                             // distance out from where we stand
  let y = 0;
  // Rows of soft swells running across the view (waves in z, wobbled by noise in x).
  y += Math.sin(z * 0.032 + noise2(x * 0.006, 0.5, 51) * 5) * 5 * smoothstep(-10, -80, z);
  y += (noise2(x * 0.011, z * 0.011, 41) - 0.5) * 16;    // big, slow rolls
  y += (noise2(x * 0.034, z * 0.034, 43) - 0.5) * 4;     // smaller swells
  y += (noise2(x * 0.11, z * 0.11, 47) - 0.5) * 0.8;     // a little unevenness underfoot
  y -= 0.1 * d - 0.00006 * d * d;                        // the meadow rolls gently away from us
  y += 40 * smoothstep(90, 320, Math.abs(x)) * smoothstep(-40, -200, z);  // hillsides left and right
  return y;
}

// The faint trodden trail, drawn as a map from above (it fades into the distance).
const TRAIL = [[-4, 34], [-2, 22], [1.2, 10], [1.8, 2], [0, -14], [-5, -32], [-3, -52], [5, -72], [10, -96], [8, -124]];

export function createMeadow(scene, { renderer, camera }) {
  // ---------- Sky, light and fog (from the palette's current mood) ----------
  const sky = createSky(scene, {
    glowDir: new THREE.Vector3(SUN_DIR.x, 0, SUN_DIR.z),
    sunDir: SUN_DIR,
    sunLightDir: new THREE.Vector3(SUN_DIR.x, 0.42, SUN_DIR.z),   // light from a little higher: gold on the grass
  });
  setWarmLights();   // no tents here: no warm tent glow on the trees

  // ---------- Distant ranges: the same painted mountains as base camp, lit from the right ----------
  const mountains = createMountains(scene);
  mountains.userData.setLitSide(-1);

  // ---------- The ground ----------
  scene.add(buildGround());
  scene.add(buildTrail());

  // ---------- Grass tufts and wildflowers near the camera ----------
  const rand = seededRandom(512);
  scene.add(buildGrass(rand));
  scene.add(buildFlowers(rand));

  // ---------- Stones: a few clusters, like boulders left in the grass ----------
  const stones = [];
  const clusters = [[-16, 4], [12, 14], [24, -20], [-26, -30], [6, -46], [-12, 18], [30, 6]];
  for (const [cx, cz] of clusters) {
    const n = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const x = cx + (rand() - 0.5) * 5, z = cz + (rand() - 0.5) * 5;
      stones.push({ x, z, y: meadowHeight(x, z), s: (i === 0 ? 0.9 : 0.35) + rand() * 0.5 });
    }
  }
  createStones(scene, stones, rand);

  // ---------- A few soft trees: a small group on a knoll, and a lone pine ----------
  const tree = (x, z, scale) => ({ x, z, y: meadowHeight(x, z), scale, rot: rand() * 6.28, tint: 0.92 + rand() * 0.14 });
  createNearTrees(scene, {
    pine: [tree(-38, -40, 11), tree(-44, -48, 8), tree(-33, -52, 9.5), tree(46, -70, 10), tree(52, -64, 7), tree(-60, -20, 12)],
    oak: [tree(-28, -36, 6), tree(40, -60, 6.5)],
  });

  // ---------- Mist: a soft sheet filling the valley, and a band in front of the far ranges ----------
  const valleyMist = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 500).rotateX(-Math.PI / 2),
    makeMistMaterial({ opacity: 0.55, scale: [7, 3], speed: 0.006, softness: [0.36, 0.66], nearFade: [40, 120], seed: 2.2 }),
  );
  valleyMist.position.set(0, -26, -470);
  scene.add(valleyMist);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(700, 700, 120, 96, 1, true, -Math.PI * 0.6, Math.PI * 1.2),
    makeMistMaterial({ opacity: 0.6, scale: [24, 1.2], speed: 0.004, softness: [0.32, 0.66], nearFade: [0, 1], seed: 6.1 }),
  );
  band.position.set(0, 10, -80);
  band.rotation.y = Math.PI;
  scene.add(band);

  // ---------- The trekker, small in the frame, walking towards the peaks ----------
  const trekker = createTrekker(scene, renderer, camera);
  const t = MEADOW_SHOT.trekker;
  trekker.ready.then(() => trekker.place(t.x, t.z, t.heading, meadowHeight(t.x, t.z))).catch(() => {});

  // ---------- The camera ----------
  const pos = MEADOW_SHOT.pos.clone();
  pos.y = meadowHeight(pos.x, pos.z) + 3.4;
  const look = MEADOW_SHOT.look.clone();
  look.y = meadowHeight(pos.x, pos.z) + 1;   // eye level, so the sky gets the top third
  camera.position.copy(pos);
  camera.lookAt(look);

  function update(dt, time) {
    sky.applyMood();
    mountains.userData.applyMood();
    trekker.setLightLevel(mood.character.level, mood.character.tint);
    sky.update(time, camera, renderer.getPixelRatio());
    trekker.update(dt, time);
  }
  return { update, ready: trekker.ready, sky };
}

// =====================================================================
// Ground: painted patches of grass, lit by the low sun
// =====================================================================
function buildGround() {
  const W = 900, D = 760, segX = 420, segZ = 380;
  const geo = new THREE.PlaneGeometry(W, D, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 60 - D / 2);    // from z = +60 (behind us) out to z = -700
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const deep = new THREE.Color(MATERIALS.meadow.grassDeep);
  const grass = new THREE.Color(MATERIALS.meadow.grass);
  const lit = new THREE.Color(MATERIALS.meadow.grassLit);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, meadowHeight(x, z));
    // Brush-stroke patches: noise stretched sideways, like strokes laid across a hillside.
    const stroke = noise2(x * 0.018, z * 0.055, 61);
    const fine = noise2(x * 0.09, z * 0.2, 67);
    c.copy(grass).lerp(deep, smoothstep(0.55, 0.8, stroke));
    c.lerp(lit, smoothstep(0.5, 0.85, (1 - stroke) * 0.6 + fine * 0.4) * 0.8);
    c.multiplyScalar(0.95 + fine * 0.1);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.color = mood.ground;       // the palette's warm first-light tint
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'meadow-ground';
  return mesh;
}

// A faint trodden path with soft edges (same idea as the base camp trail).
function buildTrail() {
  const curve = new THREE.CatmullRomCurve3(TRAIL.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const steps = 400, across = [-1, -0.5, 0, 0.5, 1], alpha = [0, 0.7, 0.85, 0.7, 0];
  const positions = [], colors = [], indices = [];
  const p = new THREE.Vector3(), tan = new THREE.Vector3();
  const col = new THREE.Color(MATERIALS.ground.pathLit);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, tan);
    const sx = -tan.z, sz = tan.x;
    const w = 0.7 * (0.8 + noise2(u * 30, 0.5, 9) * 0.4) * (1 - u * 0.5);
    across.forEach((a, k) => {
      const x = p.x + sx * a * w, z = p.z + sz * a * w;
      positions.push(x, meadowHeight(x, z) + 0.04, z);
      colors.push(col.r, col.g, col.b, alpha[k] * (1 - smoothstep(0.7, 1, u)));
    });
    if (i < steps) {
      const a = i * 5, b = (i + 1) * 5;
      for (let k = 0; k < 4; k++) indices.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  mat.color = mood.ground;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  return mesh;
}

// =====================================================================
// Grass tufts: three thin blades each, thousands of copies in one draw call.
// Their normals point straight up, so they shade exactly like the ground they grow from
// (no dark sides, no flicker): they add texture, not contrast.
// =====================================================================
function buildGrass(rand) {
  const blade = (angle, lean, h) => {
    const g = new THREE.BufferGeometry();
    const dx = Math.cos(angle) * 0.05, dz = Math.sin(angle) * 0.05;
    const tx = Math.cos(angle + 1.57) * lean, tz = Math.sin(angle + 1.57) * lean;
    // Each blade twice, once per winding, so both faces get the same "up" normal and light.
    g.setAttribute('position', new THREE.Float32BufferAttribute([-dx, 0, -dz, dx, 0, dz, tx, h, tz, dx, 0, dz, -dx, 0, -dz, tx, h, tz], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(18).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    return g;
  };
  const parts = [blade(0, 0.12, 1), blade(2.1, -0.18, 0.8), blade(4.2, 0.1, 0.9)];
  const merged = new THREE.BufferGeometry();
  const pos = [], nor = [];
  for (const p of parts) { pos.push(...p.attributes.position.array); nor.push(...p.attributes.normal.array); }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));

  const mat = new THREE.MeshLambertMaterial();
  mat.color = mood.ground;
  const COUNT = 16000;
  const mesh = new THREE.InstancedMesh(merged, mat, COUNT);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const grass = new THREE.Color(MATERIALS.meadow.grass), lit = new THREE.Color(MATERIALS.meadow.grassLit);
  const deep = new THREE.Color(MATERIALS.meadow.grassDeep), c = new THREE.Color();
  let n = 0;
  for (let tries = 0; tries < COUNT * 4 && n < COUNT; tries++) {
    // Spread in front of the camera, denser close by.
    const x = (rand() - 0.5) * 160;
    const z = 22 - Math.pow(rand(), 1.3) * 120;
    if (noise2(x * 0.08, z * 0.08, 71) < 0.4) continue;        // in clumps, with gaps
    const h = 0.22 + rand() * 0.3;
    p.set(x, meadowHeight(x, z) - 0.02, z);
    q.setFromAxisAngle(up, rand() * 6.28);
    s.set(0.7 + rand() * 0.4, h, 0.7 + rand() * 0.4);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    // Close to the ground's own colours, a touch lighter at random: texture, not contrast.
    c.copy(grass).lerp(rand() < 0.6 ? lit : deep, rand() * 0.5);
    mesh.setColorAt(n, c);
    n++;
  }
  mesh.count = n;
  mesh.name = 'grass';
  return mesh;
}

// =====================================================================
// Wildflowers: soft pastel dots in drifts (gold, rose, lilac, white), never neon.
// =====================================================================
function buildFlowers(rand) {
  const geo = new THREE.IcosahedronGeometry(0.05, 1);
  geo.scale(1, 0.7, 1);
  // Normals point up, like the grass, so the flowers take the same soft light.
  const nor = geo.attributes.normal;
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0);
  const mat = new THREE.MeshLambertMaterial();
  mat.color = mood.ground;
  const COUNT = 5000;
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  const palette = MATERIALS.meadow.flowers.map((h) => new THREE.Color(h));
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion();
  let n = 0;
  for (let tries = 0; tries < COUNT * 6 && n < COUNT; tries++) {
    const x = (rand() - 0.5) * 180;
    const z = 20 - Math.pow(rand(), 1.1) * 150;
    // Flowers grow in drifts: each drift is mostly one colour.
    const drift = noise2(x * 0.05, z * 0.05, 81);
    if (drift < 0.55) continue;
    const kind = Math.floor(noise2(x * 0.02, z * 0.02, 83) * 4.99) % 4;
    p.set(x, meadowHeight(x, z) + 0.18 + rand() * 0.2, z);
    const k = 0.6 + rand() * 0.6;
    s.set(k, k, k);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    mesh.setColorAt(n, rand() < 0.85 ? palette[kind] : palette[3]);
    n++;
  }
  mesh.count = n;
  mesh.name = 'wildflowers';
  return mesh;
}

// =====================================================================
// THE MEADOW IN THE FILM (scene 3)
// =====================================================================
// The style frame above builds its own little world. In the film, the meadow is part of the
// one continuous landscape (terrain.js shapes the broad, rolling shelf), and this adds what
// grows and lies on it: alpine grass and drifts of wildflowers, a few soft trees, stones in
// four shapes, mist in the valley below, and the gear-check mat (a placeholder until Phase 4).
export function createMeadowZone(scene) {
  const rand = seededRandom(4242);
  const [mx, mz] = MEADOW.mat;
  // Nothing grows on the mat or right around the camera spot (grass would fill the close shot).
  const nearMat = (x, z) => Math.hypot(x - mx, z - mz) < 1.4 || Math.hypot(x - MEADOW.view[0], z - MEADOW.view[1]) < 2.5;

  // ---------- Grass and wildflowers, from the end of the ridge to the snow line ----------
  const start = trailDistanceAt(149, -200);
  const snow = trailDistanceAt(185, -284);
  createGrass(scene, {
    from: start, to: snow, width: 42, perMetre: 300, flowers: 70, colors: MEADOW_GRASS, seed: 33,
    // Nothing grows on the mat, under the camera, or up in the snow.
    skip: (x, z) => nearMat(x, z) || groundHeight(x, z) > 62,
  });

  // ---------- A few soft trees: a group on the knoll to the right, a lone pine on the left ----------
  const tree = (x, z, scale) => ({ x, z, y: groundHeight(x, z), scale, rot: rand() * 6.28, tint: 0.92 + rand() * 0.14 });
  createNearTrees(scene, {
    pine: [tree(186, -246, 9), tree(191, -239, 7), tree(184, -233, 10.5), tree(193, -252, 6.5), tree(136, -254, 8.5), tree(141, -262, 6)],
    oak: [tree(178, -229, 5.5), tree(181, -258, 4.8), tree(134, -230, 5)],
  });

  // ---------- Stones: clusters in the grass, each a mix of shapes ----------
  const stones = [];
  for (const [cx, cz] of [[171, -238], [150, -226], [175, -264], [146, -248], [168, -216], [156, -270], [190, -262]]) {
    const n = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const x = cx + (rand() - 0.5) * 5, z = cz + (rand() - 0.5) * 5;
      if (nearMat(x, z) || nearestTrail(x, z).distance < 2.2) continue;
      stones.push({ x, z, s: (i === 0 ? 0.8 : 0.3) + rand() * 0.5 });
    }
  }
  createStoneVariety(scene, stones, rand);

  // ---------- Mist: soft bands in the valley below the meadow's western edge ----------
  for (const s of [
    { from: [118, -196], to: [104, -300], bottom: 8, height: 20, seed: 3.9 },
    { from: [96, -250], to: [112, -360], bottom: 0, height: 26, seed: 7.7 },
  ]) {
    const geo = new THREE.PlaneGeometry(1, 1, 60, 1);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const t = pos.getX(k) + 0.5, up = (pos.getY(k) + 0.5) * s.height;
      pos.setXYZ(k, s.from[0] + (s.to[0] - s.from[0]) * t, s.bottom + up, s.from[1] + (s.to[1] - s.from[1]) * t);
    }
    const strip = new THREE.Mesh(geo, makeMistMaterial({ opacity: 0.5, scale: [12, 1.3], speed: 0.01, softness: [0.36, 0.64], nearFade: [25, 70], seed: s.seed }));
    strip.name = 'meadow-mist';
    scene.add(strip);
  }

  // (The gear check itself, the kit on its canvas mat, is built by gear.js.)
}
