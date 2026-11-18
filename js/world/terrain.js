// terrain.js: the land. Two parts:
//  1. Distant mountains: 4 painted silhouette layers far away (like stage scenery).
//  2. The ground you walk on, with the trail (added in step 5).

import * as THREE from 'three';
import { NOISE_GLSL } from './glsl.js';
import { mood, MATERIALS } from './palette.js';

// ---------- A tiny seeded random generator ----------
// Math.random() gives different mountains every reload. A "seeded" random gives the
// same sequence every time, so the world always looks the same.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1D noise for mountain outlines: random heights at fixed steps, blended smoothly.
function makeNoise1D(seed, count = 512) {
  const rand = seededRandom(seed);
  const values = Array.from({ length: count }, () => rand());
  return function (x) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    const a = values[((i % count) + count) % count];
    const b = values[(((i + 1) % count) + count) % count];
    return a + (b - a) * u;
  };
}

// ---------- The four mountain layers, nearest first ----------
// radius: distance from the middle of the world. base/amp: base height and peak size (metres).
// peaks: how many big mountains fit around the full circle. rough: how jagged the crests are.
// trees: height of the little tree "fuzz" on the skyline (only near, forested ranges).
// haze: how much the layer melts into the sky colour (far = more).
// Each layer's rock colour comes from the palette (mood.mountains.layers), nearest first.
const MOUNTAIN_LAYERS = [
  { radius: 420,  base: 14,  amp: 60,  peaks: 14, rough: 0.10, trees: 7, haze: 0.14, snow: 0,    seed: 11, columns: 3200 },
  { radius: 800,  base: 30,  amp: 140, peaks: 16, rough: 0.16, trees: 9, haze: 0.32, snow: 0,    seed: 23, columns: 2400 },
  { radius: 1450, base: 60,  amp: 330, peaks: 20, rough: 0.28, trees: 0, haze: 0.50, snow: 0, seed: 37, columns: 1400 },
  { radius: 2500, base: 120, amp: 820, peaks: 22, rough: 0.34, trees: 0, haze: 0.52, snow: 1.0,  seed: 51, columns: 1400 },
];

// The centre the mountain rings are drawn around (about the middle of the walk).
const RING_CENTRE = new THREE.Vector3(0, 0, -80);

export function createMountains(scene) {
  const group = new THREE.Group();
  group.name = 'mountains';
  const layers = MOUNTAIN_LAYERS.map((layer, index) => buildMountainLayer(layer, index));
  layers.forEach((mesh) => group.add(mesh));
  scene.add(group);
  // Colours follow the palette by themselves (shared colour objects); only the snow's
  // warmth is a plain number, so it is copied across here every frame.
  group.userData.applyMood = () => {
    for (const mesh of layers) mesh.userData.material.uniforms.uGlowStrength.value = mood.mountains.snowWarmth;
  };
  // Which side of each peak catches the light: 1 = left (the moon in the film), -1 = right.
  group.userData.setLitSide = (side) => {
    for (const mesh of layers) mesh.userData.material.uniforms.uLitSide.value = side;
  };
  // As we climb above them (0 = from the valley, 1 = from the summit), the nearer ranges
  // sink below the sea of clouds and the farthest one becomes a low line on the horizon,
  // like in the summit style frame. Nothing pops: they slide down slowly with the climb.
  const SINK = [130, 210, 330, 0];
  group.userData.setRise = (t) => {
    layers.forEach((mesh, i) => {
      mesh.position.y = -SINK[i] * t;
      mesh.visible = !(i < 3 && t > 0.999);   // fully sunk: don't draw them at all
    });
    const far = layers[3];
    const s = 1 + 0.6 * t;
    far.scale.set(s, 1 - 0.58 * t, s);
    // Scale around the ring centre, not the world's origin.
    far.position.x = RING_CENTRE.x * (1 - s);
    far.position.z = RING_CENTRE.z * (1 - s);
  };
  return group;
}

