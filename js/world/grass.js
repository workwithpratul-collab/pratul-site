// grass.js: grass tufts and wildflowers along the trail, so the open ground is never flat.
//
// A tuft is three thin blades. Thousands of tufts share one shape and one material
// (instancing), and they are planted in chunks of trail about 30 m long, so three.js can
// skip the chunks the camera can't see.
//
// The blades' normals point straight up, so they shade exactly like the ground they grow
// from (no dark sides, no flicker): they add texture, not contrast. Colours come from
// palette.js and are tinted by the time of day like the ground.

import * as THREE from 'three';
import { groundHeight, trailPointAt, trailDirectionAt, noise2, seededRandom } from './terrain.js';
import { mood, MATERIALS } from './palette.js';
import { addWind } from './glsl.js';

const CHUNK_LENGTH = 30;   // metres of trail per chunk

// One tuft: three blades leaning out from the middle, each drawn twice (once per side) so
// both faces get the same "up" normal and the same light.
function tuftGeometry() {
  const pos = [];
  const blade = (angle, lean, h) => {
    const dx = Math.cos(angle) * 0.05, dz = Math.sin(angle) * 0.05;
    const tx = Math.cos(angle + 1.57) * lean, tz = Math.sin(angle + 1.57) * lean;
    pos.push(-dx, 0, -dz, dx, 0, dz, tx, h, tz, dx, 0, dz, -dx, 0, -dz, tx, h, tz);
  };
  blade(0, 0.12, 1);
  blade(2.1, -0.18, 0.8);
  blade(4.2, 0.1, 0.9);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return geo;
}

// A wildflower: a small soft dot held just above the grass (normals up, like the blades).
function flowerGeometry() {
  const geo = new THREE.IcosahedronGeometry(0.05, 1);
  geo.scale(1, 0.7, 1);
  const nor = geo.attributes.normal;
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0);
  return geo;
}

let sharedTuft = null, sharedFlower = null, sharedMaterial = null, sharedBloomMaterial = null;
// Blades bend in the wind from the root; flowers sway as a whole (glsl.js, addWind).
function materials() {
  if (!sharedMaterial) {
    sharedMaterial = addWind(new THREE.MeshLambertMaterial());
    sharedMaterial.color = mood.ground;   // the time-of-day tint, like the ground itself
    sharedBloomMaterial = addWind(new THREE.MeshLambertMaterial(), { bloom: true });
    sharedBloomMaterial.color = mood.ground;
  }
}

// Plant grass (and optionally flowers) along the trail between `from` and `to` metres.
//   width:    how far either side of the trail the grass reaches (metres)
//   perMetre: tufts per metre of trail (most of them close to the path)
//   colors:   { base, lit, deep } hex colours from palette.js
//   flowers:  wildflowers per metre of trail (0 = none), in drifts of one colour
//   skip(x, z): optional, return true where nothing should grow (e.g. under a tent)
export function createGrass(scene, { from, to, width = 20, perMetre = 120, colors, flowers = 0, seed = 1, skip }) {
  sharedTuft ??= tuftGeometry();
  sharedFlower ??= flowerGeometry();
  materials();
  const base = new THREE.Color(colors.base), lit = new THREE.Color(colors.lit), deep = new THREE.Color(colors.deep);
  const petals = MATERIALS.meadow.flowers.map((h) => new THREE.Color(h));
  const rand = seededRandom(seed);
  const group = new THREE.Group();
  group.name = 'grass';
  const p = new THREE.Vector3(), dir = new THREE.Vector3();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();

  for (let start = from; start < to; start += CHUNK_LENGTH) {
    const end = Math.min(start + CHUNK_LENGTH, to);
    const tufts = [], blooms = [];
    const count = Math.round((end - start) * perMetre);
    for (let i = 0; i < count; i++) {
      const along = start + rand() * (end - start);
      // Most tufts grow near the path's edges, thinning out further away.
      const off = (1.1 + Math.pow(rand(), 1.8) * width) * (rand() < 0.5 ? -1 : 1);
      trailPointAt(along, p);
      trailDirectionAt(along, dir);
      const x = p.x - dir.z * off, z = p.z + dir.x * off;
      if (skip?.(x, z)) continue;
      // Grass grows in clumps with gaps between them, like a real hillside.
      if (noise2(x * 0.08, z * 0.08, 71) < 0.38) continue;
      tufts.push({ x, z, y: groundHeight(x, z), h: 0.2 + rand() * 0.3 * (1 - Math.abs(off) / (width * 1.6)) });
    }
    const flowerCount = Math.round((end - start) * flowers);
    for (let i = 0; i < flowerCount * 3 && blooms.length < flowerCount; i++) {
      const along = start + rand() * (end - start);
      const off = (1.3 + Math.pow(rand(), 1.3) * width) * (rand() < 0.5 ? -1 : 1);
      trailPointAt(along, p);
      trailDirectionAt(along, dir);
      const x = p.x - dir.z * off, z = p.z + dir.x * off;
      // Flowers grow in drifts: each drift is mostly one colour.
      if (noise2(x * 0.05, z * 0.05, 81) < 0.55 || skip?.(x, z)) continue;
      const kind = Math.floor(noise2(x * 0.02, z * 0.02, 83) * 4.99) % 4;
      blooms.push({ x, z, y: groundHeight(x, z), colour: rand() < 0.85 ? petals[kind] : petals[3] });
    }

    if (tufts.length) {
      const mesh = new THREE.InstancedMesh(sharedTuft, sharedMaterial, tufts.length);
      tufts.forEach((t, i) => {
        p.set(t.x, t.y - 0.02, t.z);
        q.setFromAxisAngle(up, rand() * 6.28);
        s.set(0.7 + rand() * 0.4, t.h, 0.7 + rand() * 0.4);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        // Close to the ground's own colours, a touch lighter or deeper at random: texture, not contrast.
        c.copy(base).lerp(rand() < 0.6 ? lit : deep, rand() * 0.5);
        mesh.setColorAt(i, c);
      });
      mesh.computeBoundingSphere();
      mesh.name = 'grass-chunk';
      group.add(mesh);
    }
    if (blooms.length) {
      const mesh = new THREE.InstancedMesh(sharedFlower, sharedBloomMaterial, blooms.length);
      blooms.forEach((b, i) => {
        p.set(b.x, b.y + 0.18 + rand() * 0.2, b.z);
        const k = 0.6 + rand() * 0.6;
        s.set(k, k, k);
        q.identity();
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, b.colour);
      });
      mesh.computeBoundingSphere();
      mesh.name = 'flowers-chunk';
      group.add(mesh);
    }
  }
  scene.add(group);
  return group;
}

