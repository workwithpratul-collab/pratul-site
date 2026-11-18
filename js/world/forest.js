// forest.js: the trees, painted rather than modelled.
//
// Two kinds of tree, both drawn with instancing (one shape, thousands of copies, one draw call):
//
//  1. CARDS (mid and far trees): flat painted silhouettes, drawn in code onto a canvas,
//     that always turn to face the camera, like the cut-paper rows in references/style-4.jpg.
//     Fog makes each row paler than the one in front, and mist gathers at their feet.
//
//  2. NEAR TREES (the ones beside the trail): real 3D shapes, but smooth and soft, coloured
//     by a painted gradient (darker low, lighter high) instead of hard light and shadow,
//     with a cool moonlit rim on one side. No dark bands, no facets.
//
// Near trees are kept small and set back from the camera's route, so the trail and the
// sky between the trees always stay open.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundHeight, nearestTrail, noise2, smoothstep, seededRandom, legacy } from './terrain.js';
import { mood } from './palette.js';
import { CAMPS } from './journey.js';

// ---------- Painted colours ----------
// Tree, stone and wood colours live in palette.js (mood.trees, mood.stones, mood.wood).
// They are final screen colours, not surface colours: the painted shader below shows them
// almost exactly, with only a soft hint of light and shade.

// Places that must stay clear of trees: base camp and the ridge camp.
const CLEARINGS = [
  { x: -1, z: 1.5, r: 12.5 },
  { x: 2, z: -146, r: 16 },
];

// A few hand-placed trees that frame the opening shot at base camp (smaller than before,
// and further back, so the sky above the camp stays open).
const HERO_TREES = [
  { type: 'pine', x: -12.5, z: 1.5, scale: 9.5 },
  { type: 'pine', x: -16, z: -8, scale: 10.5 },
  { type: 'oak', x: 13.5, z: -5, scale: 6.5 },
  { type: 'pine', x: 16, z: -15, scale: 10 },
  { type: 'pine', x: 10, z: -22, scale: 8 },
  { type: 'oak', x: -11, z: -19, scale: 6 },
];

// Distance from the camera's route (metres) beyond which trees become flat painted cards.
const CARD_DISTANCE = 26;
const NEAR_MIN_DISTANCE = 6.5;   // no tree closer than this to the camera's route

// Values shared by every tree shader, so one update moves/colours them all.
// The colours here are the palette's live colour objects, so they follow the time of day.
const shared = {
  uWind: { value: 0 },
  uMoonDir: { value: new THREE.Vector3(-0.5, 0.36, -0.79).normalize() },  // replaced by the sky's key light direction
  uRim: { value: mood.trees.rim },
  uWarmPos: { value: new THREE.Vector3(-3.8, 0.8, -2.2) },     // base camp tent
  uWarmPos2: { value: new THREE.Vector3(0, -1000, 0) },        // ridge camp tent (set by camp.js)
  uWarmColor: { value: mood.warm },
  uMistColor: { value: mood.mist.treeFeet },
};