function buildMountainLayer(layer, index) {
  const columns = layer.columns; // how many vertical slices make up the outline
  const bottom = -260;           // the foot of the layer, far below the horizon
  // Each noise "table" has exactly as many cells as we walk through around the circle,
  // so the outline joins up perfectly with no seam.
  const big = makeNoise1D(layer.seed, layer.peaks);
  const mid = makeNoise1D(layer.seed + 7, layer.peaks * 4);
  const fine = makeNoise1D(layer.seed + 13, layer.peaks * 16);
  const trees = makeNoise1D(layer.seed + 29, columns);

  // 1. Work out the outline height for every slice around the circle.
  const heights = [];
  const broad = []; // just the big shapes, used to decide the lit/shadow side
  for (let i = 0; i <= columns; i++) {
    const f = i / columns;                 // 0..1 around the circle
    const angle = f * Math.PI * 2;
    // Big massifs: smooth noise, pushed up into peaks.
    let shape = Math.pow(big(f * layer.peaks), 1.6);
    // Ridged crests: folding noise around 0.5 makes sharp ridgelines.
    const ridged = 1 - Math.abs(mid(f * layer.peaks * 4) * 2 - 1);
    const jag = fine(f * layer.peaks * 16);
    let h = shape * 0.78 + ridged * layer.rough * 0.8 + jag * layer.rough * 0.25;
    // Taller mountains in front of the walker (towards -Z), lower behind.
    const facing = 0.5 + 0.5 * Math.pow(0.5 + 0.5 * Math.cos(angle), 1.5);
    h = layer.base + layer.amp * h * facing;
    // Tiny tree tips along forested skylines.
    if (layer.trees) h += Math.pow(trees(f * columns), 3) * layer.trees;
    heights.push(h);
    broad.push(layer.base + layer.amp * shape * facing);
  }

  // 2. Build a ribbon: two vertices per slice (top on the outline, bottom far below).
  const positions = [];
  const crest = [];   // outline height, so the shader knows how far below the top a pixel is
  const slope = [];   // which way the outline leans: lit side or shadow side
  const indices = [];
  for (let i = 0; i <= columns; i++) {
    const angle = (i / columns) * Math.PI * 2;
    // Angle 0 points to -Z (straight ahead along the trail).
    const x = RING_CENTRE.x + Math.sin(angle) * layer.radius;
    const z = RING_CENTRE.z - Math.cos(angle) * layer.radius;
    // Slope of the big shape: rising to the right = faces the moon (lit side).
    const k = Math.max(3, Math.round(columns / 160));
    const prev = broad[Math.max(i - k, 0)];
    const next = broad[Math.min(i + k, columns)];
    const s = (next - prev) / (layer.amp * 0.18);
    positions.push(x, heights[i], z, x, bottom, z);
    crest.push(heights[i], heights[i]);
    slope.push(s, s);
    if (i < columns) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aCrest', new THREE.Float32BufferAttribute(crest, 1));
  geo.setAttribute('aSlope', new THREE.Float32BufferAttribute(slope, 1));
  geo.setIndex(indices);

  // 3. The painted look comes from this shader.
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      // These colour objects are the palette's live mood, so the mountains follow the time of day.
      uColor: { value: mood.mountains.layers[index] },
      uHaze: { value: mood.sky.horizon },
      uGlow: { value: mood.sky.glow },
      uValleyMist: { value: mood.mist.valley },
      uGlowStrength: { value: mood.mountains.snowWarmth },
      uHazeAmount: { value: layer.haze },
      uSnow: { value: layer.snow },
      uSnowLit: { value: mood.mountains.snowLit },
      uSnowShade: { value: mood.mountains.snowShade },
      uSnowLine: { value: layer.base + layer.amp * 0.2 },
      uLayer: { value: index },
      uLitSide: { value: 1 },     // 1 = light from the left (the moon); -1 = from the right
    },
    vertexShader: /* glsl */ `
      attribute float aCrest;
      attribute float aSlope;
      varying float vY, vCrest, vSlope;
      varying vec2 vXZ;
      void main() {
        vY = position.y;
        vCrest = aCrest;
        vSlope = aSlope;
        vXZ = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uHaze, uGlow, uSnowLit, uSnowShade, uValleyMist;
      uniform float uHazeAmount, uSnow, uSnowLine, uLayer, uGlowStrength, uLitSide;
      varying float vY, vCrest, vSlope;
      varying vec2 vXZ;
      ${NOISE_GLSL}

      void main() {
        float depth = vCrest - vY;   // metres below the outline at this point
        vec2 p = vXZ * 0.004 + uLayer * 13.0;

        // Lit or shadow side of each peak: the moon is on the left, so slopes rising
        // to the right catch light. Noise wobbles the line so it looks hand-painted.
        float wobble = (fbm(vec2(p.x * 6.0 + vY * 0.004, vY * 0.006)) - 0.5) * 1.4;
        float lit = smoothstep(-0.55, 0.55, vSlope * uLitSide + wobble);

        // Base rock colour, slightly lighter on the lit side.
        vec3 col = uColor * mix(0.85, 1.18, lit);

        // Snow: near the top of high peaks, with a broken, painterly lower edge.
        if (uSnow > 0.0) {
          float snowDepth = mix(40.0, 200.0, smoothstep(uSnowLine, uSnowLine + 500.0, vCrest));
          float edge = fbm(vec2(p.x * 14.0 + vY * 0.01, vY * 0.02)) * 0.8;
          float snow = 1.0 - smoothstep(snowDepth * (0.35 + edge), snowDepth * (0.55 + edge), depth);
          snow *= smoothstep(uSnowLine - 40.0, uSnowLine + 40.0, vCrest) * uSnow;
          vec3 snowCol = mix(uSnowShade, uSnowLit, lit);
          // At dawn, the lit snow catches a little warm light.
          snowCol = mix(snowCol, uGlow * 1.25, lit * uGlowStrength * 0.35);
          col = mix(col, snowCol, snow);
        }

        // Atmospheric haze: the whole layer leans towards the sky colour,
        // and the lower slopes melt into mist (the "valley fog" look).
        col = mix(col, uHaze, uHazeAmount);
        // Valleys fade into pale mist (the palette's valley mist colour).
        vec3 mistCol = uValleyMist;
        float valleyMist = smoothstep(vCrest * 0.2 + 20.0, -60.0, vY);
        valleyMist *= 0.75 + 0.25 * fbm(vec2(p.x * 4.0, vY * 0.02));  // uneven, like brushwork
        col = mix(col, mistCol, clamp(valleyMist, 0.0, 1.0) * 0.92);

        gl_FragColor = vec4(col + dither(gl_FragCoord.xy), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = `mountains-${index}`;
  mesh.frustumCulled = false;
  mesh.userData.material = mat;
  return mesh;
}

// =====================================================================
// 2. THE GROUND AND THE TRAIL
// =====================================================================

// The trail, drawn as a map from above: [x, z] points in metres. One continuous path from
// base camp (0, 0) to the summit.
const TRAIL_MAP = [
  // Scene 1: base camp, up through the forest to the first ridge camp (Phase 1, unchanged).
  [0.6, 2.5], [1.2, -6], [-0.5, -16], [-4.5, -27], [-5.5, -39], [-2, -51],
  [3.5, -62], [5.5, -74], [2.5, -87], [-3, -99], [-6.5, -111], [-5, -123],
  [-2, -134], [-0.5, -144],
  // Scene 2: round behind DERMAÉ to the valley rim, then east along the ridge past two more camps.
  [-2, -152], [-1, -160], [6, -167], [17, -172], [28, -174.5], [40, -175], [55, -176], [70, -174],
  [86, -169], [100, -165], [114, -167], [128, -174], [140, -186], [149, -200],
  // Scene 3: up a broad spur onto the high meadow.
  [155, -216], [159, -232], [161, -246], [163, -260], [171, -274],
  // Scene 4: the final climb, curling up onto the summit.
  [185, -284], [199, -296], [205, -312], [201, -328], [193, -340],
];
// The first 14 points are the Phase 1 trail; base camp's forest is still planted along it.
const LEGACY_POINTS = 14;

// Smooth 2D noise in JavaScript (same idea as the shader noise).
function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise2(x, z, seed = 1) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
export function smoothstep(e0, e1, x) {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}
// A "soft maximum": like Math.max, but the two shapes melt into each other over `k` metres
// instead of meeting in a sharp crease (where a ridge rises out of a slope, for example).
function smax(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

// ---------- The Phase 1 land: the climb from base camp to the ridge, and the valley beyond ----------
function baseHeight(x, z) {
  // The long climb from base camp (y = 0) up to the ridge crest (y ≈ 26).
  let y = 26 * smoothstep(-4, -146, z);
  // Beyond the crest the ground falls away into a deep valley.
  y -= 95 * smoothstep(-150, -300, z);
  // Forested slopes rise on both sides, so base camp sits in a sheltered hollow.
  const ax = Math.abs(x);
  y += 22 * smoothstep(18, 140, ax) * (1 - 0.6 * smoothstep(-150, -230, z));
  // Soft rolling bumps: one big, one small layer of noise.
  y += (noise2(x * 0.03, z * 0.03, 3) - 0.5) * 6;
  y += (noise2(x * 0.11, z * 0.11, 7) - 0.5) * 1.4;
  // A flat clearing for base camp.
  const r = Math.hypot(x + 1.5, z + 1);
  y *= smoothstep(7, 16, r);
  return y;
}

// ---------- The new land: the ridge, the meadow shelf and the summit ----------
// One long landform that follows the trail from DERMAÉ to the summit, like a spine.
// Each point: [x, z, crest height, left spread, right spread, left flat, right flat].
//  - crest height: how high the land is along the spine (metres)
//  - spread: how gently the land falls away on each side (bigger = gentler slope)
//  - flat: how many metres stay level either side of the spine before it starts to fall
//  - steep (optional 8th value): a straight slope added on top (metres down per metre out).
//    The summit uses it: its flanks fall in straight lines like a real peak, not a round dome.
// "Left" and "right" are as seen walking up the trail. On the ridge, left is the valley side.
const LAND = [
  [4, -162, 21, 14, 12, 2, 3],
  [13, -169, 21, 14, 12, 2, 3],
  [26, -173, 21.5, 16, 14, 3, 7],
  [40, -175, 23, 18, 16, 6, 8],        // King's Garden camp
  [55, -176, 26.5, 18, 22, 3, 5],
  [70, -174, 32, 18, 30, 3, 5],
  [86, -169, 39, 20, 30, 3, 6],
  [100, -165, 43, 20, 30, 4, 8],       // Trinetra camp
  [114, -167, 46, 20, 30, 3, 5],
  [128, -174, 49, 22, 30, 3, 5],
  [140, -186, 52, 24, 30, 4, 6],
  [149, -200, 55, 26, 34, 6, 10],
  [155, -216, 57, 28, 40, 16, 40],     // the meadow begins: broad and nearly level
  [159, -232, 58, 30, 44, 22, 55],
  [161, -246, 58.5, 30, 44, 24, 60],   // the gear check
  [163, -260, 59, 30, 40, 22, 50],
  [171, -274, 62, 26, 30, 10, 20, 0],
  [185, -284, 70, 30, 30, 2.5, 2.5, 0.55],   // the summit ridge: a narrow arête, steep both sides
  [199, -296, 82, 34, 34, 2, 2, 0.8],
  [205, -312, 96, 36, 36, 2, 2, 0.95],
  [201, -328, 110, 40, 40, 2, 2, 1.05],
  [193, -340, 122, 40, 40, 3, 3, 1.1],       // the summit
];
export const SUMMIT_HEIGHT = 122;

// Height of the new landform at (x, z), or -Infinity far away from it.
// It also remembers how far the point was from the spine (landDistance), for the rocky ribs.
let landDistance = Infinity;
function landHeight(x, z) {
  let best = -Infinity;
  landDistance = Infinity;
  for (let i = 0; i < LAND.length - 1; i++) {
    const a = LAND[i], b = LAND[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len2 = dx * dx + dz * dz;
    // The closest point on this piece of spine, and how far along it is (0..1).
    const t = Math.min(Math.max(((x - a[0]) * dx + (z - a[1]) * dz) / len2, 0), 1);
    const px = x - (a[0] + dx * t), pz = z - (a[1] + dz * t);
    const d = Math.hypot(px, pz);
    if (d > 160) continue;
    if (d < landDistance) landDistance = d;
    // How far to the left of the walking direction (dz, -dx) the point is. The left and
    // right slopes blend over a few metres, so there is never a crease where they meet.
    const sideways = (px * dz - pz * dx) / Math.sqrt(len2);
    const left = smoothstep(-5, 5, sideways);
    const e = a[2] + (b[2] - a[2]) * t;
    const spreadL = a[3] + (b[3] - a[3]) * t, spreadR = a[4] + (b[4] - a[4]) * t;
    const flatL = a[5] + (b[5] - a[5]) * t, flatR = a[6] + (b[6] - a[6]) * t;
    const spread = spreadR + (spreadL - spreadR) * left;
    const flat = flatR + (flatL - flatR) * left;
    const out = Math.max(d - flat, 0);
    const steep = (a[7] ?? 0) + ((b[7] ?? 0) - (a[7] ?? 0)) * t;
    const h = e - (out * out) / (2 * spread) - out * steep;
    best = best === -Infinity ? h : smax(best, h, 3);
  }
  // Near DERMAÉ the Phase 1 land already forms the ridge, so the new landform fades away
  // there (sinks far below it) and leaves the first camp's ground exactly as it was.
  return best - 40 * (1 - smoothstep(6, 22, x));
}

// Small level "pads" where things stand: the camps, the gear-check mat, the summit.
// [x, z, radius, lift] (lift raises a pad into a little knoll).
const PADS = [
  [41.5, -184.5, 7, 0],        // King's Garden screen
  [36, -174.6, 4, 0],          // where the trekker watches it
  [106, -158.5, 9, 1.4],       // Trinetra's knoll
  [162.75, -245.8, 5, 0],      // the gear-check mat
  [193, -340, 4.5, 0],         // the summit top
];

// The shape of the land before the trail is trodden into it.
function shapeHeight(x, z) {
  const base = baseHeight(x, z);
  const land = landHeight(x, z);
  if (land < base - 6) return base;                 // far from the new land: Phase 1 exactly
  let y = smax(base, land, 6);
  // How much this point belongs to the new landform (0..1).
  const onLand = smoothstep(-6, 3, land - base);
  // Gentle rolls on the grass, larger swells on the meadow, wind-carved ripples up high.
  y += ((noise2(x * 0.045, z * 0.045, 61) - 0.5) * 2.4 + (noise2(x * 0.16, z * 0.16, 63) - 0.5) * 0.5) * onLand;
  // The meadow rolls in long, slow swells (calmer close to the path, so it stays walkable).
  y += (noise2(x * 0.022, z * 0.022, 57) - 0.5) * 9 * meadowAmount(x, z) * onLand * smoothstep(6, 26, landDistance);
  // Rocky ribs on the summit's steep sides (calm near the spine, where we walk).
  const high = smoothstep(64, 90, land);
  // (Ridged noise: folding smooth noise in half makes sharp-topped ribs, like rock buttresses.)
  const rib = (1 - Math.abs(noise2(x * 0.09, z * 0.09, 93) * 2 - 1)) * 6
    + (1 - Math.abs(noise2(x * 0.21, z * 0.21, 95) * 2 - 1)) * 1.8
    + (noise2(x * 0.05, z * 0.05, 91) - 0.5) * 6;
  y += rib * high * onLand * smoothstep(5, 18, landDistance);
  return y;
}

// Pads: worked out once, from the land around them.
const PAD_LEVELS = PADS.map(([x, z, r, lift]) => ({ x, z, r, y: shapeHeight(x, z) + lift }));
function padded(x, z, y) {
  for (const p of PAD_LEVELS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r) y += (p.y - y) * (1 - smoothstep(p.r * 0.45, p.r, d));
  }
  return y;
}
function landShape(x, z) {
  return padded(x, z, shapeHeight(x, z));
}

// ---------- The trail, sampled densely, with a quick "nearest point" lookup ----------
const trailSpline2D = new THREE.CatmullRomCurve3(
  TRAIL_MAP.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal'
);
// Measure the curve finely (every ~13 cm), so "metres along the trail" is exact and the
// trekker walks at an even pace.
trailSpline2D.arcLengthDivisions = 4000;
export const TRAIL_LENGTH = trailSpline2D.getLength();

// A point on the trail, `s` metres from the start (measured on the map), standing on the ground.
// Everything that moves along the trail (the trekker, the camera rail) uses these two.
export function trailPointAt(s, target = new THREE.Vector3()) {
  trailSpline2D.getPointAt(Math.min(Math.max(s / TRAIL_LENGTH, 0), 1), target);
  target.y = groundHeight(target.x, target.z);
  return target;
}
// The direction the trail runs at `s` metres (flat, along the ground).
export function trailDirectionAt(s, target = new THREE.Vector3()) {
  return trailSpline2D.getTangentAt(Math.min(Math.max(s / TRAIL_LENGTH, 0), 1), target);
}
const SAMPLE_COUNT = Math.round(TRAIL_LENGTH * 4);   // one sample every 25 cm
const TRAIL_SAMPLES = trailSpline2D.getSpacedPoints(SAMPLE_COUNT).map((p, i) => ({
  x: p.x, z: p.z, y: landShape(p.x, p.z), s: (i / SAMPLE_COUNT) * TRAIL_LENGTH,
}));

// The samples are sorted into a grid of 10 m squares, so a lookup only checks nearby ones.
const BUCKET = 10;
const buckets = new Map();
const bucketKey = (ix, iz) => ix * 100003 + iz;
for (const p of TRAIL_SAMPLES) {
  const key = bucketKey(Math.floor(p.x / BUCKET), Math.floor(p.z / BUCKET));
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(p);
}

// Distance from (x, z) to the trail (exact up to 10 m; further away it says Infinity),
// plus the trail's height there and how far along the trail (metres) that nearest point is.
const FAR = { distance: Infinity, y: 0, s: 0 };
export function nearestTrail(x, z) {
  const bx = Math.floor(x / BUCKET), bz = Math.floor(z / BUCKET);
  let best = Infinity, hit = null;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const list = buckets.get(bucketKey(bx + i, bz + j));
      if (!list) continue;
      for (const p of list) {
        const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
        if (d < best) { best = d; hit = p; }
      }
    }
  }
  if (!hit || best > BUCKET * BUCKET) return FAR;
  return { distance: Math.sqrt(best), y: hit.y, s: hit.s };
}

// THE height function everyone uses: ground, trail, trees, tents and the trekker's feet.
export function getHeight(x, z) {
  const shape = landShape(x, z);
  const t = nearestTrail(x, z);
  if (t.distance === Infinity) return shape;
  // Near the trail, flatten the ground sideways so the path is a walkable shelf.
  const flatten = 1 - smoothstep(1.4, 6, t.distance);
  return shape + (t.y - shape) * flatten;
}

// How far along the trail (metres) the point nearest to (x, z) is. For placing things.
export function trailDistanceAt(x, z) {
  let best = Infinity, s = 0;
  for (const p of TRAIL_SAMPLES) {
    const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
    if (d < best) { best = d; s = p.s; }
  }
  return s;
}


// ---------- The Phase 1 world, kept for planting base camp's forest exactly as it was ----------
// The forest is scattered with a seeded random sequence along the Phase 1 trail. Replaying it
// with the Phase 1 trail and land keeps every tree of base camp and DERMAÉ where it was.
const legacySpline = new THREE.CatmullRomCurve3(
  TRAIL_MAP.slice(0, LEGACY_POINTS).map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal'
);
const LEGACY_SAMPLES = legacySpline.getSpacedPoints(700).map((p) => ({ x: p.x, z: p.z, y: baseHeight(p.x, p.z) }));
const LEGACY_BOUNDS = LEGACY_SAMPLES.reduce(
  (b, p) => ({ minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x), minZ: Math.min(b.minZ, p.z), maxZ: Math.max(b.maxZ, p.z) }),
  { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
);
function legacyNearestTrail(x, z) {
  const pad = 14;
  const b = LEGACY_BOUNDS;
  if (x < b.minX - pad || x > b.maxX + pad || z < b.minZ - pad || z > b.maxZ + pad) return { distance: Infinity, y: 0 };
  let best = Infinity, bestY = 0;
  for (const p of LEGACY_SAMPLES) {
    const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
    if (d < best) { best = d; bestY = p.y; }
  }
  return { distance: Math.sqrt(best), y: bestY };
}
function legacyHeight(x, z) {
  const base = baseHeight(x, z);
  const t = legacyNearestTrail(x, z);
  if (t.distance === Infinity) return base;
  return base + (t.y - base) * (1 - smoothstep(1.4, 6, t.distance));
}
export const legacy = {
  nearestTrail: legacyNearestTrail,
  height: legacyHeight,
  trailCurve: new THREE.CatmullRomCurve3(
    legacySpline.getSpacedPoints(160).map((p) => new THREE.Vector3(p.x, legacyHeight(p.x, p.z), p.z)), false, 'centripetal'
  ),
};

// =====================================================================
// The ground mesh
// =====================================================================
// Painted ground colours (from palette.js). These are the surface colours in neutral light:
// the cool moonlight turns them blue at night, the low sun gold at the top.
const GROUND = Object.fromEntries(
  ['forest', 'moss', 'grass', 'grassLit', 'valley', 'earth'].map((k) => [k, new THREE.Color(MATERIALS.ground[k])])
);
const MEADOW_COL = {
  grass: new THREE.Color(MATERIALS.meadow.grass),
  lit: new THREE.Color(MATERIALS.meadow.grassLit),
  deep: new THREE.Color(MATERIALS.meadow.grassDeep),
};
const SNOW = {
  snow: new THREE.Color(MATERIALS.summit.snow),
  shade: new THREE.Color(MATERIALS.summit.snowShade),
  rock: new THREE.Color(MATERIALS.summit.rock),
};

// The ground is one big grid of points, about one every 1.3 m (the same grid as Phase 1, made
// wider to reach the summit). It is cut into square chunks, so three.js can skip drawing the
// chunks that are outside the camera's view.
const GRID = { minX: -260, minZ: -490, cellX: 1.3, cellZ: 560 / 430, segX: 446, segZ: 430 };
const CHUNK = 64;   // cells per chunk side
let gridHeights = null; // filled in by createGround()

// Height of the ground *as it is actually drawn*. The ground is made of flat triangles,
// so between grid points it is slightly different from getHeight(). Anything that must
// sit exactly on the visible surface (path, tents, feet) uses this.
export function groundHeight(x, z) {
  if (!gridHeights) return getHeight(x, z);
  const gx = (x - GRID.minX) / GRID.cellX, gz = (z - GRID.minZ) / GRID.cellZ;
  const ix = Math.min(Math.max(Math.floor(gx), 0), GRID.segX - 1);
  const iz = Math.min(Math.max(Math.floor(gz), 0), GRID.segZ - 1);
  const fx = gx - ix, fz = gz - iz;
  const row = GRID.segX + 1;
  const hA = gridHeights[iz * row + ix];           // this corner
  const hD = gridHeights[iz * row + ix + 1];       // one step in x
  const hB = gridHeights[(iz + 1) * row + ix];     // one step in z
  const hC = gridHeights[(iz + 1) * row + ix + 1]; // diagonal corner
  // Each grid square is two triangles split along the B-D diagonal.
  if (fx + fz <= 1) return hA + (hD - hA) * fx + (hB - hA) * fz;
  return hC + (hB - hC) * (1 - fx) + (hD - hC) * (1 - fz);
}

// How much a point belongs to the meadow (0..1): the broad shelf around the gear check.
export function meadowAmount(x, z) {
  return 1 - smoothstep(38, 95, Math.hypot((x - 160) * 0.9, (z - 240) * 0.7) + (noise2(x * 0.03, z * 0.03, 71) - 0.5) * 30);
}

// The painted colour of the ground at a point (y = height, ny = how flat it is: 1 = level).
function groundColour(x, z, y, ny, c, tmp) {
  // Phase 1 colours: forest floor low down, grass higher up, painted patches from noise.
  const patch = noise2(x * 0.07, z * 0.07, 11);
  const fine = noise2(x * 0.35, z * 0.35, 5);
  const altitude = smoothstep(4, 20, y);
  c.copy(GROUND.forest).lerp(GROUND.moss, smoothstep(0.45, 0.75, patch));
  tmp.copy(GROUND.grass).lerp(GROUND.grassLit, smoothstep(0.5, 0.85, patch * 0.7 + fine * 0.3));
  c.lerp(tmp, altitude);
  c.lerp(GROUND.valley, smoothstep(5, -40, y) * smoothstep(-150, -190, z));
  // Trodden earth around base camp, broken up by noise so the edge looks natural.
  const camp = 1 - smoothstep(3.5, 8, Math.hypot(x + 2.5, z + 0.5) + (patch - 0.5) * 4);
  c.lerp(GROUND.earth, camp * 0.85);

  // The meadow: brush-stroke patches of sunlit alpine grass (like the meadow style frame).
  const meadow = meadowAmount(x, z) * smoothstep(30, 45, y);
  if (meadow > 0) {
    const stroke = noise2(x * 0.018, z * 0.055, 61);
    const mfine = noise2(x * 0.09, z * 0.2, 67);
    tmp.copy(MEADOW_COL.grass).lerp(MEADOW_COL.deep, smoothstep(0.55, 0.8, stroke));
    tmp.lerp(MEADOW_COL.lit, smoothstep(0.5, 0.85, (1 - stroke) * 0.6 + mfine * 0.4) * 0.8);
    c.lerp(tmp, meadow);
  }

  // High up: snow, dusted over the rock. Rock shows through on the steepest faces.
  const snowLine = 70 + (noise2(x * 0.06, z * 0.06, 97) - 0.5) * 12;
  const snow = smoothstep(snowLine - 6, snowLine + 6, y);
  if (snow > 0) {
    const drift = noise2(x * 0.08, z * 0.08, 97);
    tmp.copy(SNOW.snow).lerp(SNOW.shade, smoothstep(0.4, 0.8, drift) * 0.35);
    // Rock shows through where the slope is too steep for snow to stay, in streaks that run
    // down the fall line (stretched noise), like the gullies and buttresses of a real peak.
    const streak = noise2(x * 0.16 + z * 0.05, z * 0.16 - x * 0.05, 99);
    const bare = smoothstep(0.26, 0.42, 1 - ny + (drift - 0.5) * 0.2 + (streak - 0.5) * 0.5);
    tmp.lerp(SNOW.rock, bare * 0.62);
    c.lerp(tmp, snow);
  }
  // A whisper of variation so large areas never look flat.
  c.multiplyScalar(0.94 + fine * 0.12);
  return c;
}

export function createGround(scene) {
  const cols = GRID.segX + 1, rows = GRID.segZ + 1;
  // 1. Heights of every grid point.
  gridHeights = new Float32Array(cols * rows);
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      gridHeights[iz * cols + ix] = getHeight(GRID.minX + ix * GRID.cellX, GRID.minZ + iz * GRID.cellZ);
    }
  }
  // 2. Normals (which way each point faces), worked out from the whole grid at once, so
  //    neighbouring chunks shade exactly alike and their seams are invisible.
  const normals = new Float32Array(cols * rows * 3);
  const n = new THREE.Vector3();
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const hL = gridHeights[iz * cols + Math.max(ix - 1, 0)], hR = gridHeights[iz * cols + Math.min(ix + 1, cols - 1)];
      const hF = gridHeights[Math.max(iz - 1, 0) * cols + ix], hN = gridHeights[Math.min(iz + 1, rows - 1) * cols + ix];
      n.set((hL - hR) / (2 * GRID.cellX), 1, (hF - hN) / (2 * GRID.cellZ)).normalize();
      normals.set([n.x, n.y, n.z], (iz * cols + ix) * 3);
    }
  }
  // 3. Colours.
  const colors = new Float32Array(cols * rows * 3);
  const c = new THREE.Color(), tmp = new THREE.Color();
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const i = iz * cols + ix;
      groundColour(GRID.minX + ix * GRID.cellX, GRID.minZ + iz * GRID.cellZ, gridHeights[i], normals[i * 3 + 1], c, tmp);
      colors.set([c.r, c.g, c.b], i * 3);
    }
  }

  // 4. The chunks: one mesh per square of the grid, all sharing one material.
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  // The palette's ground tint multiplies every painted colour (white at night = no change).
  // It's the same colour object as the mood's, so it follows the time of day by itself.
  mat.color = mood.ground;
  const group = new THREE.Group();
  group.name = 'ground';
  for (let cz = 0; cz < GRID.segZ; cz += CHUNK) {
    for (let cx = 0; cx < GRID.segX; cx += CHUNK) {
      const nx = Math.min(CHUNK, GRID.segX - cx), nz = Math.min(CHUNK, GRID.segZ - cz);
      const count = (nx + 1) * (nz + 1);
      const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
      let k = 0;
      for (let iz = cz; iz <= cz + nz; iz++) {
        for (let ix = cx; ix <= cx + nx; ix++, k++) {
          const i = iz * cols + ix;
          pos.set([GRID.minX + ix * GRID.cellX, gridHeights[i], GRID.minZ + iz * GRID.cellZ], k * 3);
          nor.set(normals.subarray(i * 3, i * 3 + 3), k * 3);
          col.set(colors.subarray(i * 3, i * 3 + 3), k * 3);
        }
      }
      // Two triangles per square, split along the same diagonal groundHeight() assumes.
      const index = [];
      const w = nx + 1;
      for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx; ix++) {
          const a = iz * w + ix, b = (iz + 1) * w + ix, cc = (iz + 1) * w + ix + 1, d = iz * w + ix + 1;
          index.push(a, b, d, b, cc, d);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(index);
      geo.computeBoundingSphere();
      const chunk = new THREE.Mesh(geo, mat);
      chunk.name = 'ground-chunk';
      group.add(chunk);
    }
  }
  scene.add(group);
  scene.add(createTrailStrip());
  return group;
}

// The visible path: a thin strip that follows the trail, with soft see-through edges.
function createTrailStrip() {
  const steps = Math.round(TRAIL_LENGTH * 6);
  const across = [-1, -0.55, 0, 0.55, 1];   // 5 vertices from left edge to right edge
  const alpha = [0, 0.85, 1, 0.85, 0];      // edges fade out, so the path looks painted on
  const halfWidth = 0.85;
  const positions = [], colors = [], indices = [];
  const pathCol = new THREE.Color(MATERIALS.ground.path); // pale dusty earth, catches the moonlight
  const pathLit = new THREE.Color(MATERIALS.ground.pathLit);
  const snowPath = new THREE.Color(MATERIALS.summit.snowShade);   // trodden snow: a cool hollow
  const col = new THREE.Color();
  const p = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    trailSpline2D.getPointAt(u, p);
    trailSpline2D.getTangentAt(u, tangent);
    side.set(-tangent.z, 0, tangent.x).normalize();
    const metres = u * TRAIL_LENGTH;
    // The path wobbles slightly in width, like a real trodden trail; it narrows to a faint
    // track on the meadow and the summit snow.
    const narrow = 1 - 0.35 * smoothstep(380, 420, metres);
    const w = halfWidth * narrow * (0.8 + noise2(metres * 0.27, 0.5, 9) * 0.45);
    across.forEach((a, k) => {
      const x = p.x + side.x * a * w;
      const z = p.z + side.z * a * w;
      const y = groundHeight(x, z);
      positions.push(x, y + 0.03, z);
      col.copy(pathCol).lerp(pathLit, noise2(x * 0.6, z * 0.6, 4));
      col.lerp(snowPath, smoothstep(72, 84, y) * 0.8);
      // Fade the path in at the start and out at the very top, so it has no hard ends.
      const ends = smoothstep(0, 3, metres) * (1 - smoothstep(TRAIL_LENGTH - 6, TRAIL_LENGTH - 1, metres));
      colors.push(col.r, col.g, col.b, alpha[k] * 0.9 * ends);
    });
    if (i < steps) {
      const a = i * across.length, b = (i + 1) * across.length;
      for (let k = 0; k < across.length - 1; k++) {
        // Counter-clockwise order (seen from above) makes the strip face upwards.
        indices.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4)); // 4 = colour + transparency
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,       // nudges the strip towards the camera so it never flickers into the ground
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  mat.color = mood.ground;
  const strip = new THREE.Mesh(geo, mat);
  strip.name = 'trail';
  strip.renderOrder = 1;
  return strip;
}
