// terrain.js: the land. Two parts:
//  1. Distant mountains: 4 painted silhouette layers far away (like stage scenery).
//  2. The ground you walk on, with the trail (added in step 5).

import * as THREE from 'three';
import { NOISE_GLSL } from './glsl.js';

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
const MOUNTAIN_LAYERS = [
  { radius: 420,  base: 14,  amp: 60,  peaks: 14, rough: 0.10, trees: 7, color: '#0a1130', haze: 0.14, snow: 0,    seed: 11, columns: 3200 },
  { radius: 800,  base: 30,  amp: 140, peaks: 16, rough: 0.16, trees: 9, color: '#111a46', haze: 0.32, snow: 0,    seed: 23, columns: 2400 },
  { radius: 1450, base: 60,  amp: 330, peaks: 20, rough: 0.28, trees: 0, color: '#1a2660', haze: 0.50, snow: 0, seed: 37, columns: 1400 },
  { radius: 2500, base: 120, amp: 820, peaks: 22, rough: 0.34, trees: 0, color: '#283676', haze: 0.52, snow: 1.0,  seed: 51, columns: 1400 },
];

// The centre the mountain rings are drawn around (about the middle of the walk).
const RING_CENTRE = new THREE.Vector3(0, 0, -80);

export function createMountains(scene, sky) {
  const group = new THREE.Group();
  group.name = 'mountains';
  MOUNTAIN_LAYERS.forEach((layer, index) => group.add(buildMountainLayer(layer, index, sky)));
  scene.add(group);
  return group;
}