export function createForest(scene, { routeDistance, legacyRouteDistance, sky } = {}) {
  // Share the sky's live key light direction (moon at night, sun later), so trees shade with it.
  if (sky) shared.uMoonDir.value = sky.keyDir;

  // ---------- 1. Decide where every tree goes ----------
  // The forest is planted exactly as in Phase 1 (same seeded random sequence, along the
  // Phase 1 trail, camera route and land), so base camp and DERMAÉ keep every tree.
  // Then the trees in the way of the new trail are cleared (step 1b).
  const rand = seededRandom(2024);
  const near = { pine: [], oak: [] };
  const cards = [];
  const legacyRoute = legacyRouteDistance || routeDistance;

  for (const t of HERO_TREES) {
    near[t.type].push({ x: t.x, z: t.z, scale: t.scale, rot: rand() * 6.28, tint: 0.95 });
  }

  const candidates = 22000;
  for (let i = 0; i < candidates; i++) {
    const x = (rand() - 0.5) * 320;
    const z = 60 - rand() * 340;
    // Keep the trail and the clearings free.
    const trail = legacy.nearestTrail(x, z).distance;
    if (trail < 6 + rand() * 3) continue;
    if (CLEARINGS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + rand() * 4)) continue;
    const route = legacyRoute ? legacyRoute(x, z) : 100;
    if (route < NEAR_MIN_DISTANCE + rand() * 2) continue;

    const y = legacy.height(x, z);
    // Trees grow in groves (noise), and thin out as the land climbs to the open ridge.
    const grove = noise2(x * 0.045, z * 0.045, 21);
    const altitude = 1 - smoothstep(10, 22, y + (z < -120 ? 6 : 0));
    const sides = smoothstep(14, 40, Math.abs(x));
    const valley = z < -160 ? 0.6 : 1;
    let density = smoothstep(0.3, 0.6, grove) * Math.max(altitude, sides * 0.85) * valley;
    // Near the camera's route, fewer trees, so views stay open.
    density *= 0.35 + 0.65 * smoothstep(NEAR_MIN_DISTANCE, 22, route);
    if (rand() > density) continue;

    const isOak = y < 6 && rand() < 0.28;
    const tint = 0.88 + rand() * 0.22;

    if (route >= CARD_DISTANCE) {
      // Far away: a painted card.
      const height = isOak ? 6 + rand() * 4 : 8 + rand() * 9;
      cards.push({ x, z, y, height, tint, variant: isOak ? 6 + Math.floor(rand() * 2) : Math.floor(rand() * 6) });
    } else {
      // Close: a soft 3D tree, never taller than about half its distance from the camera's route,
      // so it can't wall off the sky.
      const maxScale = 1.5 + route * 0.48;
      const scale = Math.min(isOak ? 4.5 + rand() * 2.5 : 5.5 + rand() * 4.5, maxScale);
      near[isOak ? 'oak' : 'pine'].push({ x, z, y, scale, rot: rand() * 6.28, tint });
    }
  }

  // ---------- 1b. Clear the way for the new trail (scene 2 onwards) ----------
  // Every tree is checked against the full trail and the full camera route:
  //  - too close to the new trail or the camera's path: removed,
  //  - standing on the new ridge land (the ground rose there): mostly removed, so the ridge
  //    is open grass with only a few scattered trees,
  //  - a flat card tree that the camera now passes close to: turned into a soft 3D tree.
  const legacyEnd = legacy.trailCurve.getLength() - 1;   // metres of trail that are Phase 1's
  const keep = (t) => {
    const y = groundHeight(t.x, t.z);
    const trail = nearestTrail(t.x, t.z);
    if (trail.distance < 6.5 && trail.s > legacyEnd) return false;
    const route = routeDistance ? routeDistance(t.x, t.z) : 100;
    // Only where the new camera route passes closer than the old one did.
    if (route < NEAR_MIN_DISTANCE && route < legacyRoute(t.x, t.z) - 0.5) return false;
    // Keep each landmark and the view of it clear.
    for (const c of CAMPS) {
      const room = c.kind === 'lake' ? c.radius + 4 : 9;
      if (distanceToSegment(t.x, t.z, c.view, c.screen) < 5 || Math.hypot(t.x - c.screen[0], t.z - c.screen[1]) < room) return false;
    }
    const rose = y - (t.y ?? y);
    // Trees on the new ridge land, or on the open ridge well east of DERMAÉ (beyond the pines
    // that frame its arrival shot): keep about one in six.
    const onRidge = rose > 1.5 || (t.z < -166 && t.x > 30) || (t.z < -150 && t.x > 55);
    if (onRidge && noise2(t.x * 0.9, t.z * 0.9, 404) > 0.24) return false;
    t.y = y;
    t.route = route;
    return true;
  };
  for (const kind of ['pine', 'oak']) near[kind] = near[kind].filter((t) => t.y === undefined || keep(t));
  for (let i = cards.length - 1; i >= 0; i--) {
    const c = cards[i];
    if (!keep(c)) { cards.splice(i, 1); continue; }
    // (Cards look fine down to about 15 m; only closer ones need to become real 3D trees.)
    if (c.route < 15 && c.route < legacyRoute(c.x, c.z) - 0.5) {
      cards.splice(i, 1);
      const scale = Math.min(c.height * 0.8, 1.5 + c.route * 0.48);
      near[c.variant >= 6 ? 'oak' : 'pine'].push({ x: c.x, z: c.z, y: c.y, scale, rot: c.x * 1.7, tint: c.tint });
    }
  }

  // ---------- 2. Build the meshes ----------
  const nearMat = makePaintedMaterial({ colors: mood.trees });
  const pineMesh = makeNearInstanced(buildSoftPine(), near.pine, nearMat, 'near-pines');
  const oakMesh = makeNearInstanced(buildSoftOak(), near.oak, nearMat, 'near-oaks');
  const cardMesh = makeCards(cards);
  scene.add(pineMesh, oakMesh, cardMesh);

  // Colours need no per-frame work: every tree material holds the palette's live colours.

  return {
    count: near.pine.length + near.oak.length + cards.length,
    counts: { nearPines: near.pine.length, nearOaks: near.oak.length, cards: cards.length },
    update(time) {
      shared.uWind.value = time;
    },
    // Show or hide the whole forest (main.js hides it once it's far behind the camera).
    setVisible(visible) {
      pineMesh.visible = oakMesh.visible = cardMesh.visible = visible;
    },
  };
}

