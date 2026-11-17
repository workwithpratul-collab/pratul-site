// summit.js: scene 4, the summit at sunrise (style-frame version).
//
// We stand on a snowy summit above a sea of glowing clouds. Other snow peaks rise out of
// the clouds, the sun breaks at the horizon, and a flag (the "Book a call" moment) flies
// from the highest point. Colours come from palette.js (the "sunrise" preset).
//
// This is a style frame: enough to judge colour, light and mood, not the finished scene.

import * as THREE from 'three';
import { createSky } from './sky.js';
import { createMountains, noise2, smoothstep, seededRandom } from './terrain.js';
import { createStones, makePaintedMaterial, setWarmLights } from './forest.js';
import { createTrekker } from './trekker.js';
import { NOISE_GLSL } from './glsl.js';
import { makeMistMaterial } from './mist.js';
import { mood, MATERIALS } from './palette.js';

// The sun breaks at the horizon a little left of centre.
const SUN_DIR = new THREE.Vector3(-0.34, 0.03, -0.94).normalize();

const TOP = 150;          // height of the summit (metres)
const CLOUD_LEVEL = 40;   // the top of the sea of clouds

// Camera, trekker and flag for the style frame.
export const SUMMIT_SHOT = {
  pos: new THREE.Vector3(5.5, 0, 9.5),       // y is set from the ground (+ eye height)
  look: new THREE.Vector3(-12, TOP - 16, -120),
  trekker: { x: -1.2, z: -2.2, heading: Math.PI + 0.42 },
  flag: { x: 3.4, z: -3.6 },
};

// ---------- The shape of the summit: a small snowy top that drops steeply into the clouds ----------
// We stand on the top; just past the trekker and the flag the ground falls away, so the
// whole sea of clouds opens up below.
export function summitHeight(x, z) {
  // Further out in front (-z) than behind: the top is at the edge of a big drop.
  const r = Math.hypot(x * 0.7, z < 0 ? z * 1.35 : z * 0.6);
  let y = TOP - 0.035 * r * r * (1 - smoothstep(6, 14, r));   // a gently domed top
  y -= smoothstep(6, 14, r) * (0.035 * 36 + (r - 6) * 1.9);    // then a steep fall
  // Rocky ribs and drifts on the slopes (calm on the top, where we stand).
  const rough = smoothstep(7, 30, r);
  y += (noise2(x * 0.05, z * 0.05, 91) - 0.5) * 14 * rough;
  y += (1 - Math.abs(noise2(x * 0.09, z * 0.09, 93) * 2 - 1)) * 6 * rough;
  y += (noise2(x * 0.35, z * 0.35, 95) - 0.5) * 0.35;         // wind-carved ripples in the snow
  return y;
}

