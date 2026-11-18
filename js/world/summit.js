// summit.js: scene 4, the summit at sunrise.
//
// We stand on a snowy summit above a sea of glowing clouds. Other snow peaks rise out of
// the clouds, the sun breaks at the horizon, and a flag (the "Book a call" moment) flies
// from the highest point. Colours come from palette.js (the "sunrise" preset).
//
// Two users:
//  - createSummit(): the style frame (style-frame.html?scene=summit), a little world of its own.
//  - createSummitZone(): the summit in the film, part of the one continuous landscape.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSky } from './sky.js';
import { createMountains, noise2, smoothstep, seededRandom, groundHeight, nearestTrail } from './terrain.js';
import { createStones, createStoneVariety, makePaintedMaterial, setWarmLights } from './forest.js';
import { createTrekker } from './trekker.js';
import { NOISE_GLSL, WIND_GLSL } from './glsl.js';
import { makeMistMaterial } from './mist.js';
import { mood, MATERIALS } from './palette.js';
import { SUMMIT } from './journey.js';

// The style frame: the sun breaks at the horizon a little left of centre.
const FRAME_SUN = new THREE.Vector3(-0.34, 0.03, -0.94).normalize();

const TOP = 150;          // style frame: height of the summit (metres)
const CLOUD_LEVEL = 40;   // style frame: the top of the sea of clouds

// Camera, trekker and flag for the style frame.
export const SUMMIT_SHOT = {
  pos: new THREE.Vector3(5.5, 0, 9.5),       // y is set from the ground (+ eye height)
  look: new THREE.Vector3(-12, TOP - 16, -120),
  trekker: { x: -1.2, z: -2.2, heading: Math.PI + 0.42 },
  flag: { x: 3.4, z: -3.6 },
};

// The big snow peaks around the summit, as seen in the style frame (relative to the summit,
// with the sun straight ahead-left). h = height above the clouds. Nearer massifs to the right;
// the sun side (left) stays open. The film turns this layout to face its own sunrise.
const MASSIFS = [
  { x: 700, z: -1300, h: 230, r: 300 },
  { x: 1500, z: -2300, h: 380, r: 420 },
  { x: -150, z: -2400, h: 200, r: 330 },
  { x: -1500, z: -2600, h: 260, r: 380 },
];

// ---------- The shape of the style frame's summit: a small snowy top that drops steeply into the clouds ----------
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

