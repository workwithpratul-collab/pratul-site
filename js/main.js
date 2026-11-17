// main.js: starts everything.
// It creates the 3D basics (scene, camera, renderer), builds the world, connects scrolling
// to the camera, then runs one loop that redraws the world about 60 times per second.

import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { createSky } from './world/sky.js';
import { createMountains, createGround, trailCurve } from './world/terrain.js';
import { createForest } from './world/forest.js';
import { createBaseCamp } from './world/camp.js';
import { createMist } from './world/mist.js';
import { createTrekker } from './world/trekker.js';
import { createCameraPath } from './world/cameraPath.js';

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

// ---------- 4. Light and sky ----------
// sky.js owns the sky dome, stars, moonlight, fill light and fog, so they can change together.
const sky = createSky(scene);

// ---------- 5. The world ----------
// The camera path is worked out first, so the forest can keep trees off the camera's route.
const cameraPath = createCameraPath(trailCurve);
createMountains(scene, sky);
createGround(scene);
const forest = createForest(scene, { avoid: cameraPath.avoid });
const baseCamp = createBaseCamp(scene);
const mist = createMist(scene, sky);
const trekker = createTrekker(scene);

// ---------- 6. Scrolling → progress (0 at the top, 1 at the bottom) ----------
// Lenis smooths the wheel/trackpad so scrolling glides instead of jumping in steps.
const lenis = new Lenis({ lerp: 0.07, wheelMultiplier: 0.8, smoothWheel: true });
gsap.registerPlugin(ScrollTrigger);
// Let GSAP's clock drive Lenis, and tell ScrollTrigger whenever Lenis scrolls.
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

const scroll = { target: 0, progress: 0 };
ScrollTrigger.create({
  trigger: '#scroll-track',
  start: 'top top',
  end: 'bottom bottom',
  onUpdate: (self) => { scroll.target = self.progress; },
});

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

// ---------- Moving the trekker along the trail ----------
const trekPos = new THREE.Vector3();
const trekDir = new THREE.Vector3();
let heading = null;
function placeTrekker(u, dt) {
  trailCurve.getPointAt(u, trekPos);
  trailCurve.getTangentAt(u, trekDir);
  const target = Math.atan2(trekDir.x, trekDir.z);
  // Turn smoothly towards the trail direction (taking the short way round the circle).
  if (heading === null) heading = target;
  let diff = target - heading;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  heading += diff * (1 - Math.exp(-dt * 5));
  trekker.place(trekPos.x, trekPos.z, heading);
}

// ---------- The loop: update, then draw, every frame ----------
// Timer measures how much time passed since the last frame ("delta time").
const timer = new THREE.Timer();
let snapNextFrame = true;   // the first frame puts the camera exactly in place

function tick(timestamp) {
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 0.1); // cap, so a hiccup never causes a big jump
  const time = timer.getElapsed();

  // A second, gentle smoothing on top of Lenis, so the film never lurches.
  if (snapNextFrame) scroll.progress = scroll.target;
  scroll.progress += (scroll.target - scroll.progress) * (1 - Math.exp(-dt * 4));

  const u = cameraPath.update(camera, scroll.progress, dt, snapNextFrame);
  placeTrekker(u, dt);
  snapNextFrame = false;

  sky.update(time, camera, renderer.getPixelRatio());
  forest.update(time);
  baseCamp.update(time);
  mist.update(time);
  trekker.update(dt, time);

  renderer.render(scene, camera);
  countFps(performance.now());
}
renderer.setAnimationLoop(tick);

// A small hook so tests (and you, in the console) can peek at the state.
window.__ascent = {
  ready: false,
  get fps() { return fps; },
  get progress() { return scroll.progress; },
  info: () => ({ trees: forest.count, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
  // Jump straight to a point in the film (0..1), for testing.
  jump(p) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    lenis.scrollTo(p * max, { immediate: true, force: true });
    scroll.target = p;
    snapNextFrame = true;
  },
  lenis,
};

// Tell tests the world is ready once the character has loaded (or failed to).
trekker.ready
  .catch((e) => console.error('[trekker] failed to load', e))
  .finally(() => { window.__ascent.ready = true; });