export function createSummit(scene, { renderer, camera }) {
  // ---------- Sky, light and fog (from the palette's current mood) ----------
  const sky = createSky(scene, { glowDir: new THREE.Vector3(SUN_DIR.x, 0, SUN_DIR.z), sunDir: SUN_DIR });
  setWarmLights();

  // ---------- The farthest painted range from base camp, far off and pale on the horizon.
  // (The nearer ranges are hidden: from the summit they're under the clouds.) ----------
  const ranges = createMountains(scene);
  ranges.children.forEach((layer, i) => { layer.visible = i === 3; });
  ranges.scale.set(1.6, 0.42, 1.6);    // pushed far out and low: a faint line of peaks on the horizon
  ranges.userData.setLitSide(1);       // the sun is on the left, like the moon at base camp

  // ---------- The sea of clouds ----------
  const clouds = buildCloudSea();
  scene.add(clouds);
  // Low banks of cloud rolling across the sea at two distances: they give the flat sea
  // soft, billowing edges (the same painted mist shader as base camp, in sunrise colours).
  for (const [radius, height, opacity, seed] of [[900, 46, 0.75, 1.3], [1700, 80, 0.65, 4.4]]) {
    const bank = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 128, 1, true, -Math.PI * 0.55, Math.PI * 1.1),
      makeMistMaterial({ opacity, scale: [radius / 40, 1.4], speed: 0.003, softness: [0.3, 0.62], nearFade: [0, 1], seed }),
    );
    bank.position.set(0, CLOUD_LEVEL + height * 0.32, 0);
    bank.rotation.y = Math.PI;
    scene.add(bank);
  }

  // ---------- Big snow peaks rising out of the clouds ----------
  const rand = seededRandom(808);
  const peakMat = makePeakMaterial();
  // Each massif is a main peak with lower shoulders, so it reads as a mountain, not a cone.
  // h = height above the clouds. Nearer massifs to the right; the sun side (left) stays open.
  const massifs = [
    { x: 700, z: -1300, h: 230, r: 300 },
    { x: 1500, z: -2300, h: 380, r: 420 },
    { x: -150, z: -2400, h: 200, r: 330 },
    { x: -1500, z: -2600, h: 260, r: 380 },
  ];
  for (const m of massifs) {
    scene.add(buildPeak(m, peakMat, rand));
    for (let k = 0; k < 2; k++) {
      const side = k === 0 ? -1 : 1;
      scene.add(buildPeak({ x: m.x + side * m.r * (0.7 + rand() * 0.3), z: m.z + (rand() - 0.3) * m.r * 0.6, h: m.h * (0.45 + rand() * 0.2), r: m.r * 0.75 }, peakMat, rand));
    }
  }

  // ---------- The summit we stand on ----------
  scene.add(buildSummitGround());
  // A few rocks breaking through the snow.
  const stones = [[-5, -3, 0.8], [-4, -4.2, 0.45], [-8, 4, 0.6], [5.6, -5, 0.4]]
    .map(([x, z, s]) => ({ x, z, s, y: summitHeight(x, z) }));
  createStones(scene, stones, rand);

  // ---------- The flag: the one warm note in the cold air ("Book a call") ----------
  const flag = buildFlag();
  const f = SUMMIT_SHOT.flag;
  flag.group.position.set(f.x, summitHeight(f.x, f.z) - 0.1, f.z);
  scene.add(flag.group);

  // ---------- The trekker, looking out at the sunrise ----------
  const trekker = createTrekker(scene, renderer, camera);
  const t = SUMMIT_SHOT.trekker;
  trekker.ready.then(() => trekker.place(t.x, t.z, t.heading, summitHeight(t.x, t.z))).catch(() => {});

  // ---------- The camera ----------
  const pos = SUMMIT_SHOT.pos.clone();
  pos.y = summitHeight(pos.x, pos.z) + 4.6;   // raised, as if from a rock behind the top: the crest sits low in frame
  camera.position.copy(pos);
  camera.lookAt(SUMMIT_SHOT.look);

  function update(dt, time) {
    sky.applyMood();
    ranges.userData.applyMood();
    trekker.setLightLevel(mood.character.level, mood.character.tint);
    clouds.material.uniforms.uTime.value = time;
    flag.update(time);
    sky.update(time, camera, renderer.getPixelRatio());
    trekker.update(dt, time);
  }
  return { update, ready: trekker.ready, sky };
}

// Shared values for the summit's custom shaders (the palette's live colours).
function summitUniforms() {
  return {
    uSunDir: { value: SUN_DIR },
    uHorizon: { value: mood.sky.horizon },
    uGlow: { value: mood.sky.glow },
    uLit: { value: mood.clouds.lit },
    uShade: { value: mood.clouds.shade },
    uSnowLit: { value: mood.mountains.snowLit },
    uSnowShade: { value: mood.mountains.snowShade },
    uRock: { value: new THREE.Color(MATERIALS.summit.rock) },
    uTime: { value: 0 },
  };
}