// =====================================================================
// The style frame
// =====================================================================
export function createSummit(scene, { renderer, camera }) {
  // ---------- Sky, light and fog (from the palette's current mood) ----------
  const sky = createSky(scene, { glowDir: new THREE.Vector3(FRAME_SUN.x, 0, FRAME_SUN.z), sunDir: FRAME_SUN });
  setWarmLights();

  // ---------- The farthest painted range from base camp, far off and pale on the horizon.
  // (The nearer ranges are hidden: from the summit they're under the clouds.) ----------
  const ranges = createMountains(scene);
  ranges.children.forEach((layer, i) => { layer.visible = i === 3; });
  ranges.scale.set(1.6, 0.42, 1.6);    // pushed far out and low: a faint line of peaks on the horizon
  ranges.userData.setLitSide(1);       // the sun is on the left, like the moon at base camp

  // ---------- The sea of clouds, its banks and the peaks ----------
  const clouds = buildCloudSea(FRAME_SUN);
  clouds.position.y = CLOUD_LEVEL;
  scene.add(clouds);
  for (const bank of buildCloudBanks()) {
    bank.position.y += CLOUD_LEVEL;
    scene.add(bank);
  }
  const rand = seededRandom(808);
  const peakMat = makePeakMaterial(FRAME_SUN, CLOUD_LEVEL);
  for (const m of MASSIFS) scene.add(...buildMassif(m, peakMat, rand, CLOUD_LEVEL));

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

// =====================================================================
// The summit in the film
// =====================================================================
// sunDir: the film's sun (sky.js). cloudTop: where the top of the sea of clouds sits once the
// sun is up (metres). The whole sea of clouds (with its puffs, banks and the far peaks' feet)
// rises from below the valley floor as the light comes up: setClimb drives it via update().
export function createSummitZone(scene, { sunDir, cloudTop = 20 }) {
  const [sx, sz] = SUMMIT.top;
  const topY = groundHeight(sx, sz);
  const sunFlat = new THREE.Vector3(sunDir.x, 0, sunDir.z).normalize();
  const rand = seededRandom(909);

  // ---------- 1. The sea of clouds: one big painted plane, puffs on top, banks far away ----------
  // Everything in this group is placed as if the clouds' top were at y = 0; the group is moved
  // up and down with the light.
  const sea = new THREE.Group();
  sea.name = 'sea-of-clouds';
  const plane = buildCloudSea(sunDir, { fogged: true });
  plane.position.set(sx, 0, sz);
  sea.add(plane);
  for (const bank of buildCloudBanks()) {
    bank.position.x += sx;
    bank.position.z += sz;
    bank.rotation.y = Math.atan2(sunFlat.x, sunFlat.z) + Math.PI;   // the open side faces away from the sun
    sea.add(bank);
  }
  const puffs = buildCloudPuffs(sunDir, rand, { cx: sx, cz: sz });
  sea.add(puffs);
  scene.add(sea);

  // ---------- 2. Big snow peaks rising out of the clouds, turned to face the film's sunrise ----------
  // The style frame's layout is rotated so the peaks sit in the same place relative to the sun.
  const turn = Math.atan2(sunFlat.x, sunFlat.z) - Math.atan2(FRAME_SUN.x, FRAME_SUN.z);
  const cos = Math.cos(turn), sin = Math.sin(turn);
  const peakMat = makePeakMaterial(sunDir, cloudTop);
  const peaks = new THREE.Group();
  peaks.name = 'snow-peaks';
  for (const m of MASSIFS) {
    const x = sx + m.x * cos + m.z * sin, z = sz - m.x * sin + m.z * cos;
    peaks.add(...buildMassif({ ...m, x, z }, peakMat, rand, cloudTop));
  }
  scene.add(peaks);

  // ---------- 3. Rocks breaking through the snow, in four shapes ----------
  const stones = [];
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2, r = 5 + Math.pow(rand(), 0.7) * 34;
    const x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r;
    const y = groundHeight(x, z);
    if (y < 70 || Math.hypot(x - SUMMIT.flag[0], z - SUMMIT.flag[1]) < 2.5) continue;
    // Only where the slope is gentle enough for a rock to rest (on steep snow they'd float).
    const slope = Math.abs(groundHeight(x + 1, z) - y) + Math.abs(groundHeight(x, z + 1) - y);
    if (slope > 0.7) continue;
    // Low, broad outcrops half-buried in the snow (boulders, slabs and twins: no tall standing
    // stones up here, they look like eggs set down on the snow).
    const s = 0.7 + rand() * (r > 15 ? 2.2 : 0.8);
    stones.push({ x, z, y: y - s * 0.25, s, shape: [0, 1, 3][Math.floor(rand() * 3)] });
  }
  createStoneVariety(scene, stones, rand);

  // ---------- 3b. Crags, ridges and drifts: the summit's character ----------
  // Bare rock breaks through the snow in lines running down from the top (ridges, like the
  // arêtes of a real peak), the biggest crags on the steep flanks. On the downwind side of
  // many crags the wind has banked a smooth snow drift. Rock tops are dusted pale.
  const rockColors = { bottom: new THREE.Color(MATERIALS.summit.rock), top: new THREE.Color(MATERIALS.summit.rockTop) };
  const driftColors = { bottom: new THREE.Color(MATERIALS.summit.snowShade), top: new THREE.Color(MATERIALS.summit.drift) };
  const windR = Math.atan2(sunFlat.x, sunFlat.z) + 0.5;               // the way the flag streams
  const lee = new THREE.Vector2(Math.cos(windR), -Math.sin(windR));    // downwind
  const crags = [], drifts = [];
  // A drift is long and low: it's pressed into the slope at its lowest point, so neither end
  // ever hangs in the air.
  const addDrift = (x, z, s) => {
    const ax = Math.cos(windR) * s * 0.9, az = -Math.sin(windR) * s * 0.9;
    const low = Math.min(groundHeight(x, z), groundHeight(x + ax, z + az), groundHeight(x - ax, z - az));
    const high = Math.max(groundHeight(x, z), groundHeight(x + ax, z + az), groundHeight(x - ax, z - az),
      groundHeight(x + az, z - ax), groundHeight(x - az, z + ax));
    if (high - low > s * 0.18) return;   // too steep for snow to bank (it would stick out)
    drifts.push({ x, z, y: low - s * 0.1, s, shape: 0, tall: 0.22, long: 1.8, turn: windR });
  };
  const clear = (x, z) => nearestTrail(x, z).distance > 3.2 && Math.hypot(x - sx, z - sz) > 4.5
    && Math.hypot(x - SUMMIT.flag[0], z - SUMMIT.flag[1]) > 3;
  for (let i = 0; i < 3000 && crags.length < 75; i++) {
    const a = rand() * Math.PI * 2, r = 4.5 + Math.pow(rand(), 0.9) * 50;
    const x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r;
    const y = groundHeight(x, z);
    // On the summit cone; lower down only close beside the climb, where they're seen up close
    // (scattered over the whole face, the meadow would see them as blocks on the slope).
    const fromTrail = nearestTrail(x, z).distance;
    if (y < 64 || (y < 76 && fromTrail > 16) || !clear(x, z)) continue;
    // Ridges: rock gathers along the folds of a "ridged" noise, in lines down the mountain.
    const ridge = 1 - Math.abs(noise2(x * 0.045 + z * 0.02, z * 0.045 - x * 0.02, 131) * 2 - 1);
    const slope = Math.abs(groundHeight(x + 1, z) - y) + Math.abs(groundHeight(x, z + 1) - y);
    if (ridge < 0.72 && slope < 0.9) continue;
    const big = smoothstep(6, 30, r);
    // (never a giant right beside the path: up close a big one reads as a blob)
    const sz2 = Math.min((0.7 + rand() * 1.0) * (1 + big * 1.5), fromTrail < 7 ? 1.8 : 9);
    crags.push({ x, z, y: y - sz2 * 0.3, s: sz2, shape: rand() < 0.7 ? 4 : 1 });
    // A drift banked on the lee side (smooth, low and long).
    if (rand() < 0.65) {
      const dx = x + lee.x * sz2 * 0.8, dz = z + lee.y * sz2 * 0.8;
      if (clear(dx, dz)) addDrift(dx, dz, sz2 * 1.1);
    }
  }
  // The final shot: a few crags on the knoll's flanks either side of the view (the camera looks
  // along FINAL_LOOK at the top), so the trekker stands on a real rocky summit, not a smooth dome.
  // (along: metres beyond the top, negative towards the camera; side: metres to the right of the
  // view; then size). The top is a small knoll that drops away steeply, so from the camera only a
  // few metres round the top are in frame: these spots were chosen to land inside it.
  const fl = FINAL_LOOK, fr = [-fl[1], fl[0]];
  for (const [along, side, size, drift] of [
    [0, -4.2, 0.8, 1], [2, -4.6, 1.2, 0], [-1, -5, 0.6, 0], [3.2, -3.6, 0.7, 0],
    [2, 4.2, 1.0, 1], [3, 4.6, 1.3, 0], [1, 3.4, 0.5, 0],
    // (size 0: no rock, just a low wind drift across the open snow in front of him)
    [-3, -2, 0, 1.5], [-2, -3.2, 0, 1.2], [2, -2.2, 0, 1.0],
  ]) {
    const x = sx + fl[0] * along + fr[0] * side, z = sz + fl[1] * along + fr[1] * side;
    // (small rocks: they may sit closer in than the big crags, but never on the path or
    // beside the trekker and the flag)
    if (nearestTrail(x, z).distance < 2.2 || Math.hypot(x - sx, z - sz) < 2.5 || Math.hypot(x - SUMMIT.flag[0], z - SUMMIT.flag[1]) < 2) continue;
    if (!size) { addDrift(x, z, drift); continue; }
    crags.push({ x, z, y: groundHeight(x, z) - size * 0.32, s: size, shape: 4 });
    if (drift) addDrift(x + lee.x * size, z + lee.y * size, size * 1.2);
  }
  // The knoll itself, where the finale is played: painted snow, rock, ridges, cornices, stones.
  buildKnoll(scene, { sx, sz, sunDir, windR, rand, crags, drifts, addDrift, at: (along, side) => [sx + fl[0] * along + fr[0] * side, sz + fl[1] * along + fr[1] * side] });
  createStoneVariety(scene, crags, rand, rockColors);
  createStoneVariety(scene, drifts, rand, driftColors);

  // ---------- 4. The flag: the one warm note in the cold air ("Book a call") ----------
  const flag = buildFlag();
  const [fx, fz] = SUMMIT.flag;
  flag.group.position.set(fx, groundHeight(fx, fz) - 0.15, fz);
  // The wind blows from the sun's side, so the cloth streams out across the view.
  flag.group.rotation.y = Math.atan2(sunFlat.x, sunFlat.z) + 0.5;
  scene.add(flag.group);

  // ---------- 5. Fine snow blowing off the summit ridge, downwind like the flag ----------
  const r = flag.group.rotation.y;
  const spindrift = buildSpindrift({ sx, sz, topY, rand, dir: new THREE.Vector3(Math.cos(r), 0, -Math.sin(r)) });
  scene.add(spindrift);

  // ---------- update: the clouds rise with the light ----------
  // climb: palette.js's climb (0 night ... 1 sunrise). The sea starts far below the valley floor
  // (out of sight, and not drawn at all), floods the valley as first light comes, and settles
  // just below the meadow by sunrise. The far peaks emerge from the haze over the same time.
  const uniforms = [plane.material.uniforms, puffs.material.uniforms];
  function update(time, climb) {
    const rise = smoothstep(0.42, 0.95, climb);
    sea.position.y = -120 + (cloudTop + 120) * rise;
    sea.visible = rise > 0.001;
    const emerge = smoothstep(0.45, 0.75, climb);
    peakMat.uniforms.uFade.value = emerge;
    peaks.visible = emerge > 0.001;
    for (const u of uniforms) {
      u.uTime.value = time;
      u.uFogDensity.value = mood.fog.density;
    }
    flag.update(time);
    // The spindrift shows once we're up in the snow (at sunrise), never in the dark valley.
    const snowShow = smoothstep(0.85, 0.97, climb);
    spindrift.visible = snowShow > 0.001;
    spindrift.material.uniforms.uTime.value = time;
    spindrift.material.uniforms.uShow.value = snowShow;
  }
  update(0, 0);
  return { update, flag: flag.group, topY };
}

