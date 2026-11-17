// sky.js: the sky dome, the moon, the stars, and the "mood" of the light.
// Everything that should change colour together as night turns to dawn lives here:
// sky gradient, fog colour, moonlight and the soft fill light.

import * as THREE from 'three';
import { NOISE_GLSL } from './glsl.js';

// ---------- Two moods. We blend between them as you climb. ----------
// Colours are written as normal hex (sRGB); three.js converts them for lighting maths.
const NIGHT = {
  top: '#03061a',       // almost black navy straight up
  mid: '#0e1747',       // deep indigo
  horizon: '#25336a',   // lighter blue at the horizon (also the fog colour)
  glow: '#1c2a62',      // no sunrise glow yet, just a faint lift
  glowStrength: 0.0,
  stars: 1.0,
  // Lights: surfaces use mid-tone colours, and these cool lights tint them blue.
  moonLight: '#9ab0f5',
  moonIntensity: 1.9,
  hemiSky: '#5166b8',
  hemiGround: '#141a36',
  hemiIntensity: 2.2,
};
const PREDAWN = {
  top: '#0a1440',
  mid: '#2a3a86',
  horizon: '#6b6fa8',
  glow: '#f2a17c',      // warm peach on the eastern horizon
  glowStrength: 0.9,
  stars: 0.25,
  moonLight: '#b4bdf0',
  moonIntensity: 1.7,
  hemiSky: '#7f89cc',
  hemiGround: '#221d38',
  hemiIntensity: 2.6,
};

// Where things sit in the sky (directions from the viewer).
const MOON_DIR = new THREE.Vector3(-0.5, 0.36, -0.79).normalize();
const DAWN_DIR = new THREE.Vector3(0.62, 0.0, -0.78).normalize(); // forward-right, where the sun will rise

const SKY_RADIUS = 4500;
const STAR_RADIUS = 3600;

