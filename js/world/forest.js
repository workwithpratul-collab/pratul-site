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
import { groundHeight, nearestTrail, noise2, smoothstep, seededRandom } from './terrain.js';

// ---------- Painted colours (these are final screen colours, not surface colours) ----------
// Night and pre-dawn versions; setDawn() blends between them.
const PALETTE = {
  night: {
    nearBottom: '#172a3d', nearTop: '#2f4b62',   // near trees: deep slate blue low, lighter high
    cardBottom: '#172b3f', cardTop: '#223d52',   // card trees: flatter; the fog adds the depth
    rim: '#7e95d6',                              // cool moonlight on the edges
    trunk: '#26242e',
  },
  dawn: {
    nearBottom: '#252f4a', nearTop: '#4a5878',
    cardBottom: '#232c46', cardTop: '#343f5e',
    rim: '#c2b4d8',
    trunk: '#332d3a',
  },
};

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
const shared = {
  uWind: { value: 0 },
  uMoonDir: { value: new THREE.Vector3(-0.5, 0.36, -0.79).normalize() },
  uRim: { value: new THREE.Color(PALETTE.night.rim) },
  uWarmPos: { value: new THREE.Vector3(-3.8, 0.8, -2.2) },  // base camp tent
  uWarmColor: { value: new THREE.Color('#ff9a4a') },
  uMistColor: { value: new THREE.Color() },
};

export function createForest(scene, { routeDistance, sky } = {}) {
  if (sky) shared.uMoonDir.value.copy(sky.moonDir);

  // ---------- 1. Decide where every tree goes ----------
  const rand = seededRandom(2024);
  const near = { pine: [], oak: [] };
  const cards = [];

  for (const t of HERO_TREES) {
    near[t.type].push({ x: t.x, z: t.z, scale: t.scale, rot: rand() * 6.28, tint: 0.95 });
  }

  const candidates = 22000;
  for (let i = 0; i < candidates; i++) {
    const x = (rand() - 0.5) * 320;
    const z = 60 - rand() * 340;
    // Keep the trail and the clearings free.
    const trail = nearestTrail(x, z).distance;
    if (trail < 6 + rand() * 3) continue;
    if (CLEARINGS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + rand() * 4)) continue;
    const route = routeDistance ? routeDistance(x, z) : 100;
    if (route < NEAR_MIN_DISTANCE + rand() * 2) continue;

    const y = groundHeight(x, z);
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

  // ---------- 2. Build the meshes ----------
  const nearMat = makeNearMaterial();
  const pineMesh = makeNearInstanced(buildSoftPine(), near.pine, nearMat, 'near-pines');
  const oakMesh = makeNearInstanced(buildSoftOak(), near.oak, nearMat, 'near-oaks');
  const cardMesh = makeCards(cards);
  scene.add(pineMesh, oakMesh, cardMesh);

  // ---------- 3. Colours that change from night to pre-dawn ----------
  const night = mapColors(PALETTE.night);
  const dawn = mapColors(PALETTE.dawn);
  function setDawn(t) {
    nearMat.uniforms.uBottom.value.lerpColors(night.nearBottom, dawn.nearBottom, t);
    nearMat.uniforms.uTop.value.lerpColors(night.nearTop, dawn.nearTop, t);
    nearMat.uniforms.uTrunk.value.lerpColors(night.trunk, dawn.trunk, t);
    cardMesh.material.uniforms.uBottom.value.lerpColors(night.cardBottom, dawn.cardBottom, t);
    cardMesh.material.uniforms.uTop.value.lerpColors(night.cardTop, dawn.cardTop, t);
    shared.uRim.value.lerpColors(night.rim, dawn.rim, t);
  }
  setDawn(0);

  return {
    count: near.pine.length + near.oak.length + cards.length,
    counts: { nearPines: near.pine.length, nearOaks: near.oak.length, cards: cards.length },
    setDawn,
    update(time) {
      shared.uWind.value = time;
      // Mist at the trees' feet takes the sky's horizon colour (so it follows the dawn).
      if (sky) shared.uMistColor.value.copy(sky.colors.horizon).lerp(WHITE, 0.18);
    },
  };
}

const WHITE = new THREE.Color('#dfe6ff');

function mapColors(p) {
  const out = {};
  for (const k in p) out[k] = new THREE.Color(p[k]);
  return out;
}

