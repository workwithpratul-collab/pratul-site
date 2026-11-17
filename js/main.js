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
import { createBaseCamp, createProjectCamp, RIDGE_CAMP, RIDGE_VIEWPOINT } from './world/camp.js';
import { createMist } from './world/mist.js';
import { createTrekker } from './world/trekker.js';
import { createCameraPath, BEATS } from './world/cameraPath.js';
import { smoothstep } from './world/terrain.js';
import { mood, setClimb, CLIMB } from './world/palette.js';
import { createAltitudeMeter } from './ui/altitude.js';
import { createCursor } from './ui/cursor.js';

// ---------- Settings you may want to change ----------
// Show the FPS counter? You can also add ?fps to the address, or press F to toggle it.
const SHOW_FPS = new URLSearchParams(location.search).has('fps');
// Never render at more than 2x pixels: above that the eye can't tell, but the GPU pays.
const MAX_PIXEL_RATIO = 2;
// Still mode, for the style frames: ?still=0 shows base camp, ?still=1 the ridge camp, as a clean
// picture with no text. Add &pause to stop drawing once it has settled (saves the GPU when
// several frames sit on one page).
const params = new URLSearchParams(location.search);
const STILL = params.has('still') ? Math.min(Math.max(Number(params.get('still')) || 0, 0), 1) : null;
if (STILL !== null) document.documentElement.classList.add('is-still');

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
const mountains = createMountains(scene);
createGround(scene);
const forest = createForest(scene, { routeDistance: cameraPath.routeDistance, sky });
const baseCamp = createBaseCamp(scene);
const mist = createMist(scene);
const trekker = createTrekker(scene, renderer, camera);

// The first project camp: DERMAÉ, on the ridge. Its screen faces the arrival viewpoint.
const dermaeCamp = createProjectCamp(scene, {
  x: RIDGE_CAMP.x,
  z: RIDGE_CAMP.z,
  facing: Math.atan2(RIDGE_VIEWPOINT.x - RIDGE_CAMP.x, RIDGE_VIEWPOINT.z - RIDGE_CAMP.z),
  video: 'recordings/dermae.mp4',
  label: document.getElementById('label-dermae'),
  renderer,
});

// Build every shader now, while the curtain is still down. Otherwise three.js compiles each
// one the first time its object comes into view, which causes a small stutter mid-scroll.
renderer.compile(scene, camera);

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

// ---------- The interface on top of the film ----------
// The altitude meter: Phase 1's film ends at the ridge camp, so a full rail = the ridge.
const altitude = createAltitudeMeter(document.getElementById('altitude'), { filmEnd: CLIMB.predawn });
// A subtle custom cursor (only with a mouse or trackpad; not in the style-frame stills).
if (STILL === null) createCursor();

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
  let target = Math.atan2(trekDir.x, trekDir.z);
  // On arrival, turn to face the project tent's screen.
  const arrive = smoothstep(0.96, 0.995, u);
  if (arrive > 0) {
    const toTent = Math.atan2(RIDGE_CAMP.x - trekPos.x, RIDGE_CAMP.z - trekPos.z);
    let d = toTent - target;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    target += d * arrive * 0.85;
  }
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

  // Light: one "climb" number (0 = night at base camp ... 1 = sunrise at the summit) sets the
  // palette's mood. Sky, fog, lights, mist, trees, mountains and the trekker all read from it,
  // so they change together. Phase 1 only climbs to the first camp, so the light goes
  // 80% of the way from night towards pre-dawn.
  setClimb(smoothstep(0.08, 0.98, scroll.progress) * 0.8 * CLIMB.predawn);
  sky.applyMood();
  mountains.userData.applyMood();
  trekker.setLightLevel(mood.character.level, mood.character.tint);
  altitude.update(scroll.progress);

  // The project camp "wakes up" as we approach the ridge.
  dermaeCamp.update(dt, camera, smoothstep(0.55, BEATS.walkEnd + 0.04, scroll.progress), scroll.progress > 0.35, time);

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
  info: () => ({ trees: forest.counts, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
  // Jump straight to a point in the film (0..1), for testing.
  jump(p) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    lenis.scrollTo(p * max, { immediate: true, force: true });
    scroll.target = p;
    snapNextFrame = true;
    heading = null;
    trekker.teleport();
  },
  lenis,
  scene,   // handy in the console: e.g. __ascent.scene.getObjectByName("stones")
};