// =====================================================================
// PAINTED MATERIAL: used by near trees AND rocks, so they share one style
// =====================================================================
// Colours are a painted gradient (darker low, lighter high), plus a soft hint of
// form from the moon, a faint silver rim on the moon side, and warm light from the
// camp tents on surfaces that face them.
// colors: a group of live palette colours with bottom, top and (optionally) trunk,
// e.g. mood.trees, mood.stones or mood.wood. Because these are the palette's own colour
// objects, the material follows the time of day with no extra code.

export function makePaintedMaterial({ colors, wind = true, roundness = 0.55, rim = 1 }) {
  const material = new THREE.ShaderMaterial({
    fog: true,
    defines: wind ? { USE_WIND: '' } : {},
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uRoundness: { value: roundness },
      uRimAmount: { value: rim },
    }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute float aTrunk;      // 1 on trunk vertices, 0 on foliage / stone
      uniform float uWind, uRoundness;
      varying float vH, vTrunk;
      varying vec3 vNormalW, vWorld, vTint;
      void main() {
        vec3 p = position;
        #ifdef USE_WIND
          // Gentle sway: tops move, roots stay still, each tree on its own rhythm.
          float phase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;
          float bend = p.y * p.y;
          p.x += sin(uWind * 0.9 + phase) * 0.012 * bend;
          p.z += cos(uWind * 0.7 + phase) * 0.008 * bend;
        #endif
        mat4 m = modelMatrix * instanceMatrix;
        vec4 world = m * vec4(p, 1.0);
        vWorld = world.xyz;
        // Lean the normals towards "pointing out from the middle", so each shape shades
        // like one soft rounded form instead of many small facets.
        vec3 radial = normalize(vec3(position.x, 0.3, position.z) + vec3(1e-5));
        vNormalW = normalize(mat3(m) * normalize(mix(normal, radial, uRoundness)));
        vH = position.y;
        vTrunk = aTrunk;
        #ifdef USE_INSTANCING_COLOR
          vTint = instanceColor;
        #else
          vTint = vec3(1.0);
        #endif
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uBottom, uTop, uTrunk, uRim, uMoonDir, uWarmPos, uWarmPos2, uWarmColor;
      uniform float uRimAmount;
      varying float vH, vTrunk;
      varying vec3 vNormalW, vWorld, vTint;

      // How much warm light a point gets from a tent: only on surfaces that face it,
      // strong close by and fading quickly, so it reads as a glow, not a brown tint.
      float warmFrom(vec3 lightPos, vec3 n) {
        vec3 L = lightPos - vWorld;
        float d2 = dot(L, L);
        float facing = max(dot(n, normalize(L)), 0.0);
        return facing * facing / (1.0 + d2 * 0.16);
      }

      void main() {
        vec3 n = normalize(vNormalW);
        vec3 v = normalize(cameraPosition - vWorld);

        // 1. The painted gradient: darker low, lighter high. Never near-black.
        vec3 col = mix(uBottom, uTop, smoothstep(0.05, 0.95, vH)) * vTint;
        col = mix(col, uTrunk, step(0.5, vTrunk));

        // 2. A very soft hint of form from the moon (wrapped, so there is no hard shadow side).
        float wrap = dot(n, uMoonDir) * 0.5 + 0.5;
        col *= mix(0.9, 1.08, wrap);

        // 3. A faint, cool silver edge, only on the side facing the moon.
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.5);
        vec2 nSide = normalize(n.xz + vec2(1e-5));
        float side = smoothstep(0.35, 0.95, dot(nSide, normalize(uMoonDir.xz)));
        col += uRim * fres * side * 0.13 * uRimAmount * (1.0 - vTrunk);

        // 4. Warm glow from the camp tents.
        float warm = warmFrom(uWarmPos, n) + 0.7 * warmFrom(uWarmPos2, n);
        col += uWarmColor * warm * 0.85;

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  // Link the palette's live colours (after merge(), which would have copied them).
  Object.assign(material.uniforms, {
    uBottom: { value: colors.bottom },
    uTop: { value: colors.top },
    uTrunk: { value: colors.trunk || colors.bottom },
  });
  // Link the values every painted material shares (wind, moon, rim colour, tent lights).
  Object.assign(material.uniforms, {
    uWind: shared.uWind, uMoonDir: shared.uMoonDir, uRim: shared.uRim,
    uWarmPos: shared.uWarmPos, uWarmPos2: shared.uWarmPos2, uWarmColor: shared.uWarmColor,
  });
  return material;
}

// Soft painted trees for other scenes (the style frames, and later the meadow).
// trees: { pine: [{ x, y, z, scale, rot, tint }], oak: [...] }, with y = the ground height there.
export function createNearTrees(scene, trees) {
  const material = makePaintedMaterial({ colors: mood.trees });
  const pines = makeNearInstanced(buildSoftPine(), trees.pine || [], material, 'soft-pines');
  const oaks = makeNearInstanced(buildSoftOak(), trees.oak || [], material, 'soft-oaks');
  scene.add(pines, oaks);
  return { pines, oaks };
}

// How far (x, z) is from the straight line between points a and b (on the map).
function distanceToSegment(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.min(Math.max(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0), 1);
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
}

// Move the tents' warm glow (scenes without tents send it far away, so nothing is tinted).
const FAR_AWAY = new THREE.Vector3(0, -10000, 0);
export function setWarmLights(first = FAR_AWAY, second = FAR_AWAY) {
  shared.uWarmPos.value.copy(first);
  shared.uWarmPos2.value.copy(second);
}

// Tell the painted materials where the second (ridge camp) tent glows from.
export function setSecondWarmLight(position) {
  shared.uWarmPos2.value.copy(position);
}

function makeNearInstanced(geometry, trees, material, name) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(trees.length, 1));
  mesh.count = trees.length;
  mesh.name = name;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  trees.forEach((t, i) => {
    const y = t.y ?? groundHeight(t.x, t.z);
    p.set(t.x, y - 0.2, t.z);
    q.setFromAxisAngle(up, t.rot);
    const squash = 0.9 + ((i * 7919) % 100) / 500;
    s.set(t.scale * squash, t.scale, t.scale * squash);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    color.setScalar(t.tint);
    mesh.setColorAt(i, color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

// A flag attribute that marks every vertex of a part as trunk (1) or not (0).
function flag(geo, value) {
  geo.setAttribute('aTrunk', new THREE.Float32BufferAttribute(new Array(geo.attributes.position.count).fill(value), 1));
  if (geo.attributes.uv) geo.deleteAttribute('uv');   // no textures; all parts must match
  return geo.index ? geo.toNonIndexed() : geo;
}

// A pine "turned" on a lathe: soft layers of branches that taper to a point. The outline
// is ragged: branch tips poke out unevenly around each layer, so it reads as a pine.
function buildSoftPine() {
  const radial = 26, rows = 40;
  const positions = [], indices = [];
  const tiers = 5;
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;                         // 0 at the bottom of the foliage, 1 at the tip
    // Each layer of branches bulges out and tucks in, smoothly (no steps, no dark bands).
    const scallop = Math.pow(0.5 + 0.5 * Math.cos(t * tiers * Math.PI * 2), 1.6);
    const radius = 0.26 * Math.pow(1 - t, 0.95) * (0.76 + 0.24 * scallop);
    for (let a = 0; a < radial; a++) {
      const ang = (a / radial) * Math.PI * 2;
      // Ragged edge: uneven branch tips (noise) that stick out most at the bulge of each layer.
      const tip = (a % 2 === 0 ? 1 : -1) * 0.07 * scallop;
      const ragged = 0.84 + 0.32 * noise2(a * 0.83 + 3.1, r * 0.47, 13) + tip;
      const k = radius * ragged;
      // Branch tips droop slightly where they stick out.
      const y = 0.08 + t * 0.92 - Math.max(ragged - 1, 0) * 0.05;
      positions.push(Math.cos(ang) * k, y, Math.sin(ang) * k);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let a = 0; a < radial; a++) {
      const i0 = r * radial + a, i1 = r * radial + ((a + 1) % radial);
      const j0 = i0 + radial, j1 = i1 + radial;
      indices.push(i0, j0, i1, i1, j0, j1);
    }
  }
  // Close the bottom of the foliage with a gently domed underside (so no hole, no dark rim).
  const centre = positions.length / 3;
  positions.push(0, 0.05, 0);
  for (let a = 0; a < radial; a++) indices.push(centre, a, (a + 1) % radial);

  const foliage = new THREE.BufferGeometry();
  foliage.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  foliage.setIndex(indices);
  foliage.computeVertexNormals();

  const trunk = new THREE.CylinderGeometry(0.014, 0.024, 0.12, 8);
  trunk.translate(0, 0.06, 0);
  return mergeGeometries([flag(foliage, 0), flag(trunk, 1)]);
}

// A leafy tree: a short trunk under a full, low canopy of soft round clumps
// (not broccoli on a stick).
function buildSoftOak() {
  const trunk = new THREE.CylinderGeometry(0.035, 0.06, 0.26, 8);
  trunk.translate(0, 0.13, 0);
  const parts = [flag(trunk, 1)];
  const clumps = [
    [0, 0.5, 0, 0.3], [0.21, 0.42, 0.06, 0.24], [-0.2, 0.43, -0.05, 0.25],
    [0.05, 0.41, 0.21, 0.23], [-0.06, 0.41, -0.21, 0.23], [0.1, 0.66, -0.04, 0.22],
    [-0.1, 0.64, 0.08, 0.21], [0, 0.33, 0, 0.25],
  ];
  for (const [x, y, z, r] of clumps) {
    const s = new THREE.SphereGeometry(r, 20, 14);
    s.translate(x, y, z);
    parts.push(flag(s, 0));
  }
  return mergeGeometries(parts);
}

// =====================================================================
// ROCKS: soft, rounded painted stones in the same style as the trees
// =====================================================================
// One smooth pebble shape (a sphere gently pushed in and out by noise), 1 unit tall.
function buildStoneGeometry() {
  const geo = new THREE.SphereGeometry(0.5, 32, 20);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Low-frequency noise only: soft lumps, never sharp corners.
    const bump = 0.8 + 0.3 * noise2(v.x * 2.2 + v.y * 1.3, v.z * 2.2 - v.y * 0.7, 31)
      + 0.1 * noise2(v.x * 5.1 - v.y * 2.0, v.z * 5.1 + v.y * 1.7, 37);
    v.multiplyScalar(bump);
    if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.3;   // a flatter base, so stones sit on the ground
    pos.setXYZ(i, v.x, v.y + 0.5, v.z);
  }
  geo.computeVertexNormals();
  return flag(geo, 0);
}

// stones: [{ x, z, s }] in world space. Returns one instanced mesh.
export function createStones(scene, stones, rand = Math.random) {
  const material = makePaintedMaterial({ colors: mood.stones, wind: false, roundness: 0.35, rim: 0.7 });
  const mesh = new THREE.InstancedMesh(buildStoneGeometry(), material, stones.length);
  mesh.name = 'stones';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  stones.forEach((st, i) => {
    // st.y is optional: other scenes (the style frames) pass their own ground height.
    p.set(st.x, (st.y ?? groundHeight(st.x, st.z)) - st.s * 0.12, st.z);
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    sc.set(st.s * (1.2 + rand() * 0.4), st.s * (0.55 + rand() * 0.25), st.s * (0.95 + rand() * 0.3));
    m.compose(p, q, sc);
    mesh.setMatrixAt(i, m);
    color.setScalar(0.9 + rand() * 0.2);
    mesh.setColorAt(i, color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  scene.add(mesh);
  return mesh;
}

// ---------- Four stone shapes, for the new parts of the trail ----------
// Base camp keeps its smooth pebbles. Further up, the stones vary, so no two clusters look
// copy-pasted. Each is still soft (low-frequency noise only, no sharp facets), 1 unit tall.
//   0 boulder: a big round lump     1 slab: low, wide and flat-topped, like a split rock
//   2 standing stone: tall, leaning, tapering   3 twin: two lumps grown together
function buildStoneShapes() {
  const shape = (seed, fn, detail = [32, 20]) => {
    const geo = new THREE.SphereGeometry(0.5, detail[0], detail[1]);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      fn(v, seed);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    // Sit the shape on y = 0 and make it 1 unit tall.
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    geo.translate(0, -b.min.y, 0);
    geo.scale(1, 1 / (b.max.y - b.min.y), 1);
    geo.computeVertexNormals();
    return flag(geo, 0);
  };
  const lumpy = (v, seed, amount) => 1 - amount / 2 + amount * noise2(v.x * 2.2 + v.y * 1.3 + seed, v.z * 2.2 - v.y * 0.7, 31 + seed);
  return [
    shape(1, (v, s) => {
      v.multiplyScalar(lumpy(v, s, 0.35));
      if (v.y < -0.28) v.y = -0.28 + (v.y + 0.28) * 0.3;
    }),
    shape(2, (v, s) => {
      // A slab: squashed, with a flatter, slightly tilted top.
      v.multiplyScalar(lumpy(v, s, 0.25));
      v.y *= 0.55;
      if (v.y > 0.12) v.y = 0.12 + (v.y - 0.12) * 0.25 + v.x * 0.06;
      v.x *= 1.5;
      if (v.y < -0.18) v.y = -0.18 + (v.y + 0.18) * 0.3;
    }),
    shape(3, (v, s) => {
      // A standing stone: taller than wide, narrowing and leaning towards the top.
      v.multiplyScalar(lumpy(v, s, 0.3));
      const up = v.y + 0.5;                        // 0 at the bottom, 1 at the top
      v.x *= 0.62 * (1.1 - up * 0.35);
      v.z *= 0.5 * (1.1 - up * 0.35);
      v.y *= 1.7;
      v.x += up * up * 0.12;
      if (v.y < -0.7) v.y = -0.7 + (v.y + 0.7) * 0.3;
    }),
    shape(4, (v, s) => {
      // Twin: a lump with a softer, lower shoulder grown onto one side.
      v.multiplyScalar(lumpy(v, s, 0.3));
      const shoulder = Math.max(v.x, 0);
      v.x *= 1.45;
      v.y *= 1 - shoulder * 0.7;
      v.y -= shoulder * shoulder * 0.25;
      if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.3;
    }),
  ];
}

// stones: [{ x, z, s, y?, shape? }] (shape 0..3, chosen at random if missing).
// One instanced mesh per shape: four draw calls for any number of stones.
let stoneShapes = null;
export function createStoneVariety(scene, stones, rand = Math.random, colors = mood.stones) {
  stoneShapes ??= buildStoneShapes();
  const material = makePaintedMaterial({ colors, wind: false, roundness: 0.3, rim: 0.7 });
  const groups = [[], [], [], []];
  for (const st of stones) groups[st.shape ?? Math.floor(rand() * 4)].push(st);
  const meshes = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), color = new THREE.Color();
  groups.forEach((list, shape) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(stoneShapes[shape], material, list.length);
    mesh.name = `stones-${shape}`;
    list.forEach((st, i) => {
      // Sunk a little into the ground, so no stone looks like it was set down on top.
      p.set(st.x, (st.y ?? groundHeight(st.x, st.z)) - st.s * 0.15, st.z);
      q.setFromAxisAngle(up, rand() * Math.PI * 2);
      const tall = shape === 2 ? 1.3 : shape === 1 ? 0.5 : 0.75;
      sc.set(st.s * (1.0 + rand() * 0.4), st.s * tall * (0.85 + rand() * 0.3), st.s * (0.85 + rand() * 0.3));
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
      color.setScalar(0.88 + rand() * 0.22);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
    meshes.push(mesh);
  });
  return meshes;
}

// =====================================================================
// CARD TREES: painted silhouettes that face the camera
// =====================================================================
const VARIANTS = 8;              // 6 pine shapes + 2 broadleaf shapes in one texture
const CELL_W = 256, CELL_H = 512;

function makeCards(cards) {
  const atlas = paintTreeAtlas();
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);      // pivot at the bottom middle (where the trunk meets the ground)

  const material = new THREE.ShaderMaterial({
    fog: true,
    alphaToCoverage: true,       // smooth edges using the anti-aliasing samples: no sorting needed
    side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uAtlas: { value: null },
    }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute float aVariant;
      uniform float uWind;
      varying vec2 vUv;
      varying float vVariant;
      varying vec3 vTint;
      void main() {
        // Where this card stands, and how big it is (from its instance matrix).
        vec3 centre = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float width = length(instanceMatrix[0].xyz);
        float height = length(instanceMatrix[1].xyz);
        // Turn to face the camera around the vertical axis only, so trees stay upright.
        vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 right = normalize(vec3(camRight.x, 0.0, camRight.z) + vec3(1e-5));
        float sway = sin(uWind * 0.8 + centre.x * 0.3 + centre.z * 0.2) * 0.015 * position.y * position.y;
        vec3 world = centre + right * (position.x + sway) * width + vec3(0.0, position.y * height, 0.0);
        vec4 mvPosition = viewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        vUv = uv;
        vVariant = aVariant;
        #ifdef USE_INSTANCING_COLOR
          vTint = instanceColor;
        #else
          vTint = vec3(1.0);
        #endif
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D uAtlas;
      uniform vec3 uBottom, uTop, uRim, uMistColor;
      varying vec2 vUv;
      varying float vVariant;
      varying vec3 vTint;
      void main() {
        vec4 t = texture2D(uAtlas, vec2((vUv.x + vVariant) / ${VARIANTS.toFixed(1)}, vUv.y));
        // Crisp but anti-aliased edge: turn the soft mask into a clean cut-paper outline.
        float w = max(fwidth(t.a), 1e-4);
        float alpha = clamp((t.a - 0.5) / w + 0.5, 0.0, 1.0);
        if (alpha < 0.02) discard;

        // Painted gradient + a little brush variation + a moonlit left edge.
        vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y)) * vTint;
        col *= 0.93 + 0.14 * t.r;
        col += uRim * t.g * 0.035;    // only a whisper of moonlight on far trees
        // Mist gathers at the feet of each tree (the style-4 look).
        col = mix(col, uMistColor, (1.0 - smoothstep(0.0, 0.35, vUv.y)) * 0.3);

        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  material.uniforms.uAtlas.value = atlas;
  // The card colours are the palette's live colours (follow the time of day by themselves).
  material.uniforms.uBottom = { value: mood.trees.cardBottom };
  material.uniforms.uTop = { value: mood.trees.cardTop };
  Object.assign(material.uniforms, { uWind: shared.uWind, uRim: shared.uRim, uMistColor: shared.uMistColor });

  const mesh = new THREE.InstancedMesh(geo, material, Math.max(cards.length, 1));
  mesh.count = cards.length;
  mesh.name = 'tree-cards';
  const variant = new Float32Array(cards.length);
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  cards.forEach((c, i) => {
    const width = c.height * 0.5;   // the atlas cells are half as wide as they are tall
    m.makeScale(width, c.height, 1);
    m.setPosition(c.x, c.y - 0.4, c.z);
    mesh.setMatrixAt(i, m);
    color.setScalar(c.tint);
    mesh.setColorAt(i, color);
    variant[i] = c.variant;
  });
  geo.setAttribute('aVariant', new THREE.InstancedBufferAttribute(variant, 1));
  mesh.instanceMatrix.needsUpdate = true;
  // Cards move in the shader, so give them a generous bounding sphere (never wrongly culled).
  mesh.frustumCulled = false;
  return mesh;
}

// Draw 8 tree silhouettes side by side on one canvas.
// Channels: A = the silhouette, R = soft brush variation, G = moonlit left edge.
function paintTreeAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = CELL_W * VARIANTS;
  canvas.height = CELL_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  const rand = seededRandom(99);
  // A slight blur gives the mask soft edges, which the shader turns into smooth outlines.
  ctx.filter = 'blur(1.2px)';
  for (let v = 0; v < VARIANTS; v++) {
    if (v < 6) drawPine(ctx, v * CELL_W, rand);
    else drawBroadleaf(ctx, v * CELL_W, rand);
  }
  ctx.filter = 'none';

  // Second pass, pixel by pixel: add brush variation (R) and a moonlit edge (G).
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const W = canvas.width;
  const alphaAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= CELL_H ? 0 : d[(y * W + x) * 4 + 3] / 255);
  const out = new Uint8ClampedArray(d.length);
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = d[i + 3] / 255;
      // Light comes from the upper left (the moon): edges with empty space up-left catch it.
      const rim = a * (1 - alphaAt(x - 3, y - 2));
      const brush = noise2(x * 0.045, y * 0.02, 5) * 0.7 + noise2(x * 0.15, y * 0.08, 6) * 0.3;
      out[i] = brush * 255;
      out[i + 1] = rim * 255;
      out[i + 2] = 0;
      out[i + 3] = d[i + 3];
    }
  }
  ctx.putImageData(new ImageData(out, W, CELL_H), 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;     // this is data (masks), not a colour picture
  tex.premultiplyAlpha = false;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

// A pine: one outline with drooping branch tips down both sides, each side jittered separately.
function drawPine(ctx, ox, rand) {
  const cx = ox + CELL_W / 2 + (rand() - 0.5) * 8;
  const top = 10 + rand() * 18;
  const base = CELL_H - 40;
  const maxHalf = CELL_W * (0.36 + rand() * 0.1);
  const tiers = 7 + Math.floor(rand() * 4);
  const half = (y) => maxHalf * Math.pow((y - top) / (base - top), 0.92);

  const side = (dir) => {
    const pts = [];
    for (let k = 1; k <= tiers; k++) {
      const yTip = top + ((base - top) * k) / tiers + (rand() - 0.5) * 8;
      const yNotch = yTip - ((base - top) / tiers) * (0.45 + rand() * 0.2);
      pts.push([cx + dir * half(yNotch) * (0.58 + rand() * 0.2), yNotch]);
      pts.push([cx + dir * half(yTip) * (0.9 + rand() * 0.25), yTip + 6 + rand() * 6]);   // drooping tip
    }
    return pts;
  };
  const left = side(-1);
  const right = side(1);

  ctx.beginPath();
  ctx.moveTo(cx, top);
  for (const [x, y] of left) ctx.lineTo(x, y);
  ctx.lineTo(cx - maxHalf * 0.2, base + 2);
  ctx.lineTo(cx + maxHalf * 0.2, base + 2);
  for (const [x, y] of right.reverse()) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  // A short trunk peeking out underneath.
  ctx.fillRect(cx - 5, base - 4, 10, CELL_H - base);
}

// A broadleaf tree: a cloud of overlapping round clumps on a short trunk.
function drawBroadleaf(ctx, ox, rand) {
  const cx = ox + CELL_W / 2;
  const base = CELL_H - 30;
  ctx.fillRect(cx - 7, base - 140, 14, 170);
  const clumps = 11;
  for (let i = 0; i < clumps; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 48;
    const x = cx + Math.cos(a) * r;
    const y = base - 220 + Math.sin(a) * r * 1.3 - (i === 0 ? 30 : 0);
    ctx.beginPath();
    ctx.arc(x, y, 36 + rand() * 30, 0, Math.PI * 2);   // stays inside the 256 px cell
    ctx.fill();
  }
}