export function createSky(scene) {
  // ---------- The sky dome: a huge sphere seen from inside, coloured by a shader ----------
  const skyUniforms = {
    uTop: { value: new THREE.Color(NIGHT.top) },
    uMid: { value: new THREE.Color(NIGHT.mid) },
    uHorizon: { value: new THREE.Color(NIGHT.horizon) },
    uGlow: { value: new THREE.Color(NIGHT.glow) },
    uGlowStrength: { value: NIGHT.glowStrength },
    uGlowDir: { value: DAWN_DIR },
    uMoonDir: { value: MOON_DIR },
    uStars: { value: 1 },
    uTime: { value: 0 },
  };

  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,  // we are inside the sphere, so draw its inner face
    depthWrite: false,     // the sky is always "behind" everything
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);  // direction from the centre = direction we look
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uMid, uHorizon, uGlow, uGlowDir, uMoonDir;
      uniform float uGlowStrength, uStars, uTime;
      varying vec3 vDir;
      ${NOISE_GLSL}

      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;

        // 1. Vertical gradient: horizon -> indigo -> deep navy overhead.
        vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.28, h));
        col = mix(col, uTop, smoothstep(0.22, 0.95, h));

        // 2. Thin painted cloud streaks low in the sky (like brush strokes).
        // (atan's seam, where the angle jumps, is placed behind the viewer, never in view.)
        vec2 sp = vec2(atan(dir.x, -dir.z) * 3.0, h * 26.0);
        float streak = fbm(sp * vec2(1.0, 1.0) + vec2(uTime * 0.004, 0.0));
        streak = smoothstep(0.52, 0.8, streak) * smoothstep(0.02, 0.1, h) * (1.0 - smoothstep(0.18, 0.34, h));
        col = mix(col, mix(uHorizon, uGlow, 0.35) * 1.08, streak * 0.22);

        // 3. A faint band of the Milky Way, broken up by noise.
        vec3 bandNormal = normalize(vec3(0.55, 0.25, 0.8));
        float band = exp(-pow(dot(dir, bandNormal) / 0.16, 2.0));
        band *= fbm(dir.xz * 7.0 + dir.y * 3.0) * smoothstep(0.08, 0.45, h);
        col += vec3(0.07, 0.08, 0.13) * band * uStars;

        // 4. Warm dawn glow hugging the horizon in the east.
        float g = max(dot(normalize(vec3(dir.x, 0.0, dir.z)), uGlowDir), 0.0);
        float glow = pow(g, 3.0) * exp(-max(h, 0.0) * 7.0);
        col = mix(col, uGlow, clamp(glow * uGlowStrength, 0.0, 1.0));

        // 5. A soft moon: a bright disc and a wide gentle halo.
        float m = max(dot(dir, uMoonDir), 0.0);
        float disc = smoothstep(0.99972, 0.99984, m);
        float halo = pow(m, 900.0) * 0.3 + pow(m, 40.0) * 0.06;
        vec3 moonCol = vec3(0.92, 0.94, 1.0);
        col += moonCol * (disc * 0.9 + halo);

        // 6. Below the horizon, just use the horizon colour (fog hides it anyway).
        col = mix(uHorizon, col, smoothstep(-0.04, 0.0, h));

        gl_FragColor = vec4(col + dither(gl_FragCoord.xy), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 48, 24), skyMat);
  sky.renderOrder = -2;      // draw first
  sky.frustumCulled = false;
  scene.add(sky);

  // ---------- Stars: points with a soft round glow that gently twinkle ----------
  const STAR_COUNT = 2200;
  const positions = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);
  const phases = new Float32Array(STAR_COUNT);
  const tints = new Float32Array(STAR_COUNT);
  for (let i = 0; i < STAR_COUNT; i++) {
    // Random direction in the upper part of the sky.
    const y = Math.pow(Math.random(), 0.8) * 0.97 + 0.03;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    positions[i * 3] = Math.cos(a) * r * STAR_RADIUS;
    positions[i * 3 + 1] = y * STAR_RADIUS;
    positions[i * 3 + 2] = Math.sin(a) * r * STAR_RADIUS;
    // Most stars are tiny; a few are larger. This feels natural, not like a grid.
    sizes[i] = 1.2 + Math.pow(Math.random(), 6) * 4.5;
    phases[i] = Math.random() * 100;
    tints[i] = Math.random();
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  starGeo.setAttribute('aTint', new THREE.BufferAttribute(tints, 1));

  const starUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 1 },
    uPixelRatio: { value: 1 },
  };
  const starMat = new THREE.ShaderMaterial({
    uniforms: starUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending, // light adds up, like real starlight
    vertexShader: /* glsl */ `
      attribute float aSize, aPhase, aTint;
      uniform float uTime, uPixelRatio;
      varying float vTwinkle, vTint, vHeight;
      void main() {
        // Twinkle: brightness slowly rises and falls, each star at its own pace.
        vTwinkle = 0.6 + 0.4 * sin(uTime * (0.6 + fract(aPhase) * 1.4) + aPhase);
        vTint = aTint;
        vHeight = normalize(position).y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * 2.2;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vTwinkle, vTint, vHeight;
      void main() {
        // Soft round dot: bright centre that fades out smoothly (no hard white pixels).
        vec2 c = gl_PointCoord - 0.5;
        float d = dot(c, c) * 4.0;
        float a = exp(-d * 6.0);
        // Gentle colour variety: mostly cool blue-white, some warm.
        vec3 cool = vec3(0.78, 0.84, 1.0);
        vec3 warm = vec3(1.0, 0.9, 0.78);
        vec3 col = mix(cool, warm, step(0.82, vTint));
        // Stars near the horizon fade into the haze.
        float horizonFade = smoothstep(0.03, 0.3, vHeight);
        gl_FragColor = vec4(col * a * vTwinkle * horizonFade * uOpacity * 0.85, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -1;     // after the sky, before the land
  stars.frustumCulled = false;
  scene.add(stars);

  // ---------- Lights ----------
  // Moonlight: a cool directional light coming from the moon's direction.
  const moonLight = new THREE.DirectionalLight(NIGHT.moonLight, NIGHT.moonIntensity);
  moonLight.position.copy(MOON_DIR).multiplyScalar(100);
  scene.add(moonLight);
  // Hemisphere light: soft blue from above, very dark from below. Fills the shadows gently.
  const hemi = new THREE.HemisphereLight(NIGHT.hemiSky, NIGHT.hemiGround, NIGHT.hemiIntensity);
  scene.add(hemi);

  // ---------- Fog: same colour as the horizon, so far objects melt into the sky ----------
  // "Exp2" fog thickens smoothly with distance, so each row of trees is a little paler
  // than the one in front, the layered look of a painting.
  scene.fog = new THREE.FogExp2(NIGHT.horizon, 0.0095);

  // Colour objects we reuse every frame (making new ones each frame wastes memory).
  const night = toColors(NIGHT);
  const dawn = toColors(PREDAWN);

  // ---------- setDawn: blend everything from night (0) to pre-dawn (1) ----------
  function setDawn(t) {
    skyUniforms.uTop.value.lerpColors(night.top, dawn.top, t);
    skyUniforms.uMid.value.lerpColors(night.mid, dawn.mid, t);
    skyUniforms.uHorizon.value.lerpColors(night.horizon, dawn.horizon, t);
    skyUniforms.uGlow.value.lerpColors(night.glow, dawn.glow, t);
    skyUniforms.uGlowStrength.value = lerp(NIGHT.glowStrength, PREDAWN.glowStrength, t);
    const starAmount = lerp(NIGHT.stars, PREDAWN.stars, t);
    skyUniforms.uStars.value = starAmount;
    starUniforms.uOpacity.value = starAmount;
    scene.fog.color.copy(skyUniforms.uHorizon.value);
    moonLight.color.lerpColors(night.moonLight, dawn.moonLight, t);
    moonLight.intensity = lerp(NIGHT.moonIntensity, PREDAWN.moonIntensity, t);
    hemi.color.lerpColors(night.hemiSky, dawn.hemiSky, t);
    hemi.groundColor.lerpColors(night.hemiGround, dawn.hemiGround, t);
    hemi.intensity = lerp(NIGHT.hemiIntensity, PREDAWN.hemiIntensity, t);
  }
  setDawn(0);

  // ---------- update: called every frame ----------
  function update(time, camera, pixelRatio) {
    skyUniforms.uTime.value = time;
    starUniforms.uTime.value = time;
    starUniforms.uPixelRatio.value = pixelRatio;
    // The sky and stars travel with the camera, so they always look infinitely far away.
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
  }

  return {
    update,
    setDawn,
    moonLight,
    hemi,
    // Shared colours other parts of the world (mountains, mist) read to stay in harmony.
    colors: { horizon: skyUniforms.uHorizon.value, glow: skyUniforms.uGlow.value, mid: skyUniforms.uMid.value },
    glowStrength: () => skyUniforms.uGlowStrength.value,
    dawnDir: DAWN_DIR,
    moonDir: MOON_DIR,
  };
}

function lerp(a, b, t) { return a + (b - a) * t; }
function toColors(mood) {
  const out = {};
  for (const key of Object.keys(mood)) {
    if (typeof mood[key] === 'string') out[key] = new THREE.Color(mood[key]);
  }
  return out;
}
