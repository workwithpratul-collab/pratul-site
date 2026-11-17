// style-frame.js: draws ONE style frame (a still of a scene we haven't built into the film yet).
//
//   style-frame.html?scene=meadow   → scene 3, first light
//   style-frame.html?scene=summit   → scene 4, sunrise
//   add &pause to stop drawing a few seconds after it is ready (used when several frames
//   share a page, like style-frames.html and style-guide.html).
//
// Same renderer settings as the film (sharp, sRGB, no tone mapping, pixel ratio capped at 2),
// and the same palette, so what you see here is what the film will look like.

import * as THREE from 'three';
import { setClimb, CLIMB } from './world/palette.js';
import { createMeadow } from './world/meadow.js';
import { createSummit } from './world/summit.js';

const params = new URLSearchParams(location.search);
const name = params.get('scene') === 'summit' ? 'summit' : 'meadow';
const MAX_PIXEL_RATIO = 2;

// ---------- Renderer, scene, camera: exactly like the film ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 6000);

// ---------- The time of day comes from the palette ----------
setClimb(name === 'summit' ? CLIMB.sunrise : CLIMB.firstLight);
const frame = name === 'summit' ? createSummit(scene, { renderer, camera }) : createMeadow(scene, { renderer, camera });
document.title = `${name === 'summit' ? 'The summit' : 'The meadow'} · style frame`;
renderer.compile(scene, camera);

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
}
window.addEventListener('resize', onResize);

// ---------- The loop ----------
const timer = new THREE.Timer();
let frames = 0, fpsTime = performance.now(), fps = 0;
renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  frame.update(Math.min(timer.getDelta(), 0.1), timer.getElapsed());
  renderer.render(scene, camera);
  frames++;
  const now = performance.now();
  if (now - fpsTime >= 1000) { fps = Math.round((frames * 1000) / (now - fpsTime)); frames = 0; fpsTime = now; }
});

// Ready once the trekker has loaded: lift the cover, and (with &pause) stop drawing a little later.
window.__frames = { ready: false, get fps() { return fps; }, scene, camera, renderer };
frame.ready
  .catch((e) => console.error('[style-frame] trekker failed to load', e))
  .finally(() => {
    window.__frames.ready = true;
    document.getElementById('curtain').classList.add('is-lifted');
    if (params.has('pause')) setTimeout(() => renderer.setAnimationLoop(null), 4000);
  });