// =====================================================================
// Spindrift: fine snow lifted off the high ground by the wind, streaming out over the edge.
// =====================================================================
// About 500 grains, each a soft dot. Every grain starts on a high spot round the summit, drifts
// downwind (dir), rising a little and wavering, then fades away; then it starts again. All of
// that is worked out on the graphics card from the time, so it costs nothing per frame.
// It's thickest when a gust passes (windGust, the world's one breeze).
function buildSpindrift({ sx, sz, topY, rand, dir }) {
  const COUNT = 700;
  const starts = [], seeds = [];
  for (let tries = 0; tries < COUNT * 20 && starts.length < COUNT * 3; tries++) {
    const a = rand() * Math.PI * 2, rr = 1.5 + Math.pow(rand(), 0.9) * 15;
    const x = sx + Math.cos(a) * rr, z = sz + Math.sin(a) * rr;
    const y = groundHeight(x, z);
    if (y < topY - 5) continue;   // only off the crest: the top and the ridges running from it
    starts.push(x, y + 0.05, z);
    seeds.push(rand(), rand(), rand());
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(starts.slice(0, COUNT * 3), 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds.slice(0, COUNT * 3), 3));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uShow: { value: 0 },
      uDir: { value: dir },
      uColor: { value: mood.mountains.snowLit },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uShow, uPixelRatio;
      uniform vec3 uDir;
      attribute vec3 aSeed;
      varying float vAlpha;
      ${WIND_GLSL}
      void main() {
        // Each grain lives about 3 to 5 seconds, then starts over from its spot.
        float life = 3.0 + aSeed.x * 2.0;
        float age = fract(uTime / life + aSeed.y);
        vec3 side = vec3(-uDir.z, 0.0, uDir.x);
        vec3 p = position
          + uDir * age * (5.0 + aSeed.z * 5.0)                        // carried downwind
          + vec3(0.0, 1.0, 0.0) * (age * 1.2 + sin(age * 6.0 + aSeed.x * 9.0) * 0.15)   // lifted, wavering
          + side * sin(age * 4.0 + aSeed.z * 7.0) * 0.4;              // a little side-to-side
        float gust = windGust(position.xz, uTime);
        // A light drift all the time, thicker as each gust passes.
        vAlpha = sin(age * 3.14159) * (0.35 + 0.65 * gust) * uShow * 0.8;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        // Fine grains: a few pixels across nearby, smaller further off.
        gl_PointSize = (2.5 + aSeed.x * 3.0) * uPixelRatio * clamp(14.0 / -mv.z, 0.5, 2.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        // A soft round dot (no hard edge).
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, d) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new THREE.Points(geo, material);
  points.name = 'spindrift';
  points.frustumCulled = false;   // the grains move away from their start spots
  return points;
}

// =====================================================================
// The summit knoll: the snowy top the trekker stands on in the final shot.
// =====================================================================
// Without this it's one smooth dome. Here it gets the character of the rest of the summit, kept
// calm because the closing words sit beside it:
//  1. a painted snow surface laid exactly over the knoll: wind-carved ripples running with the
//     wind, lilac in the hollows, warm sunrise light on the faces turned to the sun, and patches
//     of bare rock breaking through; it fades softly into the plain snow at its edge,
//  2. rock slabs breaking through, almost flush with the snow,
//  3. low wind ridges (sastrugi) lying along the wind,
//  4. small cornices: overhanging snow lips on the knoll's rim,
//  5. small stones scattered round the foot of the flag.
// Nothing near where the trekker stands, the flag pole, or the path.
// at(along, side): a point so many metres along the final shot's view from the top, and to its
// right (see FINAL_LOOK).
function buildKnoll(scene, { sx, sz, sunDir, windR, rand, crags, drifts, addDrift, at }) {
  const [fx, fz] = SUMMIT.flag;
  const clearOf = (x, z, r) => Math.hypot(x - sx, z - sz) > 1.6 + r && Math.hypot(x - fx, z - fz) > 0.5 + r && nearestTrail(x, z).distance > 1.3 + r;

  // 1. The painted snow surface.
  const R = 10, N = 100;
  const geo = new THREE.PlaneGeometry(R * 2, R * 2, N, N).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = sx + pos.getX(i), z = sz + pos.getZ(i);
    pos.setXYZ(i, x, groundHeight(x, z) + 0.012, z);
    // A soft, rounded normal (from the slope over a metre and a half), so the light falls smoothly.
    n.set(groundHeight(x - 0.8, z) - groundHeight(x + 0.8, z), 1.6, groundHeight(x, z - 0.8) - groundHeight(x, z + 0.8)).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  // Two glazes over the knoll's own lit snow (like a painter glazing over a base coat), so its
  // warm sunrise colour stays exactly as it is underneath:
  //  - a "multiply" glaze that only darkens: lilac in the troughs between the wind ripples, and
  //    the patches of bare rock,
  //  - a soft additive glaze that only lightens: warm sunrise light on the ripple crests and the
  //    slopes turned to the sun.
  // Both fade out towards the edge, into the plain snow.
  const makeGlaze = (lighten) => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    blending: lighten ? THREE.AdditiveBlending : THREE.MultiplyBlending,
    premultipliedAlpha: !lighten,   // (three.js's multiply blending needs this)
    uniforms: {
      uCentre: { value: new THREE.Vector2(sx, sz) },
      uRadius: { value: R },
      uWind: { value: new THREE.Vector2(Math.cos(windR), -Math.sin(windR)) },
      uKeep: { value: new THREE.Vector4(sx, sz, fx, fz) },
      // The palette's live colours.
      uSnowLit: { value: mood.mountains.snowLit },
      uSnowShade: { value: mood.mountains.snowShade },
      uRock: { value: new THREE.Color(MATERIALS.summit.rock) },
      uGlow: { value: mood.sky.glow },
      uSunDir: { value: sunDir },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld, vNormalW;
      void main() {
        vWorld = position;
        vNormalW = normal;
        gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSnowLit, uSnowShade, uRock, uGlow, uSunDir;
      uniform vec2 uCentre, uWind;
      uniform vec4 uKeep;
      uniform float uRadius;
      varying vec3 vWorld, vNormalW;
      ${NOISE_GLSL}
      void main() {
        vec2 p = vWorld.xz;
        float fade = 1.0 - smoothstep(uRadius * 0.5, uRadius, length(p - uCentre));
        // How much the slope faces the low sun (wrapped: no hard edge).
        float lit = smoothstep(-0.2, 0.9, dot(normalize(vNormalW), uSunDir));
        // Wind-carved ripples: long soft ridges running with the wind, wavering, in drifts.
        vec2 across = vec2(-uWind.y, uWind.x);
        float ripple = sin(dot(p, across) * 4.6 + fbm(p * 0.25) * 7.0) * 0.75
          + sin(dot(p, across) * 9.0 + dot(p, uWind) * 0.8 + fbm(p * 0.6) * 4.0) * 0.25;   // finer ripples on top
        float patchy = smoothstep(0.3, 0.65, fbm(p * 0.3 + 3.0));
        float trough = smoothstep(0.2, -0.9, ripple) * patchy;
        float crest = smoothstep(0.3, 1.0, ripple) * patchy;
        // Bare rock breaking through in a few patches (never round the trekker or the flag).
        float keep = smoothstep(1.4, 2.6, distance(p, uKeep.xy)) * smoothstep(0.8, 1.6, distance(p, uKeep.zw));
        float rockN = fbm(p * vec2(0.5, 0.32) + 11.0) + (fbm(p * 1.6) - 0.5) * 0.2;
        float rock = smoothstep(0.6, 0.65, rockN) * keep;
        #ifdef LIGHTEN
          vec3 glow = uGlow * (crest * 0.08 + lit * 0.07) * (1.0 - rock);
          gl_FragColor = vec4(glow * fade, 1.0);
        #else
          vec3 shade = uSnowShade / max(uSnowLit, vec3(0.05));     // lilac, as a darkening factor
          vec3 stone = uRock / max(uSnowLit, vec3(0.05));          // the rock, likewise
          vec3 k = mix(vec3(1.0), shade, trough * 0.26 + (1.0 - lit) * 0.08);
          // (rock is darkened only part of the way: the darkest it gets is a soft lilac grey)
          k = mix(k, clamp(stone * 2.0, 0.0, 1.0), rock * 0.65);
          k += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
          gl_FragColor = vec4(mix(vec3(1.0), clamp(k, 0.0, 1.0), fade), 1.0);
        #endif
      }
    `,
    defines: lighten ? { LIGHTEN: '' } : {},
  });
  const surface = new THREE.Mesh(geo, makeGlaze(false));
  surface.name = 'summit-knoll';
  surface.renderOrder = -2;   // under the trekker's soft shadow
  const light = new THREE.Mesh(geo, makeGlaze(true));
  light.name = 'summit-knoll-light';
  light.renderOrder = -1;
  scene.add(surface, light);

  // 2. Rock slabs breaking through, almost flush with the snow.
  for (const [along, side, size] of [[-2.6, -2.6, 0.9], [0.8, -3.4, 0.7], [-1.2, 2.9, 0.55], [2.4, 3.6, 0.6], [-3.6, -1.2, 0.45], [-1.3, -2.3, 0.55], [1.3, 2.3, 0.45]]) {
    const [x, z] = at(along, side);
    if (!clearOf(x, z, size * 0.6)) continue;
    crags.push({ x, z, y: groundHeight(x, z) - size * 0.38, s: size, shape: 1 });
  }
  // 3. Low wind ridges lying along the wind.
  for (const [along, side, size] of [[-1.6, -1.3, 1.3], [-2.8, 1.2, 1.0], [1.6, -1.8, 1.1], [-0.4, 2.2, 0.9], [-4.2, -2.6, 1.2]]) {
    const [x, z] = at(along, side);
    if (!clearOf(x, z, size * 0.5)) continue;
    const before = drifts.length;
    addDrift(x, z, size);
    if (drifts.length > before) Object.assign(drifts[drifts.length - 1], { tall: 0.14, long: 2.4 });
  }
  // 4. Small cornices on the rim: snow lips curling over the edge.
  for (const [along, side, size] of [[-0.5, -5.4, 1.1], [1.5, -5.0, 0.9], [0.5, 5.0, 1.0], [2.5, 4.4, 0.8]]) {
    const [x, z] = at(along, side);
    drifts.push({ x, z, y: groundHeight(x, z) - size * 0.05, s: size, shape: 0, tall: 0.3, long: 2.0, turn: Math.atan2(x - sx, z - sz) + Math.PI / 2 });
  }
  // 5. Small stones round the foot of the flag.
  for (let i = 0; i < 8; i++) {
    const a = rand() * Math.PI * 2, r = 0.55 + rand() * 1.0;
    const x = fx + Math.cos(a) * r, z = fz + Math.sin(a) * r;
    if (Math.hypot(x - sx, z - sz) < 1.8) continue;
    const size = 0.12 + rand() * 0.2;
    crags.push({ x, z, y: groundHeight(x, z) - size * 0.2, s: size, shape: [0, 1, 3][i % 3] });
  }
}

// The direction the film's final shot looks across the summit (x, z), from cameraPath.js.
const FINAL_LOOK = [0.39, -0.92];

// Shared values for the summit's custom shaders (the palette's live colours).
function summitUniforms(sunDir) {
  return {
    uSunDir: { value: sunDir },
    uHorizon: { value: mood.sky.horizon },
    uGlow: { value: mood.sky.glow },
    uLit: { value: mood.clouds.lit },
    uShade: { value: mood.clouds.shade },
    uSnowLit: { value: mood.mountains.snowLit },
    uSnowShade: { value: mood.mountains.snowShade },
    uRock: { value: new THREE.Color(MATERIALS.summit.rock) },
    uFogColor: { value: mood.fog.color },
    uFogDensity: { value: 0 },
    uTime: { value: 0 },
  };
}

// =====================================================================
// The sea of clouds: one huge plane, painted by a shader into soft billows.
// Billow tops facing the sun glow gold, the sides away from it fall into rose-lilac shade,
// and far away everything melts into the horizon, so there is no edge.
// fogged: also fade into the scene's fog with distance (the film: so the clouds sit inside
// the same air as the land while they rise; the style frame keeps them clear).
// =====================================================================
function buildCloudSea(sunDir, { fogged = false } = {}) {
  const geo = new THREE.PlaneGeometry(8000, 8000, 1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    defines: fogged ? { USE_AIR: '' } : {},
    uniforms: summitUniforms(sunDir),
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uHorizon, uGlow, uLit, uShade, uFogColor;
      uniform float uTime, uFogDensity;
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
        #ifdef USE_AIR
          // The same air as the land (a lighter fog, so the sea still reads far out).
          float air = 1.0 - exp(-pow(uFogDensity * 0.38 * length(toPix), 2.0));
          col = mix(col, uFogColor, air);
        #endif
        gl_FragColor = vec4(col + dither(gl_FragCoord.xy), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'cloud-sea';
  mesh.frustumCulled = false;
  return mesh;
}

// Low banks of cloud rolling across the sea at two distances: they give the flat sea soft,
// billowing edges (the same painted mist shader as base camp, in sunrise colours).
function buildCloudBanks() {
  return [[900, 46, 0.75, 1.3], [1700, 80, 0.65, 4.4]].map(([radius, height, opacity, seed]) => {
    const bank = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 128, 1, true, -Math.PI * 0.55, Math.PI * 1.1),
      makeMistMaterial({ opacity, scale: [radius / 40, 1.4], speed: 0.003, softness: [0.3, 0.62], nearFade: [0, 1], seed }),
    );
    bank.position.set(0, height * 0.32, 0);
    bank.rotation.y = Math.PI;
    bank.name = 'cloud-bank';
    return bank;
  });
}

// =====================================================================
// Cloud puffs: three soft heaped shapes, reused (instanced) at many sizes and places on the
// sea, so the sea looks full and deep without costing more than one draw call.
// They are painted like the sea: gold where they face the sun, rose-lilac in their shade, and
// they sink into the sea's colour at their feet, so there is no seam where they meet it.
// =====================================================================
function buildCloudPuffs(sunDir, rand, { cx, cz }) {
  // A puff: a handful of overlapping squashed spheres, about 1 unit wide, base at y = 0.
  const shape = (blobs) => mergeGeometries(blobs.map(([x, y, z, r]) => {
    const g = new THREE.SphereGeometry(r, 18, 10);
    g.translate(x, y, z);
    g.deleteAttribute('uv');
    return g;
  }));
  const shapes = [
    shape([[0, 0, 0, 0.32], [0.26, -0.04, 0.05, 0.24], [-0.27, -0.05, -0.02, 0.22], [0.08, 0.13, -0.06, 0.2], [-0.1, 0.08, 0.12, 0.18]]),
    shape([[0, 0, 0, 0.26], [0.32, -0.06, 0, 0.18], [-0.34, -0.06, 0.04, 0.2], [0.6, -0.1, 0.02, 0.12], [-0.6, -0.1, -0.03, 0.13]]),
    shape([[0, 0.02, 0, 0.3], [0.18, 0.18, 0.02, 0.18], [-0.2, -0.04, 0.1, 0.22], [0.25, -0.06, -0.1, 0.2]]),
  ];
  // Three shapes = three instanced meshes (three draw calls in all), sharing one material.
  const group = new THREE.Group();
  group.name = 'cloud-puffs';
  const uniforms = summitUniforms(sunDir);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorld, vNormalW;
      varying float vUp;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormalW = normalize(mat3(m) * normal);
        vUp = clamp(position.y / 0.35 + 0.15, 0.0, 1.0);   // 0 at the foot, 1 at the crown
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uHorizon, uGlow, uLit, uShade, uFogColor;
      uniform float uFogDensity;
      varying vec3 vWorld, vNormalW;
      varying float vUp;
      ${NOISE_GLSL}
      void main() {
        vec3 n = normalize(vNormalW);
        vec3 toPix = vWorld - cameraPosition;
        float dist = length(toPix.xz);
        // Soft, wrapped light: the sun side glows, the far side is a cool rose-lilac, never dark.
        float sun = smoothstep(-0.3, 0.8, dot(n, normalize(uSunDir + vec3(0.0, 0.35, 0.0))));
        float lit = mix(0.25, 1.0, sun) * mix(0.75, 1.0, vUp);
        vec3 col = mix(uShade, uLit, lit);
        col = mix(col, uGlow * 1.1, sun * 0.22);
        // A warm edge where the cloud turns towards the sun, like light through vapour.
        float rim = pow(1.0 - abs(dot(n, normalize(-toPix))), 3.0);
        col += uGlow * rim * sun * 0.3;
        // The foot sinks into the sea's own colour: no seam.
        col = mix(mix(uShade, uLit, 0.55), col, smoothstep(0.0, 0.45, vUp));
        // Distance: melt into the horizon like the sea, and into the air.
        col = mix(col, uHorizon, smoothstep(900.0, 3800.0, dist));
        float air = 1.0 - exp(-pow(uFogDensity * 0.38 * length(toPix), 2.0));
        col = mix(col, uFogColor, air);
        gl_FragColor = vec4(col + dither(gl_FragCoord.xy), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  // Where the puffs go: mostly ahead (towards the sun and either side), thinning far away.
  const sunAngle = Math.atan2(sunDir.x, sunDir.z);
  const lists = [[], [], []];
  for (let i = 0; i < 90; i++) {
    const a = sunAngle + (rand() - 0.5) * Math.PI * 1.5;
    const r = 140 + Math.pow(rand(), 1.4) * 2200;
    const w = 40 + r * (0.06 + rand() * 0.08);      // further = bigger (so they still read)
    lists[i % 3].push({ x: cx + Math.sin(a) * r, z: cz + Math.cos(a) * r, w, h: w * (0.3 + rand() * 0.25), rot: rand() * 6.28 });
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  lists.forEach((list, k) => {
    const mesh = new THREE.InstancedMesh(shapes[k], material, list.length);
    list.forEach((c, i) => {
      p.set(c.x, -c.h * 0.12, c.z);           // sunk a little into the sea
      q.setFromAxisAngle(up, c.rot);
      s.set(c.w, c.h / 0.35, c.w * 0.8);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
  });
  group.material = material;   // so the zone can update its uniforms
  return group;
}

// =====================================================================
// Snow peaks: cones roughed up with ridges, painted with soft sun and shade.
// cloud: the height of the cloud tops (the peaks' feet dissolve into them).
// uFade: 0 = melted into the horizon haze (invisible), 1 = fully there.
// =====================================================================
function makePeakMaterial(sunDir, cloud) {
  const uniforms = summitUniforms(sunDir);
  uniforms.uCloud = { value: cloud };
  uniforms.uFade = { value: 1 };
  return new THREE.ShaderMaterial({
    uniforms,
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
      uniform float uCloud, uFade;
      varying vec3 vWorld, vNormalW;
      varying float vHeight;
      ${NOISE_GLSL}
      void main() {
        vec3 n = normalize(vNormalW);
        // Soft, wrapped sunlight: the lit face glows, the shade side is a cool lilac, never black.
        float sun = smoothstep(-0.15, 0.6, dot(n, normalize(uSunDir + vec3(0.0, 0.25, 0.0))));
        // Seen from this far, the peaks are all snow; only a faint cool shadow in the steepest
        // gullies hints at rock (dark blotches read as stains in a painting).
        float snow = mix(0.82, 1.0, smoothstep(0.05, 0.3, n.y));
        // Rock stays cool (lilac-grey), so it reads as shadowed stone, not brown stains.
        vec3 rockBase = mix(uRock, uSnowShade, 0.55);
        vec3 rock = mix(rockBase * 0.85, mix(rockBase, uGlow, 0.25), sun);
        vec3 snowCol = mix(uSnowShade, mix(uSnowLit, uGlow, 0.18), sun);
        vec3 col = mix(rock, snowCol, snow);
        float dist = length(vWorld - cameraPosition);
        // A warm rim where the faces turn towards the sun.
        col += uGlow * pow(1.0 - abs(dot(n, normalize(cameraPosition - vWorld))), 3.0) * sun * 0.25;
        // Distance haze towards the horizon colour (each peak paler than the one in front).
        col = mix(col, uHorizon, smoothstep(600.0, 3200.0, dist) * 0.62);
        // The foot of each peak dissolves into the cloud colour.
        col = mix(col, uShade, (1.0 - smoothstep(uCloud, uCloud + 50.0, vWorld.y)) * 0.6);
        // Before sunrise, the peaks are still lost in the haze.
        col = mix(uHorizon, col, uFade);
        gl_FragColor = vec4(col + dither(gl_FragCoord.xy), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

// A massif: a main peak with two lower shoulders, so it reads as a mountain, not a cone.
function buildMassif(m, material, rand, cloud) {
  const meshes = [buildPeak(m, material, rand, cloud)];
  for (let k = 0; k < 2; k++) {
    const side = k === 0 ? -1 : 1;
    meshes.push(buildPeak({ x: m.x + side * m.r * (0.7 + rand() * 0.3), z: m.z + (rand() - 0.3) * m.r * 0.6, h: m.h * (0.45 + rand() * 0.2), r: m.r * 0.75 }, material, rand, cloud));
  }
  return meshes;
}

function buildPeak({ x, z, h, r }, material, rand, cloud) {
  const geo = new THREE.ConeGeometry(r, h + cloud + 40, 96, 40, true);
  geo.translate(0, (h + cloud + 40) / 2 - 40, 0);
  const pos = geo.attributes.position;
  const heights = new Float32Array(pos.count);
  const seed = Math.floor(rand() * 1000);
  const v = new THREE.Vector3();
  const total = h + cloud;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ang = Math.atan2(v.z, v.x);
    const t = THREE.MathUtils.clamp((v.y + 40) / (total + 40), 0, 1);   // 0 at the foot, 1 at the tip
    // Ridges: sharp folds running down from the summit, like a real massif.
    const ridged = 1 - Math.abs(noise2(Math.cos(ang) * 2.5 + seed, Math.sin(ang) * 2.5 + t * 2, 5) * 2 - 1);
    const out = 0.6 + ridged * 0.7 + (noise2(ang * 7 + seed, t * 8, 7) - 0.5) * 0.3;
    v.x *= out;
    v.z *= out;
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
// The style frame's summit ground: snow, with rock showing on the steep sides.
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
  group.name = 'summit-flag';
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
      ${WIND_GLSL}
      void main() {
        vUv = uv;
        vec3 p = position;
        // Stronger as each gust of the world's breeze passes the pole, calmer in the lulls.
        float gust = 0.7 + 0.6 * windGust(modelMatrix[3].xz, uTime);
        // Waves travel from the pole to the free edge, growing as they go (the pole holds it still).
        // Slow and gentle: a steady mountain breeze, never a flapping frenzy.
        float free = p.x / ${clothW.toFixed(2)};
        float w = sin(p.x * 4.5 - uTime * 2.4) * 0.12 + sin(p.x * 9.0 - uTime * 3.8 + p.y * 3.0) * 0.035;
        p.z += w * free * gust;
        p.y -= free * free * 0.06;   // the free corner droops a little
        // Shade the folds from the slope of the wave: light on one side of each ripple.
        float slope = cos(p.x * 4.5 - uTime * 2.4);
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
