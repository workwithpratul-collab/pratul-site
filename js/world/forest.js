// forest.js: stylised pine and oak trees, thousands of them, drawn cheaply with instancing.
// "Instancing" means: build ONE tree shape, then ask the graphics card to draw it many
// times in a single go, each copy with its own position, size, rotation and colour.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundHeight, nearestTrail, noise2, smoothstep, seededRandom } from './terrain.js';

// Surface colours (mid-tones; the night light makes them blue-green).
const PINE_GREEN = new THREE.Color('#4a786a');
const OAK_GREEN = new THREE.Color('#5f8a64');
const BARK = new THREE.Color('#5c4c46');

// Places that must stay clear of trees: base camp and the ridge camp.
const CLEARINGS = [
  { x: -1, z: 1.5, r: 12.5 },
  { x: 0, z: -146, r: 15 },
];

// A few hand-placed "hero" trees that frame the opening shot at base camp,
// like the tall dark trees on each side of references/basecamp-1.jpg.
const HERO_TREES = [
  { type: 'pine', x: -11, z: 3, scale: 16, rot: 0.4 },
  { type: 'pine', x: -13.5, z: -7, scale: 13, rot: 1.2 },
  { type: 'oak', x: 12, z: -4, scale: 8.5, rot: 2.1 },
  { type: 'pine', x: 14, z: -13, scale: 14, rot: 0.9 },
  { type: 'pine', x: 8.5, z: -19, scale: 10, rot: 2.7 },
  { type: 'oak', x: -9.5, z: -17, scale: 7, rot: 0.2 },
];

export function createForest(scene, { avoid } = {}) {
  const pineGeo = buildPineGeometry();
  const oakGeo = buildOakGeometry();

  // ---------- 1. Decide where every tree goes ----------
  const rand = seededRandom(2024);
  const pines = [];
  const oaks = [];
  for (const t of HERO_TREES) (t.type === 'pine' ? pines : oaks).push({ ...t, tint: 0.92 });

  const candidates = 16000;
  for (let i = 0; i < candidates; i++) {
    const x = (rand() - 0.5) * 300;
    const z = 60 - rand() * 330;
    // Keep the trail, the clearings and the camera's path free.
    const trail = nearestTrail(x, z).distance;
    if (trail < 4 + rand() * 3) continue;
    if (CLEARINGS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + rand() * 4)) continue;
    if (avoid && avoid(x, z)) continue;

    const y = groundHeight(x, z);
    // Trees grow in groves (noise), and thin out as the land climbs to the open ridge.
    const grove = noise2(x * 0.045, z * 0.045, 21);
    const altitude = 1 - smoothstep(10, 22, y + (z < -120 ? 6 : 0));
    const sides = smoothstep(14, 40, Math.abs(x));             // denser on the valley sides
    const valley = z < -160 ? 0.55 : 1;                         // a few trees below the ridge
    const density = smoothstep(0.32, 0.62, grove) * Math.max(altitude, sides * 0.8) * valley;
    if (rand() > density) continue;

    // Oaks like the lower, sheltered ground near camp; pines are everywhere else.
    const isOak = y < 6 && rand() < 0.3;
    const tree = {
      x, z, y,
      rot: rand() * Math.PI * 2,
      scale: isOak ? 5 + rand() * 4 : 7 + rand() * 8,
      tint: 0.82 + rand() * 0.3,
      hue: (rand() - 0.5) * 0.03,
    };
    (isOak ? oaks : pines).push(tree);
  }

  const pineMesh = makeInstanced(pineGeo, pines, 'pines');
  const oakMesh = makeInstanced(oakGeo, oaks, 'oaks');
  scene.add(pineMesh, oakMesh);

  return {
    count: pines.length + oaks.length,
    update(time) {
      // The wind uniform is shared, so one number moves every tree.
      windUniform.value = time;
    },
  };
}

// A shared "time" value the tree shader uses for a gentle sway in the wind.
const windUniform = { value: 0 };

function makeInstanced(geometry, trees, name) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });

  // Add a soft sway to the tree tops by changing the shader slightly (onBeforeCompile).
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = windUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // Each tree gets its own phase from its position, so they don't sway in sync.
        float phase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;
        float bend = position.y * position.y;          // tops move, roots stay still
        transformed.x += sin(uWind * 0.9 + phase) * 0.012 * bend;
        transformed.z += cos(uWind * 0.7 + phase) * 0.008 * bend;`
      );
  };

  const mesh = new THREE.InstancedMesh(geometry, material, trees.length);
  mesh.name = name;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();

  trees.forEach((t, i) => {
    const y = t.y ?? groundHeight(t.x, t.z);
    p.set(t.x, y - 0.25, t.z);                     // sink the trunk a little into the ground
    q.setFromAxisAngle(up, t.rot);
    const squash = 0.9 + ((i * 7919) % 100) / 500;  // some trees a bit wider, some slimmer
    s.set(t.scale * squash, t.scale, t.scale * squash);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    // Per-tree colour: slightly brighter/darker and a touch warmer/cooler.
    color.setScalar(t.tint);
    color.offsetHSL(t.hue || 0, 0, 0);
    mesh.setColorAt(i, color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

// ---------- Tree shapes (each about 1 unit tall; instances scale them up) ----------

// Paint a vertex-colour gradient onto a part: darker at the bottom, lighter at the top,
// like soft shade under each layer of branches.
function paint(geo, base, bottomShade, topShade) {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - min.y) / (max.y - min.y || 1);
    c.copy(base).multiplyScalar(bottomShade + (topShade - bottomShade) * t);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function buildPineGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.016, 0.026, 0.16, 6);
  trunk.translate(0, 0.08, 0);
  parts.push(paint(trunk, BARK, 0.6, 0.9));

  // Five layers of branches: wide cones low down, small ones at the top.
  // The lowest layer nearly touches the ground, so pines read as soft dark silhouettes.
  const tiers = [
    { r: 0.24, h: 0.34, y: 0.07 },
    { r: 0.205, h: 0.32, y: 0.22 },
    { r: 0.165, h: 0.29, y: 0.37 },
    { r: 0.12, h: 0.26, y: 0.52 },
    { r: 0.07, h: 0.24, y: 0.68 },
  ];
  tiers.forEach((t, i) => {
    const cone = new THREE.ConeGeometry(t.r, t.h, 12, 1, false);
    cone.rotateY(i * 0.7);                 // offset each layer so edges don't line up
    cone.translate(0, t.y + t.h / 2, 0);
    parts.push(paint(cone, PINE_GREEN, 0.5, 1.15));
  });
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}

function buildOakGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.035, 0.06, 0.5, 7);
  trunk.translate(0, 0.25, 0);
  parts.push(paint(trunk, BARK, 0.6, 0.9));

  // A cloud of soft round blobs makes a stylised, painterly canopy.
  const blobs = [
    [0, 0.68, 0, 0.27],
    [0.17, 0.58, 0.06, 0.2],
    [-0.16, 0.6, -0.04, 0.21],
    [0.04, 0.6, 0.17, 0.19],
    [-0.04, 0.58, -0.17, 0.19],
    [0.02, 0.86, 0.02, 0.18],
  ];
  blobs.forEach(([x, y, z, r]) => {
    const blob = new THREE.IcosahedronGeometry(r, 1);
    blob.translate(x, y, z);
    parts.push(paint(blob, OAK_GREEN, 0.5, 1.15));
  });
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}