// ---------- 7. The opening text and the page "chrome" ----------
const curtain = document.getElementById('curtain');
const intro = document.getElementById('intro');
const hint = document.getElementById('scroll-hint');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Split the headline into words, so each word can appear on its own.
const headline = intro.querySelector('.intro__headline');
headline.innerHTML = headline.textContent
  .trim()
  .split(/\s+/)   // split on spaces
  .map((word) => `<span class="word">${word}</span>`)
  .join(' ');

// Soft reveal: "Hi, I'm Pratul." first, then the headline word by word, then the scroll hint.
function revealIntro() {
  if (reduceMotion) {
    gsap.set(['.intro__hello', '.intro__headline .word', hint, '#altitude'], { opacity: 1 });
    return;
  }
  const tl = gsap.timeline({ delay: 0.6 });
  tl.fromTo('.intro__hello', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1.4, ease: 'power2.out' })
    .fromTo('.intro__headline .word',
      { opacity: 0, y: 18, filter: 'blur(8px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'power3.out', stagger: 0.07 },
      '-=0.6')
    .to(hint, { opacity: 1, duration: 1.2, ease: 'power1.out' }, '+=0.2')
    .to('#altitude', { opacity: 1, duration: 1.6, ease: 'power1.out' }, '<');
}

// As the climb begins (the first half-screen of scrolling), the text drifts up and fades away.
gsap.to(intro, {
  opacity: 0,
  y: -40,
  ease: 'none',
  scrollTrigger: { trigger: '#scroll-track', start: 'top top', end: () => `+=${window.innerHeight * 0.5}`, scrub: true },
});
ScrollTrigger.create({
  trigger: '#scroll-track',
  start: 'top top',
  end: () => `+=${window.innerHeight * 0.25}`,
  onUpdate: (self) => { if (self.progress > 0.05) gsap.to(hint, { opacity: 0, duration: 0.6, overwrite: true }); },
});

// Lift the curtain when the character is ready, or after 6 seconds at the most.
let lifted = false;
function liftCurtain() {
  if (lifted) return;
  lifted = true;
  curtain.classList.add('is-lifted');
  revealIntro();
}
setTimeout(liftCurtain, 6000);

// "Skip film": dip to black, jump to the end, fade back in (no fast-forward rush up the trail).
document.getElementById('skip').addEventListener('click', (e) => {
  e.preventDefault();
  curtain.classList.add('is-dipping');
  curtain.classList.remove('is-lifted');
  setTimeout(() => {
    window.__ascent.jump(1);
    setTimeout(() => {
      curtain.classList.add('is-lifted');
      setTimeout(() => curtain.classList.remove('is-dipping'), 700);
    }, 120);
  }, 650);
});

// Tell tests the world is ready once the character has loaded (or failed to).
trekker.ready
  .catch((e) => console.error('[trekker] failed to load', e))
  .finally(() => {
    window.__ascent.ready = true;
    if (STILL !== null) showStill();
    liftCurtain();
  });

// Still mode: jump to the chosen moment, and (with &pause) stop drawing a few seconds later.
function showStill() {
  window.__ascent.jump(STILL);
  if (!params.has('pause')) return;
  setTimeout(() => {
    renderer.setAnimationLoop(null);
    // If the frame is resized while paused, draw it once more at the new size.
    window.addEventListener('resize', () => renderer.render(scene, camera));
  }, 4000);
}
