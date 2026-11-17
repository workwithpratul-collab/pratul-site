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