// Grass in a ring round a point (a lake's shore): tufts between the inner and outer radius, more
// of them close to the inner edge, and a few flowers.
export function createGrassPatch(scene, { centre, inner, outer, count, colors, flowers = 0, seed = 1 }) {
  sharedTuft ??= tuftGeometry();
  sharedFlower ??= flowerGeometry();
  materials();
  const rand = seededRandom(seed);
  const base = new THREE.Color(colors.base), lit = new THREE.Color(colors.lit), deep = new THREE.Color(colors.deep);
  const petals = MATERIALS.meadow.flowers.map((h) => new THREE.Color(h));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  const spot = () => {
    const a = rand() * Math.PI * 2, r = inner + Math.pow(rand(), 1.6) * (outer - inner);
    return [centre[0] + Math.sin(a) * r, centre[1] + Math.cos(a) * r];
  };
  const tufts = new THREE.InstancedMesh(sharedTuft, sharedMaterial, count);
  for (let i = 0; i < count; i++) {
    const [x, z] = spot();
    p.set(x, groundHeight(x, z) - 0.02, z);
    q.setFromAxisAngle(up, rand() * 6.28);
    s.set(0.7 + rand() * 0.4, 0.2 + rand() * 0.28, 0.7 + rand() * 0.4);
    tufts.setMatrixAt(i, m.compose(p, q, s));
    tufts.setColorAt(i, c.copy(base).lerp(rand() < 0.6 ? lit : deep, rand() * 0.5));
  }
  tufts.computeBoundingSphere();
  scene.add(tufts);
  if (flowers) {
    const blooms = new THREE.InstancedMesh(sharedFlower, sharedBloomMaterial, flowers);
    for (let i = 0; i < flowers; i++) {
      const [x, z] = spot();
      p.set(x, groundHeight(x, z) + 0.2 + rand() * 0.15, z);
      const k = 0.5 + rand() * 0.5;
      blooms.setMatrixAt(i, m.compose(p, q.identity(), s.set(k, k, k)));
      blooms.setColorAt(i, petals[rand() < 0.7 ? 3 : 2]);
    }
    blooms.computeBoundingSphere();
    scene.add(blooms);
  }
}

// Grass colours for each zone (palette.js): the cool ridge grass and the sunlit alpine meadow.
export const RIDGE_GRASS = { base: MATERIALS.ground.grass, lit: MATERIALS.ground.grassLit, deep: MATERIALS.ground.moss };
export const MEADOW_GRASS = { base: MATERIALS.meadow.grass, lit: MATERIALS.meadow.grassLit, deep: MATERIALS.meadow.grassDeep };