// =====================================================================
// NEAR TREES: smooth 3D shapes with a painted gradient shader
// =====================================================================
function makeNearMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uBottom: { value: new THREE.Color() },
      uTop: { value: new THREE.Color() },
      uTrunk: { value: new THREE.Color() },
    }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute float aTrunk;      // 1 on trunk vertices, 0 on foliage
      uniform float uWind;
      varying float vH, vTrunk;
      varying vec3 vNormalW, vWorld, vTint;
      void main() {
        vec3 p = position;
        // Gentle sway: tops move, roots stay still, each tree on its own rhythm.
        float phase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;
        float bend = p.y * p.y;
        p.x += sin(uWind * 0.9 + phase) * 0.012 * bend;
        p.z += cos(uWind * 0.7 + phase) * 0.008 * bend;

        mat4 m = modelMatrix * instanceMatrix;
        vec4 world = m * vec4(p, 1.0);
        vWorld = world.xyz;
        // Lean the normals towards "pointing out from the trunk", so the shape shades
        // like one soft rounded form instead of many small facets.
        vec3 radial = normalize(vec3(position.x, 0.3, position.z) + vec3(1e-5));
        vNormalW = normalize(mat3(m) * normalize(mix(normal, radial, 0.55)));
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
      uniform vec3 uBottom, uTop, uTrunk, uRim, uMoonDir, uWarmPos, uWarmColor;
      varying float vH, vTrunk;
      varying vec3 vNormalW, vWorld, vTint;
      void main() {
        vec3 n = normalize(vNormalW);
        vec3 v = normalize(cameraPosition - vWorld);

        // 1. The painted gradient: darker low, lighter high. Never near-black.
        vec3 col = mix(uBottom, uTop, smoothstep(0.05, 0.95, vH)) * vTint;
        col = mix(col, uTrunk, step(0.5, vTrunk));

        // 2. A very soft hint of form from the moon (wrapped, so there is no hard shadow side).
        float wrap = dot(n, uMoonDir) * 0.5 + 0.5;
        col *= mix(0.88, 1.1, wrap);

        // 3. Cool moonlit rim on the edges that face the moon's side.
        float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
        vec2 nSide = normalize(n.xz + vec2(1e-5));
        float side = smoothstep(-0.2, 0.8, dot(nSide, normalize(uMoonDir.xz)));
        col += uRim * fres * side * 0.42 * (1.0 - vTrunk);

        // 4. Warm glow from the base camp tent on nearby trees.
        vec3 toWarm = uWarmPos - vWorld;
        float d2 = dot(toWarm, toWarm);
        float facing = 0.35 + 0.65 * max(dot(n, normalize(toWarm)), 0.0);
        col += uWarmColor * (0.9 / (1.0 + d2 * 0.14)) * facing * 0.5;   // strong close by, fades fast

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

function makeNearInstanced(geometry, trees, material, name) {
  // Each mesh needs the shared uniforms (wind, rim, warm light) linked into its material.
  Object.assign(material.uniforms, {
    uWind: shared.uWind, uMoonDir: shared.uMoonDir, uRim: shared.uRim,
    uWarmPos: shared.uWarmPos, uWarmColor: shared.uWarmColor,
  });
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

// A pine "turned" on a lathe: a smooth outline with gentle scallops (soft layers of
// branches) that taper to a point. Each tree outline is slightly lopsided, so it feels drawn.
function buildSoftPine() {
  const rand = seededRandom(7);
  const radial = 16, rows = 34;
  const positions = [], trunkFlag = [], indices = [];
  const tiers = 5;
  const lobes = Array.from({ length: radial }, () => 0.9 + rand() * 0.2); // lopsidedness per direction
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;                         // 0 at the bottom of the foliage, 1 at the tip
    const y = 0.08 + t * 0.92;
    // Overall taper, plus soft scallops (rounded, never stepped).
    const scallop = 0.5 + 0.5 * Math.cos(t * tiers * Math.PI * 2);
    // Soft scallops: each "layer" of branches bulges out and tucks in, smoothly.
    const radius = 0.26 * Math.pow(1 - t, 0.95) * (0.76 + 0.24 * Math.pow(scallop, 1.6));
    for (let a = 0; a < radial; a++) {
      const ang = (a / radial) * Math.PI * 2;
      const k = lobes[a] * radius;
      positions.push(Math.cos(ang) * k, y, Math.sin(ang) * k);
      trunkFlag.push(0);
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
  trunkFlag.push(0);
  for (let a = 0; a < radial; a++) indices.push(centre, a, (a + 1) % radial);

  const foliage = new THREE.BufferGeometry();
  foliage.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  foliage.setAttribute('aTrunk', new THREE.Float32BufferAttribute(trunkFlag, 1));
  foliage.setIndex(indices);
  foliage.computeVertexNormals();

  const trunk = new THREE.CylinderGeometry(0.014, 0.024, 0.12, 8);
  trunk.translate(0, 0.06, 0);
  trunk.setAttribute('aTrunk', new THREE.Float32BufferAttribute(new Array(trunk.attributes.position.count).fill(1), 1));
  trunk.deleteAttribute('uv');   // trees use no textures; all parts must share the same attributes
  return mergeGeometries([foliage.toNonIndexed(), trunk.toNonIndexed()]);
}

// An oak: a cluster of smooth round clumps on a short trunk.
function buildSoftOak() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.03, 0.05, 0.45, 8);
  trunk.translate(0, 0.22, 0);
  trunk.setAttribute('aTrunk', new THREE.Float32BufferAttribute(new Array(trunk.attributes.position.count).fill(1), 1));
  parts.push(trunk.toNonIndexed());
  const clumps = [
    [0, 0.66, 0, 0.27], [0.17, 0.57, 0.05, 0.2], [-0.16, 0.58, -0.04, 0.21],
    [0.04, 0.58, 0.17, 0.19], [-0.05, 0.57, -0.16, 0.19], [0.02, 0.84, 0.02, 0.18],
  ];
  for (const [x, y, z, r] of clumps) {
    const s = new THREE.SphereGeometry(r, 18, 12);
    s.translate(x, y, z);
    s.setAttribute('aTrunk', new THREE.Float32BufferAttribute(new Array(s.attributes.position.count).fill(0), 1));
    parts.push(s.toNonIndexed());
  }
  parts.forEach((g) => g.deleteAttribute('uv'));   // no textures on trees
  return mergeGeometries(parts);
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
      uBottom: { value: new THREE.Color() },
      uTop: { value: new THREE.Color() },
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
        col += uRim * t.g * 0.06;     // only a whisper of moonlight on far trees
        // Mist gathers at the feet of each tree (the style-4 look).
        col = mix(col, uMistColor, (1.0 - smoothstep(0.0, 0.35, vUv.y)) * 0.3);

        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  material.uniforms.uAtlas.value = atlas;
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