function buildMountainLayer(layer, index, sky) {
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
      uColor: { value: new THREE.Color(layer.color) },
      uHaze: { value: sky.colors.horizon },         // shared with the sky, so it shifts at dawn too
      uGlow: { value: sky.colors.glow },
      uGlowStrength: { value: 0 },
      uHazeAmount: { value: layer.haze },
      uSnow: { value: layer.snow },
      uSnowLit: { value: new THREE.Color('#9eaee4') },
      uSnowShade: { value: new THREE.Color('#4a5898') },
      uSnowLine: { value: layer.base + layer.amp * 0.2 },
      uLayer: { value: index },
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
      uniform vec3 uColor, uHaze, uGlow, uSnowLit, uSnowShade;
      uniform float uHazeAmount, uSnow, uSnowLine, uLayer, uGlowStrength;
      varying float vY, vCrest, vSlope;
      varying vec2 vXZ;
      ${NOISE_GLSL}

      void main() {
        float depth = vCrest - vY;   // metres below the outline at this point
        vec2 p = vXZ * 0.004 + uLayer * 13.0;

        // Lit or shadow side of each peak: the moon is on the left, so slopes rising
        // to the right catch light. Noise wobbles the line so it looks hand-painted.
        float wobble = (fbm(vec2(p.x * 6.0 + vY * 0.004, vY * 0.006)) - 0.5) * 1.4;
        float lit = smoothstep(-0.55, 0.55, vSlope + wobble);

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
        float valleyMist = smoothstep(vCrest * 0.15 + 30.0, -40.0, vY);
        float haze = clamp(uHazeAmount + valleyMist * (1.0 - uHazeAmount) * 0.85, 0.0, 1.0);
        col = mix(col, uHaze, haze);

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

// The trail, drawn as a map from above: [x, z] points in metres.
// It starts at base camp (0, 0) and winds up to the first ridge camp (around z = -150).
const TRAIL_MAP = [
  [0.6, 2.5], [1.2, -6], [-0.5, -16], [-4.5, -27], [-5.5, -39], [-2, -51],
  [3.5, -62], [5.5, -74], [2.5, -87], [-3, -99], [-6.5, -111], [-5, -123],
  [-2, -134], [-0.5, -144],
];

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

// The basic shape of the land, before the trail is carved in.
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

// Sample the trail densely once, so we can quickly find "how far is this point from the trail?".
const trailSpline2D = new THREE.CatmullRomCurve3(
  TRAIL_MAP.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal'
);
const TRAIL_SAMPLES = trailSpline2D.getSpacedPoints(700).map((p) => ({ x: p.x, z: p.z, y: baseHeight(p.x, p.z) }));
const TRAIL_BOUNDS = TRAIL_SAMPLES.reduce(
  (b, p) => ({ minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x), minZ: Math.min(b.minZ, p.z), maxZ: Math.max(b.maxZ, p.z) }),
  { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
);

// Distance from (x, z) to the trail, plus the trail's height at the nearest point.
export function nearestTrail(x, z) {
  const pad = 14;
  if (x < TRAIL_BOUNDS.minX - pad || x > TRAIL_BOUNDS.maxX + pad || z < TRAIL_BOUNDS.minZ - pad || z > TRAIL_BOUNDS.maxZ + pad) {
    return { distance: Infinity, y: 0 };
  }
  let best = Infinity, bestY = 0;
  for (const p of TRAIL_SAMPLES) {
    const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
    if (d < best) { best = d; bestY = p.y; }
  }
  return { distance: Math.sqrt(best), y: bestY };
}

// THE height function everyone uses: ground, trail, trees, tents and the trekker's feet.
export function getHeight(x, z) {
  const base = baseHeight(x, z);
  const t = nearestTrail(x, z);
  if (t.distance === Infinity) return base;
  // Near the trail, flatten the ground sideways so the path is a walkable shelf.
  const flatten = 1 - smoothstep(1.4, 6, t.distance);
  return base + (t.y - base) * flatten;
}

// The trail as a 3D curve on the ground: the trekker walks along this.
export const trailCurve = new THREE.CatmullRomCurve3(
  trailSpline2D.getSpacedPoints(160).map((p) => new THREE.Vector3(p.x, getHeight(p.x, p.z), p.z)),
  false, 'centripetal'
);

// Painted ground colours. These are the surface colours in neutral light: the cool
// moonlight turns them blue at night, the lantern turns them warm near camp.
const GROUND = {
  forest: new THREE.Color('#4f6e6a'),   // blue-green forest floor
  moss: new THREE.Color('#5f8172'),     // slightly lighter mossy patches
  grass: new THREE.Color('#71927c'),    // open grassy slopes higher up
  grassLit: new THREE.Color('#87a88a'), // lighter grass patches
  valley: new THREE.Color('#3e5464'),   // the deep valley beyond the ridge
};

// The ground grid: 520 m wide, 560 m deep, one vertex roughly every 1.3 m.
const GRID = { width: 520, depth: 560, segX: 400, segZ: 430, minX: -260, minZ: -490 };
let gridHeights = null; // filled in by createGround()

// Height of the ground *as it is actually drawn*. The ground is made of flat triangles,
// so between grid points it is slightly different from getHeight(). Anything that must
// sit exactly on the visible surface (path, tents, feet) uses this.
export function groundHeight(x, z) {
  if (!gridHeights) return getHeight(x, z);
  const cellX = GRID.width / GRID.segX, cellZ = GRID.depth / GRID.segZ;
  const gx = (x - GRID.minX) / cellX, gz = (z - GRID.minZ) / cellZ;
  const ix = Math.min(Math.max(Math.floor(gx), 0), GRID.segX - 1);
  const iz = Math.min(Math.max(Math.floor(gz), 0), GRID.segZ - 1);
  const fx = gx - ix, fz = gz - iz;
  const row = GRID.segX + 1;
  const hA = gridHeights[iz * row + ix];           // this corner
  const hD = gridHeights[iz * row + ix + 1];       // one step in x
  const hB = gridHeights[(iz + 1) * row + ix];     // one step in z
  const hC = gridHeights[(iz + 1) * row + ix + 1]; // diagonal corner
  // Each grid square is two triangles split along the B-D diagonal (same as three.js does).
  if (fx + fz <= 1) return hA + (hD - hA) * fx + (hB - hA) * fz;
  return hC + (hB - hC) * (1 - fx) + (hD - hC) * (1 - fz);
}

export function createGround(scene) {
  // A big grid of points. Each vertex gets its height from getHeight().
  const geo = new THREE.PlaneGeometry(GRID.width, GRID.depth, GRID.segX, GRID.segZ);
  geo.rotateX(-Math.PI / 2);                      // lay the plane flat
  geo.translate(0, 0, GRID.minZ + GRID.depth / 2); // from z = -490 (valley) to z = +70 (behind camp)

  const pos = geo.attributes.position;
  // After rotating, rows run from far (-z) to near (+z), matching groundHeight() above.
  gridHeights = new Float32Array(pos.count);
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const grass = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = getHeight(x, z);
    pos.setY(i, y);
    gridHeights[i] = y;

    // Colour: forest floor low down, grass higher up, painted patches from noise.
    const patch = noise2(x * 0.07, z * 0.07, 11);
    const fine = noise2(x * 0.35, z * 0.35, 5);
    const altitude = smoothstep(4, 20, y);
    c.copy(GROUND.forest).lerp(GROUND.moss, smoothstep(0.45, 0.75, patch));
    grass.copy(GROUND.grass).lerp(GROUND.grassLit, smoothstep(0.5, 0.85, patch * 0.7 + fine * 0.3));
    c.lerp(grass, altitude);
    c.lerp(GROUND.valley, smoothstep(5, -40, y) * smoothstep(-150, -190, z));
    // A whisper of variation so large areas never look flat.
    c.multiplyScalar(0.94 + fine * 0.12);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const ground = new THREE.Mesh(geo, mat);
  ground.name = 'ground';
  scene.add(ground);

  scene.add(createTrailStrip());
  return ground;
}

// The visible path: a thin strip that follows the trail, with soft see-through edges.
function createTrailStrip() {
  const steps = 900;
  const across = [-1, -0.55, 0, 0.55, 1];   // 5 vertices from left edge to right edge
  const alpha = [0, 0.85, 1, 0.85, 0];      // edges fade out, so the path looks painted on
  const halfWidth = 0.85;
  const positions = [], colors = [], indices = [];
  const pathCol = new THREE.Color('#9b9a9f'); // pale dusty earth, catches the moonlight
  const pathLit = new THREE.Color('#b3ad9f');
  const col = new THREE.Color();
  const p = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    trailSpline2D.getPointAt(u, p);
    trailSpline2D.getTangentAt(u, tangent);
    side.set(-tangent.z, 0, tangent.x).normalize();
    // The path wobbles slightly in width, like a real trodden trail.
    const w = halfWidth * (0.8 + noise2(u * 40, 0.5, 9) * 0.45);
    across.forEach((a, k) => {
      const x = p.x + side.x * a * w;
      const z = p.z + side.z * a * w;
      positions.push(x, groundHeight(x, z) + 0.03, z);
      col.copy(pathCol).lerp(pathLit, noise2(x * 0.6, z * 0.6, 4));
      // Fade the path in at the start and out at the end, so it has no hard edges.
      const ends = smoothstep(0, 0.02, u) * (1 - smoothstep(0.97, 1, u));
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
  const strip = new THREE.Mesh(geo, mat);
  strip.name = 'trail';
  strip.renderOrder = 1;
  return strip;
}
