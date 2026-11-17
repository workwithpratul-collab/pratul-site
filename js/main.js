// main.js: starts everything.
// It creates the 3D basics (scene, camera, renderer, light), then runs one loop
// that redraws the world about 60 times per second.

import * as THREE from 'three';
import { createSky } from './world/sky.js';
import { createMountains } from './world/terrain.js';

// ---------- Settings you may want to change ----------
// Show the FPS counter? You can also add ?fps to the address, or press F to toggle it.
const SHOW_FPS = new URLSearchParams(location.search).has('fps');
// Never render at more than 2x pixels: above that the eye can't tell, but the GPU pays.
const MAX_PIXEL_RATIO = 2;

// ---------- 1. The renderer: turns the 3D scene into pixels on the canvas ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,                  // smooth edges on shapes
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
renderer.setSize(window.innerWidth, window.innerHeight);
// sRGB output means the colours we pick in code look the same on screen.
renderer.outputColorSpace = THREE.SRGBColorSpace;
// No tone mapping: for a painted look we want our chosen colours shown exactly.
renderer.toneMapping = THREE.NoToneMapping;

// ---------- 2. The scene: the container that holds every 3D object ----------
const scene = new THREE.Scene();

// ---------- 3. The camera: our eye in the world ----------
// 40° is a calm, slightly "telephoto" view; wide angles feel dizzying when moving.
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 6000);
camera.position.set(0, 1.6, 8);
camera.lookAt(0, 6, -40);

// ---------- 4. Light and sky ----------
// sky.js owns the sky dome, stars, moonlight, fill light and fog, so they can change together.
const sky = createSky(scene);

// ---------- 5. The world ----------
createMountains(scene, sky);

// ---------- Resize: keep the picture sharp and undistorted when the window changes ----------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ---------- FPS counter: counts frames drawn each second ----------
const fpsEl = document.getElementById('fps');
fpsEl.hidden = !SHOW_FPS;
let frames = 0;
let fpsTime = performance.now();
let fps = 0;
window.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') fpsEl.hidden = !fpsEl.hidden;
});
function countFps(now) {
  frames++;
  if (now - fpsTime >= 1000) {
    fps = Math.round((frames * 1000) / (now - fpsTime));
    frames = 0;
    fpsTime = now;
    if (!fpsEl.hidden) fpsEl.textContent = `${fps} fps`;
  }
}

// ---------- The loop: update, then draw, every frame ----------
// Timer measures how much time passed since the last frame ("delta time").
const timer = new THREE.Timer();
function tick(timestamp) {
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 0.1); // cap, so a hiccup never causes a big jump
  sky.update(timer.getElapsed(), camera, renderer.getPixelRatio());
  renderer.render(scene, camera);
  countFps(performance.now());
}
renderer.setAnimationLoop(tick);

// A small hook so tests (and you, in the console) can peek at the state.
window.__ascent = {
  ready: true,
  get fps() { return fps; },
  // TEMP test views until the camera rail exists: 0 = base camp, 1 = up at the ridge.
  jump(p) {
    if (p < 0.5) { camera.position.set(0, 1.6, 8); camera.lookAt(0, 6, -40); }
    else { camera.position.set(-6, 30, -150); camera.lookAt(0, 20, -400); }
  },
};