// =====================================================================
// The sea of clouds: one huge plane, painted by a shader into soft billows.
// Billow tops facing the sun glow gold, the sides away from it fall into rose-lilac shade,
// and far away everything melts into the horizon, so there is no edge.
// =====================================================================
function buildCloudSea() {
  const geo = new THREE.PlaneGeometry(8000, 8000, 1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: summitUniforms(),
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uHorizon, uGlow, uLit, uShade;
      uniform float uTime;
      varying vec3 vWorld;
      ${NOISE_GLSL}

      // Billows: rounded, puffy noise (the absolute value folds it into soft domes).
      float billow(vec2 p) {
        float sum = 0.0, amp = 0.55;
        for (int i = 0; i < 4; i++) {
          sum += amp * (1.0 - abs(vnoise(p) * 2.0 - 1.0));
          p = p * 2.07 + vec2(13.7, 5.1);
          amp *= 0.48;
        }
        return sum;
      }

      void main() {
        vec3 toPix = vWorld - cameraPosition;
        float dist = length(toPix.xz);
        // Billows are stretched sideways a little as they recede, like a painted sea.
        vec2 p = vWorld.xz * vec2(0.0034, 0.0052) + vec2(uTime * 0.002, 0.0);
        float h = billow(p);
        // Fake light from the sun: compare with the billow a step towards the sun.
        vec2 sunStep = normalize(uSunDir.xz) * 0.08;
        // Mostly shade by height (tops bright, hollows cool): round puffs, not ripples.
        float lit = clamp((h - billow(p + sunStep)) * 2.0 + 0.5, 0.0, 1.0) * 0.35 + smoothstep(0.35, 0.95, h) * 0.65;
        // Fine detail fades with distance (no shimmering far away).
        float detail = 1.0 - smoothstep(400.0, 2000.0, dist);
        lit = mix(0.6, lit, detail);
        vec3 col = mix(uShade, uLit, smoothstep(0.2, 0.9, lit));

        // Towards the sun, the whole sea glows gold (light scattering through the vapour).
        vec3 viewDir = normalize(toPix);
        float toSun = max(dot(normalize(vec3(viewDir.x, 0.0, viewDir.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0);
        col = mix(col, uGlow * 1.12, pow(toSun, 6.0) * 0.55 * smoothstep(200.0, 2200.0, dist));
        col += uGlow * pow(toSun, 40.0) * 0.25;

        // Far away the clouds melt into the horizon colour: no visible edge.
        col = mix(col, uHorizon, smoothstep(900.0, 3800.0, dist));
        gl_FragColor = vec4(col + dither(gl_FragCoord.xy), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = CLOUD_LEVEL;
  mesh.name = 'cloud-sea';
  mesh.frustumCulled = false;
  return mesh;
}

// =====================================================================
// Snow peaks: cones roughed up with ridges, painted with soft sun and shade.
// =====================================================================
function makePeakMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: summitUniforms(),
    vertexShader: /* glsl */ `
      varying vec3 vWorld, vNormalW;
      varying float vHeight;
      attribute float aHeight;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vHeight = aHeight;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uHorizon, uGlow, uSnowLit, uSnowShade, uRock, uShade;
      varying vec3 vWorld, vNormalW;
      varying float vHeight;
      ${NOISE_GLSL}
      void main() {
        vec3 n = normalize(vNormalW);
        // Soft, wrapped sunlight: the lit face glows, the shade side is a cool lilac, never black.
        float sun = smoothstep(-0.15, 0.6, dot(n, normalize(uSunDir + vec3(0.0, 0.25, 0.0))));
        // Snow on gentle slopes and high up; dark rock shows on the steepest faces.
        // Seen from this far, the peaks are all snow; only a faint cool shadow in the steepest
        // gullies hints at rock (dark blotches read as stains in a painting).
        float snow = mix(0.82, 1.0, smoothstep(0.05, 0.3, n.y));
        // Rock stays cool (lilac-grey), so it reads as shadowed stone, not brown stains.
        vec3 rockBase = mix(uRock, uSnowShade, 0.55);
        vec3 rock = mix(rockBase * 0.85, mix(rockBase, uGlow, 0.25), sun);
        vec3 snowCol = mix(uSnowShade, mix(uSnowLit, uGlow, 0.18), sun);
        vec3 col = mix(rock, snowCol, snow);
        // Distance haze towards the horizon colour (each peak paler than the one in front).
        float dist = length(vWorld - cameraPosition);
        // A warm rim where the faces turn towards the sun.
        col += uGlow * pow(1.0 - abs(dot(n, normalize(cameraPosition - vWorld))), 3.0) * sun * 0.25;
        col = mix(col, uHorizon, smoothstep(600.0, 3200.0, dist) * 0.62);
        // The foot of each peak dissolves into the cloud colour.
        col = mix(col, uShade, (1.0 - smoothstep(${CLOUD_LEVEL.toFixed(1)}, ${(CLOUD_LEVEL + 50).toFixed(1)}, vWorld.y)) * 0.6);
        gl_FragColor = vec4(col + dither(gl_FragCoord.xy), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

function buildPeak({ x, z, h, r }, material, rand) {
  const geo = new THREE.ConeGeometry(r, h + CLOUD_LEVEL + 40, 96, 40, true);
  geo.translate(0, (h + CLOUD_LEVEL + 40) / 2 - 40, 0);
  const pos = geo.attributes.position;
  const heights = new Float32Array(pos.count);
  const seed = Math.floor(rand() * 1000);
  const v = new THREE.Vector3();
  const total = h + CLOUD_LEVEL;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ang = Math.atan2(v.z, v.x);
    const t = THREE.MathUtils.clamp((v.y + 40) / (total + 40), 0, 1);   // 0 at the foot, 1 at the tip
    // Ridges: sharp folds running down from the summit, like a real massif.
    const ridged = 1 - Math.abs(noise2(Math.cos(ang) * 2.5 + seed, Math.sin(ang) * 2.5 + t * 2, 5) * 2 - 1);
    const out = 0.6 + ridged * 0.7 + (noise2(ang * 7 + seed, t * 8, 7) - 0.5) * 0.3;
    v.x *= out;
    v.z *= out;
    // A slightly lop-sided, concave profile (steeper near the top).
    v.y = -40 + Math.pow(t, 0.7) * (total + 40);   // concave: steep near the top, spreading at the foot
    v.x += (1 - t) * r * 0.25 * Math.cos(seed);       // lop-sided: the tip leans off-centre
    v.z += (1 - t) * r * 0.2 * Math.sin(seed * 1.7);
    pos.setXYZ(i, v.x + x, v.y, v.z + z);
    heights[i] = t;
  }
  geo.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'peak';
  return mesh;
}

// =====================================================================
// The summit ground: snow, with rock showing on the steep sides.
// =====================================================================
function buildSummitGround() {
  const size = 320, seg = 320;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  geo.translate(0, 0, -60);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, summitHeight(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  // Colour by slope: flat = snow, steep = rock (soft blend, painted with noise).
  const nor = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const snow = new THREE.Color(MATERIALS.summit.snow);
  const shade = new THREE.Color(MATERIALS.summit.snowShade);
  const rock = new THREE.Color(MATERIALS.summit.rock);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const steep = 1 - nor.getY(i);
    const drift = noise2(x * 0.08, z * 0.08, 97);
    c.copy(snow).lerp(shade, smoothstep(0.4, 0.8, drift) * 0.35);
    c.lerp(rock, smoothstep(0.32, 0.55, steep + (drift - 0.5) * 0.2));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.color = mood.ground;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'summit-ground';
  return mesh;
}

// =====================================================================
// The flag: a wooden pole and a cloth that ripples in the wind, glowing where the sun
// shines through it.
// =====================================================================
function buildFlag() {
  const group = new THREE.Group();
  const poleH = 3.2;
  const poleGeo = new THREE.CylinderGeometry(0.03, 0.045, poleH, 10).translate(0, poleH / 2, 0);
  poleGeo.setAttribute('aTrunk', new THREE.Float32BufferAttribute(new Array(poleGeo.attributes.position.count).fill(0), 1));
  // The painted material expects instancing, so the pole is an instanced mesh of one.
  const pole = new THREE.InstancedMesh(poleGeo, makePaintedMaterial({ colors: mood.wood, wind: false, roundness: 0, rim: 0.8 }), 1);
  pole.setMatrixAt(0, new THREE.Matrix4());
  group.add(pole);

  const clothW = 1.3, clothH = 0.82;
  const clothGeo = new THREE.PlaneGeometry(clothW, clothH, 24, 12).translate(clothW / 2, 0, 0);
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(MATERIALS.summit.flagCloth) },
    uGlow: { value: mood.sky.glow },
    uFogColor: { value: mood.fog.color },
  };
  const clothMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying float vShade;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        // Waves travel from the pole to the free edge, growing as they go (the pole holds it still).
        float free = p.x / ${clothW.toFixed(2)};
        float w = sin(p.x * 4.5 - uTime * 3.2) * 0.12 + sin(p.x * 9.0 - uTime * 5.1 + p.y * 3.0) * 0.04;
        p.z += w * free;
        p.y -= free * free * 0.06;   // the free corner droops a little
        // Shade the folds from the slope of the wave: light on one side of each ripple.
        float slope = cos(p.x * 4.5 - uTime * 3.2);
        vShade = 0.82 + 0.22 * slope * free;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uGlow;
      varying float vShade;
      varying vec2 vUv;
      void main() {
        // The cloth glows a little where the low sun shines through it.
        vec3 col = uColor * vShade + uGlow * 0.12 * vShade;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const cloth = new THREE.Mesh(clothGeo, clothMat);
  cloth.position.y = poleH - clothH / 2 - 0.05;
  cloth.rotation.y = 2.4;   // the wind blows it out to the side, so we see it in profile
  group.add(cloth);

  return { group, update: (time) => { uniforms.uTime.value = time; } };
}
